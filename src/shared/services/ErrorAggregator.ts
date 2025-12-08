import { ServiceError } from '../errors/ServiceError';
import { ErrorSeverity, CRITICAL_ERROR_CODES } from '../errors/ErrorTypes';
import { LogManager } from '../utils/LogManager';
import type { Logger } from '../utils/Logger';
import { ERROR_AGGREGATION } from '../utils/LoggingConstants';

import { BaseService } from './BaseService';
import type { ServiceOptions, OperationContext } from './BaseService';
import type { ErrorAlert, ErrorPattern } from './types';

/**
 * Alert configuration for error monitoring
 */
export interface AlertConfig {
  /** Enable alerting */
  enabled: boolean;
  /** Alert thresholds */
  thresholds: {
    /** Error rate threshold (errors per minute) */
    errorRateThreshold: number;
    /** Critical error count threshold */
    criticalErrorThreshold: number;
    /** Alert cooldown period in milliseconds */
    cooldownMs: number;
  };
  /** Alert channels */
  channels: {
    /** Log alerts to console/file */
    log: boolean;
    /** Send alerts via callback */
    callback?: (alert: ErrorAlert) => void | Promise<void>;
    /** Custom alert handlers */
    custom?: Array<(alert: ErrorAlert) => void | Promise<void>>;
  };
}

/**
 * Error aggregation data
 */
export interface ErrorAggregation {
  errorType: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  sampleErrors: Error[];
  services: Set<string>;
  operations: Set<string>;
}

/**
 * Error rate tracking data
 */
export interface ErrorRateData {
  service: string;
  operation?: string;
  timestamp: number;
  errorCount: number;
  totalRequests: number;
}

/**
 * ErrorAggregator service options
 */
export interface ErrorAggregatorOptions extends Omit<ServiceOptions, 'name'> {
  /** Service name (required) */
  name?: string;
  /** Alert configuration */
  alertConfig?: Partial<AlertConfig>;
  /** Aggregation window in milliseconds */
  aggregationWindowMs?: number;
  /** Maximum sample errors to keep per type */
  maxSampleErrors?: number;
  /** Error rate tracking window in minutes */
  rateTrackingWindowMinutes?: number;
  /** Pattern detection enabled */
  patternDetectionEnabled?: boolean;
}

/**
 * ErrorAggregator - Monitors error patterns, tracks error rates, and provides alerting
 */
export class ErrorAggregator extends BaseService {
  private errors = new Map<string, ErrorAggregation>();
  private errorHistory: ErrorRateData[] = [];
  private patterns: ErrorPattern[] = [];
  private alerts: ErrorAlert[] = [];
  private lastCleanup = Date.now();
  private lastAlertTime = 0;
  private logger = LogManager.getLogger('ErrorAggregator');

  private readonly alertConfig: AlertConfig;
  private readonly aggregationWindowMs: number;
  private readonly maxSampleErrors: number;
  private readonly rateTrackingWindowMinutes: number;
  private readonly patternDetectionEnabled: boolean;

  constructor(options: ErrorAggregatorOptions = {}) {
    super({
      name: options.name ?? 'error-aggregator',
      ...options,
    });

    this.alertConfig = {
      enabled: true,
      thresholds: {
        errorRateThreshold: 5, // 5 errors per minute
        criticalErrorThreshold: 3, // 3 critical errors
        cooldownMs: 5 * 60 * 1000, // 5 minutes
      },
      channels: {
        log: true,
      },
      ...options.alertConfig,
    };

    this.aggregationWindowMs =
      options.aggregationWindowMs ?? ERROR_AGGREGATION.AGGREGATION_WINDOW_MS;
    this.maxSampleErrors =
      options.maxSampleErrors ?? ERROR_AGGREGATION.MAX_SAMPLE_ERRORS;
    this.rateTrackingWindowMinutes = options.rateTrackingWindowMinutes ?? 5;
    this.patternDetectionEnabled = options.patternDetectionEnabled ?? true;
  }

  /**
   * Record an error for aggregation and monitoring
   */
  recordError(
    error: Error,
    context?: {
      service?: string;
      operation?: string;
      userId?: string;
      requestId?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    return this.executeOperation(
      async () => {
        const errorType = this.getErrorType(error);
        const now = new Date();
        const service = context?.service ?? 'unknown';
        const operation = context?.operation ?? 'unknown';

        // Update aggregation
        const existing = this.errors.get(errorType);
        if (existing) {
          existing.count++;
          existing.lastSeen = now;
          existing.services.add(service);
          existing.operations.add(operation);
          if (existing.sampleErrors.length < this.maxSampleErrors) {
            existing.sampleErrors.push(error);
          }
        } else {
          this.errors.set(errorType, {
            errorType,
            count: 1,
            firstSeen: now,
            lastSeen: now,
            sampleErrors: [error],
            services: new Set([service]),
            operations: new Set([operation]),
          });
        }

        // Record error rate data
        this.errorHistory.push({
          service,
          operation,
          timestamp: now.getTime(),
          errorCount: 1,
          totalRequests: 1, // This would be updated by service integration
        });

        // Cleanup old data
        this.cleanup();

        // Check for alerts (wrap in try-catch to avoid breaking error recording)
        try {
          await this.checkAlerts();
        } catch (alertError) {
          this.logger.warn('Failed to check alerts', alertError);
        }

        // Detect patterns if enabled
        if (this.patternDetectionEnabled) {
          this.detectPatterns();
        }
      },
      {
        operation: 'record_error',
        timeout: 5000, // 5 second timeout for error recording
      },
    );
  }

  /**
   * Record successful operation for error rate calculation
   */
  recordSuccess(
    service: string,
    operation?: string,
    _metadata?: Record<string, any>,
  ): Promise<void> {
    return this.executeOperation(
      () => {
        const now = new Date();
        this.errorHistory.push({
          service,
          operation: operation ?? 'unknown',
          timestamp: now.getTime(),
          errorCount: 0,
          totalRequests: 1,
        });

        this.cleanup();
        return Promise.resolve();
      },
      {
        operation: 'record_success',
      },
    );
  }

  /**
   * Get current error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    uniqueErrorTypes: number;
    errorRate: number; // errors per minute
    criticalErrors: number;
    mostFrequentError?: { type: string; count: number };
    serviceBreakdown: Record<string, number>;
    patterns: ErrorPattern[];
  } {
    const aggregated = Array.from(this.errors.values());
    const totalErrors = aggregated.reduce((sum, agg) => sum + agg.count, 0);
    const uniqueErrorTypes = aggregated.length;

    // Calculate error rate
    const windowStart = Date.now() - this.rateTrackingWindowMinutes * 60 * 1000;
    const recentData = this.errorHistory.filter(
      entry => entry.timestamp > windowStart,
    );
    const totalRequests = recentData.reduce(
      (sum, entry) => sum + entry.totalRequests,
      0,
    );
    const totalErrorCount = recentData.reduce(
      (sum, entry) => sum + entry.errorCount,
      0,
    );
    const errorRate =
      totalRequests > 0 ? totalErrorCount / this.rateTrackingWindowMinutes : 0;

    // Count critical errors
    const criticalErrors = aggregated
      .filter(agg => {
        // Extract error code from type format "TYPE_CODE" or just use the type if no underscore
        const errorCode = agg.errorType.includes('_')
          ? agg.errorType.substring(agg.errorType.indexOf('_') + 1)
          : agg.errorType;
        return CRITICAL_ERROR_CODES.has(errorCode);
      })
      .reduce((sum, agg) => sum + agg.count, 0);

    // Find most frequent error
    const mostFrequentError = aggregated.reduce(
      (max: any, current) =>
        current.count > (max?.count ?? 0) ? current : max,
      undefined,
    );

    // Service breakdown
    const serviceBreakdownMap = new Map<string, number>();
    for (const agg of aggregated) {
      for (const service of Array.from(agg.services)) {
        const current = serviceBreakdownMap.get(service) ?? 0;
        serviceBreakdownMap.set(service, current + agg.count);
      }
    }

    const serviceBreakdown: Record<string, number> = {};
    serviceBreakdownMap.forEach((count, service) => {
      // eslint-disable-next-line security/detect-object-injection
      serviceBreakdown[service] = count;
    });

    return {
      totalErrors,
      uniqueErrorTypes,
      errorRate,
      criticalErrors,
      mostFrequentError: mostFrequentError
        ? { type: mostFrequentError.errorType, count: mostFrequentError.count }
        : undefined,
      serviceBreakdown,
      patterns: [...this.patterns],
    };
  }

  /**
   * Get raw error aggregation data for testing and analysis
   */
  getAggregatedErrors(): ErrorAggregation[] {
    return Array.from(this.errors.values());
  }

  /**
   * Get error rate for specific service/operation
   */
  getErrorRate(
    service?: string,
    operation?: string,
    minutes: number = this.rateTrackingWindowMinutes,
  ): {
    errorRate: number;
    totalErrors: number;
    totalRequests: number;
    errorPercentage: number;
  } {
    const windowStart = Date.now() - minutes * 60 * 1000;
    const relevantData = this.errorHistory.filter(entry => {
      if (entry.timestamp < windowStart) {
        return false;
      }
      if (service && entry.service !== service) {
        return false;
      }
      if (operation && entry.operation !== operation) {
        return false;
      }
      return true;
    });

    const totalRequests = relevantData.reduce(
      (sum, entry) => sum + entry.totalRequests,
      0,
    );
    const totalErrors = relevantData.reduce(
      (sum, entry) => sum + entry.errorCount,
      0,
    );
    const errorRate = totalRequests > 0 ? totalErrors / minutes : 0;
    const errorPercentage =
      totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      errorRate,
      totalErrors,
      totalRequests,
      errorPercentage,
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): ErrorAlert[] {
    const now = Date.now();
    const cooldownPeriod = this.alertConfig.thresholds.cooldownMs;

    return this.alerts.filter(
      alert => now - alert.timestamp.getTime() < cooldownPeriod,
    );
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(): void {
    const now = Date.now();
    const cooldownPeriod = this.alertConfig.thresholds.cooldownMs;

    this.alerts = this.alerts.filter(
      alert => now - alert.timestamp.getTime() < cooldownPeriod,
    );
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(): ErrorPattern[] {
    return [...this.patterns];
  }

  /**
   * Reset error aggregator state
   */
  override async reset(): Promise<void> {
    this.errors.clear();
    this.errorHistory = [];
    this.patterns = [];
    this.alerts = [];
    this.lastCleanup = Date.now();
    this.lastAlertTime = 0;
    await Promise.resolve();
  }

  /**
   * Log current error statistics
   */
  logStatistics(logger?: Logger): Promise<void> {
    if (!logger) {
      return Promise.resolve();
    }

    return this.executeOperation(
      () => {
        const stats = this.getErrorStatistics();
        const activeAlerts = this.getActiveAlerts();

        logger.info('Error aggregator statistics', {
          service: this.name,
          operation: 'statistics_report',
          timestamp: new Date().toISOString(),
          statistics: stats,
          activeAlerts: activeAlerts.length,
          recentAlerts: activeAlerts.slice(-5), // Last 5 alerts
        });
        return Promise.resolve();
      },
      {
        operation: 'log_statistics',
      },
    );
  }

  // Private methods

  private getErrorType(error: Error): string {
    if (error instanceof ServiceError) {
      return `${error.type}_${error.code}`;
    }
    return error.constructor.name;
  }

  private cleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < ERROR_AGGREGATION.CLEANUP_INTERVAL_MS) {
      return;
    }

    // Cleanup old error history
    const historyCutoff = now - this.rateTrackingWindowMinutes * 60 * 1000;
    this.errorHistory = this.errorHistory.filter(
      entry => entry.timestamp > historyCutoff,
    );

    // Cleanup old aggregations (keep recent ones)
    const aggregationCutoff = now - this.aggregationWindowMs;
    for (const [key, agg] of Array.from(this.errors)) {
      if (agg.lastSeen.getTime() < aggregationCutoff && agg.count < 5) {
        this.errors.delete(key);
      }
    }

    this.lastCleanup = now;
  }

  private async checkAlerts(): Promise<void> {
    if (!this.alertConfig.enabled) {
      return;
    }

    const now = Date.now();
    if (now - this.lastAlertTime < this.alertConfig.thresholds.cooldownMs) {
      return; // Cooldown active
    }

    const stats = this.getErrorStatistics();
    const alerts: ErrorAlert[] = [];

    // Check error rate threshold
    if (stats.errorRate > this.alertConfig.thresholds.errorRateThreshold) {
      alerts.push({
        id: `error_rate_${Date.now()}`,
        type: 'error_rate',
        severity: ErrorSeverity.HIGH,
        message: `Error rate exceeded threshold: ${stats.errorRate.toFixed(2)} errors/minute`,
        timestamp: new Date(),
        details: {
          rate: stats.errorRate,
          count: stats.totalErrors,
        },
        metadata: { threshold: this.alertConfig.thresholds.errorRateThreshold },
      });
    }

    // Check critical error threshold
    if (
      stats.criticalErrors >= this.alertConfig.thresholds.criticalErrorThreshold
    ) {
      const criticalAggs = Array.from(this.errors.values()).filter(agg =>
        CRITICAL_ERROR_CODES.has(agg.errorType.split('_')[1] ?? ''),
      );

      alerts.push({
        id: `critical_errors_${Date.now()}`,
        type: 'critical_error',
        severity: ErrorSeverity.CRITICAL,
        message: `Critical error threshold exceeded: ${stats.criticalErrors} critical errors`,
        timestamp: new Date(),
        details: {
          count: stats.criticalErrors,
          samples: criticalAggs.slice(0, 3).map(agg => ({
            message: agg.sampleErrors[0]?.message ?? 'Unknown error',
            service: Array.from(agg.services)[0],
            operation: Array.from(agg.operations)[0],
          })),
        },
        metadata: {
          threshold: this.alertConfig.thresholds.criticalErrorThreshold,
        },
      });
    }

    // Check for error spikes
    const recentRate = this.getErrorRate(undefined, undefined, 1); // Last minute
    const avgRate = stats.errorRate;
    if (recentRate.errorRate > avgRate * 3 && recentRate.totalErrors > 5) {
      alerts.push({
        id: `error_spike_${Date.now()}`,
        type: 'error_spike',
        severity: ErrorSeverity.HIGH,
        message: `Error spike detected: ${recentRate.errorRate.toFixed(2)} errors/minute (3x average)`,
        timestamp: new Date(),
        details: {
          rate: recentRate.errorRate,
          count: recentRate.totalErrors,
        },
        metadata: { averageRate: avgRate },
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
      this.alerts.push(alert);
    }

    if (alerts.length > 0) {
      this.lastAlertTime = now;
    }
  }

  private async sendAlert(alert: ErrorAlert): Promise<void> {
    // Log alert
    if (this.alertConfig.channels.log) {
      this.logger.warn(
        `[ERROR ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`,
      );
    }

    // Send via callback
    if (this.alertConfig.channels.callback) {
      try {
        await this.alertConfig.channels.callback(alert);
      } catch (error) {
        this.logger.error('Error sending alert via callback', error as Error);
      }
    }

    // Send via custom channels
    if (this.alertConfig.channels.custom) {
      for (const handler of this.alertConfig.channels.custom) {
        try {
          await handler(alert);
        } catch (error) {
          this.logger.error(
            'Error sending alert via custom handler',
            error as Error,
          );
        }
      }
    }
  }

  private detectPatterns(): void {
    const aggregated = Array.from(this.errors.values());

    // Clear old patterns
    this.patterns = this.patterns.filter(
      pattern =>
        Date.now() - pattern.lastSeen.getTime() < this.aggregationWindowMs,
    );

    // Detect timeout patterns
    const timeoutErrors = aggregated.filter(
      agg =>
        agg.errorType.toLowerCase().includes('timeout') ||
        agg.sampleErrors.some(e => e.message.toLowerCase().includes('timeout')),
    );

    if (timeoutErrors.length > 2) {
      const existingPattern = this.patterns.find(
        p => p.pattern === 'timeout_cluster',
      );
      if (existingPattern) {
        existingPattern.frequency = timeoutErrors.reduce(
          (sum, e) => sum + e.count,
          0,
        );
        existingPattern.lastSeen = new Date();
        existingPattern.errors = timeoutErrors.map(e => e.errorType);
      } else {
        this.patterns.push({
          pattern: 'timeout_cluster',
          description: 'Multiple timeout errors detected across services',
          errors: timeoutErrors.map(e => e.errorType),
          frequency: timeoutErrors.reduce((sum, e) => sum + e.count, 0),
          severity: ErrorSeverity.MEDIUM,
          firstDetected: new Date(),
          lastSeen: new Date(),
        });
      }
    }

    // Detect connection patterns
    const connectionErrors = aggregated.filter(
      agg =>
        agg.errorType.toLowerCase().includes('connection') ||
        agg.sampleErrors.some(e =>
          e.message.toLowerCase().includes('connection'),
        ),
    );

    if (connectionErrors.length > 2) {
      const existingPattern = this.patterns.find(
        p => p.pattern === 'connection_cluster',
      );
      if (existingPattern) {
        existingPattern.frequency = connectionErrors.reduce(
          (sum, e) => sum + e.count,
          0,
        );
        existingPattern.lastSeen = new Date();
        existingPattern.errors = connectionErrors.map(e => e.errorType);
      } else {
        this.patterns.push({
          pattern: 'connection_cluster',
          description: 'Multiple connection errors detected across services',
          errors: connectionErrors.map(e => e.errorType),
          frequency: connectionErrors.reduce((sum, e) => sum + e.count, 0),
          severity: ErrorSeverity.HIGH,
          firstDetected: new Date(),
          lastSeen: new Date(),
        });
      }
    }
  }

  protected override async logOperation(
    _event: 'success' | 'error' | 'retry',
    _context: OperationContext,
    _data: any,
  ): Promise<void> {
    // Error aggregator operations are typically internal and don't need extensive logging
    // This could be enhanced to use a logger if needed
    await Promise.resolve();
  }

  protected override async onShutdown(): Promise<void> {
    // Log final statistics before shutdown
    const stats = this.getErrorStatistics();
    this.logger.info(
      `ErrorAggregator shutdown - Total errors: ${stats.totalErrors}, Rate: ${stats.errorRate.toFixed(2)}/min`,
    );
    await Promise.resolve();
  }
}

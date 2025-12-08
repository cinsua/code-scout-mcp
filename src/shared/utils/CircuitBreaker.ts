import {
  getCircuitBreakerConstant,
  getTimeout,
} from '@/shared/errors/ErrorConstants';
import type {
  ErrorAggregatorOptions,
  AlertConfig,
} from '@/shared/services/ErrorAggregator';
import { ServiceError } from '@/shared/errors/ServiceError';
import { ErrorFactory } from '@/shared/errors/ErrorFactory';
import { ErrorAggregator } from '@/shared/services/ErrorAggregator';
import { LogManager } from '@/shared/utils/LogManager';

// Concrete implementation of ServiceError for circuit breaker use
class ConcreteServiceError extends ServiceError {
  constructor(type: string, code: string, message: string, options?: any) {
    super(type, code, message, options);
  }
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  successThreshold: number;
  timeout?: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
  errorAggregator?: ErrorAggregatorOptions;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  failureRate: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  stateChanges: number;
  uptime: number;
}

/**
 * Circuit breaker pattern implementation for service protection.
 * Prevents cascade failures by temporarily stopping calls to failing services.
 */
export class CircuitBreaker {
  private static get logger() {
    // Lazy initialization to ensure test configuration is applied
    return LogManager.getLogger('CircuitBreaker');
  }
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private stateChanges = 0;
  private startTime = Date.now();
  private successHistory: Array<number> = [];
  private errorAggregator: ErrorAggregator;

  constructor(private options: CircuitBreakerOptions) {
    this.validateOptions();
    this.errorAggregator = new ErrorAggregator({
      name: 'circuit-breaker',
      ...options.errorAggregator,
    });
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        await this.transitionTo('half-open');
      } else {
        throw new ConcreteServiceError(
          'SERVICE',
          'CIRCUIT_BREAKER_OPEN',
          `Circuit breaker is open. Next attempt in ${this.getTimeUntilNextAttempt()}ms`,
          { retryable: false },
        );
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      await this.onSuccess();
      return result;
    } catch (error) {
      await this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute operation with optional timeout
   */
  private executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.options.timeout) {
      return operation();
    }

    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          reject(
            new ConcreteServiceError(
              'TIMEOUT',
              'CIRCUIT_BREAKER_TIMEOUT',
              `Operation timed out after ${this.options.timeout}ms`,
              { retryable: true },
            ),
          );
        }, this.options.timeout),
      ),
    ]);
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get detailed statistics
   */
  getStats(): CircuitBreakerStats {
    const uptime = Date.now() - this.startTime;
    const failureRate =
      this.totalRequests > 0
        ? (this.failureCount / this.totalRequests) * 100
        : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChanges: this.stateChanges,
      uptime,
    };
  }

  /**
   * Get error aggregator statistics
   */
  getErrorStats() {
    return this.errorAggregator.getErrorStatistics();
  }

  /**
   * Get error rate for circuit breaker operations
   */
  getErrorRate(minutes: number = 5) {
    return this.errorAggregator.getErrorRate(
      'circuit-breaker',
      undefined,
      minutes,
    );
  }

  /**
   * Configure alerting for circuit breaker events
   */
  configureAlerting(alertConfig: AlertConfig): void {
    // Update the error aggregator's alert configuration
    // Note: This is a simplified approach - in a real implementation,
    // you might want to recreate the ErrorAggregator or provide a method to update it
    CircuitBreaker.logger.info('Circuit breaker alerting configured', {
      service: 'circuit-breaker',
      operation: 'configure_alerting',
      enabled: alertConfig.enabled,
      channels: Object.keys(alertConfig.channels),
    });
  }

  /**
   * Get active alerts from error aggregator
   */
  getActiveAlerts() {
    return this.errorAggregator.getActiveAlerts();
  }

  /**
   * Reset circuit breaker to closed state
   */
  async reset(): Promise<void> {
    const previousState = this.state;
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.successHistory = [];

    if (previousState !== 'closed') {
      this.stateChanges++;
      if (this.options.onStateChange) {
        this.options.onStateChange(previousState, 'closed');
      }

      // Record reset with ErrorAggregator
      try {
        await this.errorAggregator.recordSuccess('circuit-breaker', 'reset', {
          previousState,
          newState: 'closed',
          stateChanges: this.stateChanges,
        });
      } catch (recordError) {
        CircuitBreaker.logger.warn(
          'Failed to record reset with ErrorAggregator',
          {
            service: 'circuit-breaker',
            operation: 'reset_recording',
            error: recordError,
          },
        );
      }
    }
  }

  /**
   * Force circuit breaker to open state
   */
  async forceOpen(): Promise<void> {
    await this.transitionTo('open');
  }

  /**
   * Check if circuit breaker is currently closed (allowing requests)
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Check if circuit breaker is currently open (blocking requests)
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Check if circuit breaker is currently half-open (testing recovery)
   */
  isHalfOpen(): boolean {
    return this.state === 'half-open';
  }

  /**
   * Handle successful operation
   */
  private async onSuccess(): Promise<void> {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    // Track success history for half-open state
    if (this.state === 'half-open') {
      this.successHistory.push(Date.now());

      // Keep only recent successes within monitoring period
      const cutoff = Date.now() - this.options.monitoringPeriod;
      this.successHistory = this.successHistory.filter(time => time > cutoff);
    }

    if (this.options.onSuccess) {
      this.options.onSuccess();
    }

    if (this.state === 'half-open') {
      if (this.successHistory.length >= this.options.successThreshold) {
        await this.transitionTo('closed');
      }
    }
  }

  /**
   * Handle failed operation
   */
  private async onFailure(error: Error): Promise<void> {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Record error with ErrorAggregator
    try {
      await this.errorAggregator.recordError(error, {
        service: 'circuit-breaker',
        operation: 'circuit_breaker_operation',
        metadata: {
          circuitState: this.state,
          failureCount: this.failureCount,
          totalRequests: this.totalRequests,
        },
      });
    } catch (recordError) {
      // Don't let error recording break the circuit breaker
      CircuitBreaker.logger.warn(
        'Failed to record error with ErrorAggregator',
        {
          service: 'circuit-breaker',
          operation: 'error_recording',
          error: recordError,
        },
      );
    }

    if (this.options.onFailure) {
      this.options.onFailure(error);
    }

    if (this.state === 'closed') {
      if (this.failureCount >= this.options.failureThreshold) {
        await this.transitionTo('open');
      }
    } else if (this.state === 'half-open') {
      await this.transitionTo('open');
    }
  }

  /**
   * Check if circuit breaker should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.options.recoveryTimeout;
  }

  /**
   * Get time until next attempt is allowed
   */
  private getTimeUntilNextAttempt(): number {
    const timeSinceFailure = Date.now() - this.lastFailureTime;
    return Math.max(0, this.options.recoveryTimeout - timeSinceFailure);
  }

  /**
   * Transition to new state
   */
  private async transitionTo(newState: CircuitState): Promise<void> {
    const previousState = this.state;
    this.state = newState;
    this.stateChanges++;

    // Log state transition
    CircuitBreaker.logger.info(
      `Circuit breaker state changed from ${previousState} to ${newState}`,
      {
        service: 'circuit-breaker',
        operation: 'state-transition',
        previousState,
        newState,
        failureCount: this.failureCount,
        successCount: this.successCount,
        totalRequests: this.totalRequests,
      },
    );

    // Record state change with ErrorAggregator
    try {
      if (newState === 'open') {
        // Create a custom error for circuit breaker opening
        const circuitOpenError = new ConcreteServiceError(
          'CIRCUIT_BREAKER',
          'CIRCUIT_OPEN',
          `Circuit breaker opened due to ${this.failureCount} consecutive failures`,
          {
            previousState,
            newState,
            failureCount: this.failureCount,
            totalRequests: this.totalRequests,
            failureRate: this.getStats().failureRate,
          },
        );

        await this.errorAggregator.recordError(circuitOpenError, {
          service: 'circuit-breaker',
          operation: 'state_transition',
          metadata: {
            stateChange: `${previousState}->${newState}`,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalRequests: this.totalRequests,
            uptime: Date.now() - this.startTime,
          },
        });
      } else {
        // Record successful state transitions (recovery)
        await this.errorAggregator.recordSuccess(
          'circuit-breaker',
          'state_transition',
          {
            stateChange: `${previousState}->${newState}`,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalRequests: this.totalRequests,
          },
        );
      }
    } catch (recordError) {
      // Don't let error recording break the circuit breaker
      CircuitBreaker.logger.warn(
        'Failed to record state change with ErrorAggregator',
        {
          service: 'circuit-breaker',
          operation: 'state_change_recording',
          error: recordError,
        },
      );
    }

    // Reset counters based on state transition
    if (newState === 'closed') {
      this.failureCount = 0;
      this.successHistory = [];
    } else if (newState === 'half-open') {
      this.successHistory = [];
    }

    if (this.options.onStateChange) {
      this.options.onStateChange(previousState, newState);
    }
  }

  /**
   * Validate circuit breaker options
   */
  private validateOptions(): void {
    if (this.options.failureThreshold <= 0) {
      throw ErrorFactory.validation(
        `Field 'failureThreshold' value ${this.options.failureThreshold} is out of range. Expected greater than or equal to 1`,
        'failureThreshold',
        this.options.failureThreshold,
      );
    }

    if (this.options.recoveryTimeout <= 0) {
      throw ErrorFactory.validation(
        `Field 'recoveryTimeout' value ${this.options.recoveryTimeout} is out of range. Expected greater than or equal to 1`,
        'recoveryTimeout',
        this.options.recoveryTimeout,
      );
    }

    if (this.options.monitoringPeriod <= 0) {
      throw ErrorFactory.validation(
        `Field 'monitoringPeriod' value ${this.options.monitoringPeriod} is out of range. Expected greater than or equal to 1`,
        'monitoringPeriod',
        this.options.monitoringPeriod,
      );
    }

    if (this.options.successThreshold <= 0) {
      throw ErrorFactory.validation(
        `Field 'successThreshold' value ${this.options.successThreshold} is out of range. Expected greater than or equal to 1`,
        'successThreshold',
        this.options.successThreshold,
      );
    }
  }

  /**
   * Create circuit breaker with default options
   */
  static createDefault(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: getCircuitBreakerConstant('FAILURE_THRESHOLD'),
      recoveryTimeout: getCircuitBreakerConstant('RECOVERY_TIMEOUT'),
      monitoringPeriod: getCircuitBreakerConstant('MONITORING_PERIOD'),
      successThreshold: getCircuitBreakerConstant('SUCCESS_THRESHOLD'),
      timeout: getTimeout('CONNECTION'),
    });
  }

  /**
   * Create circuit breaker for fast-failing services
   */
  static createFastFailing(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3, // Lower threshold for fast failing
      recoveryTimeout: getCircuitBreakerConstant('RECOVERY_TIMEOUT') / 2, // Faster recovery
      monitoringPeriod: getCircuitBreakerConstant('MONITORING_PERIOD') / 5, // Shorter monitoring
      successThreshold: 2, // Lower success threshold
      timeout: getTimeout('NETWORK'), // Shorter timeout
    });
  }

  /**
   * Create circuit breaker for resilient services
   */
  static createResilient(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: getCircuitBreakerConstant('FAILURE_THRESHOLD') * 2, // Higher threshold
      recoveryTimeout: getCircuitBreakerConstant('RECOVERY_TIMEOUT') * 2, // Longer recovery
      monitoringPeriod: getCircuitBreakerConstant('MONITORING_PERIOD') * 2, // Longer monitoring
      successThreshold: getCircuitBreakerConstant('SUCCESS_THRESHOLD') * 2, // Higher success threshold
      timeout: getTimeout('DATABASE'), // Longer timeout
    });
  }
}

// Service interface definitions to avoid circular dependencies

/**
 * Error alert structure
 */
export interface ErrorAlert {
  /** Alert ID */
  id: string;
  /** Alert type */
  type: 'error_rate' | 'critical_error' | 'error_spike' | 'error_pattern';
  /** Alert severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Alert message */
  message: string;
  /** Alert timestamp */
  timestamp: Date;
  /** Error details */
  details: {
    /** Error type */
    errorType?: string;
    /** Error count */
    count?: number;
    /** Error rate (per minute) */
    rate?: number;
    /** Affected services */
    services?: string[];
    /** Sample errors */
    samples?: Array<{
      message: string;
      stack?: string;
      service?: string;
      operation?: string;
    }>;
  };
  /** Alert metadata */
  metadata: Record<string, any>;
}

/**
 * Error pattern detection
 */
export interface ErrorPattern {
  pattern: string;
  description: string;
  errors: string[];
  frequency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  firstDetected: Date;
  lastSeen: Date;
}

/**
 * Interface for error aggregation - avoids circular dependency with ErrorAggregator
 */
export interface IErrorAggregator {
  recordError(error: Error, context?: any): Promise<void>;
  recordSuccess(
    service: string,
    operation?: string,
    metadata?: any,
  ): Promise<void>;
  getErrorRate(service?: string, operation?: string, minutes?: number): any;
  getErrorStatistics(): any;
  getErrorPatterns(): ErrorPattern[];
  getActiveAlerts(): ErrorAlert[];
}

import { ServiceError } from '../errors/ServiceError';
import { ErrorTypeUtils } from '../errors/ErrorTypes';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  exponentialBase?: number;
  linearIncrement?: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  totalDelay: number;
}

export enum RetryPolicy {
  IMMEDIATE = 'immediate',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  FIXED = 'fixed',
}

/**
 * Retry handler with configurable backoff strategies and jitter.
 * Provides robust retry logic for transient failures with comprehensive metrics.
 */
export class RetryHandler {
  private static readonly DEFAULT_OPTIONS: Partial<RetryOptions> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    jitterFactor: 0.1,
    exponentialBase: 2,
    linearIncrement: 1000,
  };

  /**
   * Execute an operation with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
  ): Promise<T> {
    const config = {
      ...RetryHandler.DEFAULT_OPTIONS,
      ...options,
    } as RetryOptions;
    const result = await this.executeWithMetrics(operation, config);

    if (!result.success || !result.result) {
      throw result.error ?? new Error('Operation failed after retries');
    }

    return result.result;
  }

  /**
   * Execute operation with detailed retry metrics
   */
  static async executeWithMetrics<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        const result = await operation();

        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime,
          totalDelay,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (
          !this.isRetryable(lastError, options) ||
          attempt === options.maxAttempts
        ) {
          break;
        }

        const delay = this.calculateDelay(attempt, options);
        totalDelay += delay;

        // Call retry callback if provided
        if (options.onRetry) {
          options.onRetry(attempt, lastError, delay);
        }

        await this.delay(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: options.maxAttempts,
      totalTime: Date.now() - startTime,
      totalDelay,
    };
  }

  /**
   * Execute with exponential backoff
   */
  static executeWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...options,
      exponentialBase: options.exponentialBase ?? 2,
    });
  }

  /**
   * Execute with linear backoff
   */
  static executeWithLinearBackoff<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...options,
      linearIncrement: options.linearIncrement ?? 1000,
    });
  }

  /**
   * Execute with fixed delay
   */
  static executeWithFixedDelay<T>(
    operation: () => Promise<T>,
    delay: number,
    options: Partial<RetryOptions> = {},
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...options,
      baseDelay: delay,
      maxDelay: delay,
      jitterFactor: 0, // No jitter for fixed delay
    });
  }

  /**
   * Execute with immediate retry (no delay)
   */
  static executeWithImmediateRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...options,
      baseDelay: 0,
      maxDelay: 0,
      jitterFactor: 0,
    });
  }

  /**
   * Create a retryable operation wrapper
   */
  static createRetryableOperation<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
  ): () => Promise<T> {
    return () => this.executeWithRetry(operation, options);
  }

  /**
   * Execute multiple operations with retry logic
   */
  static executeAllWithRetry<T>(
    operations: Array<() => Promise<T>>,
    options: Partial<RetryOptions> = {},
  ): Promise<Array<RetryResult<T>>> {
    const config = {
      ...RetryHandler.DEFAULT_OPTIONS,
      ...options,
    } as RetryOptions;

    return Promise.all(
      operations.map(op => this.executeWithMetrics(op, config)),
    );
  }

  /**
   * Execute operations in sequence with retry logic
   */
  static async executeSequenceWithRetry<T>(
    operations: Array<() => Promise<T>>,
    options: Partial<RetryOptions> = {},
  ): Promise<Array<RetryResult<T>>> {
    const config = {
      ...RetryHandler.DEFAULT_OPTIONS,
      ...options,
    } as RetryOptions;
    const results: Array<RetryResult<T>> = [];

    for (const operation of operations) {
      const result = await this.executeWithMetrics(operation, config);
      results.push(result);

      // Stop sequence if operation failed and shouldn't continue
      if (!result.success && !this.shouldContinueOnFailure(result.error)) {
        break;
      }
    }

    return results;
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryable(error: Error, options: RetryOptions): boolean {
    // Use custom retry condition if provided
    if (options.retryCondition) {
      return options.retryCondition(error);
    }

    // Check if it's a ServiceError with retryable flag
    if (error instanceof ServiceError) {
      return error.retryable;
    }

    // Check error type and code
    const errorType = ErrorTypeUtils.getErrorTypeFromName(
      error.constructor.name,
    );
    if (errorType) {
      const errorCode = (error as any).code;
      if (errorCode) {
        return ErrorTypeUtils.isRetryable(errorCode);
      }
    }

    // Default retryable conditions based on error message
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('temporary') ||
      message.includes('transient')
    );
  }

  /**
   * Calculate delay for retry attempt
   */
  private static calculateDelay(
    attempt: number,
    options: RetryOptions,
  ): number {
    let baseDelay: number;

    if (options.exponentialBase && options.exponentialBase > 1) {
      // Exponential backoff
      baseDelay =
        options.baseDelay * Math.pow(options.exponentialBase, attempt - 1);
    } else if (options.linearIncrement) {
      // Linear backoff
      baseDelay = options.baseDelay + options.linearIncrement * (attempt - 1);
    } else {
      // Fixed delay
      baseDelay = options.baseDelay;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * options.jitterFactor * baseDelay;
    const delay = baseDelay + jitter;

    // Cap at maximum delay
    return Math.min(delay, options.maxDelay);
  }

  /**
   * Delay execution for specified milliseconds
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if execution should continue on failure
   */
  private static shouldContinueOnFailure(error?: Error): boolean {
    if (!error) {
      return false;
    }

    // Don't continue on validation or parsing errors
    const errorType = ErrorTypeUtils.getErrorTypeFromName(
      error.constructor.name,
    );
    return errorType !== 'VALIDATION' && errorType !== 'PARSING';
  }

  /**
   * Create retry options for different scenarios
   */
  static createOptions(
    policy: RetryPolicy,
    custom: Partial<RetryOptions> = {},
  ): Partial<RetryOptions> {
    switch (policy) {
      case RetryPolicy.IMMEDIATE:
        return {
          maxAttempts: 3,
          baseDelay: 0,
          maxDelay: 0,
          jitterFactor: 0,
          ...custom,
        };

      case RetryPolicy.LINEAR:
        return {
          maxAttempts: 5,
          baseDelay: 1000,
          maxDelay: 10000,
          jitterFactor: 0.1,
          linearIncrement: 1000,
          ...custom,
        };

      case RetryPolicy.EXPONENTIAL:
        return {
          maxAttempts: 5,
          baseDelay: 1000,
          maxDelay: 30000,
          jitterFactor: 0.1,
          exponentialBase: 2,
          ...custom,
        };

      case RetryPolicy.FIXED:
        return {
          maxAttempts: 3,
          baseDelay: 2000,
          maxDelay: 2000,
          jitterFactor: 0,
          ...custom,
        };

      default:
        return custom;
    }
  }

  /**
   * Get retry statistics from results
   */
  static getRetryStatistics<T>(results: Array<RetryResult<T>>): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    successRate: number;
    averageAttempts: number;
    averageTime: number;
    totalDelay: number;
  } {
    const successful = results.filter(r => r.success);
    const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);
    const totalTime = results.reduce((sum, r) => sum + r.totalTime, 0);
    const totalDelay = results.reduce((sum, r) => sum + r.totalDelay, 0);

    return {
      totalOperations: results.length,
      successfulOperations: successful.length,
      failedOperations: results.length - successful.length,
      successRate: (successful.length / results.length) * 100,
      averageAttempts: totalAttempts / results.length,
      averageTime: totalTime / results.length,
      totalDelay,
    };
  }
}

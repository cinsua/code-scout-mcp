/**
 * Synchronous Retry Handler
 *
 * Provides standardized retry logic for synchronous operations,
 * following the same patterns as RetryHandler but designed for
 * SQLite transaction contexts where async operations aren't possible.
 */

import { getRetryDelay } from '@/shared/errors/ErrorConstants';

export interface SyncRetryOptions {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts?: number;

  /**
   * Base delay between retries in milliseconds
   */
  baseDelay?: number;

  /**
   * Maximum delay between retries in milliseconds
   */
  maxDelay?: number;

  /**
   * Exponential backoff base (default: 2)
   */
  exponentialBase?: number;

  /**
   * Function to determine if an error is retryable
   */
  retryCondition?: (error: Error) => boolean;

  /**
   * Callback called before each retry attempt
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<SyncRetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBase: 2,
  retryCondition: () => true,
  // eslint-disable-next-line no-empty-function
  onRetry: () => {},
};

/**
 * Synchronous retry handler for operations within SQLite transactions
 */
export class SyncRetryHandler {
  /**
   * Execute an operation with synchronous retry logic
   */
  static executeWithRetry<T>(
    operation: () => T,
    options: SyncRetryOptions = {},
  ): T {
    const config = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return operation();
      } catch (error) {
        lastError = error as Error;

        // Check if this is the last attempt or if error is not retryable
        if (
          attempt === config.maxAttempts ||
          !config.retryCondition(lastError)
        ) {
          break;
        }

        // Calculate delay using exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.exponentialBase, attempt - 1),
          config.maxDelay,
        );

        // Call retry callback
        config.onRetry(attempt, lastError, delay);

        // Synchronous delay using busy wait (compatible with SQLite transactions)
        const endTime = Date.now() + delay;
        while (Date.now() < endTime) {
          // Busy wait - this is acceptable within SQLite transactions
          // where we can't use async/await
        }
      }
    }

    // All attempts failed, throw the last error
    throw lastError;
  }

  /**
   * Create retry options with centralized constants
   */
  static createOptions(overrides: SyncRetryOptions = {}): SyncRetryOptions {
    return {
      maxAttempts: 3,
      baseDelay: getRetryDelay('SHORT'),
      maxDelay: getRetryDelay('EXTENDED'),
      exponentialBase: 2,
      ...overrides,
    };
  }

  /**
   * Standard retry condition for database operations
   */
  static isRetryableDatabaseError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('database is locked') ||
      message.includes('busy') ||
      message.includes('temporarily unavailable') ||
      message.includes('disk i/o error') ||
      message.includes('connection') ||
      message.includes('timeout')
    );
  }

  /**
   * Standard retry condition for file system operations
   */
  static isRetryableFileSystemError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('eagain') ||
      message.includes('ebusy') ||
      message.includes('emfile') ||
      message.includes('enfile') ||
      message.includes('temporary') ||
      message.includes('timeout')
    );
  }

  /**
   * Standard retry condition for network operations
   */
  static isRetryableNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('enotunreach') ||
      message.includes('econnreset') ||
      message.includes('timeout') ||
      message.includes('network')
    );
  }
}

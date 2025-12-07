import { ServiceError, type ServiceErrorOptions } from './ServiceError';
import { ErrorType, TimeoutErrorCodes } from './ErrorTypes';

export interface TimeoutErrorContext {
  operation?: string;
  timeoutMs?: number;
  actualDuration?: number;
  resource?: string;
  retryCount?: number;
}

export interface TimeoutErrorOptions extends ServiceErrorOptions {
  context?: TimeoutErrorContext;
}

/**
 * Error thrown when operations exceed their time limits.
 * Provides detailed information about timeout failures including
 * operation types, timeout values, and actual durations.
 */
export class TimeoutError extends ServiceError {
  public override readonly context?: TimeoutErrorContext;

  constructor(
    code: TimeoutErrorCodes,
    message: string,
    options: TimeoutErrorOptions = {},
  ) {
    super(ErrorType.TIMEOUT, code, message, {
      ...options,
      retryable: true, // Timeout errors are generally retryable
      retryAfter: options.retryAfter ?? 1000, // Default 1 second retry delay
    });

    this.context = options.context;
  }

  /**
   * Create a timeout error for general operation timeout
   */
  static operationTimeout(
    operation: string,
    timeoutMs: number,
    actualDuration?: number,
  ): TimeoutError {
    return new TimeoutError(
      TimeoutErrorCodes.OPERATION_TIMEOUT,
      `Operation '${operation}' timed out after ${timeoutMs}ms${actualDuration ? ` (actual duration: ${actualDuration}ms)` : ''}`,
      {
        context: {
          operation,
          timeoutMs,
          actualDuration,
        },
      },
    );
  }

  /**
   * Create a timeout error for connection timeout
   */
  static connectionTimeout(resource: string, timeoutMs: number): TimeoutError {
    return new TimeoutError(
      TimeoutErrorCodes.CONNECTION_TIMEOUT,
      `Connection to '${resource}' timed out after ${timeoutMs}ms`,
      {
        context: {
          resource,
          timeoutMs,
          operation: 'connect',
        },
      },
    );
  }

  /**
   * Create a timeout error for read timeout
   */
  static readTimeout(resource: string, timeoutMs: number): TimeoutError {
    return new TimeoutError(
      TimeoutErrorCodes.READ_TIMEOUT,
      `Read operation on '${resource}' timed out after ${timeoutMs}ms`,
      {
        context: {
          resource,
          timeoutMs,
          operation: 'read',
        },
      },
    );
  }

  /**
   * Create a timeout error for write timeout
   */
  static writeTimeout(resource: string, timeoutMs: number): TimeoutError {
    return new TimeoutError(
      TimeoutErrorCodes.WRITE_TIMEOUT,
      `Write operation on '${resource}' timed out after ${timeoutMs}ms`,
      {
        context: {
          resource,
          timeoutMs,
          operation: 'write',
        },
      },
    );
  }

  /**
   * Create a timeout error for lock timeout
   */
  static lockTimeout(
    resource: string,
    timeoutMs: number,
    retryCount?: number,
  ): TimeoutError {
    return new TimeoutError(
      TimeoutErrorCodes.LOCK_TIMEOUT,
      `Failed to acquire lock on '${resource}' within ${timeoutMs}ms${retryCount ? ` after ${retryCount} retries` : ''}`,
      {
        context: {
          resource,
          timeoutMs,
          operation: 'lock',
          retryCount,
        },
      },
    );
  }

  /**
   * Create a timeout error for query timeout
   */
  static queryTimeout(
    query: string,
    timeoutMs: number,
    actualDuration?: number,
  ): TimeoutError {
    return new TimeoutError(
      TimeoutErrorCodes.QUERY_TIMEOUT,
      `Query timed out after ${timeoutMs}ms${actualDuration ? ` (actual duration: ${actualDuration}ms)` : ''}`,
      {
        context: {
          operation: 'query',
          resource: query,
          timeoutMs,
          actualDuration,
        },
        retryAfter: 2000, // Longer retry delay for query timeouts
      },
    );
  }

  /**
   * Create a timeout error for parsing timeout
   */
  static parsingTimeout(
    filePath: string,
    timeoutMs: number,
    actualDuration?: number,
  ): TimeoutError {
    return new TimeoutError(
      TimeoutErrorCodes.PARSING_TIMEOUT,
      `Parsing of '${filePath}' timed out after ${timeoutMs}ms${actualDuration ? ` (actual duration: ${actualDuration}ms)` : ''}`,
      {
        context: {
          operation: 'parsing',
          resource: filePath,
          timeoutMs,
          actualDuration,
        },
      },
    );
  }

  /**
   * Create a timeout error for indexing timeout
   */
  static indexingTimeout(
    resource: string,
    timeoutMs: number,
    actualDuration?: number,
  ): TimeoutError {
    return new TimeoutError(
      TimeoutErrorCodes.INDEXING_TIMEOUT,
      `Indexing of '${resource}' timed out after ${timeoutMs}ms${actualDuration ? ` (actual duration: ${actualDuration}ms)` : ''}`,
      {
        context: {
          operation: 'indexing',
          resource,
          timeoutMs,
          actualDuration,
        },
        retryAfter: 5000, // Longer retry delay for indexing timeouts
      },
    );
  }

  /**
   * Get the operation that timed out
   */
  public getOperation(): string | undefined {
    return this.context?.operation;
  }

  /**
   * Get the timeout duration in milliseconds
   */
  public getTimeoutMs(): number | undefined {
    return this.context?.timeoutMs;
  }

  /**
   * Get the actual duration before timeout
   */
  public getActualDuration(): number | undefined {
    return this.context?.actualDuration;
  }

  /**
   * Get the resource that was being accessed
   */
  public getResource(): string | undefined {
    return this.context?.resource;
  }

  /**
   * Get the number of retry attempts
   */
  public getRetryCount(): number | undefined {
    return this.context?.retryCount;
  }

  /**
   * Check if this error is related to a specific operation
   */
  public isOperationError(operation: string): boolean {
    return this.context?.operation === operation;
  }

  /**
   * Check if this error is related to a specific resource
   */
  public isResourceError(resource: string): boolean {
    return this.context?.resource === resource;
  }

  /**
   * Calculate the timeout efficiency (actual duration / timeout)
   */
  public getTimeoutEfficiency(): number | undefined {
    if (this.context?.actualDuration && this.context.timeoutMs) {
      return this.context.actualDuration / this.context.timeoutMs;
    }
    return undefined;
  }

  /**
   * Convert to user-friendly string with timeout information
   */
  public override toUserString(): string {
    let result = super.toUserString();

    if (this.context?.operation) {
      result += `\n  Operation: ${this.context.operation}`;
    }

    if (this.context?.resource) {
      result += `\n  Resource: ${this.context.resource}`;
    }

    if (this.context?.timeoutMs) {
      result += `\n  Timeout: ${this.context.timeoutMs}ms`;
    }

    if (this.context?.actualDuration) {
      result += `\n  Actual duration: ${this.context.actualDuration}ms`;

      const efficiency = this.getTimeoutEfficiency();
      if (efficiency) {
        result += ` (${(efficiency * 100).toFixed(1)}% of timeout)`;
      }
    }

    if (this.context?.retryCount) {
      result += `\n  Retry attempts: ${this.context.retryCount}`;
    }

    return result;
  }
}

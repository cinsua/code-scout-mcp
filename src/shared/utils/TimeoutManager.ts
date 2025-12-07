/// <reference types="node" />
/// <reference lib="dom" />
/* global AbortSignal */
import { TimeoutError } from '../errors/TimeoutError';

export interface TimeoutOptions {
  timeoutMs?: number;
  operationType?: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS;
  onTimeout?: (timeoutMs: number) => void;
  signal?: AbortSignal;
}

export interface TimeoutResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  timedOut: boolean;
  duration: number;
}

/**
 * Timeout manager for operations with configurable timeouts and cancellation.
 * Provides centralized timeout management with different presets for various operation types.
 */
export class TimeoutManager {
  private static customTimeouts: Map<
    keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
    number
  > = new Map();

  public static readonly DEFAULT_TIMEOUTS = {
    database: 30000, // 30 seconds
    parsing: 10000, // 10 seconds
    network: 5000, // 5 seconds
    filesystem: 5000, // 5 seconds
    indexing: 300000, // 5 minutes
    query: 30000, // 30 seconds
    connection: 10000, // 10 seconds
    read: 30000, // 30 seconds
    write: 30000, // 30 seconds
    lock: 5000, // 5 seconds
    default: 10000, // 10 seconds
  } as const;

  private static readonly VALID_OPERATION_TYPES = Object.keys(
    TimeoutManager.DEFAULT_TIMEOUTS,
  ) as Array<keyof typeof TimeoutManager.DEFAULT_TIMEOUTS>;

  /**
   * Get default timeout value for operation type safely
   */
  private static getDefaultTimeoutForType(
    operationType: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
  ): number {
    switch (operationType) {
      case 'database':
        return 30000;
      case 'parsing':
        return 10000;
      case 'network':
        return 5000;
      case 'filesystem':
        return 5000;
      case 'indexing':
        return 300000;
      case 'query':
        return 30000;
      case 'connection':
        return 10000;
      case 'read':
        return 30000;
      case 'write':
        return 30000;
      case 'lock':
        return 5000;
      case 'default':
        return 10000;
      default:
        throw new Error(`Invalid operation type: ${String(operationType)}`);
    }
  }

  /**
   * Execute an operation with timeout
   */
  static async executeWithTimeout<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions = {},
  ): Promise<T> {
    const result = await this.executeWithMetrics(operation, options);

    if (!result.success || !result.result) {
      throw result.error ?? new Error('Operation failed');
    }

    return result.result;
  }

  /**
   * Execute operation with detailed timeout metrics
   */
  static async executeWithMetrics<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions,
  ): Promise<TimeoutResult<T>> {
    const startTime = Date.now();
    const timeoutMs = this.getTimeout(options);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = TimeoutError.operationTimeout(
          options.operationType ?? 'unknown',
          timeoutMs,
          Date.now() - startTime,
        );

        if (options.onTimeout) {
          options.onTimeout(timeoutMs);
        }

        reject(timeoutError);
      }, timeoutMs);

      // Handle abort signal if provided
      if (options.signal) {
        const handleAbort = () => {
          clearTimeout(timeoutId);
          reject(new Error('Operation aborted'));
        };

        if (options.signal.aborted) {
          handleAbort();
        } else {
          options.signal.addEventListener('abort', handleAbort, { once: true });
        }
      }
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        timedOut: false,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error instanceof TimeoutError;

      return {
        success: false,
        error: error as Error,
        timedOut: isTimeout,
        duration,
      };
    }
  }

  /**
   * Execute with database timeout
   */
  static executeWithDatabaseTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'database',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with parsing timeout
   */
  static executeWithParsingTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'parsing',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with network timeout
   */
  static executeWithNetworkTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'network',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with filesystem timeout
   */
  static executeWithFilesystemTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'filesystem',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with indexing timeout
   */
  static executeWithIndexingTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'indexing',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with query timeout
   */
  static executeWithQueryTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'query',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with connection timeout
   */
  static executeWithConnectionTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'connection',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute multiple operations with timeout
   */
  static executeAllWithTimeout<T>(
    operations: Array<() => Promise<T>>,
    options: TimeoutOptions = {},
  ): Promise<Array<TimeoutResult<T>>> {
    return Promise.all(
      operations.map(op => this.executeWithMetrics(op, options)),
    );
  }

  /**
   * Execute operations in sequence with timeout
   */
  static async executeSequenceWithTimeout<T>(
    operations: Array<() => Promise<T>>,
    options: TimeoutOptions = {},
  ): Promise<Array<TimeoutResult<T>>> {
    const results: Array<TimeoutResult<T>> = [];

    for (const operation of operations) {
      const result = await this.executeWithMetrics(operation, options);
      results.push(result);

      // Stop sequence if operation timed out
      if (result.timedOut) {
        break;
      }
    }

    return results;
  }

  /**
   * Create a timeout wrapper for an operation
   */
  static createTimeoutWrapper<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions = {},
  ): () => Promise<T> {
    return () => this.executeWithTimeout(operation, options);
  }

  /**
   * Execute with progressive timeout (increases on retries)
   */
  static async executeWithProgressiveTimeout<T>(
    operation: () => Promise<T>,
    baseTimeout: number,
    maxTimeout: number,
    multiplier: number = 2,
    maxAttempts: number = 3,
  ): Promise<T> {
    let lastError: Error = new Error('Max attempts reached');
    let currentTimeout = baseTimeout;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.executeWithTimeout(operation, {
          timeoutMs: Math.min(currentTimeout, maxTimeout),
        });
      } catch (error) {
        lastError = error as Error;

        // Don't increase timeout for non-timeout errors
        if (!(error instanceof TimeoutError)) {
          throw error;
        }

        currentTimeout *= multiplier;
      }
    }

    throw lastError;
  }

  /**
   * Get timeout value from options
   */
  private static getTimeout(options: TimeoutOptions): number {
    if (options.timeoutMs) {
      return options.timeoutMs;
    }

    if (options.operationType) {
      // Validate that the operation type exists to prevent object injection
      if (!this.VALID_OPERATION_TYPES.includes(options.operationType)) {
        throw new Error(
          `Invalid operation type: ${String(options.operationType)}`,
        );
      }
      return (
        this.customTimeouts.get(options.operationType) ??
        this.getDefaultTimeoutForType(options.operationType)
      );
    }

    return this.customTimeouts.get('default') ?? this.DEFAULT_TIMEOUTS.default;
  }

  /**
   * Get default timeout for operation type
   */
  static getDefaultTimeout(
    operationType: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
  ): number {
    // Validate that the operation type exists to prevent object injection
    if (!this.VALID_OPERATION_TYPES.includes(operationType)) {
      throw new Error(`Invalid operation type: ${String(operationType)}`);
    }

    return (
      this.customTimeouts.get(operationType) ??
      this.getDefaultTimeoutForType(operationType)
    );
  }

  /**
   * Set custom default timeout for operation type
   */
  static setDefaultTimeout(
    operationType: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
    timeoutMs: number,
  ): void {
    // Validate that the operation type exists in DEFAULT_TIMEOUTS
    if (!this.VALID_OPERATION_TYPES.includes(operationType)) {
      throw new Error(`Invalid operation type: ${String(operationType)}`);
    }

    // Validate timeout is a positive number
    if (typeof timeoutMs !== 'number' || timeoutMs <= 0) {
      throw new Error('Timeout must be a positive number');
    }

    // Safe property assignment using customTimeouts
    this.customTimeouts.set(operationType, timeoutMs);
  }

  /**
   * Get all default timeouts
   */
  static getAllDefaultTimeouts(): Readonly<
    typeof TimeoutManager.DEFAULT_TIMEOUTS
  > {
    return { ...this.DEFAULT_TIMEOUTS };
  }

  /**
   * Create a cancellable timeout
   */
  static createCancellableTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): {
    promise: Promise<T>;
    cancel: () => void;
  } {
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const promise = new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          reject(TimeoutError.operationTimeout('unknown', timeoutMs));
        }
      }, timeoutMs);

      operation()
        .then(result => {
          if (!isCancelled) {
            clearTimeout(timeoutId);
            resolve(result);
          }
        })
        .catch(error => {
          if (!isCancelled) {
            clearTimeout(timeoutId);
            reject(error);
          }
        });
    });

    const cancel = () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };

    return { promise, cancel };
  }

  /**
   * Execute with adaptive timeout based on historical performance
   */
  static executeWithAdaptiveTimeout<T>(
    operation: () => Promise<T>,
    baseTimeout: number,
    history: Array<number> = [],
    multiplier: number = 1.5,
  ): Promise<T> {
    let timeoutMs = baseTimeout;

    if (history.length > 0) {
      const avgDuration =
        history.reduce((sum, d) => sum + d, 0) / history.length;
      const maxDuration = Math.max(...history);

      // Use average duration plus a safety margin
      timeoutMs = Math.max(baseTimeout, avgDuration * multiplier);

      // Cap at reasonable maximum
      timeoutMs = Math.min(timeoutMs, maxDuration * 2, baseTimeout * 5);
    }

    return this.executeWithTimeout(operation, { timeoutMs });
  }

  /**
   * Get timeout statistics from results
   */
  static getTimeoutStatistics<T>(results: Array<TimeoutResult<T>>): {
    totalOperations: number;
    successfulOperations: number;
    timedOutOperations: number;
    successRate: number;
    timeoutRate: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
  } {
    const successful = results.filter(r => r.success);
    const timedOut = results.filter(r => r.timedOut);
    const durations = results.map(r => r.duration).filter(d => d > 0);

    return {
      totalOperations: results.length,
      successfulOperations: successful.length,
      timedOutOperations: timedOut.length,
      successRate: (successful.length / results.length) * 100,
      timeoutRate: (timedOut.length / results.length) * 100,
      averageDuration:
        durations.length > 0
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length
          : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
    };
  }
}

import { ServiceError } from '@/shared/errors/ServiceError';
import { LogManager } from '@/shared/utils/LogManager';
import type { Logger } from '@/shared/utils/Logger';
import { ErrorMigration } from '@/shared/errors/ErrorMigration';
import { RetryHandler } from '@/shared/utils/RetryHandler';
import { TimeoutManager } from '@/shared/utils/TimeoutManager';
import { CircuitBreaker } from '@/shared/utils/CircuitBreaker';
import type { IErrorAggregator } from '@/shared/services/types';

export interface ServiceOptions {
  name: string;
  timeout?: number;
  retryOptions?: Partial<
    Parameters<typeof RetryHandler.executeWithRetry<any>>[1]
  >;
  circuitBreakerOptions?: ConstructorParameters<typeof CircuitBreaker>[0];
  enableRetry?: boolean;
  enableTimeout?: boolean;
  enableCircuitBreaker?: boolean;
}

export interface OperationContext {
  operation: string;
  startTime: number;
  attempt?: number;
  timeout?: number;
}

/**
 * Abstract base service class with standardized error handling.
 * Provides common patterns for retry logic, timeout management, and circuit breaking.
 */
export abstract class BaseService {
  protected readonly name: string;
  protected readonly options: ServiceOptions;
  protected circuitBreaker?: CircuitBreaker;
  protected errorAggregator?: IErrorAggregator;
  private internalLogger: Logger;

  constructor(options: ServiceOptions) {
    this.name = options.name;
    this.options = {
      enableRetry: true,
      enableTimeout: true,
      enableCircuitBreaker: false,
      ...options,
    };

    this.internalLogger = LogManager.getLogger(this.name);

    if (
      this.options.enableCircuitBreaker &&
      this.options.circuitBreakerOptions
    ) {
      this.circuitBreaker = new CircuitBreaker(
        this.options.circuitBreakerOptions,
      );
    }
  }

  /**
   * Execute an operation with full error handling and monitoring
   */
  protected async executeOperation<T>(
    operation: () => Promise<T>,
    context: Partial<OperationContext> = {},
  ): Promise<T> {
    const operationContext: OperationContext = {
      operation: context.operation ?? 'unknown',
      startTime: Date.now(),
      ...context,
    };

    try {
      let result: T;

      // Apply circuit breaker if enabled
      if (this.options.enableCircuitBreaker && this.circuitBreaker) {
        result = await this.circuitBreaker.execute(() =>
          this.executeWithRetryAndTimeout(operation, operationContext),
        );
      } else {
        result = await this.executeWithRetryAndTimeout(
          operation,
          operationContext,
        );
      }

      await this.onOperationSuccess(operationContext, result);
      return result;
    } catch (error) {
      await this.onOperationError(operationContext, error as Error);
      throw this.processError(error as Error, operationContext);
    }
  }

  /**
   * Execute operation with retry and timeout logic
   */
  private executeWithRetryAndTimeout<T>(
    operation: () => Promise<T>,
    context: OperationContext,
  ): Promise<T> {
    let wrappedOperation = operation;

    // Apply timeout if enabled
    if (this.options.enableTimeout) {
      const timeoutMs = context.timeout ?? this.options.timeout;
      if (timeoutMs) {
        wrappedOperation = () =>
          TimeoutManager.executeWithTimeout(operation, { timeoutMs });
      }
    }

    // Apply retry if enabled
    if (this.options.enableRetry && this.options.retryOptions) {
      return RetryHandler.executeWithRetry(wrappedOperation, {
        ...this.options.retryOptions,
        onRetry: (attempt, error, delay) => {
          context.attempt = attempt;
          void this.onRetry(context, error, delay);
        },
      });
    }

    return wrappedOperation();
  }

  /**
   * Process and enhance errors
   */
  protected processError(
    error: Error,
    context: OperationContext,
  ): ServiceError {
    // If it's already a ServiceError, enhance it with context
    if (error instanceof ServiceError) {
      error.setOperation(context.operation);
      return error;
    }

    // Use ErrorMigration to convert legacy errors to ServiceError
    const migrationResult = ErrorMigration.migrateError(
      error,
      context.operation,
    );
    const serviceError = migrationResult.migrated;

    // Add additional context
    serviceError.setOperation(context.operation);

    return serviceError;
  }

  /**
   * Handle successful operation
   */
  protected async onOperationSuccess<T>(
    context: OperationContext,
    result: T,
  ): Promise<void> {
    const duration = Date.now() - context.startTime;

    // Record success in aggregator if available
    if (this.errorAggregator) {
      try {
        await this.errorAggregator.recordSuccess(this.name, context.operation);
      } catch (aggError) {
        // Don't let aggregator errors break the main flow
        this.internalLogger.warn('Failed to record success in aggregator', {
          aggregatorError: aggError,
        });
      }
    }

    // Log success (implementation specific)
    await this.logOperation('success', context, { duration, result });
  }

  /**
   * Handle failed operation
   */
  protected async onOperationError(
    context: OperationContext,
    error: Error,
  ): Promise<void> {
    const duration = Date.now() - context.startTime;

    // Record error in aggregator if available
    if (this.errorAggregator) {
      try {
        await this.errorAggregator.recordError(error, {
          service: this.name,
          operation: context.operation,
        });
      } catch (aggError) {
        // Don't let aggregator errors break the main error flow
        this.internalLogger.error(
          'Failed to record error in aggregator',
          undefined,
          { aggregatorError: aggError },
        );
      }
    }

    // Log error (implementation specific)
    await this.logOperation('error', context, { duration, error });
  }

  /**
   * Handle retry attempts
   */
  protected async onRetry(
    context: OperationContext,
    error: Error,
    delay: number,
  ): Promise<void> {
    // Log retry (implementation specific)
    await this.logOperation('retry', context, {
      error,
      delay,
      attempt: context.attempt,
    });
  }

  /**
   * Log operation events (to be implemented by subclasses)
   */
  protected abstract logOperation(
    event: 'success' | 'error' | 'retry',
    context: OperationContext,
    data: any,
  ): Promise<void>;

  /**
   * Get service statistics
   */
  getStats(): any {
    const stats: any = {
      name: this.name,
      options: this.options,
    };

    if (this.circuitBreaker) {
      stats.circuitBreaker = this.circuitBreaker.getStats();
    }

    if (this.errorAggregator) {
      stats.errorRate = this.errorAggregator.getErrorRate(this.name);
      stats.errorStats = this.errorAggregator.getErrorStatistics();
    }

    return stats;
  }

  /**
   * Check if service is healthy
   */
  isHealthy(): boolean {
    if (this.circuitBreaker) {
      return this.circuitBreaker.isClosed();
    }

    return true;
  }

  /**
   * Reset service state
   */
  async reset(): Promise<void> {
    if (this.circuitBreaker) {
      await this.circuitBreaker.reset();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Implementation specific cleanup
    await this.onShutdown();
  }

  /**
   * Shutdown hook (to be implemented by subclasses)
   */
  protected abstract onShutdown(): Promise<void>;

  /**
   * Execute with specific timeout
   */
  protected executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName?: string,
  ): Promise<T> {
    return this.executeOperation(operation, {
      operation: operationName ?? 'timeout_operation',
      timeout: timeoutMs,
    });
  }

  /**
   * Execute with specific retry options
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryOptions: Partial<Parameters<typeof RetryHandler.executeWithRetry>[1]>,
    operationName?: string,
  ): Promise<T> {
    const originalRetryOptions = this.options.retryOptions;

    // Temporarily override retry options
    (this.options as any).retryOptions = {
      ...originalRetryOptions,
      ...retryOptions,
    };

    try {
      return await this.executeOperation(operation, {
        operation: operationName ?? 'retry_operation',
      });
    } finally {
      // Restore original retry options
      (this.options as any).retryOptions = originalRetryOptions;
    }
  }

  /**
   * Execute without retry
   */
  protected async executeWithoutRetry<T>(
    operation: () => Promise<T>,
    operationName?: string,
  ): Promise<T> {
    const originalEnableRetry = this.options.enableRetry;

    try {
      (this.options as any).enableRetry = false;
      return await this.executeOperation(operation, {
        operation: operationName ?? 'no_retry_operation',
      });
    } finally {
      (this.options as any).enableRetry = originalEnableRetry;
    }
  }

  /**
   * Execute without timeout
   */
  protected async executeWithoutTimeout<T>(
    operation: () => Promise<T>,
    operationName?: string,
  ): Promise<T> {
    const originalEnableTimeout = this.options.enableTimeout;

    try {
      (this.options as any).enableTimeout = false;
      return await this.executeOperation(operation, {
        operation: operationName ?? 'no_timeout_operation',
      });
    } finally {
      (this.options as any).enableTimeout = originalEnableTimeout;
    }
  }

  /**
   * Execute without circuit breaker
   */
  protected async executeWithoutCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName?: string,
  ): Promise<T> {
    const originalEnableCircuitBreaker = this.options.enableCircuitBreaker;

    try {
      (this.options as any).enableCircuitBreaker = false;
      return await this.executeOperation(operation, {
        operation: operationName ?? 'no_circuit_breaker_operation',
      });
    } finally {
      (this.options as any).enableCircuitBreaker = originalEnableCircuitBreaker;
    }
  }

  /**
   * Create a child service with modified options
   */
  protected createChildService<T extends BaseService>(
    ServiceClass: new (options: ServiceOptions) => T,
    nameSuffix: string,
    optionsOverrides: Partial<ServiceOptions> = {},
  ): T {
    const childOptions: ServiceOptions = {
      ...this.options,
      name: `${this.name}_${nameSuffix}`,
      ...optionsOverrides,
    };

    return new ServiceClass(childOptions);
  }

  /**
   * Set error aggregator for error tracking
   */
  protected setErrorAggregator(aggregator: IErrorAggregator): void {
    this.errorAggregator = aggregator;
  }

  /**
   * Get service configuration
   */
  getConfiguration(): ServiceOptions {
    return { ...this.options };
  }

  /**
   * Update service configuration
   */
  updateConfiguration(updates: Partial<ServiceOptions>): void {
    Object.assign(this.options, updates);

    // Recreate circuit breaker if options changed
    if (updates.circuitBreakerOptions && this.options.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(
        this.options.circuitBreakerOptions!,
      );
    }
  }
}

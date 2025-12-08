import {
  ServiceError,
  type ServiceErrorOptions,
} from '@/shared/errors/ServiceError';
import { ErrorType, ResourceErrorCodes } from '@/shared/errors/ErrorTypes';
import { getRetryDelay } from '@/shared/errors/ErrorConstants';

export interface ResourceErrorContext {
  resourceType?: string;
  currentUsage?: number;
  limit?: number;
  unit?: string;
  process?: string;
  component?: string;
  available?: number;
}

export interface ResourceErrorOptions extends ServiceErrorOptions {
  context?: ResourceErrorContext;
}

/**
 * Error thrown when system resources are exhausted or unavailable.
 * Provides detailed information about resource failures including
 * current usage, limits, and affected components.
 */
export class ResourceError extends ServiceError {
  public override readonly context?: ResourceErrorContext;

  constructor(
    code: ResourceErrorCodes,
    message: string,
    options: ResourceErrorOptions = {},
  ) {
    super(ErrorType.RESOURCE, code, message, {
      ...options,
      retryable: code === ResourceErrorCodes.QUOTA_EXCEEDED, // Only quota exceeded is retryable
    });

    this.context = options.context;
  }

  /**
   * Create a resource error for memory exhaustion
   */
  static memoryExhausted(
    currentUsage?: number,
    limit?: number,
    process?: string,
  ): ResourceError {
    const message = `Memory exhausted${currentUsage && limit ? ` (${currentUsage}MB / ${limit}MB)` : ''}${process ? ` in process ${process}` : ''}`;

    return new ResourceError(ResourceErrorCodes.MEMORY_EXHAUSTED, message, {
      context: {
        resourceType: 'memory',
        currentUsage,
        limit,
        unit: 'MB',
        process,
      },
      retryAfter: getRetryDelay('LONG'), // 5 second retry delay for memory issues
    });
  }

  /**
   * Create a resource error for CPU exhaustion
   */
  static cpuExhausted(
    currentUsage?: number,
    limit?: number,
    process?: string,
  ): ResourceError {
    const message = `CPU exhausted${currentUsage && limit ? ` (${currentUsage}% / ${limit}%)` : ''}${process ? ` in process ${process}` : ''}`;

    return new ResourceError(ResourceErrorCodes.CPU_EXHAUSTED, message, {
      context: {
        resourceType: 'cpu',
        currentUsage,
        limit,
        unit: '%',
        process,
      },
      retryAfter: getRetryDelay('MEDIUM'), // 3 second retry delay for CPU issues
    });
  }

  /**
   * Create a resource error for disk space exhaustion
   */
  static diskSpaceExhausted(
    requiredSpace?: number,
    availableSpace?: number,
    path?: string,
  ): ResourceError {
    const message = `Disk space exhausted${requiredSpace ? ` (required: ${requiredSpace}MB)` : ''}${availableSpace ? ` (available: ${availableSpace}MB)` : ''}${path ? ` at ${path}` : ''}`;

    return new ResourceError(ResourceErrorCodes.DISK_SPACE_EXHAUSTED, message, {
      context: {
        resourceType: 'disk',
        currentUsage: availableSpace,
        limit: requiredSpace,
        unit: 'MB',
        component: path,
      },
      retryable: false, // Disk space exhaustion is not retryable
    });
  }

  /**
   * Create a resource error for file descriptor exhaustion
   */
  static fileDescriptorExhausted(
    currentUsage?: number,
    limit?: number,
    process?: string,
  ): ResourceError {
    const message = `File descriptors exhausted${currentUsage && limit ? ` (${currentUsage} / ${limit})` : ''}${process ? ` in process ${process}` : ''}`;

    return new ResourceError(
      ResourceErrorCodes.FILE_DESCRIPTOR_EXHAUSTED,
      message,
      {
        context: {
          resourceType: 'file_descriptor',
          currentUsage,
          limit,
          unit: 'count',
          process,
        },
        retryAfter: getRetryDelay('MEDIUM'), // 2 second retry delay for file descriptor issues
      },
    );
  }

  /**
   * Create a resource error for connection pool exhaustion
   */
  static connectionPoolExhausted(
    poolName: string,
    currentUsage?: number,
    limit?: number,
  ): ResourceError {
    const message = `Connection pool '${poolName}' exhausted${currentUsage && limit ? ` (${currentUsage} / ${limit})` : ''}`;

    return new ResourceError(
      ResourceErrorCodes.CONNECTION_POOL_EXHAUSTED,
      message,
      {
        context: {
          resourceType: 'connection_pool',
          currentUsage,
          limit,
          unit: 'connections',
          component: poolName,
        },
        retryAfter: getRetryDelay('SHORT'), // 1 second retry delay for connection pool issues
      },
    );
  }

  /**
   * Create a resource error for thread pool exhaustion
   */
  static threadPoolExhausted(
    poolName: string,
    currentUsage?: number,
    limit?: number,
  ): ResourceError {
    const message = `Thread pool '${poolName}' exhausted${currentUsage && limit ? ` (${currentUsage} / ${limit})` : ''}`;

    return new ResourceError(
      ResourceErrorCodes.THREAD_POOL_EXHAUSTED,
      message,
      {
        context: {
          resourceType: 'thread_pool',
          currentUsage,
          limit,
          unit: 'threads',
          component: poolName,
        },
        retryAfter: getRetryDelay('MEDIUM'), // 2 second retry delay for thread pool issues
      },
    );
  }

  /**
   * Create a resource error for quota exceeded
   */
  static quotaExceeded(
    quotaType: string,
    currentUsage?: number,
    limit?: number,
    component?: string,
  ): ResourceError {
    const message = `Quota exceeded for ${quotaType}${currentUsage && limit ? ` (${currentUsage} / ${limit})` : ''}${component ? ` in ${component}` : ''}`;

    return new ResourceError(ResourceErrorCodes.QUOTA_EXCEEDED, message, {
      context: {
        resourceType: 'quota',
        currentUsage,
        limit,
        unit: quotaType,
        component,
      },
      retryAfter: getRetryDelay('MAXIMUM'), // 1 minute retry delay for quota exceeded
    });
  }

  /**
   * Create a resource error for general resource limit reached
   */
  static resourceLimitReached(
    resourceType: string,
    currentUsage?: number,
    limit?: number,
    component?: string,
  ): ResourceError {
    const message = `Resource limit reached for ${resourceType}${currentUsage && limit ? ` (${currentUsage} / ${limit})` : ''}${component ? ` in ${component}` : ''}`;

    return new ResourceError(
      ResourceErrorCodes.RESOURCE_LIMIT_REACHED,
      message,
      {
        context: {
          resourceType,
          currentUsage,
          limit,
          unit: 'count',
          component,
        },
        retryAfter: getRetryDelay('LONG'), // 5 second retry delay for resource limits
      },
    );
  }

  /**
   * Get the type of resource that was exhausted
   */
  public getResourceType(): string | undefined {
    return this.context?.resourceType;
  }

  /**
   * Get the current usage of the resource
   */
  public getCurrentUsage(): number | undefined {
    return this.context?.currentUsage;
  }

  /**
   * Get the limit for the resource
   */
  public getLimit(): number | undefined {
    return this.context?.limit;
  }

  /**
   * Get the unit of measurement
   */
  public getUnit(): string | undefined {
    return this.context?.unit;
  }

  /**
   * Get the process that caused the resource exhaustion
   */
  public getProcess(): string | undefined {
    return this.context?.process;
  }

  /**
   * Get the component that was affected
   */
  public getComponent(): string | undefined {
    return this.context?.component;
  }

  /**
   * Get the available amount of the resource
   */
  public getAvailable(): number | undefined {
    return this.context?.available;
  }

  /**
   * Check if this error is related to a specific resource type
   */
  public isResourceType(resourceType: string): boolean {
    return this.context?.resourceType === resourceType;
  }

  /**
   * Check if this error is related to a specific component
   */
  public isComponentError(component: string): boolean {
    return this.context?.component === component;
  }

  /**
   * Calculate resource usage percentage
   */
  public getUsagePercentage(): number | undefined {
    if (this.context?.currentUsage && this.context.limit) {
      return (this.context.currentUsage / this.context.limit) * 100;
    }
    return undefined;
  }

  /**
   * Convert to user-friendly string with resource information
   */
  public override toUserString(): string {
    let result = super.toUserString();

    if (this.context?.resourceType) {
      result += `\n  Resource type: ${this.context.resourceType}`;
    }

    if (this.context?.currentUsage !== undefined) {
      result += `\n  Current usage: ${this.context.currentUsage}${this.context.unit ? ` ${this.context.unit}` : ''}`;
    }

    if (this.context?.limit !== undefined) {
      result += `\n  Limit: ${this.context.limit}${this.context.unit ? ` ${this.context.unit}` : ''}`;

      const percentage = this.getUsagePercentage();
      if (percentage) {
        result += ` (${percentage.toFixed(1)}%)`;
      }
    }

    if (this.context?.process) {
      result += `\n  Process: ${this.context.process}`;
    }

    if (this.context?.component) {
      result += `\n  Component: ${this.context.component}`;
    }

    return result;
  }
}

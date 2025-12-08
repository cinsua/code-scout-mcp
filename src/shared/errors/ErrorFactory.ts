import { ServiceError } from './ServiceError';
import { FileSystemError } from './FileSystemError';
import { ResourceError } from './ResourceError';
import { TimeoutError } from './TimeoutError';
import { ValidationError } from './ValidationError';
import { NetworkError } from './NetworkError';
import { ErrorType, ErrorTypeUtils } from './ErrorTypes';
import { ParsingError } from './ParsingError';
import { getTimeout, getRetryDelay } from './ErrorConstants';
import { DatabaseError, DatabaseErrorType } from './DatabaseError';

import { ConfigurationError } from '@/config/errors/ConfigurationError';

// Concrete implementation of ServiceError for factory use
class ConcreteServiceError extends ServiceError {
  constructor(type: string, code: string, message: string, options?: any) {
    super(type, code, message, options);
  }
}

/**
 * Factory class for creating standardized error instances.
 * Provides convenient methods to create errors with proper context and formatting.
 */
export class ErrorFactory {
  /**
   * Create an error from a generic Error instance
   */
  static fromError(error: Error, operation?: string): ServiceError {
    if (error instanceof ServiceError) {
      if (operation) {
        error.setOperation(operation);
      }
      return error;
    }

    // Try to determine error type from error message or name
    const errorType = this.inferErrorType(error);

    switch (errorType) {
      case ErrorType.VALIDATION:
        return ValidationError.validationFailed(error.message);

      case ErrorType.PARSING:
        return ParsingError.malformedData(error.message);

      case ErrorType.FILESYSTEM:
        return FileSystemError.ioError(error.message);

      case ErrorType.TIMEOUT: {
        const timeoutError = TimeoutError.operationTimeout(
          operation ?? 'unknown',
          getTimeout('DEFAULT'),
        );
        if (operation) {
          timeoutError.setOperation(operation);
        }
        return timeoutError;
      }

      case ErrorType.NETWORK:
        return NetworkError.protocolError('unknown', error.message);

      case ErrorType.RESOURCE:
        return ResourceError.resourceLimitReached('unknown');

      default:
        return this.service(error.message, 'INTERNAL_ERROR', false);
    }
  }

  /**
   * Create an error from an error response object
   */
  static fromResponse(response: any, _operation?: string): ServiceError {
    if (!response?.error) {
      return new ConcreteServiceError(
        ErrorType.SERVICE,
        'INVALID_RESPONSE',
        'Invalid error response format',
        { context: { response } },
      );
    }

    const errorData = response.error;
    const errorType = errorData.type as ErrorType;

    // Create appropriate error based on type
    switch (errorType) {
      case ErrorType.VALIDATION:
        return new ValidationError(errorData.code, errorData.message, {
          context: errorData.context,
        });

      case ErrorType.PARSING:
        return new ParsingError(errorData.code, errorData.message, {
          context: errorData.context,
        });

      case ErrorType.FILESYSTEM:
        return new FileSystemError(errorData.code, errorData.message, {
          context: errorData.context,
        });

      case ErrorType.TIMEOUT:
        return new TimeoutError(errorData.code, errorData.message, {
          context: errorData.context,
        });

      case ErrorType.NETWORK:
        return new NetworkError(errorData.code, errorData.message, {
          context: errorData.context,
        });

      case ErrorType.RESOURCE:
        return new ResourceError(errorData.code, errorData.message, {
          context: errorData.context,
        });

      default:
        return new ConcreteServiceError(
          errorType,
          errorData.code,
          errorData.message,
          {
            retryable: response.retryable,
            retryAfter: response.retryAfter,
            context: errorData.context,
          },
        );
    }
  }

  /**
   * Create a validation error
   */
  static validation(
    message: string,
    field?: string,
    value?: any,
  ): ValidationError {
    return ValidationError.validationFailed(message, field, value);
  }

  /**
   * Create a validation error for constraint violation
   */
  static validationConstraint(
    field: string,
    constraint: string,
    value?: any,
  ): ValidationError {
    return ValidationError.constraintViolation(field, constraint, value);
  }

  /**
   * Create a validation error for invalid type
   */
  static validationType(
    field: string,
    value: any,
    expectedType: string,
  ): ValidationError {
    return ValidationError.invalidType(field, value, expectedType);
  }

  /**
   * Create a parsing error
   */
  static parsing(
    message: string,
    filePath?: string,
    line?: number,
  ): ParsingError {
    return ParsingError.syntaxError(message, filePath, line);
  }

  /**
   * Create a file system error
   */
  static filesystem(
    message: string,
    filePath?: string,
    operation?: string,
  ): FileSystemError {
    return FileSystemError.ioError(message, filePath, operation);
  }

  /**
   * Create a timeout error
   */
  static timeout(
    operation: string,
    timeoutMs: number,
    actualDuration?: number,
  ): TimeoutError {
    return TimeoutError.operationTimeout(operation, timeoutMs, actualDuration);
  }

  /**
   * Create a resource error
   */
  static resource(
    resourceType: string,
    message: string,
    currentUsage?: number,
    limit?: number,
  ): ResourceError {
    return ResourceError.resourceLimitReached(
      resourceType,
      currentUsage,
      limit,
    );
  }

  /**
   * Create a network error
   */
  static network(message: string, host?: string, port?: number): NetworkError {
    return NetworkError.connectionRefused(host ?? 'unknown', port);
  }

  /**
   * Create a service error
   */
  static service(
    message: string,
    code: string = 'SERVICE_ERROR',
    retryable: boolean = false,
  ): ServiceError {
    return new ConcreteServiceError(ErrorType.SERVICE, code, message, {
      retryable,
    });
  }

  /**
   * Create an error with retry configuration
   */
  static retryable(
    message: string,
    retryAfter?: number,
    operation?: string,
  ): ServiceError {
    const error = new ConcreteServiceError(
      ErrorType.SERVICE,
      'RETRYABLE_ERROR',
      message,
      {
        retryable: true,
        retryAfter: retryAfter ?? getRetryDelay('SHORT'),
      },
    );

    if (operation) {
      error.setOperation(operation);
    }

    return error;
  }

  /**
   * Create a critical error
   */
  static critical(
    message: string,
    operation?: string,
    context?: Record<string, any>,
  ): ServiceError {
    const error = new ConcreteServiceError(
      ErrorType.SERVICE,
      'CRITICAL_ERROR',
      message,
      {
        retryable: false, // Critical errors are not retryable
        context,
      },
    );

    if (operation) {
      error.setOperation(operation);
    }

    return error;
  }

  /**
   * Infer error type from generic error
   */
  private static inferErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.constructor.name;

    // Check error name first
    const typeFromName = ErrorTypeUtils.getErrorTypeFromName(name);
    if (typeFromName) {
      return typeFromName;
    }

    // Infer from error message - check parsing before validation
    if (message.includes('parse') || message.includes('syntax')) {
      return ErrorType.PARSING;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }

    if (
      message.includes('file') ||
      message.includes('directory') ||
      message.includes('permission')
    ) {
      return ErrorType.FILESYSTEM;
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.TIMEOUT;
    }

    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('host')
    ) {
      return ErrorType.NETWORK;
    }

    if (
      message.includes('memory') ||
      message.includes('resource') ||
      message.includes('quota')
    ) {
      return ErrorType.RESOURCE;
    }

    return ErrorType.SERVICE;
  }

  /**
   * Create error with context propagation
   */
  static withContext<T extends ServiceError>(
    ErrorClass: new (...args: any[]) => T,
    baseError: Error,
    additionalContext?: Record<string, any>,
  ): T {
    const error = this.fromError(baseError);

    if (additionalContext) {
      return error.withContext(additionalContext) as T;
    }

    return error as T;
  }

  /**
   * Create batch validation error
   */
  static batchValidation(
    errors: Array<{ field?: string; message: string; value?: any }>,
  ): ValidationError {
    const message = `Batch validation failed with ${errors.length} error(s)`;

    return ValidationError.validationFailed(message, undefined, {
      errors,
      batch: true,
    });
  }

  /**
   * Create error with operation context
   */
  static withOperation(error: ServiceError, operation: string): ServiceError {
    error.setOperation(operation);
    return error;
  }

  /**
   * Create ConfigurationError using factory pattern
   */
  static configuration(
    code: string,
    message: string,
    options: {
      path?: string;
      source?: string;
      suggestions?: string[];
      retryable?: boolean;
      retryAfter?: number;
      operation?: string;
      context?: Record<string, any>;
      cause?: Error;
    } = {},
  ): ServiceError {
    // ConfigurationError already extends ServiceError, so return it directly
    return new ConfigurationError(message, code, {
      path: options.path,
      source: options.source,
      suggestions: options.suggestions,
      retryable: options.retryable,
      retryAfter: options.retryAfter,
      operation: options.operation,
      context: options.context,
      cause: options.cause,
    });
  }

  /**
   * Create DatabaseError using factory pattern
   */
  static database(
    type: DatabaseErrorType,
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
      context?: Record<string, unknown>;
      retryable?: boolean;
      retryAfter?: number;
    } = {},
  ): DatabaseError {
    // DatabaseError already extends ServiceError, so return it directly
    return new DatabaseError(type, message, {
      original: options.original,
      query: options.query,
      params: options.params,
      context: options.context,
      retryable: options.retryable,
      retryAfter: options.retryAfter,
    });
  }

  /**
   * Wrap legacy errors in appropriate ServiceError types
   */
  static wrapLegacyError(error: Error): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    // Try to detect ConfigurationError by name or structure
    if (
      error.name === 'ConfigurationError' ||
      (error as any).code?.startsWith('VALIDATION_')
    ) {
      const legacy = error as any;
      return this.configuration(
        legacy.code ?? 'UNKNOWN_ERROR',
        legacy.message,
        {
          path: legacy.path,
          source: legacy.source,
          suggestions: legacy.suggestions,
        },
      );
    }

    // Try to detect DatabaseError by name or structure
    if (
      error.name === 'DatabaseError' ||
      (error as any).type?.startsWith('CONNECTION_')
    ) {
      const legacy = error as any;

      return this.database(
        legacy.type ?? DatabaseErrorType.QUERY_FAILED,
        legacy.message,
        {
          original: legacy.original,
          query: legacy.query,
          params: legacy.params,
        },
      );
    }

    // Fallback to generic service error
    return this.service(error.message, 'LEGACY_ERROR', false);
  }

  /**
   * Create error type detection and automatic wrapping
   */
  static detectAndWrap(error: Error, operation?: string): ServiceError {
    // If it's already a ServiceError, just add operation if needed
    if (error instanceof ServiceError) {
      if (operation) {
        error.setOperation(operation);
      }
      return error;
    }

    // Try to infer error type and create appropriate error
    const inferredType = this.inferErrorType(error);

    let serviceError: ServiceError;

    switch (inferredType) {
      case ErrorType.VALIDATION:
        serviceError = ValidationError.validationFailed(error.message);
        break;

      case ErrorType.PARSING:
        serviceError = ParsingError.malformedData(error.message);
        break;

      case ErrorType.FILESYSTEM:
        serviceError = FileSystemError.ioError(error.message);
        break;

      case ErrorType.TIMEOUT:
        serviceError = TimeoutError.operationTimeout(
          operation ?? 'unknown',
          getTimeout('DEFAULT'),
        );
        break;

      case ErrorType.NETWORK:
        serviceError = NetworkError.connectionRefused('unknown');
        break;

      case ErrorType.RESOURCE:
        serviceError = ResourceError.resourceLimitReached('unknown');
        break;

      default:
        // Try legacy error wrapping first
        serviceError = this.wrapLegacyError(error);
        break;
    }

    // Add operation if provided
    if (operation) {
      serviceError.setOperation(operation);
    }

    return serviceError;
  }

  /**
   * Create legacy error migration utilities
   */
  static migrateLegacyError(error: Error): {
    migrated: ServiceError;
    wasLegacy: boolean;
    originalType: string;
  } {
    const originalType = error.constructor.name;
    const wasLegacy = !(error instanceof ServiceError);

    if (!wasLegacy) {
      return {
        migrated: error as ServiceError,
        wasLegacy: false,
        originalType,
      };
    }

    const migrated = this.detectAndWrap(error);

    return {
      migrated,
      wasLegacy: true,
      originalType,
    };
  }

  /**
   * Create error conversion utilities for backward compatibility
   */
  static convertToServiceError(
    error: Error | ServiceError,
    options: {
      preserveOriginal?: boolean;
      addContext?: Record<string, any>;
      operation?: string;
    } = {},
  ): ServiceError {
    // If it's already a ServiceError, enhance it if needed
    if (error instanceof ServiceError) {
      let serviceError = error;
      if (options.addContext) {
        serviceError = serviceError.withContext(options.addContext);
      }
      if (options.operation) {
        serviceError.setOperation(options.operation);
      }
      return serviceError;
    }

    // Convert legacy error
    let serviceError = this.detectAndWrap(error, options.operation);

    if (options.addContext) {
      serviceError = serviceError.withContext(options.addContext);
    }

    // Preserve original error if requested
    if (options.preserveOriginal) {
      serviceError = serviceError.withContext({ originalError: error });
    }

    return serviceError;
  }
}

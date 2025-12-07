import { ServiceError } from './ServiceError';
import { ValidationError } from './ValidationError';
import { ParsingError } from './ParsingError';
import { FileSystemError } from './FileSystemError';
import { TimeoutError } from './TimeoutError';
import { ResourceError } from './ResourceError';
import { NetworkError } from './NetworkError';
import { ErrorType, ErrorTypeUtils } from './ErrorTypes';

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

      case ErrorType.TIMEOUT:
        return TimeoutError.operationTimeout(operation ?? 'unknown', 30000);

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
    retryAfter: number = 1000,
    operation?: string,
  ): ServiceError {
    const error = new ConcreteServiceError(
      ErrorType.SERVICE,
      'RETRYABLE_ERROR',
      message,
      { retryable: true, retryAfter },
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
        retryable: false,
        context: { ...context, severity: 'critical' },
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

    // Infer from error message
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }

    if (message.includes('parse') || message.includes('syntax')) {
      return ErrorType.PARSING;
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
}

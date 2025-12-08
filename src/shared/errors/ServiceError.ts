/**
 * Base class for all service errors in the Code-Scout MCP application.
 * Provides standardized error structure and serialization capabilities.
 */

export interface ServiceErrorOptions {
  retryable?: boolean;
  retryAfter?: number;
  context?: Record<string, any>;
  cause?: Error;
  operation?: string;
}

export interface ErrorResponse {
  error: {
    type: string;
    code: string;
    message: string;
    details?: any;
    timestamp: number;
    operation: string;
    context?: {
      filePath?: string;
      query?: string;
      parameters?: any;
    };
  };
  retryable?: boolean;
  retryAfter?: number;
}

export abstract class ServiceError extends Error {
  public readonly type: string;
  public readonly code: string;
  public readonly timestamp: number;
  public readonly operation: string;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly context?: Record<string, any>;

  constructor(
    type: string,
    code: string,
    message: string,
    options: ServiceErrorOptions = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.code = code;
    this.timestamp = Date.now();
    this.operation = options.operation ?? 'unknown'; // Set by service or option
    this.retryable = options.retryable ?? false;
    this.retryAfter = options.retryAfter;
    this.context = options.context;

    if (options.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Set the operation name for this error
   */
  public setOperation(operation: string): this {
    (this as any).operation = operation;
    return this;
  }

  /**
   * Convert error to standardized response format
   */
  public toResponse(): ErrorResponse {
    return {
      error: {
        type: this.type,
        code: this.code,
        message: this.message,
        details: this.context,
        timestamp: this.timestamp,
        operation: this.operation,
        context: this.context,
      },
      retryable: this.retryable,
      retryAfter: this.retryAfter,
    };
  }

  /**
   * Serialize error to JSON
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      operation: this.operation,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      context: this.context,
      stack: this.stack,
      cause: this.cause ? (this.cause as Error).message : undefined,
    };
  }

  /**
   * Get user-friendly error message
   */
  public toUserString(): string {
    let result = `[${this.type}] ${this.message}`;

    if (this.context?.filePath) {
      result += `\n  File: ${this.context.filePath}`;
    }

    if (this.retryable) {
      result += '\n  This operation can be retried.';
      if (this.retryAfter) {
        result += ` Suggested retry delay: ${this.retryAfter}ms`;
      }
    }

    return result;
  }

  /**
   * Check if error matches specific type and code
   */
  public matches(type: string, code?: string): boolean {
    if (this.type !== type) {
      return false;
    }

    if (code && this.code !== code) {
      return false;
    }

    return true;
  }

  /**
   * Create a copy of this error with modified context
   */
  public withContext(additionalContext: Record<string, any>): this {
    const ErrorClass = this.constructor as new (
      type: string,
      code: string,
      message: string,
      options?: ServiceErrorOptions,
    ) => this;

    return new ErrorClass(this.type, this.code, this.message, {
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      context: { ...this.context, ...additionalContext },
      cause: this.cause as Error,
    }) as this;
  }
}

import { ServiceError } from '@/shared/errors/ServiceError';
import { getRetryDelay, getTimeout } from '@/shared/errors/ErrorConstants';

/**
 * Error types for database operations
 */
export enum DatabaseErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  TIMEOUT = 'TIMEOUT',
  CORRUPTION = 'CORRUPTION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * Database error class
 */
export class DatabaseError extends ServiceError {
  /** Database error type (specific to database operations) */
  public readonly databaseType: DatabaseErrorType;

  /** Original error if available */
  public readonly original?: Error;

  /** Query that caused the error */
  public readonly query?: string;

  /** Query parameters */
  public readonly params?: unknown[];

  /** Error timestamp (legacy compatibility) */
  public override readonly timestamp: number;

  constructor(
    type: DatabaseErrorType,
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
      context?: Record<string, unknown>;
      retryable?: boolean;
      retryAfter?: number;
      operation?: string;
    } = {},
  ) {
    const isRetryable =
      options.retryable ?? DatabaseError.isRetryableType(type);
    const retryAfter =
      options.retryAfter ?? DatabaseError.getDefaultRetryDelay(type);

    super('DATABASE', type, message, {
      retryable: isRetryable,
      retryAfter,
      operation: options.operation ?? 'database_operation',
      context: {
        ...options.context,
        query: options.query,
        params: options.params,
        originalError: options.original?.message,
      },
      cause: options.original,
    });

    this.databaseType = type;
    this.original = options.original;
    this.query = options.query;
    this.params = options.params;
    this.timestamp = Date.now();
  }

  /**
   * Determine if a database error type is retryable
   */
  private static isRetryableType(type: DatabaseErrorType): boolean {
    switch (type) {
      case DatabaseErrorType.CONNECTION_FAILED:
      case DatabaseErrorType.TIMEOUT:
      case DatabaseErrorType.QUERY_FAILED:
        return true;
      case DatabaseErrorType.CONSTRAINT_VIOLATION:
      case DatabaseErrorType.CORRUPTION:
      case DatabaseErrorType.PERMISSION_DENIED:
      case DatabaseErrorType.TRANSACTION_FAILED:
      case DatabaseErrorType.MIGRATION_FAILED:
        return false;
      default:
        return false;
    }
  }

  /**
   * Get default retry delay for a database error type
   */
  private static getDefaultRetryDelay(type: DatabaseErrorType): number {
    switch (type) {
      case DatabaseErrorType.CONNECTION_FAILED:
        return getRetryDelay('EXTENDED');
      case DatabaseErrorType.TIMEOUT:
        return getRetryDelay('LONG');
      case DatabaseErrorType.QUERY_FAILED:
        return getRetryDelay('MEDIUM');
      case DatabaseErrorType.TRANSACTION_FAILED:
        return getRetryDelay('SHORT');
      default:
        return getRetryDelay('SHORT');
    }
  }

  /**
   * Factory method for connection failures
   */
  static connectionFailed(
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
      context?: Record<string, unknown>;
    } = {},
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.CONNECTION_FAILED, message, {
      ...options,
      retryable: true,
      retryAfter: getRetryDelay('EXTENDED'),
      operation: 'database_connection_failed',
    });
  }

  /**
   * Factory method for query failures
   */
  static queryFailed(
    message: string,
    query: string,
    params?: unknown[],
    original?: Error,
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.QUERY_FAILED, message, {
      query,
      params,
      original,
      retryable: true,
      retryAfter: getRetryDelay('MEDIUM'),
      operation: 'database_query_failed',
    });
  }

  /**
   * Factory method for timeout errors
   */
  static timeout(
    message: string,
    query?: string,
    params?: unknown[],
    original?: Error,
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.TIMEOUT, message, {
      query,
      params,
      original,
      retryable: true,
      retryAfter: getTimeout('DATABASE'),
      operation: 'database_timeout',
    });
  }

  /**
   * Factory method for transaction failures
   */
  static transactionFailed(
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
      context?: Record<string, unknown>;
    } = {},
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.TRANSACTION_FAILED, message, {
      ...options,
      retryable: false,
    });
  }

  /**
   * Factory method for migration failures
   */
  static migrationFailed(
    message: string,
    options: {
      original?: Error;
      context?: Record<string, unknown>;
    } = {},
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.MIGRATION_FAILED, message, {
      ...options,
      retryable: false,
    });
  }

  /**
   * Factory method for constraint violations
   */
  static constraintViolation(
    message: string,
    query?: string,
    params?: unknown[],
    original?: Error,
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.CONSTRAINT_VIOLATION, message, {
      query,
      params,
      original,
      retryable: false,
    });
  }

  /**
   * Factory method for corruption errors
   */
  static corruption(
    message: string,
    options: {
      original?: Error;
      context?: Record<string, unknown>;
    } = {},
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.CORRUPTION, message, {
      ...options,
      retryable: false,
    });
  }

  /**
   * Factory method for permission denied errors
   */
  static permissionDenied(
    message: string,
    options: {
      original?: Error;
      context?: Record<string, unknown>;
    } = {},
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.PERMISSION_DENIED, message, {
      ...options,
      retryable: false,
    });
  }

  /**
   * Maintain backward compatibility with toJSON method
   */
  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      databaseType: this.databaseType,
      original: this.original?.message,
      query: this.query,
      params: this.params,
      timestamp: new Date(this.timestamp).toISOString(),
    };
  }

  /**
   * Enhanced user-friendly string representation
   */
  override toUserString(): string {
    let result = super.toUserString();

    if (this.query) {
      result += `\n  Query: ${this.query.substring(0, 200)}${this.query.length > 200 ? '...' : ''}`;
    }

    if (this.params && this.params.length > 0) {
      result += `\n  Parameters: ${JSON.stringify(this.params).substring(0, 150)}${JSON.stringify(this.params).length > 150 ? '...' : ''}`;
    }

    if (this.original) {
      result += `\n  Original error: ${this.original.message}`;
    }

    return result;
  }
}

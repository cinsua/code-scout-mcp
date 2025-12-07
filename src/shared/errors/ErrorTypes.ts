/**
 * Error type definitions and enums for the Code-Scout MCP application.
 * Provides standardized error classification and codes.
 */

/**
 * Main error type categories
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  PARSING = 'PARSING',
  DATABASE = 'DATABASE',
  FILESYSTEM = 'FILESYSTEM',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  RESOURCE = 'RESOURCE',
  CONFIGURATION = 'CONFIGURATION',
  SERVICE = 'SERVICE',
}

/**
 * Validation error codes
 */
export enum ValidationErrorCodes {
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  INVALID_TYPE = 'INVALID_TYPE',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

/**
 * Parsing error codes
 */
export enum ParsingErrorCodes {
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_YAML = 'INVALID_YAML',
  INVALID_XML = 'INVALID_XML',
  ENCODING_ERROR = 'ENCODING_ERROR',
  UNEXPECTED_TOKEN = 'UNEXPECTED_TOKEN',
  MALFORMED_DATA = 'MALFORMED_DATA',
  PARSER_NOT_FOUND = 'PARSER_NOT_FOUND',
}

/**
 * Database error codes
 */
export enum DatabaseErrorCodes {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  DEADLOCK = 'DEADLOCK',
  TIMEOUT = 'TIMEOUT',
  CORRUPTION = 'CORRUPTION',
  LOCK_ERROR = 'LOCK_ERROR',
}

/**
 * File system error codes
 */
export enum FileSystemErrorCodes {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_EXISTS = 'FILE_EXISTS',
  INVALID_PATH = 'INVALID_PATH',
  DISK_FULL = 'DISK_FULL',
  IO_ERROR = 'IO_ERROR',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  NOT_A_DIRECTORY = 'NOT_A_DIRECTORY',
  NOT_A_FILE = 'NOT_A_FILE',
}

/**
 * Network error codes
 */
export enum NetworkErrorCodes {
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  HOST_UNREACHABLE = 'HOST_UNREACHABLE',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  SSL_ERROR = 'SSL_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Timeout error codes
 */
export enum TimeoutErrorCodes {
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  READ_TIMEOUT = 'READ_TIMEOUT',
  WRITE_TIMEOUT = 'WRITE_TIMEOUT',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',
  PARSING_TIMEOUT = 'PARSING_TIMEOUT',
  INDEXING_TIMEOUT = 'INDEXING_TIMEOUT',
}

/**
 * Resource error codes
 */
export enum ResourceErrorCodes {
  MEMORY_EXHAUSTED = 'MEMORY_EXHAUSTED',
  CPU_EXHAUSTED = 'CPU_EXHAUSTED',
  DISK_SPACE_EXHAUSTED = 'DISK_SPACE_EXHAUSTED',
  FILE_DESCRIPTOR_EXHAUSTED = 'FILE_DESCRIPTOR_EXHAUSTED',
  CONNECTION_POOL_EXHAUSTED = 'CONNECTION_POOL_EXHAUSTED',
  THREAD_POOL_EXHAUSTED = 'THREAD_POOL_EXHAUSTED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RESOURCE_LIMIT_REACHED = 'RESOURCE_LIMIT_REACHED',
}

/**
 * Service error codes
 */
export enum ServiceErrorCodes {
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_INITIALIZATION_FAILED = 'SERVICE_INITIALIZATION_FAILED',
  SERVICE_SHUTDOWN_FAILED = 'SERVICE_SHUTDOWN_FAILED',
  DEPENDENCY_NOT_AVAILABLE = 'DEPENDENCY_NOT_AVAILABLE',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error context types
 */
export enum ErrorContextType {
  FILE_PATH = 'filePath',
  QUERY = 'query',
  PARAMETERS = 'parameters',
  OPERATION = 'operation',
  SERVICE = 'service',
  COMPONENT = 'component',
  USER_ID = 'userId',
  REQUEST_ID = 'requestId',
  TIMESTAMP = 'timestamp',
}

/**
 * Error recovery strategies
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  DEGRADE = 'degrade',
  ABORT = 'abort',
  IGNORE = 'ignore',
  ALTERNATIVE = 'alternative',
}

/**
 * Error category mappings
 */
export const ERROR_CATEGORY_MAPPINGS: Record<string, ErrorType> = {
  ValidationError: ErrorType.VALIDATION,
  ParsingError: ErrorType.PARSING,
  DatabaseError: ErrorType.DATABASE,
  FileSystemError: ErrorType.FILESYSTEM,
  NetworkError: ErrorType.NETWORK,
  TimeoutError: ErrorType.TIMEOUT,
  ResourceError: ErrorType.RESOURCE,
  ConfigurationError: ErrorType.CONFIGURATION,
  ServiceError: ErrorType.SERVICE,
};

/**
 * Retryable error codes
 */
export const RETRYABLE_ERROR_CODES: Set<string> = new Set([
  DatabaseErrorCodes.CONNECTION_FAILED,
  DatabaseErrorCodes.TIMEOUT,
  DatabaseErrorCodes.DEADLOCK,
  NetworkErrorCodes.CONNECTION_TIMEOUT,
  NetworkErrorCodes.CONNECTION_REFUSED,
  TimeoutErrorCodes.OPERATION_TIMEOUT,
  TimeoutErrorCodes.CONNECTION_TIMEOUT,
  ServiceErrorCodes.SERVICE_UNAVAILABLE,
  ServiceErrorCodes.DEPENDENCY_NOT_AVAILABLE,
]);

/**
 * Critical error codes (require immediate attention)
 */
export const CRITICAL_ERROR_CODES: Set<string> = new Set([
  DatabaseErrorCodes.CORRUPTION,
  ResourceErrorCodes.MEMORY_EXHAUSTED,
  ResourceErrorCodes.DISK_SPACE_EXHAUSTED,
  FileSystemErrorCodes.DISK_FULL,
  ServiceErrorCodes.SERVICE_INITIALIZATION_FAILED,
]);

/**
 * Default retry delays for different error types (in milliseconds)
 */
export const DEFAULT_RETRY_DELAYS: Record<ErrorType, number> = {
  [ErrorType.DATABASE]: 1000,
  [ErrorType.NETWORK]: 500,
  [ErrorType.TIMEOUT]: 2000,
  [ErrorType.RESOURCE]: 5000,
  [ErrorType.FILESYSTEM]: 1000,
  [ErrorType.VALIDATION]: 0, // Don't retry validation errors
  [ErrorType.PARSING]: 0, // Don't retry parsing errors
  [ErrorType.CONFIGURATION]: 0, // Don't retry configuration errors
  [ErrorType.SERVICE]: 1000,
};

/**
 * Error type utilities
 */
export class ErrorTypeUtils {
  /**
   * Check if an error code is retryable
   */
  static isRetryable(errorCode: string): boolean {
    return RETRYABLE_ERROR_CODES.has(errorCode);
  }

  /**
   * Check if an error code is critical
   */
  static isCritical(errorCode: string): boolean {
    return CRITICAL_ERROR_CODES.has(errorCode);
  }

  /**
   * Get default retry delay for an error type
   */
  static getDefaultRetryDelay(errorType: ErrorType): number {
    return (
      DEFAULT_RETRY_DELAYS[errorType as keyof typeof DEFAULT_RETRY_DELAYS] ||
      1000
    );
  }

  /**
   * Get error type from error name
   */
  static getErrorTypeFromName(errorName: string): ErrorType | null {
    return (
      ERROR_CATEGORY_MAPPINGS[
        errorName as keyof typeof ERROR_CATEGORY_MAPPINGS
      ] ?? null
    );
  }

  /**
   * Get all error codes for a specific error type
   */
  static getErrorCodesForType(errorType: ErrorType): string[] {
    switch (errorType) {
      case ErrorType.VALIDATION:
        return Object.values(ValidationErrorCodes);
      case ErrorType.PARSING:
        return Object.values(ParsingErrorCodes);
      case ErrorType.DATABASE:
        return Object.values(DatabaseErrorCodes);
      case ErrorType.FILESYSTEM:
        return Object.values(FileSystemErrorCodes);
      case ErrorType.NETWORK:
        return Object.values(NetworkErrorCodes);
      case ErrorType.TIMEOUT:
        return Object.values(TimeoutErrorCodes);
      case ErrorType.RESOURCE:
        return Object.values(ResourceErrorCodes);
      case ErrorType.SERVICE:
        return Object.values(ServiceErrorCodes);
      default:
        return [];
    }
  }
}

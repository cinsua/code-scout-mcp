// Error handling exports
export {
  ServiceError,
  type ServiceErrorOptions,
  type ErrorResponse,
} from './ServiceError';
export {
  ValidationError,
  type ValidationErrorContext,
  type ValidationErrorOptions,
} from './ValidationError';
export {
  ParsingError,
  type ParsingErrorContext,
  type ParsingErrorOptions,
} from './ParsingError';
export {
  FileSystemError,
  type FileSystemErrorContext,
  type FileSystemErrorOptions,
} from './FileSystemError';
export {
  TimeoutError,
  type TimeoutErrorContext,
  type TimeoutErrorOptions,
} from './TimeoutError';
export {
  ResourceError,
  type ResourceErrorContext,
  type ResourceErrorOptions,
} from './ResourceError';
export {
  NetworkError,
  type NetworkErrorContext,
  type NetworkErrorOptions,
} from './NetworkError';
export { ErrorFactory } from './ErrorFactory';

// Error types and utilities
export {
  ErrorType,
  ValidationErrorCodes,
  ParsingErrorCodes,
  DatabaseErrorCodes,
  FileSystemErrorCodes,
  NetworkErrorCodes,
  TimeoutErrorCodes,
  ResourceErrorCodes,
  ServiceErrorCodes,
  ErrorSeverity,
  ErrorContextType,
  RecoveryStrategy,
  ERROR_CATEGORY_MAPPINGS,
  RETRYABLE_ERROR_CODES,
  CRITICAL_ERROR_CODES,
  DEFAULT_RETRY_DELAYS,
  ErrorTypeUtils,
} from './ErrorTypes';

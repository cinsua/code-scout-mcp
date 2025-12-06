/**
 * Configuration Error Types
 *
 * This file defines custom error types for configuration-related errors
 * with proper error codes and structured error information.
 */

export class ConfigurationError extends Error {
  public readonly code: string;
  public readonly path?: string;
  public readonly source?: string;
  public readonly suggestions?: string[];

  constructor(
    message: string,
    code: string,
    options?: {
      path?: string;
      source?: string;
      suggestions?: string[];
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = code;
    this.path = options?.path;
    this.source = options?.source;
    this.suggestions = options?.suggestions;

    // Maintain stack trace for proper error handling
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationError);
    }

    // Set cause if provided (using non-standard property)
    if (options?.cause) {
      (this as any).cause = options.cause;
    }
  }

  /**
   * Create a validation error
   */
  static validation(
    message: string,
    path: string,
    suggestions?: string[]
  ): ConfigurationError {
    return new ConfigurationError(
      `Validation failed: ${message}`,
      'VALIDATION_ERROR',
      { path, suggestions }
    );
  }

  /**
   * Create a file access error
   */
  static fileAccess(
    message: string,
    path: string,
    source?: string
  ): ConfigurationError {
    return new ConfigurationError(
      `File access error: ${message}`,
      'FILE_ACCESS_ERROR',
      {
        path,
        source,
        suggestions: ['Check file permissions', 'Verify file exists'],
      }
    );
  }

  /**
   * Create a parsing error
   */
  static parsing(
    message: string,
    source?: string,
    cause?: Error
  ): ConfigurationError {
    return new ConfigurationError(
      `Configuration parsing error: ${message}`,
      'PARSING_ERROR',
      {
        source,
        cause,
        suggestions: ['Check JSON syntax', 'Validate configuration format'],
      }
    );
  }

  /**
   * Create a source error
   */
  static source(
    message: string,
    source: string,
    cause?: Error
  ): ConfigurationError {
    return new ConfigurationError(
      `Configuration source error: ${message}`,
      'SOURCE_ERROR',
      { source, cause }
    );
  }

  /**
   * Create a migration error
   */
  static migration(
    message: string,
    fromVersion: string,
    toVersion: string,
    cause?: Error
  ): ConfigurationError {
    return new ConfigurationError(
      `Configuration migration error: ${message}`,
      'MIGRATION_ERROR',
      {
        cause,
        suggestions: [
          'Check migration compatibility',
          'Verify configuration format',
          `Ensure migration from ${fromVersion} to ${toVersion} is supported`,
        ],
      }
    );
  }

  /**
   * Create a schema validation error
   */
  static schema(
    message: string,
    path?: string,
    suggestions?: string[]
  ): ConfigurationError {
    return new ConfigurationError(
      `Schema validation failed: ${message}`,
      'SCHEMA_VALIDATION_ERROR',
      {
        path,
        suggestions: suggestions || [
          'Check configuration against schema',
          'Verify required fields are present',
          'Ensure field types are correct',
        ],
      }
    );
  }

  /**
   * Create a semantic validation error
   */
  static semantic(
    message: string,
    path?: string,
    suggestions?: string[]
  ): ConfigurationError {
    return new ConfigurationError(
      `Semantic validation failed: ${message}`,
      'SEMANTIC_VALIDATION_ERROR',
      {
        path,
        suggestions: suggestions || [
          'Check configuration logic',
          'Verify dependencies between settings',
          'Ensure configuration is consistent',
        ],
      }
    );
  }

  /**
   * Create a hot reload error
   */
  static hotReload(
    message: string,
    source?: string,
    cause?: Error
  ): ConfigurationError {
    return new ConfigurationError(
      `Hot reload error: ${message}`,
      'HOT_RELOAD_ERROR',
      {
        source,
        cause,
        suggestions: [
          'Check file permissions',
          'Verify file format',
          'Ensure configuration is valid',
        ],
      }
    );
  }

  /**
   * Get error details as a plain object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      path: this.path,
      source: this.source,
      suggestions: this.suggestions,
      stack: this.stack,
    };
  }

  /**
   * Format error for user display
   */
  toUserString(): string {
    let result = `${this.code}: ${this.message}`;

    if (this.path) {
      result += `\n  Path: ${this.path}`;
    }

    if (this.source) {
      result += `\n  Source: ${this.source}`;
    }

    if (this.suggestions && this.suggestions.length > 0) {
      result += '\n  Suggestions:';
      this.suggestions.forEach((suggestion) => {
        result += `\n    - ${suggestion}`;
      });
    }

    return result;
  }
}

/**
 * Error codes for configuration errors
 */
export enum ConfigurationErrorCode {
  // General errors
  CONFIG_NOT_LOADED = 'CONFIG_NOT_LOADED',
  INVALID_PATH = 'INVALID_PATH',
  SECTION_NOT_FOUND = 'SECTION_NOT_FOUND',
  IMPORT_FAILED = 'IMPORT_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',
  SEMANTIC_VALIDATION_ERROR = 'SEMANTIC_VALIDATION_ERROR',

  // File access errors
  FILE_ACCESS_ERROR = 'FILE_ACCESS_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Source errors
  SOURCE_ERROR = 'SOURCE_ERROR',
  SOURCE_UNAVAILABLE = 'SOURCE_UNAVAILABLE',
  SOURCE_TIMEOUT = 'SOURCE_TIMEOUT',

  // Migration errors
  MIGRATION_ERROR = 'MIGRATION_ERROR',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
  MIGRATION_FAILED = 'MIGRATION_FAILED',

  // Hot reload errors
  HOT_RELOAD_ERROR = 'HOT_RELOAD_ERROR',
  WATCH_ERROR = 'WATCH_ERROR',
  ROLLBACK_ERROR = 'ROLLBACK_ERROR',

  // Parsing errors
  PARSING_ERROR = 'PARSING_ERROR',
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
  INVALID_JSON = 'INVALID_JSON',
}

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
  path: string;
  message: string;
  code: string;
  value?: unknown;
  constraint?: string;
  suggestion?: string;
}

/**
 * Batch validation error for multiple validation issues
 */
export class BatchValidationError extends ConfigurationError {
  public readonly errors: ValidationErrorDetail[];

  constructor(errors: ValidationErrorDetail[]) {
    const message = `Validation failed with ${errors.length} error(s)`;
    super(message, ConfigurationErrorCode.VALIDATION_ERROR, {
      suggestions: [
        'Fix individual validation errors',
        'Check configuration format',
      ],
    });
    this.name = 'BatchValidationError';
    this.errors = errors;
  }

  /**
   * Add a validation error
   */
  addError(error: ValidationErrorDetail): void {
    this.errors.push(error);
    this.message = `Validation failed with ${this.errors.length} error(s)`;
  }

  /**
   * Get errors by path
   */
  getErrorsByPath(path: string): ValidationErrorDetail[] {
    return this.errors.filter((error) => error.path === path);
  }

  /**
   * Get errors by code
   */
  getErrorsByCode(code: string): ValidationErrorDetail[] {
    return this.errors.filter((error) => error.code === code);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Format all errors for display
   */
  override toUserString(): string {
    let result = super.toUserString();

    if (this.errors.length > 0) {
      result += '\n\nValidation Errors:';
      this.errors.forEach((error, index) => {
        result += `\n  ${index + 1}. ${error.path}: ${error.message}`;
        if (error.suggestion) {
          result += `\n     Suggestion: ${error.suggestion}`;
        }
      });
    }

    return result;
  }
}

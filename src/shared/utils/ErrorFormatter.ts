import type { ServiceError } from '../errors/ServiceError';
import { ErrorType } from '../errors/ErrorTypes';

export interface FormattingOptions {
  includeStack?: boolean;
  includeContext?: boolean;
  includeTimestamp?: boolean;
  includeOperation?: boolean;
  userFriendly?: boolean;
  compact?: boolean;
  locale?: string;
  maxContextDepth?: number;
  sanitize?: boolean;
}

export interface FormattedError {
  type: string;
  code: string;
  message: string;
  timestamp?: number;
  operation?: string;
  context?: any;
  stack?: string;
  retryable?: boolean;
  retryAfter?: number;
  userMessage?: string;
  suggestions?: string[];
}

/**
 * Error formatter for converting errors to various output formats.
 * Provides consistent error presentation across different contexts and users.
 */
export class ErrorFormatter {
  private static readonly DEFAULT_OPTIONS: FormattingOptions = {
    includeStack: false,
    includeContext: true,
    includeTimestamp: true,
    includeOperation: true,
    userFriendly: false,
    compact: false,
    maxContextDepth: 3,
    sanitize: true,
  };

  /**
   * Format error for API responses
   */
  static forAPI(
    error: ServiceError,
    options: Partial<FormattingOptions> = {},
  ): FormattedError {
    const _opts = { ...this.DEFAULT_OPTIONS, ...options };

    return {
      type: error.type,
      code: error.code,
      message: error.message,
      timestamp: _opts.includeTimestamp ? error.timestamp : undefined,
      operation: _opts.includeOperation ? error.operation : undefined,
      context: _opts.includeContext
        ? this.sanitizeContext(error.context, _opts)
        : undefined,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
    };
  }

  /**
   * Format error for user display
   */
  static forUser(
    error: ServiceError,
    options: Partial<FormattingOptions> = {},
  ): FormattedError {
    const opts = { ...this.DEFAULT_OPTIONS, userFriendly: true, ...options };

    return {
      type: error.type,
      code: error.code,
      message: error.message,
      userMessage: this.generateUserMessage(error),
      suggestions: this.generateSuggestions(error),
      timestamp: opts.includeTimestamp ? error.timestamp : undefined,
      operation: opts.includeOperation ? error.operation : undefined,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
    };
  }

  /**
   * Format error for logging
   */
  static forLogging(
    error: ServiceError,
    options: Partial<FormattingOptions> = {},
  ): FormattedError {
    const opts = {
      ...this.DEFAULT_OPTIONS,
      includeStack: true,
      includeContext: true,
      ...options,
    };

    return {
      type: error.type,
      code: error.code,
      message: error.message,
      timestamp: opts.includeTimestamp ? error.timestamp : undefined,
      operation: opts.includeOperation ? error.operation : undefined,
      context: opts.includeContext
        ? this.sanitizeContext(error.context, opts)
        : undefined,
      stack: opts.includeStack ? error.stack : undefined,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
    };
  }

  /**
   * Format error for debugging
   */
  static forDebug(
    error: ServiceError,
    _options: Partial<FormattingOptions> = {},
  ): FormattedError {
    return {
      type: error.type,
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      operation: error.operation,
      context: error.context,
      stack: error.stack,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
      userMessage: this.generateUserMessage(error),
      suggestions: this.generateSuggestions(error),
    };
  }

  /**
   * Format error as JSON string
   */
  static toJSON(
    error: ServiceError,
    options: Partial<FormattingOptions> = {},
  ): string {
    const formatted = this.forAPI(error, options);
    return JSON.stringify(formatted, null, options.compact ? 0 : 2);
  }

  /**
   * Format error as compact string
   */
  static toCompactString(error: ServiceError): string {
    return `[${error.type}:${error.code}] ${error.message}${error.operation ? ` (${error.operation})` : ''}`;
  }

  /**
   * Format error as detailed string
   */
  static toDetailedString(
    error: ServiceError,
    options: Partial<FormattingOptions> = {},
  ): string {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let result = '';

    // Basic error info
    result += `Error Type: ${error.type}\n`;
    result += `Error Code: ${error.code}\n`;
    result += `Message: ${error.message}\n`;

    if (opts.includeTimestamp) {
      result += `Timestamp: ${new Date(error.timestamp).toISOString()}\n`;
    }

    if (opts.includeOperation && error.operation) {
      result += `Operation: ${error.operation}\n`;
    }

    if (error.retryable) {
      result += `Retryable: Yes\n`;
      if (error.retryAfter) {
        result += `Retry After: ${error.retryAfter}ms\n`;
      }
    } else {
      result += `Retryable: No\n`;
    }

    // Context information
    if (opts.includeContext && error.context) {
      result += `Context:\n${this.formatContext(error.context, opts)}`;
    }

    // Stack trace
    if (opts.includeStack && error.stack) {
      result += `Stack Trace:\n${error.stack}\n`;
    }

    // User-friendly information
    if (opts.userFriendly) {
      const userMessage = this.generateUserMessage(error);
      if (userMessage) {
        result += `User Message: ${userMessage}\n`;
      }

      const suggestions = this.generateSuggestions(error);
      if (suggestions.length > 0) {
        result += `Suggestions:\n`;
        suggestions.forEach((suggestion, index) => {
          result += `  ${index + 1}. ${suggestion}\n`;
        });
      }
    }

    return result;
  }

  /**
   * Format error for MCP response
   */
  static forMCP(
    error: ServiceError,
    options: Partial<FormattingOptions> = {},
  ): any {
    const formatted = this.forAPI(error, options);

    return {
      error: {
        type: formatted.type,
        code: formatted.code,
        message: formatted.message,
        details: formatted.context,
        timestamp: formatted.timestamp,
        operation: formatted.operation,
      },
      retryable: formatted.retryable,
      retryAfter: formatted.retryAfter,
    };
  }

  /**
   * Format multiple errors
   */
  static formatMultiple(
    errors: ServiceError[],
    options: Partial<FormattingOptions> = {},
  ): Array<FormattedError> {
    return errors.map(error => this.forAPI(error, options));
  }

  /**
   * Generate user-friendly message
   */
  private static generateUserMessage(error: ServiceError): string {
    // Use the built-in user string if available
    if (typeof error.toUserString === 'function') {
      return error.toUserString();
    }

    // Generate based on error type
    switch (error.type) {
      case ErrorType.VALIDATION:
        return `The input provided is not valid. Please check your data and try again.`;

      case ErrorType.PARSING:
        return `There was an error processing the data. The format may be incorrect.`;

      case ErrorType.FILESYSTEM:
        return `A file system error occurred. Please check file permissions and paths.`;

      case ErrorType.TIMEOUT:
        return `The operation took too long to complete. Please try again.`;

      case ErrorType.NETWORK:
        return `A network error occurred. Please check your connection and try again.`;

      case ErrorType.RESOURCE:
        return `System resources are insufficient. Please wait and try again.`;

      default:
        return `An error occurred. Please try again or contact support if the problem persists.`;
    }
  }

  /**
   * Generate suggestions for error resolution
   */
  private static generateSuggestions(error: ServiceError): string[] {
    const suggestions: string[] = [];

    // General retryable suggestion
    if (error.retryable) {
      suggestions.push('Try the operation again');

      if (error.retryAfter && error.retryAfter > 1000) {
        suggestions.push(
          `Wait ${Math.ceil(error.retryAfter / 1000)} seconds before retrying`,
        );
      }
    }

    // Type-specific suggestions
    switch (error.type) {
      case ErrorType.VALIDATION:
        suggestions.push('Check that all required fields are provided');
        suggestions.push('Verify that field formats are correct');
        break;

      case ErrorType.PARSING:
        suggestions.push('Check file syntax and encoding');
        suggestions.push('Ensure the file format is supported');
        break;

      case ErrorType.FILESYSTEM:
        suggestions.push('Check file permissions');
        suggestions.push('Verify file paths exist');
        suggestions.push('Ensure sufficient disk space');
        break;

      case ErrorType.TIMEOUT:
        suggestions.push('Try with a longer timeout');
        suggestions.push('Check if the operation is stuck');
        break;

      case ErrorType.NETWORK:
        suggestions.push('Check network connection');
        suggestions.push('Verify firewall settings');
        suggestions.push('Try a different network');
        break;

      case ErrorType.RESOURCE:
        suggestions.push('Close other applications');
        suggestions.push('Wait for system resources to free up');
        break;

      default:
        suggestions.push('Try the operation again');
        suggestions.push('Contact support if the problem persists');
        break;
    }

    return suggestions;
  }

  /**
   * Validate object key to prevent prototype pollution
   */
  private static isValidKey(key: string): boolean {
    // Prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return false;
    }

    // Only allow string keys that don't start with __
    if (typeof key !== 'string' || key.startsWith('__')) {
      return false;
    }

    // Additional validation: only allow alphanumeric, underscore, and hyphen
    return /^[\w-]+$/.test(key);
  }

  /**
   * Sanitize context for security
   */
  private static sanitizeContext(
    context: any,
    options: FormattingOptions,
  ): any {
    if (!context || !options.sanitize) {
      return context;
    }

    const maxDepth = options.maxContextDepth ?? 3;

    const sanitizeValue = (value: any, depth: number = 0): any => {
      if (depth >= maxDepth) {
        return '[Max depth reached]';
      }

      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value === 'string') {
        // Sanitize sensitive information
        if (
          value.toLowerCase().includes('password') ||
          value.toLowerCase().includes('token') ||
          value.toLowerCase().includes('secret') ||
          value.toLowerCase().includes('key')
        ) {
          return '[REDACTED]';
        }
        return value;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
      }

      if (Array.isArray(value)) {
        return value.map(item => sanitizeValue(item, depth + 1));
      }

      if (typeof value === 'object') {
        const entries: [string, any][] = [];
        for (const [key, val] of Object.entries(value)) {
          // Validate key to prevent prototype pollution
          if (!this.isValidKey(key)) {
            continue; // Skip invalid keys
          }

          // Redact sensitive keys
          if (
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('key')
          ) {
            entries.push([key, '[REDACTED]']);
          } else {
            entries.push([key, sanitizeValue(val, depth + 1)]);
          }
        }
        return Object.fromEntries(entries);
      }

      return '[Unsupported type]';
    };

    return sanitizeValue(context);
  }

  /**
   * Format context for display
   */
  private static formatContext(
    context: any,
    _options: FormattingOptions,
  ): string {
    if (!context) {
      return '  No context available\n';
    }

    const indent = '  ';

    const formatValue = (value: any, depth: number = 1): string => {
      const currentIndent = indent.repeat(depth);

      if (value === null || value === undefined) {
        return `${currentIndent}${value}\n`;
      }

      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        return `${currentIndent}${value}\n`;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          return `${currentIndent}[]\n`;
        }

        let arrayResult = `${currentIndent}[\n`;
        value.forEach(item => {
          arrayResult += formatValue(item, depth + 1);
        });
        arrayResult += `${currentIndent}]\n`;
        return arrayResult;
      }

      if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) {
          return `${currentIndent}{}\n`;
        }

        let objectResult = `${currentIndent}{\n`;
        entries.forEach(([key, val]) => {
          objectResult += `${currentIndent}  ${key}: `;
          if (typeof val === 'object' && val !== null) {
            objectResult += '\n' + formatValue(val, depth + 2);
          } else {
            objectResult += `${val}\n`;
          }
        });
        objectResult += `${currentIndent}}\n`;
        return objectResult;
      }

      return `${currentIndent}${value}\n`;
    };

    return formatValue(context);
  }

  /**
   * Create formatter with custom defaults
   */
  static create(_customDefaults: Partial<FormattingOptions>): {
    forAPI: (
      error: ServiceError,
      options?: Partial<FormattingOptions>,
    ) => FormattedError;
    forUser: (
      error: ServiceError,
      options?: Partial<FormattingOptions>,
    ) => FormattedError;
    forLogging: (
      error: ServiceError,
      options?: Partial<FormattingOptions>,
    ) => FormattedError;
    forDebug: (
      error: ServiceError,
      options?: Partial<FormattingOptions>,
    ) => FormattedError;
    toJSON: (
      error: ServiceError,
      options?: Partial<FormattingOptions>,
    ) => string;
    toCompactString: (error: ServiceError) => string;
    toDetailedString: (
      error: ServiceError,
      options?: Partial<FormattingOptions>,
    ) => string;
    forMCP: (error: ServiceError, options?: Partial<FormattingOptions>) => any;
    formatMultiple: (
      errors: ServiceError[],
      options?: Partial<FormattingOptions>,
    ) => Array<FormattedError>;
  } {
    return {
      forAPI: (error: ServiceError, options?: Partial<FormattingOptions>) =>
        ErrorFormatter.forAPI(error, { ..._customDefaults, ...options }),
      forUser: (error: ServiceError, options?: Partial<FormattingOptions>) =>
        ErrorFormatter.forUser(error, { ..._customDefaults, ...options }),
      forLogging: (error: ServiceError, options?: Partial<FormattingOptions>) =>
        ErrorFormatter.forLogging(error, { ..._customDefaults, ...options }),
      forDebug: (error: ServiceError, options?: Partial<FormattingOptions>) =>
        ErrorFormatter.forDebug(error, { ..._customDefaults, ...options }),
      toJSON: (error: ServiceError, options?: Partial<FormattingOptions>) =>
        ErrorFormatter.toJSON(error, { ..._customDefaults, ...options }),
      toCompactString: ErrorFormatter.toCompactString,
      toDetailedString: (
        error: ServiceError,
        options?: Partial<FormattingOptions>,
      ) =>
        ErrorFormatter.toDetailedString(error, {
          ..._customDefaults,
          ...options,
        }),
      forMCP: (error: ServiceError, options?: Partial<FormattingOptions>) =>
        ErrorFormatter.forMCP(error, { ..._customDefaults, ...options }),
      formatMultiple: (
        errors: ServiceError[],
        options?: Partial<FormattingOptions>,
      ) =>
        ErrorFormatter.formatMultiple(errors, {
          ..._customDefaults,
          ...options,
        }),
    };
  }
}

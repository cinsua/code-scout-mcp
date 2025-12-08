import {
  ServiceError,
  type ServiceErrorOptions,
} from '@/shared/errors/ServiceError';
import { ErrorType, ParsingErrorCodes } from '@/shared/errors/ErrorTypes';

export interface ParsingErrorContext {
  filePath?: string;
  line?: number;
  column?: number;
  position?: number;
  source?: string;
  format?: string;
  encoding?: string;
  token?: string;
  expected?: string;
}

export interface ParsingErrorOptions extends ServiceErrorOptions {
  context?: ParsingErrorContext;
}

/**
 * Error thrown when file parsing fails.
 * Provides detailed information about parsing failures including
 * line/column numbers, expected tokens, and format information.
 */
export class ParsingError extends ServiceError {
  public override readonly context?: ParsingErrorContext;

  constructor(
    code: ParsingErrorCodes,
    message: string,
    options: ParsingErrorOptions = {},
  ) {
    super(ErrorType.PARSING, code, message, {
      ...options,
      retryable: false, // Parsing errors are not retryable
    });

    this.context = options.context;
  }

  /**
   * Create a parsing error for syntax errors
   */
  static syntaxError(
    message: string,
    filePath?: string,
    line?: number,
    column?: number,
  ): ParsingError {
    return new ParsingError(
      ParsingErrorCodes.SYNTAX_ERROR,
      `Syntax error${filePath ? ` in ${filePath}` : ''}${line !== undefined ? ` at line ${line}` : ''}${column !== undefined ? `:${column}` : ''}: ${message}`,
      {
        context: {
          filePath,
          line,
          column,
        },
      },
    );
  }

  /**
   * Create a parsing error for invalid JSON
   */
  static invalidJSON(
    message: string,
    filePath?: string,
    position?: number,
  ): ParsingError {
    return new ParsingError(
      ParsingErrorCodes.INVALID_JSON,
      `Invalid JSON${filePath ? ` in ${filePath}` : ''}${position !== undefined ? ` at position ${position}` : ''}: ${message}`,
      {
        context: {
          filePath,
          position,
          format: 'json',
        },
      },
    );
  }

  /**
   * Create a parsing error for invalid YAML
   */
  static invalidYAML(
    message: string,
    filePath?: string,
    line?: number,
  ): ParsingError {
    return new ParsingError(
      ParsingErrorCodes.INVALID_YAML,
      `Invalid YAML${filePath ? ` in ${filePath}` : ''}${line !== undefined ? ` at line ${line}` : ''}: ${message}`,
      {
        context: {
          filePath,
          line,
          format: 'yaml',
        },
      },
    );
  }

  /**
   * Create a parsing error for invalid XML
   */
  static invalidXML(
    message: string,
    filePath?: string,
    line?: number,
    column?: number,
  ): ParsingError {
    return new ParsingError(
      ParsingErrorCodes.INVALID_XML,
      `Invalid XML${filePath ? ` in ${filePath}` : ''}${line !== undefined ? ` at line ${line}` : ''}${column !== undefined ? `:${column}` : ''}: ${message}`,
      {
        context: {
          filePath,
          line,
          column,
          format: 'xml',
        },
      },
    );
  }

  /**
   * Create a parsing error for encoding issues
   */
  static encodingError(encoding: string, filePath?: string): ParsingError {
    return new ParsingError(
      ParsingErrorCodes.ENCODING_ERROR,
      `Encoding error${filePath ? ` in ${filePath}` : ''}: Unable to decode with ${encoding}`,
      {
        context: {
          filePath,
          encoding,
        },
      },
    );
  }

  /**
   * Create a parsing error for unexpected tokens
   */
  static unexpectedToken(
    token: string,
    expected: string,
    filePath?: string,
    line?: number,
    column?: number,
  ): ParsingError {
    return new ParsingError(
      ParsingErrorCodes.UNEXPECTED_TOKEN,
      `Unexpected token '${token}'${filePath ? ` in ${filePath}` : ''}${line !== undefined ? ` at line ${line}` : ''}${column !== undefined ? `:${column}` : ''}. Expected ${expected}`,
      {
        context: {
          filePath,
          line,
          column,
          token,
          expected,
        },
      },
    );
  }

  /**
   * Create a parsing error for malformed data
   */
  static malformedData(
    message: string,
    filePath?: string,
    source?: string,
  ): ParsingError {
    return new ParsingError(
      ParsingErrorCodes.MALFORMED_DATA,
      `Malformed data${filePath ? ` in ${filePath}` : ''}: ${message}`,
      {
        context: {
          filePath,
          source,
        },
      },
    );
  }

  /**
   * Create a parsing error when parser is not found
   */
  static parserNotFound(format: string, filePath?: string): ParsingError {
    return new ParsingError(
      ParsingErrorCodes.PARSER_NOT_FOUND,
      `Parser not found for format '${format}'${filePath ? ` (file: ${filePath})` : ''}`,
      {
        context: {
          filePath,
          format,
        },
      },
    );
  }

  /**
   * Get the file path where the parsing error occurred
   */
  public getFilePath(): string | undefined {
    return this.context?.filePath;
  }

  /**
   * Get the line number of the parsing error
   */
  public getLine(): number | undefined {
    return this.context?.line;
  }

  /**
   * Get the column number of the parsing error
   */
  public getColumn(): number | undefined {
    return this.context?.column;
  }

  /**
   * Get the position in the file where the error occurred
   */
  public getPosition(): number | undefined {
    return this.context?.position;
  }

  /**
   * Get the format being parsed
   */
  public getFormat(): string | undefined {
    return this.context?.format;
  }

  /**
   * Get the encoding used for parsing
   */
  public getEncoding(): string | undefined {
    return this.context?.encoding;
  }

  /**
   * Get the unexpected token that caused the error
   */
  public getToken(): string | undefined {
    return this.context?.token;
  }

  /**
   * Get what was expected instead of the unexpected token
   */
  public getExpected(): string | undefined {
    return this.context?.expected;
  }

  /**
   * Check if this error is related to a specific file
   */
  public isFileError(filePath: string): boolean {
    return this.context?.filePath === filePath;
  }

  /**
   * Check if this error is related to a specific format
   */
  public isFormatError(format: string): boolean {
    return this.context?.format === format;
  }

  /**
   * Get a formatted location string (line:column)
   */
  public getLocation(): string {
    if (this.context?.line !== undefined) {
      const column =
        this.context.column !== undefined ? `:${this.context.column}` : '';
      return `${this.context.line}${column}`;
    }
    return '';
  }

  /**
   * Convert to user-friendly string with location information
   */
  public override toUserString(): string {
    let result = super.toUserString();

    const location = this.getLocation();
    if (location) {
      result += `\n  Location: ${location}`;
    }

    if (this.context?.filePath) {
      result += `\n  File: ${this.context.filePath}`;
    }

    if (this.context?.format) {
      result += `\n  Format: ${this.context.format}`;
    }

    if (this.context?.token) {
      result += `\n  Unexpected token: ${this.context.token}`;
    }

    if (this.context?.expected) {
      result += `\n  Expected: ${this.context.expected}`;
    }

    return result;
  }
}

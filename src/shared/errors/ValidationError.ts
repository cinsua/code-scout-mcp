import { ServiceError, type ServiceErrorOptions } from './ServiceError';
import { ErrorType, ValidationErrorCodes } from './ErrorTypes';

export interface ValidationErrorContext {
  field?: string;
  value?: any;
  expectedType?: string;
  constraints?: Record<string, any>;
  schema?: string;
  path?: string;
}

export interface ValidationErrorOptions extends ServiceErrorOptions {
  context?: ValidationErrorContext;
}

/**
 * Error thrown when input validation fails.
 * Provides detailed information about validation failures including
 * field names, expected values, and constraint violations.
 */
export class ValidationError extends ServiceError {
  public override readonly context?: ValidationErrorContext;

  constructor(
    code: ValidationErrorCodes,
    message: string,
    options: ValidationErrorOptions = {},
  ) {
    super(ErrorType.VALIDATION, code, message, {
      ...options,
      retryable: false, // Validation errors are not retryable
    });

    this.context = options.context;
  }

  /**
   * Create a validation error for invalid input
   */
  static invalidInput(
    input: any,
    expectedType?: string,
    field?: string,
  ): ValidationError {
    return new ValidationError(
      ValidationErrorCodes.INVALID_INPUT,
      `Invalid input${field ? ` for field '${field}'` : ''}${expectedType ? `. Expected ${expectedType}` : ''}`,
      {
        context: {
          field,
          value: input,
          expectedType,
        },
      },
    );
  }

  /**
   * Create a validation error for missing required field
   */
  static missingRequiredField(field: string, path?: string): ValidationError {
    return new ValidationError(
      ValidationErrorCodes.MISSING_REQUIRED_FIELD,
      `Required field '${field}' is missing${path ? ` in ${path}` : ''}`,
      {
        context: {
          field,
          path,
        },
      },
    );
  }

  /**
   * Create a validation error for invalid format
   */
  static invalidFormat(
    field: string,
    value: any,
    expectedFormat: string,
  ): ValidationError {
    return new ValidationError(
      ValidationErrorCodes.INVALID_FORMAT,
      `Field '${field}' has invalid format. Expected ${expectedFormat}`,
      {
        context: {
          field,
          value,
          expectedType: expectedFormat,
        },
      },
    );
  }

  /**
   * Create a validation error for out of range values
   */
  static outOfRange(
    field: string,
    value: number,
    min?: number,
    max?: number,
  ): ValidationError {
    const range =
      min !== undefined && max !== undefined
        ? `between ${min} and ${max}`
        : min !== undefined
          ? `greater than or equal to ${min}`
          : `less than or equal to ${max}`;

    return new ValidationError(
      ValidationErrorCodes.OUT_OF_RANGE,
      `Field '${field}' value ${value} is out of range. Expected ${range}`,
      {
        context: {
          field,
          value,
          constraints: { min, max },
        },
      },
    );
  }

  /**
   * Create a validation error for invalid type
   */
  static invalidType(
    field: string,
    value: any,
    expectedType: string,
  ): ValidationError {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    return new ValidationError(
      ValidationErrorCodes.INVALID_TYPE,
      `Field '${field}' has invalid type. Expected ${expectedType}, got ${actualType}`,
      {
        context: {
          field,
          value,
          expectedType,
        },
      },
    );
  }

  /**
   * Create a validation error for constraint violation
   */
  static constraintViolation(
    field: string,
    constraint: string,
    value?: any,
  ): ValidationError {
    return new ValidationError(
      ValidationErrorCodes.CONSTRAINT_VIOLATION,
      `Field '${field}' violates constraint: ${constraint}`,
      {
        context: {
          field,
          value,
          constraints: { violation: constraint },
        },
      },
    );
  }

  /**
   * Create a validation error for invalid schema
   */
  static invalidSchema(
    schema: string,
    reason: string,
    path?: string,
  ): ValidationError {
    return new ValidationError(
      ValidationErrorCodes.INVALID_SCHEMA,
      `Invalid schema '${schema}': ${reason}`,
      {
        context: {
          schema,
          path,
        },
      },
    );
  }

  /**
   * Create a validation error for general validation failure
   */
  static validationFailed(
    reason: string,
    field?: string,
    value?: any,
  ): ValidationError {
    return new ValidationError(
      ValidationErrorCodes.VALIDATION_FAILED,
      `Validation failed${field ? ` for field '${field}'` : ''}: ${reason}`,
      {
        context: {
          field,
          value,
        },
      },
    );
  }

  /**
   * Get the field name that caused the validation error
   */
  public getField(): string | undefined {
    return this.context?.field;
  }

  /**
   * Get the invalid value that caused the validation error
   */
  public getValue(): any {
    return this.context?.value;
  }

  /**
   * Get the expected type for the field
   */
  public getExpectedType(): string | undefined {
    return this.context?.expectedType;
  }

  /**
   * Get validation constraints
   */
  public getConstraints(): Record<string, any> | undefined {
    return this.context?.constraints;
  }

  /**
   * Get the schema path where the error occurred
   */
  public getPath(): string | undefined {
    return this.context?.path;
  }

  /**
   * Check if this error is related to a specific field
   */
  public isFieldError(field: string): boolean {
    return this.context?.field === field;
  }

  /**
   * Check if this error is related to a specific path
   */
  public isPathError(path: string): boolean {
    return this.context?.path === path;
  }

  /**
   * Convert to user-friendly string with field-specific information
   */
  public override toUserString(): string {
    let result = super.toUserString();

    if (this.context?.field) {
      result += `\n  Field: ${this.context.field}`;
    }

    if (this.context?.expectedType) {
      result += `\n  Expected type: ${this.context.expectedType}`;
    }

    if (this.context?.constraints) {
      result += `\n  Constraints: ${JSON.stringify(this.context.constraints)}`;
    }

    if (this.context?.path) {
      result += `\n  Path: ${this.context.path}`;
    }

    return result;
  }
}

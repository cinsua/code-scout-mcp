/**
 * JSON Schema Validator
 *
 * This module provides JSON Schema validation for configuration objects
 * using the AJV library for high-performance validation.
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  PartialAppConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types/ConfigTypes';
import configSchema from '../schema/config-schema.json';

/**
 * Schema validator options
 */
export interface SchemaValidatorOptions {
  /**
   * Whether to allow additional properties not in schema
   */
  allowAdditionalProperties?: boolean;

  /**
   * Whether to remove additional properties
   */
  removeAdditional?: boolean;

  /**
   * Whether to coerce types automatically
   */
  coerceTypes?: boolean;

  /**
   * Whether to use default values from schema
   */
  useDefaults?: boolean;

  /**
   * Whether to validate all rules (collect all errors)
   */
  allErrors?: boolean;

  /**
   * Whether to be strict about types
   */
  strict?: boolean;
}

/**
 * Schema validation result with detailed error information
 */
export interface SchemaValidationResult extends ValidationResult {
  /**
   * AJV validation errors
   */
  ajvErrors?: ErrorObject[];

  /**
   * Validated and potentially modified configuration
   */
  validatedConfig?: PartialAppConfig;
}

/**
 * JSON Schema Validator class
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validateFunction: ValidateFunction;
  private options: Required<SchemaValidatorOptions>;

  constructor(options: SchemaValidatorOptions = {}) {
    this.options = {
      allowAdditionalProperties: options.allowAdditionalProperties ?? false,
      removeAdditional: options.removeAdditional ?? false,
      coerceTypes: options.coerceTypes ?? false,
      useDefaults: options.useDefaults ?? true,
      allErrors: options.allErrors ?? true,
      strict: options.strict ?? true,
    };

    // Initialize AJV with options
    this.ajv = new Ajv({
      allErrors: this.options.allErrors,
      coerceTypes: this.options.coerceTypes,
      removeAdditional: this.options.removeAdditional,
      useDefaults: this.options.useDefaults,
      strict: this.options.strict,
      allowUnionTypes: true,
      verbose: true,
    });

    // Add format validation
    addFormats(this.ajv);

    // Compile the validation function
    this.validateFunction = this.ajv.compile(configSchema);
  }

  /**
   * Validate a configuration object against the JSON schema
   *
   * @param config - Configuration to validate
   * @returns SchemaValidationResult
   */
  validate(config: PartialAppConfig): SchemaValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Perform validation
    const isValid = this.validateFunction(config);

    if (!isValid && this.validateFunction.errors) {
      // Convert AJV errors to our ValidationError format
      const validationErrors = this.convertAjvErrors(
        this.validateFunction.errors
      );
      errors.push(...validationErrors);
    }

    // Check for additional properties if not allowed
    if (!this.options.allowAdditionalProperties) {
      const additionalPropsWarnings = this.checkAdditionalProperties(config);
      warnings.push(...additionalPropsWarnings);
    }

    // Perform semantic checks that can't be expressed in JSON schema
    const semanticWarnings = this.performSemanticChecks(config);
    warnings.push(...semanticWarnings);

    return {
      valid: isValid && errors.length === 0,
      errors,
      warnings,
      config: isValid ? config : undefined,
      ajvErrors: this.validateFunction.errors || undefined,
      validatedConfig: config,
    };
  }

  /**
   * Validate a specific section of the configuration
   *
   * @param config - Configuration to validate
   * @param section - Section name to validate
   * @returns SchemaValidationResult
   */
  validateSection(
    config: PartialAppConfig,
    section: keyof PartialAppConfig
  ): SchemaValidationResult {
    if (!config[section]) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        config: {},
      };
    }

    // Create a partial config with only the section to validate
    const sectionConfig = { [section]: config[section] } as PartialAppConfig;

    return this.validate(sectionConfig);
  }

  /**
   * Validate configuration with partial loading support
   *
   * @param config - Configuration to validate
   * @returns SchemaValidationResult with valid sections extracted
   */
  validateWithPartialLoading(config: PartialAppConfig): SchemaValidationResult {
    const result = this.validate(config);

    if (result.valid) {
      return result;
    }

    // Try to extract valid sections
    const validSections: PartialAppConfig = {};
    const sectionErrors: ValidationError[] = [];

    for (const [sectionName, sectionValue] of Object.entries(config)) {
      if (sectionValue === undefined || sectionValue === null) {
        continue;
      }

      try {
        const sectionResult = this.validateSection(
          config,
          sectionName as keyof PartialAppConfig
        );

        if (sectionResult.valid) {
          (validSections as any)[sectionName] = sectionValue;
        } else {
          sectionErrors.push(...sectionResult.errors);
        }
      } catch (error) {
        sectionErrors.push({
          path: sectionName,
          message: `Failed to validate section: ${error instanceof Error ? error.message : String(error)}`,
          code: 'SECTION_VALIDATION_ERROR',
        });
      }
    }

    return {
      valid: sectionErrors.length === 0,
      errors: sectionErrors,
      warnings: result.warnings,
      config: validSections,
      ajvErrors: result.ajvErrors,
      validatedConfig: validSections,
    };
  }

  /**
   * Convert AJV errors to ValidationError format
   *
   * @param ajvErrors - AJV error objects
   * @returns Array of ValidationError objects
   */
  private convertAjvErrors(ajvErrors: ErrorObject[]): ValidationError[] {
    return ajvErrors.map((error): ValidationError => {
      const path = error.instancePath || error.schemaPath || 'unknown';
      const message = this.formatErrorMessage(error);
      const code = this.getErrorCode(error);
      const suggestion = this.getSuggestion(error);

      return {
        path,
        message,
        code,
        suggestion,
      };
    });
  }

  /**
   * Format AJV error message for better readability
   *
   * @param error - AJV error object
   * @returns Formatted error message
   */
  private formatErrorMessage(error: ErrorObject): string {
    const { instancePath, keyword, message, params } = error;

    // Get the property name from the path
    const propertyName = instancePath.split('/').pop() || 'property';

    switch (keyword) {
      case 'type':
        return `${propertyName} must be of type ${params.type}`;

      case 'required':
        return `Missing required property: ${params.missingProperty}`;

      case 'minimum':
        return `${propertyName} must be >= ${params.limit}`;

      case 'maximum':
        return `${propertyName} must be <= ${params.limit}`;

      case 'minLength':
        return `${propertyName} must be at least ${params.limit} characters long`;

      case 'maxLength':
        return `${propertyName} must be at most ${params.limit} characters long`;

      case 'pattern':
        return `${propertyName} does not match required pattern`;

      case 'enum':
        return `${propertyName} must be one of: ${params.allowedValues?.join(', ')}`;

      case 'format':
        return `${propertyName} must be a valid ${params.format}`;

      case 'additionalProperties':
        return `Additional property not allowed: ${params.additionalProperty}`;

      default:
        return message || `Validation error at ${instancePath}`;
    }
  }

  /**
   * Get error code for AJV error
   *
   * @param error - AJV error object
   * @returns Error code string
   */
  private getErrorCode(error: ErrorObject): string {
    const { keyword } = error;

    switch (keyword) {
      case 'type':
        return 'INVALID_TYPE';
      case 'required':
        return 'MISSING_REQUIRED';
      case 'minimum':
        return 'VALUE_TOO_SMALL';
      case 'maximum':
        return 'VALUE_TOO_LARGE';
      case 'minLength':
        return 'STRING_TOO_SHORT';
      case 'maxLength':
        return 'STRING_TOO_LONG';
      case 'pattern':
        return 'PATTERN_MISMATCH';
      case 'enum':
        return 'INVALID_ENUM_VALUE';
      case 'format':
        return 'INVALID_FORMAT';
      case 'additionalProperties':
        return 'ADDITIONAL_PROPERTY';
      default:
        return 'VALIDATION_ERROR';
    }
  }

  /**
   * Get suggestion for fixing the error
   *
   * @param error - AJV error object
   * @returns Suggestion string or undefined
   */
  private getSuggestion(error: ErrorObject): string | undefined {
    const { keyword, params } = error;

    switch (keyword) {
      case 'type':
        return `Change the value to a ${params.type}`;

      case 'required':
        return `Add the missing property: ${params.missingProperty}`;

      case 'minimum':
        return `Increase the value to at least ${params.limit}`;

      case 'maximum':
        return `Decrease the value to at most ${params.limit}`;

      case 'minLength':
        return `Add at least ${params.limit - (params.data?.length || 0)} more characters`;

      case 'maxLength':
        return `Remove at least ${(params.data?.length || 0) - params.limit} characters`;

      case 'pattern':
        return `Ensure the value matches the required pattern`;

      case 'enum':
        return `Use one of the allowed values: ${params.allowedValues?.join(', ')}`;

      case 'format':
        return `Provide a valid ${params.format} format`;

      case 'additionalProperties':
        return `Remove the additional property or add it to the schema`;

      default:
        return undefined;
    }
  }

  /**
   * Check for additional properties not in schema
   *
   * @param config - Configuration to check
   * @returns Array of validation warnings
   */
  private checkAdditionalProperties(
    config: PartialAppConfig
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // This is a simplified check - in practice, you'd want to compare
    // against the actual schema properties
    const knownProperties = [
      'version',
      'profile',
      'indexing',
      'search',
      'database',
      'watching',
      'languages',
      'logging',
      'security',
    ];

    for (const propName of Object.keys(config)) {
      if (!knownProperties.includes(propName)) {
        warnings.push({
          path: propName,
          message: `Unknown configuration property: ${propName}`,
          code: 'UNKNOWN_PROPERTY',
        });
      }
    }

    return warnings;
  }

  /**
   * Perform semantic checks that can't be expressed in JSON schema
   *
   * @param config - Configuration to check
   * @returns Array of validation warnings
   */
  private performSemanticChecks(config: PartialAppConfig): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for logical inconsistencies
    if (config.search) {
      if (config.search.defaultLimit && config.search.maxLimit) {
        if (config.search.defaultLimit > config.search.maxLimit) {
          warnings.push({
            path: 'search.defaultLimit',
            message: 'defaultLimit should not be greater than maxLimit',
            code: 'ILLOGICAL_LIMITS',
          });
        }
      }
    }

    if (config.indexing) {
      if (config.indexing.maxWorkers && config.indexing.batchSize) {
        if (config.indexing.maxWorkers > config.indexing.batchSize) {
          warnings.push({
            path: 'indexing.maxWorkers',
            message:
              'maxWorkers should not be greater than batchSize for optimal performance',
            code: 'PERFORMANCE_WARNING',
          });
        }
      }
    }

    if (config.database) {
      if (
        config.database.type === 'sqlite' &&
        config.database.connectionString
      ) {
        warnings.push({
          path: 'database.connectionString',
          message: 'connectionString is ignored for SQLite database type',
          code: 'IGNORED_SETTING',
        });
      }
    }

    return warnings;
  }

  /**
   * Get the JSON schema being used for validation
   *
   * @returns JSON schema object
   */
  getSchema(): any {
    return configSchema;
  }

  /**
   * Add a custom format validator
   *
   * @param name - Format name
   * @param format - Format validation function
   */
  addFormat(name: string, format: (data: string) => boolean): void {
    this.ajv.addFormat(name, format);
  }

  /**
   * Add a custom keyword validator
   *
   * @param keyword - Keyword name
   * @param definition - Keyword definition
   */
  addKeyword(keyword: string, definition: any): void {
    this.ajv.addKeyword(keyword, definition);
  }
}

/**
 * Create a default schema validator instance
 *
 * @param options - Validator options
 * @returns SchemaValidator instance
 */
export function createSchemaValidator(
  options?: SchemaValidatorOptions
): SchemaValidator {
  return new SchemaValidator(options);
}

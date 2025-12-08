/**
 * JSON Schema Validator
 *
 * This module provides JSON Schema validation for configuration objects
 * using the AJV library for high-performance validation.
 */

import type { ErrorObject, ValidateFunction, KeywordDefinition } from 'ajv';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { LogManager } from '@/shared/utils/LogManager';
import { ErrorFactory } from '@/shared/errors/ErrorFactory';
import type { ServiceError } from '@/shared/errors/ServiceError';
import type {
  PartialAppConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '@/config/types/ConfigTypes';
import configSchema from '@/config/schema/config-schema.json';

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
  private logger = LogManager.getLogger('SchemaValidator');

  constructor(options: SchemaValidatorOptions = {}) {
    this.options = this.processOptions(options);
    this.ajv = this.createAjvInstance();
    this.validateFunction = this.compileValidationFunction();
  }

  /**
   * Process and normalize validator options
   */
  private processOptions(
    options: SchemaValidatorOptions,
  ): Required<SchemaValidatorOptions> {
    return {
      allowAdditionalProperties: options.allowAdditionalProperties ?? false,
      removeAdditional: options.removeAdditional ?? false,
      coerceTypes: options.coerceTypes ?? false,
      useDefaults: options.useDefaults ?? true,
      allErrors: options.allErrors ?? true,
      strict: options.strict ?? true,
    };
  }

  /**
   * Create and configure AJV instance
   */
  private createAjvInstance(): Ajv {
    const ajv = new Ajv({
      allErrors: this.options.allErrors,
      coerceTypes: this.options.coerceTypes,
      removeAdditional: this.options.removeAdditional,
      useDefaults: this.options.useDefaults,
      strict: this.options.strict,
      allowUnionTypes: true,
      verbose: true,
    });

    addFormats(ajv);
    return ajv;
  }

  /**
   * Compile the validation function
   */
  private compileValidationFunction(): ValidateFunction {
    return this.ajv.compile(configSchema);
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
        this.validateFunction.errors,
      );
      errors.push(...validationErrors);

      // Log validation failures
      this.logger.warn('Schema validation failed', {
        errorCount: validationErrors.length,
        errors: validationErrors.map(e => ({
          path: e.path,
          code: e.code,
          message: e.message,
        })),
      });
    }

    // Check for additional properties if not allowed
    if (!this.options.allowAdditionalProperties) {
      const additionalPropsWarnings = this.checkAdditionalProperties(config);
      warnings.push(...additionalPropsWarnings);
    }

    // Perform semantic checks that can't be expressed in JSON schema
    const semanticWarnings = this.performSemanticChecks(config);
    warnings.push(...semanticWarnings);

    // Log warnings if any
    if (warnings.length > 0) {
      this.logger.info('Schema validation completed with warnings', {
        warningCount: warnings.length,
        warnings: warnings.map(w => ({
          path: w.path,
          code: w.code,
          message: w.message,
        })),
      });
    }

    return {
      valid: isValid && errors.length === 0,
      errors,
      warnings,
      config: isValid ? config : undefined,
      ajvErrors: this.validateFunction.errors ?? undefined,
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
    section: keyof PartialAppConfig,
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

    const result = this.validate(sectionConfig);

    // Log section validation failures
    if (!result.valid) {
      this.logger.warn('Section validation failed', {
        section,
        errorCount: result.errors.length,
        errors: result.errors.map(e => ({
          path: e.path,
          code: e.code,
          message: e.message,
        })),
      });
    }

    return result;
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
      try {
        const sectionResult = this.validateSection(
          config,
          sectionName as keyof PartialAppConfig,
        );

        if (sectionResult.valid) {
          (validSections as Record<string, unknown>)[sectionName] =
            sectionValue;
        } else {
          sectionErrors.push(...sectionResult.errors);
        }
      } catch (error) {
        // Log the section validation error
        this.logger.error(
          'Section validation failed',
          error instanceof Error ? error : new Error(String(error)),
          {
            section: sectionName,
          },
        );

        // Use ErrorFactory to create consistent error, migrating any legacy errors
        const serviceError = ErrorFactory.convertToServiceError(
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: 'schema_validation',
            addContext: { section: sectionName },
            preserveOriginal: true,
          },
        );

        // If it's already a ConfigurationError, enhance it; otherwise create one
        if (serviceError.type === 'CONFIGURATION') {
          throw serviceError;
        } else {
          throw ErrorFactory.configuration(
            'SCHEMA_VALIDATION_ERROR',
            `Failed to validate section '${sectionName}': ${serviceError.message}`,
            {
              path: sectionName,
              suggestions: [
                'Check section configuration',
                'Verify schema compatibility',
              ],
            },
          );
        }
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

      // Use the new createValidationError method for consistency
      return this.createValidationError(message, path, code, suggestion);
    });
  }

  /**
   * Create a validation error using ErrorFactory for consistency
   *
   * @param message - Error message
   * @param path - Configuration path
   * @param code - Error code
   * @param suggestion - Optional suggestion
   * @returns ValidationError object
   */
  private createValidationError(
    message: string,
    path: string,
    code: string,
    suggestion?: string,
  ): ValidationError {
    // Use ErrorFactory to create a consistent validation error
    const validationError = ErrorFactory.validation(message, path);

    return {
      path,
      message: validationError.message,
      code,
      suggestion,
    };
  }

  /**
   * Format an AJV error into a user-friendly message
   *
   * @param error - AJV error object
   * @returns Formatted error message
   */
  private formatErrorMessage(error: ErrorObject): string {
    const { instancePath, keyword, message, params } = error;

    // Get the property name from the path
    const propertyName = instancePath.split('/').pop() ?? 'property';

    const messageMap: Record<
      string,
      (prop: string, params: Record<string, unknown>) => string
    > = {
      type: (prop, p) => `${prop} must be of type ${p.type}`,
      required: (_, p) => `Missing required property: ${p.missingProperty}`,
      minimum: (prop, p) => `${prop} must be >= ${p.limit}`,
      maximum: (prop, p) => `${prop} must be <= ${p.limit}`,
      minLength: (prop, p) =>
        `${prop} must be at least ${p.limit} characters long`,
      maxLength: (prop, p) =>
        `${prop} must be at most ${p.limit} characters long`,
      pattern: prop => `${prop} does not match required pattern`,
      enum: (prop, p) =>
        `${prop} must be one of: ${(p.allowedValues as string[]).join(', ')}`,
      format: (prop, p) => `${prop} must be a valid ${p.format}`,
      additionalProperties: (_, p) =>
        `Additional property not allowed: ${p.additionalProperty}`,
    };

    const messageFn = messageMap[keyword];
    return messageFn
      ? messageFn(propertyName, params)
      : (message ?? `Validation error at ${instancePath}`);
  }

  /**
   * Get error code for AJV error
   *
   * @param error - AJV error object
   * @returns Error code string
   */
  private getErrorCode(error: ErrorObject): string {
    const { keyword } = error;

    const errorCodeMap: Record<string, string> = {
      type: 'INVALID_TYPE',
      required: 'MISSING_REQUIRED',
      minimum: 'VALUE_TOO_SMALL',
      maximum: 'VALUE_TOO_LARGE',
      minLength: 'STRING_TOO_SHORT',
      maxLength: 'STRING_TOO_LONG',
      pattern: 'PATTERN_MISMATCH',
      enum: 'INVALID_ENUM_VALUE',
      format: 'INVALID_FORMAT',
      additionalProperties: 'ADDITIONAL_PROPERTY',
    };

    return errorCodeMap[keyword] ?? 'VALIDATION_ERROR';
  }

  /**
   * Generate a suggestion for fixing a validation error
   *
   * @param error - AJV error object
   * @returns Suggestion string or undefined
   */
  private getSuggestion(error: ErrorObject): string | undefined {
    const { keyword, params } = error;

    const suggestionMap: Record<
      string,
      (params: Record<string, unknown>) => string
    > = {
      type: p => `Change the value to a ${p.type}`,
      required: p => `Add the missing property: ${p.missingProperty}`,
      minimum: p => `Increase the value to at least ${p.limit as number}`,
      maximum: p => `Decrease the value to at most ${p.limit as number}`,
      minLength: p =>
        `Add at least ${(p.limit as number) - (typeof p.data === 'string' ? p.data.length : 0)} more characters`,
      maxLength: p =>
        `Remove at least ${(typeof p.data === 'string' ? p.data.length : 0) - (p.limit as number)} characters`,
      pattern: () => `Ensure the value matches the required pattern`,
      enum: p =>
        `Use one of the allowed values: ${(p.allowedValues as string[]).join(', ')}`,
      format: p => `Provide a valid ${p.format} format`,
      additionalProperties: () =>
        `Remove the additional property or add it to the schema`,
    };

    const suggestionFn = suggestionMap[keyword];
    return suggestionFn ? suggestionFn(params) : undefined;
  }

  /**
   * Check for additional properties not in schema
   *
   * @param config - Configuration to check
   * @returns Array of validation warnings
   */
  private checkAdditionalProperties(
    config: PartialAppConfig,
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

    warnings.push(...this.checkSearchLimits(config));
    warnings.push(...this.checkIndexingPerformance(config));
    warnings.push(...this.checkDatabaseSettings(config));

    return warnings;
  }

  private checkSearchLimits(config: PartialAppConfig): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const search = config.search;

    if (search?.defaultLimit && search.maxLimit) {
      if (search.defaultLimit > search.maxLimit) {
        warnings.push({
          path: 'search.defaultLimit',
          message: 'defaultLimit should not be greater than maxLimit',
          code: 'ILLOGICAL_LIMITS',
        });
      }
    }

    return warnings;
  }

  private checkIndexingPerformance(
    config: PartialAppConfig,
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const indexing = config.indexing;

    if (indexing?.maxWorkers && indexing.batchSize) {
      if (indexing.maxWorkers > indexing.batchSize) {
        warnings.push({
          path: 'indexing.maxWorkers',
          message:
            'maxWorkers should not be greater than batchSize for optimal performance',
          code: 'PERFORMANCE_WARNING',
        });
      }
    }

    return warnings;
  }

  private checkDatabaseSettings(config: PartialAppConfig): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const database = config.database;

    if (database?.type === 'sqlite' && database.connectionString) {
      warnings.push({
        path: 'database.connectionString',
        message: 'connectionString is ignored for SQLite database type',
        code: 'IGNORED_SETTING',
      });
    }

    return warnings;
  }

  /**
   * Get the JSON schema being used for validation
   *
   * @returns JSON schema object
   */
  getSchema(): Record<string, unknown> {
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
  addKeyword(keyword: string, definition: KeywordDefinition): void {
    this.ajv.addKeyword(keyword, definition);
  }

  /**
   * Migrate legacy validation errors to ServiceError format
   * This method is exposed for external consumers who need to migrate
   * validation errors from older systems
   *
   * @param validationErrors - Array of legacy ValidationError objects
   * @param operation - Optional operation context
   * @returns Array of migrated ServiceError instances
   */
  migrateValidationErrors(
    validationErrors: ValidationError[],
    operation?: string,
  ): ServiceError[] {
    return validationErrors.map(error => {
      // Create a legacy-style error for migration
      const legacyError = new Error(error.message);
      (legacyError as any).code = error.code;
      (legacyError as any).path = error.path;
      (legacyError as any).suggestion = error.suggestion;

      // Use ErrorFactory to convert to ServiceError
      return ErrorFactory.convertToServiceError(legacyError, {
        operation: operation ?? 'schema_validation',
        addContext: { validationPath: error.path },
        preserveOriginal: true,
      });
    });
  }
}

/**
 * Create a default schema validator instance
 *
 * @param options - Validator options
 * @returns SchemaValidator instance
 */
export function createSchemaValidator(
  options?: SchemaValidatorOptions,
): SchemaValidator {
  return new SchemaValidator(options);
}

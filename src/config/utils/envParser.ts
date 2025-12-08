/**
 * Environment Variable Parser
 *
 * This module provides utilities for parsing environment variables with the
 * CODE_SCOUT prefix and converting them to configuration objects.
 */

import { ConfigurationError } from '@/config/errors/ConfigurationError';
import type {
  PartialAppConfig,
  EnvironmentVariableMapping,
} from '@/config/types/ConfigTypes';

/**
 * Environment variable prefix for Code-Scout configuration
 */
export const ENV_PREFIX = 'CODE_SCOUT';

/**
 * Environment variable separator for nested properties
 */
export const ENV_SEPARATOR = '_';

/**
 * Type conversion options
 */
export interface TypeConversionOptions {
  /**
   * Whether to throw errors on invalid type conversion
   */
  strict?: boolean;

  /**
   * Default value for undefined environment variables
   */
  defaultValue?: unknown;

  /**
   * Whether to trim string values
   */
  trimStrings?: boolean;
}

/**
 * Environment variable parsing result
 */
export interface EnvParseResult {
  /**
   * Parsed configuration
   */
  config: PartialAppConfig;

  /**
   * List of processed environment variables
   */
  processedVars: string[];

  /**
   * List of warnings
   */
  warnings: string[];

  /**
   * List of errors
   */
  errors: string[];
}

/**
 * Environment variable mapping definitions
 */
export const ENV_MAPPINGS: EnvironmentVariableMapping[] = [
  // Database configuration
  {
    envVar: 'CODE_SCOUT_DB_PATH',
    configPath: 'database.path',
    type: 'string',
  },
  {
    envVar: 'CODE_SCOUT_DB_TYPE',
    configPath: 'database.type',
    type: 'string',
  },
  {
    envVar: 'CODE_SCOUT_DB_MAX_CONNECTIONS',
    configPath: 'database.maxConnections',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_DB_CONNECTION_TIMEOUT',
    configPath: 'database.connectionTimeout',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_DB_ENABLE_WAL',
    configPath: 'database.enableWAL',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_DB_VACUUM_INTERVAL_HOURS',
    configPath: 'database.vacuumIntervalHours',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_DB_CONNECTION_STRING',
    configPath: 'database.connectionString',
    type: 'string',
  },

  // Indexing configuration
  {
    envVar: 'CODE_SCOUT_INDEX_MAX_FILE_SIZE',
    configPath: 'indexing.maxFileSize',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_INDEX_MAX_WORKERS',
    configPath: 'indexing.maxWorkers',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_INDEX_BATCH_SIZE',
    configPath: 'indexing.batchSize',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_INDEX_DEBOUNCE_MS',
    configPath: 'indexing.debounceMs',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_INDEX_BATCH_WINDOW_MS',
    configPath: 'indexing.batchWindowMs',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_INDEX_FOLLOW_SYMLINKS',
    configPath: 'indexing.followSymlinks',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_INDEX_MAX_DEPTH',
    configPath: 'indexing.maxDepth',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_INDEX_INCREMENTAL',
    configPath: 'indexing.incremental',
    type: 'boolean',
  },

  // Search configuration
  {
    envVar: 'CODE_SCOUT_SEARCH_DEFAULT_LIMIT',
    configPath: 'search.defaultLimit',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_MAX_LIMIT',
    configPath: 'search.maxLimit',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_FUZZY_SEARCH',
    configPath: 'search.fuzzySearch',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_FUZZY_THRESHOLD',
    configPath: 'search.fuzzyThreshold',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_ENABLE_REGEX',
    configPath: 'search.enableRegex',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_TIMEOUT_MS',
    configPath: 'search.timeoutMs',
    type: 'number',
  },

  // Scoring weights
  {
    envVar: 'CODE_SCOUT_SEARCH_SCORE_FILENAME',
    configPath: 'search.scoringWeights.filename',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_SCORE_PATH',
    configPath: 'search.scoringWeights.path',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_SCORE_DEFINITIONS',
    configPath: 'search.scoringWeights.definitions',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_SCORE_IMPORTS',
    configPath: 'search.scoringWeights.imports',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_SCORE_DOCUMENTATION',
    configPath: 'search.scoringWeights.documentation',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_SCORE_CONTENT',
    configPath: 'search.scoringWeights.content',
    type: 'number',
  },

  // Watching configuration
  {
    envVar: 'CODE_SCOUT_WATCH_ENABLED',
    configPath: 'watching.enabled',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_WATCH_IGNORE_PATTERNS',
    configPath: 'watching.ignorePatterns',
    type: 'json',
  },
  {
    envVar: 'CODE_SCOUT_WATCH_INCLUDE_PATTERNS',
    configPath: 'watching.includePatterns',
    type: 'json',
  },
  {
    envVar: 'CODE_SCOUT_WATCH_POLLING_INTERVAL',
    configPath: 'watching.pollingInterval',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_WATCH_RECURSIVE',
    configPath: 'watching.recursive',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_WATCH_DEBOUNCE_MS',
    configPath: 'watching.debounceMs',
    type: 'number',
  },

  // Languages configuration
  {
    envVar: 'CODE_SCOUT_LANGUAGES',
    configPath: 'languages',
    type: 'json',
  },

  // Logging configuration
  {
    envVar: 'CODE_SCOUT_LOG_LEVEL',
    configPath: 'logging.level',
    type: 'string',
  },
  {
    envVar: 'CODE_SCOUT_LOG_FORMAT',
    configPath: 'logging.format',
    type: 'string',
  },
  {
    envVar: 'CODE_SCOUT_LOG_FILE_ENABLED',
    configPath: 'logging.file.enabled',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_LOG_FILE_PATH',
    configPath: 'logging.file.path',
    type: 'string',
  },
  {
    envVar: 'CODE_SCOUT_LOG_FILE_MAX_SIZE',
    configPath: 'logging.file.maxSize',
    type: 'string',
  },
  {
    envVar: 'CODE_SCOUT_LOG_FILE_MAX_FILES',
    configPath: 'logging.file.maxFiles',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_LOG_CONSOLE_ENABLED',
    configPath: 'logging.console.enabled',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_LOG_CONSOLE_COLORIZE',
    configPath: 'logging.console.colorize',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_LOG_STRUCTURED',
    configPath: 'logging.structured',
    type: 'boolean',
  },

  // Security configuration
  {
    envVar: 'CODE_SCOUT_SECURITY_ALLOWED_EXTENSIONS',
    configPath: 'security.allowedExtensions',
    type: 'json',
  },
  {
    envVar: 'CODE_SCOUT_SECURITY_BLOCKED_PATTERNS',
    configPath: 'security.blockedPatterns',
    type: 'json',
  },
  {
    envVar: 'CODE_SCOUT_SECURITY_MAX_PATH_LENGTH',
    configPath: 'security.maxPathLength',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SECURITY_ENABLE_SANDBOX',
    configPath: 'security.enableSandbox',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_SECURITY_SANDBOX_TIMEOUT_MS',
    configPath: 'security.sandbox.timeoutMs',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SECURITY_SANDBOX_MEMORY_LIMIT_MB',
    configPath: 'security.sandbox.memoryLimitMB',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SECURITY_SANDBOX_ALLOW_NETWORK',
    configPath: 'security.sandbox.allowNetworkAccess',
    type: 'boolean',
  },

  // General configuration
  {
    envVar: 'CODE_SCOUT_VERSION',
    configPath: 'version',
    type: 'string',
  },
  {
    envVar: 'CODE_SCOUT_PROFILE',
    configPath: 'profile',
    type: 'string',
  },
];

/**
 * Parse environment variables with CODE_SCOUT prefix
 *
 * @param env - Environment variables object (defaults to process.env)
 * @param mappings - Custom environment variable mappings
 * @returns EnvParseResult
 */
/**
 * Context for processing environment variable mappings
 */
interface MappingContext {
  config: PartialAppConfig;
  processedVars: string[];
  errors: string[];
}

/**
 * Process a single environment variable mapping
 */
function processMapping(
  mapping: EnvironmentVariableMapping,
  env: Record<string, string | undefined>,
  context: MappingContext,
): void {
  const envValue = env[mapping.envVar];

  if (envValue === undefined) {
    if (mapping.required) {
      context.errors.push(
        `Required environment variable '${mapping.envVar}' is not set`,
      );
    }
    return;
  }

  try {
    const convertedValue = convertType(envValue, mapping.type, {
      strict: true,
      trimStrings: true,
    });

    // Set the value in the configuration object using dot notation
    setNestedProperty(context.config, mapping.configPath, convertedValue);
    context.processedVars.push(mapping.envVar);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.errors.push(
      `Failed to convert '${mapping.envVar}' to ${mapping.type}: ${errorMessage}`,
    );
  }
}

export function parseEnvironmentVariables(
  env: Record<string, string | undefined> = process.env,
  mappings: EnvironmentVariableMapping[] = ENV_MAPPINGS,
): EnvParseResult {
  const config: PartialAppConfig = {};
  const processedVars: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const context: MappingContext = { config, processedVars, errors };

  for (const mapping of mappings) {
    processMapping(mapping, env, context);
  }

  return {
    config,
    processedVars,
    warnings,
    errors,
  };
}

/**
 * Parse environment variables using automatic detection (for dynamic configs)
 *
 * @param env - Environment variables object (defaults to process.env)
 * @param prefix - Environment variable prefix (defaults to CODE_SCOUT)
 * @returns EnvParseResult
 */
export function parseEnvironmentVariablesAuto(
  env: Record<string, string | undefined> = process.env,
  prefix: string = ENV_PREFIX,
): EnvParseResult {
  const config: PartialAppConfig = {};
  const processedVars: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const [envVar, envValue] of Object.entries(env)) {
    if (!shouldProcessEnvVar(envVar, envValue, prefix)) {
      continue;
    }

    processSingleEnvVar(envVar, envValue as string, {
      config,
      processedVars,
      errors,
    });
  }

  return {
    config,
    processedVars,
    warnings,
    errors,
  };
}

/**
 * Check if an environment variable should be processed
 */
function shouldProcessEnvVar(
  envVar: string,
  envValue: string | undefined,
  prefix: string,
): boolean {
  return envVar.startsWith(prefix + ENV_SEPARATOR) && envValue !== undefined;
}

/**
 * Process a single environment variable
 */
function processSingleEnvVar(
  envVar: string,
  envValue: string,
  context: {
    config: PartialAppConfig;
    processedVars: string[];
    errors: string[];
  },
): void {
  try {
    // Convert environment variable name to config path
    const configPath = envVarToConfigPath(envVar, ENV_PREFIX);

    // Try to infer type and convert
    const convertedValue = inferAndConvertType(envValue);

    // Set the value in the configuration object
    setNestedProperty(context.config, configPath, convertedValue);
    context.processedVars.push(envVar);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.errors.push(`Failed to parse '${envVar}': ${errorMessage}`);
  }
}

/**
 * Convert string to boolean with various accepted values
 */
function stringToBoolean(value: string, strict: boolean): boolean {
  const lowerValue = value.toLowerCase();
  const trueValues = ['true', '1', 'yes', 'on', 'enabled'];
  const falseValues = ['false', '0', 'no', 'off', 'disabled'];

  if (trueValues.includes(lowerValue)) {
    return true;
  } else if (falseValues.includes(lowerValue)) {
    return false;
  } else if (strict) {
    throw new ConfigurationError(
      `Cannot convert '${value}' to boolean`,
      'TYPE_CONVERSION_ERROR',
    );
  }
  return Boolean(value);
}

/**
 * Convert a string value to the specified type
 *
 * @param value - String value to convert
 * @param type - Target type
 * @param options - Conversion options
 * @returns Converted value
 */
export function convertType(
  value: string,
  type: 'string' | 'number' | 'boolean' | 'json',
  options: TypeConversionOptions = {},
): unknown {
  const { strict = true, trimStrings = true } = options;

  let processedValue = value;
  if (trimStrings && typeof processedValue === 'string') {
    processedValue = processedValue.trim();
  }

  const converters: Record<string, (val: string) => unknown> = {
    string: val => val,
    number: val => {
      const numValue = Number(val);
      if (strict && isNaN(numValue)) {
        throw new ConfigurationError(
          `Cannot convert '${value}' to number`,
          'TYPE_CONVERSION_ERROR',
        );
      }
      return numValue;
    },
    boolean: val => stringToBoolean(val, strict),
    json: val => {
      try {
        return JSON.parse(val);
      } catch (error) {
        throw new ConfigurationError(
          `Invalid JSON in '${value}': ${error instanceof Error ? error.message : String(error)}`,
          'JSON_PARSE_ERROR',
        );
      }
    },
  };

  const converter = converters[type];
  if (!converter) {
    throw new ConfigurationError(
      `Unsupported type: ${type}`,
      'UNSUPPORTED_TYPE',
    );
  }

  return converter(processedValue);
}

/**
 * Infer and convert type automatically from string value
 *
 * @param value - String value to convert
 * @returns Converted value
 */
/**
 * Try to parse value as JSON
 */
function tryParseJson(value: string): unknown | null {
  if (
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON
    }
  }
  return null;
}

/**
 * Try to parse value as boolean
 */
function tryParseBoolean(value: string): boolean | null {
  const lowerValue = value.toLowerCase();
  if (['true', 'false'].includes(lowerValue)) {
    return lowerValue === 'true';
  }
  return null;
}

/**
 * Try to parse value as number
 */
function tryParseNumber(value: string): number | null {
  const numValue = Number(value);
  if (!isNaN(numValue) && isFinite(numValue)) {
    return numValue;
  }
  return null;
}

export function inferAndConvertType(value: string): unknown {
  const trimmed = value.trim();

  // Try different type conversions in order of specificity
  const jsonResult = tryParseJson(trimmed);
  if (jsonResult !== null) {
    return jsonResult;
  }

  const boolResult = tryParseBoolean(trimmed);
  if (boolResult !== null) {
    return boolResult;
  }

  const numResult = tryParseNumber(trimmed);
  if (numResult !== null) {
    return numResult;
  }

  // Default to string
  return trimmed;
}

/**
 * Convert environment variable name to configuration path
 *
 * @param envVar - Environment variable name
 * @param prefix - Environment variable prefix
 * @returns Configuration path (dot notation)
 */
export function envVarToConfigPath(
  envVar: string,
  prefix: string = ENV_PREFIX,
): string {
  // Remove prefix
  const withoutPrefix = envVar.substring(prefix.length + 1); // +1 for separator

  // Convert to lowercase and split by separator
  const parts = withoutPrefix.toLowerCase().split(ENV_SEPARATOR);

  return parts.join('.');
}

/**
 * Set a nested property in an object using dot notation
 *
 * @param obj - Target object
 * @param path - Property path (dot notation)
 * @param value - Value to set
 */

export function setNestedProperty(
  obj: any,
  path: string,
  value: unknown,
): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    if (!key) {
      continue;
    }

    if (
      !(key in current) ||
      typeof current[key] !== 'object' ||
      current[key] === null
    ) {
      current[key] = {};
    }

    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    current[lastKey] = value;
  }
}

/**
 * Get nested value from object using path array
 */
function getNestedValue<T>(obj: T, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Validate that a numeric value is positive
 */
function validatePositiveNumber(
  value: number | undefined,
  fieldName: string,
): string | null {
  if (value !== undefined && value <= 0) {
    return `${fieldName} must be greater than 0`;
  }
  return null;
}

/**
 * Validate that a value is within a range
 */
function validateRange(
  value: number | undefined,
  min: number,
  max: number,
  fieldName: string,
): string | null {
  if (value !== undefined && (value < min || value > max)) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}

/**
 * Validate that a value is an array
 */
function validateArray(value: unknown, fieldName: string): string | null {
  if (value !== undefined && !Array.isArray(value)) {
    return `${fieldName} must be an array`;
  }
  return null;
}

/**
 * Validate that a value is in an allowed set
 */
function validateEnum<T extends string>(
  value: T | undefined,
  allowedValues: readonly T[],
  fieldName: string,
): string | null {
  if (value !== undefined && !allowedValues.includes(value)) {
    return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
  }
  return null;
}

/**
 * Validate positive numeric values in configuration
 */
function validatePositiveNumbers(config: PartialAppConfig): string[] {
  const errors: string[] = [];

  // Define fields to validate with their paths and display names
  const positiveNumberFields = [
    { path: ['database', 'maxConnections'], name: 'Database maxConnections' },
    {
      path: ['database', 'connectionTimeout'],
      name: 'Database connectionTimeout',
    },
    { path: ['indexing', 'maxFileSize'], name: 'Indexing maxFileSize' },
    { path: ['indexing', 'maxWorkers'], name: 'Indexing maxWorkers' },
    { path: ['indexing', 'batchSize'], name: 'Indexing batchSize' },
    { path: ['search', 'defaultLimit'], name: 'Search defaultLimit' },
    { path: ['search', 'maxLimit'], name: 'Search maxLimit' },
  ];

  // Validate each field
  for (const field of positiveNumberFields) {
    const value = getNestedValue(config, field.path);
    if (value !== undefined) {
      const error = validatePositiveNumber(
        value as number | undefined,
        field.name,
      );
      if (error) {
        errors.push(error);
      }
    }
  }

  return errors;
}

/**
 * Validate range values in configuration
 */
function validateRanges(config: PartialAppConfig): string[] {
  const errors: string[] = [];

  const rangeError = validateRange(
    config.search?.fuzzyThreshold,
    0,
    1,
    'Search fuzzyThreshold',
  );
  if (rangeError) {
    errors.push(rangeError);
  }

  return errors;
}

/**
 * Validate array values in configuration
 */
function validateArrays(config: PartialAppConfig): string[] {
  const errors: string[] = [];
  const validations = [
    {
      value: config.watching?.ignorePatterns,
      field: 'Watching ignorePatterns',
    },
    {
      value: config.watching?.includePatterns,
      field: 'Watching includePatterns',
    },
  ];

  for (const { value, field } of validations) {
    const error = validateArray(value, field);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Validate enum values in configuration
 */
function validateEnums(config: PartialAppConfig): string[] {
  const errors: string[] = [];
  const validations = [
    {
      value: config.database?.type,
      allowed: ['sqlite', 'postgresql', 'mysql'] as const,
      field: 'Database type',
    },
    {
      value: config.logging?.level,
      allowed: ['error', 'warn', 'info', 'debug', 'trace'] as const,
      field: 'Log level',
    },
    {
      value: config.logging?.format,
      allowed: ['json', 'text'] as const,
      field: 'Log format',
    },
    {
      value: config.profile,
      allowed: ['development', 'production', 'cicd'] as const,
      field: 'Profile',
    },
  ];

  for (const { value, allowed, field } of validations) {
    const error = validateEnum(value, allowed, field);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Validate environment variable values
 *
 * @param config - Parsed configuration
 * @returns Array of validation errors
 */
export function validateEnvironmentValues(config: PartialAppConfig): string[] {
  return [
    ...validatePositiveNumbers(config),
    ...validateRanges(config),
    ...validateArrays(config),
    ...validateEnums(config),
  ];
}

/**
 * Get all CODE_SCOUT environment variables
 *
 * @param env - Environment variables object (defaults to process.env)
 * @returns Array of environment variable names
 */
export function getCodeScoutEnvironmentVariables(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return Object.keys(env).filter(key =>
    key.startsWith(ENV_PREFIX + ENV_SEPARATOR),
  );
}

/**
 * Check if any CODE_SCOUT environment variables are set
 *
 * @param env - Environment variables object (defaults to process.env)
 * @returns boolean
 */
export function hasCodeScoutEnvironmentVariables(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return getCodeScoutEnvironmentVariables(env).length > 0;
}

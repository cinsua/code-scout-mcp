/**
 * Environment Variable Parser
 *
 * This module provides utilities for parsing environment variables with the
 * CODE_SCOUT prefix and converting them to configuration objects.
 */

import { ConfigurationError } from '../errors/ConfigurationError';
import {
  PartialAppConfig,
  EnvironmentVariableMapping,
} from '../types/ConfigTypes';

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
export function parseEnvironmentVariables(
  env: Record<string, string | undefined> = process.env,
  mappings: EnvironmentVariableMapping[] = ENV_MAPPINGS
): EnvParseResult {
  const config: PartialAppConfig = {};
  const processedVars: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const mapping of mappings) {
    const envValue = env[mapping.envVar];

    if (envValue === undefined || envValue === null) {
      if (mapping.required) {
        errors.push(
          `Required environment variable '${mapping.envVar}' is not set`
        );
      }
      continue;
    }

    try {
      const convertedValue = convertType(envValue, mapping.type, {
        strict: true,
        trimStrings: true,
      });

      // Set the value in the configuration object using dot notation
      setNestedProperty(config, mapping.configPath, convertedValue);
      processedVars.push(mapping.envVar);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(
        `Failed to convert '${mapping.envVar}' to ${mapping.type}: ${errorMessage}`
      );
    }
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
  prefix: string = ENV_PREFIX
): EnvParseResult {
  const config: PartialAppConfig = {};
  const processedVars: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const [envVar, envValue] of Object.entries(env)) {
    if (!envVar || !envVar.startsWith(prefix + ENV_SEPARATOR)) {
      continue;
    }

    if (envValue === undefined || envValue === null) {
      continue;
    }

    try {
      // Convert environment variable name to config path
      const configPath = envVarToConfigPath(envVar, prefix);

      // Try to infer type and convert
      const convertedValue = inferAndConvertType(envValue);

      // Set the value in the configuration object
      setNestedProperty(config, configPath, convertedValue);
      processedVars.push(envVar);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Failed to parse '${envVar}': ${errorMessage}`);
    }
  }

  return {
    config,
    processedVars,
    warnings,
    errors,
  };
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
  options: TypeConversionOptions = {}
): unknown {
  const { strict = true, trimStrings = true } = options;

  let processedValue = value;
  if (trimStrings && typeof processedValue === 'string') {
    processedValue = processedValue.trim();
  }

  switch (type) {
    case 'string':
      return processedValue;

    case 'number':
      const numValue = Number(processedValue);
      if (strict && isNaN(numValue)) {
        throw new ConfigurationError(
          `Cannot convert '${value}' to number`,
          'TYPE_CONVERSION_ERROR'
        );
      }
      return numValue;

    case 'boolean':
      const lowerValue = processedValue.toLowerCase();
      if (['true', '1', 'yes', 'on', 'enabled'].includes(lowerValue)) {
        return true;
      } else if (['false', '0', 'no', 'off', 'disabled'].includes(lowerValue)) {
        return false;
      } else if (strict) {
        throw new ConfigurationError(
          `Cannot convert '${value}' to boolean`,
          'TYPE_CONVERSION_ERROR'
        );
      }
      return Boolean(processedValue);

    case 'json':
      try {
        return JSON.parse(processedValue);
      } catch (error) {
        throw new ConfigurationError(
          `Invalid JSON in '${value}': ${error instanceof Error ? error.message : String(error)}`,
          'JSON_PARSE_ERROR'
        );
      }

    default:
      throw new ConfigurationError(
        `Unsupported type: ${type}`,
        'UNSUPPORTED_TYPE'
      );
  }
}

/**
 * Infer and convert type automatically from string value
 *
 * @param value - String value to convert
 * @returns Converted value
 */
export function inferAndConvertType(value: string): unknown {
  const trimmed = value.trim();

  // Try JSON first (for objects and arrays)
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not valid JSON, continue with other types
    }
  }

  // Try boolean
  const lowerValue = trimmed.toLowerCase();
  if (['true', 'false'].includes(lowerValue)) {
    return lowerValue === 'true';
  }

  // Try number
  const numValue = Number(trimmed);
  if (!isNaN(numValue) && isFinite(numValue)) {
    return numValue;
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
  prefix: string = ENV_PREFIX
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
  value: unknown
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
 * Validate environment variable values
 *
 * @param config - Parsed configuration
 * @returns Array of validation errors
 */
export function validateEnvironmentValues(config: PartialAppConfig): string[] {
  const errors: string[] = [];

  // Validate numeric values
  if (config.database?.maxConnections && config.database.maxConnections <= 0) {
    errors.push('Database maxConnections must be greater than 0');
  }

  if (
    config.database?.connectionTimeout &&
    config.database.connectionTimeout <= 0
  ) {
    errors.push('Database connectionTimeout must be greater than 0');
  }

  if (config.indexing?.maxFileSize && config.indexing.maxFileSize <= 0) {
    errors.push('Indexing maxFileSize must be greater than 0');
  }

  if (config.indexing?.maxWorkers && config.indexing.maxWorkers <= 0) {
    errors.push('Indexing maxWorkers must be greater than 0');
  }

  if (config.indexing?.batchSize && config.indexing.batchSize <= 0) {
    errors.push('Indexing batchSize must be greater than 0');
  }

  if (config.search?.defaultLimit && config.search.defaultLimit <= 0) {
    errors.push('Search defaultLimit must be greater than 0');
  }

  if (config.search?.maxLimit && config.search.maxLimit <= 0) {
    errors.push('Search maxLimit must be greater than 0');
  }

  // Validate ranges
  if (
    config.search?.fuzzyThreshold &&
    (config.search.fuzzyThreshold < 0 || config.search.fuzzyThreshold > 1)
  ) {
    errors.push('Search fuzzyThreshold must be between 0 and 1');
  }

  // Validate arrays
  if (
    config.watching?.ignorePatterns &&
    !Array.isArray(config.watching.ignorePatterns)
  ) {
    errors.push('Watching ignorePatterns must be an array');
  }

  if (
    config.watching?.includePatterns &&
    !Array.isArray(config.watching.includePatterns)
  ) {
    errors.push('Watching includePatterns must be an array');
  }

  // Validate enum values
  if (
    config.database?.type &&
    !['sqlite', 'postgresql', 'mysql'].includes(config.database.type)
  ) {
    errors.push('Database type must be one of: sqlite, postgresql, mysql');
  }

  if (
    config.logging?.level &&
    !['error', 'warn', 'info', 'debug', 'trace'].includes(config.logging.level)
  ) {
    errors.push('Log level must be one of: error, warn, info, debug, trace');
  }

  if (
    config.logging?.format &&
    !['json', 'text'].includes(config.logging.format)
  ) {
    errors.push('Log format must be one of: json, text');
  }

  if (
    config.profile &&
    !['development', 'production', 'cicd'].includes(config.profile)
  ) {
    errors.push('Profile must be one of: development, production, cicd');
  }

  return errors;
}

/**
 * Get all CODE_SCOUT environment variables
 *
 * @param env - Environment variables object (defaults to process.env)
 * @returns Array of environment variable names
 */
export function getCodeScoutEnvironmentVariables(
  env: Record<string, string | undefined> = process.env
): string[] {
  return Object.keys(env).filter((key) =>
    key.startsWith(ENV_PREFIX + ENV_SEPARATOR)
  );
}

/**
 * Check if any CODE_SCOUT environment variables are set
 *
 * @param env - Environment variables object (defaults to process.env)
 * @returns boolean
 */
export function hasCodeScoutEnvironmentVariables(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getCodeScoutEnvironmentVariables(env).length > 0;
}

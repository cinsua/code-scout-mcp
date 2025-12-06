/**
 * Environment Configuration Source
 *
 * This file implements configuration loading from environment
 * variables with CODE_SCOUT prefix.
 */

import type {
  PartialAppConfig,
  EnvironmentVariableMapping,
} from '../types/ConfigTypes';
import { ConfigurationError } from '../errors/ConfigurationError';

import { ConfigurationSource } from './ConfigurationSource';

/**
 * Priority level for environment configuration
 */
const ENVIRONMENT_PRIORITY = 3;

/**
 * Maximum number of database connections
 */
const MAX_ENV_CONNECTIONS = 100;

/**
 * Minimum timeout in milliseconds
 */
const MIN_ENV_TIMEOUT_MS = 1000;

/**
 * Maximum timeout in milliseconds
 */
const MAX_ENV_TIMEOUT_MS = 300000;

/**
 * Maximum number of workers
 */
const MAX_ENV_WORKERS = 64;

/**
 * Environment variable mappings for configuration
 */
const ENV_MAPPINGS: EnvironmentVariableMapping[] = [
  // Database configuration
  { envVar: 'CODE_SCOUT_DB_PATH', configPath: 'database.path', type: 'string' },
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
  { envVar: 'CODE_SCOUT_DB_TYPE', configPath: 'database.type', type: 'string' },
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
    envVar: 'CODE_SCOUT_SEARCH_FUZZY',
    configPath: 'search.fuzzySearch',
    type: 'boolean',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_FUZZY_THRESHOLD',
    configPath: 'search.fuzzyThreshold',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SEARCH_REGEX',
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
    envVar: 'CODE_SCOUT_SCORE_FILENAME',
    configPath: 'search.scoringWeights.filename',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SCORE_PATH',
    configPath: 'search.scoringWeights.path',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SCORE_DEFINITIONS',
    configPath: 'search.scoringWeights.definitions',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SCORE_IMPORTS',
    configPath: 'search.scoringWeights.imports',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SCORE_DOCUMENTATION',
    configPath: 'search.scoringWeights.documentation',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SCORE_CONTENT',
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
    envVar: 'CODE_SCOUT_LOG_STRUCTURED',
    configPath: 'logging.structured',
    type: 'boolean',
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
    envVar: 'CODE_SCOUT_SECURITY_SANDBOX_TIMEOUT',
    configPath: 'security.sandbox.timeoutMs',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SECURITY_SANDBOX_MEMORY',
    configPath: 'security.sandbox.memoryLimitMB',
    type: 'number',
  },
  {
    envVar: 'CODE_SCOUT_SECURITY_SANDBOX_NETWORK',
    configPath: 'security.sandbox.allowNetworkAccess',
    type: 'boolean',
  },

  // Languages configuration (JSON)
  { envVar: 'CODE_SCOUT_LANGUAGES', configPath: 'languages', type: 'json' },
  {
    envVar: 'CODE_SCOUT_LANGUAGES_TYPESCRIPT',
    configPath: 'languages.typescript',
    type: 'json',
  },
  {
    envVar: 'CODE_SCOUT_LANGUAGES_JAVASCRIPT',
    configPath: 'languages.javascript',
    type: 'json',
  },
  {
    envVar: 'CODE_SCOUT_LANGUAGES_PYTHON',
    configPath: 'languages.python',
    type: 'json',
  },

  // Profile and version
  { envVar: 'CODE_SCOUT_PROFILE', configPath: 'profile', type: 'string' },
  { envVar: 'CODE_SCOUT_VERSION', configPath: 'version', type: 'string' },
];

/**
 * Environment configuration source loading from CODE_SCOUT_* variables
 */
export class EnvironmentConfiguration extends ConfigurationSource {
  public readonly priority = ENVIRONMENT_PRIORITY; // Fourth priority
  public readonly name = 'environment';

  /**
   * Load configuration from environment variables
   */
  async load(): Promise<PartialAppConfig> {
    await this.validateAvailability();

    const config: PartialAppConfig = {};

    for (const mapping of ENV_MAPPINGS) {
      const envValue = process.env[mapping.envVar];

      if (envValue !== undefined) {
        const convertedValue = this.convertValue(envValue, mapping);
        this.setNestedValue(config, mapping.configPath, convertedValue);
      }
    }

    return this.createPartialConfig(config);
  }

  /**
   * Environment configuration is always available
   */
  // eslint-disable-next-line require-await
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Convert environment variable value to appropriate type
   */
  private convertValue(
    value: string,
    mapping: EnvironmentVariableMapping,
  ): unknown {
    try {
      switch (mapping.type) {
        case 'boolean':
          return this.parseBoolean(value);

        case 'number':
          return this.parseNumber(value, mapping.envVar);

        case 'json':
          return this.parseJson(value, mapping.envVar);

        case 'string':
        default:
          return value;
      }
    } catch (error) {
      throw ConfigurationError.validation(
        `Invalid value for ${mapping.envVar}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mapping.configPath,
        [`Check ${mapping.envVar} environment variable format`],
      );
    }
  }

  /**
   * Parse boolean value from string
   */
  private parseBoolean(value: string): boolean {
    const lowerValue = value.toLowerCase().trim();

    if (['true', '1', 'yes', 'on', 'enabled'].includes(lowerValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off', 'disabled'].includes(lowerValue)) {
      return false;
    }

    throw new Error(`Cannot parse '${value}' as boolean`);
  }

  /**
   * Validate number range for environment variables
   */
  private validateNumberRange(num: number, envVar: string): void {
    const validators = [
      {
        condition: envVar.includes('CONNECTIONS'),
        min: 1,
        max: MAX_ENV_CONNECTIONS,
        message: `Connection count must be between 1 and ${MAX_ENV_CONNECTIONS}`,
      },
      {
        condition: envVar.includes('TIMEOUT'),
        min: MIN_ENV_TIMEOUT_MS,
        max: MAX_ENV_TIMEOUT_MS,
        message: `Timeout must be between ${MIN_ENV_TIMEOUT_MS}ms and ${MAX_ENV_TIMEOUT_MS}ms`,
      },
      {
        condition: envVar.includes('WORKERS'),
        min: 1,
        max: MAX_ENV_WORKERS,
        message: `Worker count must be between 1 and ${MAX_ENV_WORKERS}`,
      },
    ];

    for (const validator of validators) {
      if (validator.condition && (num < validator.min || num > validator.max)) {
        throw new Error(validator.message);
      }
    }
  }

  /**
   * Parse number value from string
   */
  private parseNumber(value: string, envVar: string): number {
    const num = Number(value);

    if (isNaN(num)) {
      throw new Error(`Cannot parse '${value}' as number`);
    }

    this.validateNumberRange(num, envVar);

    return num;
  }

  /**
   * Parse JSON value from string
   */
  private parseJson(value: string, _envVar: string): unknown {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Set nested value in configuration object
   */

  private setNestedValue(obj: any, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i] as string;

      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }

      current = current[key];
    }

    const lastKey = keys[keys.length - 1] as string;
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  /**
   * Get environment variables that are currently set
   */
  getActiveEnvironmentVariables(): string[] {
    return ENV_MAPPINGS.filter(
      mapping => process.env[mapping.envVar] !== undefined,
    ).map(mapping => mapping.envVar);
  }

  /**
   * Validate environment variable values
   */
  // eslint-disable-next-line require-await
  async validateEnvironment(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const mapping of ENV_MAPPINGS) {
      const envValue = process.env[mapping.envVar];

      if (envValue !== undefined) {
        try {
          this.convertValue(envValue, mapping);
        } catch (error) {
          errors.push(
            `${mapping.envVar}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    }

    // Check for deprecated variables
    const deprecatedVars = [
      'CODE_SCOUT_DEPRECATED_VAR',
      // Add other deprecated variables as needed
    ];

    for (const deprecatedVar of deprecatedVars) {
      if (process.env[deprecatedVar]) {
        warnings.push(
          `${deprecatedVar} is deprecated and will be removed in a future version`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get environment variable documentation
   */
  getEnvironmentDocumentation(): Record<
    string,
    {
      description: string;
      type: string;
      example: string;
    }
  > {
    const docs: Record<
      string,
      { description: string; type: string; example: string }
    > = {};

    for (const mapping of ENV_MAPPINGS) {
      docs[mapping.envVar] = {
        description: this.getVariableDescription(mapping.envVar),
        type: mapping.type,
        example: this.getVariableExample(mapping),
      };
    }

    return docs;
  }

  /**
   * Get description for environment variable
   */
  private getVariableDescription(envVar: string): string {
    const descriptions: Record<string, string> = {
      CODE_SCOUT_DB_PATH: 'Path to the database file',
      CODE_SCOUT_DB_MAX_CONNECTIONS: 'Maximum number of database connections',
      CODE_SCOUT_INDEX_MAX_WORKERS: 'Maximum number of indexing worker threads',
      CODE_SCOUT_SEARCH_DEFAULT_LIMIT:
        'Default number of search results to return',
      CODE_SCOUT_LOG_LEVEL: 'Logging level (error, warn, info, debug, trace)',
      CODE_SCOUT_PROFILE:
        'Configuration profile to use (development, production, cicd)',
      CODE_SCOUT_WATCH_ENABLED: 'Enable file watching',
    };

    return descriptions[envVar] ?? `Configuration option for ${envVar}`;
  }

  /**
   * Get example value for environment variable
   */
  private getVariableExample(mapping: EnvironmentVariableMapping): string {
    switch (mapping.type) {
      case 'boolean':
        return 'true';
      case 'number':
        return '10';
      case 'json':
        return '["pattern1", "pattern2"]';
      case 'string':
      default:
        return '/path/to/value';
    }
  }

  /**
   * Get metadata about this configuration source
   */
  override getMetadata(): Record<string, unknown> {
    return {
      ...super.getMetadata(),
      activeVariables: this.getActiveEnvironmentVariables(),
      totalMappings: ENV_MAPPINGS.length,
    };
  }
}

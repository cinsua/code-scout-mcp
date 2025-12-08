/**
 * Default Configuration Source
 *
 * This file provides built-in default configuration values
 * for the Code-Scout MCP server.
 */

import type { AppConfig, PartialAppConfig } from '@/config/types/ConfigTypes';
import { ErrorFactory } from '@/shared/errors/ErrorFactory';
import { ConfigurationSource } from '@/config/sources/ConfigurationSource';

/**
 * Minimum file size for indexing in bytes
 */
const MIN_DEFAULT_FILE_SIZE = 1024;

/**
 * Maximum number of indexing workers
 */
const MAX_DEFAULT_WORKERS = 64;

/**
 * Maximum sum of scoring weights
 */
const MAX_SCORING_WEIGHT_SUM = 20;

/**
 * Default configuration source with built-in values
 */
export class DefaultConfiguration extends ConfigurationSource {
  public readonly priority = 0; // Lowest priority (highest number)
  public readonly name = 'defaults';

  /**
   * Default configuration values
   */
  private readonly defaults: PartialAppConfig = {
    version: '1.0.0',
    indexing: {
      maxFileSize: 10485760, // 10MB
      maxWorkers: 4,
      batchSize: 100,
      debounceMs: 300,
      batchWindowMs: 1000,
      followSymlinks: false,
      maxDepth: 10,
      incremental: true,
    },
    search: {
      defaultLimit: 20,
      maxLimit: 100,
      scoringWeights: {
        filename: 5.0,
        path: 3.0,
        definitions: 3.0,
        imports: 2.0,
        documentation: 1.0,
        content: 1.0,
      },
      fuzzySearch: true,
      fuzzyThreshold: 0.6,
      enableRegex: true,
      timeoutMs: 30000,
    },
    database: {
      path: './.code-scout/database.db',
      maxConnections: 10,
      connectionTimeout: 30000,
      type: 'sqlite',
      enableWAL: true,
      vacuumIntervalHours: 24,
    },
    watching: {
      enabled: true,
      ignorePatterns: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '__pycache__',
        '*.pyc',
      ],
      includePatterns: ['**/*.{js,jsx,ts,tsx,py,json,md}'],
      recursive: true,
      debounceMs: 300,
    },
    languages: {
      typescript: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        parser: 'TypeScriptParser',
        enabled: true,
      },
      javascript: {
        extensions: ['.js', '.jsx'],
        parser: 'JavaScriptParser',
        enabled: true,
      },
      python: {
        extensions: ['.py'],
        parser: 'PythonParser',
        enabled: true,
      },
    },
    logging: {
      level: 'info',
      format: 'json',
      file: {
        enabled: true,
        path: './.code-scout/logs/app.log',
        maxSize: '10MB',
        maxFiles: 5,
      },
      console: {
        enabled: true,
        colorize: true,
      },
      structured: false,
    },
    security: {
      allowedExtensions: [
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.py',
        '.json',
        '.md',
        '.txt',
        '.yml',
        '.yaml',
        '.xml',
        '.html',
        '.css',
      ],
      blockedPatterns: [
        '*.exe',
        '*.dll',
        '*.so',
        '*.dylib',
        '*.bin',
        '*.obj',
        '*.o',
      ],
      maxPathLength: 1024,
      enableSandbox: false,
      sandbox: {
        timeoutMs: 30000,
        memoryLimitMB: 512,
        allowNetworkAccess: false,
      },
    },
  };

  /**
   * Load default configuration
   */
  async load(): Promise<PartialAppConfig> {
    const result = this.createPartialConfig(this.defaults);
    await Promise.resolve();
    return result;
  }

  /**
   * Default configuration is always available
   */
  async isAvailable(): Promise<boolean> {
    await Promise.resolve();
    return true;
  }

  /**
   * Get specific default value by path
   */
  getDefaultValue(path: string): unknown {
    const keys = path.split('.');
    let value: unknown = this.defaults;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Check if a default value exists for a path
   */
  hasDefaultValue(path: string): boolean {
    return this.getDefaultValue(path) !== undefined;
  }

  /**
   * Get all default values as a plain object
   */
  getAllDefaults(): PartialAppConfig {
    return { ...this.defaults };
  }

  /**
   * Validate that defaults are consistent
   */
  validateDefaults(): void {
    this.validateSearchLimits();
    this.validateFileSize();
    this.validateWorkerCount();
    this.validateScoringWeights();
  }

  private validateSearchLimits(): void {
    const search = this.defaults.search;
    if (search && search.defaultLimit > search.maxLimit) {
      throw ErrorFactory.configuration(
        'INVALID_SEARCH_LIMITS',
        'Default search limit cannot exceed maximum limit',
        {
          operation: 'default_configuration_validation',
          context: {
            defaultLimit: search.defaultLimit,
            maxLimit: search.maxLimit,
          },
        },
      );
    }
  }

  private validateFileSize(): void {
    const indexing = this.defaults.indexing;
    if (indexing && indexing.maxFileSize < MIN_DEFAULT_FILE_SIZE) {
      throw ErrorFactory.configuration(
        'INVALID_FILE_SIZE',
        'Maximum file size must be at least 1KB',
        {
          operation: 'default_configuration_validation',
          context: {
            maxFileSize: indexing.maxFileSize,
            minRequired: MIN_DEFAULT_FILE_SIZE,
          },
        },
      );
    }
  }

  private validateWorkerCount(): void {
    const indexing = this.defaults.indexing;
    if (
      indexing &&
      (indexing.maxWorkers < 1 || indexing.maxWorkers > MAX_DEFAULT_WORKERS)
    ) {
      throw ErrorFactory.configuration(
        'INVALID_WORKER_COUNT',
        `Max workers must be between 1 and ${MAX_DEFAULT_WORKERS}`,
        {
          operation: 'default_configuration_validation',
          context: {
            maxWorkers: indexing.maxWorkers,
            min: 1,
            max: MAX_DEFAULT_WORKERS,
          },
        },
      );
    }
  }

  private validateScoringWeights(): void {
    const weights = this.defaults.search?.scoringWeights;
    if (weights) {
      const total = Object.values(weights).reduce(
        (sum, weight) => sum + weight,
        0,
      );
      if (total <= 0 || total > MAX_SCORING_WEIGHT_SUM) {
        throw ErrorFactory.configuration(
          'INVALID_SCORING_WEIGHTS',
          `Scoring weights must sum to a positive value less than ${MAX_SCORING_WEIGHT_SUM}`,
          {
            operation: 'default_configuration_validation',
            context: {
              total,
              maxAllowed: MAX_SCORING_WEIGHT_SUM,
              weights,
            },
          },
        );
      }
    }
  }

  /**
   * Get default configuration for a specific profile
   */
  getProfileDefaults(profile: string): PartialAppConfig {
    const baseDefaults = this.getAllDefaults() as AppConfig;

    switch (profile) {
      case 'development':
        return this.getDevelopmentDefaults(baseDefaults);
      case 'production':
        return this.getProductionDefaults(baseDefaults);
      case 'cicd':
        return this.getCicdDefaults(baseDefaults);
      default:
        return baseDefaults;
    }
  }

  /**
   * Get development profile defaults
   */
  private getDevelopmentDefaults(baseDefaults: AppConfig): PartialAppConfig {
    return {
      ...baseDefaults,
      logging: {
        ...baseDefaults.logging,
        level: 'debug',
        console: {
          ...baseDefaults.logging.console,
          colorize: true,
        },
      },
      watching: {
        ...baseDefaults.watching,
        enabled: true,
      },
    };
  }

  /**
   * Get production profile defaults
   */
  private getProductionDefaults(baseDefaults: AppConfig): PartialAppConfig {
    return {
      ...baseDefaults,
      logging: {
        ...baseDefaults.logging,
        level: 'warn',
        console: {
          ...baseDefaults.logging.console,
          colorize: false,
        },
      },
      watching: {
        ...baseDefaults.watching,
        enabled: false,
      },
      security: {
        ...baseDefaults.security,
        enableSandbox: true,
      },
    };
  }

  /**
   * Get CI/CD profile defaults
   */
  private getCicdDefaults(baseDefaults: AppConfig): PartialAppConfig {
    return {
      ...baseDefaults,
      logging: {
        ...baseDefaults.logging,
        level: 'error',
        console: {
          ...baseDefaults.logging.console,
          enabled: false,
        },
      },
      watching: {
        ...baseDefaults.watching,
        enabled: false,
      },
      indexing: {
        ...baseDefaults.indexing,
        maxWorkers: Math.min(baseDefaults.indexing.maxWorkers, 2),
      },
    };
  }
}

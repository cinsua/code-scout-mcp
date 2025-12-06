/**
 * Default Configuration Source
 *
 * This file provides built-in default configuration values
 * for the Code-Scout MCP server.
 */

import { ConfigurationSource } from './ConfigurationSource';
import { PartialAppConfig } from '../types/ConfigTypes';

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
    return this.createPartialConfig(this.defaults);
  }

  /**
   * Default configuration is always available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Get specific default value by path
   */
  getDefaultValue(path: string): unknown {
    const keys = path.split('.');
    let value: any = this.defaults;

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
    // Check that search limits are consistent
    const search = this.defaults.search;
    if (search && search.defaultLimit > search.maxLimit) {
      throw new Error('Default search limit cannot exceed maximum limit');
    }

    // Check that file size is reasonable
    const indexing = this.defaults.indexing;
    if (indexing && indexing.maxFileSize < 1024) {
      throw new Error('Maximum file size must be at least 1KB');
    }

    // Check that worker count is reasonable
    if (indexing && (indexing.maxWorkers < 1 || indexing.maxWorkers > 64)) {
      throw new Error('Max workers must be between 1 and 64');
    }

    // Check that scoring weights sum to a reasonable value
    const weights = search?.scoringWeights;
    if (weights) {
      const total = Object.values(weights).reduce(
        (sum, weight) => sum + weight,
        0
      );
      if (total <= 0 || total > 20) {
        throw new Error(
          'Scoring weights must sum to a positive value less than 20'
        );
      }
    }
  }

  /**
   * Get default configuration for a specific profile
   */
  getProfileDefaults(profile: string): PartialAppConfig {
    const baseDefaults = this.getAllDefaults();

    switch (profile) {
      case 'development':
        return {
          ...baseDefaults,
          logging: {
            ...baseDefaults.logging!,
            level: 'debug',
            console: {
              ...baseDefaults.logging!.console,
              colorize: true,
            },
          },
          watching: {
            ...baseDefaults.watching!,
            enabled: true,
          },
        };

      case 'production':
        return {
          ...baseDefaults,
          logging: {
            ...baseDefaults.logging!,
            level: 'warn',
            console: {
              ...baseDefaults.logging!.console,
              colorize: false,
            },
          },
          watching: {
            ...baseDefaults.watching!,
            enabled: false,
          },
          security: {
            ...baseDefaults.security!,
            enableSandbox: true,
          },
        };

      case 'cicd':
        return {
          ...baseDefaults,
          logging: {
            ...baseDefaults.logging!,
            level: 'error',
            console: {
              ...baseDefaults.logging!.console,
              enabled: false,
            },
          },
          watching: {
            ...baseDefaults.watching!,
            enabled: false,
          },
          indexing: {
            ...baseDefaults.indexing!,
            maxWorkers: Math.min(baseDefaults.indexing?.maxWorkers || 4, 2),
          },
        };

      default:
        return baseDefaults;
    }
  }
}

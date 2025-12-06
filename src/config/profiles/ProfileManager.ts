/**
 * Profile Manager
 *
 * This module provides functionality for managing configuration profiles,
 * including loading, selection, and merging with user configurations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigurationError } from '../errors/ConfigurationError';
import { PartialAppConfig, ProfileType } from '../types/ConfigTypes';
import { SchemaValidator } from '../validators/SchemaValidator';
import { SemanticValidator } from '../validators/SemanticValidator';

/**
 * Profile information
 */
export interface ProfileInfo {
  /**
   * Profile name
   */
  name: ProfileType;

  /**
   * Profile description
   */
  description: string;

  /**
   * Profile file path
   */
  filePath: string;

  /**
   * Whether profile is built-in
   */
  builtIn: boolean;

  /**
   * Profile version
   */
  version: string;
}

/**
 * Profile loading options
 */
export interface ProfileLoadOptions {
  /**
   * Whether to validate profile after loading
   */
  validate?: boolean;

  /**
   * Whether to merge with default configuration
   */
  mergeWithDefaults?: boolean;

  /**
   * Custom profile directory
   */
  profileDir?: string;
}

/**
 * Profile Manager class
 */
export class ProfileManager {
  private profilesDir: string;
  private schemaValidator: SchemaValidator;
  private semanticValidator: SemanticValidator;
  private profileCache: Map<ProfileType, PartialAppConfig> = new Map();

  constructor(profilesDir?: string) {
    this.profilesDir = profilesDir || path.join(__dirname, 'profiles');
    this.schemaValidator = new SchemaValidator();
    this.semanticValidator = new SemanticValidator();
  }

  /**
   * Get available profiles
   *
   * @returns Promise<ProfileInfo[]>
   */
  async getAvailableProfiles(): Promise<ProfileInfo[]> {
    const profiles: ProfileInfo[] = [];

    try {
      const files = await fs.readdir(this.profilesDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const profileName = path.basename(file, '.json') as ProfileType;
          const filePath = path.join(this.profilesDir, file);

          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const config = JSON.parse(content) as PartialAppConfig;

            profiles.push({
              name: profileName,
              description: this.getProfileDescription(profileName),
              filePath,
              builtIn: true,
              version: config.version || '1.0.0',
            });
          } catch (error) {
            // Skip invalid profile files
            console.warn(`Invalid profile file: ${file}`, error);
          }
        }
      }
    } catch (error) {
      throw new ConfigurationError(
        `Failed to read profiles directory: ${error instanceof Error ? error.message : String(error)}`,
        'PROFILE_DIR_ERROR'
      );
    }

    return profiles;
  }

  /**
   * Load a specific profile
   *
   * @param profileName - Profile name to load
   * @param options - Loading options
   * @returns Promise<PartialAppConfig>
   */
  async loadProfile(
    profileName: ProfileType,
    options: ProfileLoadOptions = {}
  ): Promise<PartialAppConfig> {
    const {
      validate = true,
      mergeWithDefaults = true,
      profileDir = this.profilesDir,
    } = options;

    // Check cache first
    if (this.profileCache.has(profileName)) {
      const cachedConfig = this.profileCache.get(profileName)!;
      return { ...cachedConfig };
    }

    const profilePath = path.join(profileDir, `${profileName}.json`);

    try {
      // Check if profile file exists
      await fs.access(profilePath);

      // Read and parse profile
      const content = await fs.readFile(profilePath, 'utf-8');
      let config = JSON.parse(content) as PartialAppConfig;

      // Validate profile if requested
      if (validate) {
        const schemaResult = this.schemaValidator.validate(config);
        const semanticResult = this.semanticValidator.validate(config);

        if (!schemaResult.valid || !semanticResult.valid) {
          const errors = [...schemaResult.errors, ...semanticResult.errors];
          throw new ConfigurationError(
            `Profile '${profileName}' is invalid: ${errors.map((e) => e.message).join(', ')}`,
            'INVALID_PROFILE'
          );
        }
      }

      // Merge with defaults if requested
      if (mergeWithDefaults) {
        const defaultConfig = await this.loadDefaultProfile();
        config = this.mergeConfigurations(defaultConfig, config);
      }

      // Cache the profile
      this.profileCache.set(profileName, { ...config });

      return config;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }

      throw new ConfigurationError(
        `Failed to load profile '${profileName}': ${error instanceof Error ? error.message : String(error)}`,
        'PROFILE_LOAD_ERROR'
      );
    }
  }

  /**
   * Detect profile from environment or configuration
   *
   * @param env - Environment variables (defaults to process.env)
   * @param config - Existing configuration
   * @returns Promise<ProfileType | null>
   */
  async detectProfile(
    env: Record<string, string | undefined> = process.env,
    config?: PartialAppConfig
  ): Promise<ProfileType | null> {
    // Check environment variable first
    const envProfile = env.CODE_SCOUT_PROFILE as ProfileType;
    if (envProfile && this.isValidProfile(envProfile)) {
      return envProfile;
    }

    // Check configuration
    if (config?.profile && this.isValidProfile(config.profile)) {
      return config.profile;
    }

    // Auto-detect based on environment
    return this.autoDetectProfile(env);
  }

  /**
   * Save a custom profile
   *
   * @param profileName - Profile name
   * @param config - Configuration to save
   * @param customDir - Custom directory for saving
   * @returns Promise<ProfileInfo>
   */
  async saveProfile(
    profileName: ProfileType,
    config: PartialAppConfig,
    customDir?: string
  ): Promise<ProfileInfo> {
    const targetDir = customDir || this.profilesDir;
    const profilePath = path.join(targetDir, `${profileName}.json`);

    try {
      // Validate configuration before saving
      const schemaResult = this.schemaValidator.validate(config);
      const semanticResult = this.semanticValidator.validate(config);

      if (!schemaResult.valid || !semanticResult.valid) {
        const errors = [...schemaResult.errors, ...semanticResult.errors];
        throw new ConfigurationError(
          `Cannot save invalid profile: ${errors.map((e) => e.message).join(', ')}`,
          'INVALID_PROFILE_CONFIG'
        );
      }

      // Ensure directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Add profile metadata
      const profileConfig = {
        ...config,
        profile: profileName,
        version: config.version || '1.0.0',
      };

      // Write profile file
      await fs.writeFile(
        profilePath,
        JSON.stringify(profileConfig, null, 2),
        'utf-8'
      );

      // Clear cache
      this.profileCache.delete(profileName);

      return {
        name: profileName,
        description: this.getProfileDescription(profileName),
        filePath: profilePath,
        builtIn: false,
        version: profileConfig.version || '1.0.0',
      };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }

      throw new ConfigurationError(
        `Failed to save profile '${profileName}': ${error instanceof Error ? error.message : String(error)}`,
        'PROFILE_SAVE_ERROR'
      );
    }
  }

  /**
   * Delete a custom profile
   *
   * @param profileName - Profile name to delete
   * @param customDir - Custom directory where profile is saved
   * @returns Promise<void>
   */
  async deleteProfile(
    profileName: ProfileType,
    customDir?: string
  ): Promise<void> {
    const targetDir = customDir || this.profilesDir;
    const profilePath = path.join(targetDir, `${profileName}.json`);

    try {
      await fs.unlink(profilePath);
      this.profileCache.delete(profileName);
    } catch (error) {
      throw new ConfigurationError(
        `Failed to delete profile '${profileName}': ${error instanceof Error ? error.message : String(error)}`,
        'PROFILE_DELETE_ERROR'
      );
    }
  }

  /**
   * Clear profile cache
   */
  clearCache(): void {
    this.profileCache.clear();
  }

  /**
   * Get profile description
   *
   * @param profileName - Profile name
   * @returns Profile description
   */
  private getProfileDescription(profileName: ProfileType): string {
    const descriptions: Record<ProfileType, string> = {
      development:
        'Development profile with verbose logging and relaxed security',
      production: 'Production profile optimized for performance and security',
      cicd: 'CI/CD profile optimized for automated testing and builds',
    };

    return descriptions[profileName] || 'Custom profile';
  }

  /**
   * Load default profile (base configuration)
   *
   * @returns Promise<PartialAppConfig>
   */
  private async loadDefaultProfile(): Promise<PartialAppConfig> {
    return {
      version: '1.0.0',
      indexing: {
        maxFileSize: 10485760,
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
        fuzzySearch: true,
        fuzzyThreshold: 0.8,
        enableRegex: true,
        timeoutMs: 5000,
        scoringWeights: {
          filename: 5.0,
          path: 3.0,
          definitions: 3.0,
          imports: 2.0,
          documentation: 1.0,
          content: 2.0,
        },
      },
      database: {
        path: './.code-scout/database.db',
        type: 'sqlite',
        maxConnections: 10,
        connectionTimeout: 30000,
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
        includePatterns: [],
        recursive: true,
        debounceMs: 300,
      },
      languages: {
        typescript: {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
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
        format: 'text',
        file: {
          enabled: true,
          maxSize: '50MB',
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
          '.ts',
          '.tsx',
          '.js',
          '.jsx',
          '.py',
          '.json',
          '.md',
        ],
        blockedPatterns: ['**/*.pem', '**/*.key', '**/.env*'],
        maxPathLength: 1024,
        enableSandbox: false,
      },
    };
  }

  /**
   * Auto-detect profile based on environment
   *
   * @param env - Environment variables
   * @returns Detected profile or null
   */
  private async autoDetectProfile(
    env: Record<string, string | undefined>
  ): Promise<ProfileType | null> {
    // Check for CI environment
    if (
      env.CI ||
      env.CONTINUOUS_INTEGRATION ||
      env.JENKINS_URL ||
      env.GITHUB_ACTIONS
    ) {
      return 'cicd';
    }

    // Check for production environment
    if (env.NODE_ENV === 'production' || env.PRODUCTION === 'true') {
      return 'production';
    }

    // Check for development environment
    if (
      env.NODE_ENV === 'development' ||
      env.DEV === 'true' ||
      process.env.DEBUG
    ) {
      return 'development';
    }

    // Default to development for local development
    return 'development';
  }

  /**
   * Validate profile name
   *
   * @param profileName - Profile name to validate
   * @returns Whether profile name is valid
   */
  private isValidProfile(profileName: string): profileName is ProfileType {
    return ['development', 'production', 'cicd'].includes(profileName);
  }

  /**
   * Merge two configurations
   *
   * @param base - Base configuration
   * @param override - Override configuration
   * @returns Merged configuration
   */
  private mergeConfigurations(
    base: PartialAppConfig,
    override: PartialAppConfig
  ): PartialAppConfig {
    const mergeDeep = (target: any, source: any): any => {
      const result = { ...target };

      for (const key in source) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          result[key] = mergeDeep(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }

      return result;
    };

    return mergeDeep(base, override);
  }
}

/**
 * Create a default profile manager instance
 *
 * @param profilesDir - Custom profiles directory
 * @returns ProfileManager instance
 */
export function createProfileManager(profilesDir?: string): ProfileManager {
  return new ProfileManager(profilesDir);
}

/**
 * Profile Manager
 *
 * This module provides functionality for managing configuration profiles,
 * including loading, selection, and merging with user configurations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { ConfigurationError } from '@/config/errors/ConfigurationError';
import type {
  PartialAppConfig,
  ProfileType,
  IndexingConfig,
  SearchConfig,
  DatabaseConfig,
  WatchingConfig,
  LanguagesConfig,
  LoggingConfig,
  SecurityConfig,
} from '@/config/types/ConfigTypes';
import { SchemaValidator } from '@/config/validators/SchemaValidator';
import { SemanticValidator } from '@/config/validators/SemanticValidator';
import { LOG_FILE_CONFIG } from '@/shared/utils/LoggingConstants';

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
   * Custom profile directory path
   */
  profileDir?: string;
}

export class ProfileManager {
  private profilesDir: string;
  private schemaValidator: SchemaValidator;
  private semanticValidator: SemanticValidator;
  private profileCache: Map<ProfileType, PartialAppConfig> = new Map();

  constructor(profilesDir?: string) {
    this.profilesDir = profilesDir ?? path.join(__dirname, 'profiles');
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
              version: config.version ?? '1.0.0',
            });
          } catch {
            // Skip invalid profile files
            // Error is intentionally ignored to allow loading other valid profiles
          }
        }
      }
    } catch (error) {
      throw new ConfigurationError(
        `Failed to read profiles directory: ${error instanceof Error ? error.message : String(error)}`,
        'PROFILE_DIR_ERROR',
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
    options: ProfileLoadOptions = {},
  ): Promise<PartialAppConfig> {
    const processedOptions = this.processLoadOptions(options);

    // Check cache first
    const cachedConfig = this.profileCache.get(profileName);
    if (cachedConfig) {
      return { ...cachedConfig };
    }

    const profilePath = path.join(
      processedOptions.profileDir,
      `${profileName}.json`,
    );

    try {
      const config = await this.readProfileFile(profilePath);
      const finalConfig = this.processProfileConfig(
        config,
        profileName,
        processedOptions,
      );

      // Cache the profile
      this.profileCache.set(profileName, { ...finalConfig });

      return finalConfig;
    } catch (error) {
      return this.handleProfileLoadError(error, profileName);
    }
  }

  /**
   * Read and parse a profile file
   */
  private async readProfileFile(
    profilePath: string,
  ): Promise<PartialAppConfig> {
    // Check if profile file exists
    await fs.access(profilePath);

    // Read and parse profile
    const content = await fs.readFile(profilePath, 'utf-8');
    return JSON.parse(content) as PartialAppConfig;
  }

  /**
   * Validate a profile configuration
   */
  private validateProfileConfig(
    config: PartialAppConfig,
    profileName: string,
  ): void {
    const schemaResult = this.schemaValidator.validate(config);
    const semanticResult = this.semanticValidator.validate(config);

    if (!schemaResult.valid || !semanticResult.valid) {
      const errors = [...schemaResult.errors, ...semanticResult.errors];
      throw new ConfigurationError(
        `Profile '${profileName}' is invalid: ${errors.map(e => e.message).join(', ')}`,
        'INVALID_PROFILE',
      );
    }
  }

  /**
   * Handle profile load errors
   */
  private handleProfileLoadError(error: unknown, profileName: string): never {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    throw new ConfigurationError(
      `Failed to load profile '${profileName}': ${error instanceof Error ? error.message : String(error)}`,
      'PROFILE_LOAD_ERROR',
    );
  }

  /**
   * Detect profile from environment or configuration
   *
   * @param env - Environment variables (defaults to process.env)
   * @param config - Existing configuration
   * @returns Promise<ProfileType | null>
   */
  detectProfile(
    env: Record<string, string | undefined> = process.env,
    config?: PartialAppConfig,
  ): ProfileType | null {
    // Check environment variable first
    const envProfile = env.CODE_SCOUT_PROFILE as ProfileType;
    if (this.isValidProfile(envProfile)) {
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
    customDir?: string,
  ): Promise<ProfileInfo> {
    const targetDir = customDir ?? this.profilesDir;
    const profilePath = path.join(targetDir, `${profileName}.json`);

    try {
      // Validate configuration before saving
      this.validateProfileConfig(config, profileName);

      // Ensure directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Create and write profile
      const profileConfig = this.createProfileConfig(config, profileName);
      await this.writeProfileFile(profilePath, profileConfig);

      // Clear cache
      this.profileCache.delete(profileName);

      return this.createProfileInfo(profileName, profilePath, profileConfig);
    } catch (error) {
      return this.handleProfileSaveError(error, profileName);
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
    customDir?: string,
  ): Promise<void> {
    const targetDir = customDir ?? this.profilesDir;
    const profilePath = path.join(targetDir, `${profileName}.json`);

    try {
      await fs.unlink(profilePath);
      this.profileCache.delete(profileName);
    } catch (error) {
      throw new ConfigurationError(
        `Failed to delete profile '${profileName}': ${error instanceof Error ? error.message : String(error)}`,
        'PROFILE_DELETE_ERROR',
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

    return descriptions[profileName];
  }

  /**
   * Load default profile (base configuration)
   *
   * @returns Promise<PartialAppConfig>
   */
  private loadDefaultProfile(): PartialAppConfig {
    return {
      version: '1.0.0',
      indexing: this.getDefaultIndexingConfig(),
      search: this.getDefaultSearchConfig(),
      database: this.getDefaultDatabaseConfig(),
      watching: this.getDefaultWatchingConfig(),
      languages: this.getDefaultLanguagesConfig(),
      logging: this.getDefaultLoggingConfig(),
      security: this.getDefaultSecurityConfig(),
    };
  }

  /**
   * Auto-detect profile based on environment
   *
   * @param env - Environment variables
   * @returns Detected profile or null
   */
  private autoDetectProfile(
    env: Record<string, string | undefined>,
  ): ProfileType | null {
    if (this.isCiEnvironment(env)) {
      return 'cicd';
    }

    if (this.isProductionEnvironment(env)) {
      return 'production';
    }

    if (this.isDevelopmentEnvironment(env)) {
      return 'development';
    }

    // Default to development for local development
    return 'development';
  }

  private isCiEnvironment(env: Record<string, string | undefined>): boolean {
    return Boolean(
      env.CI ??
      env.CONTINUOUS_INTEGRATION ??
      env.JENKINS_URL ??
      env.GITHUB_ACTIONS,
    );
  }

  private isProductionEnvironment(
    env: Record<string, string | undefined>,
  ): boolean {
    return env.NODE_ENV === 'production' || env.PRODUCTION === 'true';
  }

  private isDevelopmentEnvironment(
    env: Record<string, string | undefined>,
  ): boolean {
    return !!(
      env.NODE_ENV === 'development' ||
      env.DEV === 'true' ||
      process.env.DEBUG
    );
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
   * Process load options with defaults
   */
  private processLoadOptions(
    options: ProfileLoadOptions,
  ): Required<ProfileLoadOptions> {
    return {
      validate: options.validate ?? true,
      mergeWithDefaults: options.mergeWithDefaults ?? true,
      profileDir: options.profileDir ?? this.profilesDir,
    };
  }

  /**
   * Process profile configuration after loading
   */
  private processProfileConfig(
    config: PartialAppConfig,
    profileName: ProfileType,
    options: Required<ProfileLoadOptions>,
  ): PartialAppConfig {
    let processedConfig = config;

    // Validate if requested
    if (options.validate) {
      this.validateProfileConfig(processedConfig, profileName);
    }

    // Merge with defaults if requested
    if (options.mergeWithDefaults) {
      const defaults = this.loadDefaultProfile();
      processedConfig = this.mergeConfigurations(defaults, processedConfig);
    }

    return processedConfig;
  }

  /**
   * Create profile configuration for saving
   */
  private createProfileConfig(
    config: PartialAppConfig,
    profileName: ProfileType,
  ): PartialAppConfig {
    return {
      ...config,
      version: config.version ?? '1.0.0',
      profile: profileName,
    };
  }

  /**
   * Write profile file
   */
  private async writeProfileFile(
    profilePath: string,
    config: PartialAppConfig,
  ): Promise<void> {
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(profilePath, content, 'utf-8');
  }

  /**
   * Create profile info
   */
  private createProfileInfo(
    profileName: ProfileType,
    profilePath: string,
    config: PartialAppConfig,
  ): ProfileInfo {
    return {
      name: profileName,
      description: this.getProfileDescription(profileName),
      filePath: profilePath,
      builtIn: false, // Custom profiles are not built-in
      version: config.version ?? '1.0.0',
    };
  }

  /**
   * Handle profile save errors
   */
  private handleProfileSaveError(error: unknown, profileName: string): never {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    throw new ConfigurationError(
      `Failed to save profile '${profileName}': ${error instanceof Error ? error.message : String(error)}`,
      'PROFILE_SAVE_ERROR',
    );
  }

  /**
   * Get default indexing configuration
   */
  private getDefaultIndexingConfig(): IndexingConfig {
    const BYTES_PER_KB = 1024;
    const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;
    const DEFAULT_MAX_FILE_SIZE_MB = 10;

    return {
      maxFileSize: DEFAULT_MAX_FILE_SIZE_MB * BYTES_PER_MB,
      maxWorkers: 4,
      batchSize: 100,
      debounceMs: 300,
      batchWindowMs: 100,
      followSymlinks: false,
      maxDepth: 10,
      incremental: true,
    };
  }

  /**
   * Get default search configuration
   */
  private getDefaultSearchConfig(): SearchConfig {
    return {
      defaultLimit: 50,
      maxLimit: 1000,
      scoringWeights: {
        filename: 1.0,
        path: 0.8,
        definitions: 0.9,
        imports: 0.7,
        documentation: 0.6,
        content: 0.5,
      },
      fuzzySearch: true,
      fuzzyThreshold: 0.8,
      enableRegex: true,
      timeoutMs: 5000,
    };
  }

  /**
   * Get default database configuration
   */
  private getDefaultDatabaseConfig(): DatabaseConfig {
    return {
      path: './data/code-scout.db',
      maxConnections: 10,
      connectionTimeout: 30000,
      type: 'sqlite',
      enableWAL: true,
      vacuumIntervalHours: 24,
    };
  }

  /**
   * Get default watching configuration
   */
  private getDefaultWatchingConfig(): WatchingConfig {
    return {
      enabled: true,
      ignorePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.py'],
      recursive: true,
      debounceMs: 300,
    };
  }

  /**
   * Get default languages configuration
   */
  private getDefaultLanguagesConfig(): LanguagesConfig {
    return {
      typescript: {
        extensions: ['.ts', '.tsx'],
        parser: 'typescript',
        enabled: true,
      },
      javascript: {
        extensions: ['.js', '.jsx', '.mjs'],
        parser: 'javascript',
        enabled: true,
      },
      python: {
        extensions: ['.py'],
        parser: 'python',
        enabled: true,
      },
    };
  }

  /**
   * Get default logging configuration
   */
  private getDefaultLoggingConfig(): LoggingConfig {
    return {
      level: 'info',
      format: 'text',
      file: {
        enabled: true,
        path: LOG_FILE_CONFIG.DEFAULT_PATH,
        maxSize: LOG_FILE_CONFIG.DEFAULT_MAX_SIZE,
        maxFiles: LOG_FILE_CONFIG.DEFAULT_MAX_FILES,
      },
      console: {
        enabled: true,
        colorize: true,
      },
      structured: false,
    };
  }

  /**
   * Get default security configuration
   */
  private getDefaultSecurityConfig(): SecurityConfig {
    return {
      allowedExtensions: ['.ts', '.js', '.py', '.json', '.md', '.txt'],
      blockedPatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      maxPathLength: 4096,
      enableSandbox: true,
      sandbox: {
        timeoutMs: 10000,
        memoryLimitMB: 512,
        allowNetworkAccess: false,
      },
    };
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
    override: PartialAppConfig,
  ): PartialAppConfig {
    const mergeDeep = (
      target: Record<string, unknown>,
      source: Record<string, unknown>,
    ): Record<string, unknown> => {
      const result = { ...target };

      for (const key in source) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          result[key] = mergeDeep(
            result[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>,
          );
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

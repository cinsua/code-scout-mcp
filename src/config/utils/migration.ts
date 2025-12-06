/**
 * Configuration Migration Manager
 *
 * This module provides functionality for migrating configuration files
 * between different versions, handling deprecations, and maintaining
 * backward compatibility.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type {
  PartialAppConfig,
  ConfigurationMigration,
} from '../types/ConfigTypes';

/**
 * Migration result
 */
export interface MigrationResult {
  /**
   * Whether migration was successful
   */
  success: boolean;

  /**
   * Original version
   */
  fromVersion: string;

  /**
   * Target version
   */
  toVersion: string;

  /**
   * Migrated configuration
   */
  config?: PartialAppConfig;

  /**
   * Migration warnings
   */
  warnings: string[];

  /**
   * Migration errors
   */
  errors: string[];

  /**
   * Applied migrations
   */
  appliedMigrations: string[];
}

/**
 * Migration manager options
 */
export interface MigrationManagerOptions {
  /**
   * Current version of the configuration schema
   */
  currentVersion: string;

  /**
   * Whether to create backups before migration
   */
  createBackup?: boolean;

  /**
   * Backup directory
   */
  backupDir?: string;

  /**
   * Whether to validate after migration
   */
  validateAfterMigration?: boolean;
}

/**
 * Configuration Migration Manager class
 */
export class MigrationManager {
  private options: Required<MigrationManagerOptions>;
  private migrations: ConfigurationMigration[] = [];

  constructor(options: MigrationManagerOptions) {
    this.options = {
      currentVersion: options.currentVersion,
      createBackup: options.createBackup ?? true,
      backupDir: options.backupDir ?? './.code-scout/migrations',
      validateAfterMigration: options.validateAfterMigration ?? true,
    };

    this.initializeMigrations();
  }

  /**
   * Migrate configuration to current version
   *
   * @param config - Configuration to migrate
   * @param targetVersion - Target version (defaults to current)
   * @returns Promise<MigrationResult>
   */
  async migrate(
    config: PartialAppConfig,
    targetVersion?: string,
  ): Promise<MigrationResult> {
    const fromVersion = config.version ?? '1.0.0';
    const toVersion = targetVersion ?? this.options.currentVersion;

    const result: MigrationResult = {
      success: false,
      fromVersion,
      toVersion,
      warnings: [],
      errors: [],
      appliedMigrations: [],
    };

    try {
      // If already at target version, no migration needed
      if (this.compareVersions(fromVersion, toVersion) >= 0) {
        result.success = true;
        result.config = config;
        result.warnings.push(
          `Configuration is already at version ${fromVersion} or newer`,
        );
        return result;
      }

      // Create backup if requested
      if (this.options.createBackup) {
        await this.createBackup(config, fromVersion);
      }

      // Apply migrations sequentially
      let currentConfig = { ...config };
      let currentVersion = fromVersion;

      const applicableMigrations = this.getApplicableMigrations(
        currentVersion,
        toVersion,
      );

      for (const migration of applicableMigrations) {
        try {
          currentConfig = migration.migrate(currentConfig);
          currentVersion = migration.toVersion;
          result.appliedMigrations.push(
            `${migration.fromVersion} -> ${migration.toVersion}`,
          );
          result.warnings.push(`Applied migration: ${migration.description}`);
        } catch (error) {
          result.errors.push(
            `Migration ${migration.fromVersion} -> ${migration.toVersion} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          return result;
        }
      }

      // Update version in configuration
      currentConfig.version = toVersion;

      // Validate migrated configuration if requested
      if (this.options.validateAfterMigration) {
        const validationResult =
          await this.validateMigratedConfig(currentConfig);
        if (!validationResult.valid) {
          result.errors.push(
            ...validationResult.errors.map(
              (e: any) => `Validation error: ${e.message}`,
            ),
          );
          return result;
        }
        result.warnings.push(
          ...validationResult.warnings.map(
            (w: any) => `Validation warning: ${w.message}`,
          ),
        );
      }

      result.success = true;
      result.config = currentConfig;

      return result;
    } catch (error) {
      result.errors.push(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return result;
    }
  }

  /**
   * Check if configuration needs migration
   *
   * @param config - Configuration to check
   * @returns Whether migration is needed
   */
  needsMigration(config: PartialAppConfig): boolean {
    const currentVersion = config.version ?? '1.0.0';
    return (
      this.compareVersions(currentVersion, this.options.currentVersion) < 0
    );
  }

  /**
   * Get migration path from current to target version
   *
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @returns Array of migrations to apply
   */
  getMigrationPath(
    fromVersion: string,
    toVersion: string,
  ): ConfigurationMigration[] {
    return this.getApplicableMigrations(fromVersion, toVersion);
  }

  /**
   * Add a custom migration
   *
   * @param migration - Migration to add
   */
  addMigration(migration: ConfigurationMigration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) =>
      this.compareVersions(a.fromVersion, b.fromVersion),
    );
  }

  /**
   * Get all available migrations
   *
   * @returns Array of migrations
   */
  getMigrations(): ConfigurationMigration[] {
    return [...this.migrations];
  }

  /**
   * Initialize built-in migrations
   */
  private initializeMigrations(): void {
    // Migration 1.0.0 -> 1.1.0: Add security section
    this.addMigration({
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      description: 'Add security configuration section',
      migrate: config => {
        config.security ??= {
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
        };
        return config;
      },
    });

    // Migration 1.1.0 -> 1.2.0: Add logging section
    this.addMigration({
      fromVersion: '1.1.0',
      toVersion: '1.2.0',
      description: 'Add logging configuration section',
      migrate: config => {
        config.logging ??= {
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
        };
        return config;
      },
    });

    // Migration 1.2.0 -> 1.3.0: Update scoring weights
    this.addMigration({
      fromVersion: '1.2.0',
      toVersion: '1.3.0',
      description: 'Update search scoring weights and add content weight',
      migrate: config => {
        if (
          config.search &&
          typeof config.search === 'object' &&
          'scoringWeights' in config.search
        ) {
          const weights = (config.search as any).scoringWeights;
          weights.content ??= 2.0;
          // Adjust other weights for better balance
          if (weights.filename === 5.0) {
            weights.filename = 5.0;
          }
          if (weights.path === 3.0) {
            weights.path = 3.0;
          }
        }
        return config;
      },
    });

    // Migration 1.3.0 -> 1.4.0: Add profile support
    this.addMigration({
      fromVersion: '1.3.0',
      toVersion: '1.4.0',
      description: 'Add profile support and version tracking',
      migrate: config => {
        if (!config.profile) {
          // Auto-detect profile based on existing settings
          const logging = config.logging as any;
          const watching = config.watching as any;
          if (logging?.level === 'debug' && watching?.enabled) {
            config.profile = 'development';
          } else if (logging?.level === 'warn' && !watching?.enabled) {
            config.profile = 'production';
          } else {
            config.profile = 'development';
          }
        }
        return config;
      },
    });

    // Migration 1.4.0 -> 1.5.0: Add database WAL settings
    this.addMigration({
      fromVersion: '1.4.0',
      toVersion: '1.5.0',
      description: 'Add database WAL and vacuum settings',
      migrate: config => {
        if (config.database) {
          const database = config.database as any;
          if (database.enableWAL === undefined) {
            database.enableWAL = database.type === 'sqlite';
          }
          if (database.vacuumIntervalHours === undefined) {
            database.vacuumIntervalHours = 24;
          }
        }
        return config;
      },
    });
  }

  /**
   * Get applicable migrations for version range
   *
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @returns Array of applicable migrations
   */
  private getApplicableMigrations(
    fromVersion: string,
    toVersion: string,
  ): ConfigurationMigration[] {
    return this.migrations.filter(
      migration =>
        this.compareVersions(migration.fromVersion, fromVersion) >= 0 &&
        this.compareVersions(migration.toVersion, toVersion) <= 0,
    );
  }

  /**
   * Compare two version strings
   *
   * @param a - First version
   * @param b - Second version
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] ?? 0;
      const bPart = bParts[i] ?? 0;

      if (aPart < bPart) {
        return -1;
      }
      if (aPart > bPart) {
        return 1;
      }
    }

    return 0;
  }

  /**
   * Create backup of configuration before migration
   *
   * @param config - Configuration to backup
   * @param version - Current version
   * @returns Promise<void>
   */
  private async createBackup(
    config: PartialAppConfig,
    version: string,
  ): Promise<void> {
    try {
      await fs.mkdir(this.options.backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
      const backupPath = path.join(
        this.options.backupDir,
        `config-backup-v${version}-${timestamp}.json`,
      );

      await fs.writeFile(backupPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch {
      // Don't fail migration if backup fails
    }
  }

  /**
   * Validate migrated configuration
   *
   * @param config - Configuration to validate
   * @returns Promise<ValidationResult>
   */
  private async validateMigratedConfig(config: PartialAppConfig): Promise<any> {
    // Import validators dynamically to avoid circular dependencies
    const { SchemaValidator } = await import('../validators/SchemaValidator');
    const { SemanticValidator } =
      await import('../validators/SemanticValidator');

    const schemaValidator = new SchemaValidator();
    const semanticValidator = new SemanticValidator();

    const schemaResult = schemaValidator.validate(config);
    const semanticResult = semanticValidator.validate(config);

    return {
      valid: schemaResult.valid && semanticResult.valid,
      errors: [...schemaResult.errors, ...semanticResult.errors],
      warnings: [...schemaResult.warnings, ...semanticResult.warnings],
    };
  }
}

/**
 * Create a migration manager instance
 *
 * @param options - Migration manager options
 * @returns MigrationManager instance
 */
export function createMigrationManager(
  options: MigrationManagerOptions,
): MigrationManager {
  return new MigrationManager(options);
}

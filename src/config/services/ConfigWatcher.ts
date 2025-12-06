/**
 * Configuration Watcher
 *
 * This module provides file watching capabilities for configuration files,
 * enabling hot reloading of configuration changes without service restart.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

import * as chokidar from 'chokidar';

import { ConfigurationError } from '../errors/ConfigurationError';
import type {
  PartialAppConfig,
  ConfigurationChangeEvent,
} from '../types/ConfigTypes';
import { SchemaValidator } from '../validators/SchemaValidator';
import { SemanticValidator } from '../validators/SemanticValidator';

/**
 * Configuration watcher options
 */
export interface ConfigWatcherOptions {
  /**
   * Whether to enable hot reloading
   */
  enabled?: boolean;

  /**
   * Debounce time in milliseconds for file changes
   */
  debounceMs?: number;

  /**
   * Whether to watch for changes in subdirectories
   */
  recursive?: boolean;

  /**
   * Whether to ignore initial file read
   */
  ignoreInitial?: boolean;

  /**
   * File patterns to watch
   */
  patterns?: string[];

  /**
   * File patterns to ignore
   */
  ignored?: string[];

  /**
   * Whether to validate configuration before applying changes
   */
  validateBeforeApply?: boolean;

  /**
   * Whether to create backup before applying changes
   */
  createBackup?: boolean;

  /**
   * Maximum number of backup files to keep
   */
  maxBackups?: number;
}

/**
 * Configuration change event data
 */
export interface ConfigChangeEventData extends ConfigurationChangeEvent {
  /**
   * Timestamp of the change
   */
  timestamp: Date;

  /**
   * File path that changed
   */
  filePath: string;

  /**
   * Whether the change was validated successfully
   */
  validated?: boolean;

  /**
   * Validation errors if any
   */
  validationErrors?: string[];
}

/**
 * Configuration backup information
 */
export interface ConfigBackup {
  /**
   * Backup timestamp
   */
  timestamp: Date;

  /**
   * Backup file path
   */
  filePath: string;

  /**
   * Original file path
   */
  originalPath: string;

  /**
   * Configuration content
   */
  config: PartialAppConfig;
}

/**
 * Configuration Watcher class
 */
export class ConfigWatcher extends EventEmitter {
  private options: Required<ConfigWatcherOptions>;
  private watcher?: chokidar.FSWatcher;
  private watchedFiles: Set<string> = new Set();
  private debounceTimer?: NodeJS.Timeout;
  private schemaValidator: SchemaValidator;
  private semanticValidator: SemanticValidator;
  private backups: ConfigBackup[] = [];
  private currentConfig: PartialAppConfig = {};

  constructor(options: ConfigWatcherOptions = {}) {
    super();

    this.options = {
      enabled: options.enabled ?? true,
      debounceMs: options.debounceMs ?? 300,
      recursive: options.recursive ?? false,
      ignoreInitial: options.ignoreInitial ?? true,
      patterns: options.patterns ?? [
        '**/*.json',
        '**/*.yaml',
        '**/*.yml',
        '**/*.toml',
      ],
      ignored: options.ignored ?? [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
      ],
      validateBeforeApply: options.validateBeforeApply ?? true,
      createBackup: options.createBackup ?? true,
      maxBackups: options.maxBackups ?? 5,
    };

    this.schemaValidator = new SchemaValidator();
    this.semanticValidator = new SemanticValidator();
  }

  /**
   * Start watching configuration files
   *
   * @param filePaths - Array of file paths to watch
   * @returns Promise<void>
   */
  async startWatching(filePaths: string[]): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    if (this.watcher) {
      await this.stopWatching();
    }

    // Normalize file paths
    const normalizedPaths = filePaths.map(filePath => path.resolve(filePath));

    // Create watcher
    this.watcher = chokidar.watch(normalizedPaths, {
      ignored: this.options.ignored,
      persistent: true,
      ignoreInitial: this.options.ignoreInitial,
      followSymlinks: false,
      cwd: process.cwd(),
      disableGlobbing: false,
      usePolling: false,
      interval: 100,
      binaryInterval: 300,
      alwaysStat: true,
      depth: this.options.recursive ? undefined : 1,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    // Set up event handlers
    this.watcher
      .on('add', filePath => this.handleFileAdd(filePath))
      .on('change', filePath => this.handleFileChange(filePath))
      .on('unlink', filePath => this.handleFileDelete(filePath))
      .on('error', error => this.handleWatcherError(error));

    // Add to watched files
    normalizedPaths.forEach(filePath => this.watchedFiles.add(filePath));

    this.emit('watcher:started', { paths: normalizedPaths });
  }

  /**
   * Stop watching configuration files
   *
   * @returns Promise<void>
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      this.watchedFiles.clear();

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = undefined;
      }

      this.emit('watcher:stopped');
    }
  }

  /**
   * Add a file to watch
   *
   * @param filePath - File path to add
   * @returns Promise<void>
   */
  addFile(filePath: string): void {
    const resolvedPath = path.resolve(filePath);

    if (!this.watchedFiles.has(resolvedPath)) {
      if (this.watcher) {
        this.watcher.add(resolvedPath);
      }
      this.watchedFiles.add(resolvedPath);
      this.emit('file:added', { filePath: resolvedPath });
    }
  }

  /**
   * Remove a file from watching
   *
   * @param filePath - File path to remove
   * @returns Promise<void>
   */
  removeFile(filePath: string): void {
    const resolvedPath = path.resolve(filePath);

    if (this.watchedFiles.has(resolvedPath)) {
      if (this.watcher) {
        this.watcher.unwatch(resolvedPath);
      }
      this.watchedFiles.delete(resolvedPath);
      this.emit('file:removed', { filePath: resolvedPath });
    }
  }

  /**
   * Get list of currently watched files
   *
   * @returns Array of watched file paths
   */
  getWatchedFiles(): string[] {
    return Array.from(this.watchedFiles);
  }

  /**
   * Set current configuration for comparison
   *
   * @param config - Current configuration
   */
  setCurrentConfig(config: PartialAppConfig): void {
    this.currentConfig = { ...config };
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getCurrentConfig(): PartialAppConfig {
    return { ...this.currentConfig };
  }

  /**
   * Create a backup of current configuration
   *
   * @param config - Configuration to backup
   * @returns Promise<ConfigBackup>
   */
  async createBackup(config: PartialAppConfig): Promise<ConfigBackup> {
    const timestamp = new Date();
    const backupPath = this.generateBackupPath(timestamp);

    const backup: ConfigBackup = {
      timestamp,
      filePath: backupPath,
      originalPath: 'current',
      config: { ...config },
    };

    // Write backup to file
    try {
      await fs.writeFile(backupPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      throw new ConfigurationError(
        `Failed to create configuration backup: ${error instanceof Error ? error.message : String(error)}`,
        'BACKUP_FAILED',
      );
    }

    // Add to backups array and maintain max backups
    this.backups.push(backup);
    await this.maintainBackups();

    this.emit('backup:created', backup);
    return backup;
  }

  /**
   * Restore configuration from backup
   *
   * @param backup - Backup to restore from
   * @returns Promise<PartialAppConfig>
   */
  restoreFromBackup(backup: ConfigBackup): PartialAppConfig {
    try {
      // Validate backup configuration
      if (this.options.validateBeforeApply) {
        const schemaResult = this.schemaValidator.validate(backup.config);
        const semanticResult = this.semanticValidator.validate(backup.config);

        if (!schemaResult.valid || !semanticResult.valid) {
          const errors = [...schemaResult.errors, ...semanticResult.errors];
          throw new ConfigurationError(
            `Backup configuration is invalid: ${errors.map(e => e.message).join(', ')}`,
            'INVALID_BACKUP',
          );
        }
      }

      // Apply backup configuration
      this.currentConfig = { ...backup.config };

      this.emit('backup:restored', backup);
      return backup.config;
    } catch (error) {
      throw new ConfigurationError(
        `Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`,
        'RESTORE_FAILED',
      );
    }
  }

  /**
   * Get list of available backups
   *
   * @returns Array of backups
   */
  getBackups(): ConfigBackup[] {
    return [...this.backups].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  /**
   * Delete old backups to maintain maximum count
   */
  private async maintainBackups(): Promise<void> {
    if (this.backups.length > this.options.maxBackups) {
      const sortedBackups = this.backups.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      const toDelete = sortedBackups.slice(
        0,
        this.backups.length - this.options.maxBackups,
      );

      await Promise.allSettled(
        toDelete.map(async backup => {
          try {
            await fs.unlink(backup.filePath);
          } catch {
            // Ignore errors when deleting backup files
          }
        }),
      );

      this.backups = this.backups.filter(backup => !toDelete.includes(backup));
    }
  }

  /**
   * Generate backup file path
   *
   * @param timestamp - Backup timestamp
   * @returns Backup file path
   */
  private generateBackupPath(timestamp: Date): string {
    const timestampStr = timestamp.toISOString().replace(/[.:]/g, '-');
    return path.join(
      process.cwd(),
      `.code-scout`,
      `backups`,
      `config-backup-${timestampStr}.json`,
    );
  }

  /**
   * Handle file addition event
   *
   * @param filePath - File path that was added
   */
  private handleFileAdd(filePath: string): void {
    this.emit('file:added', { filePath });
    this.scheduleConfigCheck(filePath, 'added');
  }

  /**
   * Handle file change event
   *
   * @param filePath - File path that changed
   */
  private handleFileChange(filePath: string): void {
    this.emit('file:changed', { filePath });
    this.scheduleConfigCheck(filePath, 'updated');
  }

  /**
   * Handle file deletion event
   *
   * @param filePath - File path that was deleted
   */
  private handleFileDelete(filePath: string): void {
    this.emit('file:deleted', { filePath });
    this.scheduleConfigCheck(filePath, 'removed');
  }

  /**
   * Handle watcher error
   *
   * @param error - Error that occurred
   */
  private handleWatcherError(error: Error): void {
    this.emit('watcher:error', { error });
  }

  /**
   * Schedule configuration check with debouncing
   *
   * @param filePath - File path to check
   * @param changeType - Type of change
   */
  private scheduleConfigCheck(
    filePath: string,
    changeType: 'added' | 'updated' | 'removed',
  ): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.checkConfigurationChange(filePath, changeType);
    }, this.options.debounceMs);
  }

  /**
   * Check and process configuration change
   *
   * @param filePath - File path that changed
   * @param changeType - Type of change
   */
  private async checkConfigurationChange(
    filePath: string,
    changeType: 'added' | 'updated' | 'removed',
  ): Promise<void> {
    try {
      let newConfig: PartialAppConfig = {};
      let oldValue: unknown = undefined;
      let newValue: unknown = undefined;

      // Get old configuration value
      oldValue = this.getConfigValue(this.currentConfig, filePath);

      if (changeType !== 'removed') {
        // Read new configuration
        const content = await fs.readFile(filePath, 'utf-8');
        newConfig = JSON.parse(content);
        newValue = newConfig;
      }

      // Validate new configuration
      let validated = true;
      const validationErrors: string[] = [];

      if (this.options.validateBeforeApply && changeType !== 'removed') {
        const schemaResult = this.schemaValidator.validate(newConfig);
        const semanticResult = this.semanticValidator.validate(newConfig);

        if (!schemaResult.valid || !semanticResult.valid) {
          validated = false;
          validationErrors.push(
            ...schemaResult.errors.map(e => e.message),
            ...semanticResult.errors.map(e => e.message),
          );
        }
      }

      // Create backup before applying changes
      if (this.options.createBackup && validated && changeType !== 'removed') {
        await this.createBackup(this.currentConfig);
      }

      // Apply changes if validated
      if (validated) {
        if (changeType === 'removed') {
          this.removeConfigValue(this.currentConfig, filePath);
        } else {
          this.mergeConfig(this.currentConfig, newConfig);
        }

        // Emit change event
        const eventData: ConfigChangeEventData = {
          type: changeType,
          path: filePath,
          oldValue,
          newValue,
          source: 'file-watcher',
          timestamp: new Date(),
          filePath,
          validated,
          validationErrors: undefined,
        };

        this.emit('config:changed', eventData);
      } else {
        // Emit validation error event
        this.emit('config:validation-error', {
          filePath,
          errors: validationErrors,
          changeType,
        });
      }
    } catch (error) {
      this.emit('config:error', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        changeType,
      });
    }
  }

  /**
   * Get configuration value for a file path
   *
   * @param config - Configuration object
   * @param _filePath - File path (unused in simplified implementation)
   * @returns Configuration value
   */
  private getConfigValue(config: PartialAppConfig, _filePath: string): unknown {
    // This is a simplified implementation
    // In practice, you'd want to map file paths to configuration sections
    return config;
  }

  /**
   * Remove configuration value for a file path
   *
   * @param config - Configuration object (unused in simplified implementation)
   * @param _filePath - File path (unused in simplified implementation)
   */
  private removeConfigValue(
    _config: PartialAppConfig,
    _filePath: string,
  ): void {
    // This is a simplified implementation
    // In practice, you'd want to map file paths to configuration sections
  }

  /**
   * Merge new configuration into existing configuration
   *
   * @param target - Target configuration
   * @param source - Source configuration to merge
   */
  private mergeConfig(
    target: PartialAppConfig,
    source: PartialAppConfig,
  ): void {
    // Deep merge configuration
    const mergeDeep = (target: any, source: any): any => {
      for (const key in source) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          target[key] = target[key] ?? {};
          mergeDeep(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };

    mergeDeep(target, source);
  }

  /**
   * Destroy the watcher and clean up resources
   *
   * @returns Promise<void>
   */
  async destroy(): Promise<void> {
    await this.stopWatching();
    this.removeAllListeners();
    this.backups = [];
    this.currentConfig = {};
  }
}

/**
 * Create a default configuration watcher instance
 *
 * @param options - Watcher options
 * @returns ConfigWatcher instance
 */
export function createConfigWatcher(
  options?: ConfigWatcherOptions,
): ConfigWatcher {
  return new ConfigWatcher(options);
}

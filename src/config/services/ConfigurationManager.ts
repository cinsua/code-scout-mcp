/**
 * Configuration Manager
 *
 * This file provides the main orchestration service for loading,
 * validating, and managing configuration from multiple sources.
 */

import { EventEmitter } from 'events';

import type {
  AppConfig,
  PartialAppConfig,
  ConfigurationSource,
  ValidationResult,
  ConfigurationChangeEvent,
} from '../types/ConfigTypes';
import {
  ConfigurationError,
  BatchValidationError,
} from '../errors/ConfigurationError';
// Import all configuration sources
import { DefaultConfiguration } from '../sources/DefaultConfiguration';
import { GlobalConfiguration } from '../sources/GlobalConfiguration';
import { ProjectConfiguration } from '../sources/ProjectConfiguration';
import { EnvironmentConfiguration } from '../sources/EnvironmentConfiguration';
import { CommandLineConfiguration } from '../sources/CommandLineConfiguration';
import {
  Configuration,
  ConfigurationHistory,
  ConfigurationSnapshot,
} from '../models/Configuration';

/**
 * Main configuration manager that orchestrates all configuration sources
 */
export class ConfigurationManager extends EventEmitter {
  private configuration: Configuration;
  private history: ConfigurationHistory;
  private sources: ConfigurationSource[] = [];
  private isLoading: boolean = false;
  private loadPromise: Promise<AppConfig> | null = null;

  constructor() {
    super();
    this.configuration = new Configuration();
    this.history = new ConfigurationHistory();
    this.initializeSources();
    this.setupEventHandlers();
  }

  /**
   * Initialize all configuration sources
   */
  private initializeSources(): void {
    this.sources = [
      new DefaultConfiguration(),
      new GlobalConfiguration(),
      new ProjectConfiguration(),
      new EnvironmentConfiguration(),
      new CommandLineConfiguration(),
    ];

    // Sort by priority (lower number = higher priority)
    this.sources.sort((a, b) => a.priority - b.priority);

    // Register sources with configuration model
    for (const source of this.sources) {
      this.configuration.addSource(source);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.configuration.on(
      'config:changed',
      (change: ConfigurationChangeEvent) => {
        this.emit('config:changed', change);
      },
    );

    this.configuration.on(
      'config:loaded',
      (data: { config: AppConfig; source: string }) => {
        this.emit('config:loaded', data);
      },
    );

    this.configuration.on('config:validated', (result: ValidationResult) => {
      this.emit('config:validated', result);
    });
  }

  /**
   * Load configuration from all sources
   */
  async loadConfiguration(): Promise<AppConfig> {
    // Prevent concurrent loading
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.emit('config:loading:start');

    try {
      this.loadPromise = this.performLoad();
      const config = await this.loadPromise;

      // Create snapshot before applying
      const snapshot = new ConfigurationSnapshot(
        config,
        new Date(),
        'load',
        'Configuration loaded from all sources',
      );
      this.history.addSnapshot(snapshot);

      // Set configuration
      this.configuration.setConfig(config, 'manager');

      this.emit('config:loading:complete');
      return config;
    } catch (error) {
      this.emit('config:loading:error', error);
      throw error;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  /**
   * Perform the actual loading process
   */
  private async performLoad(): Promise<AppConfig> {
    const loadResults: Array<{
      source: ConfigurationSource;
      config: PartialAppConfig;
      error?: Error;
    }> = [];

    // Load from all sources in parallel
    const loadPromises = this.sources.map(async source => {
      try {
        const isAvailable = await source.isAvailable();
        if (!isAvailable) {
          return { source, config: {} };
        }

        const config = await source.load();
        return { source, config };
      } catch (error) {
        return {
          source,
          config: {},
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    });

    const results = await Promise.all(loadPromises);
    loadResults.push(...results);

    // Check for critical errors
    const criticalErrors = loadResults.filter(r => r.error);
    if (criticalErrors.length > 0) {
      const errorMessages = criticalErrors.map(
        r => `${r.source.name}: ${r.error?.message ?? 'Unknown error'}`,
      );
      throw new ConfigurationError(
        `Failed to load configuration from ${criticalErrors.length} source(s):\n${errorMessages.join('\n')}`,
        'SOURCE_ERROR',
        {
          suggestions: [
            'Check configuration file permissions',
            'Verify configuration format',
          ],
        },
      );
    }

    // Merge configurations in priority order
    const mergedConfig = this.mergeConfigurations(
      loadResults.map(r => r.config),
    );

    // Validate merged configuration
    const validationResult = this.validateConfiguration(mergedConfig);
    this.configuration.setValidationResult(validationResult);

    if (!validationResult.valid) {
      throw new BatchValidationError(validationResult.errors);
    }

    return mergedConfig as AppConfig;
  }

  /**
   * Merge multiple configuration objects in priority order
   */
  private mergeConfigurations(configs: PartialAppConfig[]): PartialAppConfig {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, {} as PartialAppConfig);
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] === undefined || source[key] === null) {
        continue;
      }

      if (this.isObject(source[key]) && this.isObject(target[key])) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Check if value is an object
   */
  private isObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(config: PartialAppConfig): ValidationResult {
    const errors: Array<{
      path: string;
      message: string;
      code: string;
      suggestion?: string;
    }> = [];
    const warnings: Array<{ path: string; message: string; code: string }> = [];

    // Basic structural validation
    if (!config.version) {
      errors.push({
        path: 'version',
        message: 'Configuration version is required',
        code: 'MISSING_VERSION',
        suggestion: 'Add version field to configuration',
      });
    }

    // Validate search limits
    if (config.search) {
      if (config.search.defaultLimit && config.search.maxLimit) {
        if (config.search.defaultLimit > config.search.maxLimit) {
          errors.push({
            path: 'search.defaultLimit',
            message: 'Default search limit cannot exceed maximum limit',
            code: 'INVALID_SEARCH_LIMITS',
            suggestion: 'Set defaultLimit <= maxLimit',
          });
        }
      }
    }

    // Validate indexing configuration
    if (config.indexing) {
      if (
        config.indexing.maxWorkers &&
        (config.indexing.maxWorkers < 1 || config.indexing.maxWorkers > 64)
      ) {
        errors.push({
          path: 'indexing.maxWorkers',
          message: 'Max workers must be between 1 and 64',
          code: 'INVALID_WORKER_COUNT',
          suggestion: 'Set maxWorkers to a value between 1 and 64',
        });
      }

      if (config.indexing.maxFileSize && config.indexing.maxFileSize < 1024) {
        errors.push({
          path: 'indexing.maxFileSize',
          message: 'Max file size must be at least 1024 bytes',
          code: 'INVALID_FILE_SIZE',
          suggestion: 'Set maxFileSize to at least 1024',
        });
      }
    }

    // Validate database configuration
    if (config.database) {
      if (
        config.database.maxConnections &&
        (config.database.maxConnections < 1 ||
          config.database.maxConnections > 100)
      ) {
        errors.push({
          path: 'database.maxConnections',
          message: 'Max connections must be between 1 and 100',
          code: 'INVALID_CONNECTION_COUNT',
          suggestion: 'Set maxConnections to a value between 1 and 100',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.map(e => ({
        path: e.path,
        message: e.message,
        code: e.code,
        suggestion: e.suggestion,
      })),
      warnings: warnings.map(w => ({
        path: w.path,
        message: w.message,
        code: w.code,
      })),
      config,
    };
  }

  /**
   * Reload configuration from all sources
   */
  async reloadConfiguration(): Promise<AppConfig> {
    this.emit('config:reload:start');

    try {
      const config = await this.loadConfiguration();
      this.emit('config:reload:complete', { config });
      return config;
    } catch (error) {
      this.emit('config:reload:error', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): AppConfig {
    return this.configuration.config;
  }

  /**
   * Get configuration value by path
   */
  get<T = unknown>(path: string): T {
    return this.configuration.getPath(path) as T;
  }

  /**
   * Check if configuration has a path
   */
  has(path: string): boolean {
    return this.configuration.hasPath(path);
  }

  /**
   * Get configuration section
   */
  getSection<T = unknown>(section: string): T {
    return this.configuration.getSection<T>(section);
  }

  /**
   * Update configuration value
   */
  async updateConfiguration(
    path: string,
    value: unknown,
    source: string = 'manual',
  ): Promise<void> {
    // Create snapshot before update
    const snapshot = new ConfigurationSnapshot(
      this.configuration.config,
      new Date(),
      source,
      `Update ${path} to ${JSON.stringify(value)}`,
    );
    this.history.addSnapshot(snapshot);

    // Validate the update
    const testConfig = this.configuration.clone();
    this.setNestedValue(testConfig, path, value);

    const validationResult = this.validateConfiguration(testConfig);
    if (!validationResult.valid) {
      throw new BatchValidationError(validationResult.errors);
    }

    // Apply the update
    this.configuration.updatePath(path, value, source);
    await Promise.resolve();
  }

  /**
   * Set nested value in object
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
   * Reset configuration to defaults
   */
  async resetConfiguration(): Promise<void> {
    const snapshot = new ConfigurationSnapshot(
      this.configuration.config,
      new Date(),
      'reset',
      'Reset to defaults',
    );
    this.history.addSnapshot(snapshot);

    // Load only defaults
    const defaultSource = this.sources.find(s => s.name === 'defaults');
    if (defaultSource) {
      const defaultConfig = await defaultSource.load();
      this.configuration.setConfig(defaultConfig as AppConfig, 'reset');
      this.emit('config:reset');
    }
  }

  /**
   * Export configuration
   */
  exportConfiguration(pretty: boolean = true): string {
    return this.configuration.export(pretty);
  }

  /**
   * Import configuration
   */
  async importConfiguration(
    json: string,
    source: string = 'import',
  ): Promise<void> {
    const snapshot = new ConfigurationSnapshot(
      this.configuration.config,
      new Date(),
      source,
      'Import configuration',
    );
    this.history.addSnapshot(snapshot);

    // Validate imported configuration
    const testConfig = JSON.parse(json);
    const validationResult = this.validateConfiguration(testConfig);
    if (!validationResult.valid) {
      throw new BatchValidationError(validationResult.errors);
    }

    this.configuration.import(json, source);
    this.emit('config:imported', { source });
    await Promise.resolve();
  }

  /**
   * Get configuration history
   */
  getHistory(): ConfigurationHistory {
    return this.history;
  }

  /**
   * Rollback to a previous configuration
   */
  async rollbackToSnapshot(snapshot: ConfigurationSnapshot): Promise<void> {
    const rollbackSnapshot = new ConfigurationSnapshot(
      this.configuration.config,
      new Date(),
      'rollback',
      `Rollback to ${snapshot.timestamp.toISOString()}`,
    );
    this.history.addSnapshot(rollbackSnapshot);

    this.configuration.setConfig(snapshot.config, 'rollback');
    this.emit('config:rollback', { snapshot });
    await Promise.resolve();
  }

  /**
   * Get all configuration sources
   */
  getSources(): ConfigurationSource[] {
    return [...this.sources];
  }

  /**
   * Get source by name
   */
  getSource(name: string): ConfigurationSource | undefined {
    return this.sources.find(s => s.name === name);
  }

  /**
   * Check if currently loading
   */
  getLoadingStatus(): boolean {
    return this.isLoading;
  }

  /**
   * Get last validation result
   */
  getLastValidation(): ValidationResult | null {
    return this.configuration.lastValidation;
  }

  /**
   * Destroy the configuration manager
   */
  destroy(): void {
    this.removeAllListeners();
    this.configuration.destroy();
    this.history.clear();
    this.sources = [];
    this.isLoading = false;
    this.loadPromise = null;
  }
}

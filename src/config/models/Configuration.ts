/**
 * Configuration Models
 *
 * This file contains the core configuration model classes and utilities
 * for managing configuration state and operations.
 */

import { EventEmitter } from 'events';

import type {
  AppConfig,
  PartialAppConfig,
  ConfigurationChangeEvent,
  ConfigurationSource,
  ValidationResult,
} from '../types/ConfigTypes';
import { ConfigurationError } from '../errors/ConfigurationError';

/**
 * Maximum number of configuration snapshots to keep
 */
const MAX_SNAPSHOTS = 10;

/**
 * Main configuration model that holds the current configuration state
 * and provides methods for accessing and modifying it.
 */
export class Configuration extends EventEmitter {
  private _config: AppConfig | null = null;
  private _sources: ConfigurationSource[] = [];
  private _lastValidation: ValidationResult | null = null;
  private _version: string = '1.0.0';

  /**
   * Get the current configuration
   */
  get config(): AppConfig {
    if (!this._config) {
      throw new ConfigurationError(
        'Configuration not loaded',
        'CONFIG_NOT_LOADED',
      );
    }
    return this._config;
  }

  /**
   * Check if configuration is loaded
   */
  get isLoaded(): boolean {
    return this._config !== null;
  }

  /**
   * Get configuration version
   */
  get version(): string {
    return this._version;
  }

  /**
   * Get registered configuration sources
   */
  get sources(): ConfigurationSource[] {
    return [...this._sources];
  }

  /**
   * Get last validation result
   */
  get lastValidation(): ValidationResult | null {
    return this._lastValidation;
  }

  /**
   * Set configuration and emit change events
   */
  setConfig(config: AppConfig, source: string = 'unknown'): void {
    const oldConfig = this._config;
    this._config = config;
    this._version = config.version;

    // Emit change events for modified properties
    if (oldConfig) {
      this.emitChanges(oldConfig, config, source);
    }

    this.emit('config:loaded', { config, source });
  }

  /**
   * Update a specific configuration path
   */
  updatePath(path: string, value: unknown, source: string = 'manual'): void {
    if (!this._config) {
      throw new ConfigurationError(
        'Configuration not loaded',
        'CONFIG_NOT_LOADED',
      );
    }

    const oldValue = this.getPath(path);
    this.setPath(path, value);

    const change: ConfigurationChangeEvent = {
      type: oldValue === undefined ? 'added' : 'updated',
      path,
      oldValue,
      newValue: value,
      source,
    };

    this.emit('config:changed', change);
    this.emit(`config:changed:${path}`, change);
  }

  /**
   * Get a value from configuration using dot notation
   */
  getPath(path: string): unknown {
    if (!this._config) {
      throw new ConfigurationError(
        'Configuration not loaded',
        'CONFIG_NOT_LOADED',
      );
    }

    return path.split('.').reduce((obj, key) => {
      return obj && typeof obj === 'object'
        ? (obj as Record<string, unknown>)[key]
        : undefined;
    }, this._config as unknown);
  }

  /**
   * Set a value in configuration using dot notation
   */
  setPath(path: string, value: unknown): void {
    if (!this._config) {
      throw new ConfigurationError(
        'Configuration not loaded',
        'CONFIG_NOT_LOADED',
      );
    }

    const keys = path.split('.').filter(key => key.length > 0);
    if (keys.length === 0) {
      throw new ConfigurationError(
        'Invalid configuration path',
        'INVALID_PATH',
      );
    }
    const lastKey = keys[keys.length - 1] as string;
    const targetKeys = keys.slice(0, -1);
    const target = targetKeys.reduce(
      (obj, key) => {
        if (!obj[key] || typeof obj[key] !== 'object') {
          obj[key] = {};
        }
        return obj[key] as Record<string, unknown>;
      },
      this._config as unknown as Record<string, unknown>,
    );

    target[lastKey] = value;
  }

  /**
   * Check if a path exists in the configuration
   */
  hasPath(path: string): boolean {
    return this.getPath(path) !== undefined;
  }

  /**
   * Get a section of the configuration
   */
  getSection<T = unknown>(section: string): T {
    const value = this.getPath(section);
    if (value === undefined) {
      throw new ConfigurationError(
        `Configuration section '${section}' not found`,
        'SECTION_NOT_FOUND',
      );
    }
    return value as T;
  }

  /**
   * Register a configuration source
   */
  addSource(source: ConfigurationSource): void {
    this._sources.push(source);
    this._sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a configuration source
   */
  removeSource(name: string): boolean {
    const index = this._sources.findIndex(source => source.name === name);
    if (index >= 0) {
      this._sources.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Set validation result
   */
  setValidationResult(result: ValidationResult): void {
    this._lastValidation = result;
    this.emit('config:validated', result);
  }

  /**
   * Export configuration to JSON string
   */
  export(pretty: boolean = true): string {
    if (!this._config) {
      throw new ConfigurationError(
        'Configuration not loaded',
        'CONFIG_NOT_LOADED',
      );
    }
    return JSON.stringify(this._config, null, pretty ? 2 : 0);
  }

  /**
   * Import configuration from JSON string
   */
  import(json: string, source: string = 'import'): void {
    try {
      const config = JSON.parse(json) as AppConfig;
      this.setConfig(config, source);
    } catch (error) {
      throw new ConfigurationError(
        `Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'IMPORT_FAILED',
      );
    }
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this._config = null;
    this._lastValidation = null;
    this._version = '1.0.0';
    this.emit('config:reset');
  }

  /**
   * Create a deep clone of the configuration
   */
  clone(): AppConfig {
    if (!this._config) {
      throw new ConfigurationError(
        'Configuration not loaded',
        'CONFIG_NOT_LOADED',
      );
    }
    return JSON.parse(JSON.stringify(this._config)) as AppConfig;
  }

  /**
   * Merge partial configuration into current configuration
   */
  merge(partial: PartialAppConfig, source: string = 'merge'): void {
    if (!this._config) {
      throw new ConfigurationError(
        'Configuration not loaded',
        'CONFIG_NOT_LOADED',
      );
    }

    const oldConfig = this.clone();
    this._config = this.deepMerge(this._config, partial);
    this._version = this._config.version;

    this.emitChanges(oldConfig, this._config, source);
    this.emit('config:merged', { config: this._config, partial, source });
  }

  /**
   * Compare two configurations and return differences
   */
  compare(config1: AppConfig, config2: AppConfig): ConfigurationChangeEvent[] {
    const changes: ConfigurationChangeEvent[] = [];
    this.findConfigurationChanges(config1, config2, changes);
    return changes;
  }

  /**
   * Get all unique keys from both objects
   */
  private getAllKeys(obj1: unknown, obj2: unknown): Set<string> {
    const obj1Record = obj1 as Record<string, unknown> | null | undefined;
    const obj2Record = obj2 as Record<string, unknown> | null | undefined;

    return new Set([
      ...Object.keys(obj1Record ?? {}),
      ...Object.keys(obj2Record ?? {}),
    ]);
  }

  /**
   * Recursively find changes between two configuration objects
   */
  private findConfigurationChanges(
    obj1: unknown,
    obj2: unknown,
    changes: ConfigurationChangeEvent[],
    path: string = '',
  ): void {
    const keys = this.getAllKeys(obj1, obj2);
    const obj1Record = obj1 as Record<string, unknown> | null | undefined;
    const obj2Record = obj2 as Record<string, unknown> | null | undefined;

    for (const key of keys) {
      const currentPath = path ? `${path}.${key}` : key;
      this.compareValues(
        obj1Record?.[key],
        obj2Record?.[key],
        changes,
        currentPath,
      );
    }
  }

  /**
   * Check if both values are non-null objects for deep comparison
   */
  private areBothObjects(val1: unknown, val2: unknown): boolean {
    return (
      typeof val1 === 'object' &&
      typeof val2 === 'object' &&
      val1 !== null &&
      val2 !== null
    );
  }

  /**
   * Compare two values and record changes
   */
  private compareValues(
    val1: unknown,
    val2: unknown,
    changes: ConfigurationChangeEvent[],
    path: string,
  ): void {
    // Handle added values
    if (val1 === undefined && val2 !== undefined) {
      this.recordAddedChange(changes, path, val2);
      return;
    }

    // Handle removed values
    if (val1 !== undefined && val2 === undefined) {
      this.recordRemovedChange(changes, path, val1);
      return;
    }

    // Handle unchanged values
    if (JSON.stringify(val1) === JSON.stringify(val2)) {
      return;
    }

    // Handle nested or updated values
    if (this.areBothObjects(val1, val2)) {
      this.findConfigurationChanges(val1, val2, changes, path);
    } else {
      this.recordUpdatedChange(changes, path, val1, val2);
    }
  }

  /**
   * Record an added change
   */
  private recordAddedChange(
    changes: ConfigurationChangeEvent[],
    path: string,
    newValue: unknown,
  ): void {
    changes.push({
      type: 'added',
      path,
      newValue,
      source: 'comparison',
    });
  }

  /**
   * Record a removed change
   */
  private recordRemovedChange(
    changes: ConfigurationChangeEvent[],
    path: string,
    oldValue: unknown,
  ): void {
    changes.push({
      type: 'removed',
      path,
      oldValue,
      source: 'comparison',
    });
  }

  /**
   * Record an updated change
   */
  private recordUpdatedChange(
    changes: ConfigurationChangeEvent[],
    path: string,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    changes.push({
      type: 'updated',
      path,
      oldValue,
      newValue,
      source: 'comparison',
    });
  }

  /**
   * Emit change events for configuration differences
   */
  private emitChanges(
    oldConfig: AppConfig,
    newConfig: AppConfig,
    source: string,
  ): void {
    const changes = this.compare(oldConfig, newConfig);

    for (const change of changes) {
      change.source = source;
      this.emit('config:changed', change);
      this.emit(`config:changed:${change.path}`, change);
    }
  }

  /**
   * Deep merge two objects
   */

  private deepMerge<T extends Record<string, any>>(
    target: T,
    source: Partial<T>,
  ): T {
    const result = { ...target };

    for (const key in source) {
      const sourceValue = source[key];
      if (sourceValue === undefined) {
        continue;
      }

      if (this.shouldDeepMerge(result[key], sourceValue)) {
        result[key] = this.deepMerge(result[key], sourceValue as any);
      } else {
        result[key] = sourceValue as any;
      }
    }

    return result;
  }

  /**
   * Check if two values should be deep merged
   */
  private shouldDeepMerge(targetValue: unknown, sourceValue: unknown): boolean {
    return this.isValidObject(targetValue) && this.isValidObject(sourceValue);
  }

  /**
   * Check if a value is a valid object for deep merging
   */
  private isValidObject(value: unknown): boolean {
    return (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value)
    );
  }

  /**
   * Destroy the configuration instance and clean up resources
   */
  destroy(): void {
    this.removeAllListeners();
    this._config = null;
    this._sources = [];
    this._lastValidation = null;
  }
}

/**
 * Configuration snapshot for rollback functionality
 */
export class ConfigurationSnapshot {
  constructor(
    public readonly config: AppConfig,
    public readonly timestamp: Date = new Date(),
    public readonly source: string = 'snapshot',
    public readonly description?: string,
  ) {}

  /**
   * Get age of the snapshot in milliseconds
   */
  get age(): number {
    return Date.now() - this.timestamp.getTime();
  }

  /**
   * Check if snapshot is older than specified milliseconds
   */
  isOlderThan(ms: number): boolean {
    return this.age > ms;
  }

  /**
   * Export snapshot to JSON
   */
  toJSON(): string {
    return JSON.stringify({
      config: this.config,
      timestamp: this.timestamp.toISOString(),
      source: this.source,
      description: this.description,
    });
  }

  /**
   * Create snapshot from JSON
   */
  static fromJSON(json: string): ConfigurationSnapshot {
    const data = JSON.parse(json);
    return new ConfigurationSnapshot(
      data.config,
      new Date(data.timestamp),
      data.source,
      data.description,
    );
  }
}

/**
 * Configuration history manager for tracking changes
 */
export class ConfigurationHistory {
  private snapshots: ConfigurationSnapshot[] = [];
  private maxSnapshots: number = MAX_SNAPSHOTS;

  /**
   * Add a snapshot to the history
   */
  addSnapshot(snapshot: ConfigurationSnapshot): void {
    this.snapshots.push(snapshot);

    // Keep only the most recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Get most recent snapshot
   */
  getLatest(): ConfigurationSnapshot | null {
    return this.snapshots.length > 0
      ? (this.snapshots[this.snapshots.length - 1] ?? null)
      : null;
  }

  /**
   * Get snapshot by index
   */
  getSnapshot(index: number): ConfigurationSnapshot | null {
    return index >= 0 && index < this.snapshots.length
      ? (this.snapshots[index] ?? null)
      : null;
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): ConfigurationSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Set maximum number of snapshots to keep
   */
  setMaxSnapshots(max: number): void {
    this.maxSnapshots = Math.max(1, max);
    while (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Get snapshots within the last specified milliseconds
   */
  getRecentSnapshots(ms: number): ConfigurationSnapshot[] {
    const cutoff = Date.now() - ms;
    return this.snapshots.filter(
      snapshot => snapshot.timestamp.getTime() > cutoff,
    );
  }
}

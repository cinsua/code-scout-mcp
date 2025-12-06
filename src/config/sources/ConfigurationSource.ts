/**
 * Base Configuration Source
 *
 * This file defines the abstract base class for all configuration sources
 * and provides common functionality for loading configuration.
 */

import {
  ConfigurationSource as IConfigurationSource,
  PartialAppConfig,
} from '../types/ConfigTypes';
import { ConfigurationError } from '../errors/ConfigurationError';

/**
 * Abstract base class for configuration sources
 */
export abstract class ConfigurationSource implements IConfigurationSource {
  /**
   * Priority level (lower number = higher priority)
   */
  public abstract priority: number;

  /**
   * Source name for debugging
   */
  public abstract name: string;

  /**
   * Load configuration from this source
   */
  public abstract load(): Promise<PartialAppConfig>;

  /**
   * Check if this source is available
   */
  public abstract isAvailable(): Promise<boolean>;

  /**
   * Validate that the source can be used
   */
  protected async validateAvailability(): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new ConfigurationError(
        `Configuration source '${this.name}' is not available`,
        'SOURCE_UNAVAILABLE',
        { source: this.name }
      );
    }
  }

  /**
   * Handle loading errors consistently
   */
  protected handleLoadError(error: unknown): never {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    throw ConfigurationError.source(
      `Failed to load configuration from ${this.name}: ${message}`,
      this.name,
      error instanceof Error ? error : undefined
    );
  }

  /**
   * Create a partial configuration object
   */
  protected createPartialConfig(config: PartialAppConfig): PartialAppConfig {
    return config;
  }

  /**
   * Check if a value is defined and not null
   */
  protected isDefined<T>(value: T | undefined | null): value is T {
    return value !== undefined && value !== null;
  }

  /**
   * Safely parse JSON with error handling
   */
  protected safeJsonParse(json: string, context: string): any {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw ConfigurationError.parsing(
        `Invalid JSON in ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get source metadata for debugging
   */
  getMetadata(): Record<string, unknown> {
    return {
      name: this.name,
      priority: this.priority,
      type: this.constructor.name,
    };
  }
}

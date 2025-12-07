/**
 * Configuration Module Index
 *
 * This file exports the main configuration interface and utilities
 * for the Code-Scout MCP server.
 */

import { ConfigurationManager } from './services/ConfigurationManager';
import { Configuration } from './models/Configuration';
import {
  BatchValidationError,
  ConfigurationError,
  ConfigurationErrorCode,
} from './errors/ConfigurationError';
import { initializeLogging } from './logging';
import type {
  AppConfig,
  ConfigurationChangeEvent,
  ConfigurationMigration,
  ConfigurationSource,
  DatabaseConfig,
  EnvironmentVariableMapping,
  IndexingConfig,
  LanguageConfig,
  LanguagesConfig,
  LoggingConfig,
  PartialAppConfig,
  ProfileType,
  SearchConfig,
  SecurityConfig,
  ValidationError,
  ValidationResult,
  WatchingConfig,
} from './types/ConfigTypes';
import { DefaultConfiguration } from './sources/DefaultConfiguration';
import { GlobalConfiguration } from './sources/GlobalConfiguration';
import { ProjectConfiguration } from './sources/ProjectConfiguration';
import { EnvironmentConfiguration } from './sources/EnvironmentConfiguration';
import { CommandLineConfiguration } from './sources/CommandLineConfiguration';
// Export configuration models
import {
  ConfigurationHistory,
  ConfigurationSnapshot,
} from './models/Configuration';

/**
 * Global configuration manager instance
 */
let globalConfigManager: ConfigurationManager | null = null;

/**
 * Get or create the global configuration manager
 */
export function getConfigurationManager(): ConfigurationManager {
  globalConfigManager ??= new ConfigurationManager();
  return globalConfigManager;
}

/**
 * Load configuration from all sources
 */
export async function loadConfiguration(): Promise<AppConfig> {
  const manager = getConfigurationManager();
  const config = await manager.loadConfiguration();

  // Initialize logging system with loaded configuration
  initializeLogging(config.logging);

  return config;
}

/**
 * Get current configuration
 */
export function getConfiguration(): AppConfig {
  const manager = getConfigurationManager();
  return manager.getConfiguration();
}

/**
 * Get configuration value by path
 */
export function get<T = unknown>(path: string): T {
  const manager = getConfigurationManager();
  return manager.get<T>(path);
}

/**
 * Check if configuration has a path
 */
export function has(path: string): boolean {
  const manager = getConfigurationManager();
  return manager.has(path);
}

/**
 * Get configuration section
 */
export function getSection<T = unknown>(section: string): T {
  const manager = getConfigurationManager();
  return manager.getSection<T>(section);
}

/**
 * Update configuration value
 */
export function update(
  path: string,
  value: unknown,
  source?: string,
): Promise<void> {
  const manager = getConfigurationManager();
  return manager.updateConfiguration(path, value, source);
}

/**
 * Reset configuration to defaults
 */
export function reset(): Promise<void> {
  const manager = getConfigurationManager();
  return manager.resetConfiguration();
}

/**
 * Export configuration
 */
export function exportConfig(pretty?: boolean): string {
  const manager = getConfigurationManager();
  return manager.exportConfiguration(pretty);
}

/**
 * Import configuration
 */
export function importConfig(json: string, source?: string): Promise<void> {
  const manager = getConfigurationManager();
  return manager.importConfiguration(json, source);
}

/**
 * Get configuration history
 */
export function getHistory(): ConfigurationHistory {
  const manager = getConfigurationManager();
  return manager.getHistory();
}

/**
 * Create a new configuration manager instance
 */
export function createConfigurationManager(): ConfigurationManager {
  return new ConfigurationManager();
}

/**
 * Create a new configuration instance
 */
export function createConfiguration(): Configuration {
  return new Configuration();
}

// Export types
export type {
  AppConfig,
  PartialAppConfig,
  ConfigurationSource,
  ValidationResult,
  ConfigurationChangeEvent,
  ProfileType,
  IndexingConfig,
  SearchConfig,
  DatabaseConfig,
  WatchingConfig,
  LanguagesConfig,
  LanguageConfig,
  LoggingConfig,
  SecurityConfig,
  ValidationError,
  ConfigurationMigration,
  EnvironmentVariableMapping,
};

// Export classes and enums
export {
  ConfigurationManager,
  Configuration,
  ConfigurationSnapshot,
  ConfigurationHistory,
  ConfigurationError,
  BatchValidationError,
  ConfigurationErrorCode,
  DefaultConfiguration,
  GlobalConfiguration,
  ProjectConfiguration,
  EnvironmentConfiguration,
  CommandLineConfiguration,
};

/**
 * Default configuration values for reference
 */
export const DEFAULT_CONFIG = {
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
    type: 'sqlite' as const,
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
    level: 'info' as const,
    format: 'json' as const,
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
} as const;

/**
 * Environment variable prefix
 */
export const ENV_PREFIX = 'CODE_SCOUT';

/**
 * Configuration file names
 */
export const CONFIG_FILES = {
  GLOBAL: '.code-scout/config.json',
  PROJECT: '.code-scout/config.json',
  SCHEMA: 'config-schema.json',
} as const;

/**
 * Default configuration paths
 */
export const CONFIG_PATHS = {
  HOME: '~/.code-scout',
  PROJECT: '.code-scout',
  DATABASE: './.code-scout/database.db',
  LOGS: './.code-scout/logs',
} as const;

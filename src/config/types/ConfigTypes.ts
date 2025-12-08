/**
 * Configuration Types for Code-Scout MCP Server
 *
 * This file defines all TypeScript interfaces for the configuration system,
 * providing type safety and documentation for all configuration options.
 */

export interface AppConfig {
  /**
   * Configuration version for migration support
   */
  version: string;

  /**
   * Profile name for environment-specific configurations
   */
  profile?: ProfileType;

  /**
   * Indexing configuration for code analysis
   */
  indexing: IndexingConfig;

  /**
   * Search/querying configuration
   */
  search: SearchConfig;

  /**
   * Database configuration for storage
   */
  database: DatabaseConfig;

  /**
   * File watching configuration
   */
  watching: WatchingConfig;

  /**
   * Language-specific configurations
   */
  languages: LanguagesConfig;

  /**
   * Logging configuration
   */
  logging: LoggingConfig;

  /**
   * Security configuration
   */
  security: SecurityConfig;

  /**
   * Error handling configuration
   */
  errorHandling: ErrorHandlingConfig;
}

export type ProfileType = 'development' | 'production' | 'cicd';

export interface IndexingConfig {
  /**
   * Maximum file size in bytes to process (default: 10MB)
   */
  maxFileSize: number;

  /**
   * Maximum number of worker threads for parallel processing
   */
  maxWorkers: number;

  /**
   * Batch size for processing files
   */
  batchSize: number;

  /**
   * Debounce time in milliseconds for file changes
   */
  debounceMs: number;

  /**
   * Batch window time in milliseconds
   */
  batchWindowMs: number;

  /**
   * Whether to follow symbolic links
   */
  followSymlinks: boolean;

  /**
   * Maximum depth for directory traversal
   */
  maxDepth: number;

  /**
   * Enable incremental indexing
   */
  incremental: boolean;
}

export interface SearchConfig {
  /**
   * Default number of results to return
   */
  defaultLimit: number;

  /**
   * Maximum number of results to return
   */
  maxLimit: number;

  /**
   * Scoring weights for different content types
   */
  scoringWeights: ScoringWeights;

  /**
   * Enable fuzzy search
   */
  fuzzySearch: boolean;

  /**
   * Fuzzy search threshold (0-1)
   */
  fuzzyThreshold: number;

  /**
   * Enable regex search
   */
  enableRegex: boolean;

  /**
   * Search timeout in milliseconds
   */
  timeoutMs: number;
}

export interface ScoringWeights {
  /**
   * Weight for filename matches
   */
  filename: number;

  /**
   * Weight for path matches
   */
  path: number;

  /**
   * Weight for definition matches
   */
  definitions: number;

  /**
   * Weight for import matches
   */
  imports: number;

  /**
   * Weight for documentation matches
   */
  documentation: number;

  /**
   * Weight for code content matches
   */
  content: number;
}

export interface DatabaseConfig {
  /**
   * Path to the database file
   */
  path: string;

  /**
   * Maximum number of connections
   */
  maxConnections: number;

  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout: number;

  /**
   * Database type (sqlite, postgresql, etc.)
   */
  type: 'sqlite' | 'postgresql' | 'mysql';

  /**
   * Enable WAL mode for SQLite
   */
  enableWAL: boolean;

  /**
   * Vacuum interval in hours
   */
  vacuumIntervalHours: number;

  /**
   * Connection string for non-SQLite databases
   */
  connectionString?: string;
}

export interface WatchingConfig {
  /**
   * Enable file watching
   */
  enabled: boolean;

  /**
   * Patterns to ignore when watching
   */
  ignorePatterns: string[];

  /**
   * Patterns to include when watching
   */
  includePatterns: string[];

  /**
   * Polling interval in milliseconds (0 = use OS events)
   */
  pollingInterval?: number;

  /**
   * Enable watching for subdirectories
   */
  recursive: boolean;

  /**
   * Debounce time for file events
   */
  debounceMs: number;
}

export interface LanguagesConfig {
  /**
   * TypeScript configuration
   */
  typescript: LanguageConfig;

  /**
   * JavaScript configuration
   */
  javascript: LanguageConfig;

  /**
   * Python configuration
   */
  python: LanguageConfig;

  /**
   * Additional language configurations
   */
  [key: string]: LanguageConfig;
}

export interface LanguageConfig {
  /**
   * File extensions for this language
   */
  extensions: string[];

  /**
   * Parser name to use
   */
  parser: string;

  /**
   * Enable this language
   */
  enabled: boolean;

  /**
   * Language-specific configuration
   */
  config?: Record<string, unknown>;
}

export interface LoggingConfig {
  /**
   * Log level
   */
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

  /**
   * Log format
   */
  format: 'json' | 'text';

  /**
   * Enable file logging
   */
  file: {
    enabled: boolean;
    path?: string;
    maxSize?: string;
    maxFiles?: number;
  };

  /**
   * Enable console logging
   */
  console: {
    enabled: boolean;
    colorize?: boolean;
  };

  /**
   * Enable structured logging
   */
  structured: boolean;
}

export interface SecurityConfig {
  /**
   * Allowed file extensions
   */
  allowedExtensions: string[];

  /**
   * Blocked file patterns
   */
  blockedPatterns: string[];

  /**
   * Maximum file path length
   */
  maxPathLength: number;

  /**
   * Enable sandboxing
   */
  enableSandbox: boolean;

  /**
   * Sandbox configuration
   */
  sandbox?: {
    timeoutMs: number;
    memoryLimitMB: number;
    allowNetworkAccess: boolean;
  };
}

export interface ErrorHandlingConfig {
  /**
   * Retry delay configuration in milliseconds
   */
  retryDelays: {
    immediate: number;
    short: number;
    medium: number;
    long: number;
    extended: number;
    maximum: number;
  };

  /**
   * Timeout configuration in milliseconds
   */
  timeouts: {
    database: number;
    parsing: number;
    network: number;
    filesystem: number;
    indexing: number;
    query: number;
    connection: number;
    read: number;
    write: number;
    lock: number;
    default: number;
  };

  /**
   * Circuit breaker configuration
   */
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
    successThreshold: number;
  };

  /**
   * Degradation thresholds
   */
  degradation: {
    errorRateThreshold: number;
    responseTimeThreshold: number;
    memoryUsageThreshold: number;
    cpuUsageThreshold: number;
  };

  /**
   * Error aggregation settings
   */
  aggregation: {
    windowMs: number;
    cleanupIntervalMs: number;
    maxErrorEntries: number;
  };

  /**
   * Performance thresholds
   */
  performance: {
    slowQueryMs: number;
    connectionAcquisitionMs: number;
    memoryUsageBytes: number;
    poolUtilizationThreshold: number;
    errorRateThreshold: number;
  };

  /**
   * Resource management settings
   */
  resource: {
    maxConnections: number;
    maxMemoryUsage: number;
    cleanupIntervalMs: number;
    leakDetectionThreshold: number;
  };

  /**
   * Retry handler settings
   */
  retryHandler: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };

  /**
   * Error logging settings
   */
  logging: {
    enableStackTrace: boolean;
    enableContext: boolean;
    maxLogEntries: number;
    retentionMs: number;
  };
}

/**
 * Partial configuration for updates and merging
 */
export type PartialAppConfig = Partial<AppConfig>;

/**
 * Configuration source metadata
 */
export interface ConfigurationSource {
  /**
   * Priority level (lower number = higher priority)
   */
  priority: number;

  /**
   * Source name for debugging
   */
  name: string;

  /**
   * Load configuration from this source
   */
  load(): Promise<PartialAppConfig>;

  /**
   * Check if this source is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: ValidationError[];

  /**
   * Validation warnings
   */
  warnings: ValidationWarning[];

  /**
   * Validated configuration (may be partial)
   */
  config?: PartialAppConfig;
}

export interface ValidationError {
  /**
   * Error path in configuration
   */
  path: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Error code for programmatic handling
   */
  code: string;

  /**
   * Suggested fix
   */
  suggestion?: string;
}

export interface ValidationWarning {
  /**
   * Warning path in configuration
   */
  path: string;

  /**
   * Warning message
   */
  message: string;

  /**
   * Warning code
   */
  code: string;

  /**
   * Suggested fix
   */
  suggestion?: string;
}

/**
 * Configuration change event
 */
export interface ConfigurationChangeEvent {
  /**
   * Type of change
   */
  type: 'added' | 'updated' | 'removed';

  /**
   * Path that changed
   */
  path: string;

  /**
   * Old value
   */
  oldValue?: unknown;

  /**
   * New value
   */
  newValue?: unknown;

  /**
   * Source of the change
   */
  source: string;
}

/**
 * Configuration migration definition
 */
export interface ConfigurationMigration {
  /**
   * Source version
   */
  fromVersion: string;

  /**
   * Target version
   */
  toVersion: string;

  /**
   * Migration function
   */
  migrate: (config: Record<string, unknown>) => Record<string, unknown>;

  /**
   * Migration description
   */
  description: string;
}

/**
 * Environment variable mapping
 */
export interface EnvironmentVariableMapping {
  /**
   * Environment variable name
   */
  envVar: string;

  /**
   * Configuration path (dot notation)
   */
  configPath: string;

  /**
   * Type conversion
   */
  type: 'string' | 'number' | 'boolean' | 'json';

  /**
   * Default value if env var is not set
   */
  defaultValue?: unknown;

  /**
   * Whether this variable is required
   */
  required?: boolean;
}

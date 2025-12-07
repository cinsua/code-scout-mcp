/**
 * Centralized constants for logging configuration and behavior
 * Eliminates magic numbers and provides consistent defaults across the logging system
 */

/**
 * Query sanitization constants
 */
export const QUERY_SANITIZATION = {
  MAX_LENGTH: 200,
  PLACEHOLDER: '***',
} as const;

/**
 * Error aggregation limits
 */
export const ERROR_AGGREGATION = {
  MAX_SAMPLE_ERRORS: 5,
  AGGREGATION_WINDOW_MS: 300000, // 5 minutes
  CLEANUP_INTERVAL_MS: 3600000, // 1 hour
  CRITICAL_THRESHOLD: 10, // Critical error count threshold
} as const;

/**
 * Performance logging thresholds (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_THRESHOLD_MS: 1000, // Threshold for logging slow queries as warnings
  ANALYSIS_SLOW_QUERY_THRESHOLD_MS: 100, // Threshold for performance analysis
  VERY_SLOW_QUERY_THRESHOLD_MS: 5000,
  MEMORY_WARNING_THRESHOLD_MB: 100,
  MEMORY_CRITICAL_THRESHOLD_MB: 200,
} as const;

/**
 * Log file rotation configuration
 */
export const LOG_FILE_CONFIG = {
  DEFAULT_MAX_SIZE: '10m',
  DEFAULT_MAX_FILES: 5,
  DEFAULT_PATH: './logs/code-scout.log',
} as const;

/**
 * Logging levels and priorities
 */
export const LOG_LEVELS = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

/**
 * Log format options
 */
export const LOG_FORMATS = {
  TEXT: 'text',
  JSON: 'json',
  PRETTY: 'pretty',
} as const;

/**
 * Default logging configuration values
 */
export const LOGGING_DEFAULTS = {
  LEVEL: LOG_LEVELS.INFO,
  FORMAT: LOG_FORMATS.TEXT,
  CONSOLE_ENABLED: true,
  FILE_ENABLED: true,
  COLORIZE: true,
  STRUCTURED: false,
} as const;

/**
 * Service-specific logging contexts
 */
export const SERVICE_CONTEXTS = {
  DATABASE: 'database-service',
  PERFORMANCE: 'performance-service',
  CONFIGURATION: 'configuration-service',
  FILE_WATCHING: 'file-watching-service',
  INDEXING: 'indexing-service',
  PARSING: 'parsing-service',
  QUERYING: 'querying-service',
  STORAGE: 'storage-service',
  ERROR_HANDLER: 'error-handler',
  APPLICATION: 'application',
} as const;

/**
 * Operation-specific logging contexts
 */
export const OPERATION_CONTEXTS = {
  QUERY_EXECUTION: 'query-execution',
  CONNECTION_POOL: 'connection-pool',
  MIGRATION: 'migration',
  INDEXING: 'indexing',
  PARSING: 'parsing',
  SEARCH: 'search',
  CONFIG_LOAD: 'config-load',
  FILE_WATCH: 'file-watch',
  ERROR_AGGREGATION: 'error-aggregation',
} as const;

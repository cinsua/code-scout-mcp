/**
 * Centralized Error Handling Constants
 *
 * This file contains all hardcoded values used throughout the error handling system.
 * It provides a single source of truth for retry delays, timeouts, thresholds,
 * and other error-related constants, with support for environment variable overrides.
 */

/* eslint-disable security/detect-object-injection */

/**
 * Main error constants object with all default values
 */
export const ERROR_CONSTANTS = {
  // Retry delays in milliseconds
  RETRY_DELAYS: {
    IMMEDIATE: 0,
    SHORT: 1000, // 1 second
    MEDIUM: 2000, // 2 seconds
    LONG: 5000, // 5 seconds
    EXTENDED: 10000, // 10 seconds
    MAXIMUM: 60000, // 1 minute
  },

  // Timeout defaults in milliseconds
  TIMEOUTS: {
    DATABASE: 30000, // 30 seconds
    PARSING: 10000, // 10 seconds
    NETWORK: 5000, // 5 seconds
    FILESYSTEM: 5000, // 5 seconds
    INDEXING: 300000, // 5 minutes
    QUERY: 30000, // 30 seconds
    CONNECTION: 10000, // 10 seconds
    READ: 30000, // 30 seconds
    WRITE: 30000, // 30 seconds
    LOCK: 5000, // 5 seconds
    DEFAULT: 10000, // 10 seconds
  },

  // Circuit breaker thresholds
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RECOVERY_TIMEOUT: 60000, // 1 minute
    MONITORING_PERIOD: 300000, // 5 minutes
    SUCCESS_THRESHOLD: 3,
    TIMEOUT: 30000, // 30 seconds
  },

  // Degradation thresholds
  DEGRADATION: {
    ERROR_RATE_THRESHOLD: 0.1, // 10%
    RESPONSE_TIME_THRESHOLD: 5000, // 5 seconds
    MEMORY_USAGE_THRESHOLD: 0.8, // 80%
    CPU_USAGE_THRESHOLD: 0.9, // 90%
    MONITORING_INTERVAL: 30000, // 30 seconds
  },

  // Error aggregation settings
  AGGREGATION: {
    WINDOW_MS: 300000, // 5 minutes
    CLEANUP_INTERVAL_MS: 3600000, // 1 hour
    MAX_ERROR_ENTRIES: 10000,
  },

  // Performance thresholds
  PERFORMANCE: {
    SLOW_QUERY_THRESHOLD_MS: 1000, // 1 second
    VERY_SLOW_QUERY_THRESHOLD_MS: 5000, // 5 seconds
    CONNECTION_ACQUISITION_THRESHOLD_MS: 1000, // 1 second
    MEMORY_USAGE_BYTES: 1024 * 1024 * 1024, // 1GB
    POOL_UTILIZATION_THRESHOLD: 0.8, // 80%
  },

  // Resource management thresholds
  RESOURCE: {
    MAX_AGE_MS: 3600000, // 1 hour
    IDLE_TIMEOUT_MS: 300000, // 5 minutes
    CLEANUP_INTERVAL_MS: 60000, // 1 minute
    LEAK_THRESHOLD_AGE_MS: 1800000, // 30 minutes
  },

  // Retry handler defaults
  RETRY_HANDLER: {
    BASE_DELAY: 1000, // 1 second
    MAX_DELAY: 30000, // 30 seconds
    MAX_ATTEMPTS: 3,
    LINEAR_INCREMENT: 1000, // 1 second
    JITTER_FACTOR: 0.1, // 10% jitter
    EXPONENTIAL_BASE: 2, // Exponential backoff base
    FIXED_DELAY: 2000, // 2 seconds for fixed delay policy
  },

  // Logging constants
  LOGGING: {
    ERROR_RETENTION_HOURS: 24,
    TREND_ANALYSIS_WINDOW_HOURS: 2,
    AGGREGATION_WINDOW_MINUTES: 5,
  },
} as const;

/**
 * Environment variable mappings for error constants
 * Each environment variable can override the corresponding constant
 */
export const ERROR_ENV_VARS = {
  // Retry delays
  RETRY_IMMEDIATE_DELAY: 'CS_ERROR_RETRY_IMMEDIATE_DELAY',
  RETRY_SHORT_DELAY: 'CS_ERROR_RETRY_SHORT_DELAY',
  RETRY_MEDIUM_DELAY: 'CS_ERROR_RETRY_MEDIUM_DELAY',
  RETRY_LONG_DELAY: 'CS_ERROR_RETRY_LONG_DELAY',
  RETRY_EXTENDED_DELAY: 'CS_ERROR_RETRY_EXTENDED_DELAY',
  RETRY_MAXIMUM_DELAY: 'CS_ERROR_RETRY_MAXIMUM_DELAY',

  // Timeouts
  TIMEOUT_DATABASE: 'CS_ERROR_TIMEOUT_DATABASE',
  TIMEOUT_PARSING: 'CS_ERROR_TIMEOUT_PARSING',
  TIMEOUT_NETWORK: 'CS_ERROR_TIMEOUT_NETWORK',
  TIMEOUT_FILESYSTEM: 'CS_ERROR_TIMEOUT_FILESYSTEM',
  TIMEOUT_INDEXING: 'CS_ERROR_TIMEOUT_INDEXING',
  TIMEOUT_QUERY: 'CS_ERROR_TIMEOUT_QUERY',
  TIMEOUT_CONNECTION: 'CS_ERROR_TIMEOUT_CONNECTION',
  TIMEOUT_READ: 'CS_ERROR_TIMEOUT_READ',
  TIMEOUT_WRITE: 'CS_ERROR_TIMEOUT_WRITE',
  TIMEOUT_LOCK: 'CS_ERROR_TIMEOUT_LOCK',
  TIMEOUT_DEFAULT: 'CS_ERROR_TIMEOUT_DEFAULT',

  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: 'CS_CIRCUIT_BREAKER_THRESHOLD',
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT: 'CS_CIRCUIT_BREAKER_RECOVERY_TIMEOUT',
  CIRCUIT_BREAKER_MONITORING_PERIOD: 'CS_CIRCUIT_BREAKER_MONITORING_PERIOD',
  CIRCUIT_BREAKER_SUCCESS_THRESHOLD: 'CS_CIRCUIT_BREAKER_SUCCESS_THRESHOLD',
  CIRCUIT_BREAKER_TIMEOUT: 'CS_CIRCUIT_BREAKER_TIMEOUT',

  // Degradation
  DEGRADATION_ERROR_RATE: 'CS_DEGRADATION_ERROR_RATE',
  DEGRADATION_RESPONSE_TIME: 'CS_DEGRADATION_RESPONSE_TIME',
  DEGRADATION_MEMORY_USAGE: 'CS_DEGRADATION_MEMORY_USAGE',
  DEGRADATION_CPU_USAGE: 'CS_DEGRADATION_CPU_USAGE',
  DEGRADATION_MONITORING_INTERVAL: 'CS_DEGRADATION_MONITORING_INTERVAL',

  // Aggregation
  AGGREGATION_WINDOW_MS: 'CS_AGGREGATION_WINDOW_MS',
  AGGREGATION_CLEANUP_INTERVAL_MS: 'CS_AGGREGATION_CLEANUP_INTERVAL_MS',
  AGGREGATION_MAX_ENTRIES: 'CS_AGGREGATION_MAX_ENTRIES',

  // Performance
  PERF_SLOW_QUERY_THRESHOLD: 'CS_PERF_SLOW_QUERY_THRESHOLD',
  PERF_VERY_SLOW_QUERY_THRESHOLD: 'CS_PERF_VERY_SLOW_QUERY_THRESHOLD',
  PERF_CONNECTION_ACQUISITION_THRESHOLD:
    'CS_PERF_CONNECTION_ACQUISITION_THRESHOLD',
  PERF_MEMORY_USAGE_BYTES: 'CS_PERF_MEMORY_USAGE_BYTES',
  PERF_POOL_UTILIZATION_THRESHOLD: 'CS_PERF_POOL_UTILIZATION_THRESHOLD',

  // Resource management
  RESOURCE_MAX_AGE_MS: 'CS_RESOURCE_MAX_AGE_MS',
  RESOURCE_IDLE_TIMEOUT_MS: 'CS_RESOURCE_IDLE_TIMEOUT_MS',
  RESOURCE_CLEANUP_INTERVAL_MS: 'CS_RESOURCE_CLEANUP_INTERVAL_MS',
  RESOURCE_LEAK_THRESHOLD_AGE_MS: 'CS_RESOURCE_LEAK_THRESHOLD_AGE_MS',

  // Retry handler
  RETRY_BASE_DELAY: 'CS_RETRY_BASE_DELAY',
  RETRY_MAX_DELAY: 'CS_RETRY_MAX_DELAY',
  RETRY_MAX_ATTEMPTS: 'CS_RETRY_MAX_ATTEMPTS',
  RETRY_LINEAR_INCREMENT: 'CS_RETRY_LINEAR_INCREMENT',
  RETRY_JITTER_FACTOR: 'CS_RETRY_JITTER_FACTOR',
  RETRY_EXPONENTIAL_BASE: 'CS_RETRY_EXPONENTIAL_BASE',
  RETRY_FIXED_DELAY: 'CS_RETRY_FIXED_DELAY',

  // Logging
  LOG_ERROR_RETENTION_HOURS: 'CS_LOG_ERROR_RETENTION_HOURS',
  LOG_TREND_ANALYSIS_WINDOW_HOURS: 'CS_LOG_TREND_ANALYSIS_WINDOW_HOURS',
  LOG_AGGREGATION_WINDOW_MINUTES: 'CS_LOG_AGGREGATION_WINDOW_MINUTES',
} as const;

/**
 * Safe environment variable accessor to prevent object injection warnings
 */
const ALLOWED_ENV_VARS: Set<string> = new Set(Object.values(ERROR_ENV_VARS));

function getEnvVar(name: string): string | undefined {
  if (!ALLOWED_ENV_VARS.has(name)) {
    return undefined;
  }

  return process.env[name];
}

/**
 * Type definitions for error constant keys
 */
export type RetryDelayType = keyof typeof ERROR_CONSTANTS.RETRY_DELAYS;
export type TimeoutType = keyof typeof ERROR_CONSTANTS.TIMEOUTS;
export type CircuitBreakerType = keyof typeof ERROR_CONSTANTS.CIRCUIT_BREAKER;
export type DegradationType = keyof typeof ERROR_CONSTANTS.DEGRADATION;
export type AggregationType = keyof typeof ERROR_CONSTANTS.AGGREGATION;
export type PerformanceType = keyof typeof ERROR_CONSTANTS.PERFORMANCE;
export type ResourceType = keyof typeof ERROR_CONSTANTS.RESOURCE;
export type RetryHandlerType = keyof typeof ERROR_CONSTANTS.RETRY_HANDLER;
export type LoggingType = keyof typeof ERROR_CONSTANTS.LOGGING;

/**
 * Helper function to get retry delay with environment variable support
 */
export function getRetryDelay(type: RetryDelayType): number {
  let envVar: string;
  switch (type) {
    case 'IMMEDIATE':
      envVar = ERROR_ENV_VARS.RETRY_IMMEDIATE_DELAY;
      break;
    case 'SHORT':
      envVar = ERROR_ENV_VARS.RETRY_SHORT_DELAY;
      break;
    case 'MEDIUM':
      envVar = ERROR_ENV_VARS.RETRY_MEDIUM_DELAY;
      break;
    case 'LONG':
      envVar = ERROR_ENV_VARS.RETRY_LONG_DELAY;
      break;
    case 'EXTENDED':
      envVar = ERROR_ENV_VARS.RETRY_EXTENDED_DELAY;
      break;
    case 'MAXIMUM':
      envVar = ERROR_ENV_VARS.RETRY_MAXIMUM_DELAY;
      break;
    default:
      throw new Error(`Unknown retry delay type: ${type}`);
  }

  // Check environment variable first (highest priority)
  const envValue = getEnvVar(envVar);
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  // Check runtime configuration (medium priority)
  const runtimeValue = getRuntimeConfigValue(
    'retryDelays',
    type.toLowerCase(),
    ERROR_CONSTANTS.RETRY_DELAYS[type],
  );
  if (runtimeValue !== ERROR_CONSTANTS.RETRY_DELAYS[type]) {
    return runtimeValue;
  }

  // Fall back to default constants (lowest priority)
  return ERROR_CONSTANTS.RETRY_DELAYS[type];
}

/**
 * Helper function to get timeout with environment variable support
 */
export function getTimeout(type: TimeoutType): number {
  const envVarMap: Record<TimeoutType, keyof typeof ERROR_ENV_VARS> = {
    DATABASE: 'TIMEOUT_DATABASE',
    PARSING: 'TIMEOUT_PARSING',
    NETWORK: 'TIMEOUT_NETWORK',
    FILESYSTEM: 'TIMEOUT_FILESYSTEM',
    INDEXING: 'TIMEOUT_INDEXING',
    QUERY: 'TIMEOUT_QUERY',
    CONNECTION: 'TIMEOUT_CONNECTION',
    READ: 'TIMEOUT_READ',
    WRITE: 'TIMEOUT_WRITE',
    LOCK: 'TIMEOUT_LOCK',
    DEFAULT: 'TIMEOUT_DEFAULT',
  };

  const envVar = ERROR_ENV_VARS[envVarMap[type]];

  // Check environment variable first (highest priority)
  if (getEnvVar(envVar)) {
    const parsed = parseInt(getEnvVar(envVar)!, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Check runtime configuration (medium priority)
  const runtimeValue = getRuntimeConfigValue(
    'timeouts',
    type.toLowerCase(),
    ERROR_CONSTANTS.TIMEOUTS[type],
  );
  if (runtimeValue !== ERROR_CONSTANTS.TIMEOUTS[type]) {
    return runtimeValue;
  }

  // Fall back to default constants (lowest priority)
  return ERROR_CONSTANTS.TIMEOUTS[type];
}

/**
 * Helper function to get circuit breaker constant with environment variable support
 */
export function getCircuitBreakerConstant(type: CircuitBreakerType): number {
  const envVarMap: Record<CircuitBreakerType, keyof typeof ERROR_ENV_VARS> = {
    FAILURE_THRESHOLD: 'CIRCUIT_BREAKER_THRESHOLD',
    RECOVERY_TIMEOUT: 'CIRCUIT_BREAKER_RECOVERY_TIMEOUT',
    MONITORING_PERIOD: 'CIRCUIT_BREAKER_MONITORING_PERIOD',
    SUCCESS_THRESHOLD: 'CIRCUIT_BREAKER_SUCCESS_THRESHOLD',
    TIMEOUT: 'CIRCUIT_BREAKER_TIMEOUT',
  };

  const envVar = ERROR_ENV_VARS[envVarMap[type]];

  // Check environment variable first (highest priority)
  if (getEnvVar(envVar)) {
    const parsed = parseInt(getEnvVar(envVar)!, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Check runtime configuration (medium priority)
  const runtimeValue = getRuntimeConfigValue(
    'circuitBreaker',
    type.toLowerCase().replace(/_/g, ''),
    ERROR_CONSTANTS.CIRCUIT_BREAKER[type],
  );
  if (runtimeValue !== ERROR_CONSTANTS.CIRCUIT_BREAKER[type]) {
    return runtimeValue;
  }

  // Fall back to default constants (lowest priority)
  return ERROR_CONSTANTS.CIRCUIT_BREAKER[type];
}

/**
 * Helper function to validate degradation threshold values based on type
 */
function isValidDegradationValue(
  type: DegradationType,
  value: number,
): boolean {
  switch (type) {
    case 'ERROR_RATE_THRESHOLD':
    case 'MEMORY_USAGE_THRESHOLD':
    case 'CPU_USAGE_THRESHOLD':
      return value >= 0 && value <= 1; // Percentage values (0-100%)
    case 'RESPONSE_TIME_THRESHOLD':
    case 'MONITORING_INTERVAL':
      return value > 0; // Must be positive
    default:
      return false;
  }
}

/**
 * Helper function to get degradation threshold with environment variable support
 */
export function getDegradationThreshold(type: DegradationType): number {
  const envVarMap: Record<DegradationType, keyof typeof ERROR_ENV_VARS> = {
    ERROR_RATE_THRESHOLD: 'DEGRADATION_ERROR_RATE',
    RESPONSE_TIME_THRESHOLD: 'DEGRADATION_RESPONSE_TIME',
    MEMORY_USAGE_THRESHOLD: 'DEGRADATION_MEMORY_USAGE',
    CPU_USAGE_THRESHOLD: 'DEGRADATION_CPU_USAGE',
    MONITORING_INTERVAL: 'DEGRADATION_MONITORING_INTERVAL',
  };

  const envVar = ERROR_ENV_VARS[envVarMap[type]];

  // Check environment variable first (highest priority)
  if (getEnvVar(envVar)) {
    const parsed = parseFloat(getEnvVar(envVar)!);
    if (!isNaN(parsed) && isValidDegradationValue(type, parsed)) {
      return parsed;
    }
  }

  // Check runtime configuration (medium priority)
  const runtimeValue = getRuntimeConfigValue(
    'degradation',
    type.toLowerCase().replace(/_/g, ''),
    ERROR_CONSTANTS.DEGRADATION[type],
  );
  if (runtimeValue !== ERROR_CONSTANTS.DEGRADATION[type]) {
    return runtimeValue;
  }

  // Fall back to default constants (lowest priority)
  return ERROR_CONSTANTS.DEGRADATION[type];
}

/**
 * Helper function to get performance threshold with environment variable support
 */
export function getPerformanceThreshold(type: PerformanceType): number {
  const envVarMap: Record<PerformanceType, keyof typeof ERROR_ENV_VARS> = {
    SLOW_QUERY_THRESHOLD_MS: 'PERF_SLOW_QUERY_THRESHOLD',
    VERY_SLOW_QUERY_THRESHOLD_MS: 'PERF_VERY_SLOW_QUERY_THRESHOLD',
    CONNECTION_ACQUISITION_THRESHOLD_MS:
      'PERF_CONNECTION_ACQUISITION_THRESHOLD',
    MEMORY_USAGE_BYTES: 'PERF_MEMORY_USAGE_BYTES',
    POOL_UTILIZATION_THRESHOLD: 'PERF_POOL_UTILIZATION_THRESHOLD',
  };

  const envVar = ERROR_ENV_VARS[envVarMap[type]];

  if (getEnvVar(envVar)) {
    const parsed = parseFloat(getEnvVar(envVar)!);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return ERROR_CONSTANTS.PERFORMANCE[type];
}

/**
 * Helper function to get resource management constant with environment variable support
 */
export function getResourceConstant(type: ResourceType): number {
  const envVarMap: Record<ResourceType, keyof typeof ERROR_ENV_VARS> = {
    MAX_AGE_MS: 'RESOURCE_MAX_AGE_MS',
    IDLE_TIMEOUT_MS: 'RESOURCE_IDLE_TIMEOUT_MS',
    CLEANUP_INTERVAL_MS: 'RESOURCE_CLEANUP_INTERVAL_MS',
    LEAK_THRESHOLD_AGE_MS: 'RESOURCE_LEAK_THRESHOLD_AGE_MS',
  };

  const envVar = ERROR_ENV_VARS[envVarMap[type]];

  if (getEnvVar(envVar)) {
    const parsed = parseInt(getEnvVar(envVar)!, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return ERROR_CONSTANTS.RESOURCE[type];
}

/**
 * Helper function to get retry handler constant with environment variable support
 */
export function getRetryHandlerConstant(type: RetryHandlerType): number {
  const envVarMap: Record<RetryHandlerType, keyof typeof ERROR_ENV_VARS> = {
    BASE_DELAY: 'RETRY_BASE_DELAY',
    MAX_DELAY: 'RETRY_MAX_DELAY',
    MAX_ATTEMPTS: 'RETRY_MAX_ATTEMPTS',
    LINEAR_INCREMENT: 'RETRY_LINEAR_INCREMENT',
    JITTER_FACTOR: 'RETRY_JITTER_FACTOR',
    EXPONENTIAL_BASE: 'RETRY_EXPONENTIAL_BASE',
    FIXED_DELAY: 'RETRY_FIXED_DELAY',
  };

  const envVar = ERROR_ENV_VARS[envVarMap[type]];

  if (getEnvVar(envVar)) {
    const parsed = parseFloat(getEnvVar(envVar)!);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return ERROR_CONSTANTS.RETRY_HANDLER[type];
}

/**
 * Helper function to get retry handler float constant with environment variable support
 */
export function getRetryHandlerFloatConstant(type: RetryHandlerType): number {
  const envVarMap: Record<RetryHandlerType, keyof typeof ERROR_ENV_VARS> = {
    BASE_DELAY: 'RETRY_BASE_DELAY',
    MAX_DELAY: 'RETRY_MAX_DELAY',
    MAX_ATTEMPTS: 'RETRY_MAX_ATTEMPTS',
    LINEAR_INCREMENT: 'RETRY_LINEAR_INCREMENT',
    JITTER_FACTOR: 'RETRY_JITTER_FACTOR',
    EXPONENTIAL_BASE: 'RETRY_EXPONENTIAL_BASE',
    FIXED_DELAY: 'RETRY_FIXED_DELAY',
  };

  const envVar = ERROR_ENV_VARS[envVarMap[type]];

  if (getEnvVar(envVar)) {
    const parsed = parseFloat(getEnvVar(envVar)!);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return ERROR_CONSTANTS.RETRY_HANDLER[type];
}

/**
 * Helper function to get logging constant with environment variable support
 */
export function getLoggingConstant(type: LoggingType): number {
  const envVarMap: Record<LoggingType, keyof typeof ERROR_ENV_VARS> = {
    ERROR_RETENTION_HOURS: 'LOG_ERROR_RETENTION_HOURS',
    TREND_ANALYSIS_WINDOW_HOURS: 'LOG_TREND_ANALYSIS_WINDOW_HOURS',
    AGGREGATION_WINDOW_MINUTES: 'LOG_AGGREGATION_WINDOW_MINUTES',
  };

  const envVar = ERROR_ENV_VARS[envVarMap[type]];

  if (getEnvVar(envVar)) {
    const parsed = parseInt(getEnvVar(envVar)!, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return ERROR_CONSTANTS.LOGGING[type];
}

/**
 * Get all error constants with environment variable overrides applied
 * This is useful for debugging and configuration validation
 */
export function getEffectiveErrorConstants(): typeof ERROR_CONSTANTS {
  return {
    RETRY_DELAYS: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.RETRY_DELAYS).map(([key]) => [
        key,
        getRetryDelay(key as RetryDelayType),
      ]),
    ),
    TIMEOUTS: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.TIMEOUTS).map(([key]) => [
        key,
        getTimeout(key as TimeoutType),
      ]),
    ),
    CIRCUIT_BREAKER: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.CIRCUIT_BREAKER).map(([key]) => [
        key,
        getCircuitBreakerConstant(key as CircuitBreakerType),
      ]),
    ),
    DEGRADATION: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.DEGRADATION).map(([key]) => [
        key,
        getDegradationThreshold(key as DegradationType),
      ]),
    ),
    AGGREGATION: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.AGGREGATION).map(([key]) => [
        key,
        // For now, return default values for aggregation
        ERROR_CONSTANTS.AGGREGATION[key as AggregationType],
      ]),
    ),
    PERFORMANCE: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.PERFORMANCE).map(([key]) => [
        key,
        getPerformanceThreshold(key as PerformanceType),
      ]),
    ),
    RESOURCE: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.RESOURCE).map(([key]) => [
        key,
        getResourceConstant(key as ResourceType),
      ]),
    ),
    RETRY_HANDLER: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.RETRY_HANDLER).map(([key]) => [
        key,
        getRetryHandlerConstant(key as RetryHandlerType),
      ]),
    ),
    LOGGING: Object.fromEntries(
      Object.entries(ERROR_CONSTANTS.LOGGING).map(([key]) => [
        key,
        getLoggingConstant(key as LoggingType),
      ]),
    ),
  } as typeof ERROR_CONSTANTS;
}

/**
 * Validate environment variable values for error constants
 * Returns an array of validation errors
 */
export function validateErrorConstantEnvironment(): string[] {
  const errors: string[] = [];

  // Validate retry delay environment variables
  Object.entries(ERROR_ENV_VARS).forEach(([key, envVar]) => {
    if (getEnvVar(envVar)) {
      const value = getEnvVar(envVar)!;

      // Check if it's a number
      if (
        key.includes('DELAY') ||
        key.includes('TIMEOUT') ||
        key.includes('THRESHOLD') ||
        key.includes('INTERVAL') ||
        key.includes('RATE') ||
        key.includes('UTILIZATION')
      ) {
        const parsed =
          key.includes('RATE') || key.includes('UTILIZATION')
            ? parseFloat(value)
            : parseInt(value, 10);

        if (isNaN(parsed)) {
          errors.push(`Invalid ${envVar}: "${value}" is not a valid number`);
        } else if (key.includes('RATE') || key.includes('UTILIZATION')) {
          if (parsed < 0 || parsed > 1) {
            errors.push(
              `Invalid ${envVar}: "${value}" must be between 0 and 1`,
            );
          }
        } else if (parsed < 0) {
          errors.push(`Invalid ${envVar}: "${value}" must be non-negative`);
        }
      }
    }
  });

  return errors;
}

/**
 * Runtime configuration cache for error handling
 */
let runtimeErrorConfig: any = null;

/**
 * Initialize error constants with runtime configuration
 * This should be called after ConfigurationManager is initialized
 */
export function initializeErrorHandling(config: any): void {
  runtimeErrorConfig = config?.errorHandling ?? null;
}

/**
 * Get runtime error configuration value with fallback to constants
 */
function getRuntimeConfigValue(
  category: string,
  key: string,
  fallback: number,
): number {
  if (!runtimeErrorConfig) {
    return fallback;
  }

  let configSection: any;
  switch (category) {
    case 'retryDelays':
      configSection = runtimeErrorConfig.retryDelays;
      break;
    case 'timeouts':
      configSection = runtimeErrorConfig.timeouts;
      break;
    case 'circuitBreaker':
      configSection = runtimeErrorConfig.circuitBreaker;
      break;
    case 'degradation':
      configSection = runtimeErrorConfig.degradation;
      break;
    case 'retryHandler':
      configSection = runtimeErrorConfig.retryHandler;
      break;
    default:
      return fallback;
  }

  if (!configSection) {
    return fallback;
  }

  const value = configSection[key];
  return typeof value === 'number' ? value : fallback;
}

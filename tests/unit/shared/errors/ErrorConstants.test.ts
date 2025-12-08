/**
 * Tests for ErrorConstants module
 */

import {
  ERROR_CONSTANTS,
  ERROR_ENV_VARS,
  getRetryDelay,
  getTimeout,
  getCircuitBreakerConstant,
  getDegradationThreshold,
  getPerformanceThreshold,
  getResourceConstant,
  getRetryHandlerConstant,
  getLoggingConstant,
  getEffectiveErrorConstants,
  validateErrorConstantEnvironment,
} from '../../../../src/shared/errors/ErrorConstants';

describe('ErrorConstants', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    Object.values(ERROR_ENV_VARS).forEach(envVar => {
      delete process.env[envVar];
    });
  });

  describe('ERROR_CONSTANTS', () => {
    it('should have all required constant categories', () => {
      expect(ERROR_CONSTANTS).toHaveProperty('RETRY_DELAYS');
      expect(ERROR_CONSTANTS).toHaveProperty('TIMEOUTS');
      expect(ERROR_CONSTANTS).toHaveProperty('CIRCUIT_BREAKER');
      expect(ERROR_CONSTANTS).toHaveProperty('DEGRADATION');
      expect(ERROR_CONSTANTS).toHaveProperty('AGGREGATION');
      expect(ERROR_CONSTANTS).toHaveProperty('PERFORMANCE');
      expect(ERROR_CONSTANTS).toHaveProperty('RESOURCE');
      expect(ERROR_CONSTANTS).toHaveProperty('RETRY_HANDLER');
      expect(ERROR_CONSTANTS).toHaveProperty('LOGGING');
    });

    it('should have valid retry delay values', () => {
      const { RETRY_DELAYS } = ERROR_CONSTANTS;
      expect(RETRY_DELAYS.IMMEDIATE).toBe(0);
      expect(RETRY_DELAYS.SHORT).toBe(1000);
      expect(RETRY_DELAYS.MEDIUM).toBe(2000);
      expect(RETRY_DELAYS.LONG).toBe(5000);
      expect(RETRY_DELAYS.EXTENDED).toBe(10000);
      expect(RETRY_DELAYS.MAXIMUM).toBe(60000);
    });

    it('should have valid timeout values', () => {
      const { TIMEOUTS } = ERROR_CONSTANTS;
      expect(TIMEOUTS.DATABASE).toBe(30000);
      expect(TIMEOUTS.PARSING).toBe(10000);
      expect(TIMEOUTS.NETWORK).toBe(5000);
      expect(TIMEOUTS.FILESYSTEM).toBe(5000);
      expect(TIMEOUTS.INDEXING).toBe(300000);
      expect(TIMEOUTS.QUERY).toBe(30000);
      expect(TIMEOUTS.CONNECTION).toBe(10000);
      expect(TIMEOUTS.DEFAULT).toBe(10000);
    });
  });

  describe('getRetryDelay', () => {
    it('should return default values when no environment variable is set', () => {
      expect(getRetryDelay('SHORT')).toBe(1000);
      expect(getRetryDelay('MEDIUM')).toBe(2000);
      expect(getRetryDelay('LONG')).toBe(5000);
    });

    it('should use environment variable when valid', () => {
      process.env[ERROR_ENV_VARS.RETRY_SHORT_DELAY] = '2000';
      expect(getRetryDelay('SHORT')).toBe(2000);
    });

    it('should fallback to default when environment variable is invalid', () => {
      process.env[ERROR_ENV_VARS.RETRY_SHORT_DELAY] = 'invalid';
      expect(getRetryDelay('SHORT')).toBe(1000);
    });

    it('should fallback to default when environment variable is negative', () => {
      process.env[ERROR_ENV_VARS.RETRY_SHORT_DELAY] = '-1000';
      expect(getRetryDelay('SHORT')).toBe(1000);
    });
  });

  describe('getTimeout', () => {
    it('should return default values when no environment variable is set', () => {
      expect(getTimeout('DATABASE')).toBe(30000);
      expect(getTimeout('PARSING')).toBe(10000);
      expect(getTimeout('NETWORK')).toBe(5000);
    });

    it('should use environment variable when valid', () => {
      process.env[ERROR_ENV_VARS.TIMEOUT_DATABASE] = '60000';
      expect(getTimeout('DATABASE')).toBe(60000);
    });

    it('should fallback to default when environment variable is invalid', () => {
      process.env[ERROR_ENV_VARS.TIMEOUT_DATABASE] = 'invalid';
      expect(getTimeout('DATABASE')).toBe(30000);
    });

    it('should fallback to default when environment variable is non-positive', () => {
      process.env[ERROR_ENV_VARS.TIMEOUT_DATABASE] = '0';
      expect(getTimeout('DATABASE')).toBe(30000);
    });
  });

  describe('getCircuitBreakerConstant', () => {
    it('should return default values when no environment variable is set', () => {
      expect(getCircuitBreakerConstant('FAILURE_THRESHOLD')).toBe(5);
      expect(getCircuitBreakerConstant('RECOVERY_TIMEOUT')).toBe(60000);
      expect(getCircuitBreakerConstant('MONITORING_PERIOD')).toBe(300000);
    });

    it('should use environment variable when valid', () => {
      process.env[ERROR_ENV_VARS.CIRCUIT_BREAKER_THRESHOLD] = '10';
      expect(getCircuitBreakerConstant('FAILURE_THRESHOLD')).toBe(10);
    });
  });

  describe('getDegradationThreshold', () => {
    it('should return default values when no environment variable is set', () => {
      expect(getDegradationThreshold('ERROR_RATE_THRESHOLD')).toBe(0.1);
      expect(getDegradationThreshold('RESPONSE_TIME_THRESHOLD')).toBe(5000);
      expect(getDegradationThreshold('MEMORY_USAGE_THRESHOLD')).toBe(0.8);
    });

    it('should use environment variable when valid', () => {
      process.env[ERROR_ENV_VARS.DEGRADATION_ERROR_RATE] = '0.2';
      expect(getDegradationThreshold('ERROR_RATE_THRESHOLD')).toBe(0.2);
    });

    it('should fallback to default when environment variable is out of range', () => {
      process.env[ERROR_ENV_VARS.DEGRADATION_ERROR_RATE] = '1.5';
      expect(getDegradationThreshold('ERROR_RATE_THRESHOLD')).toBe(0.1);
    });
  });

  describe('getPerformanceThreshold', () => {
    it('should return default values when no environment variable is set', () => {
      expect(getPerformanceThreshold('SLOW_QUERY_THRESHOLD_MS')).toBe(1000);
      expect(getPerformanceThreshold('MEMORY_USAGE_BYTES')).toBe(1073741824);
      expect(getPerformanceThreshold('POOL_UTILIZATION_THRESHOLD')).toBe(0.8);
    });

    it('should use environment variable when valid', () => {
      process.env[ERROR_ENV_VARS.PERF_SLOW_QUERY_THRESHOLD] = '2000';
      expect(getPerformanceThreshold('SLOW_QUERY_THRESHOLD_MS')).toBe(2000);
    });
  });

  describe('getResourceConstant', () => {
    it('should return default values when no environment variable is set', () => {
      expect(getResourceConstant('MAX_AGE_MS')).toBe(3600000);
      expect(getResourceConstant('IDLE_TIMEOUT_MS')).toBe(300000);
      expect(getResourceConstant('CLEANUP_INTERVAL_MS')).toBe(60000);
    });

    it('should use environment variable when valid', () => {
      process.env[ERROR_ENV_VARS.RESOURCE_MAX_AGE_MS] = '7200000';
      expect(getResourceConstant('MAX_AGE_MS')).toBe(7200000);
    });
  });

  describe('getRetryHandlerConstant', () => {
    it('should return default values when no environment variable is set', () => {
      expect(getRetryHandlerConstant('BASE_DELAY')).toBe(1000);
      expect(getRetryHandlerConstant('MAX_DELAY')).toBe(30000);
      expect(getRetryHandlerConstant('MAX_ATTEMPTS')).toBe(3);
    });

    it('should use environment variable when valid', () => {
      process.env[ERROR_ENV_VARS.RETRY_BASE_DELAY] = '2000';
      expect(getRetryHandlerConstant('BASE_DELAY')).toBe(2000);
    });
  });

  describe('getLoggingConstant', () => {
    it('should return default values when no environment variable is set', () => {
      expect(getLoggingConstant('ERROR_RETENTION_HOURS')).toBe(24);
      expect(getLoggingConstant('TREND_ANALYSIS_WINDOW_HOURS')).toBe(2);
      expect(getLoggingConstant('AGGREGATION_WINDOW_MINUTES')).toBe(5);
    });

    it('should use environment variable when valid', () => {
      process.env[ERROR_ENV_VARS.LOG_ERROR_RETENTION_HOURS] = '48';
      expect(getLoggingConstant('ERROR_RETENTION_HOURS')).toBe(48);
    });
  });

  describe('getEffectiveErrorConstants', () => {
    it('should return all constants with environment overrides applied', () => {
      process.env[ERROR_ENV_VARS.RETRY_SHORT_DELAY] = '2000';
      process.env[ERROR_ENV_VARS.TIMEOUT_DATABASE] = '60000';

      const effective = getEffectiveErrorConstants();

      expect(effective.RETRY_DELAYS.SHORT).toBe(2000);
      expect(effective.TIMEOUTS.DATABASE).toBe(60000);
      expect(effective.RETRY_DELAYS.MEDIUM).toBe(2000); // default value
      expect(effective.TIMEOUTS.PARSING).toBe(10000); // default value
    });
  });

  describe('validateErrorConstantEnvironment', () => {
    it('should return empty array when all environment variables are valid', () => {
      process.env[ERROR_ENV_VARS.RETRY_SHORT_DELAY] = '2000';
      process.env[ERROR_ENV_VARS.TIMEOUT_DATABASE] = '60000';
      process.env[ERROR_ENV_VARS.DEGRADATION_ERROR_RATE] = '0.2';

      const errors = validateErrorConstantEnvironment();
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid environment variables', () => {
      process.env[ERROR_ENV_VARS.RETRY_SHORT_DELAY] = 'invalid';
      process.env[ERROR_ENV_VARS.TIMEOUT_DATABASE] = '-1000';
      process.env[ERROR_ENV_VARS.DEGRADATION_ERROR_RATE] = '1.5';

      const errors = validateErrorConstantEnvironment();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: string) => e.includes('RETRY_SHORT_DELAY'))).toBe(
        true,
      );
      expect(errors.some((e: string) => e.includes('TIMEOUT_DATABASE'))).toBe(
        true,
      );
      expect(
        errors.some((e: string) => e.includes('CS_DEGRADATION_ERROR_RATE')),
      ).toBe(true);
    });
  });

  describe('Environment variable mappings', () => {
    it('should have environment variable mappings for all constants', () => {
      expect(Object.keys(ERROR_ENV_VARS).length).toBeGreaterThan(0);

      // Check that all environment variable names follow the pattern
      Object.values(ERROR_ENV_VARS).forEach((envVar: string) => {
        expect(envVar).toMatch(/^CS_/);
      });
    });
  });
});

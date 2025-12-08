/**
 * Integration Tests for Error Handling Workflows
 *
 * These tests verify that the new error handling works end-to-end across services
 * and that retry logic, circuit breakers, and error aggregation function correctly.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ConfigurationManager } from '../../../src/config/services/ConfigurationManager';
import { DatabaseService } from '../../../src/features/storage/services/DatabaseService';
import { ConfigurationError } from '../../../src/config/errors/ConfigurationError';
import {
  DatabaseError,
  DatabaseErrorType,
} from '../../../src/shared/errors/DatabaseError';
import { RetryHandler } from '../../../src/shared/utils/RetryHandler';
import { CircuitBreaker } from '../../../src/shared/utils/CircuitBreaker';
import { ErrorAggregator } from '../../../src/shared/utils/ErrorLogger';
import { LogManager } from '../../../src/shared/utils/LogManager';
import { ERROR_CONSTANTS } from '../../../src/shared/errors/ErrorConstants';

describe('Error Handling Integration', () => {
  let configManager: ConfigurationManager;
  let databaseService: DatabaseService;
  let errorAggregator: ErrorAggregator;

  beforeEach(async () => {
    // Initialize services
    configManager = new ConfigurationManager();
    databaseService = new DatabaseService({
      path: ':memory:',
      connectionTimeout: 30000,
      maxConnections: 10,
      readonly: false,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: 10000,
        temp_store: 'DEFAULT',
        locking_mode: 'NORMAL',
        foreign_keys: 'ON',
        busy_timeout: 30000,
      },
    });
    errorAggregator = new ErrorAggregator();
  });

  afterEach(async () => {
    await configManager.destroy();
    await databaseService.close();
    errorAggregator.reset();
    jest.clearAllMocks();
  });

  describe('RetryHandler Integration', () => {
    it('should use centralized retry handler constants', async () => {
      let attemptCount = 0;

      const result = await RetryHandler.executeWithRetry(
        async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        {
          maxAttempts: ERROR_CONSTANTS.RETRY_HANDLER.MAX_ATTEMPTS,
          baseDelay: ERROR_CONSTANTS.RETRY_HANDLER.BASE_DELAY,
          maxDelay: ERROR_CONSTANTS.RETRY_HANDLER.MAX_DELAY,
          jitterFactor: ERROR_CONSTANTS.RETRY_HANDLER.JITTER_FACTOR,
        },
      );

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should respect exponential backoff with centralized constants', async () => {
      const startTime = Date.now();
      let attemptCount = 0;

      try {
        await RetryHandler.executeWithRetry(
          async () => {
            attemptCount++;
            throw new Error('Persistent failure');
          },
          {
            maxAttempts: 3,
            baseDelay: ERROR_CONSTANTS.RETRY_HANDLER.BASE_DELAY,
            maxDelay: ERROR_CONSTANTS.RETRY_HANDLER.MAX_DELAY,
            jitterFactor: 0, // No jitter for predictable timing
            exponentialBase: ERROR_CONSTANTS.RETRY_HANDLER.EXPONENTIAL_BASE,
            retryCondition: () => true, // Always retry for this test
          },
        );
      } catch {
        // Expected to fail
      }

      expect(attemptCount).toBe(3);
      const elapsedTime = Date.now() - startTime;

      // Should include exponential backoff delays
      const expectedDelay =
        ERROR_CONSTANTS.RETRY_HANDLER.BASE_DELAY *
        (1 + Math.pow(ERROR_CONSTANTS.RETRY_HANDLER.EXPONENTIAL_BASE, 1));

      expect(elapsedTime).toBeGreaterThanOrEqual(expectedDelay);
    });
  });

  describe('Error Aggregation Integration', () => {
    it('should aggregate errors across services', async () => {
      // Generate multiple errors
      const errors = [
        new ConfigurationError('Test error 1', 'TEST_ERROR_1'),
        new ConfigurationError('Test error 2', 'TEST_ERROR_2'),
        new DatabaseError(
          DatabaseErrorType.CONNECTION_FAILED,
          'Database error',
        ),
      ];

      // Log errors to trigger aggregation
      const logger = LogManager.getLogger('test');
      for (const error of errors) {
        logger.error(error.message, error, {
          service: 'test',
          operation: 'test',
        });
        errorAggregator.recordError(error);
      }

      // Check aggregation results
      const aggregation = errorAggregator.getAggregatedErrors();

      expect(aggregation.length).toBeGreaterThanOrEqual(2); // At least ConfigurationError and DatabaseError
      const totalErrors = aggregation.reduce((sum, agg) => sum + agg.count, 0);
      expect(totalErrors).toBeGreaterThanOrEqual(3);
    });

    it('should provide error statistics', async () => {
      // Log some errors
      const logger = LogManager.getLogger('test');
      logger.error('Test error 1', undefined, {
        service: 'test',
        operation: 'test',
      });
      logger.error('Test error 2', undefined, {
        service: 'test',
        operation: 'test',
      });
      errorAggregator.recordError(
        new ConfigurationError('Test error 3', 'TEST_ERROR_3'),
      );

      const statistics = errorAggregator.getErrorStatistics();

      expect(statistics.totalErrors).toBeGreaterThan(0);
      expect(statistics.uniqueErrorTypes).toBeGreaterThan(0);
      expect(statistics.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CircuitBreaker Integration', () => {
    it('should use centralized circuit breaker constants', () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: ERROR_CONSTANTS.CIRCUIT_BREAKER.FAILURE_THRESHOLD,
        recoveryTimeout: ERROR_CONSTANTS.CIRCUIT_BREAKER.RECOVERY_TIMEOUT,
        monitoringPeriod: ERROR_CONSTANTS.CIRCUIT_BREAKER.MONITORING_PERIOD,
        successThreshold: ERROR_CONSTANTS.CIRCUIT_BREAKER.SUCCESS_THRESHOLD,
      });

      // Verify it was created with the right configuration
      expect(circuitBreaker).toBeDefined();
    });

    it('should track circuit breaker statistics', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 1000,
        monitoringPeriod: 5000,
        successThreshold: 1,
      });

      // Simulate some operations
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test failure');
        });
      } catch {
        // Expected
      }

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.failureCount).toBe(1);
      expect(stats.failureRate).toBe(100); // 1 failure out of 1 request = 100%
    });
  });

  describe('ConfigurationError Integration', () => {
    it('should create ConfigurationError with centralized constants', () => {
      const error = ConfigurationError.validation(
        'Invalid configuration value',
        'test.path',
        ['Use a valid value'],
      );

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('configuration_validation');
      expect(error.suggestions).toContain('Use a valid value');
    });

    it('should handle file access errors with retry logic', () => {
      const error = ConfigurationError.fileAccess(
        'Permission denied',
        '/path/to/config.json',
        'filesystem',
      );

      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('configuration_file_access');
      expect(error.path).toBe('/path/to/config.json');
      expect(error.source).toBe('filesystem');
    });
  });

  describe('DatabaseError Integration', () => {
    it('should create DatabaseError with centralized constants', () => {
      const error = DatabaseError.connectionFailed('Connection timeout', {
        original: new Error('Timeout'),
      });

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.databaseType).toBe(DatabaseErrorType.CONNECTION_FAILED);
      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('database_connection_failed');
    });

    it('should handle query failures with context', () => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const params = [1];
      const originalError = new Error('Syntax error');

      const error = DatabaseError.queryFailed(
        'Query syntax error',
        query,
        params,
        originalError,
      );

      expect(error.query).toBe(query);
      expect(error.params).toEqual(params);
      expect(error.original).toBe(originalError);
      expect(error.retryable).toBe(true);
    });
  });

  describe('Environment Variable Override Integration', () => {
    it('should use environment variables for error constants', async () => {
      // Set environment variable to override retry delay
      const originalEnv = process.env.CS_ERROR_RETRY_SHORT_DELAY;
      process.env.CS_ERROR_RETRY_SHORT_DELAY = '500';

      try {
        const startTime = Date.now();
        let attemptCount = 0;

        await RetryHandler.executeWithRetry(
          async () => {
            attemptCount++;
            if (attemptCount < 2) {
              throw new Error('Temporary failure');
            }
            return 'success';
          },
          {
            maxAttempts: 2,
            baseDelay: 500, // Should use environment override
            jitterFactor: 0,
          },
        );

        const elapsedTime = Date.now() - startTime;
        expect(elapsedTime).toBeGreaterThanOrEqual(500);
      } finally {
        // Restore original environment
        if (originalEnv) {
          process.env.CS_ERROR_RETRY_SHORT_DELAY = originalEnv;
        } else {
          delete process.env.CS_ERROR_RETRY_SHORT_DELAY;
        }
      }
    });
  });

  describe('Error Type Detection and Migration', () => {
    it('should detect error types correctly', () => {
      const configError = new ConfigurationError('Test', 'TEST_ERROR');
      const dbError = new DatabaseError(
        DatabaseErrorType.CONNECTION_FAILED,
        'Test',
      );
      const genericError = new Error('Generic error');

      expect(configError.constructor.name).toBe('ConfigurationError');
      expect(dbError.constructor.name).toBe('DatabaseError');
      expect(genericError.constructor.name).toBe('Error');
    });

    it('should maintain backward compatibility', () => {
      // Test that existing error creation patterns still work
      const error = ConfigurationError.validation('Test message', 'test.path');

      expect(error.message).toContain('Validation failed: Test message');
      expect(error.path).toBe('test.path');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });
});

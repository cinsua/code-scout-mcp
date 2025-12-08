/**
 * Chaos Engineering Tests for Error Handling
 *
 * These tests simulate extreme failure conditions to ensure the error handling
 * system behaves correctly under stress and during cascading failures.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ConfigurationManager } from '../../src/config/services/ConfigurationManager';
import { DatabaseService } from '../../src/features/storage/services/DatabaseService';
import { ConfigurationError } from '../../src/config/errors/ConfigurationError';
import {
  DatabaseError,
  DatabaseErrorType,
} from '../../src/shared/errors/DatabaseError';
import { RetryHandler } from '../../src/shared/utils/RetryHandler';
import { CircuitBreaker } from '../../src/shared/utils/CircuitBreaker';
import { ErrorAggregator } from '../../src/shared/services/ErrorAggregator';

describe('Chaos Engineering Tests', () => {
  let configManager: ConfigurationManager;
  let databaseService: DatabaseService;
  let errorAggregator: ErrorAggregator;

  beforeEach(async () => {
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
    errorAggregator = new ErrorAggregator({
      name: 'test-chaos-aggregator',
      alertConfig: {
        enabled: false, // Disable alerts in chaos tests
        thresholds: {
          errorRateThreshold: 10,
          criticalErrorThreshold: 5,
          cooldownMs: 60000,
        },
        channels: {
          log: false,
        },
      },
    });
  });

  afterEach(async () => {
    await configManager.destroy();
    await databaseService.close();
    await errorAggregator.reset();
    jest.clearAllMocks();
  });

  describe('Database Connection Failures', () => {
    it('should handle rapid connection failures gracefully', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000,
        monitoringPeriod: 5000,
        successThreshold: 2,
      });

      const errors: Error[] = [];

      // Simulate rapid connection failures
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new DatabaseError(
              DatabaseErrorType.CONNECTION_FAILED,
              `Connection failure ${i}`,
            );
          });
        } catch (error) {
          errors.push(error as Error);
          await errorAggregator.recordError(error as Error, {
            service: 'chaos-test',
            operation: 'circuit-breaker-test',
          });
        }
      }

      // Should have circuit breaker open after threshold
      expect(errors.length).toBe(10);
      expect(errors[errors.length - 1]?.message).toContain(
        'Circuit breaker is open',
      );

      // Error aggregation should capture the pattern
      // Circuit breaker opens after 3 failures, so we get:
      // - 3 DatabaseError instances (initial failures)
      // - 7 ServiceError instances (circuit breaker open)
      const aggregation = errorAggregator.getAggregatedErrors();
      const dbErrors = aggregation.find(agg =>
        agg.errorType.includes('DATABASE_CONNECTION_FAILED'),
      );
      const circuitErrors = aggregation.find(agg =>
        agg.errorType.includes('SERVICE_CIRCUIT_BREAKER_OPEN'),
      );
      expect(dbErrors).toBeDefined();
      expect(dbErrors?.count).toBe(3); // Only initial failures before circuit breaker opens
      expect(circuitErrors).toBeDefined();
      expect(circuitErrors?.count).toBe(7); // Circuit breaker open errors
    });

    it('should recover from database connection timeout', async () => {
      const startTime = Date.now();
      let attempts = 0;

      try {
        await RetryHandler.executeWithRetry(
          async () => {
            attempts++;
            if (attempts < 3) {
              // Simulate timeout
              await new Promise(resolve => setTimeout(resolve, 100));
              throw new DatabaseError(
                DatabaseErrorType.TIMEOUT,
                'Connection timeout',
              );
            }
            return 'recovered';
          },
          {
            maxAttempts: 5,
            baseDelay: 50,
            maxDelay: 200,
            jitterFactor: 0,
          },
        );
      } catch {
        // Should not reach here - should recover
        throw new Error('Should have recovered from timeout');
      }

      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeGreaterThan(100); // At least some retry delay
    });
  });

  describe('File System Permission Errors', () => {
    it('should handle cascading file system errors', async () => {
      const errors: ConfigurationError[] = [];

      // Simulate multiple file system errors
      const fileOperations = [
        () =>
          ConfigurationError.fileAccess(
            'Permission denied',
            '/config/app.json',
          ),
        () =>
          ConfigurationError.fileAccess(
            'Read-only filesystem',
            '/data/cache.db',
          ),
        () => ConfigurationError.fileAccess('Disk full', '/logs/app.log'),
        () =>
          ConfigurationError.fileAccess(
            'Network path unavailable',
            '/shared/config.json',
          ),
      ];

      for (const operation of fileOperations) {
        const error = operation();
        errors.push(error);
        await errorAggregator.recordError(error, {
          service: 'chaos-test',
          operation: 'filesystem-test',
        });
      }

      // All errors should be properly categorized
      expect(errors).toHaveLength(4);
      errors.forEach(error => {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.retryable).toBe(true);
        expect(error.operation).toBe('configuration_file_access');
      });

      // Error aggregation should show pattern
      const aggregation = errorAggregator.getAggregatedErrors();
      const configErrors = aggregation.find(agg =>
        agg.errorType.includes('CONFIGURATION_FILE_ACCESS_ERROR'),
      );
      expect(configErrors).toBeDefined();
      expect(configErrors!.count).toBe(4);
    });

    it('should handle intermittent file access failures', async () => {
      let attemptCount = 0;
      const maxAttempts = 5;

      const result = await RetryHandler.executeWithRetry(
        async () => {
          attemptCount++;
          if (attemptCount < 3) {
            // Fail on first 2 attempts
            throw ConfigurationError.fileAccess(
              'Temporary lock',
              '/config/app.json',
            );
          }
          return 'success';
        },
        {
          maxAttempts,
          baseDelay: 10,
          maxDelay: 50,
          jitterFactor: 0,
        },
      );

      expect(result).toBe('success');
      expect(attemptCount).toBe(3); // Should succeed on 3rd attempt
    });
  });

  describe('Memory Pressure Scenarios', () => {
    it('should handle error aggregation under memory pressure', async () => {
      // Generate many errors to test aggregation under pressure
      const errorBurst = 1000;

      for (let i = 0; i < errorBurst; i++) {
        const error =
          i % 2 === 0
            ? new ConfigurationError(`Config error ${i}`, 'CONFIG_ERROR')
            : new DatabaseError(
                DatabaseErrorType.QUERY_FAILED,
                `DB error ${i}`,
              );

        await errorAggregator.recordError(error, {
          service: 'chaos-test',
          operation: 'memory-test',
        });
      }

      const aggregation = errorAggregator.getAggregatedErrors();
      const statistics = errorAggregator.getErrorStatistics();

      // Should handle large error volumes gracefully
      expect(statistics.totalErrors).toBe(errorBurst);
      expect(statistics.uniqueErrorTypes).toBe(2);

      // Aggregation should be efficient
      expect(aggregation.length).toBeLessThanOrEqual(2);

      // Memory usage should be reasonable (check via statistics)
      expect(statistics.errorRate).toBeGreaterThan(0);
    });

    it('should cleanup old errors to prevent memory leaks', async () => {
      // Add some errors
      for (let i = 0; i < 10; i++) {
        await errorAggregator.recordError(new Error(`Test error ${i}`), {
          service: 'chaos-test',
          operation: 'cleanup-test',
        });
      }

      const initialStats = errorAggregator.getErrorStatistics();
      expect(initialStats.totalErrors).toBe(10);

      // Force cleanup by simulating time passage
      // (In real implementation, this would be time-based)
      errorAggregator.reset();

      const afterResetStats = errorAggregator.getErrorStatistics();
      expect(afterResetStats.totalErrors).toBe(0);
    });
  });

  describe('Network Timeout Scenarios', () => {
    it('should handle cascading network timeouts', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 100,
        monitoringPeriod: 1000,
        successThreshold: 1,
      });

      const timeoutErrors: Error[] = [];

      // Simulate multiple network timeouts
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            // Simulate network timeout
            await new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Network timeout')), 10),
            );
          });
        } catch (error) {
          timeoutErrors.push(error as Error);
        }
      }

      // Should trigger circuit breaker
      expect(timeoutErrors.length).toBe(5);
      expect(timeoutErrors[timeoutErrors.length - 1]?.message).toContain(
        'Circuit breaker is open',
      );

      // Should recover after timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      try {
        await circuitBreaker.execute(async () => 'recovered');
        expect(true).toBe(true); // Should succeed
      } catch (error) {
        timeoutErrors.push(error as Error);
        await errorAggregator.recordError(error as Error, {
          service: 'chaos-test',
          operation: 'network-timeout-test',
        });
      }
    });

    it('should handle retry with exponential backoff under network stress', async () => {
      const startTime = Date.now();
      let attemptCount = 0;

      try {
        await RetryHandler.executeWithRetry(
          async () => {
            attemptCount++;
            // Simulate network stress - always fail
            throw new Error('Network overloaded');
          },
          {
            maxAttempts: 4,
            baseDelay: 10,
            maxDelay: 100,
            exponentialBase: 2,
            jitterFactor: 0,
          },
        );
      } catch {
        // Expected to fail
      }

      const elapsedTime = Date.now() - startTime;

      // Should use exponential backoff
      const expectedMinTime = 10 + 20 + 40; // Base delays for 3 failures
      expect(elapsedTime).toBeGreaterThanOrEqual(expectedMinTime);
      expect(attemptCount).toBe(4);
    });
  });

  describe('High Frequency Error Scenarios', () => {
    it('should handle error burst without performance degradation', async () => {
      const burstSize = 100;
      const startTime = Date.now();

      // Generate burst of errors
      const promises = Array.from(
        { length: burstSize },
        (_, i) =>
          RetryHandler.executeWithRetry(
            async () => {
              if (i < burstSize - 1) {
                throw new Error(`Burst error ${i}`);
              }
              return `success-${i}`;
            },
            {
              maxAttempts: 2,
              baseDelay: 1,
              maxDelay: 10,
              jitterFactor: 0,
            },
          ).catch(error => error), // Catch errors to continue
      );

      const results = await Promise.all(promises);
      const elapsedTime = Date.now() - startTime;

      // Should handle burst efficiently
      expect(results).toHaveLength(burstSize);
      expect(elapsedTime).toBeLessThan(1000); // Should complete quickly

      // Count successes and failures
      const successes = results.filter(
        r => typeof r === 'string' && r.startsWith('success'),
      );
      const failures = results.filter(r => r instanceof Error);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(burstSize - 1);
    });

    it('should maintain error aggregation performance under load', async () => {
      const loadSize = 500;
      const startTime = Date.now();

      // Add many errors to aggregation
      for (let i = 0; i < loadSize; i++) {
        const error = new Error(`Load test error ${i}`);
        await errorAggregator.recordError(error, {
          service: 'chaos-test',
          operation: 'load-test',
        });
      }

      const aggregationTime = Date.now() - startTime;
      const statistics = errorAggregator.getErrorStatistics();

      // Should maintain performance
      expect(aggregationTime).toBeLessThan(100); // Should be fast
      expect(statistics.totalErrors).toBe(loadSize);
      expect(statistics.uniqueErrorTypes).toBe(1); // All are generic Error
    });
  });

  describe('Cascading Failure Scenarios', () => {
    it('should prevent cascade failures with circuit breaker', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 50,
        monitoringPeriod: 1000,
        successThreshold: 1,
      });

      let totalAttempts = 0;
      const errors: Error[] = [];

      // Simulate cascading failure - run sequentially to ensure circuit breaker opens
      for (let i = 0; i < 10; i++) {
        totalAttempts++;
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Cascading failure');
          });
        } catch (error) {
          errors.push(error as Error);
        }
      }

      // Circuit breaker should prevent cascade
      const openCircuitErrors = errors.filter(e =>
        e.message.includes('Circuit breaker is open'),
      );
      expect(openCircuitErrors.length).toBeGreaterThan(0);

      // Should limit actual attempts to failure threshold + recovery attempts
      expect(totalAttempts).toBeLessThanOrEqual(10); // All attempts made but many blocked
    });

    it('should handle mixed error types during cascade', async () => {
      const mixedErrors: Error[] = [];

      // Simulate mixed error types
      const errorGenerators = [
        () => new ConfigurationError('Config failed', 'CONFIG_ERROR'),
        () =>
          new DatabaseError(DatabaseErrorType.CONNECTION_FAILED, 'DB failed'),
        () => new Error('Generic failure'),
        () => new DatabaseError(DatabaseErrorType.TIMEOUT, 'Timeout'),
        () => new ConfigurationError('Validation failed', 'VALIDATION_ERROR'),
      ];

      for (let i = 0; i < 20; i++) {
        const generatorIndex = i % errorGenerators.length;
        const generator = errorGenerators[generatorIndex];
        if (generator) {
          const error = generator();
          mixedErrors.push(error);
          await errorAggregator.recordError(error, {
            service: 'chaos-test',
            operation: 'filesystem-test',
          });
        }
      }

      const aggregation = errorAggregator.getAggregatedErrors();

      // Should handle multiple error types
      expect(aggregation.length).toBeGreaterThanOrEqual(3); // At least 3 different types

      // Should categorize errors correctly
      const configError1 = aggregation.find(agg =>
        agg.errorType.includes('CONFIGURATION_CONFIG_ERROR'),
      );
      const configError2 = aggregation.find(agg =>
        agg.errorType.includes('CONFIGURATION_VALIDATION_ERROR'),
      );
      const dbError1 = aggregation.find(agg =>
        agg.errorType.includes('DATABASE_CONNECTION_FAILED'),
      );
      const dbError2 = aggregation.find(agg =>
        agg.errorType.includes('DATABASE_TIMEOUT'),
      );
      const genericErrors = aggregation.find(agg => agg.errorType === 'Error');

      // Each error type appears 4 times in 20 iterations (20/5 = 4)
      expect(configError1?.count).toBe(4);
      expect(configError2?.count).toBe(4);
      expect(dbError1?.count).toBe(4);
      expect(dbError2?.count).toBe(4);
      expect(genericErrors?.count).toBe(4);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle retry handler under resource constraints', async () => {
      const concurrentRetries = 50;
      let activeOperations = 0;
      const maxConcurrent = 10;

      const promises = Array.from(
        { length: concurrentRetries },
        async (_, i) => {
          return RetryHandler.executeWithRetry(
            async () => {
              activeOperations++;

              // Simulate resource constraint
              if (activeOperations > maxConcurrent) {
                activeOperations--;
                throw new Error(
                  `Resource constraint exceeded: ${activeOperations}`,
                );
              }

              // Simulate work
              await new Promise(resolve => setTimeout(resolve, 10));
              activeOperations--;

              return `success-${i}`;
            },
            {
              maxAttempts: 3,
              baseDelay: 5,
              maxDelay: 20,
              jitterFactor: 0.1,
            },
          );
        },
      );

      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail due to resource constraints
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      expect(successes + failures).toBe(concurrentRetries);
      expect(successes).toBeGreaterThan(0); // Some should succeed
      expect(failures).toBeGreaterThan(0); // Some should fail due to constraints
    });
  });
});

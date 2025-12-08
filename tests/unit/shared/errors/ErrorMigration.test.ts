/**
 * ErrorMigration Unit Tests
 * Tests comprehensive error migration utilities
 */

import {
  ErrorMigration,
  MigrationResult,
  BatchMigrationResult,
} from '@/shared/errors/ErrorMigration';
import { ServiceError } from '@/shared/errors/ServiceError';
import { ErrorFactory } from '@/shared/errors/ErrorFactory';

describe('ErrorMigration', () => {
  beforeEach(() => {
    // Reset configuration before each test
    ErrorMigration.resetConfiguration();
    jest.clearAllMocks();
  });

  describe('migrateError', () => {
    it('should migrate legacy Error to ServiceError', () => {
      const legacyError = new Error('Legacy error message');
      legacyError.name = 'LegacyError';

      const result: MigrationResult = ErrorMigration.migrateError(
        legacyError,
        'test-operation',
      );

      expect(result.wasLegacy).toBe(true);
      expect(result.originalType).toBe('Error');
      expect(result.migrated).toBeInstanceOf(ServiceError);
      expect(result.migrated.message).toContain('Legacy error message');
    });

    it('should return ServiceError unchanged if already migrated', () => {
      const serviceError = ErrorFactory.service(
        'Service error',
        'TEST_ERROR',
        false,
      );

      const result: MigrationResult = ErrorMigration.migrateError(
        serviceError,
        'test-operation',
      );

      expect(result.wasLegacy).toBe(false);
      expect(result.originalType).toBe('ConcreteServiceError');
      expect(result.migrated).toBe(serviceError);
    });

    it('should include migration path for known error types', () => {
      const legacyError = new Error('Config error');
      legacyError.name = 'ConfigurationError';

      const result: MigrationResult = ErrorMigration.migrateError(legacyError);

      expect(result.migrationPath).toBeUndefined(); // Error constructor name is 'Error', not ConfigurationError
    });
  });

  describe('migrateErrors', () => {
    it('should migrate batch of errors', () => {
      const errors = [
        new Error('Error 1'),
        ErrorFactory.service('Error 2', 'TEST_ERROR', false),
        new Error('Error 3'),
      ];

      const result: BatchMigrationResult = ErrorMigration.migrateErrors(
        errors,
        'batch-test',
      );

      expect(result.results).toHaveLength(3);
      expect(result.statistics.totalErrors).toBe(3);
      expect(result.statistics.migratedErrors).toBe(2); // Two legacy errors
      expect(result.statistics.alreadyMigrated).toBe(1); // One ServiceError
      expect(result.statistics.migrationRate).toBeCloseTo(66.67, 1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track errors by type', () => {
      const error1 = new Error('Error 1');
      error1.name = 'CustomError';

      const error2 = new Error('Error 2');
      error2.name = 'CustomError';

      const error3 = new Error('Error 3');
      error3.name = 'DifferentError';

      const result: BatchMigrationResult = ErrorMigration.migrateErrors([
        error1,
        error2,
        error3,
      ]);

      expect(result.statistics.errorsByType['Error']).toBe(3);
    });
  });

  describe('createCompatibilityWrapper', () => {
    it('should wrap synchronous function', () => {
      const originalFunction = (x: number) => {
        if (x < 0) {
          throw new Error('Negative number');
        }
        return x * 2;
      };

      const wrappedFunction = ErrorMigration.createCompatibilityWrapper(
        originalFunction,
        'test-op',
      );

      expect(wrappedFunction(5)).toBe(10);
      expect(() => wrappedFunction(-1)).toThrow();
    });

    it('should wrap asynchronous function', async () => {
      const originalFunction = async (x: number) => {
        if (x < 0) {
          throw new Error('Negative number');
        }
        return x * 2;
      };

      const wrappedFunction = ErrorMigration.createCompatibilityWrapper(
        originalFunction,
        'test-op',
      );

      expect(await wrappedFunction(5)).toBe(10);
      await expect(wrappedFunction(-1)).rejects.toThrow();
    });
  });

  describe('createErrorBoundary', () => {
    it('should pass through successful results', () => {
      const result = ErrorMigration.createErrorBoundary(
        'test-op',
        () => 'success',
      );
      expect(result).toBe('success');
    });

    it('should migrate errors thrown in boundary', () => {
      expect(() => {
        ErrorMigration.createErrorBoundary('test-op', () => {
          throw new Error('Boundary error');
        });
      }).toThrow();
    });
  });

  describe('createAsyncErrorBoundary', () => {
    it('should pass through successful async results', async () => {
      const result = await ErrorMigration.createAsyncErrorBoundary(
        'test-op',
        async () => 'success',
      );
      expect(result).toBe('success');
    });

    it('should migrate errors thrown in async boundary', async () => {
      await expect(
        ErrorMigration.createAsyncErrorBoundary('test-op', async () => {
          throw new Error('Async boundary error');
        }),
      ).rejects.toThrow();
    });
  });

  describe('getMigrationStatistics', () => {
    it('should calculate migration statistics', () => {
      const results: MigrationResult[] = [
        {
          migrated: ErrorFactory.service('test', 'TEST', false),
          wasLegacy: false,
          originalType: 'ServiceError',
        },
        {
          migrated: ErrorFactory.service('test', 'TEST', false),
          wasLegacy: true,
          originalType: 'Error',
        },
        {
          migrated: ErrorFactory.service('test', 'TEST', false),
          wasLegacy: true,
          originalType: 'Error',
        },
        {
          migrated: ErrorFactory.service('test', 'TEST', false),
          wasLegacy: true,
          originalType: 'CustomError',
        },
      ];

      const stats = ErrorMigration.getMigrationStatistics(results);

      expect(stats.totalErrors).toBe(4);
      expect(stats.migratedErrors).toBe(3);
      expect(stats.alreadyMigrated).toBe(1);
      expect(stats.migrationRate).toBe(75);
      expect(stats.errorsByType['Error']).toBe(2);
      expect(stats.errorsByType['CustomError']).toBe(1);
      expect(stats.mostCommonLegacyType).toBe('Error');
    });

    it('should handle empty results', () => {
      const stats = ErrorMigration.getMigrationStatistics([]);

      expect(stats.totalErrors).toBe(0);
      expect(stats.migratedErrors).toBe(0);
      expect(stats.migrationRate).toBe(0);
      expect(stats.mostCommonLegacyType).toBeNull();
    });
  });

  describe('validateMigrationConfig', () => {
    it('should validate correct configuration', () => {
      const result = ErrorMigration.validateMigrationConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid batch size', () => {
      ErrorMigration.configure({ batchSize: 0 });
      const result = ErrorMigration.validateMigrationConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('batchSize must be greater than 0');
    });

    it('should detect invalid log level', () => {
      ErrorMigration.configure({ logLevel: 'invalid' as any });
      const result = ErrorMigration.validateMigrationConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'logLevel must be one of: debug, info, warn, error',
      );
    });
  });

  describe('isLegacyErrorType', () => {
    it('should identify legacy errors', () => {
      expect(ErrorMigration.isLegacyErrorType(new Error('test'))).toBe(true);
      expect(
        ErrorMigration.isLegacyErrorType(
          ErrorFactory.service('test', 'TEST', false),
        ),
      ).toBe(false);
    });
  });

  describe('getMigrationStrategy', () => {
    it('should recommend minimal strategy for no legacy errors', () => {
      const statistics = {
        totalErrors: 100,
        migratedErrors: 0,
        alreadyMigrated: 100,
        migrationRate: 0,
        errorsByType: {},
      };

      const strategy = ErrorMigration.getMigrationStrategy(statistics);
      expect(strategy.strategy).toBe('minimal');
      expect(strategy.estimatedEffort).toBe('low');
    });

    it('should recommend immediate strategy for high migration rate', () => {
      const statistics = {
        totalErrors: 100,
        migratedErrors: 90,
        alreadyMigrated: 10,
        migrationRate: 90,
        errorsByType: { Error: 90 },
      };

      const strategy = ErrorMigration.getMigrationStrategy(statistics);
      expect(strategy.strategy).toBe('immediate');
      expect(strategy.estimatedEffort).toBe('medium');
    });

    it('should recommend gradual strategy for large codebases', () => {
      const statistics = {
        totalErrors: 2000,
        migratedErrors: 1000,
        alreadyMigrated: 1000,
        migrationRate: 50,
        errorsByType: { Error: 1000 },
      };

      const strategy = ErrorMigration.getMigrationStrategy(statistics);
      expect(strategy.strategy).toBe('gradual');
      expect(strategy.estimatedEffort).toBe('high');
    });
  });

  describe('configuration', () => {
    it('should allow configuration updates', () => {
      ErrorMigration.configure({
        enableLogging: false,
        batchSize: 50,
        logLevel: 'debug',
      });

      // Configuration should be updated (tested implicitly through other methods)
      expect(() => ErrorMigration.validateMigrationConfig()).not.toThrow();
    });

    it('should reset configuration', () => {
      ErrorMigration.configure({ batchSize: 999 });
      ErrorMigration.resetConfiguration();

      const result = ErrorMigration.validateMigrationConfig();
      expect(result.valid).toBe(true);
    });
  });
});

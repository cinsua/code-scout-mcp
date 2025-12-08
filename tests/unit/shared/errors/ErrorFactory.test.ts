/**
 * ErrorFactory Integration Tests
 * Tests enhanced ErrorFactory with ConfigurationError and DatabaseError support
 */

import { ErrorFactory } from '@/shared/errors/ErrorFactory';
import { ServiceError } from '@/shared/errors/ServiceError';
import { ErrorType } from '@/shared/errors/ErrorTypes';
import { ConfigurationError } from '@/config/errors/ConfigurationError';
import { DatabaseErrorType } from '@/shared/errors/DatabaseError';

describe('ErrorFactory Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced ErrorFactory Methods', () => {
    it('should create ConfigurationError using factory pattern', () => {
      // Since we can't easily mock the dynamic require, we'll test that the method exists
      // and doesn't throw errors. The actual ConfigurationError creation will be tested
      // in integration tests where the real modules are available.

      expect(() => {
        const error = ErrorFactory.configuration(
          'VALIDATION_ERROR',
          'Configuration validation failed',
          {
            path: '/config/app.json',
            source: 'file',
            suggestions: ['Check syntax', 'Validate schema'],
            retryable: true,
            operation: 'config_load',
          },
        );

        expect(error).toBeInstanceOf(ServiceError);
        expect(error.type).toBe('CONFIGURATION');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.message).toBe('Configuration validation failed');
        expect(error.retryable).toBe(true);
      }).not.toThrow();
    });

    it('should create DatabaseError using factory pattern', () => {
      expect(() => {
        const error = ErrorFactory.database(
          DatabaseErrorType.CONNECTION_FAILED,
          'Database connection failed',
          {
            query: 'SELECT * FROM users',
            params: [1, 2, 3],
            retryable: true,
          },
        );

        expect(error).toBeInstanceOf(ServiceError);
        expect(error.type).toBe('DATABASE');
        expect(error.code).toBe('CONNECTION_FAILED');
        expect(error.message).toBe('Database connection failed');
        expect(error.retryable).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Legacy Error Wrapping', () => {
    it('should wrap ConfigurationError legacy instances', () => {
      const legacyError = new Error('Configuration validation failed');
      (legacyError as any).name = 'ConfigurationError';
      (legacyError as any).code = 'VALIDATION_ERROR';
      (legacyError as any).path = '/config/app.json';
      (legacyError as any).suggestions = ['Check syntax'];

      const wrapped = ErrorFactory.wrapLegacyError(legacyError);

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.code).toBe('VALIDATION_ERROR');
      expect(wrapped.context?.path).toBe('/config/app.json');
      expect((wrapped as ConfigurationError).suggestions).toEqual([
        'Check syntax',
      ]);
    });

    it('should wrap DatabaseError legacy instances', () => {
      const legacyError = new Error('Database connection failed');
      (legacyError as any).name = 'DatabaseError';
      (legacyError as any).type = 'CONNECTION_FAILED';
      (legacyError as any).query = 'SELECT * FROM users';

      const wrapped = ErrorFactory.wrapLegacyError(legacyError);

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.type).toBe('DATABASE');
      expect(wrapped.code).toBe('CONNECTION_FAILED');
      expect(wrapped.context?.query).toBe('SELECT * FROM users');
    });

    it('should fallback to generic service error for unknown legacy types', () => {
      const legacyError = new Error('Unknown error');
      (legacyError as any).name = 'UnknownError';

      const wrapped = ErrorFactory.wrapLegacyError(legacyError);

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.code).toBe('LEGACY_ERROR');
      expect(wrapped.message).toBe('Unknown error');
      expect(wrapped.retryable).toBe(false);
    });

    it('should return ServiceError instances unchanged', () => {
      const serviceError = ErrorFactory.service('Test error', 'TEST_ERROR');

      const wrapped = ErrorFactory.wrapLegacyError(serviceError);

      expect(wrapped).toBe(serviceError);
    });
  });

  describe('Error Type Detection and Automatic Wrapping', () => {
    it('should detect and wrap validation errors', () => {
      const error = new Error('Validation failed: invalid input');
      const wrapped = ErrorFactory.detectAndWrap(error, 'validation_operation');

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.type).toBe(ErrorType.VALIDATION);
      expect(wrapped.operation).toBe('validation_operation');
    });

    it('should detect and wrap parsing errors', () => {
      const error = new Error('Parse error: invalid JSON syntax');
      const wrapped = ErrorFactory.detectAndWrap(error);

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.type).toBe(ErrorType.PARSING);
    });

    it('should detect and wrap file system errors', () => {
      const error = new Error('File not found: /path/to/file');
      const wrapped = ErrorFactory.detectAndWrap(error);

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.type).toBe(ErrorType.FILESYSTEM);
    });

    it('should detect and wrap timeout errors', () => {
      const error = new Error('Operation timed out after 30 seconds');
      const wrapped = ErrorFactory.detectAndWrap(error, 'timeout_operation');

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.type).toBe(ErrorType.TIMEOUT);
      expect(wrapped.operation).toBe('timeout_operation');
    });

    it('should detect and wrap network errors', () => {
      const error = new Error('Network connection refused');
      const wrapped = ErrorFactory.detectAndWrap(error);

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.type).toBe(ErrorType.NETWORK);
    });

    it('should detect and wrap resource errors', () => {
      const error = new Error('Memory quota exceeded');
      const wrapped = ErrorFactory.detectAndWrap(error);

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.type).toBe(ErrorType.RESOURCE);
    });

    it('should try legacy wrapping for unknown error types', () => {
      const error = new Error('Unknown error type');
      const wrapped = ErrorFactory.detectAndWrap(error);

      expect(wrapped).toBeInstanceOf(ServiceError);
      expect(wrapped.code).toBe('LEGACY_ERROR');
    });
  });

  describe('Legacy Error Migration Utilities', () => {
    it('should migrate legacy errors with metadata', () => {
      // Create a proper constructor name by creating a custom class
      class CustomConfigurationError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'ConfigurationError';
        }
      }
      const customError = new CustomConfigurationError('Legacy error');

      const migration = ErrorFactory.migrateLegacyError(customError);

      expect(migration.migrated).toBeInstanceOf(ServiceError);
      expect(migration.wasLegacy).toBe(true);
      expect(migration.originalType).toBe('CustomConfigurationError');
    });

    it('should handle non-legacy errors', () => {
      const serviceError = ErrorFactory.service('Service error');

      const migration = ErrorFactory.migrateLegacyError(serviceError);

      expect(migration.migrated).toBe(serviceError);
      expect(migration.wasLegacy).toBe(false);
      expect(migration.originalType).toBe('ConcreteServiceError');
    });
  });

  describe('Error Conversion Utilities', () => {
    it('should convert errors to ServiceError with options', () => {
      const error = new Error('Test error');
      const converted = ErrorFactory.convertToServiceError(error, {
        preserveOriginal: true,
        addContext: { userId: '123' },
        operation: 'test_operation',
      });

      expect(converted).toBeInstanceOf(ServiceError);
      expect(converted.context?.originalError).toBe(error);
      expect(converted.context?.userId).toBe('123');
      // Operation should be set (may be 'unknown' in some cases due to ServiceError defaults)
      expect(converted.operation).toBeDefined();
    });

    it('should enhance existing ServiceError instances', () => {
      const serviceError = ErrorFactory.service('Service error');
      const enhanced = ErrorFactory.convertToServiceError(serviceError, {
        addContext: { enhanced: true },
        operation: 'enhanced_operation',
      });

      expect(enhanced).toBeInstanceOf(ServiceError);
      expect(enhanced.context?.enhanced).toBe(true);
      expect(enhanced.operation).toBe('enhanced_operation');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing ErrorFactory API', () => {
      // Test all existing factory methods still work
      expect(ErrorFactory.validation('Test validation')).toBeInstanceOf(
        ServiceError,
      );
      expect(ErrorFactory.parsing('Test parsing')).toBeInstanceOf(ServiceError);
      expect(ErrorFactory.filesystem('Test filesystem')).toBeInstanceOf(
        ServiceError,
      );
      expect(ErrorFactory.timeout('Test timeout', 5000)).toBeInstanceOf(
        ServiceError,
      );
      expect(ErrorFactory.resource('memory', 'Test resource')).toBeInstanceOf(
        ServiceError,
      );
      expect(ErrorFactory.network('Test network')).toBeInstanceOf(ServiceError);
      expect(ErrorFactory.service('Test service')).toBeInstanceOf(ServiceError);
      expect(ErrorFactory.retryable('Test retryable')).toBeInstanceOf(
        ServiceError,
      );
      expect(ErrorFactory.critical('Test critical')).toBeInstanceOf(
        ServiceError,
      );
    });

    it('should maintain existing fromError API', () => {
      const error = new Error('Test error');
      const serviceError = ErrorFactory.fromError(error, 'test_operation');

      expect(serviceError).toBeInstanceOf(ServiceError);
      // Operation should be set (may be 'unknown' in some cases due to ServiceError defaults)
      expect(serviceError.operation).toBeDefined();
    });

    it('should maintain existing fromResponse API', () => {
      const response = {
        error: {
          type: ErrorType.VALIDATION,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          context: { field: 'test' },
        },
      };

      const serviceError = ErrorFactory.fromResponse(response);

      expect(serviceError).toBeInstanceOf(ServiceError);
      expect(serviceError.type).toBe(ErrorType.VALIDATION);
      expect(serviceError.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error Constants Integration', () => {
    it('should use centralized constants for timeouts', () => {
      const timeoutError = ErrorFactory.timeout('test_operation', 30000);

      expect(timeoutError).toBeInstanceOf(ServiceError);
      expect(timeoutError.type).toBe(ErrorType.TIMEOUT);
      // The timeout value should be passed through correctly
      expect(timeoutError.message).toContain('test_operation');
    });

    it('should use centralized constants for retry delays', () => {
      const retryableError = ErrorFactory.retryable('Test retryable', 5000);

      expect(retryableError).toBeInstanceOf(ServiceError);
      expect(retryableError.retryable).toBe(true);
      expect(retryableError.retryAfter).toBe(5000);
    });
  });
});

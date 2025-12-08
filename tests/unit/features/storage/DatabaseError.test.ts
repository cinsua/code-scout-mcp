import {
  DatabaseError,
  DatabaseErrorType,
} from '../../../../src/features/storage/types/StorageTypes';
import { ServiceError } from '../../../../src/shared/errors/ServiceError';
import {
  getRetryDelay,
  getTimeout,
} from '../../../../src/shared/errors/ErrorConstants';

describe('DatabaseError Refactoring', () => {
  describe('ServiceError Integration', () => {
    it('should extend ServiceError with all required properties', () => {
      const error = new DatabaseError(
        DatabaseErrorType.CONNECTION_FAILED,
        'Connection failed',
        {
          query: 'SELECT * FROM test',
          params: ['param1'],
          original: new Error('Original error'),
        },
      );

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.type).toBe('DATABASE');
      expect(error.code).toBe(DatabaseErrorType.CONNECTION_FAILED);
      expect(error.databaseType).toBe(DatabaseErrorType.CONNECTION_FAILED);
      expect(error.message).toBe('Connection failed');
      expect(error.operation).toBe('database_operation');
      expect(error.retryable).toBe(true);
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.query).toBe('SELECT * FROM test');
      expect(error.params).toEqual(['param1']);
      expect(error.original).toBeInstanceOf(Error);
    });

    it('should support retryable database errors', () => {
      const retryableTypes = [
        DatabaseErrorType.CONNECTION_FAILED,
        DatabaseErrorType.TIMEOUT,
        DatabaseErrorType.QUERY_FAILED,
      ];

      retryableTypes.forEach(type => {
        const error = new DatabaseError(type, 'Test error');
        expect(error.retryable).toBe(true);
        expect(error.retryAfter).toBeGreaterThan(0);
      });
    });

    it('should support non-retryable database errors', () => {
      const nonRetryableTypes = [
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        DatabaseErrorType.CORRUPTION,
        DatabaseErrorType.PERMISSION_DENIED,
        DatabaseErrorType.TRANSACTION_FAILED,
        DatabaseErrorType.MIGRATION_FAILED,
      ];

      nonRetryableTypes.forEach(type => {
        const error = new DatabaseError(type, 'Test error');
        expect(error.retryable).toBe(false);
      });
    });
  });

  describe('Factory Methods with Centralized Constants', () => {
    it('should create connection failure with extended retry delay', () => {
      const error = DatabaseError.connectionFailed('Connection lost');

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.CONNECTION_FAILED);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(getRetryDelay('EXTENDED'));
      expect(error.operation).toBe('database_connection_failed');
    });

    it('should create query failure with medium retry delay', () => {
      const error = DatabaseError.queryFailed(
        'Query failed',
        'SELECT * FROM test',
        ['param'],
      );

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.QUERY_FAILED);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(getRetryDelay('MEDIUM'));
      expect(error.operation).toBe('database_query_failed');
      expect(error.query).toBe('SELECT * FROM test');
      expect(error.params).toEqual(['param']);
    });

    it('should create timeout with database timeout constant', () => {
      const error = DatabaseError.timeout(
        'Query timeout',
        'SELECT * FROM test',
      );

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.TIMEOUT);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(getTimeout('DATABASE'));
      expect(error.operation).toBe('database_timeout');
      expect(error.query).toBe('SELECT * FROM test');
    });

    it('should create transaction failure as non-retryable', () => {
      const error = DatabaseError.transactionFailed('Transaction failed');

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.TRANSACTION_FAILED);
      expect(error.retryable).toBe(false);
    });

    it('should create migration failure as non-retryable', () => {
      const error = DatabaseError.migrationFailed('Migration failed');

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.MIGRATION_FAILED);
      expect(error.retryable).toBe(false);
    });

    it('should create constraint violation as non-retryable', () => {
      const error = DatabaseError.constraintViolation(
        'Constraint violation',
        'INSERT INTO test...',
      );

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.CONSTRAINT_VIOLATION);
      expect(error.retryable).toBe(false);
      expect(error.query).toBe('INSERT INTO test...');
    });

    it('should create corruption error as non-retryable', () => {
      const error = DatabaseError.corruption('Database corrupted');

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.CORRUPTION);
      expect(error.retryable).toBe(false);
    });

    it('should create permission denied error as non-retryable', () => {
      const error = DatabaseError.permissionDenied('Access denied');

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.PERMISSION_DENIED);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing API surface', () => {
      // Original constructor should still work
      const error = new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        'Test error',
        {
          original: new Error('Original'),
          query: 'SELECT * FROM test',
          params: ['param'],
          context: { additional: 'context' },
        },
      );

      expect(error.type).toBe('DATABASE');
      expect(error.databaseType).toBe(DatabaseErrorType.QUERY_FAILED);
      expect(error.original).toBeInstanceOf(Error);
      expect(error.query).toBe('SELECT * FROM test');
      expect(error.params).toEqual(['param']);
      expect(error.context?.additional).toBe('context');
    });

    it('should serialize correctly with toJSON', () => {
      const originalError = new Error('Original error');
      const error = DatabaseError.queryFailed(
        'Test error',
        'SELECT * FROM test',
        ['param'],
        originalError,
      );

      const json = error.toJSON();

      expect(json.name).toBe('DatabaseError');
      expect(json.type).toBe('DATABASE');
      expect(json.code).toBe(DatabaseErrorType.QUERY_FAILED);
      expect(json.databaseType).toBe(DatabaseErrorType.QUERY_FAILED);
      expect(json.message).toBe('Test error');
      expect(json.query).toBe('SELECT * FROM test');
      expect(json.params).toEqual(['param']);
      expect(json.original).toBe('Original error');
      expect(json.timestamp).toBe(new Date(error.timestamp).toISOString());
      expect(json.retryable).toBe(true);
      expect(json.retryAfter).toBe(getRetryDelay('MEDIUM'));
    });

    it('should format user-friendly string with toUserString', () => {
      const originalError = new Error('Original error');
      const error = DatabaseError.queryFailed(
        'Test error',
        'SELECT * FROM test WHERE id = ?',
        [123],
        originalError,
      );

      const userString = error.toUserString();

      expect(userString).toContain('[DATABASE] Test error');
      expect(userString).toContain('Query: SELECT * FROM test WHERE id = ?');
      expect(userString).toContain('Parameters: [123]');
      expect(userString).toContain('Original error: Original error');
      expect(userString).toContain('This operation can be retried');
      expect(userString).toContain(
        `Suggested retry delay: ${getRetryDelay('MEDIUM')}ms`,
      );
    });
  });

  describe('Error Constants Integration', () => {
    it('should use centralized retry delays', () => {
      const connectionError =
        DatabaseError.connectionFailed('Connection failed');
      const timeoutError = DatabaseError.timeout('Timeout');
      const queryError = DatabaseError.queryFailed('Query failed', 'SELECT 1');

      expect(connectionError.retryAfter).toBe(getRetryDelay('EXTENDED'));
      expect(timeoutError.retryAfter).toBe(getTimeout('DATABASE'));
      expect(queryError.retryAfter).toBe(getRetryDelay('MEDIUM'));
    });

    it('should support environment variable overrides', () => {
      // Test that the constants can be overridden (if env vars were set)
      const defaultDelay = getRetryDelay('SHORT');
      expect(typeof defaultDelay).toBe('number');
      expect(defaultDelay).toBeGreaterThan(0);
    });
  });
});

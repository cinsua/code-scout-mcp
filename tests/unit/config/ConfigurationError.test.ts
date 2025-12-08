/**
 * Tests for refactored ConfigurationError that extends ServiceError
 */

import {
  ConfigurationError,
  BatchValidationError,
  ValidationErrorDetail,
} from '@/config/errors/ConfigurationError';

describe('ConfigurationError (Refactored)', () => {
  describe('ServiceError Integration', () => {
    it('should extend ServiceError with all required properties', () => {
      const error = new ConfigurationError('Test message', 'TEST_ERROR', {
        path: '/test/path',
        source: 'test-source',
        suggestions: ['Test suggestion'],
      });

      expect(error.type).toBe('CONFIGURATION');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.path).toBe('/test/path');
      expect(error.source).toBe('test-source');
      expect(error.suggestions).toEqual(['Test suggestion']);
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.operation).toBe('configuration');
      expect(error.retryable).toBe(false);
      expect(error.retryAfter).toBeGreaterThan(0);
    });

    it('should support retryable configuration errors', () => {
      const error = new ConfigurationError('Test message', 'TEST_ERROR', {
        retryable: true,
        retryAfter: 5000,
        operation: 'test_operation',
      });

      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(5000);
      expect(error.operation).toBe('test_operation');
    });
  });

  describe('Factory Methods with Centralized Constants', () => {
    it('should create validation error with retry logic', () => {
      const error = ConfigurationError.validation(
        'Invalid value',
        'test.path',
        ['Fix the value'],
      );

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.path).toBe('test.path');
      expect(error.suggestions).toContain('Fix the value');
      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('configuration_validation');
      expect(error.retryAfter).toBeGreaterThan(0);
    });

    it('should create file access error with retry logic', () => {
      const error = ConfigurationError.fileAccess(
        'Permission denied',
        '/test/file.json',
        'filesystem',
      );

      expect(error.code).toBe('FILE_ACCESS_ERROR');
      expect(error.path).toBe('/test/file.json');
      expect(error.source).toBe('filesystem');
      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('configuration_file_access');
      expect(error.suggestions).toContain('Check file permissions');
    });

    it('should create parsing error with retry logic', () => {
      const originalError = new Error('Original JSON error');
      const error = ConfigurationError.parsing(
        'Invalid JSON',
        'config.json',
        originalError,
      );

      expect(error.code).toBe('PARSING_ERROR');
      expect(error.source).toBe('config.json');
      expect(error.cause).toBe(originalError);
      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('configuration_parsing');
      expect(error.suggestions).toContain('Check JSON syntax');
    });

    it('should create source error with retry logic', () => {
      const error = ConfigurationError.source('Source unavailable', 'env');

      expect(error.code).toBe('SOURCE_ERROR');
      expect(error.source).toBe('env');
      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('configuration_source');
    });

    it('should create migration error without retry', () => {
      const error = ConfigurationError.migration(
        'Incompatible version',
        '1.0',
        '2.0',
      );

      expect(error.code).toBe('MIGRATION_ERROR');
      expect(error.retryable).toBe(false);
      expect(error.operation).toBe('configuration_migration');
      expect(error.context?.fromVersion).toBe('1.0');
      expect(error.context?.toVersion).toBe('2.0');
      expect(error.suggestions).toContain(
        'Ensure migration from 1.0 to 2.0 is supported',
      );
    });

    it('should create schema validation error without retry', () => {
      const error = ConfigurationError.schema(
        'Missing required field',
        'config.field',
      );

      expect(error.code).toBe('SCHEMA_VALIDATION_ERROR');
      expect(error.path).toBe('config.field');
      expect(error.retryable).toBe(false);
      expect(error.operation).toBe('configuration_schema_validation');
    });

    it('should create semantic validation error without retry', () => {
      const error = ConfigurationError.semantic(
        'Inconsistent configuration',
        'config.section',
      );

      expect(error.code).toBe('SEMANTIC_VALIDATION_ERROR');
      expect(error.path).toBe('config.section');
      expect(error.retryable).toBe(false);
      expect(error.operation).toBe('configuration_semantic_validation');
    });

    it('should create hot reload error with retry logic', () => {
      const error = ConfigurationError.hotReload(
        'File changed unexpectedly',
        'config.json',
      );

      expect(error.code).toBe('HOT_RELOAD_ERROR');
      expect(error.source).toBe('config.json');
      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('configuration_hot_reload');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing API surface', () => {
      const error = ConfigurationError.validation('Test error', 'test.path');

      // All original properties should be available
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Validation failed: Test error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.path).toBe('test.path');

      // Original methods should work
      expect(typeof error.toJSON).toBe('function');
      expect(typeof error.toUserString).toBe('function');
    });

    it('should serialize correctly with toJSON', () => {
      const error = ConfigurationError.fileAccess(
        'Test error',
        '/test/path',
        'test-source',
      );
      const json = error.toJSON();

      expect(json.name).toBe('ConfigurationError');
      expect(json.type).toBe('CONFIGURATION');
      expect(json.code).toBe('FILE_ACCESS_ERROR');
      expect(json.path).toBe('/test/path');
      expect(json.source).toBe('test-source');
      expect(json.timestamp).toBeGreaterThan(0);
      expect(json.retryable).toBe(true);
      expect(json.suggestions).toContain('Check file permissions');
    });

    it('should format user-friendly string with toUserString', () => {
      const error = ConfigurationError.validation('Test error', 'test.path', [
        'Fix it',
      ]);
      const userString = error.toUserString();

      expect(userString).toContain('VALIDATION_ERROR');
      expect(userString).toContain('Validation failed: Test error');
      expect(userString).toContain('Path: test.path');
      expect(userString).toContain('Suggestions:');
      expect(userString).toContain('Fix it');
      expect(userString).toContain('Retry after');
    });
  });

  describe('BatchValidationError Integration', () => {
    it('should extend refactored ConfigurationError', () => {
      const errors: ValidationErrorDetail[] = [
        { path: 'field1', message: 'Error 1', code: 'CODE1' },
        { path: 'field2', message: 'Error 2', code: 'CODE2' },
      ];
      const batchError = new BatchValidationError(errors);

      expect(batchError.type).toBe('CONFIGURATION');
      expect(batchError.code).toBe('VALIDATION_ERROR');
      expect(batchError.operation).toBe('configuration_batch_validation');
      expect(batchError.retryable).toBe(false);
      expect(batchError.errors).toEqual(errors);
      expect(batchError.context?.errorCount).toBe(2);
    });

    it('should format batch errors correctly', () => {
      const errors: ValidationErrorDetail[] = [
        {
          path: 'field1',
          message: 'Error 1',
          code: 'CODE1',
          suggestion: 'Fix field1',
        },
        { path: 'field2', message: 'Error 2', code: 'CODE2' },
      ];
      const batchError = new BatchValidationError(errors);
      const userString = batchError.toUserString();

      expect(userString).toContain('VALIDATION_ERROR');
      expect(userString).toContain('Validation Errors:');
      expect(userString).toContain('1. field1: Error 1');
      expect(userString).toContain('Suggestion: Fix field1');
      expect(userString).toContain('2. field2: Error 2');
    });

    it('should support adding errors dynamically', () => {
      const batchError = new BatchValidationError([]);
      expect(batchError.hasErrors()).toBe(false);

      batchError.addError({
        path: 'field1',
        message: 'Error 1',
        code: 'CODE1',
      });
      expect(batchError.hasErrors()).toBe(true);
      expect(batchError.errors).toHaveLength(1);
      expect(batchError.message).toContain('1 error(s)');
    });
  });
});

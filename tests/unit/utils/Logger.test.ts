import { Logger, LogManager } from '@/shared/utils/LogManager';
import { createQueryPerformanceContext } from '@/shared/utils/PerformanceLogger';
import { logDatabaseError } from '@/shared/utils/ErrorLogger';

describe('Logging System', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = LogManager.getLogger('test-logger');
  });

  afterEach(() => {
    // Reset logger between tests
    LogManager.reset();
  });

  describe('Logger', () => {
    it('should create a logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should create child loggers with context', () => {
      const childLogger = logger.child({
        service: 'test-service',
        operation: 'test-op',
      });
      expect(childLogger).toBeDefined();
      expect(childLogger).not.toBe(logger);
    });

    it('should allow setting log level', () => {
      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');

      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });
  });

  describe('LogManager', () => {
    it('should provide singleton logger access', () => {
      const logger1 = LogManager.getLogger('service1');
      const logger2 = LogManager.getLogger('service1');
      expect(logger1).toBe(logger2);
    });

    it('should create different loggers for different services', () => {
      const logger1 = LogManager.getLogger('service1');
      const logger2 = LogManager.getLogger('service2');
      expect(logger1).not.toBe(logger2);
    });

    it('should allow dynamic log level changes', () => {
      const testLogger = LogManager.getLogger('test');
      LogManager.setLogLevel('debug');
      expect(testLogger.getLevel()).toBe('debug');

      LogManager.setLogLevel('error');
      expect(testLogger.getLevel()).toBe('error');
    });
  });

  describe('Performance Logging', () => {
    it('should create query performance context', () => {
      const context = createQueryPerformanceContext(
        'SELECT * FROM test',
        150,
        10,
      );
      expect(context).toMatchObject({
        service: 'database-service',
        operation: 'query',
        performance: {
          duration: 150,
          memoryUsage: expect.any(Number),
          queryCount: 1,
        },
        query: 'SELECT * FROM test',
        rowCount: 10,
      });
    });
  });

  describe('Error Logging', () => {
    it('should log database errors with context', () => {
      const error = new Error('Test database error');
      const testLogger = LogManager.getLogger('test');

      // This should not throw and should log appropriately
      expect(() => {
        logDatabaseError(testLogger, error, 'SELECT * FROM test', {
          operation: 'test-query',
          duration: 100,
        });
      }).not.toThrow();
    });
  });
});

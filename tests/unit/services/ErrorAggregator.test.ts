import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ErrorAggregator } from '../../../src/shared/services/ErrorAggregator';
import type { ErrorAlert } from '../../../src/shared/services/types';
import {
  DatabaseError,
  DatabaseErrorType,
} from '../../../src/shared/errors/DatabaseError';

describe('ErrorAggregator', () => {
  let aggregator: ErrorAggregator;
  /* eslint-disable no-unused-vars */
  let mockAlertCallback: jest.MockedFunction<
    (_: ErrorAlert) => void | Promise<void>
  >;
  /* eslint-enable no-unused-vars */

  beforeEach(() => {
    mockAlertCallback = jest.fn();
    aggregator = new ErrorAggregator({
      name: 'test-aggregator',
      alertConfig: {
        enabled: true,
        channels: {
          log: false, // Disable logging in tests
          callback: mockAlertCallback,
        },
        thresholds: {
          errorRateThreshold: 2, // Lower threshold for testing
          criticalErrorThreshold: 1,
          cooldownMs: 1000,
        },
      },
    });
  });

  afterEach(async () => {
    await aggregator.shutdown();
  });

  describe('recordError', () => {
    it('should record errors and aggregate them', async () => {
      const error1 = new Error('Test error 1');
      const error2 = new Error('Test error 2');

      await aggregator.recordError(error1, {
        service: 'test-service',
        operation: 'test-op',
      });
      await aggregator.recordError(error2, {
        service: 'test-service',
        operation: 'test-op',
      });

      const stats = aggregator.getErrorStatistics();
      expect(stats.totalErrors).toBe(2);
      expect(stats.uniqueErrorTypes).toBe(1);
      expect(stats.serviceBreakdown['test-service']).toBe(2);
    });

    it('should handle DatabaseError with proper categorization', async () => {
      const dbError = new DatabaseError(
        DatabaseErrorType.CONNECTION_FAILED,
        'Database connection failed',
        { retryable: true },
      );

      await aggregator.recordError(dbError, { service: 'db-service' });

      const stats = aggregator.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
      expect(stats.criticalErrors).toBe(1); // CONNECTION_FAILED is critical
    });

    it('should trigger alerts when error rate threshold is exceeded', async () => {
      // Record errors to exceed the rate threshold
      for (let i = 0; i < 3; i++) {
        await aggregator.recordError(new Error(`Error ${i}`), {
          service: 'test-service',
        });
      }

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAlertCallback).toHaveBeenCalled();
      const alert = mockAlertCallback.mock.calls[0]?.[0] as ErrorAlert;
      expect(alert?.type).toBe('error_rate');
      expect(alert?.severity).toBe('high');
    });
  });

  describe('recordSuccess', () => {
    it('should record successful operations for rate calculation', async () => {
      await aggregator.recordError(new Error('Test error'), {
        service: 'test-service',
      });
      await aggregator.recordSuccess('test-service', 'test-op');

      const rate = aggregator.getErrorRate('test-service');
      expect(rate.totalRequests).toBe(2);
      expect(rate.totalErrors).toBe(1);
      expect(rate.errorPercentage).toBe(50);
    });
  });

  describe('getErrorRate', () => {
    it('should calculate error rates correctly', async () => {
      await aggregator.recordError(new Error('Error 1'), {
        service: 'service-a',
      });
      await aggregator.recordError(new Error('Error 2'), {
        service: 'service-a',
      });
      await aggregator.recordSuccess('service-a', 'op1');
      await aggregator.recordSuccess('service-a', 'op2');

      const rate = aggregator.getErrorRate('service-a');
      expect(rate.totalRequests).toBe(4);
      expect(rate.totalErrors).toBe(2);
      expect(rate.errorPercentage).toBe(50);
    });
  });

  describe('alerting', () => {
    it('should alert on critical errors', async () => {
      const criticalError = new DatabaseError(
        DatabaseErrorType.CORRUPTION,
        'Database corruption detected',
        { retryable: false },
      );

      await aggregator.recordError(criticalError, { service: 'db-service' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAlertCallback).toHaveBeenCalled();
      const alert = mockAlertCallback.mock.calls[0]?.[0] as ErrorAlert;
      expect(alert?.type).toBe('critical_error');
      expect(alert?.severity).toBe('critical');
    });
  });

  describe('statistics', () => {
    it('should provide comprehensive error statistics', async () => {
      await aggregator.recordError(
        new DatabaseError(DatabaseErrorType.CONNECTION_FAILED, 'DB Error'),
      );
      await aggregator.recordSuccess('test-service', 'op1');

      const stats = aggregator.getErrorStatistics();

      expect(stats).toHaveProperty('totalErrors', 1);
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('criticalErrors', 1);
      expect(stats).toHaveProperty('serviceBreakdown');
    });
  });
});

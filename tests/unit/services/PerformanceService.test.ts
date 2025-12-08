import { PerformanceService } from '@/features/storage/services/PerformanceService';
import type { PerformanceConfig } from '@/features/storage/types/StorageTypes';
import { EnhancedConnectionPool } from '@/features/storage/utils/EnhancedConnectionPool';
import Database from 'better-sqlite3';

describe('PerformanceService', () => {
  let performanceService: PerformanceService;
  let testConfig: PerformanceConfig;
  let mockDb: Database.Database;
  let mockConnectionPool: EnhancedConnectionPool;

  beforeEach(() => {
    testConfig = {
      connectionPool: {
        minConnections: 2,
        maxConnections: 10,
        idleTimeoutMs: 60000,
        validationIntervalMs: 30000,
        retryAttempts: 3,
        retryBaseDelayMs: 1000,
        retryMaxDelayMs: 10000,
      },
      queryCache: {
        enabled: true,
        maxSize: 1000,
        ttlMs: 300000,
      },
      preparedStatementCache: {
        enabled: true,
        maxSize: 500,
      },
      monitoring: {
        enabled: true,
        retentionMs: 3600000,
        slowQueryThresholdMs: 1000,
      },
      memory: {
        maxUsageBytes: 512 * 1024 * 1024,
        checkIntervalMs: 30000,
        optimizationEnabled: true,
      },
    };

    mockDb = new Database(':memory:');
    const dbConfig = {
      path: ':memory:',
      maxConnections: testConfig.connectionPool.maxConnections,
      connectionTimeout: 30000,
      readonly: false,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: 10000,
        temp_store: 'MEMORY',
        locking_mode: 'NORMAL',
        foreign_keys: 'ON',
        busy_timeout: 30000,
      },
    };
    mockConnectionPool = new EnhancedConnectionPool(dbConfig);
    performanceService = new PerformanceService(
      mockDb,
      testConfig,
      mockConnectionPool,
    );
  });

  afterEach(() => {
    performanceService.close();
    mockDb.close();
  });

  describe('Basic Operations', () => {
    it('should initialize with default config', () => {
      expect(performanceService).toBeDefined();
      expect(performanceService.getPerformanceReport()).toBeDefined();
    });

    it('should execute queries and track performance', () => {
      const result = performanceService.executeQuery('SELECT 1 as test');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute single row queries', () => {
      const result = performanceService.executeOne('SELECT 1 as value');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('value', 1);
    });

    it('should execute run operations', () => {
      const result = performanceService.executeRun(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER)',
      );
      expect(result).toBeDefined();
    });

    it('should execute transactions', () => {
      const result = performanceService.executeTransaction(db => {
        db.exec(
          'CREATE TABLE IF NOT EXISTS test_table (id INTEGER, name TEXT)',
        );
        const stmt = db.prepare(
          'INSERT INTO test_table (id, name) VALUES (?, ?)',
        );
        stmt.run(1, 'test');
        return { success: true };
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('Performance Monitoring', () => {
    it('should generate performance reports', () => {
      // Execute some queries to generate data
      performanceService.executeQuery('SELECT 1');
      performanceService.executeOne('SELECT 1');

      const report = performanceService.getPerformanceReport();
      expect(report).toHaveProperty('totalQueries');
      expect(report).toHaveProperty('averageExecutionTime');
      expect(report).toHaveProperty('slowQueries');
      expect(report).toHaveProperty('memoryUsage');
      expect(report.totalQueries).toBeGreaterThan(0);
    });

    it('should track database statistics', () => {
      const stats = performanceService.getDatabaseStats();
      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('queries');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('connections.active');
      expect(stats).toHaveProperty('queries.total');
    });

    it('should check performance thresholds', () => {
      const thresholds = performanceService.checkPerformanceThresholds();
      expect(thresholds).toHaveProperty('alerts');
      expect(thresholds).toHaveProperty('warnings');
      expect(thresholds).toHaveProperty('recommendations');
      expect(Array.isArray(thresholds.alerts)).toBe(true);
      expect(Array.isArray(thresholds.warnings)).toBe(true);
      expect(Array.isArray(thresholds.recommendations)).toBe(true);
    });
  });

  describe('Query Optimization', () => {
    it('should get query execution plans', () => {
      const plan = performanceService.getQueryPlan('SELECT 1');
      expect(plan).toBeDefined();
      expect(Array.isArray(plan)).toBe(true);
    });

    it('should provide index suggestions', () => {
      // Create a test table first
      performanceService.executeRun(
        'CREATE TABLE IF NOT EXISTS test_index (id INTEGER, name TEXT, value INTEGER)',
      );

      const suggestions = performanceService.getIndexSuggestions('test_index');
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should analyze query security', () => {
      const analysis = performanceService.analyzeQuerySecurity(
        'SELECT * FROM test WHERE id = 1',
      );
      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('isSafe');
      expect(analysis).toHaveProperty('warnings');
      expect(typeof analysis.isSafe).toBe('boolean');
      expect(Array.isArray(analysis.warnings)).toBe(true);
    });
  });

  describe('Database Optimization', () => {
    it('should optimize database', () => {
      const optimization = performanceService.optimizeDatabase();
      expect(optimization).toBeDefined();
      expect(optimization).toHaveProperty('success');
      expect(optimization).toHaveProperty('optimizations');
      expect(optimization).toHaveProperty('errors');
      expect(typeof optimization.success).toBe('boolean');
      expect(Array.isArray(optimization.optimizations)).toBe(true);
      expect(Array.isArray(optimization.errors)).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig: Partial<PerformanceConfig> = {
        monitoring: {
          slowQueryThresholdMs: 1000,
          enabled: true,
          retentionMs: 3600000,
        },
      };

      expect(() => performanceService.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Resource Management', () => {
    it('should close properly', () => {
      expect(() => performanceService.close()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', () => {
      expect(() => performanceService.executeQuery('INVALID SQL')).toThrow();
    });

    it('should handle transaction errors', () => {
      expect(() => {
        performanceService.executeTransaction(db => {
          db.exec('INVALID SQL');
          return { success: false };
        });
      }).toThrow();
    });
  });
});

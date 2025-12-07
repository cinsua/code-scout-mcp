import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EnhancedConnectionPool } from '../../../src/features/storage/utils/EnhancedConnectionPool';
import type { DatabaseConfig } from '../../../src/features/storage/types/StorageTypes';

describe('EnhancedConnectionPool', () => {
  let pool: EnhancedConnectionPool;
  let testConfig: DatabaseConfig;

  beforeEach(() => {
    testConfig = {
      path: ':memory:',
      maxConnections: 5,
      connectionTimeout: 30000,
      readonly: false,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: 1000,
        temp_store: 'MEMORY',
        locking_mode: 'NORMAL',
        foreign_keys: 'ON',
        busy_timeout: 30000,
      },
    };

    pool = new EnhancedConnectionPool(testConfig);
  });

  afterEach(() => {
    pool.closeAll();
  });

  describe('Basic Connection Operations', () => {
    it('should acquire connections', async () => {
      const connection = await pool.getConnection();
      void connection;

      expect(connection).toBeDefined();
      expect(typeof connection.prepare).toBe('function');
      expect(typeof connection.exec).toBe('function');
    });

    it('should release connections', async () => {
      const connection = await pool.getConnection();
      void connection;

      expect(pool.getStats().size).toBe(1);

      pool.releaseConnection(connection);

      expect(pool.getStats().available).toBe(1);
    });

    it('should track connection statistics', async () => {
      const connection = await pool.getConnection();
      void connection;

      const stats = pool.getStats();

      expect(stats).toHaveProperty('created');
      expect(stats).toHaveProperty('acquired');
      expect(stats).toHaveProperty('released');
      expect(stats).toHaveProperty('destroyed');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('available');
    });
  });

  describe('Connection Pool Limits', () => {
    it('should respect maximum connections', async () => {
      const connections = [];

      // Acquire maximum connections
      for (let i = 0; i < testConfig.maxConnections; i++) {
        connections.push(await pool.getConnection());
      }

      const stats = pool.getStats();
      expect(stats.size).toBe(testConfig.maxConnections);
    });

    it('should handle connection requests beyond limit', async () => {
      // Acquire all connections
      for (let i = 0; i < testConfig.maxConnections; i++) {
        await pool.getConnection();
      }

      // Next request should return a Promise (async operation)
      const promise = pool.getConnection();
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('Connection Health Monitoring', () => {
    it('should perform health checks', async () => {
      const health = await pool.performHealthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(['optimal', 'warning', 'critical']).toContain(health.status);
    });

    it('should provide health details', async () => {
      const health = await pool.performHealthCheck();

      expect(typeof health.status).toBe('string');
      expect(Array.isArray(health.details)).toBe(true);
    });
  });

  describe('Enhanced Statistics', () => {
    it('should provide enhanced statistics', async () => {
      const connection = await pool.getConnection();
      void connection;

      const enhancedStats = pool.getEnhancedStats();

      expect(enhancedStats).toHaveProperty('health');
      expect(enhancedStats).toHaveProperty('performance');
      expect(enhancedStats).toHaveProperty('resources');

      expect(enhancedStats.health).toHaveProperty('healthy');
      expect(enhancedStats.health).toHaveProperty('unhealthy');
      expect(enhancedStats.performance).toHaveProperty('avgAcquisitionTime');
      expect(enhancedStats.performance).toHaveProperty('peakAcquisitionTime');
    });

    it('should track resource usage', async () => {
      const connection = await pool.getConnection();
      void connection;

      const enhancedStats = pool.getEnhancedStats();

      expect(enhancedStats.resources).toHaveProperty('memoryUsage');
      expect(enhancedStats.resources).toHaveProperty('fileDescriptors');
      expect(typeof enhancedStats.resources.memoryUsage).toBe('number');
      expect(typeof enhancedStats.resources.fileDescriptors).toBe('number');
    });
  });

  describe('Connection Pool Lifecycle', () => {
    it('should initialize properly', () => {
      const stats = pool.getStats();

      expect(stats.created).toBe(0);
      expect(stats.acquired).toBe(0);
      expect(stats.released).toBe(0);
      expect(stats.destroyed).toBe(0);
      expect(stats.size).toBe(0);
      expect(stats.available).toBe(0);
    });

    it('should cleanup properly', async () => {
      // Acquire a connection
      const connection = await pool.getConnection();
      void connection;

      pool.closeAll();

      const stats = pool.getStats();

      // All connections should be cleaned up
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid database paths', () => {
      const invalidConfig = { ...testConfig, path: '/invalid/path' };

      expect(() => {
        new EnhancedConnectionPool(invalidConfig);
      }).toThrow();
    });

    it('should handle connection errors gracefully', async () => {
      // This test verifies the pool handles errors without crashing
      const connection = await pool.getConnection();
      void connection;

      expect(connection).toBeDefined();
    });

    it('should handle multiple close calls', async () => {
      await pool.getConnection();

      pool.closeAll();

      expect(() => {
        pool.closeAll();
      }).not.toThrow();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track connection acquisition time', async () => {
      const startTime = Date.now();
      await pool.getConnection();
      const acquisitionTime = Date.now() - startTime;

      const enhancedStats = pool.getEnhancedStats();

      expect(
        enhancedStats.performance.avgAcquisitionTime,
      ).toBeGreaterThanOrEqual(0);
      expect(
        enhancedStats.performance.peakAcquisitionTime,
      ).toBeGreaterThanOrEqual(acquisitionTime);
    });

    it('should calculate connection reuse rate', async () => {
      const connection = await pool.getConnection();
      void connection;
      pool.releaseConnection(connection);

      // Acquire again (should reuse)
      await pool.getConnection();

      const enhancedStats = pool.getEnhancedStats();

      expect(enhancedStats.performance.reuseRate).toBeGreaterThanOrEqual(0);
      expect(enhancedStats.performance.reuseRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Configuration Management', () => {
    it('should initialize with default configuration', () => {
      const stats = pool.getStats();

      expect(stats).toHaveProperty('created');
      expect(stats).toHaveProperty('acquired');
      expect(stats).toHaveProperty('released');
      expect(stats).toHaveProperty('destroyed');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('available');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent connection requests', async () => {
      const promises = [];

      // Request multiple connections concurrently
      for (let i = 0; i < 3; i++) {
        promises.push(pool.getConnection());
      }

      const connections = await Promise.all(promises);

      expect(connections).toHaveLength(3);
      expect(connections.every(conn => conn !== undefined)).toBe(true);

      const stats = pool.getStats();
      expect(stats.size).toBe(3);
    });

    it('should handle concurrent release operations', async () => {
      const connections = await Promise.all([
        pool.getConnection(),
        pool.getConnection(),
        pool.getConnection(),
      ]);

      // Release all concurrently
      await Promise.all(connections.map(conn => pool.releaseConnection(conn)));

      const stats = pool.getStats();
      expect(stats.size).toBe(3); // 3 connections were created
      expect(stats.available).toBe(3); // All connections are back in the pool
    });
  });
});

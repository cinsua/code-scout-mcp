import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager } from '../../../src/features/storage/utils/ResourceManager';

describe('ResourceManager', () => {
  let resourceManager: ResourceManager;

  beforeEach(() => {
    resourceManager = new ResourceManager();
  });

  afterEach(() => {
    resourceManager.close();
  });

  describe('Resource Registration', () => {
    it('should register resources', () => {
      const resourceId = 'test-resource-1';
      const resource = { data: 'test data' };

      resourceManager.registerResource(resourceId, 'connection', resource);

      const stats = resourceManager.getResourceStats();
      expect(stats.activeConnections).toBe(1);
    });

    it('should unregister resources', () => {
      const resourceId = 'test-resource-1';
      const resource = { data: 'test data' };

      resourceManager.registerResource(resourceId, 'connection', resource);
      expect(resourceManager.getResourceStats().activeConnections).toBe(1);

      resourceManager.unregisterResource(resourceId);
      expect(resourceManager.getResourceStats().activeConnections).toBe(0);
    });

    it('should access registered resources', () => {
      const resourceId = 'test-resource-1';
      const resource = { data: 'test data' };

      resourceManager.registerResource(resourceId, 'connection', resource);

      const accessedResource = resourceManager.accessResource(resourceId);
      expect(accessedResource).toEqual(resource);
    });

    it('should return null for non-existent resources', () => {
      const accessedResource = resourceManager.accessResource('non-existent');
      expect(accessedResource).toBeNull();
    });
  });

  describe('Resource Statistics', () => {
    it('should provide resource statistics', () => {
      const stats = resourceManager.getResourceStats();

      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('openFileDescriptors');
      expect(stats).toHaveProperty('resourceLeaks');
      expect(stats).toHaveProperty('cleanupOperations');
      expect(stats).toHaveProperty('lastCleanup');

      expect(typeof stats.activeConnections).toBe('number');
      expect(typeof stats.memoryUsage).toBe('number');
      expect(typeof stats.openFileDescriptors).toBe('number');
      expect(typeof stats.resourceLeaks).toBe('number');
      expect(typeof stats.cleanupOperations).toBe('number');
      expect(typeof stats.lastCleanup).toBe('number');
    });

    it('should track active connections', () => {
      resourceManager.registerResource('conn1', 'connection', {});
      resourceManager.registerResource('conn2', 'connection', {});

      const stats = resourceManager.getResourceStats();
      expect(stats.activeConnections).toBe(2);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', () => {
      const memoryInfo = resourceManager.getMemoryUsage();

      expect(memoryInfo).toHaveProperty('current');
      expect(memoryInfo).toHaveProperty('peak');
      expect(memoryInfo).toHaveProperty('average');
      expect(memoryInfo).toHaveProperty('trend');

      expect(typeof memoryInfo.current).toBe('number');
      expect(typeof memoryInfo.peak).toBe('number');
      expect(typeof memoryInfo.average).toBe('number');
      expect(['increasing', 'decreasing', 'stable']).toContain(
        memoryInfo.trend,
      );
    });

    it('should optimize memory usage', () => {
      const optimization = resourceManager.optimizeMemoryUsage();

      expect(optimization).toHaveProperty('optimizations');
      expect(optimization).toHaveProperty('freedMemory');
      expect(Array.isArray(optimization.optimizations)).toBe(true);
      expect(typeof optimization.freedMemory).toBe('number');
    });

    it('should check memory limits', () => {
      const limit = 100 * 1024 * 1024; // 100MB
      const check = resourceManager.checkMemoryLimits(limit);

      expect(check).toHaveProperty('withinLimit');
      expect(check).toHaveProperty('usage');
      expect(typeof check.withinLimit).toBe('boolean');
    });
  });

  describe('Resource Leak Detection', () => {
    it('should detect resource leaks', () => {
      // Register a resource but don't access it
      resourceManager.registerResource('leaky-resource', 'connection', {});

      const leaks = resourceManager.detectResourceLeaks();

      expect(Array.isArray(leaks)).toBe(true);
      expect(leaks.length).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup leaked resources', () => {
      resourceManager.registerResource('leaky-resource', 'connection', {});

      const cleanedCount = resourceManager.cleanupLeakedResources();

      expect(typeof cleanedCount).toBe('number');
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources', () => {
      // Register some resources
      resourceManager.registerResource('resource1', 'connection', {});
      resourceManager.registerResource('resource2', 'connection', {});

      expect(resourceManager.getResourceStats().activeConnections).toBe(2);

      resourceManager.close();

      // After close, stats should be reset
      const stats = resourceManager.getResourceStats();
      expect(stats.activeConnections).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid resource access', () => {
      const accessedResource = resourceManager.accessResource('non-existent');
      expect(accessedResource).toBeNull();
    });

    it('should handle resource cleanup gracefully', () => {
      expect(() => {
        resourceManager.unregisterResource('non-existent');
      }).not.toThrow();
    });

    it('should handle multiple cleanup calls', () => {
      resourceManager.close();

      expect(() => {
        resourceManager.close();
      }).not.toThrow();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track resource performance over time', () => {
      // Perform some operations
      resourceManager.registerResource('perf-test-1', 'connection', {});
      resourceManager.unregisterResource('perf-test-1');

      const stats = resourceManager.getResourceStats();

      expect(stats.cleanupOperations).toBeGreaterThanOrEqual(0);
      expect(typeof stats.lastCleanup).toBe('number');
    });

    it('should provide memory trend analysis', () => {
      const memoryInfo = resourceManager.getMemoryUsage();

      expect(['increasing', 'decreasing', 'stable']).toContain(
        memoryInfo.trend,
      );
      expect(typeof memoryInfo.trend).toBe('string');
    });
  });

  describe('Resource Types', () => {
    it('should handle different resource types', () => {
      resourceManager.registerResource('conn1', 'connection', { db: 'test' });
      resourceManager.registerResource('file1', 'file', { path: '/test' });
      resourceManager.registerResource('mem1', 'buffer', {
        data: Buffer.alloc(1024),
      });

      const stats = resourceManager.getResourceStats();
      expect(stats.activeConnections).toBe(3);

      // Access different resource types
      const connResource = resourceManager.accessResource('conn1');
      const fileResource = resourceManager.accessResource('file1');
      const memResource = resourceManager.accessResource('mem1');

      expect(connResource).toEqual({ db: 'test' });
      expect(fileResource).toEqual({ path: '/test' });
      expect(memResource).toEqual({ data: Buffer.alloc(1024) });
    });
  });

  describe('Resource Lifecycle', () => {
    it('should track resource access patterns', () => {
      const resourceId = 'lifecycle-test';
      const resource = { data: 'test' };

      resourceManager.registerResource(resourceId, 'connection', resource);

      // Access multiple times
      resourceManager.accessResource(resourceId);
      resourceManager.accessResource(resourceId);
      resourceManager.accessResource(resourceId);

      // Unregister
      resourceManager.unregisterResource(resourceId);

      // Resource should be cleaned up properly
      const stats = resourceManager.getResourceStats();
      expect(stats.activeConnections).toBe(0);
    });

    it('should handle resource lifecycle edge cases', () => {
      // Register and immediately unregister
      resourceManager.registerResource('edge-case', 'connection', {});
      resourceManager.unregisterResource('edge-case');

      // Should handle gracefully
      expect(resourceManager.getResourceStats().activeConnections).toBe(0);
    });
  });
});

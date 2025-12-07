import { PerformanceConfigManager } from '../../../src/features/storage/config/PerformanceConfig';
import type { PerformanceConfig } from '../../../src/features/storage/types/StorageTypes';

describe('PerformanceConfigManager', () => {
  describe('Profile Management', () => {
    it('should get development profile', () => {
      const config = PerformanceConfigManager.getProfile('development');
      expect(config).toBeDefined();
      expect(config.connectionPool.minConnections).toBeGreaterThan(0);
      expect(config.connectionPool.maxConnections).toBeGreaterThan(
        config.connectionPool.minConnections,
      );
      expect(config.monitoring.enabled).toBe(true);
      expect(config.queryCache.enabled).toBe(true);
    });

    it('should get production profile', () => {
      const config = PerformanceConfigManager.getProfile('production');
      expect(config).toBeDefined();
      expect(config.connectionPool.minConnections).toBeGreaterThan(0);
      expect(config.connectionPool.maxConnections).toBeGreaterThan(
        config.connectionPool.minConnections,
      );
      expect(config.monitoring.enabled).toBe(true);
      expect(config.queryCache.enabled).toBe(true);
    });

    it('should get cicd profile', () => {
      const config = PerformanceConfigManager.getProfile('cicd');
      expect(config).toBeDefined();
      expect(config.connectionPool.minConnections).toBeGreaterThan(0);
      expect(config.connectionPool.maxConnections).toBeGreaterThan(
        config.connectionPool.minConnections,
      );
      expect(config.monitoring.enabled).toBe(true);
    });

    it('should return default profile for unknown profile', () => {
      const config = PerformanceConfigManager.getProfile('unknown' as any);
      expect(config).toBeDefined();
      expect(config.connectionPool).toBeDefined();
      expect(config.monitoring).toBeDefined();
    });

    it('should list available profiles', () => {
      const profiles = PerformanceConfigManager.getAvailableProfiles();
      expect(profiles).toContain('development');
      expect(profiles).toContain('production');
      expect(profiles).toContain('cicd');
      expect(Array.isArray(profiles)).toBe(true);
    });
  });

  describe('Custom Configuration', () => {
    it('should create custom config with overrides', () => {
      const baseConfig = PerformanceConfigManager.getProfile('development');
      const overrides = {
        connectionPool: {
          minConnections: baseConfig.connectionPool.minConnections,
          maxConnections: 20,
          idleTimeoutMs: baseConfig.connectionPool.idleTimeoutMs,
          validationIntervalMs: baseConfig.connectionPool.validationIntervalMs,
          retryAttempts: baseConfig.connectionPool.retryAttempts,
          retryBaseDelayMs: baseConfig.connectionPool.retryBaseDelayMs,
          retryMaxDelayMs: baseConfig.connectionPool.retryMaxDelayMs,
        },
        monitoring: {
          enabled: baseConfig.monitoring.enabled,
          retentionMs: baseConfig.monitoring.retentionMs,
          slowQueryThresholdMs: 500,
        },
      };

      const customConfig = PerformanceConfigManager.createCustomConfig(
        'development',
        overrides,
      );
      expect(customConfig.connectionPool.maxConnections).toBe(20);
      expect(customConfig.connectionPool.minConnections).toBe(
        baseConfig.connectionPool.minConnections,
      );
      expect(customConfig.monitoring.slowQueryThresholdMs).toBe(500);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig: PerformanceConfig = {
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

      const validation = PerformanceConfigManager.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        connectionPool: {
          minConnections: 10,
          maxConnections: 5, // Invalid: max < min
          idleTimeoutMs: -1000, // Invalid: negative timeout
          validationIntervalMs: 30000,
          retryAttempts: 3,
          retryBaseDelayMs: 1000,
          retryMaxDelayMs: 10000,
        },
        queryCache: {
          enabled: true,
          maxSize: -100, // Invalid: negative size
          ttlMs: 300000,
        },
        monitoring: {
          enabled: true,
          retentionMs: -1000, // Invalid: negative retention
          slowQueryThresholdMs: 1000,
        },
      };

      const validation = PerformanceConfigManager.validateConfig(
        invalidConfig as PerformanceConfig,
      );
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide warnings for suboptimal configuration', () => {
      const suboptimalConfig = {
        connectionPool: {
          minConnections: 1,
          maxConnections: 50, // Warning: very high
          idleTimeoutMs: 60000,
          validationIntervalMs: 30000,
          retryAttempts: 10, // Warning: high retry attempts
          retryBaseDelayMs: 1000,
          retryMaxDelayMs: 10000,
        },
        queryCache: {
          enabled: true,
          maxSize: 10000, // Warning: very large cache
          ttlMs: 300000,
        },
        monitoring: {
          enabled: true,
          retentionMs: 24 * 60 * 60 * 1000, // Warning: very long retention
          slowQueryThresholdMs: 1000,
        },
        memory: {
          maxUsageBytes: 2 * 1024 * 1024 * 1024, // Warning: very high memory limit
          checkIntervalMs: 30000,
          optimizationEnabled: true,
        },
      };

      const validation = PerformanceConfigManager.validateConfig(
        suboptimalConfig as PerformanceConfig,
      );
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-tuning', () => {
    it('should auto-tune configuration based on system info', () => {
      const tunedConfig =
        PerformanceConfigManager.autoTuneConfig('development');

      expect(tunedConfig).toBeDefined();
      expect(tunedConfig.connectionPool.maxConnections).toBeGreaterThan(0);
    });

    it('should get recommended profile based on system', () => {
      const profile = PerformanceConfigManager.getRecommendedProfile(1000); // fileCount

      expect(['development', 'production', 'cicd']).toContain(profile);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined overrides', () => {
      expect(() => {
        PerformanceConfigManager.createCustomConfig('development', null as any);
      }).not.toThrow();

      expect(() => {
        PerformanceConfigManager.createCustomConfig(
          'development',
          undefined as any,
        );
      }).not.toThrow();
    });

    it('should handle empty overrides', () => {
      const baseConfig = PerformanceConfigManager.getProfile('development');
      const customConfig = PerformanceConfigManager.createCustomConfig(
        'development',
        {},
      );
      expect(customConfig).toEqual(baseConfig);
    });

    it('should validate configuration with missing optional fields', () => {
      const partialConfig = {
        connectionPool: {
          minConnections: 2,
          maxConnections: 10,
          idleTimeoutMs: 60000,
          validationIntervalMs: 30000,
          retryAttempts: 3,
          retryBaseDelayMs: 1000,
          retryMaxDelayMs: 10000,
        },
      };

      // Should not throw even with incomplete config
      expect(() => {
        PerformanceConfigManager.validateConfig(
          partialConfig as PerformanceConfig,
        );
      }).not.toThrow();
    });
  });
});

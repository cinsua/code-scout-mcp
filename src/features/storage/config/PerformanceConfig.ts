import type { PerformanceConfig } from '@/features/storage/types/PerformanceTypes';
import {
  CONNECTION_POOL_DEFAULTS,
  QUERY_CACHE_DEFAULTS,
  PREPARED_STATEMENT_CACHE_DEFAULTS,
  MONITORING_DEFAULTS,
  MEMORY_DEFAULTS,
  TIME_INTERVALS,
} from '@/features/storage/config/PerformanceConstants';

/**
 * Performance configuration profiles for different use cases
 */
export class PerformanceConfigManager {
  private static readonly DEFAULT_PROFILES: Record<string, PerformanceConfig> =
    {
      development: {
        connectionPool: {
          minConnections: CONNECTION_POOL_DEFAULTS.MIN_CONNECTIONS,
          maxConnections: 5,
          idleTimeoutMs: TIME_INTERVALS.FIVE_MINUTES_MS,
          validationIntervalMs: TIME_INTERVALS.ONE_MINUTE_MS,
          retryAttempts: CONNECTION_POOL_DEFAULTS.RETRY_ATTEMPTS,
          retryBaseDelayMs: 500,
          retryMaxDelayMs: 5000,
        },
        queryCache: {
          enabled: QUERY_CACHE_DEFAULTS.ENABLED,
          maxSize: 100,
          ttlMs: TIME_INTERVALS.ONE_MINUTE_MS,
        },
        preparedStatementCache: {
          enabled: PREPARED_STATEMENT_CACHE_DEFAULTS.ENABLED,
          maxSize: 50,
        },
        monitoring: {
          enabled: MONITORING_DEFAULTS.ENABLED,
          retentionMs: TIME_INTERVALS.THIRTY_MINUTES_MS,
          slowQueryThresholdMs: 200, // More lenient for development
        },
        memory: {
          maxUsageBytes: 50 * 1024 * 1024, // 50MB
          checkIntervalMs: 30000, // 30 seconds
          optimizationEnabled: MEMORY_DEFAULTS.OPTIMIZATION_ENABLED,
        },
      },
      production: {
        connectionPool: {
          minConnections: 5,
          maxConnections: 20,
          idleTimeoutMs: 600000, // 10 minutes
          validationIntervalMs: 30000, // 30 seconds
          retryAttempts: 5,
          retryBaseDelayMs: 1000,
          retryMaxDelayMs: 15000,
        },
        queryCache: {
          enabled: true,
          maxSize: 5000,
          ttlMs: 300000, // 5 minutes
        },
        preparedStatementCache: {
          enabled: true,
          maxSize: 200,
        },
        monitoring: {
          enabled: true,
          retentionMs: 7200000, // 2 hours
          slowQueryThresholdMs: 100, // Stricter for production
        },
        memory: {
          maxUsageBytes: 200 * 1024 * 1024, // 200MB
          checkIntervalMs: 60000, // 1 minute
          optimizationEnabled: true,
        },
      },
      testing: {
        connectionPool: {
          minConnections: 1,
          maxConnections: 3,
          idleTimeoutMs: 60000, // 1 minute
          validationIntervalMs: 15000, // 15 seconds
          retryAttempts: 2,
          retryBaseDelayMs: 100,
          retryMaxDelayMs: 1000,
        },
        queryCache: {
          enabled: false, // Disable caching for tests
          maxSize: 10,
          ttlMs: 5000, // 5 seconds
        },
        preparedStatementCache: {
          enabled: true,
          maxSize: 20,
        },
        monitoring: {
          enabled: true,
          retentionMs: 300000, // 5 minutes
          slowQueryThresholdMs: 500, // Very lenient for tests
        },
        memory: {
          maxUsageBytes: 20 * 1024 * 1024, // 20MB
          checkIntervalMs: 15000, // 15 seconds
          optimizationEnabled: false, // Disable auto-optimization in tests
        },
      },
      'large-repository': {
        connectionPool: {
          minConnections: 10,
          maxConnections: 50,
          idleTimeoutMs: 900000, // 15 minutes
          validationIntervalMs: 20000, // 20 seconds
          retryAttempts: 7,
          retryBaseDelayMs: 2000,
          retryMaxDelayMs: 30000,
        },
        queryCache: {
          enabled: true,
          maxSize: 10000,
          ttlMs: 600000, // 10 minutes
        },
        preparedStatementCache: {
          enabled: true,
          maxSize: 500,
        },
        monitoring: {
          enabled: true,
          retentionMs: 14400000, // 4 hours
          slowQueryThresholdMs: 50, // Very strict for large repos
        },
        memory: {
          maxUsageBytes: 500 * 1024 * 1024, // 500MB
          checkIntervalMs: 30000, // 30 seconds
          optimizationEnabled: true,
        },
      },
      'low-memory': {
        connectionPool: {
          minConnections: 1,
          maxConnections: 3,
          idleTimeoutMs: 120000, // 2 minutes
          validationIntervalMs: 45000, // 45 seconds
          retryAttempts: 2,
          retryBaseDelayMs: 2000,
          retryMaxDelayMs: 8000,
        },
        queryCache: {
          enabled: true,
          maxSize: 50,
          ttlMs: 120000, // 2 minutes
        },
        preparedStatementCache: {
          enabled: true,
          maxSize: 25,
        },
        monitoring: {
          enabled: true,
          retentionMs: 900000, // 15 minutes
          slowQueryThresholdMs: 150,
        },
        memory: {
          maxUsageBytes: 25 * 1024 * 1024, // 25MB
          checkIntervalMs: 20000, // 20 seconds
          optimizationEnabled: true,
        },
      },
      cicd: {
        connectionPool: {
          minConnections: 1,
          maxConnections: 2,
          idleTimeoutMs: 30000, // 30 seconds - short for CI/CD
          validationIntervalMs: 10000, // 10 seconds - frequent validation
          retryAttempts: 2,
          retryBaseDelayMs: 500,
          retryMaxDelayMs: 2000,
        },
        queryCache: {
          enabled: false, // Disable caching for CI/CD predictability
          maxSize: 10,
          ttlMs: 10000, // 10 seconds
        },
        preparedStatementCache: {
          enabled: true,
          maxSize: 10,
        },
        monitoring: {
          enabled: true,
          retentionMs: 300000, // 5 minutes - short retention for CI/CD
          slowQueryThresholdMs: 1000, // Lenient for CI/CD environments
        },
        memory: {
          maxUsageBytes: 50 * 1024 * 1024, // 50MB - conservative for CI/CD
          checkIntervalMs: 15000, // 15 seconds
          optimizationEnabled: false, // Disable auto-optimization in CI/CD
        },
      },
    };

  /**
   * Get performance configuration for a specific profile
   */
  static getProfile(profileName: string): PerformanceConfig {
    // Validate profile name to prevent injection
    if (!/^[\w-]+$/.test(profileName)) {
      return this.DEFAULT_PROFILES.development!;
    }

    // Use Object.hasOwn and safe property access to prevent injection
    if (!Object.hasOwn(this.DEFAULT_PROFILES, profileName)) {
      return this.DEFAULT_PROFILES.development!;
    }

    // Use Object.entries.find to avoid dynamic property access
    const profileEntry = Object.entries(this.DEFAULT_PROFILES).find(
      ([key]) => key === profileName,
    );

    if (!profileEntry) {
      return this.DEFAULT_PROFILES.development!;
    }

    const [, profile] = profileEntry;
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Get all available profile names
   */
  static getAvailableProfiles(): string[] {
    return Object.keys(this.DEFAULT_PROFILES);
  }

  /**
   * Create a custom performance configuration
   */
  static createCustomConfig(
    baseProfile: string,
    overrides: Partial<PerformanceConfig>,
  ): PerformanceConfig {
    const base = this.getProfile(baseProfile);
    return this.mergeConfigs(base, overrides);
  }

  /**
   * Validate performance configuration
   */
  static validateConfig(config: PerformanceConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate connection pool settings
    if (config.connectionPool.minConnections < 0) {
      errors.push('minConnections cannot be negative');
    }
    if (
      config.connectionPool.maxConnections <
      config.connectionPool.minConnections
    ) {
      errors.push('maxConnections must be >= minConnections');
    }
    if (config.connectionPool.maxConnections > 100) {
      warnings.push('maxConnections > 100 may cause resource issues');
    }
    if (config.connectionPool.idleTimeoutMs < 1000) {
      warnings.push(
        'idleTimeoutMs < 1 second may cause excessive connection churn',
      );
    }

    // Validate query cache settings
    if (typeof config.queryCache === 'object') {
      if (config.queryCache.maxSize < 0) {
        errors.push('queryCache maxSize cannot be negative');
      }
      if (config.queryCache.maxSize > 50000) {
        warnings.push('queryCache maxSize > 50000 may use excessive memory');
      }
      if (config.queryCache.ttlMs < 1000) {
        warnings.push(
          'queryCache ttlMs < 1 second may reduce cache effectiveness',
        );
      }
    }

    // Validate prepared statement cache
    if (typeof config.preparedStatementCache === 'object') {
      if (config.preparedStatementCache.maxSize < 0) {
        errors.push('preparedStatementCache maxSize cannot be negative');
      }
      if (config.preparedStatementCache.maxSize > 1000) {
        warnings.push(
          'preparedStatementCache maxSize > 1000 may use excessive memory',
        );
      }
    }

    // Validate monitoring settings
    if (typeof config.monitoring === 'object') {
      if (config.monitoring.slowQueryThresholdMs < 10) {
        warnings.push('slowQueryThresholdMs < 10ms may be too strict');
      }
      if (config.monitoring.retentionMs < 60000) {
        warnings.push('retentionMs < 1 minute may not provide useful metrics');
      }
    }

    // Validate memory settings
    if (typeof config.memory === 'object') {
      if (config.memory.maxUsageBytes < 10 * 1024 * 1024) {
        warnings.push('maxUsageBytes < 10MB may be too restrictive');
      }
      if (config.memory.maxUsageBytes > 1024 * 1024 * 1024) {
        warnings.push('maxUsageBytes > 1GB may cause system instability');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Auto-tune configuration based on system resources
   */
  static autoTuneConfig(baseProfile: string): PerformanceConfig {
    const base = this.getProfile(baseProfile);
    const systemInfo = this.getSystemInfo();

    const overrides: Partial<PerformanceConfig> = {};

    // Adjust connection pool based on available memory
    const memoryMB = systemInfo.totalMemoryMB;
    if (memoryMB < 512) {
      // Low memory system
      overrides.connectionPool = {
        ...base.connectionPool,
        maxConnections: Math.min(base.connectionPool.maxConnections, 3),
      };
      overrides.memory = {
        ...base.memory,
        maxUsageBytes: Math.min(base.memory.maxUsageBytes, 25 * 1024 * 1024),
      };
    } else if (memoryMB > 8192) {
      // High memory system
      overrides.connectionPool = {
        ...base.connectionPool,
        maxConnections: Math.min(base.connectionPool.maxConnections * 2, 100),
      };
      overrides.memory = {
        ...base.memory,
        maxUsageBytes: Math.min(
          base.memory.maxUsageBytes * 2,
          1024 * 1024 * 1024,
        ),
      };
    }

    // Adjust cache sizes based on available memory
    const memoryRatio = systemInfo.availableMemoryMB / systemInfo.totalMemoryMB;
    if (memoryRatio < 0.2) {
      // Low available memory
      overrides.queryCache = {
        ...base.queryCache,
        maxSize: Math.floor(base.queryCache.maxSize * 0.5),
      };
      overrides.preparedStatementCache = {
        ...base.preparedStatementCache,
        maxSize: Math.floor(base.preparedStatementCache.maxSize * 0.5),
      };
    } else if (memoryRatio > 0.7) {
      // High available memory
      overrides.queryCache = {
        ...base.queryCache,
        maxSize: Math.floor(base.queryCache.maxSize * 1.5),
      };
      overrides.preparedStatementCache = {
        ...base.preparedStatementCache,
        maxSize: Math.floor(base.preparedStatementCache.maxSize * 1.5),
      };
    }

    // Adjust timeouts based on CPU load
    if (systemInfo.cpuLoad > 0.8) {
      // High CPU load
      overrides.connectionPool = {
        ...(overrides.connectionPool ?? base.connectionPool),
        retryBaseDelayMs: base.connectionPool.retryBaseDelayMs * 2,
        idleTimeoutMs: Math.max(base.connectionPool.idleTimeoutMs * 0.5, 30000),
      };
    }

    return this.mergeConfigs(base, overrides);
  }

  /**
   * Get recommended profile based on repository size
   */
  static getRecommendedProfile(fileCount: number): string {
    if (fileCount < 1000) {
      return 'development';
    } else if (fileCount < 10000) {
      return 'production';
    } else if (fileCount < 100000) {
      return 'large-repository';
    }
    return 'large-repository';
  }

  /**
   * Merge performance configurations
   */
  private static mergeConfigs(
    base: PerformanceConfig,
    overrides: Partial<PerformanceConfig> | null | undefined,
  ): PerformanceConfig {
    if (!overrides) {
      return JSON.parse(JSON.stringify(base));
    }

    return {
      connectionPool: {
        ...base.connectionPool,
        ...(overrides.connectionPool ?? {}),
      },
      queryCache: { ...base.queryCache, ...(overrides.queryCache ?? {}) },
      preparedStatementCache: {
        ...base.preparedStatementCache,
        ...(overrides.preparedStatementCache ?? {}),
      },
      monitoring: { ...base.monitoring, ...(overrides.monitoring ?? {}) },
      memory: { ...base.memory, ...(overrides.memory ?? {}) },
    };
  }

  /**
   * Get system information for auto-tuning
   */
  private static getSystemInfo(): {
    totalMemoryMB: number;
    availableMemoryMB: number;
    cpuLoad: number;
  } {
    // Default values - in a real implementation, you'd use system APIs
    const defaultInfo = {
      totalMemoryMB: 4096, // 4GB
      availableMemoryMB: 2048, // 2GB
      cpuLoad: 0.5, // 50%
    };

    if (
      typeof process !== 'undefined' &&
      typeof process.memoryUsage === 'function'
    ) {
      const memUsage = process.memoryUsage();
      // Use heapTotal as approximation for total memory
      defaultInfo.totalMemoryMB = Math.floor(memUsage.heapTotal / 1024 / 1024);
      defaultInfo.availableMemoryMB = Math.floor(
        (memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024,
      );
    }

    return defaultInfo;
  }
}

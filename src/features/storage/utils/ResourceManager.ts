import type {
  ResourceStats,
  ResourceInfo,
  ResourceLeak,
  ResourceType,
} from '@/features/storage/types/StorageTypes';
import { PERFORMANCE_THRESHOLDS } from '@/features/storage/config/PerformanceConstants';
import { memoryUtils } from '@/features/storage/utils/MemoryUtils';

/**
 * Resource management and leak detection for database operations
 */
export class ResourceManager {
  private resources: Map<string, ResourceInfo> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private resourceStats: ResourceStats = {
    activeConnections: 0,
    memoryUsage: 0,
    openFileDescriptors: 0,
    resourceLeaks: 0,
    cleanupOperations: 0,
    lastCleanup: Date.now(),
  };

  constructor() {
    this.startResourceMonitoring();
  }

  /**
   * Register a resource for tracking
   */
  registerResource(id: string, type: ResourceType, resource: unknown): void {
    const resourceInfo: ResourceInfo = {
      id,
      type,
      resource,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      size: this.estimateResourceSize(resource),
    };

    this.resources.set(id, resourceInfo);
    this.updateStats();
  }

  /**
   * Unregister a resource
   */
  unregisterResource(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      this.cleanupResource(resource);
      this.resources.delete(id);
      this.updateStats();
    }
  }

  /**
   * Access a resource (updates tracking info)
   */
  accessResource(id: string): unknown | null {
    const resource = this.resources.get(id);
    if (resource) {
      resource.lastAccessed = Date.now();
      resource.accessCount++;
      return resource.resource;
    }
    return null;
  }

  /**
   * Get resource statistics
   */
  getResourceStats(): ResourceStats {
    this.updateStats();
    return { ...this.resourceStats };
  }

  /**
   * Detect potential resource leaks
   */
  detectResourceLeaks(): ResourceLeak[] {
    const leaks: ResourceLeak[] = [];
    const now = Date.now();
    const leakThreshold = PERFORMANCE_THRESHOLDS.RESOURCE_LEAK_THRESHOLD_MS;

    for (const [id, resource] of this.resources.entries()) {
      const age = now - resource.createdAt;
      const idleTime = now - resource.lastAccessed;

      // Check for old, idle resources
      if (age > leakThreshold && idleTime > leakThreshold) {
        leaks.push({
          id,
          type: resource.type,
          age,
          idleTime,
          accessCount: resource.accessCount,
          size: resource.size,
          severity: this.calculateLeakSeverity(age, idleTime, resource.size),
        });
      }
    }

    return leaks.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Clean up leaked resources
   */
  cleanupLeakedResources(): number {
    const leaks = this.detectResourceLeaks();
    let cleanedCount = 0;

    for (const leak of leaks) {
      if (leak.severity > 0.7) {
        // Only clean high severity leaks
        this.unregisterResource(leak.id);
        cleanedCount++;
      }
    }

    this.resourceStats.cleanupOperations++;
    this.resourceStats.lastCleanup = Date.now();

    return cleanedCount;
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): {
    current: number;
    peak: number;
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    const stats = memoryUtils.getMemoryStats();
    return {
      current: stats.current,
      peak: stats.peak,
      average: stats.average,
      trend: stats.trend,
    };
  }

  /**
   * Optimize memory usage
   */
  optimizeMemoryUsage(): {
    freedMemory: number;
    optimizations: string[];
  } {
    const memoryOptimization = memoryUtils.optimizeMemory();

    // Clean up old resources
    const cleanedResources = this.cleanupLeakedResources();
    if (cleanedResources > 0) {
      memoryOptimization.optimizations.push(
        `Cleaned up ${cleanedResources} leaked resources`,
      );
    }

    return {
      freedMemory: memoryOptimization.freedMemory,
      optimizations: memoryOptimization.optimizations,
    };
  }

  /**
   * Check if memory usage is within limits
   */
  checkMemoryLimits(maxMemoryBytes: number): {
    withinLimit: boolean;
    usage: number;
    percentage: number;
    recommendation: string;
  } {
    const current = this.getCurrentMemoryUsage();
    const percentage = (current / maxMemoryBytes) * 100;
    let recommendation = '';

    if (percentage > 90) {
      recommendation =
        'Critical: Memory usage is extremely high. Immediate cleanup required.';
    } else if (percentage > 75) {
      recommendation = 'Warning: Memory usage is high. Consider cleanup.';
    } else if (percentage > 50) {
      recommendation = 'Info: Memory usage is moderate. Monitor closely.';
    } else {
      recommendation = 'Good: Memory usage is within acceptable limits.';
    }

    return {
      withinLimit: percentage < 90,
      usage: current,
      percentage,
      recommendation,
    };
  }

  /**
   * Close resource manager and cleanup all resources
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clean up all resources
    for (const resource of this.resources.values()) {
      this.cleanupResource(resource);
    }
    this.resources.clear();
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupLeakedResources();
    }, 60000); // Check every minute
  }

  /**
   * Update resource statistics
   */
  private updateStats(): void {
    this.resourceStats.activeConnections = this.resources.size;
    this.resourceStats.memoryUsage = this.getCurrentMemoryUsage();
    this.resourceStats.openFileDescriptors = this.countFileDescriptors();
    this.resourceStats.resourceLeaks = this.detectResourceLeaks().length;
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    return memoryUtils.getCurrentMemoryUsage();
  }

  /**
   * Count open file descriptors (simplified)
   */
  private countFileDescriptors(): number {
    // This is a simplified implementation
    // In a real implementation, you'd use system-specific APIs
    return this.resources.size;
  }

  /**
   * Estimate resource size
   */
  private estimateResourceSize(resource: unknown): number {
    // Simplified size estimation
    if (resource === null || resource === undefined) {
      return 0;
    }

    if (typeof resource === 'string') {
      return resource.length * 2; // UTF-16
    }

    if (typeof resource === 'object') {
      return JSON.stringify(resource).length * 2;
    }

    return 8; // Basic types
  }

  /**
   * Calculate leak severity
   */
  private calculateLeakSeverity(
    age: number,
    idleTime: number,
    size: number,
  ): number {
    let severity = 0;

    // Age factor (older is worse)
    if (age > 3600000) {
      severity += 0.4;
    } else if (age > 1800000) {
      severity += 0.3;
    } else if (age > 300000) {
      severity += 0.2;
    }

    // Idle time factor (longer idle is worse)
    if (idleTime > 1800000) {
      severity += 0.4;
    } else if (idleTime > 600000) {
      severity += 0.3;
    } else if (idleTime > 300000) {
      severity += 0.2;
    }

    // Size factor (larger is worse)
    if (size > 1024 * 1024) {
      severity += 0.2;
    } else if (size > 100 * 1024) {
      severity += 0.1;
    }

    return Math.min(severity, 1.0);
  }

  /**
   * Clean up a specific resource
   */
  private cleanupResource(resource: ResourceInfo): void {
    try {
      if (resource.resource && typeof resource.resource === 'object') {
        // Check if resource has a close method
        const closeable = resource.resource as { close?: () => void };
        if (closeable.close) {
          closeable.close();
        }
      }
    } catch {
      // Remove console statement - use proper logging
    }
  }
}

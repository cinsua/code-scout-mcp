import { PERFORMANCE_THRESHOLDS } from '../config/PerformanceConstants';

/**
 * Centralized memory management utilities
 * Provides consistent memory measurement and optimization across all components
 */

export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: number;
}

export interface MemoryStats {
  current: number;
  peak: number;
  average: number;
  growth: number;
  snapshots: MemorySnapshot[];
  trend: 'increasing' | 'decreasing' | 'stable';
  pressure: 'low' | 'medium' | 'high' | 'critical';
}

export interface MemoryOptimizationResult {
  freedMemory: number;
  optimizations: string[];
  success: boolean;
}

export interface MemoryMonitoringInterface {
  getCurrentMemoryUsage(): number;
  getMemoryStats(): MemoryStats;
  isMemoryUsageHigh(thresholdBytes: number): boolean;
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable';
  getMemoryPressure(): 'low' | 'medium' | 'high' | 'critical';
  optimizeMemory(): MemoryOptimizationResult;
  takeSnapshot(): MemorySnapshot;
  clearSnapshots(): void;
}

/**
 * Centralized memory utilities for consistent memory management
 */
export class MemoryUtils implements MemoryMonitoringInterface {
  private static instance: MemoryUtils;
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots: number =
    PERFORMANCE_THRESHOLDS.MEMORY_SNAPSHOT_MAX_COUNT;
  private peakMemoryUsage = 0;

  // eslint-disable-next-line no-empty-function
  private constructor() {}

  static getInstance(): MemoryUtils {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!MemoryUtils.instance) {
      MemoryUtils.instance = new MemoryUtils();
    }
    return MemoryUtils.instance;
  }

  /**
   * Get current memory usage snapshot
   */
  getCurrentMemoryUsage(): number {
    if (
      typeof process !== 'undefined' &&
      typeof process.memoryUsage === 'function'
    ) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Get detailed memory snapshot
   */
  getMemorySnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      timestamp: Date.now(),
    };
  }

  /**
   * Take memory snapshot and store it
   */
  takeSnapshot(): MemorySnapshot {
    const snapshot = this.getMemorySnapshot();
    this.snapshots.push(snapshot);

    // Update peak memory usage
    if (snapshot.heapUsed > this.peakMemoryUsage) {
      this.peakMemoryUsage = snapshot.heapUsed;
    }

    // Maintain snapshot limit
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Get comprehensive memory statistics
   */
  getMemoryStats(): MemoryStats {
    const current = this.getCurrentMemoryUsage();
    const snapshots = [...this.snapshots];

    if (snapshots.length === 0) {
      return {
        current,
        peak: current,
        average: current,
        growth: 0,
        snapshots: [],
        trend: 'stable',
        pressure: this.getMemoryPressure(),
      };
    }

    const heapUsages = snapshots.map(s => s.heapUsed);
    const peak = Math.max(...heapUsages, this.peakMemoryUsage);
    const average =
      heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length;
    const growth =
      snapshots.length > 1
        ? (snapshots[snapshots.length - 1]?.heapUsed ?? 0) -
          (snapshots[0]?.heapUsed ?? 0)
        : 0;

    return {
      current,
      peak,
      average,
      growth,
      snapshots,
      trend: this.getMemoryTrend(),
      pressure: this.getMemoryPressure(),
    };
  }

  /**
   * Calculate average memory usage over recent snapshots
   */
  getAverageMemoryUsage(count?: number): number {
    const recentSnapshots = count
      ? this.snapshots.slice(-count)
      : this.snapshots.slice(
          -PERFORMANCE_THRESHOLDS.MEMORY_SNAPSHOT_RECENT_COUNT,
        );

    if (recentSnapshots.length === 0) {
      return this.getCurrentMemoryUsage();
    }

    const total = recentSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.heapUsed,
      0,
    );
    return total / recentSnapshots.length;
  }

  /**
   * Check if memory usage exceeds threshold
   */
  isMemoryUsageHigh(thresholdBytes: number): boolean {
    return this.getCurrentMemoryUsage() > thresholdBytes;
  }

  /**
   * Calculate memory growth rate
   */
  getMemoryGrowthRate(): number {
    if (this.snapshots.length < 2) {
      return 0;
    }

    const recent = this.snapshots.slice(
      -PERFORMANCE_THRESHOLDS.MEMORY_SNAPSHOT_RECENT_COUNT,
    );
    if (recent.length < 2) {
      return 0;
    }

    const firstSnapshot = recent[0];
    const lastSnapshot = recent[recent.length - 1];
    if (!firstSnapshot || !lastSnapshot) {
      return 0;
    }

    const first = firstSnapshot.heapUsed;
    const last = lastSnapshot.heapUsed;
    const timeDiff = lastSnapshot.timestamp - firstSnapshot.timestamp;

    if (timeDiff === 0) {
      return 0;
    }

    return (last - first) / timeDiff; // Bytes per millisecond
  }

  /**
   * Attempt memory optimization (force garbage collection if available)
   */
  optimizeMemory(): MemoryOptimizationResult {
    const optimizations: string[] = [];
    let freedMemory = 0;

    try {
      const before = this.getCurrentMemoryUsage();

      // Force garbage collection if available (only in development/testing)
      if (typeof global !== 'undefined' && (global as any).gc) {
        (global as any).gc();
        optimizations.push('Forced garbage collection');
      }

      // Clear old snapshots if too many
      if (
        this.snapshots.length >
        this.maxSnapshots *
          PERFORMANCE_THRESHOLDS.MEMORY_OPTIMIZATION_SNAPSHOT_RATIO
      ) {
        const targetCount = Math.floor(
          this.maxSnapshots *
            PERFORMANCE_THRESHOLDS.MEMORY_OPTIMIZATION_SNAPSHOT_RATIO,
        );
        const removedCount = this.snapshots.length - targetCount;
        this.snapshots = this.snapshots.slice(-targetCount);
        optimizations.push(`Cleared ${removedCount} old memory snapshots`);
      }

      const after = this.getCurrentMemoryUsage();
      freedMemory = Math.max(0, before - after);

      if (freedMemory > 0) {
        optimizations.push(`Freed ${this.formatBytes(freedMemory)} of memory`);
      }

      return {
        freedMemory,
        optimizations,
        success: true,
      };
    } catch (error) {
      return {
        freedMemory: 0,
        optimizations: [
          `Memory optimization failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        success: false,
      };
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // eslint-disable-next-line security/detect-object-injection
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Clear all memory snapshots and reset tracking
   */
  clearSnapshots(): void {
    this.snapshots = [];
    this.peakMemoryUsage = 0;
  }

  /**
   * Set maximum number of snapshots to keep
   */
  setMaxSnapshots(max: number): void {
    this.maxSnapshots = Math.max(
      PERFORMANCE_THRESHOLDS.PERFORMANCE_MIN_CACHE_SIZE,
      max,
    );
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }
  }

  /**
   * Check if automatic memory cleanup should be triggered
   */
  shouldTriggerCleanup(): boolean {
    const pressure = this.getMemoryPressure();
    const trend = this.getMemoryTrend();

    // Trigger cleanup if memory pressure is high or critical
    if (pressure === 'critical') {
      return true;
    }

    // Trigger cleanup if memory is high and trending upward
    if (pressure === 'high' && trend === 'increasing') {
      return true;
    }

    // Trigger cleanup if memory usage exceeds threshold
    return this.isMemoryUsageHigh(
      PERFORMANCE_THRESHOLDS.MEMORY_USAGE_THRESHOLD_BYTES,
    );
  }

  /**
   * Perform automatic memory cleanup if needed
   */
  performAutomaticCleanup(): MemoryOptimizationResult | null {
    if (!this.shouldTriggerCleanup()) {
      return null;
    }

    return this.optimizeMemory();
  }

  /**
   * Get memory pressure configuration for custom thresholds
   */
  /**
   * Get memory usage trend (increasing, decreasing, stable)
   */
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    const recent = this.snapshots.slice(
      -PERFORMANCE_THRESHOLDS.MEMORY_SNAPSHOT_TREND_COUNT,
    );
    if (recent.length < 3) {
      return 'stable';
    }

    const values = recent.map(s => s.heapUsed);
    const first = values[0];
    const last = values[values.length - 1];
    if (first === undefined || last === undefined) {
      return 'stable';
    }
    const diff = last - first;

    if (diff > PERFORMANCE_THRESHOLDS.MEMORY_TREND_THRESHOLD_BYTES) {
      return 'increasing';
    } else if (diff < -PERFORMANCE_THRESHOLDS.MEMORY_TREND_THRESHOLD_BYTES) {
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Get current memory pressure level
   */
  getMemoryPressure(): 'low' | 'medium' | 'high' | 'critical' {
    const currentUsage = this.getCurrentMemoryUsage();
    const maxUsage = PERFORMANCE_THRESHOLDS.MEMORY_MAX_USAGE_BYTES;

    const usageRatio = currentUsage / maxUsage;

    if (usageRatio >= 0.9) {
      return 'critical';
    } else if (usageRatio >= 0.75) {
      return 'high';
    } else if (usageRatio >= 0.6) {
      return 'medium';
    }
    return 'low';
  }
}

/**
 * Singleton instance for global memory management
 */
export const memoryUtils = MemoryUtils.getInstance();

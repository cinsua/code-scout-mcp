/**
 * Performance profiling tools for monitoring and analysis
 */

import { PERFORMANCE_THRESHOLDS } from '@/shared/utils/LoggingConstants';
import { LogManager } from '@/shared/utils/LogManager';
import { ErrorFactory } from '@/shared/errors/ErrorFactory';
import { ErrorMigration } from '@/shared/errors/ErrorMigration';

export class PerformanceProfiler {
  private profiles: Map<string, ProfileSession> = new Map();
  private activeProfile?: ProfileSession;
  private metrics: ProfileMetrics;
  private logger: ReturnType<typeof LogManager.getLogger>;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.logger = LogManager.getLogger().child({
      service: 'PerformanceProfiler',
      component: 'storage',
    });
  }

  /**
   * Start profiling a specific operation
   */
  startProfile(name: string, metadata?: Record<string, unknown>): string {
    const profileId = this.generateProfileId();
    const session: ProfileSession = {
      id: profileId,
      name,
      startTime: Date.now(),
      metadata: metadata ?? {},
      queries: [],
      memorySnapshots: [],
      completed: false,
    };

    this.profiles.set(profileId, session);
    this.activeProfile = session;

    // Take initial memory snapshot
    this.takeMemorySnapshot(session);

    this.logger.info(`Started performance profiling session`, {
      operation: 'startProfile',
      profileId,
      profileName: name,
      performance: {
        duration: 0,
        memoryUsage: 0, // Will be updated after memory snapshot
        queryCount: 0,
      },
      metadata,
    });

    return profileId;
  }

  /**
   * End profiling session
   */
  endProfile(profileId: string): ProfileResult {
    const session = this.profiles.get(profileId);
    if (!session) {
      throw ErrorFactory.resource(
        'profile_session',
        `Profile session not found: ${profileId}`,
        undefined,
        undefined,
      );
    }

    session.endTime = Date.now();
    session.completed = true;
    session.duration = session.endTime - session.startTime;

    // Take final memory snapshot
    this.takeMemorySnapshot(session);

    // Calculate metrics
    const result = this.calculateProfileResult(session);

    // Update global metrics
    this.updateGlobalMetrics(result);

    this.logger.info(`Ended performance profiling session`, {
      operation: 'endProfile',
      profileId,
      profileName: session.name,
      performance: {
        duration: result.duration,
        memoryUsage: result.memory.finalHeap,
        queryCount: result.queries.total,
      },
      queries: result.queries.total,
      memoryGrowth: result.memory.heapGrowth,
    });

    this.activeProfile = undefined;
    return result;
  }

  /**
   * Record a query within the current profile session
   */
  recordQuery(
    query: string,
    duration: number,
    success: boolean,
    rowCount?: number,
  ): void {
    if (!this.activeProfile) {
      return;
    }

    const queryRecord: QueryRecord = {
      query,
      duration,
      success,
      rowCount: rowCount ?? 0,
      timestamp: Date.now(),
    };

    this.activeProfile.queries.push(queryRecord);

    // Log slow or failed queries
    if (!success) {
      this.logger.warn(`Query failed in profiling session`, {
        operation: 'recordQuery',
        profileId: this.activeProfile.id,
        query: query.substring(0, 100), // Truncate for logging
        duration,
        rowCount,
      });
    } else if (
      duration > PERFORMANCE_THRESHOLDS.ANALYSIS_SLOW_QUERY_THRESHOLD_MS
    ) {
      this.logger.info(`Slow query recorded in profiling session`, {
        operation: 'recordQuery',
        profileId: this.activeProfile.id,
        query: query.substring(0, 100), // Truncate for logging
        duration,
        rowCount,
      });
    }
  }

  /**
   * Take a memory snapshot
   */
  private takeMemorySnapshot(session: ProfileSession): void {
    try {
      const memoryUsage = process.memoryUsage();
      const snapshot: MemorySnapshot = {
        timestamp: Date.now(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      };

      session.memorySnapshots.push(snapshot);
    } catch (error) {
      // Migrate legacy errors and log them appropriately
      const migratedError = ErrorMigration.migrateError(
        error as Error,
        'takeMemorySnapshot',
      );

      this.logger.warn('Failed to take memory snapshot', {
        operation: 'takeMemorySnapshot',
        profileId: session.id,
        error: migratedError.migrated.message,
        wasLegacy: migratedError.wasLegacy,
        originalType: migratedError.originalType,
      });
    }
  }

  /**
   * Calculate profile result
   */
  private calculateProfileResult(session: ProfileSession): ProfileResult {
    const totalQueries = session.queries.length;
    const successfulQueries = session.queries.filter(q => q.success).length;
    const failedQueries = totalQueries - successfulQueries;
    const totalDuration = session.queries.reduce(
      (sum, q) => sum + q.duration,
      0,
    );
    const avgQueryTime = totalQueries > 0 ? totalDuration / totalQueries : 0;
    const slowQueries = session.queries.filter(
      q => q.duration > PERFORMANCE_THRESHOLDS.ANALYSIS_SLOW_QUERY_THRESHOLD_MS,
    );

    // Memory analysis
    const memoryAnalysis = this.analyzeMemoryUsage(session.memorySnapshots);

    return {
      profileId: session.id,
      name: session.name,
      duration: session.duration ?? 0,
      queries: {
        total: totalQueries,
        successful: successfulQueries,
        failed: failedQueries,
        averageTime: avgQueryTime,
        slowQueries: slowQueries.length,
        slowQueryDetails: slowQueries.map(q => ({
          query: q.query,
          duration: q.duration,
          timestamp: q.timestamp,
        })),
      },
      memory: memoryAnalysis,
      metadata: session.metadata,
      completed: session.completed,
    };
  }

  /**
   * Analyze memory usage patterns
   */
  private analyzeMemoryUsage(snapshots: MemorySnapshot[]): MemoryAnalysis {
    if (snapshots.length === 0) {
      return {
        initialHeap: 0,
        peakHeap: 0,
        finalHeap: 0,
        heapGrowth: 0,
        averageHeap: 0,
        snapshots: 0,
      };
    }

    const initialHeap = snapshots[0]!.heapUsed;
    const peakHeap = Math.max(...snapshots.map(s => s.heapUsed));
    const finalHeap = snapshots[snapshots.length - 1]!.heapUsed;
    const heapGrowth = finalHeap - initialHeap;
    const averageHeap =
      snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length;

    return {
      initialHeap,
      peakHeap,
      finalHeap,
      heapGrowth,
      averageHeap,
      snapshots: snapshots.length,
    };
  }

  /**
   * Update global metrics
   */
  private updateGlobalMetrics(result: ProfileResult): void {
    this.metrics.totalProfiles++;
    this.metrics.totalDuration += result.duration;

    if (result.duration > this.metrics.longestProfile) {
      this.metrics.longestProfile = result.duration;
    }

    if (result.memory.heapGrowth > this.metrics.maxMemoryGrowth) {
      this.metrics.maxMemoryGrowth = result.memory.heapGrowth;
    }
  }

  /**
   * Get profiling summary
   */
  getProfilingSummary(): ProfilingSummary {
    return {
      globalMetrics: this.metrics,
      activeProfile: this.activeProfile
        ? {
            id: this.activeProfile.id,
            name: this.activeProfile.name,
            duration: Date.now() - this.activeProfile.startTime,
            queryCount: this.activeProfile.queries.length,
          }
        : null,
      recentProfiles: this.getRecentProfiles(5),
    };
  }

  /**
   * Get recent profiles
   */
  private getRecentProfiles(limit: number): ProfileResult[] {
    const completedProfiles = Array.from(this.profiles.values())
      .filter(p => p.completed)
      .map(p => this.calculateProfileResult(p));

    return completedProfiles
      .sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0))
      .slice(0, limit);
  }

  /**
   * Generate profile report
   */
  generateProfileReport(profileId: string): ProfileReport {
    const session = this.profiles.get(profileId);
    if (!session) {
      throw ErrorFactory.resource(
        'profile_session',
        `Profile session not found: ${profileId}`,
        undefined,
        undefined,
      );
    }

    const result = this.calculateProfileResult(session);

    return {
      profile: result,
      recommendations: this.generateRecommendations(result),
      comparison: this.compareWithBaseline(result),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(result: ProfileResult): string[] {
    const recommendations: string[] = [];

    // Query performance recommendations
    if (result.queries.averageTime > 200) {
      recommendations.push(
        'Consider optimizing slow queries - average time exceeds 200ms',
      );
    }

    if (result.queries.slowQueries > result.queries.total * 0.1) {
      recommendations.push(
        'High slow query rate detected - consider query optimization',
      );
    }

    // Memory recommendations
    if (result.memory.heapGrowth > 50 * 1024 * 1024) {
      // 50MB
      recommendations.push(
        'Significant memory growth detected - check for memory leaks',
      );
    }

    if (result.memory.peakHeap > result.memory.initialHeap * 2) {
      recommendations.push(
        'Memory usage peaked at 2x initial - consider memory optimization',
      );
    }

    return recommendations;
  }

  /**
   * Compare with baseline performance
   */
  private compareWithBaseline(result: ProfileResult): PerformanceComparison {
    // Simple baseline comparison (in real implementation, this would use historical data)
    const baselineAvgTime =
      PERFORMANCE_THRESHOLDS.ANALYSIS_SLOW_QUERY_THRESHOLD_MS;
    const baselineMemoryGrowth = 10 * 1024 * 1024; // 10MB baseline

    return {
      queryPerformance:
        result.queries.averageTime > baselineAvgTime ? 'degraded' : 'improved',
      memoryEfficiency:
        result.memory.heapGrowth > baselineMemoryGrowth
          ? 'degraded'
          : 'improved',
      overallScore: this.calculateOverallScore(
        result,
        baselineAvgTime,
        baselineMemoryGrowth,
      ),
    };
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(
    result: ProfileResult,
    baselineQueryTime: number,
    baselineMemoryGrowth: number,
  ): number {
    const queryScore = Math.max(
      0,
      100 - (result.queries.averageTime / baselineQueryTime) * 50,
    );
    const memoryScore = Math.max(
      0,
      100 - (result.memory.heapGrowth / baselineMemoryGrowth) * 50,
    );

    return Math.round((queryScore + memoryScore) / 2);
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): ProfileMetrics {
    return {
      totalProfiles: 0,
      totalDuration: 0,
      longestProfile: 0,
      maxMemoryGrowth: 0,
    };
  }

  /**
   * Generate profile ID
   */
  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all profiles
   */
  clearProfiles(): void {
    const profileCount = this.profiles.size;
    this.profiles.clear();
    this.activeProfile = undefined;
    this.metrics = this.initializeMetrics();

    this.logger.info(`Cleared all performance profiling data`, {
      operation: 'clearProfiles',
      profilesCleared: profileCount,
    });
  }

  /**
   * Export profile data
   */
  exportProfiles(): ExportedProfileData {
    return {
      profiles: Array.from(this.profiles.values()).map(session =>
        this.calculateProfileResult(session),
      ),
      metrics: this.metrics,
      exportTime: new Date().toISOString(),
    };
  }
}

// Supporting interfaces
interface ProfileSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata: Record<string, unknown>;
  queries: QueryRecord[];
  memorySnapshots: MemorySnapshot[];
  completed: boolean;
}

interface QueryRecord {
  query: string;
  duration: number;
  success: boolean;
  rowCount: number;
  timestamp: number;
}

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface ProfileMetrics {
  totalProfiles: number;
  totalDuration: number;
  longestProfile: number;
  maxMemoryGrowth: number;
}

interface MemoryAnalysis {
  initialHeap: number;
  peakHeap: number;
  finalHeap: number;
  heapGrowth: number;
  averageHeap: number;
  snapshots: number;
}

interface ProfileResult {
  profileId: string;
  name: string;
  duration: number;
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageTime: number;
    slowQueries: number;
    slowQueryDetails: Array<{
      query: string;
      duration: number;
      timestamp: number;
    }>;
  };
  memory: MemoryAnalysis;
  metadata: Record<string, unknown>;
  completed: boolean;
  endTime?: number;
}

interface ProfilingSummary {
  globalMetrics: ProfileMetrics;
  activeProfile: {
    id: string;
    name: string;
    duration: number;
    queryCount: number;
  } | null;
  recentProfiles: ProfileResult[];
}

interface ProfileReport {
  profile: ProfileResult;
  recommendations: string[];
  comparison: PerformanceComparison;
}

interface PerformanceComparison {
  queryPerformance: 'improved' | 'degraded' | 'stable';
  memoryEfficiency: 'improved' | 'degraded' | 'stable';
  overallScore: number;
}

interface ExportedProfileData {
  profiles: ProfileResult[];
  metrics: ProfileMetrics;
  exportTime: string;
}

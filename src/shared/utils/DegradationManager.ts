// import { ServiceError } from '../errors/ServiceError';
// import { ErrorType } from '../errors/ErrorTypes';

export enum DegradationLevel {
  FULL = 'full',
  LIMITED = 'limited',
  BASIC = 'basic',
  EMERGENCY = 'emergency',
}

export interface DegradationStrategy {
  name: string;
  level: DegradationLevel;
  description: string;
  capabilities: string[];
  limitations: string[];
  triggers: string[];
  priority: number;
}

export interface DegradationTrigger {
  type: 'resource_usage' | 'error_rate' | 'response_time' | 'manual';
  threshold: number;
  window?: number;
  metric?: string;
  enabled: boolean;
}

export interface DegradationMetrics {
  currentLevel: DegradationLevel;
  activeStrategies: string[];
  triggerHistory: Array<{
    trigger: string;
    level: DegradationLevel;
    timestamp: number;
    reason: string;
  }>;
  resourceUsage: Record<string, number>;
  errorRate: number;
  averageResponseTime: number;
  lastEvaluation: number;
}

/**
 * Degradation manager for graceful service degradation.
 * Manages service capabilities under stress conditions to maintain availability.
 */
export class DegradationManager {
  private currentLevel: DegradationLevel = DegradationLevel.FULL;
  private activeStrategies: Map<string, DegradationStrategy> = new Map();
  private availableStrategies: Map<string, DegradationStrategy> = new Map();
  private triggers: Map<string, DegradationTrigger> = new Map();
  private metrics: DegradationMetrics;
  private evaluationInterval?: NodeJS.Timeout;
  private resourceUsageMap: Map<string, number> = new Map();

  constructor() {
    this.metrics = {
      currentLevel: this.currentLevel,
      activeStrategies: [],
      triggerHistory: [],
      resourceUsage: {},
      errorRate: 0,
      averageResponseTime: 0,
      lastEvaluation: Date.now(),
    };

    this.initializeDefaultStrategies();
    this.initializeDefaultTriggers();
  }

  /**
   * Register a new degradation strategy
   */
  registerStrategy(strategy: DegradationStrategy): void {
    this.availableStrategies.set(strategy.name, strategy);
  }

  /**
   * Register a degradation trigger
   */
  registerTrigger(name: string, trigger: DegradationTrigger): void {
    this.triggers.set(name, trigger);
  }

  /**
   * Start automatic degradation monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    this.evaluationInterval = setInterval(() => {
      this.evaluateDegradation();
    }, intervalMs);
  }

  /**
   * Stop automatic degradation monitoring
   */
  stopMonitoring(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
    }
  }

  /**
   * Manually trigger degradation to a specific level
   */
  forceDegradation(level: DegradationLevel, reason: string): void {
    this.degradeTo(level, 'manual', reason);
  }

  /**
   * Check if a capability is available at current level
   */
  isCapabilityAvailable(capability: string): boolean {
    for (const strategy of Array.from(this.activeStrategies.values())) {
      if (strategy.capabilities.includes(capability)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get available capabilities at current level
   */
  getAvailableCapabilities(): string[] {
    const capabilities: string[] = [];
    for (const strategy of Array.from(this.activeStrategies.values())) {
      capabilities.push(...strategy.capabilities);
    }
    return Array.from(new Set(capabilities)); // Remove duplicates
  }

  /**
   * Get current degradation level
   */
  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * Get degradation metrics
   */
  getMetrics(): DegradationMetrics {
    return {
      ...this.metrics,
      resourceUsage: Object.fromEntries(this.resourceUsageMap),
    };
  }

  /**
   * Update resource usage metrics
   */
  updateResourceUsage(resource: string, usage: number): void {
    // Validate resource name to prevent object injection
    if (!/^[\w-]+$/.test(resource)) {
      throw new Error(`Invalid resource name: ${resource}`);
    }

    // Validate usage is a finite number
    if (!Number.isFinite(usage)) {
      throw new Error(`Invalid usage value: ${usage}`);
    }

    this.resourceUsageMap.set(resource, usage);
  }

  /**
   * Update error rate metrics
   */
  updateErrorRate(errorRate: number): void {
    this.metrics.errorRate = errorRate;
  }

  /**
   * Update response time metrics
   */
  updateResponseTime(responseTime: number): void {
    // Simple moving average
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime + responseTime) / 2;
  }

  /**
   * Reset to full functionality
   */
  reset(): void {
    this.degradeTo(
      DegradationLevel.FULL,
      'manual',
      'Reset to full functionality',
    );
  }

  /**
   * Evaluate if degradation should occur
   */
  private evaluateDegradation(): void {
    let targetLevel = this.currentLevel;
    let triggerReason = '';

    // Check all triggers
    for (const [name, trigger] of Array.from(this.triggers.entries())) {
      if (!trigger.enabled) {
        continue;
      }

      const shouldTrigger = this.evaluateTrigger(trigger);
      if (shouldTrigger) {
        const newLevel = this.getLevelForTrigger(trigger);

        // Only degrade to lower levels (more degraded)
        if (this.compareLevels(newLevel, targetLevel) < 0) {
          targetLevel = newLevel;
          triggerReason = `${name}: ${trigger.type} threshold exceeded`;
        }
      }
    }

    // Apply degradation if needed
    if (targetLevel !== this.currentLevel) {
      this.degradeTo(targetLevel, 'automatic', triggerReason);
    }

    this.metrics.lastEvaluation = Date.now();
  }

  /**
   * Evaluate a specific trigger
   */
  private evaluateTrigger(trigger: DegradationTrigger): boolean {
    switch (trigger.type) {
      case 'resource_usage':
        if (trigger.metric && this.resourceUsageMap.has(trigger.metric)) {
          const usage = this.resourceUsageMap.get(trigger.metric)!;
          return usage > trigger.threshold;
        }
        break;

      case 'error_rate':
        return this.metrics.errorRate > trigger.threshold;

      case 'response_time':
        return this.metrics.averageResponseTime > trigger.threshold;

      case 'manual':
        return false; // Manual triggers are handled separately

      default:
        return false;
    }

    return false;
  }

  /**
   * Get degradation level for a trigger
   */
  private getLevelForTrigger(trigger: DegradationTrigger): DegradationLevel {
    // Map trigger thresholds to degradation levels
    if (trigger.threshold >= 90) {
      return DegradationLevel.EMERGENCY;
    }
    if (trigger.threshold >= 75) {
      return DegradationLevel.BASIC;
    }
    if (trigger.threshold >= 50) {
      return DegradationLevel.LIMITED;
    }
    return DegradationLevel.FULL;
  }

  /**
   * Compare degradation levels (lower number = more degraded)
   */
  private compareLevels(
    level1: DegradationLevel,
    level2: DegradationLevel,
  ): number {
    const levels = [
      DegradationLevel.FULL,
      DegradationLevel.LIMITED,
      DegradationLevel.BASIC,
      DegradationLevel.EMERGENCY,
    ];

    return levels.indexOf(level1) - levels.indexOf(level2);
  }

  /**
   * Degrade to a specific level
   */
  private degradeTo(
    level: DegradationLevel,
    trigger: string,
    reason: string,
  ): void {
    this.currentLevel = level;

    // Clear active strategies
    this.activeStrategies.clear();

    // Activate strategies for new level
    for (const strategy of Array.from(this.availableStrategies.values())) {
      if (strategy.level === level) {
        this.activeStrategies.set(strategy.name, strategy);
      }
    }

    // Update metrics
    this.metrics.currentLevel = level;
    this.metrics.activeStrategies = Array.from(this.activeStrategies.keys());
    this.metrics.triggerHistory.push({
      trigger,
      level,
      timestamp: Date.now(),
      reason,
    });

    // Keep only recent history (last 50 entries)
    if (this.metrics.triggerHistory.length > 50) {
      this.metrics.triggerHistory = this.metrics.triggerHistory.slice(-50);
    }

    // Log degradation event - replace with proper logging
    // console.log(
    //   `Degradation: ${previousLevel} -> ${level} (${trigger}: ${reason})`,
    // );
  }

  /**
   * Initialize default degradation strategies
   */
  private initializeDefaultStrategies(): void {
    // Full functionality
    this.registerStrategy({
      name: 'full',
      level: DegradationLevel.FULL,
      description: 'Full functionality with all features',
      capabilities: [
        'search',
        'indexing',
        'parsing',
        'file_operations',
        'database_operations',
        'network_operations',
        'caching',
      ],
      limitations: [],
      triggers: [],
      priority: 0,
    });

    // Limited functionality
    this.registerStrategy({
      name: 'limited',
      level: DegradationLevel.LIMITED,
      description: 'Limited functionality with reduced features',
      capabilities: ['search', 'file_operations', 'database_operations'],
      limitations: ['indexing', 'parsing', 'network_operations', 'caching'],
      triggers: ['high_resource_usage', 'moderate_error_rate'],
      priority: 1,
    });

    // Basic functionality
    this.registerStrategy({
      name: 'basic',
      level: DegradationLevel.BASIC,
      description: 'Basic functionality with essential features only',
      capabilities: ['search', 'file_operations'],
      limitations: [
        'indexing',
        'parsing',
        'network_operations',
        'caching',
        'database_operations',
      ],
      triggers: ['very_high_resource_usage', 'high_error_rate'],
      priority: 2,
    });

    // Emergency mode
    this.registerStrategy({
      name: 'emergency',
      level: DegradationLevel.EMERGENCY,
      description: 'Emergency mode with minimal functionality',
      capabilities: ['file_operations'],
      limitations: [
        'search',
        'indexing',
        'parsing',
        'network_operations',
        'caching',
        'database_operations',
      ],
      triggers: ['critical_resource_usage', 'critical_error_rate'],
      priority: 3,
    });
  }

  /**
   * Initialize default triggers
   */
  private initializeDefaultTriggers(): void {
    // Memory usage trigger
    this.registerTrigger('memory_high', {
      type: 'resource_usage',
      threshold: 80,
      metric: 'memory',
      enabled: true,
    });

    // CPU usage trigger
    this.registerTrigger('cpu_high', {
      type: 'resource_usage',
      threshold: 85,
      metric: 'cpu',
      enabled: true,
    });

    // Error rate trigger
    this.registerTrigger('error_rate_high', {
      type: 'error_rate',
      threshold: 10, // 10% error rate
      enabled: true,
    });

    // Response time trigger
    this.registerTrigger('response_time_high', {
      type: 'response_time',
      threshold: 5000, // 5 seconds
      enabled: true,
    });

    // Critical memory usage
    this.registerTrigger('memory_critical', {
      type: 'resource_usage',
      threshold: 95,
      metric: 'memory',
      enabled: true,
    });

    // Critical error rate
    this.registerTrigger('error_rate_critical', {
      type: 'error_rate',
      threshold: 25, // 25% error rate
      enabled: true,
    });
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): DegradationStrategy | undefined {
    return this.availableStrategies.get(name);
  }

  /**
   * Get all available strategies
   */
  getAllStrategies(): DegradationStrategy[] {
    return Array.from(this.availableStrategies.values());
  }

  /**
   * Get active strategies
   */
  getActiveStrategies(): DegradationStrategy[] {
    return Array.from(this.activeStrategies.values());
  }

  /**
   * Enable/disable trigger
   */
  setTriggerEnabled(name: string, enabled: boolean): void {
    const trigger = this.triggers.get(name);
    if (trigger) {
      trigger.enabled = enabled;
    }
  }

  /**
   * Get degradation summary
   */
  getSummary(): {
    level: DegradationLevel;
    capabilities: string[];
    limitations: string[];
    activeStrategies: string[];
    health: 'healthy' | 'degraded' | 'critical';
  } {
    const capabilities = this.getAvailableCapabilities();
    const allCapabilities = [
      'search',
      'indexing',
      'parsing',
      'file_operations',
      'database_operations',
      'network_operations',
      'caching',
    ];
    const limitations = allCapabilities.filter(
      cap => !capabilities.includes(cap),
    );

    let health: 'healthy' | 'degraded' | 'critical';
    if (this.currentLevel === DegradationLevel.FULL) {
      health = 'healthy';
    } else if (this.currentLevel === DegradationLevel.EMERGENCY) {
      health = 'critical';
    } else {
      health = 'degraded';
    }

    return {
      level: this.currentLevel,
      capabilities,
      limitations,
      activeStrategies: this.metrics.activeStrategies,
      health,
    };
  }
}

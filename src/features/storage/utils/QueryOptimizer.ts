import type Database from 'better-sqlite3';

import { ErrorFactory } from '../../../shared/errors/ErrorFactory';
import { DatabaseErrorType } from '../../../shared/errors/DatabaseError';
import type { QueryPlan, OptimizedQuery } from '../types/StorageTypes';
import {
  PERFORMANCE_THRESHOLDS,
  PERFORMANCE_LIMITS,
} from '../config/PerformanceConstants';

import { hashQuery } from './PerformanceUtils';

/**
 * Query optimization and execution plan analysis
 */
export class QueryOptimizer {
  private queryPlans: Map<string, QueryPlan> = new Map();
  private preparedStatements: Map<string, Database.Statement> = new Map();
  private db: Database.Database;
  private planCacheTimeout = PERFORMANCE_THRESHOLDS.QUERY_PLAN_CACHE_TIMEOUT_MS;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Optimize a query with execution plan analysis
   */
  optimizeQuery(query: string, params?: unknown[]): OptimizedQuery {
    const queryHash = hashQuery(query);

    // Check if we have a cached plan
    const cachedPlan = this.queryPlans.get(queryHash);
    if (cachedPlan && !this.isPlanStale(cachedPlan)) {
      return this.buildOptimizedQuery(query, params, cachedPlan);
    }

    // Analyze and create new execution plan
    const plan = this.analyzeQuery(query);
    this.queryPlans.set(queryHash, plan);

    return this.buildOptimizedQuery(query, params, plan);
  }

  /**
   * Get or create a prepared statement for caching
   */
  getPreparedStatement(query: string): Database.Statement {
    const cached = this.preparedStatements.get(query);
    if (cached) {
      return cached;
    }

    const statement = this.db.prepare(query);
    this.preparedStatements.set(query, statement);
    return statement;
  }

  /**
   * Analyze query execution plan
   */
  private analyzeQuery(query: string): QueryPlan {
    try {
      // Use EXPLAIN QUERY PLAN to analyze the query
      const rawResult = this.db.prepare('EXPLAIN QUERY PLAN ' + query).all();

      // Validate the result structure before casting
      if (!Array.isArray(rawResult)) {
        throw ErrorFactory.database(
          DatabaseErrorType.QUERY_FAILED,
          'EXPLAIN QUERY PLAN returned non-array result',
          {
            query: 'EXPLAIN QUERY PLAN ' + query,
            context: { rawResult },
          },
        );
      }

      const explainResult = rawResult as unknown[];

      return {
        query,
        explainResult,
        recommendedIndexes: this.analyzeMissingIndexes(explainResult),
        estimatedCost: this.calculateEstimatedCost(explainResult),
        optimizationHints: this.generateOptimizationHints(explainResult),
        createdAt: Date.now(),
        isStale: false,
      };
    } catch {
      // If EXPLAIN fails, return a basic plan with fallback
      return {
        query,
        explainResult: [],
        recommendedIndexes: [],
        estimatedCost: 0,
        optimizationHints: ['Query analysis failed - using fallback'],
        createdAt: Date.now(),
        isStale: false,
      };
    }
  }

  /**
   * Build optimized query based on execution plan
   */
  private buildOptimizedQuery(
    originalQuery: string,
    params: unknown[] | undefined,
    plan: QueryPlan,
  ): OptimizedQuery {
    let optimizedQuery = originalQuery;

    // Apply basic optimizations
    optimizedQuery = this.applyBasicOptimizations(optimizedQuery);

    // Apply index hints if available
    if (plan.recommendedIndexes.length > 0) {
      optimizedQuery = this.applyIndexHints(
        optimizedQuery,
        plan.recommendedIndexes,
      );
    }

    return {
      originalQuery,
      optimizedQuery,
      params: params ?? [],
      plan,
      estimatedImprovement: this.estimateImprovement(plan),
    };
  }

  /**
   * Apply basic query optimizations
   */
  private applyBasicOptimizations(query: string): string {
    let optimized = query;

    // Remove unnecessary whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Ensure consistent use of single quotes for string literals
    optimized = optimized.replace(/"/g, "'");

    // Add LIMIT only for potentially unbounded queries (safety measure)
    // Only add LIMIT for SELECT queries that don't already have one
    // and appear to be search/listing queries (contain WHERE or don't have specific ID constraints)
    if (
      optimized.toUpperCase().startsWith('SELECT') &&
      !optimized.toUpperCase().includes('LIMIT') &&
      !this.isBoundedQuery(optimized)
    ) {
      optimized += ` LIMIT ${PERFORMANCE_LIMITS.MAX_CACHE_SIZE}`;
    }

    return optimized;
  }

  /**
   * Check if a query appears to be bounded (limited by specific constraints)
   * Returns true if the query likely returns a small, bounded result set
   */
  private isBoundedQuery(query: string): boolean {
    const upperQuery = query.toUpperCase();

    // Check for primary key or unique constraints that suggest bounded results
    if (
      upperQuery.includes('WHERE ID =') ||
      upperQuery.includes('WHERE ID=') ||
      upperQuery.includes('BY PRIMARY KEY') ||
      upperQuery.includes('LIMIT 1')
    ) {
      return true;
    }

    // Check for queries with specific equality constraints on indexed columns
    const whereMatch = upperQuery.match(/WHERE\s+(\w+)\s*=\s*[^=]/);
    if (whereMatch?.[1]) {
      const column = whereMatch[1];
      // Common indexed columns that suggest bounded results
      if (['ID', 'UUID', 'PRIMARY_KEY'].includes(column.toUpperCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Apply index hints to query
   */
  private applyIndexHints(query: string, indexes: string[]): string {
    // This is a simplified implementation
    // In practice, you'd need more sophisticated SQL parsing
    if (indexes.length === 0) {
      return query;
    }

    // For SQLite, INDEXED BY hints can be used
    const indexHint = ` INDEXED BY ${indexes[0]}`;

    // Simple insertion after table name (basic implementation)
    return query.replace(/from\s+(\w+)/i, `FROM $1${indexHint}`);
  }

  /**
   * Analyze missing indexes from execution plan
   */
  private analyzeMissingIndexes(explainResult: unknown[]): string[] {
    const indexes: string[] = [];

    for (const row of explainResult as Array<{ detail?: string }>) {
      const detail = row.detail;
      if (detail && typeof detail === 'string') {
        // Look for full table scans which might benefit from indexes
        if (detail.includes('SCAN TABLE')) {
          const match = detail.match(/SCAN TABLE (\w+)/);
          if (match) {
            indexes.push(`idx_${match[1]}_optimized`);
          }
        }

        // Look for USING INDEX recommendations
        if (detail.includes('USING INDEX')) {
          const match = detail.match(/USING INDEX (\w+)/);
          if (match?.[1]) {
            indexes.push(match[1]);
          }
        }
      }
    }

    return indexes;
  }

  /**
   * Calculate estimated cost from execution plan
   */
  private calculateEstimatedCost(explainResult: unknown[]): number {
    let totalCost = 0;

    for (const row of explainResult as Array<{ detail?: string }>) {
      const detail = row.detail;
      if (detail && typeof detail === 'string') {
        // Extract cost information if available
        const costIndex = detail.indexOf('cost=');
        if (costIndex !== -1) {
          const costString = detail.substring(costIndex + 5);
          // Extract numeric part manually using safer approach
          let numericPart = '';
          for (let i = 0; i < costString.length; i++) {
            const char = costString.charAt(i);
            if (char && ((char >= '0' && char <= '9') || char === '.')) {
              numericPart += char;
            } else {
              break;
            }
          }
          if (numericPart.length > 0) {
            totalCost += parseFloat(numericPart);
          } else {
            totalCost += 1;
          }
        } else {
          // Default cost for operations without explicit cost
          totalCost += 1;
        }
      }
    }

    return totalCost;
  }

  /**
   * Generate optimization hints based on execution plan
   */
  private generateOptimizationHints(explainResult: unknown[]): string[] {
    const hints: string[] = [];

    for (const row of explainResult as Array<{ detail?: string }>) {
      const detail = row.detail;
      if (detail && typeof detail === 'string') {
        // Full table scan hint
        if (detail.includes('SCAN TABLE')) {
          hints.push('Consider adding indexes to avoid full table scans');
        }

        // Temporary B-tree usage
        if (detail.includes('TEMP B-TREE')) {
          hints.push(
            'Query uses temporary B-tree - consider optimizing JOIN order or adding indexes',
          );
        }

        // Subquery optimization
        if (detail.includes('SUBQUERY')) {
          hints.push(
            'Consider rewriting subqueries as JOINs for better performance',
          );
        }

        // Covering index hint
        if (detail.includes('COVERING INDEX')) {
          hints.push('Good: Query is using a covering index');
        }
      }
    }

    return hints;
  }

  /**
   * Estimate performance improvement
   */
  private estimateImprovement(plan: QueryPlan): number {
    let improvement = 0;

    // Check for optimization hints
    if (plan.optimizationHints.some(hint => hint.includes('Good:'))) {
      improvement += PERFORMANCE_THRESHOLDS.QUERY_OPTIMIZATION_GOOD_HINT_BONUS;
    }

    // Check for recommended indexes
    if (plan.recommendedIndexes.length > 0) {
      improvement +=
        plan.recommendedIndexes.length *
        PERFORMANCE_THRESHOLDS.QUERY_OPTIMIZATION_INDEX_HINT_BONUS;
    }

    // Check estimated cost
    if (
      plan.estimatedCost < PERFORMANCE_THRESHOLDS.QUERY_IMPROVEMENT_LOW_COST
    ) {
      improvement += PERFORMANCE_THRESHOLDS.QUERY_OPTIMIZATION_LOW_COST_BONUS;
    } else if (
      plan.estimatedCost < PERFORMANCE_THRESHOLDS.QUERY_IMPROVEMENT_MEDIUM_COST
    ) {
      improvement +=
        PERFORMANCE_THRESHOLDS.QUERY_OPTIMIZATION_MEDIUM_COST_BONUS;
    }

    return Math.min(
      improvement,
      PERFORMANCE_THRESHOLDS.QUERY_IMPROVEMENT_MAX_PERCENTAGE,
    );
  }

  /**
   * Check if execution plan is stale
   */
  private isPlanStale(plan: QueryPlan): boolean {
    return Date.now() - plan.createdAt > this.planCacheTimeout;
  }

  /**
   * Clear stale execution plans and prepared statements
   */
  clearStalePlans(): void {
    const now = Date.now();

    for (const [hash, plan] of this.queryPlans.entries()) {
      if (now - plan.createdAt > this.planCacheTimeout) {
        this.queryPlans.delete(hash);
        // Also clear associated prepared statement
        this.preparedStatements.delete(hash);
      }
    }
  }

  /**
   * Get execution plan for a query
   */
  getExecutionPlan(query: string): QueryPlan | undefined {
    const queryHash = hashQuery(query);
    return this.queryPlans.get(queryHash);
  }

  /**
   * Get all cached execution plans
   */
  getAllExecutionPlans(): Map<string, QueryPlan> {
    return new Map(this.queryPlans);
  }

  /**
   * Clear all cached query plans
   */
  clearAllPlans(): void {
    this.queryPlans.clear();
    this.preparedStatements.clear();
  }

  /**
   * Suggest indexes for a table based on common query patterns
   */
  suggestIndexes(tableName: string): string[] {
    const suggestions: string[] = [];

    // Common index suggestions based on table name patterns
    if (tableName.includes('files')) {
      suggestions.push(
        `CREATE INDEX idx_${tableName}_path ON ${tableName}(path)`,
        `CREATE INDEX idx_${tableName}_extension ON ${tableName}(extension)`,
        `CREATE INDEX idx_${tableName}_last_modified ON ${tableName}(lastModified)`,
      );
    }

    if (tableName.includes('search') || tableName.includes('fts')) {
      suggestions.push(
        `CREATE INDEX idx_${tableName}_text ON ${tableName}(text)`,
        `CREATE INDEX idx_${tableName}_type ON ${tableName}(type)`,
      );
    }

    return suggestions;
  }

  /**
   * Analyze query for potential security issues
   */
  analyzeQuerySecurity(query: string): {
    isSafe: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let isSafe = true;

    // Check for SQL injection patterns
    const dangerousPatterns = [
      /drop\s+table/i,
      /delete\s+from/i,
      /truncate\s+table/i,
      /exec\s*\(/i,
      /script\s*>/i,
      /union\s+select/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        warnings.push(
          `Potentially dangerous pattern detected: ${pattern.source}`,
        );
        isSafe = false;
      }
    }

    // Check for unparameterized queries
    if (query.includes("'") && !query.includes('?') && !query.includes('$')) {
      warnings.push(
        'Query contains string literals but no parameters - potential SQL injection risk',
      );
    }

    return { isSafe, warnings };
  }
}

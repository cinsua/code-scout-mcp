/**
 * Error Migration Utilities
 *
 * This file provides comprehensive utilities for migrating legacy error handling
 * to the new ServiceError-based system. It includes batch migration, statistics,
 * and compatibility layers for gradual migration.
 */

import { LogManager } from '../utils/LogManager';

import { ServiceError } from './ServiceError';
import { ErrorFactory } from './ErrorFactory';

export interface MigrationResult {
  migrated: ServiceError;
  wasLegacy: boolean;
  originalType: string;
  migrationPath?: string;
}

export interface BatchMigrationResult {
  results: MigrationResult[];
  statistics: {
    totalErrors: number;
    migratedErrors: number;
    alreadyMigrated: number;
    migrationRate: number;
    errorsByType: Record<string, number>;
  };
  duration: number;
}

export interface MigrationConfig {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  batchSize: number;
  enableStatistics: boolean;
  migrationPaths: Record<string, string>;
}

export class ErrorMigration {
  private static config: MigrationConfig = {
    enableLogging: true,
    logLevel: 'info',
    batchSize: 100,
    enableStatistics: true,
    migrationPaths: {
      ConfigurationError: 'ConfigurationError -> ServiceError',
      DatabaseError: 'DatabaseError -> ServiceError',
      ValidationError: 'ValidationError -> ServiceError',
      FileSystemError: 'FileSystemError -> ServiceError',
      NetworkError: 'NetworkError -> ServiceError',
      TimeoutError: 'TimeoutError -> ServiceError',
    },
  };

  private static logger = LogManager.getLogger('error-migration');

  /**
   * Configure migration settings
   */
  static configure(config: Partial<MigrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Migrate a single error to ServiceError
   */
  static migrateError(error: Error, operation?: string): MigrationResult {
    const startTime = Date.now();
    const result = ErrorFactory.migrateLegacyError(error);

    if (this.config.enableLogging && result.wasLegacy) {
      const migrationPath =
        this.config.migrationPaths[result.originalType] ??
        'Unknown -> ServiceError';
      this.logger.info('Error migrated', {
        originalType: result.originalType,
        migrationPath,
        operation,
        duration: Date.now() - startTime,
      });
    }

    return {
      ...result,
      migrationPath: this.config.migrationPaths[result.originalType],
    };
  }

  /**
   * Migrate multiple errors in batch
   */
  static migrateErrors(
    errors: Error[],
    operation?: string,
  ): BatchMigrationResult {
    const startTime = Date.now();
    const results: MigrationResult[] = [];
    const errorsByType: Record<string, number> = {};

    for (const error of errors) {
      const result = this.migrateError(error, operation);
      results.push(result);

      if (result.wasLegacy) {
        errorsByType[result.originalType] =
          (errorsByType[result.originalType] ?? 0) + 1;
      }
    }

    const migratedErrors = results.filter(r => r.wasLegacy).length;
    const alreadyMigrated = results.length - migratedErrors;
    const migrationRate =
      results.length > 0 ? (migratedErrors / results.length) * 100 : 0;

    const statistics = {
      totalErrors: results.length,
      migratedErrors,
      alreadyMigrated,
      migrationRate,
      errorsByType,
    };

    const duration = Date.now() - startTime;

    if (this.config.enableLogging) {
      this.logger.info('Batch error migration completed', {
        ...statistics,
        operation,
        duration,
      });
    }

    return {
      results,
      statistics,
      duration,
    };
  }

  /**
   * Create a compatibility wrapper for legacy error handling
   */
  static createCompatibilityWrapper<T extends (...args: any[]) => any>(
    originalFunction: T,
    operation?: string,
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = originalFunction(...args);

        // If the result is a Promise, wrap it
        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            throw this.migrateError(error, operation).migrated;
          });
        }

        return result;
      } catch (error) {
        throw this.migrateError(error as Error, operation).migrated;
      }
    }) as T;
  }

  /**
   * Create a migration-aware error boundary
   */
  static createErrorBoundary<T>(operation: string, fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      throw this.migrateError(error as Error, operation).migrated;
    }
  }

  /**
   * Create async migration-aware error boundary
   */
  static async createAsyncErrorBoundary<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.migrateError(error as Error, operation).migrated;
    }
  }

  /**
   * Get migration statistics
   */
  static getMigrationStatistics(results: MigrationResult[]): {
    totalErrors: number;
    migratedErrors: number;
    alreadyMigrated: number;
    migrationRate: number;
    errorsByType: Record<string, number>;
    mostCommonLegacyType: string | null;
  } {
    const migratedErrors = results.filter(r => r.wasLegacy).length;
    const alreadyMigrated = results.length - migratedErrors;
    const migrationRate =
      results.length > 0 ? (migratedErrors / results.length) * 100 : 0;

    const errorsByType: Record<string, number> = {};
    for (const result of results) {
      if (result.wasLegacy) {
        errorsByType[result.originalType] =
          (errorsByType[result.originalType] ?? 0) + 1;
      }
    }

    const mostCommonLegacyType =
      Object.entries(errorsByType).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      null;

    return {
      totalErrors: results.length,
      migratedErrors,
      alreadyMigrated,
      migrationRate,
      errorsByType,
      mostCommonLegacyType,
    };
  }

  /**
   * Validate migration configuration
   */
  static validateMigrationConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.batchSize <= 0) {
      errors.push('batchSize must be greater than 0');
    }

    if (this.config.batchSize > 10000) {
      errors.push('batchSize cannot exceed 10000');
    }

    if (!['debug', 'info', 'warn', 'error'].includes(this.config.logLevel)) {
      errors.push('logLevel must be one of: debug, info, warn, error');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Reset migration configuration to defaults
   */
  static resetConfiguration(): void {
    this.config = {
      enableLogging: true,
      logLevel: 'info',
      batchSize: 100,
      enableStatistics: true,
      migrationPaths: {
        ConfigurationError: 'ConfigurationError -> ServiceError',
        DatabaseError: 'DatabaseError -> ServiceError',
        ValidationError: 'ValidationError -> ServiceError',
        FileSystemError: 'FileSystemError -> ServiceError',
        NetworkError: 'NetworkError -> ServiceError',
        TimeoutError: 'TimeoutError -> ServiceError',
      },
    };
  }

  /**
   * Check if an error type is legacy
   */
  static isLegacyErrorType(error: Error): boolean {
    return !(error instanceof ServiceError);
  }

  /**
   * Get recommended migration strategy for a codebase
   */
  static getMigrationStrategy(statistics: BatchMigrationResult['statistics']): {
    strategy: 'immediate' | 'gradual' | 'minimal';
    recommendations: string[];
    estimatedEffort: 'low' | 'medium' | 'high';
  } {
    const { migrationRate, totalErrors } = statistics;

    if (migrationRate === 0) {
      return {
        strategy: 'minimal',
        recommendations: [
          'No legacy errors detected - migration may not be necessary',
          'Consider adding migration utilities for future compatibility',
        ],
        estimatedEffort: 'low',
      };
    }

    if (migrationRate > 80) {
      return {
        strategy: 'immediate',
        recommendations: [
          'High migration rate detected - consider immediate migration',
          'Update all error handling code to use ServiceError',
          'Remove legacy error classes after migration',
        ],
        estimatedEffort: 'medium',
      };
    }

    if (totalErrors > 1000) {
      return {
        strategy: 'gradual',
        recommendations: [
          'Large codebase with mixed error types - use gradual migration',
          'Start with high-impact areas (frequent error paths)',
          'Use compatibility wrappers for low-priority areas',
          'Monitor migration progress with statistics',
        ],
        estimatedEffort: 'high',
      };
    }

    return {
      strategy: 'gradual',
      recommendations: [
        'Mixed error usage detected - gradual migration recommended',
        'Identify and migrate critical error paths first',
        'Use ErrorMigration.createCompatibilityWrapper for temporary compatibility',
      ],
      estimatedEffort: 'medium',
    };
  }
}

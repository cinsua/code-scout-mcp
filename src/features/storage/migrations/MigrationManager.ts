import { promises as fs } from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

import type { Migration, MigrationResult } from '../types/StorageTypes';
import {
  DatabaseError,
  DatabaseErrorType,
} from '../../../shared/errors/DatabaseError';
import { getRetryDelay } from '../../../shared/errors/ErrorConstants';
import { SyncRetryHandler } from '../../../shared/utils/SyncRetryHandler';

import type { InternalMigration } from './types';

/**
 * Migration manager for database schema versioning
 */
export class MigrationManager {
  private migrations: InternalMigration[] = [];
  private initialized = false;

  constructor(private db: Database.Database) {}

  /**
   * Load migration files and initialize migration tracking
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create migrations table if it doesn't exist
    this.createMigrationsTable();

    // Load migration files
    await this.loadMigrations();

    this.initialized = true;
  }

  /**
   * Get current database version
   */
  getCurrentVersion(): number {
    try {
      const result = this.db
        .prepare('SELECT MAX(version) as version FROM schema_migrations')
        .get() as { version: number } | undefined;

      return result?.version ?? 0;
    } catch {
      // Table might not exist yet
      return 0;
    }
  }

  /**
   * Get list of executed migrations
   */
  getExecutedMigrations(): Migration[] {
    try {
      const rows = this.db
        .prepare(
          'SELECT version, name, checksum, executed_at FROM schema_migrations ORDER BY version',
        )
        .all() as Migration[];

      return rows.map(row => ({
        ...row,
        executedAt: row.executedAt ? new Date(row.executedAt) : undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get list of pending migrations
   */
  getPendingMigrations(): InternalMigration[] {
    const currentVersion = this.getCurrentVersion();
    return this.migrations.filter(m => m.version > currentVersion);
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    await this.initialize();

    const pending = this.getPendingMigrations();
    if (pending.length === 0) {
      return [];
    }

    const results: MigrationResult[] = [];

    // Run migrations in transaction
    const transaction = this.db.transaction(() => {
      for (const migration of pending) {
        const result = this.executeMigration(migration);
        results.push(result);
      }
    });

    try {
      transaction();
      return results;
    } catch (error) {
      // If transaction failed, return error result for the failed migration
      const failedResult: MigrationResult = {
        version: pending[results.length]?.version ?? 0,
        name: pending[results.length]?.name ?? 'unknown',
        success: false,
        error: (error as Error).message,
        executionTime: 0,
      };
      results.push(failedResult);
      return results;
    }
  }

  /**
   * Migrate to specific version
   */
  async migrateTo(targetVersion: number): Promise<MigrationResult[]> {
    await this.initialize();

    const currentVersion = this.getCurrentVersion();

    if (targetVersion === currentVersion) {
      return [];
    }

    const results: MigrationResult[] = [];

    if (targetVersion > currentVersion) {
      // Migrate up
      const pending = this.migrations
        .filter(m => m.version > currentVersion && m.version <= targetVersion)
        .sort((a, b) => a.version - b.version);

      if (pending.length === 0) {
        return [];
      }

      const transaction = this.db.transaction(() => {
        for (const migration of pending) {
          // Note: executeMigration is async but we're in a sync transaction
          // In a real implementation, you might need to handle this differently
          const result = this.executeMigration(migration);
          results.push(result);
        }
      });

      try {
        transaction();
        return results;
      } catch (error) {
        const failedResult: MigrationResult = {
          version: pending[results.length]?.version ?? 0,
          name: pending[results.length]?.name ?? 'unknown',
          success: false,
          error: (error as Error).message,
          executionTime: 0,
        };
        results.push(failedResult);
        return results;
      }
    } else {
      // Migrate down
      const executed = this.getExecutedMigrations()
        .filter(m => m.version > targetVersion)
        .sort((a, b) => b.version - a.version);

      if (executed.length === 0) {
        return [];
      }

      const transaction = this.db.transaction(() => {
        for (const migration of executed) {
          const result = this.rollbackMigration(migration.version);
          results.push(result);
        }
      });

      try {
        transaction();
        return results;
      } catch (error) {
        const failedResult: MigrationResult = {
          version: executed[results.length]?.version ?? 0,
          name: executed[results.length]?.name ?? 'unknown',
          success: false,
          error: (error as Error).message,
          executionTime: 0,
        };
        results.push(failedResult);
        return results;
      }
    }
  }

  /**
   * Rollback to specific version
   */
  rollback(targetVersion: number): Promise<MigrationResult[]> {
    return this.migrateTo(targetVersion);
  }

  /**
   * Add a migration programmatically
   */
  addMigration(migration: InternalMigration): void {
    // Check for duplicate versions
    if (this.migrations.some(m => m.version === migration.version)) {
      throw this.createDatabaseError(
        DatabaseErrorType.MIGRATION_FAILED,
        `Migration version ${migration.version} already exists`,
      );
    }

    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Create migrations table
   */
  private createMigrationsTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.exec(sql);
  }

  /**
   * Load migration files
   */
  private async loadMigrations(): Promise<void> {
    const migrationsDir = path.dirname(__filename);
    const files = await fs.readdir(migrationsDir);

    // Filter for migration files (format: XXX_name.ts)
    const migrationFiles = files
      .filter(file => /^\d{3}_.+\.ts$/.test(file))
      .sort();

    // Load each migration file
    for (const file of migrationFiles) {
      try {
        const modulePath = path.join(migrationsDir, file);
        const migrationModule = await import(modulePath);

        // Look for default export or named exports
        let migration: InternalMigration | undefined;

        if (migrationModule.default) {
          migration = migrationModule.default;
        } else if (migrationModule.migration) {
          migration = migrationModule.migration;
        } else {
          // Try to find the first export that looks like a migration
          const exports = Object.values(migrationModule).find(
            (exp): exp is InternalMigration => {
              if (!exp || typeof exp !== 'object') {
                return false;
              }
              const mig = exp as Record<string, unknown>;
              return (
                'version' in mig &&
                'up' in mig &&
                'down' in mig &&
                typeof mig.version === 'number' &&
                typeof mig.up === 'function' &&
                typeof mig.down === 'function'
              );
            },
          );
          migration = exports;
        }

        if (migration) {
          this.addMigration(migration);
        } else {
          // No valid migration found in file - skip it
        }
      } catch {
        // Failed to load migration - continue with others
        // Could log this properly in a real application
      }
    }
  }

  /**
   * Execute a single migration with retry logic
   */
  private executeMigration(
    migration: InternalMigration,
    maxRetries = 3,
  ): MigrationResult {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Log migration execution attempt
        // console.log(
        //   `Executing migration ${migration.version} (attempt ${attempt}/${maxRetries})`,
        // );

        // Verify checksum if migration was previously executed
        const existing = this.db
          .prepare('SELECT checksum FROM schema_migrations WHERE version = ?')
          .get(migration.version) as { checksum: string } | undefined;

        if (existing && existing.checksum !== migration.checksum) {
          throw this.createDatabaseError(
            DatabaseErrorType.MIGRATION_FAILED,
            `Migration ${migration.version} checksum mismatch`,
          );
        }

        // Execute migration
        migration.up(this.db);

        // Record migration
        this.db
          .prepare(
            'INSERT OR REPLACE INTO schema_migrations (version, name, checksum, executed_at) VALUES (?, ?, ?, ?)',
          )
          .run(
            migration.version,
            migration.name,
            migration.checksum,
            new Date().toISOString(),
          );

        // Log successful migration
        // console.log(
        //   `Migration ${migration.version} completed successfully in ${Date.now() - startTime}ms`,
        // );

        return {
          version: migration.version,
          name: migration.name,
          success: true,
          executionTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;
        // Log migration failure
        // console.warn(
        //   `Migration ${migration.version} attempt ${attempt} failed: ${(error as Error).message}`,
        // );

        // Check if this is a retryable error
        if (!this.isRetryableError(error as Error) || attempt === maxRetries) {
          break;
        }

        // Wait before retry (using standardized exponential backoff)
        const delay = Math.min(
          getRetryDelay('SHORT') * Math.pow(2, attempt - 1),
          getRetryDelay('EXTENDED'),
        );
        // Log retry attempt
        // console.log(`Retrying migration ${migration.version} in ${delay}ms...`);

        // Synchronous delay using busy wait (not ideal but works for SQLite)
        const endTime = Date.now() + delay;
        while (Date.now() < endTime) {
          // Busy wait - in production, you might want a different approach
        }
      }
    }

    // Log final migration failure
    // console.error(
    //   `Migration ${migration.version} failed after ${maxRetries} attempts: ${lastError?.message}`,
    // );

    return {
      version: migration.version,
      name: migration.name,
      success: false,
      error: lastError?.message ?? 'Unknown error',
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    return SyncRetryHandler.isRetryableDatabaseError(error);
  }

  /**
   * Rollback a single migration
   */
  private rollbackMigration(version: number): MigrationResult {
    const startTime = Date.now();
    const migration = this.migrations.find(m => m.version === version);

    if (!migration) {
      return {
        version,
        name: 'unknown',
        success: false,
        error: `Migration ${version} not found`,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Execute rollback
      migration.down(this.db);

      // Remove migration record
      this.db
        .prepare('DELETE FROM schema_migrations WHERE version = ?')
        .run(version);

      return {
        version: migration.version,
        name: migration.name,
        success: true,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        version: migration.version,
        name: migration.name,
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Create a database error
   */
  private createDatabaseError(
    type: DatabaseErrorType,
    message: string,
    original?: Error,
  ): DatabaseError {
    return new DatabaseError(type, message, { original });
  }
}

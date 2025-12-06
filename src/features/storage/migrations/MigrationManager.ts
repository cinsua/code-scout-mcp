import { promises as fs } from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

import type { Migration, DatabaseError } from '../types/StorageTypes';
import { DatabaseErrorType } from '../types/StorageTypes';

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
  async migrate(): Promise<void> {
    await this.initialize();

    const pending = this.getPendingMigrations();
    if (pending.length === 0) {
      return;
    }

    // Run migrations in transaction
    const transaction = this.db.transaction(() => {
      for (const migration of pending) {
        this.executeMigration(migration);
      }
    });

    try {
      transaction();
    } catch (error) {
      throw this.createDatabaseError(
        DatabaseErrorType.MIGRATION_FAILED,
        `Migration failed: ${(error as Error).message}`,
        error as Error,
      );
    }
  }

  /**
   * Migrate to specific version
   */
  async migrateTo(targetVersion: number): Promise<void> {
    await this.initialize();

    const currentVersion = this.getCurrentVersion();

    if (targetVersion === currentVersion) {
      return;
    }

    if (targetVersion > currentVersion) {
      // Migrate up
      const pending = this.migrations
        .filter(m => m.version > currentVersion && m.version <= targetVersion)
        .sort((a, b) => a.version - b.version);

      if (pending.length === 0) {
        return;
      }

      const transaction = this.db.transaction(() => {
        for (const migration of pending) {
          this.executeMigration(migration);
        }
      });

      try {
        transaction();
      } catch (error) {
        throw this.createDatabaseError(
          DatabaseErrorType.MIGRATION_FAILED,
          `Migration to version ${targetVersion} failed: ${(error as Error).message}`,
          error as Error,
        );
      }
    } else {
      // Migrate down
      const executed = this.getExecutedMigrations()
        .filter(m => m.version > targetVersion)
        .sort((a, b) => b.version - a.version);

      if (executed.length === 0) {
        return;
      }

      const transaction = this.db.transaction(() => {
        for (const migration of executed) {
          this.rollbackMigration(migration.version);
        }
      });

      try {
        transaction();
      } catch (error) {
        throw this.createDatabaseError(
          DatabaseErrorType.MIGRATION_FAILED,
          `Rollback to version ${targetVersion} failed: ${(error as Error).message}`,
          error as Error,
        );
      }
    }
  }

  /**
   * Rollback to specific version
   */
  async rollback(targetVersion: number): Promise<void> {
    await this.migrateTo(targetVersion);
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
   * Execute a single migration
   */
  private executeMigration(migration: InternalMigration): void {
    try {
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
    } catch (error) {
      throw this.createDatabaseError(
        DatabaseErrorType.MIGRATION_FAILED,
        `Failed to execute migration ${migration.version}: ${(error as Error).message}`,
        error as Error,
      );
    }
  }

  /**
   * Rollback a single migration
   */
  private rollbackMigration(version: number): void {
    const migration = this.migrations.find(m => m.version === version);
    if (!migration) {
      throw this.createDatabaseError(
        DatabaseErrorType.MIGRATION_FAILED,
        `Migration ${version} not found`,
      );
    }

    try {
      // Execute rollback
      migration.down(this.db);

      // Remove migration record
      this.db
        .prepare('DELETE FROM schema_migrations WHERE version = ?')
        .run(version);
    } catch (error) {
      throw this.createDatabaseError(
        DatabaseErrorType.MIGRATION_FAILED,
        `Failed to rollback migration ${version}: ${(error as Error).message}`,
        error as Error,
      );
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
    return {
      type,
      message,
      original,
      timestamp: new Date(),
    };
  }
}

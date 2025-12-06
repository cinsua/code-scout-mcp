import { promises as fs } from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

import type {
  DatabaseConfig,
  MaintenanceOptions,
  BackupOptions,
  DatabaseHealth,
} from '../types/StorageTypes';

// Constants for database maintenance thresholds
const HIGH_FRAGMENTATION_THRESHOLD = 0.3;
const EXCESSIVE_FREE_SPACE_RATIO = 0.5;

/**
 * Database maintenance utilities
 */
export class DatabaseMaintenance {
  constructor(
    private db: Database.Database,
    private config: DatabaseConfig,
  ) {}

  /**
   * Perform database maintenance operations
   */
  performMaintenance(options: MaintenanceOptions = {}): {
    success: boolean;
    operations: string[];
    errors: string[];
  } {
    const operations: string[] = [];
    const errors: string[] = [];

    try {
      // Analyze query planner
      if (options.analyze !== false) {
        try {
          this.db.exec('ANALYZE');
          operations.push('Analyzed database schema');
        } catch (error) {
          errors.push(`ANALYZE failed: ${(error as Error).message}`);
        }
      }

      // Vacuum database
      if (options.vacuum) {
        try {
          this.db.exec('VACUUM');
          operations.push('Vacuumed database');
        } catch (error) {
          errors.push(`VACUUM failed: ${(error as Error).message}`);
        }
      }

      // Check integrity
      if (options.integrity) {
        try {
          const result = this.db.prepare('PRAGMA integrity_check').get() as {
            integrity_check: string;
          };
          if (result.integrity_check === 'ok') {
            operations.push('Database integrity check passed');
          } else {
            errors.push(`Integrity check failed: ${result.integrity_check}`);
          }
        } catch (error) {
          errors.push(`Integrity check failed: ${(error as Error).message}`);
        }
      }

      // Reindex
      if (options.reindex) {
        try {
          this.db.exec('REINDEX');
          operations.push('Reindexed database');
        } catch (error) {
          errors.push(`REINDEX failed: ${(error as Error).message}`);
        }
      }

      return {
        success: errors.length === 0,
        operations,
        errors,
      };
    } catch (error) {
      errors.push(`Maintenance failed: ${(error as Error).message}`);
      return {
        success: false,
        operations,
        errors,
      };
    }
  }

  /**
   * Backup database to another file
   */
  async backup(options: BackupOptions): Promise<{
    success: boolean;
    size: number;
    duration: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Ensure destination directory exists
      const destDir = path.dirname(options.destination);
      await fs.mkdir(destDir, { recursive: true });

      // For better-sqlite3, we'll use a simple file copy approach
      // In a production environment, you might want to use the backup API
      // but it requires more complex handling
      await fs.copyFile(this.config.path, options.destination);

      // Get backup file size
      const stats = await fs.stat(options.destination);

      return {
        success: true,
        size: stats.size,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        size: 0,
        duration: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get database size information
   */
  getDatabaseInfo(): {
    size: number;
    pageSize: number;
    pageCount: number;
    freePages: number;
    cacheSize: number;
    schemaVersion: number;
  } {
    try {
      const pageSize = this.db.pragma('page_size', { simple: true }) as number;
      const pageCount = this.db.pragma('page_count', {
        simple: true,
      }) as number;
      const freePages = this.db.pragma('freelist_count', {
        simple: true,
      }) as number;
      const cacheSize = this.db.pragma('cache_size', {
        simple: true,
      }) as number;
      const schemaVersion = this.db.pragma('schema_version', {
        simple: true,
      }) as number;

      return {
        size: pageSize * pageCount,
        pageSize,
        pageCount,
        freePages,
        cacheSize,
        schemaVersion,
      };
    } catch (error) {
      throw new Error(
        `Failed to get database info: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get table information
   */
  getTableInfo(tableName: string): {
    name: string;
    columns: Array<{
      name: string;
      type: string;
      notNull: boolean;
      defaultValue: unknown;
      primaryKey: boolean;
    }>;
    indexes: Array<{
      name: string;
      unique: boolean;
      columns: string[];
    }>;
    rowCount: number;
  } {
    try {
      // Get column information
      const columns = this.db
        .prepare(`PRAGMA table_info(${tableName})`)
        .all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: unknown;
        pk: number;
      }>;

      const columnInfo = columns.map(col => ({
        name: col.name,
        type: col.type,
        notNull: col.notnull === 1,
        defaultValue: col.dflt_value,
        primaryKey: col.pk === 1,
      }));

      // Get index information
      const indexes = this.db
        .prepare(`PRAGMA index_list(${tableName})`)
        .all() as Array<{
        seq: number;
        name: string;
        unique: number;
        origin: string;
        partial: number;
      }>;

      const indexInfo = indexes.map(index => {
        const indexColumns = this.db
          .prepare(`PRAGMA index_info(${index.name})`)
          .all() as Array<{
          seqno: number;
          cid: number;
          name: string;
        }>;

        return {
          name: index.name,
          unique: index.unique === 1,
          columns: indexColumns
            .sort((a, b) => a.seqno - b.seqno)
            .map(col => col.name),
        };
      });

      // Get row count
      const rowCount = this.db
        .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
        .get() as {
        count: number;
      };

      return {
        name: tableName,
        columns: columnInfo,
        indexes: indexInfo,
        rowCount: rowCount.count,
      };
    } catch (error) {
      throw new Error(
        `Failed to get table info for ${tableName}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get all tables in the database
   */
  getTables(): string[] {
    try {
      const result = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as Array<{ name: string }>;

      return result.map(row => row.name);
    } catch (error) {
      throw new Error(`Failed to get tables: ${(error as Error).message}`);
    }
  }

  /**
   * Optimize database for better performance
   */
  optimize(): {
    success: boolean;
    operations: string[];
    errors: string[];
  } {
    const operations: string[] = [];
    const errors: string[] = [];

    try {
      // Optimize for better-sqlite3
      this.db.pragma('optimize');
      operations.push('Optimized database');

      // Update table statistics
      this.db.exec('ANALYZE');
      operations.push('Updated table statistics');

      // Set optimal pragmas
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('temp_store = MEMORY');
      operations.push('Set optimal pragmas');

      return {
        success: errors.length === 0,
        operations,
        errors,
      };
    } catch (error) {
      errors.push(`Optimization failed: ${(error as Error).message}`);
      return {
        success: false,
        operations,
        errors,
      };
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<DatabaseHealth> {
    try {
      // Check database file accessibility
      const accessible = await fs
        .access(this.config.path)
        .then(() => true)
        .catch(() => false);

      // Check database integrity
      let integrityOk = false;
      try {
        const result = this.db.prepare('PRAGMA integrity_check').get() as {
          integrity_check: string;
        };
        integrityOk = result.integrity_check === 'ok';
      } catch {
        integrityOk = false;
      }

      // Get database info
      const info = this.getDatabaseInfo();
      const fragmentationRatio = info.freePages / info.pageCount;

      // Determine health status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const issues: string[] = [];

      if (!accessible) {
        status = 'unhealthy';
        issues.push('Database file not accessible');
      }

      if (!integrityOk) {
        status = 'unhealthy';
        issues.push('Database integrity check failed');
      }

      if (fragmentationRatio > HIGH_FRAGMENTATION_THRESHOLD) {
        if (status === 'healthy') {
          status = 'degraded';
        }
        issues.push('High database fragmentation');
      }

      if (info.freePages > info.pageCount * EXCESSIVE_FREE_SPACE_RATIO) {
        if (status === 'healthy') {
          status = 'degraded';
        }
        issues.push('Excessive free space');
      }

      return {
        status,
        accessible,
        poolStatus: 'optimal', // This would come from connection pool in real implementation
        lastError: issues.length > 0 ? issues.join('; ') : undefined,
        performance: {
          avgResponseTime: 0, // Would need to measure this
          connectionTime: 0, // Would need to measure this
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        accessible: false,
        poolStatus: 'critical',
        lastError: (error as Error).message,
        performance: {
          avgResponseTime: 0,
          connectionTime: 0,
        },
      };
    }
  }

  /**
   * Compact database (VACUUM)
   */
  compact(): {
    success: boolean;
    sizeBefore: number;
    sizeAfter: number;
    spaceSaved: number;
    duration?: number;
    error?: string;
  } {
    const startTime = Date.now();
    const sizeBefore = this.getDatabaseInfo().size;

    try {
      this.db.exec('VACUUM');
      const sizeAfter = this.getDatabaseInfo().size;

      return {
        success: true,
        sizeBefore,
        sizeAfter,
        spaceSaved: sizeBefore - sizeAfter,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        sizeBefore,
        sizeAfter: sizeBefore,
        spaceSaved: 0,
        duration: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Reset database statistics
   */
  resetStats(): void {
    try {
      // Reset SQLite internal statistics
      this.db.pragma('stats = 0');
    } catch {
      // Ignore errors during stats reset
    }
  }
}

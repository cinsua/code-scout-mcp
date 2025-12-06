import type Database from 'better-sqlite3';

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  /** Database file path */
  path: string;
  /** Connection pool size (default: 10) */
  maxConnections: number;
  /** Connection timeout in ms (default: 30000) */
  connectionTimeout: number;
  /** Read-only mode flag */
  readonly: boolean;
  /** Database pragmas configuration */
  pragmas: {
    /** Journal mode: 'WAL', 'DELETE', 'MEMORY', etc. */
    journal_mode: string;
    /** Synchronous mode: 'OFF', 'NORMAL', 'FULL', 'EXTRA' */
    synchronous: string;
    /** Cache size in pages (default: 10000) */
    cache_size: number;
    /** Temporary storage: 'DEFAULT', 'FILE', 'MEMORY' */
    temp_store: string;
    /** Locking mode: 'NORMAL', 'EXCLUSIVE' */
    locking_mode: string;
    /** Foreign key constraints: 'ON', 'OFF' */
    foreign_keys: string;
    /** Query timeout in ms */
    busy_timeout: number;
  };
}

/**
 * Database statistics interface
 */
export interface DatabaseStats {
  /** Connection statistics */
  connections: {
    /** Currently active connections */
    active: number;
    /** Idle connections in pool */
    idle: number;
    /** Connections waiting for acquisition */
    waiting: number;
    /** Total connections created */
    total: number;
  };
  /** Query statistics */
  queries: {
    /** Total queries executed */
    total: number;
    /** Slow queries (>100ms) */
    slow: number;
    /** Failed queries */
    failed: number;
    /** Average query time in ms */
    avgTime: number;
  };
  /** Database size statistics */
  size: {
    /** Database file size in bytes */
    database: number;
    /** Indexes size in bytes */
    indexes: number;
    /** Free pages count */
    freePages: number;
    /** Page size in bytes */
    pageSize: number;
  };
}

/**
 * Connection pool statistics
 */
export interface ConnectionPoolStats {
  /** Total connections created */
  created: number;
  /** Connections acquired from pool */
  acquired: number;
  /** Connections released to pool */
  released: number;
  /** Connections destroyed */
  destroyed: number;
  /** Current pool size */
  size: number;
  /** Available connections */
  available: number;
  /** Requests waiting for connection */
  waiting: number;
}

/**
 * Migration interface
 */
export interface Migration {
  /** Migration version number */
  version: number;
  /** Migration name/description */
  name: string;
  /** Migration checksum for integrity */
  checksum: string;
  /** Migration execution timestamp */
  executedAt?: Date;
}

/**
 * Query execution options
 */
export interface QueryOptions {
  /** Query timeout in ms */
  timeout?: number;
  /** Whether to use prepared statement */
  prepared?: boolean;
  /** Transaction mode */
  transaction?: 'read' | 'write' | 'immediate' | 'exclusive';
}

/**
 * Database transaction callback type
 */
export type TransactionCallback<T> = (db: Database.Database) => T;

/**
 * Database health check result
 */
export interface DatabaseHealth {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Database file accessibility */
  accessible: boolean;
  /** Connection pool status */
  poolStatus: 'optimal' | 'warning' | 'critical';
  /** Last error if any */
  lastError?: string;
  /** Performance metrics */
  performance: {
    /** Average response time */
    avgResponseTime: number;
    /** Connection acquisition time */
    connectionTime: number;
  };
}

/**
 * Database backup options
 */
export interface BackupOptions {
  /** Backup file path */
  destination: string;
  /** Progress callback */
  onProgress?: (progress: number) => void;
  /** Whether to vacuum during backup */
  vacuum?: boolean;
}

/**
 * Database maintenance options
 */
export interface MaintenanceOptions {
  /** Whether to analyze query planner */
  analyze?: boolean;
  /** Whether to vacuum database */
  vacuum?: boolean;
  /** Whether to check integrity */
  integrity?: boolean;
  /** Whether to reindex */
  reindex?: boolean;
}

/**
 * Error types for database operations
 */
export enum DatabaseErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  TIMEOUT = 'TIMEOUT',
  CORRUPTION = 'CORRUPTION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * Database error interface
 */
export interface DatabaseError {
  /** Error type */
  type: DatabaseErrorType;
  /** Error message */
  message: string;
  /** Original error if available */
  original?: Error;
  /** Query that caused the error */
  query?: string;
  /** Query parameters */
  params?: unknown[];
  /** Error timestamp */
  timestamp: Date;
  /** Error context */
  context?: Record<string, unknown>;
}

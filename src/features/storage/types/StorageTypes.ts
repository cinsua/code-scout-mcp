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
 * Migration result interface
 */
export interface MigrationResult {
  /** Migration version */
  version: number;
  /** Migration name */
  name: string;
  /** Whether execution was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
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
 * File metadata interface
 */
export interface FileMetadata {
  /** Unique file identifier */
  id: string;
  /** Absolute file path */
  path: string;
  /** File name with extension */
  filename: string;
  /** File extension without dot */
  extension: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp (Unix epoch) */
  lastModified: number;
  /** File content hash (SHA-256) */
  hash: string;
  /** Detected programming language */
  language: string;
  /** Indexing timestamp (Unix epoch) */
  indexedAt: number;
}

/**
 * List options for file queries
 */
export interface ListOptions {
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Filter by language */
  language?: string;
  /** Filter by file extension */
  extension?: string;
  /** Filter by path pattern (LIKE) */
  pathPattern?: string;
  /** Sort field */
  sortBy?: 'indexedAt' | 'lastModified' | 'size' | 'filename';
  /** Sort direction */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Batch operation result
 */
export interface BatchResult {
  /** Number of successfully processed items */
  success: number;
  /** Number of failed items */
  failed: number;
  /** Total processing time in milliseconds */
  duration: number;
  /** Error details for failed items */
  errors?: Array<{
    /** Item identifier */
    id: string;
    /** Error message */
    error: string;
  }>;
}

/**
 * Search candidate interface for FTS5 results
 */
export interface SearchCandidate {
  /** Unique file identifier */
  id: string;
  /** Absolute file path */
  path: string;
  /** File name with extension */
  filename: string;
  /** FTS5 rank score (higher is more relevant) */
  score: number;
  /** Match information with snippets and positions */
  matches: SearchMatch[];
  /** File metadata */
  metadata?: {
    /** File extension */
    extension: string;
    /** Detected programming language */
    language: string;
    /** File size in bytes */
    size: number;
    /** Last modified timestamp */
    lastModified: number;
  };
}

/**
 * Search match information
 */
export interface SearchMatch {
  /** Field where match occurred */
  field:
    | 'filename'
    | 'path'
    | 'definitions'
    | 'imports'
    | 'docstrings'
    | 'tags';
  /** Matching snippet with highlighting */
  snippet: string;
  /** Start position of match in original text */
  startPosition: number;
  /** End position of match in original text */
  endPosition: number;
  /** Matched terms */
  terms: string[];
}

/**
 * Search options interface
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip for pagination */
  offset?: number;
  /** Search filters */
  filters?: {
    /** Filter by programming language */
    language?: string;
    /** Filter by file extension */
    fileType?: string;
    /** Filter by path pattern (LIKE) */
    path?: string;
    /** Filter by file size range */
    sizeRange?: {
      min?: number;
      max?: number;
    };
    /** Filter by modification date range */
    dateRange?: {
      after?: number;
      before?: number;
    };
  };
  /** Whether to include snippets in results */
  includeSnippets?: boolean;
  /** Maximum length of snippets */
  snippetLength?: number;
  /** Search timeout in milliseconds */
  timeout?: number;
  /** Whether to use over-retrieval for QueryEngine */
  overRetrieve?: boolean;
  /** Minimum score threshold */
  minScore?: number;
}

/**
 * Search suggestion interface
 */
export interface SearchSuggestion {
  /** Suggested text */
  text: string;
  /** Suggestion type */
  type: 'tag' | 'filename' | 'definition' | 'import';
  /** Frequency/importance score */
  score: number;
  /** Context information */
  context?: string;
}

/**
 * Search statistics interface
 */
export interface SearchStats {
  /** Total number of searches performed */
  totalSearches: number;
  /** Average search time in milliseconds */
  avgSearchTime: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** FTS5 index size */
  indexSize: number;
  /** Number of indexed documents */
  documentCount: number;
  /** Last index update timestamp */
  lastIndexUpdate: number;
}

/**
 * Index maintenance options
 */
export interface IndexMaintenanceOptions {
  /** Whether to rebuild the entire index */
  rebuild?: boolean;
  /** Whether to optimize the index */
  optimize?: boolean;
  /** Whether to analyze the index */
  analyze?: boolean;
  /** Whether to check index integrity */
  checkIntegrity?: boolean;
  /** Progress callback for long operations */
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Index maintenance result
 */
export interface IndexMaintenanceResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Operation type performed */
  operation: 'rebuild' | 'optimize' | 'analyze' | 'check';
  /** Duration in milliseconds */
  duration: number;
  /** Number of documents processed */
  documentsProcessed?: number;
  /** Index size before operation */
  sizeBefore?: number;
  /** Index size after operation */
  sizeAfter?: number;
  /** Error message if failed */
  error?: string;
  /** Warnings generated */
  warnings?: string[];
}

/**
 * Database error class
 */
export class DatabaseError extends Error {
  /** Error type */
  public readonly type: DatabaseErrorType;

  /** Original error if available */
  public readonly original?: Error;

  /** Query that caused the error */
  public readonly query?: string;

  /** Query parameters */
  public readonly params?: unknown[];

  /** Error timestamp */
  public readonly timestamp: Date;

  /** Error context */
  public readonly context?: Record<string, unknown>;

  constructor(
    type: DatabaseErrorType,
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.type = type;
    this.original = options.original;
    this.query = options.query;
    this.params = options.params;
    this.timestamp = new Date();
    this.context = options.context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, DatabaseError);
    }
  }
}

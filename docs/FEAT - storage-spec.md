# Storage Feature Specification

## Overview

The Storage feature provides database abstraction and data persistence for the code indexing system, using SQLite with FTS5 extension for efficient full-text search capabilities. The implementation uses better-sqlite3 ^11.4.0 (WiseLibs) for synchronous database operations with cross-platform compatibility.

## Architecture

### Structure

```
features/storage/
├── services/
│   ├── DatabaseService.ts      # Main database operations
│   ├── FileRepository.ts       # File metadata CRUD operations
│   └── SearchRepository.ts     # Search query operations
├── models/
│   ├── DatabaseSchema.ts       # Database structure definitions
│   ├── Tables.ts               # Table and column definitions
│   └── Queries.ts              # SQL query builders
├── migrations/
│   ├── 001_initial_schema.ts
│   └── 002_add_fts_index.ts
├── utils/
│   ├── connectionPool.ts       # Database connection management
│   └── queryBuilder.ts         # SQL query utilities
├── types/
│   └── StorageTypes.ts         # TypeScript type definitions
└── index.ts                    # Public API exports
```

## Core Components

### DatabaseService

**Purpose**: Main service handling database connections, transactions, and schema management.

**Interface**:

```typescript
class DatabaseService {
  constructor(private config: DatabaseConfig) {}

  async initialize(): Promise<void>;
  async close(): Promise<void>;
  async executeQuery<T>(query: string, params?: any[]): Promise<T>;
  async executeTransaction<T>(
    callback: (db: Database) => Promise<T>
  ): Promise<T>;
  async migrate(): Promise<void>;
  getStats(): DatabaseStats;
}
```

**DatabaseConfig**:

```typescript
interface DatabaseConfig {
  path: string; // Database file path
  maxConnections: number; // Connection pool size (default: 10)
  connectionTimeout: number; // Timeout in ms (default: 30000)
  pragmas: {
    // SQLite pragmas
    journal_mode: string; // 'WAL'
    synchronous: string; // 'NORMAL'
    cache_size: number; // 10000
    temp_store: string; // 'memory'
  };
}
```

### FileRepository

**Purpose**: Handles CRUD operations for file metadata.

**Interface**:

```typescript
class FileRepository {
  constructor(private db: DatabaseService) {}

  async save(metadata: FileMetadata): Promise<void>;
  async findByPath(path: string): Promise<FileMetadata | null>;
  async findById(id: string): Promise<FileMetadata | null>;
  async update(path: string, metadata: Partial<FileMetadata>): Promise<void>;
  async delete(path: string): Promise<void>;
  async count(): Promise<number>;
  async list(options?: ListOptions): Promise<FileMetadata[]>;
}
```

**Operations**:

- **Save**: Insert or update file metadata with conflict resolution
- **Find**: Efficient lookup by path or ID
- **Update**: Partial updates for incremental changes
- **Delete**: Remove files from index
- **Count**: Get total indexed files
- **List**: Paginated listing with filtering

### SearchRepository

**Purpose**: Handles full-text search operations using FTS5.

**Interface**:

```typescript
class SearchRepository {
  constructor(private db: DatabaseService) {}

  async searchByTags(
    tags: string[],
    options?: SearchOptions
  ): Promise<SearchCandidate[]>;
  async searchByText(query: string): Promise<SearchCandidate[]>;
  async getSuggestions(prefix: string): Promise<string[]>;
  async rebuildIndex(): Promise<void>;
  async optimizeIndex(): Promise<void>;
}
```

**SearchCandidate**:

```typescript
interface SearchCandidate {
  id: string;
  path: string;
  score: number; // FTS5 rank score
  matches: {
    // Highlighted match information
    field: string;
    snippet: string;
  }[];
}
```

## Database Schema

### Files Table

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  size INTEGER NOT NULL,
  lastModified INTEGER NOT NULL,
  hash TEXT NOT NULL,
  language TEXT NOT NULL,
  indexedAt INTEGER NOT NULL
);
```

### Definitions Table

```sql
CREATE TABLE definitions (
  id TEXT PRIMARY KEY,
  fileId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  line INTEGER NOT NULL,
  column INTEGER NOT NULL,
  exported BOOLEAN NOT NULL,
  docstring TEXT,
  decorators TEXT, -- JSON array
  signature TEXT,
  FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
);
```

### Imports Table

```sql
CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  fileId TEXT NOT NULL,
  module TEXT NOT NULL,
  type TEXT NOT NULL, -- 'local', 'external', 'builtin'
  imports TEXT NOT NULL, -- JSON array
  alias TEXT,
  isDynamic BOOLEAN NOT NULL DEFAULT 0,
  line INTEGER NOT NULL,
  FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
);
```

### FTS5 Virtual Table

```sql
CREATE VIRTUAL TABLE files_fts USING fts5(
  filename,
  path,
  definitions,    -- Concatenated definition names
  imports,        -- Concatenated import modules
  docstrings,     -- Concatenated documentation
  tags,           -- Generated search tags
  content='files',
  content_rowid='rowid'
);
```

## Migration System

### Migration Manager

```typescript
class MigrationManager {
  constructor(private db: DatabaseService) {}

  async getCurrentVersion(): Promise<number>;
  async migrateTo(version: number): Promise<void>;
  async rollback(version: number): Promise<void>;
  async createMigration(name: string): Promise<string>;
}
```

### Migration Files

```typescript
// migrations/001_initial_schema.ts
export const up = async (db: Database) => {
  await db.execute(`
    CREATE TABLE files (...);
    CREATE TABLE definitions (...);
    CREATE VIRTUAL TABLE files_fts USING fts5(...);
  `);
};

export const down = async (db: Database) => {
  await db.execute(`
    DROP TABLE IF EXISTS definitions;
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS files_fts;
  `);
};
```

## Query Builders

### File Queries

```typescript
class FileQueries {
  static insert(metadata: FileMetadata): { sql: string; params: any[] };
  static update(
    path: string,
    updates: Partial<FileMetadata>
  ): { sql: string; params: any[] };
  static findByPath(path: string): { sql: string; params: any[] };
  static deleteByPath(path: string): { sql: string; params: any[] };
}
```

### Search Queries

```typescript
class SearchQueries {
  static searchByTags(
    tags: string[],
    limit: number
  ): { sql: string; params: any[] } {
    const tagQuery = tags.join(' OR ');
    return {
      sql: `
        SELECT f.*, fts.rank
        FROM files f
        JOIN files_fts fts ON f.rowid = fts.rowid
        WHERE fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `,
      params: [tagQuery, limit],
    };
  }
}
```

## Connection Pooling

### Pool Implementation

```typescript
class ConnectionPool {
  private pool: Database[] = [];
  private waiting: ((db: Database) => void)[] = [];

  constructor(private config: PoolConfig) {}

  async getConnection(): Promise<Database>;
  async releaseConnection(db: Database): Promise<void>;
  async closeAll(): Promise<void>;
  getStats(): PoolStats;
}
```

**PoolConfig**:

```typescript
interface PoolConfig {
  minConnections: number; // 2
  maxConnections: number; // 10
  acquireTimeout: number; // 30000ms
  idleTimeout: number; // 600000ms (10min)
}
```

## Business Rules

### Data Integrity Rules

1. **Unique Paths**: File paths must be unique within repository
2. **Hash Validation**: Stored hash must match file content
3. **Referential Integrity**: Foreign key constraints maintained
4. **Atomic Operations**: All related updates in transactions

### Performance Rules

1. **Connection Pooling**: Efficient connection reuse
2. **Query Optimization**: Use indexes and prepared statements
3. **Batch Operations**: Group multiple operations when possible
4. **Memory Limits**: Prevent excessive memory usage

### Consistency Rules

1. **Transaction Boundaries**: Related operations in single transactions
2. **Rollback Support**: Failed operations don't leave partial state
3. **Version Control**: Schema migrations maintain compatibility
4. **Backup Strategy**: Regular database backups

## Error Handling

### Connection Errors

- **Pool Exhaustion**: Queue requests with timeout
- **Connection Failures**: Retry with exponential backoff
- **Timeout Handling**: Fail gracefully with clear error messages

### Query Errors

- **Syntax Errors**: Validate queries before execution
- **Constraint Violations**: Handle unique constraint failures
- **Lock Conflicts**: Implement retry logic for busy database

### Migration Errors

- **Version Conflicts**: Detect and resolve schema version mismatches
- **Partial Migrations**: Rollback on migration failures
- **Data Loss Prevention**: Backup before destructive migrations

## Performance Optimizations

### Indexing Strategy

- **FTS5 Configuration**: Optimize for search performance
- **Compound Indexes**: Multi-column indexes for common queries
- **Query Planning**: Analyze and optimize slow queries
- **Caching Layer**: Cache frequently accessed metadata

### Memory Management

- **Streaming Results**: Handle large result sets efficiently
- **Connection Limits**: Prevent connection pool exhaustion
- **Query Limits**: Default limits on result set sizes
- **Cleanup**: Explicit resource cleanup

### Monitoring

```typescript
interface DatabaseStats {
  connections: {
    active: number;
    idle: number;
    waiting: number;
  };
  queries: {
    total: number;
    slow: number; // >100ms
    failed: number;
  };
  size: {
    database: number; // bytes
    indexes: number; // bytes
  };
}
```

## Integration Points

### Indexing Integration

- Receives metadata from indexer for storage
- Provides change detection hashes
- Supports incremental updates

### Querying Integration

- Executes FTS5 search queries
- Provides candidate retrieval
- Handles result pagination

### Configuration Integration

- Accepts database configuration
- Supports dynamic reconfiguration
- Validates configuration on startup

## Testing Strategy

### Unit Tests

- Query builder correctness
- Migration script validation
- Connection pool behavior
- Error handling scenarios

### Integration Tests

- Full database operations
- Migration execution
- Concurrent access patterns
- Performance benchmarks

### Database Tests

- Schema validation
- Data integrity checks
- Query performance testing
- Backup and restore procedures

### Migration Tests

- Forward and backward migrations
- Data preservation validation
- Rollback functionality
- Version conflict resolution</content>
  <parameter name="filePath">docsV2/storage-spec.md

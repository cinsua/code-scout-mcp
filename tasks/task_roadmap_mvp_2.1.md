# Task 2.1: Implement Database Service with SQLite and better-sqlite3

## Overview

Implement the core database service layer using SQLite with better-sqlite3 ^11.4.0 (WiseLibs) for synchronous database operations, providing the foundation for all data persistence and search operations in the code indexing system.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Requirements from Documentation

### Technical Specifications (from CORE - technical_specifications.md)

- Use SQLite with FTS5 extension for full-text search
- better-sqlite3 ^11.4.0 (WiseLibs) for synchronous database operations
- Connection pooling for performance
- Schema migrations for version control
- Project-local database isolation

### Technology Stack (from CORE - technology_stack.md)

- better-sqlite3: ^11.4.0 (WiseLibs) - Synchronous SQLite wrapper
- Pure JavaScript with prebuilt binaries (no compilation required)
- Faster than async wrappers for our use case
- Simpler API without promises
- Better memory management
- Cross-platform compatibility

### Storage Feature Requirements (from FEAT - storage-spec.md)

- DatabaseService for main database operations
- Connection management and pooling
- Transaction support
- Migration system
- Performance monitoring and statistics

### Database Schema Requirements (from IMPL - database_schema.md)

- SQLite 3.40+ with FTS5 extension
- Database location: `./.code-scout/database.db` (project-local)
- Proper pragmas configuration (WAL mode, NORMAL sync, etc.)
- Migration table for version control

## Implementation Checklist

### 2.1.1 Setup Database Infrastructure

- [x] Create `src/features/storage/` directory structure
- [x] Install better-sqlite3 dependency: `npm install better-sqlite3@^11.4.0`
- [x] Define DatabaseConfig interface in `src/features/storage/types/StorageTypes.ts`
- [x] Create DatabaseService class in `src/features/storage/services/DatabaseService.ts`
- [x] Setup TypeScript types for better-sqlite3 integration

### 2.1.2 Implement DatabaseService Core

- [x] Create database connection initialization with proper pragmas
- [x] Implement connection management (open/close methods)
- [x] Add transaction support with proper error handling
- [x] Create query execution methods (execute, executeAll, executeRun)
- [x] Implement database statistics and monitoring

### 2.1.3 Add Connection Pooling

- [x] Create ConnectionPool class in `src/features/storage/utils/connectionPool.ts`
- [x] Implement connection acquisition and release logic
- [x] Add connection timeout and retry mechanisms
- [x] Create pool statistics and health monitoring
- [x] Integrate connection pool with DatabaseService

### 2.1.4 Implement Migration System

- [x] Create MigrationManager in `src/features/storage/migrations/MigrationManager.ts`
- [x] Implement migration version tracking with schema_migrations table
- [x] Create migration execution logic (up/down)
- [x] Add migration rollback capabilities
- [x] Create initial migration files (001_initial_schema.ts)

### 2.1.5 Add Error Handling and Validation

- [x] Implement database-specific error types
- [x] Add connection failure recovery with exponential backoff
- [x] Create query validation and sanitization
- [x] Implement transaction rollback on errors
- [x] Add comprehensive error logging with context

### 2.1.6 Create Database Utilities

- [x] Implement query builders in `src/features/storage/utils/queryBuilder.ts`
- [x] Create database maintenance utilities (vacuum, analyze, integrity check)
- [x] Add backup and restore functionality
- [x] Implement performance monitoring utilities
- [x] Create database health check methods

## Code Templates

### DatabaseConfig Interface Template

```typescript
// src/features/storage/types/StorageTypes.ts
export interface DatabaseConfig {
  path: string; // Database file path
  maxConnections: number; // Connection pool size (default: 10)
  connectionTimeout: number; // Timeout in ms (default: 30000)
  readonly: boolean; // Read-only mode flag
  pragmas: {
    journal_mode: string; // 'WAL'
    synchronous: string; // 'NORMAL'
    cache_size: number; // 10000
    temp_store: string; // 'memory'
    locking_mode: string; // 'NORMAL'
  };
}

export interface DatabaseStats {
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

### DatabaseService Template

```typescript
// src/features/storage/services/DatabaseService.ts
import Database from 'better-sqlite3';
import { DatabaseConfig, DatabaseStats } from '../types/StorageTypes';
import { ConnectionPool } from '../utils/connectionPool';
import { MigrationManager } from '../migrations/MigrationManager';

export class DatabaseService {
  private pool: ConnectionPool;
  private migrationManager: MigrationManager;
  private stats: DatabaseStats;

  constructor(private config: DatabaseConfig) {
    this.pool = new ConnectionPool(config);
    this.migrationManager = new MigrationManager(this);
    this.initializeStats();
  }

  async initialize(): Promise<void> {
    // Initialize database connection
    // Configure pragmas
    // Run migrations
    // Setup monitoring
  }

  async close(): Promise<void> {
    // Close all connections
    // Cleanup resources
  }

  async executeQuery<T>(query: string, params?: any[]): Promise<T> {
    // Acquire connection from pool
    // Execute query
    // Release connection
    // Update stats
  }

  async executeTransaction<T>(
    callback: (db: Database) => Promise<T>,
  ): Promise<T> {
    // Begin transaction
    // Execute callback
    // Commit or rollback
  }

  async migrate(): Promise<void> {
    // Run pending migrations
  }

  getStats(): DatabaseStats {
    // Return current database statistics
  }
}
```

### ConnectionPool Template

```typescript
// src/features/storage/utils/connectionPool.ts
import Database from 'better-sqlite3';
import { DatabaseConfig } from '../types/StorageTypes';

export class ConnectionPool {
  private connections: Database[] = [];
  private waiting: ((db: Database) => void)[] = [];
  private stats = {
    created: 0,
    acquired: 0,
    released: 0,
    destroyed: 0,
  };

  constructor(private config: DatabaseConfig) {}

  async getConnection(): Promise<Database> {
    // Implement connection acquisition logic
    // Handle pool exhaustion
    // Create new connections if needed
  }

  async releaseConnection(db: Database): Promise<void> {
    // Implement connection release logic
    // Handle waiting queue
    // Maintain pool size limits
  }

  async closeAll(): Promise<void> {
    // Close all connections
    // Cleanup resources
  }

  getStats() {
    // Return pool statistics
  }
}
```

### MigrationManager Template

```typescript
// src/features/storage/migrations/MigrationManager.ts
import Database from 'better-sqlite3';
import { DatabaseService } from '../services/DatabaseService';

interface Migration {
  version: number;
  name: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
  checksum: string;
}

export class MigrationManager {
  private migrations: Migration[] = [];

  constructor(private db: DatabaseService) {
    this.loadMigrations();
  }

  async getCurrentVersion(): Promise<number> {
    // Query schema_migrations table
  }

  async migrateTo(version?: number): Promise<void> {
    // Execute migrations in order
    // Handle rollback on failure
    // Update migration tracking
  }

  async rollback(version: number): Promise<void> {
    // Rollback to specified version
  }

  private async recordMigration(migration: Migration): Promise<void> {
    // Record successful migration
  }
}
```

## File Structure

```
src/features/storage/
├── services/
│   ├── DatabaseService.ts
│   ├── FileRepository.ts
│   └── SearchRepository.ts
├── models/
│   ├── DatabaseSchema.ts
│   ├── Tables.ts
│   └── Queries.ts
├── migrations/
│   ├── MigrationManager.ts
│   ├── 001_initial_schema.ts
│   └── 002_add_fts_index.ts
├── utils/
│   ├── connectionPool.ts
│   ├── queryBuilder.ts
│   └── databaseMaintenance.ts
├── types/
│   └── StorageTypes.ts
└── index.ts
```

## Integration Points

### Configuration Integration

- Accept database configuration from ConfigurationManager
- Support dynamic reconfiguration
- Validate configuration on startup

### Error Handling Integration

- Use structured error types from shared error system
- Implement retry logic with exponential backoff
- Provide detailed error context for debugging

### Performance Monitoring Integration

- Emit performance metrics for monitoring
- Support query performance tracking
- Provide database health status

## Validation Criteria

### Functional Requirements

- [ ] Database connection established successfully
- [ ] All configured pragmas applied correctly
- [ ] Connection pool manages connections efficiently
- [ ] Migration system runs schema changes correctly
- [ ] Transactions maintain ACID properties
- [ ] Error handling covers all failure scenarios

### Performance Requirements

- [ ] Connection acquisition < 10ms
- [ ] Simple queries execute < 50ms
- [ ] Connection pool maintains optimal size
- [ ] Memory usage stays within limits
- [ ] Database operations don't block main thread excessively

### Reliability Requirements

- [ ] Database connections recover from failures
- [ ] Migrations can be rolled back safely
- [ ] Transaction rollback works correctly
- [ ] Connection pool handles exhaustion gracefully
- [ ] Error recovery doesn't corrupt data

## Acceptance Tests

### Unit Tests

- [ ] DatabaseService initialization and configuration
- [ ] Connection pool acquisition and release
- [ ] Migration execution and rollback
- [ ] Query execution with various parameter types
- [ ] Transaction commit and rollback scenarios
- [ ] Error handling for all failure modes

### Integration Tests

- [ ] Database creation with proper schema
- [ ] Migration sequence execution
- [ ] Concurrent connection handling
- [ ] Transaction isolation levels
- [ ] Performance under load
- [ ] Database backup and restore

### Performance Tests

- [ ] Connection pool performance benchmarks
- [ ] Query execution time measurements
- [ ] Memory usage profiling
- [ ] Concurrent operation stress testing
- [ ] Large dataset handling

## Quality Gates

### Code Quality

- [ ] All TypeScript types properly defined
- [ ] Error handling follows project patterns
- [ ] Code coverage > 95% for database logic
- [ ] No memory leaks in connection management
- [ ] Proper resource cleanup in all scenarios

### Documentation

- [ ] All public APIs documented with JSDoc
- [ ] Database schema documented
- [ ] Migration procedures documented
- [ ] Performance characteristics documented
- [ ] Error scenarios and recovery documented

### Security

- [ ] SQL injection prevention validated
- [ ] Database file permissions secured
- [ ] Connection limits enforced
- [ ] Input validation implemented
- [ ] Error messages don't expose sensitive data

## Dependencies

### Required Dependencies

- better-sqlite3 ^11.4.0 (WiseLibs)
- Node.js 18+ (for better-sqlite3 compatibility)

### Optional Dependencies

- uuid ^9.0.0 (for generating IDs)
- crypto (built-in) for hash generation

### Development Dependencies

- @types/better-sqlite3 for TypeScript support
- jest for testing framework
- ts-jest for TypeScript test support

## Next Steps

After completing this task, the following tasks become available:

- **Task 2.2**: Create database schema and migration system (builds on migration foundation)
- **Task 2.3**: Build file repository for CRUD operations (uses DatabaseService)
- **Task 2.4**: Implement search repository with FTS5 integration (extends database capabilities)
- **Task 2.5**: Add connection pooling and performance optimizations (enhances this foundation)

This database service provides the critical foundation for all data persistence operations in the code indexing system, enabling efficient storage, retrieval, and search capabilities.

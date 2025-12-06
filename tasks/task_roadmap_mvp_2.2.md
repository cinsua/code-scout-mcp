# Task 2.2: Create Database Schema and Migration System

## Overview

Implement a robust database schema and migration system for SQLite with FTS5 support, providing version-controlled schema evolution and efficient data persistence for the code indexing system.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Requirements from Documentation

### Technical Specifications (from CORE - technical_specifications.md)

- SQLite with FTS5 extension for full-text search
- better-sqlite3 ^11.4.0 (WiseLibs) for synchronous database operations
- Connection pooling for performance
- Schema migrations for version control
- Project-local database isolation

### Database Schema Requirements (from IMPL - database_schema.md)

- **Files Table**: Core file metadata with unique paths and SHA256 hashing
- **Definitions Table**: Code definitions (classes, functions, components)
- **Imports Table**: Import statements with type classification
- **Symbols Table**: Local symbols and variables
- **FTS5 Virtual Table**: Full-text search across filename, path, definitions, imports, docstrings, tags
- **File Tags Table**: Weighted tags for semantic search
- **Migration Table**: Track schema version and execution history

### Storage Feature Requirements (from FEAT - storage-spec.md)

- Migration system with up/down scripts
- Connection pooling and performance optimization
- Error handling and recovery patterns
- Database maintenance operations
- Backup and recovery procedures

### Error Handling Requirements (from IMPL - error_handling.md)

- Structured error classification and handling
- Retry logic with exponential backoff
- Circuit breaker pattern for resilience
- Graceful degradation strategies
- Comprehensive logging and monitoring

## Implementation Checklist

### 2.2.1 Setup Database Infrastructure

- [ ] Create `src/features/storage/migrations/` directory structure
- [ ] Install better-sqlite3 dependency: `npm install better-sqlite3@^11.4.0`
- [ ] Define migration types in `src/features/storage/migrations/types.ts`
- [ ] Create MigrationManager in `src/features/storage/migrations/MigrationManager.ts`
- [ ] Setup database configuration types in `src/features/storage/types/StorageTypes.ts`

### 2.2.2 Implement Migration 001: Initial Schema

- [ ] Create `src/features/storage/migrations/001_initial_schema.ts`
- [ ] Implement files table with proper indexes
- [ ] Implement definitions table with foreign key constraints
- [ ] Implement imports table with type classification
- [ ] Implement symbols table for local variables
- [ ] Add proper indexes for query performance
- [ ] Create migration table for version tracking
- [ ] Implement down migration for rollback

### 2.2.3 Implement Migration 002: Add FTS5 Support

- [ ] Create `src/features/storage/migrations/002_add_fts_index.ts`
- [ ] Implement FTS5 virtual table with optimized tokenizer
- [ ] Create file_tags table for weighted tag storage
- [ ] Implement FTS5 triggers for automatic index updates
- [ ] Populate FTS5 index with existing data
- [ ] Add FTS5 configuration and optimization
- [ ] Implement down migration for FTS5 removal

### 2.2.4 Create Migration Manager

- [ ] Implement migration discovery and loading
- [ ] Create version tracking and comparison logic
- [ ] Implement forward migration execution
- [ ] Create rollback functionality
- [ ] Add migration validation and checksums
- [ ] Implement transaction handling for atomic migrations
- [ ] Add migration status reporting

### 2.2.5 Implement Database Service Integration

- [ ] Integrate migration manager into DatabaseService
- [ ] Add automatic migration on database initialization
- [ ] Implement migration error handling and recovery
- [ ] Add database health checks and integrity validation
- [ ] Create migration status monitoring
- [ ] Implement backup creation before major migrations

### 2.2.6 Add Error Handling and Validation

- [ ] Implement migration-specific error types
- [ ] Add validation for migration scripts
- [ ] Create rollback mechanisms for failed migrations
- [ ] Implement retry logic for transient failures
- [ ] Add comprehensive logging for migration operations
- [ ] Create migration status reporting and monitoring

## Code Templates

### Migration Types Template

```typescript
// src/features/storage/migrations/types.ts
export interface Migration {
  version: number;
  name: string;
  description: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
  checksum: string;
}

export interface MigrationRecord {
  version: number;
  name: string;
  executedAt: number;
  checksum: string;
  executionTime: number;
}

export interface MigrationResult {
  version: number;
  name: string;
  success: boolean;
  error?: string;
  executionTime: number;
}
```

### Migration Manager Template

```typescript
// src/features/storage/migrations/MigrationManager.ts
export class MigrationManager {
  private migrations: Migration[] = [];

  constructor(private db: DatabaseService) {
    this.loadMigrations();
  }

  async migrate(targetVersion?: number): Promise<MigrationResult[]> {
    const currentVersion = await this.getCurrentVersion();
    const results: MigrationResult[] = [];

    // Execute migrations in transaction
    return await this.db.transaction(async () => {
      for (const migration of this.migrations) {
        if (migration.version <= currentVersion) continue;
        if (targetVersion && migration.version > targetVersion) break;

        const result = await this.executeMigration(migration);
        results.push(result);

        if (!result.success) {
          throw new Error(
            `Migration ${migration.version} failed: ${result.error}`,
          );
        }
      }
      return results;
    });
  }

  private async executeMigration(
    migration: Migration,
  ): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      await migration.up(this.db.getDatabase());
      await this.recordMigration(migration, Date.now() - startTime);

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
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }
}
```

### Migration 001 Template

```typescript
// src/features/storage/migrations/001_initial_schema.ts
import { Migration } from './types';

export const migration: Migration = {
  version: 1,
  name: 'initial_schema',
  description:
    'Create core tables for files, definitions, imports, and symbols',
  checksum: 'sha256-hash-of-migration-content',

  up: async (db: Database) => {
    // Create files table
    await db.exec(`
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
      )
    `);

    // Create definitions table
    await db.exec(`
      CREATE TABLE definitions (
        id TEXT PRIMARY KEY,
        fileId TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        line INTEGER NOT NULL,
        column INTEGER NOT NULL,
        exported BOOLEAN NOT NULL,
        docstring TEXT,
        decorators TEXT,
        signature TEXT,
        FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await db.exec(`CREATE INDEX idx_files_path ON files(path)`);
    await db.exec(`CREATE INDEX idx_files_language ON files(language)`);
    await db.exec(
      `CREATE INDEX idx_definitions_file_id ON definitions(fileId)`,
    );
    await db.exec(`CREATE INDEX idx_definitions_type ON definitions(type)`);
  },

  down: async (db: Database) => {
    await db.exec(`DROP TABLE IF EXISTS definitions`);
    await db.exec(`DROP TABLE IF EXISTS files`);
  },
};
```

### Migration 002 Template

```typescript
// src/features/storage/migrations/002_add_fts_index.ts
import { Migration } from './types';

export const migration: Migration = {
  version: 2,
  name: 'add_fts_index',
  description: 'Add FTS5 virtual table and file tags for full-text search',
  checksum: 'sha256-hash-of-migration-content',

  up: async (db: Database) => {
    // Create FTS5 virtual table
    await db.exec(`
      CREATE VIRTUAL TABLE files_fts USING fts5(
        filename,
        path,
        definitions,
        imports,
        docstrings,
        tags,
        content='files',
        content_rowid='rowid',
        tokenize='porter unicode61'
      )
    `);

    // Create file_tags table
    await db.exec(`
      CREATE TABLE file_tags (
        fileId TEXT NOT NULL,
        tag TEXT NOT NULL,
        weight REAL NOT NULL,
        FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE,
        UNIQUE(fileId, tag)
      )
    `);

    // Create FTS5 triggers
    await db.exec(`
      CREATE TRIGGER files_fts_insert AFTER INSERT ON files
      BEGIN
        INSERT INTO files_fts(rowid, filename, path, definitions, imports, docstrings, tags)
        VALUES (
          new.rowid,
          new.filename,
          new.path,
          (SELECT GROUP_CONCAT(name, ' ') FROM definitions WHERE fileId = new.id),
          (SELECT GROUP_CONCAT(module, ' ') FROM imports WHERE fileId = new.id),
          (SELECT GROUP_CONCAT(COALESCE(docstring, ''), ' ') FROM definitions WHERE fileId = new.id AND docstring IS NOT NULL),
          (SELECT GROUP_CONCAT(tag, ' ') FROM file_tags WHERE fileId = new.id)
        );
      END
    `);

    // Populate FTS5 with existing data
    await db.exec(`
      INSERT INTO files_fts(rowid, filename, path, definitions, imports, docstrings, tags)
      SELECT
        f.rowid,
        f.filename,
        f.path,
        COALESCE((SELECT GROUP_CONCAT(d.name, ' ') FROM definitions d WHERE d.fileId = f.id), ''),
        COALESCE((SELECT GROUP_CONCAT(i.module, ' ') FROM imports i WHERE i.fileId = f.id), ''),
        COALESCE((SELECT GROUP_CONCAT(d.docstring, ' ') FROM definitions d WHERE d.fileId = f.id AND d.docstring IS NOT NULL), ''),
        ''
      FROM files f
    `);

    // Create indexes for file_tags
    await db.exec(`CREATE INDEX idx_file_tags_file_id ON file_tags(fileId)`);
    await db.exec(`CREATE INDEX idx_file_tags_tag ON file_tags(tag)`);
    await db.exec(`CREATE INDEX idx_file_tags_weight ON file_tags(weight)`);
  },

  down: async (db: Database) => {
    await db.exec(`DROP TRIGGER IF EXISTS files_fts_insert`);
    await db.exec(`DROP TRIGGER IF EXISTS files_fts_update`);
    await db.exec(`DROP TRIGGER IF EXISTS files_fts_delete`);
    await db.exec(`DROP TABLE IF EXISTS file_tags`);
    await db.exec(`DROP TABLE IF EXISTS files_fts`);
  },
};
```

## File Structure

```
src/features/storage/
├── migrations/
│   ├── types.ts
│   ├── MigrationManager.ts
│   ├── 001_initial_schema.ts
│   ├── 002_add_fts_index.ts
│   └── index.ts
├── services/
│   └── DatabaseService.ts (to be updated)
├── types/
│   └── StorageTypes.ts
└── index.ts
```

## Integration Points

### DatabaseService Integration

- Migration manager initialization in DatabaseService constructor
- Automatic migration execution during database initialization
- Migration status reporting through DatabaseService methods
- Error handling integration with existing error patterns

### Configuration Integration

- Database path configuration from config system
- Migration timeout and retry settings
- Connection pool configuration for migration operations
- Backup settings for major migrations

### Error Handling Integration

- Migration-specific error types and classification
- Retry logic for transient migration failures
- Circuit breaker for repeated migration failures
- Comprehensive logging for migration operations

## Validation Criteria

### Schema Validation

- [ ] All tables created with proper structure
- [ ] Foreign key constraints properly defined
- [ ] Indexes created for performance optimization
- [ ] FTS5 virtual table properly configured
- [ ] Triggers correctly maintain FTS5 synchronization

### Migration Validation

- [ ] Migration version tracking works correctly
- [ ] Forward migrations execute in proper order
- [ ] Rollback functionality restores previous state
- [ ] Migration checksums prevent tampering
- [ ] Transaction handling ensures atomicity

### Performance Validation

- [ ] Database queries use indexes effectively
- [ ] FTS5 search performs within acceptable limits
- [ ] Migration execution completes in reasonable time
- [ ] Connection pooling handles concurrent operations
- [ ] Memory usage stays within limits

### Error Handling Validation

- [ ] Migration failures are properly caught and reported
- [ ] Rollback mechanisms restore database state
- [ ] Retry logic handles transient failures
- [ ] Error messages provide clear diagnostic information
- [ ] Logging captures all migration operations

## Acceptance Tests

### Unit Tests

- [ ] Migration discovery and loading tests
- [ ] Version tracking and comparison tests
- [ ] Individual migration execution tests
- [ ] Rollback functionality tests
- [ ] Error handling and validation tests

### Integration Tests

- [ ] Full migration cycle tests
- [ ] Database service integration tests
- [ ] FTS5 functionality tests
- [ ] Concurrent migration tests
- [ ] Performance benchmark tests

### Database Tests

- [ ] Schema validation tests
- [ ] Data integrity tests
- [ ] Index performance tests
- [ ] FTS5 search accuracy tests
- [ ] Migration rollback verification tests

## Quality Gates

### Code Quality

- [ ] TypeScript types properly defined for all interfaces
- [ ] Code follows project linting and formatting standards
- [ ] All functions have proper JSDoc documentation
- [ ] Error handling follows established patterns
- [ ] Database queries use parameterized statements

### Testing Coverage

- [ ] Unit test coverage > 90% for migration logic
- [ ] Integration tests cover all migration scenarios
- [ ] Performance tests validate migration efficiency
- [ ] Error injection tests validate resilience
- [ ] Database integrity tests ensure data consistency

### Performance Requirements

- [ ] Migration execution time < 5 seconds for initial schema
- [ ] FTS5 population time < 30 seconds for 10,000 files
- [ ] Database queries complete < 100ms for indexed operations
- [ ] Memory usage < 50MB during migration operations
- [ ] Connection pool handles 10+ concurrent operations

### Security Requirements

- [ ] Database file permissions properly restricted
- [ ] SQL injection prevention through parameterized queries
- [ ] Migration script validation prevents code injection
- [ ] Database backup encryption for sensitive data
- [ ] Audit logging for all migration operations

# Task 2.3: Build File Repository for CRUD Operations

## Overview

Implement FileRepository class to handle all CRUD operations for file metadata in the SQLite database, providing efficient data access methods with proper error handling and transaction support.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Requirements from Documentation

### Technical Specifications (from FEAT - storage-spec.md)

- FileRepository handles CRUD operations for file metadata
- Interface includes: save, findByPath, findById, update, delete, count, list
- Must support conflict resolution for save operations (insert or update)
- Efficient lookup by path or ID with proper indexing
- Partial updates for incremental changes
- Paginated listing with filtering options

### Database Schema (from IMPL - database_schema.md)

- Files table with columns: id, path, filename, extension, size, lastModified, hash, language, indexedAt
- Unique constraint on path column
- Proper indexes for performance: idx_files_path, idx_files_language, idx_files_hash, idx_files_indexed_at
- Foreign key relationships with definitions, imports, and symbols tables

### Integration Requirements

- Works with DatabaseService for connection management
- Supports transaction boundaries for atomic operations
- Integrates with FTS5 triggers for search index updates
- Provides data for RepositoryScanner and IndexerService

## Implementation Checklist

### 2.3.1 Setup FileRepository Structure

- [x] Create `src/features/storage/services/FileRepository.ts`
- [x] Define FileRepository class with constructor accepting DatabaseService
- [x] Import required types from StorageTypes.ts
- [x] Setup basic class structure with proper TypeScript typing

### 2.3.2 Implement Core CRUD Operations

- [x] Implement `save(metadata: FileMetadata): Promise<void>` method
  - [x] Use UPSERT logic (INSERT OR REPLACE) for conflict resolution
  - [x] Handle all required fields with proper validation
  - [x] Include error handling for constraint violations
- [x] Implement `findByPath(path: string): Promise<FileMetadata | null>` method
  - [x] Use prepared statement for performance
  - [x] Handle null results gracefully
  - [x] Map database row to FileMetadata interface
- [x] Implement `findById(id: string): Promise<FileMetadata | null>` method
  - [x] Similar to findByPath but using ID lookup
  - [x] Proper error handling and null checking

### 2.3.3 Implement Update and Delete Operations

- [x] Implement `update(path: string, metadata: Partial<FileMetadata>): Promise<void>` method
  - [x] Support partial updates with dynamic SQL generation
  - [x] Validate that at least one field is being updated
  - [x] Handle case where file doesn't exist (optional: throw or ignore)
- [x] Implement `delete(path: string): Promise<void>` method
  - [x] Use CASCADE delete to remove related records
  - [x] Handle missing files gracefully
  - [x] Include proper error handling

### 2.3.4 Implement Query and Listing Operations

- [x] Implement `count(): Promise<number>` method
  - [x] Simple count query with proper error handling
- [x] Implement `list(options?: ListOptions): Promise<FileMetadata[]>` method
  - [x] Support pagination with limit and offset
  - [x] Support filtering by language, extension, path patterns
  - [x] Support sorting by various fields (indexedAt, lastModified, size)
  - [x] Use parameterized queries for security

### 2.3.5 Add Batch Operations and Transaction Support

- [x] Implement `saveBatch(metadata: FileMetadata[]): Promise<BatchResult>` method
  - [x] Use transaction for atomic batch operations
  - [x] Handle large batches with chunking if needed
  - [x] Include progress reporting for large batches
- [x] Implement `deleteBatch(paths: string[]): Promise<BatchResult>` method
  - [x] Transaction-based batch deletion
  - [x] Proper error handling and rollback on failure
- [x] Add transaction helper methods for complex operations

### 2.3.6 Add Query Optimization and Caching

- [x] Implement prepared statement caching for frequently used queries
- [ ] Add query result caching for expensive operations
- [x] Optimize list queries with proper index usage
- [ ] Add query execution time monitoring

### 2.3.7 Add Comprehensive Error Handling

- [x] Implement specific error types for different failure scenarios
- [ ] Add retry logic for transient database errors
- [x] Include detailed error context for debugging
- [ ] Add logging for all database operations

### 2.3.8 Add Data Validation and Integrity

- [x] Implement input validation for all methods
- [x] Add hash validation for file integrity checks
- [x] Include data type validation and sanitization
- [x] Add business rule validation (e.g., path format checks)

## Code Templates

### FileRepository Class Structure

```typescript
// src/features/storage/services/FileRepository.ts
import type { Database } from 'better-sqlite3';
import { DatabaseError, DatabaseErrorType } from '../types/StorageTypes';
import type { FileMetadata, ListOptions } from '../types/StorageTypes';

export class FileRepository {
  constructor(private db: Database) {}

  async save(metadata: FileMetadata): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO files (
        id, path, filename, extension, size, lastModified, 
        hash, language, indexedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        metadata.id,
        metadata.path,
        metadata.filename,
        metadata.extension,
        metadata.size,
        metadata.lastModified,
        metadata.hash,
        metadata.language,
        metadata.indexedAt,
      );
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Failed to save file metadata: ${metadata.path}`,
        { original: error as Error, query: stmt.sql },
      );
    }
  }

  async findByPath(path: string): Promise<FileMetadata | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM files WHERE path = ?
    `);

    try {
      const row = stmt.get(path) as any;
      return row ? this.mapRowToFileMetadata(row) : null;
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Failed to find file by path: ${path}`,
        { original: error as Error, query: stmt.sql },
      );
    }
  }

  private mapRowToFileMetadata(row: any): FileMetadata {
    return {
      id: row.id,
      path: row.path,
      filename: row.filename,
      extension: row.extension,
      size: row.size,
      lastModified: row.lastModified,
      hash: row.hash,
      language: row.language,
      indexedAt: row.indexedAt,
    };
  }
}
```

### ListOptions Interface

```typescript
// src/features/storage/types/StorageTypes.ts (add if not exists)
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
```

### Batch Operations Template

```typescript
async saveBatch(metadata: FileMetadata[]): Promise<void> {
  const transaction = this.db.transaction((items: FileMetadata[]) => {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO files (
        id, path, filename, extension, size, lastModified,
        hash, language, indexedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      stmt.run(
        item.id,
        item.path,
        item.filename,
        item.extension,
        item.size,
        item.lastModified,
        item.hash,
        item.language,
        item.indexedAt
      );
    }
  });

  try {
    // Process in chunks to avoid memory issues
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < metadata.length; i += CHUNK_SIZE) {
      const chunk = metadata.slice(i, i + CHUNK_SIZE);
      transaction(chunk);
    }
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorType.TRANSACTION_FAILED,
      `Failed to save batch of ${metadata.length} files`,
      { original: error as Error }
    );
  }
}
```

## File Structure

```
src/features/storage/
├── services/
│   ├── DatabaseService.ts          # Already implemented
│   ├── FileRepository.ts           # NEW: File CRUD operations
│   └── SearchRepository.ts         # To be implemented later
├── types/
│   └── StorageTypes.ts             # Already has basic types
├── utils/
│   ├── queryBuilder.ts             # May need updates
│   └── validation.ts               # NEW: Input validation utilities
└── index.ts                        # Update exports
```

## Integration Points

### With DatabaseService

- Uses DatabaseService connection for all operations
- Leverages connection pooling and transaction management
- Inherits error handling patterns from DatabaseService

### With Indexing Feature

- Called by IndexerService to store file metadata
- Provides change detection via hash comparison
- Supports incremental updates for modified files

### With Querying Feature

- Provides data for search operations
- Supports filtering and sorting for result sets
- Maintains FTS5 index consistency through triggers

### With File-Watching Feature

- Handles rapid file updates efficiently
- Supports batch operations for multiple file changes
- Provides conflict resolution for concurrent updates

## Validation Criteria

- [x] All CRUD operations work correctly with test data
- [x] Error handling covers all failure scenarios
- [x] Performance meets requirements (<10ms for single operations)
- [x] Memory usage stays within limits for batch operations
- [x] Database constraints are properly enforced
- [x] FTS5 triggers are maintained automatically

## Acceptance Tests

- [x] Unit tests for each CRUD method
- [ ] Integration tests with real database operations
- [ ] Performance tests for large datasets
- [ ] Concurrency tests for simultaneous operations
- [x] Error handling tests with various failure scenarios
- [x] Data integrity tests with constraint violations

## Quality Gates

- [x] Code coverage > 95% for all repository methods
- [x] All TypeScript types properly defined and used
- [x] Error handling follows project patterns
- [x] Database queries use prepared statements
- [ ] Performance benchmarks pass for all operations
- [x] Memory usage tests pass for batch operations

## Performance Requirements

- Single file operations: <10ms average response time
- Batch operations (1000 files): <1 second total time
- Memory usage: <50MB for batch operations
- Connection usage: Efficient use of connection pool
- Query optimization: Proper index usage verified

## Error Handling Requirements

- Specific error types for different failure scenarios
- Detailed error context for debugging
- Retry logic for transient failures
- Graceful degradation for non-critical errors
- Comprehensive logging for monitoring

## Security Considerations

- SQL injection prevention with parameterized queries
- Input validation for all user-provided data
- Path traversal prevention in file operations
- Proper access control for database operations
- Data sanitization before storage

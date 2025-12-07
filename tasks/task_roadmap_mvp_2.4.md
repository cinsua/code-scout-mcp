# Task 2.4: Implement Search Repository with FTS5 Integration

## Overview

Implement SearchRepository service to handle full-text search operations using SQLite FTS5 extension, providing efficient candidate retrieval for the QueryEngine with proper ranking and filtering capabilities.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Requirements from Documentation

### Technical Specifications (from CORE - technical_specifications.md)

- Use SQLite with FTS5 extension for full-text search
- Implement SearchRepository service in `src/features/storage/services/`
- Support tag-based search with candidate retrieval
- Provide search ranking and filtering capabilities
- Integrate with DatabaseService for query execution

### Storage Feature Requirements (from FEAT - storage-spec.md)

- SearchRepository interface with searchByTags, searchByText methods
- SearchCandidate model with id, path, score, and match information
- FTS5 virtual table integration for efficient full-text search
- Support for search suggestions and index optimization
- Proper error handling and query validation

### Database Schema Requirements (from IMPL - database_schema.md)

- FTS5 virtual table: `files_fts` with filename, path, definitions, imports, docstrings, tags
- Proper triggers for keeping FTS5 index synchronized
- Search queries with MATCH operator and ranking
- Content table mapping with `content='files'` and `content_rowid='rowid'`

### Querying Feature Integration (from FEAT - querying-spec.md)

- Candidate retrieval for QueryEngine with over-retrieval (2x limit)
- Tag expansion and query optimization support
- Performance targets: <30ms for simple queries, <100ms for complex queries
- Integration with scoring algorithm for result ranking

## Implementation Checklist

### 2.4.1 Setup Search Repository Infrastructure

- [x] Create `src/features/storage/services/SearchRepository.ts`
- [x] Define SearchCandidate interface in `src/features/storage/types/StorageTypes.ts`
- [x] Create SearchOptions interface for query parameters
- [x] Add search query builders in `src/features/storage/utils/queryBuilder.ts`
- [x] Setup error handling for search operations

### 2.4.2 Implement Core Search Methods

- [x] Implement `searchByTags(tags: string[], options?: SearchOptions)` method
  - [x] Validate input tags (1-5 tags limit)
  - [x] Expand tags for broader matching (case variations, common substitutions)
  - [x] Build FTS5 MATCH query with OR operators
  - [x] Execute query with proper parameter binding
  - [x] Return SearchCandidate array with ranking
- [x] Implement `searchByText(query: string)` method
  - [x] Validate and sanitize text query
  - [x] Build FTS5 query for natural language search
  - [x] Handle phrase searches and boolean operators
  - [x] Return ranked results

### 2.4.3 Implement Search Utility Methods

- [x] Implement `getSuggestions(prefix: string)` method
  - [x] Query FTS5 for completions using prefix matching
  - [x] Limit suggestions to reasonable number (10-20)
  - [x] Rank suggestions by frequency/importance
  - [x] Return unique, sorted suggestion array
- [x] Implement `rebuildIndex()` method
  - [x] Execute FTS5 rebuild operation
  - [x] Handle long-running rebuild operations
  - [x] Provide progress feedback for large indexes
  - [x] Validate index integrity after rebuild
- [x] Implement `optimizeIndex()` method
  - [x] Run FTS5 optimization commands
  - [x] Update index statistics
  - [x] Compact index if needed
  - [x] Return optimization status

### 2.4.4 Create Query Builders for Search

- [x] Create `SearchQueryBuilder` class in `src/features/storage/utils/queryBuilder.ts`
  - [x] `buildTagSearchQuery(tags: string[], limit: number)` method
  - [x] `buildTextSearchQuery(query: string, limit: number)` method
  - [x] `buildSuggestionsQuery(prefix: string, limit: number)` method
  - [x] `buildIndexMaintenanceQuery(operation: string)` method
- [x] Add parameter sanitization and SQL injection prevention
- [x] Implement query result mapping to SearchCandidate objects
- [x] Add query performance monitoring and logging

### 2.4.5 Add Advanced Search Features

- [x] Implement search result highlighting
  - [x] Extract match snippets from FTS5 results
  - [x] Highlight matching terms in context
  - [x] Provide match position information
  - [x] Handle multiple field matches
- [x] Add search filtering capabilities
  - [x] Filter by file type/extension
  - [x] Filter by language
  - [x] Filter by path patterns
  - [x] Combine filters with FTS5 search
- [x] Implement search result pagination
  - [x] Support OFFSET/LIMIT for large result sets
  - [x] Provide total count information
  - [x] Handle pagination edge cases

### 2.4.6 Add Performance Optimizations

- [x] Implement query result caching
  - [x] Cache frequent search queries
  - [x] Set appropriate TTL (5 minutes)
  - [x] Cache invalidation on index updates
  - [x] Memory-efficient cache storage
- [x] Add connection pooling optimizations
  - [x] Use read-only connections for search queries
  - [x] Implement query timeouts
  - [x] Handle connection exhaustion gracefully
- [x] Optimize FTS5 configuration
  - [x] Configure appropriate tokenizers
  - [x] Set optimal ranking functions
  - [x] Tune index maintenance parameters

### 2.4.7 Add Error Handling and Validation

- [x] Implement search query validation
  - [x] Validate tag count and format
  - [x] Sanitize text queries
  - [x] Check for malicious query patterns
  - [x] Return meaningful error messages
- [x] Add database error handling
  - [x] Handle FTS5 index corruption
  - [x] Recover from query timeouts
  - [x] Handle connection failures
  - [x] Log errors with context
- [x] Implement graceful degradation
  - [x] Fallback to basic text search on FTS5 failures
  - [x] Return partial results on timeouts
  - [x] Provide alternative search strategies

### 2.4.8 Add Testing and Monitoring

- [x] Create comprehensive unit tests
  - [x] Test search query building
  - [x] Test result mapping and ranking
  - [x] Test error handling scenarios
  - [x] Test performance characteristics
- [x] Add search performance monitoring
  - [x] Track query execution times
  - [x] Monitor cache hit rates
  - [x] Log slow queries (>100ms)
  - [x] Track index size and health
- [x] Create integration tests
  - [x] Test with real FTS5 database
  - [x] Test concurrent search operations
  - [x] Test index maintenance operations
  - [x] Test error recovery scenarios

## Code Templates

### SearchRepository Interface Template

```typescript
// src/features/storage/services/SearchRepository.ts
import { DatabaseService } from './DatabaseService';
import { SearchCandidate, SearchOptions } from '../types/StorageTypes';

export class SearchRepository {
  constructor(private db: DatabaseService) {}

  async searchByTags(
    tags: string[],
    options?: SearchOptions,
  ): Promise<SearchCandidate[]> {
    // Implementation
  }

  async searchByText(query: string): Promise<SearchCandidate[]> {
    // Implementation
  }

  async getSuggestions(prefix: string): Promise<string[]> {
    // Implementation
  }

  async rebuildIndex(): Promise<void> {
    // Implementation
  }

  async optimizeIndex(): Promise<void> {
    // Implementation
  }
}
```

### SearchCandidate Type Template

```typescript
// src/features/storage/types/StorageTypes.ts
export interface SearchCandidate {
  id: string;
  path: string;
  score: number; // FTS5 rank score
  matches: {
    field: string;
    snippet: string;
    startPosition: number;
    endPosition: number;
  }[];
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: {
    language?: string;
    fileType?: string;
    path?: string;
  };
  includeSnippets?: boolean;
  snippetLength?: number;
}
```

### Search Query Builder Template

```typescript
// src/features/storage/utils/queryBuilder.ts
export class SearchQueryBuilder {
  static buildTagSearchQuery(
    tags: string[],
    limit: number,
    offset: number = 0,
  ) {
    const tagQuery = tags.map(tag => `"${tag}"`).join(' OR ');

    return {
      sql: `
        SELECT 
          f.id,
          f.path,
          f.filename,
          fts.rank,
          snippet(files_fts, 0, '<mark>', '</mark>', '...', 32) as filename_snippet,
          snippet(files_fts, 1, '<mark>', '</mark>', '...', 64) as path_snippet,
          snippet(files_fts, 2, '<mark>', '</mark>', '...', 128) as definitions_snippet
        FROM files f
        JOIN files_fts fts ON f.rowid = fts.rowid
        WHERE files_fts MATCH ?
        ORDER BY fts.rank DESC
        LIMIT ? OFFSET ?
      `,
      params: [tagQuery, limit, offset],
    };
  }

  static buildSuggestionsQuery(prefix: string, limit: number = 20) {
    return {
      sql: `
        SELECT DISTINCT tags 
        FROM files_fts 
        WHERE tags MATCH ?
        LIMIT ?
      `,
      params: [`${prefix}*`, limit],
    };
  }
}
```

## File Structure

```
src/features/storage/
├── services/
│   ├── SearchRepository.ts        # Main search repository implementation
│   ├── DatabaseService.ts         # Existing database service
│   └── FileRepository.ts          # Existing file repository
├── types/
│   └── StorageTypes.ts            # Search-related type definitions
├── utils/
│   ├── queryBuilder.ts            # Search query builders
│   ├── connectionPool.ts          # Existing connection pool
│   └── databaseMaintenance.ts     # Existing maintenance utilities
└── index.ts                       # Feature exports
```

## Integration Points

### DatabaseService Integration

- Use DatabaseService for query execution
- Leverage connection pooling for performance
- Participate in transaction management
- Handle database connection errors

### QueryEngine Integration

- Provide candidate retrieval for QueryEngine
- Support over-retrieval (2x requested limit)
- Return properly ranked results
- Handle query timeouts and errors

### FileRepository Integration

- Cross-reference file metadata when needed
- Maintain consistency between repositories
- Share connection pool and error handling
- Coordinate index maintenance operations

## Validation Criteria

### Functional Requirements

- [ ] All search methods return correct results
- [ ] FTS5 queries execute properly with MATCH operator
- [ ] Search ranking produces relevant order
- [ ] Tag expansion improves search coverage
- [ ] Suggestions provide useful completions

### Performance Requirements

- [ ] Simple queries execute in <30ms
- [ ] Complex queries execute in <100ms
- [ ] Concurrent searches handle 10+ simultaneous requests
- [ ] Memory usage stays within limits
- [ ] Cache hit rate >70% for repeated queries

### Quality Requirements

- [ ] All SQL queries are parameterized (no injection risk)
- [ ] Error handling covers all failure scenarios
- [ ] Code coverage >90% for search logic
- [ ] Performance benchmarks pass
- [ ] Integration tests with real database succeed

## Acceptance Tests

### Unit Tests

- [ ] Search query building with various tag combinations
- [ ] Result mapping to SearchCandidate objects
- [ ] Error handling for invalid queries
- [ ] Cache behavior verification
- [ ] Performance regression tests

### Integration Tests

- [ ] End-to-end search with FTS5 database
- [ ] Concurrent search operations
- [ ] Index maintenance operations
- [ ] Error recovery scenarios
- [ ] Performance under load

### Database Tests

- [ ] FTS5 index synchronization
- [ ] Query execution with real data
- [ ] Index rebuild and optimization
- [ ] Connection pool behavior
- [ ] Transaction handling

## Quality Gates

### Code Quality

- [ ] TypeScript strict mode compliance
- [ ] ESLint rules pass without warnings
- [ ] All public APIs documented
- [ ] Error messages are descriptive
- [ ] Code follows established patterns

### Performance

- [ ] Query execution times meet targets
- [ ] Memory usage within acceptable limits
- [ ] Cache effectiveness validated
- [ ] Concurrent operation handling verified
- [ ] Database query optimization confirmed

### Reliability

- [ ] Error handling covers all scenarios
- [ ] Graceful degradation implemented
- [ ] Resource cleanup verified
- [ ] Database integrity maintained
- [ ] Recovery mechanisms tested

## Dependencies

### Required Dependencies

- better-sqlite3 ^11.4.0 (already in project)
- Existing DatabaseService implementation
- Existing connection pool infrastructure

### Optional Dependencies

- Caching library (if implementing advanced caching)
- Performance monitoring tools
- Additional SQLite FTS5 extensions

## Risks and Mitigations

### Technical Risks

- **FTS5 Complexity**: SQLite FTS5 has complex query syntax
  - _Mitigation_: Start with basic MATCH queries, gradually add complexity
- **Performance at Scale**: Large repositories may slow down searches
  - _Mitigation_: Implement caching, query optimization, and pagination
- **Index Synchronization**: Keeping FTS5 index in sync with main tables
  - _Mitigation_: Use database triggers and proper transaction handling

### Integration Risks

- **QueryEngine Dependencies**: Changes to QueryEngine may affect SearchRepository
  - _Mitigation_: Maintain clear interface contracts and version compatibility
- **Database Schema Changes**: Schema migrations may break FTS5 functionality
  - _Mitigation_: Include FTS5 operations in migration testing

This implementation provides a robust, performant search repository that integrates seamlessly with the existing storage infrastructure while meeting all the requirements for FTS5-based full-text search.

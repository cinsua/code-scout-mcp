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

- [ ] Create `src/features/storage/services/SearchRepository.ts`
- [ ] Define SearchCandidate interface in `src/features/storage/types/StorageTypes.ts`
- [ ] Create SearchOptions interface for query parameters
- [ ] Add search query builders in `src/features/storage/utils/queryBuilder.ts`
- [ ] Setup error handling for search operations

### 2.4.2 Implement Core Search Methods

- [ ] Implement `searchByTags(tags: string[], options?: SearchOptions)` method
  - [ ] Validate input tags (1-5 tags limit)
  - [ ] Expand tags for broader matching (case variations, common substitutions)
  - [ ] Build FTS5 MATCH query with OR operators
  - [ ] Execute query with proper parameter binding
  - [ ] Return SearchCandidate array with ranking
- [ ] Implement `searchByText(query: string)` method
  - [ ] Validate and sanitize text query
  - [ ] Build FTS5 query for natural language search
  - [ ] Handle phrase searches and boolean operators
  - [ ] Return ranked results

### 2.4.3 Implement Search Utility Methods

- [ ] Implement `getSuggestions(prefix: string)` method
  - [ ] Query FTS5 for completions using prefix matching
  - [ ] Limit suggestions to reasonable number (10-20)
  - [ ] Rank suggestions by frequency/importance
  - [ ] Return unique, sorted suggestion array
- [ ] Implement `rebuildIndex()` method
  - [ ] Execute FTS5 rebuild operation
  - [ ] Handle long-running rebuild operations
  - [ ] Provide progress feedback for large indexes
  - [ ] Validate index integrity after rebuild
- [ ] Implement `optimizeIndex()` method
  - [ ] Run FTS5 optimization commands
  - [ ] Update index statistics
  - [ ] Compact index if needed
  - [ ] Return optimization status

### 2.4.4 Create Query Builders for Search

- [ ] Create `SearchQueryBuilder` class in `src/features/storage/utils/queryBuilder.ts`
  - [ ] `buildTagSearchQuery(tags: string[], limit: number)` method
  - [ ] `buildTextSearchQuery(query: string, limit: number)` method
  - [ ] `buildSuggestionsQuery(prefix: string, limit: number)` method
  - [ ] `buildIndexMaintenanceQuery(operation: string)` method
- [ ] Add parameter sanitization and SQL injection prevention
- [ ] Implement query result mapping to SearchCandidate objects
- [ ] Add query performance monitoring and logging

### 2.4.5 Add Advanced Search Features

- [ ] Implement search result highlighting
  - [ ] Extract match snippets from FTS5 results
  - [ ] Highlight matching terms in context
  - [ ] Provide match position information
  - [ ] Handle multiple field matches
- [ ] Add search filtering capabilities
  - [ ] Filter by file type/extension
  - [ ] Filter by language
  - [ ] Filter by path patterns
  - [ ] Combine filters with FTS5 search
- [ ] Implement search result pagination
  - [ ] Support OFFSET/LIMIT for large result sets
  - [ ] Provide total count information
  - [ ] Handle pagination edge cases

### 2.4.6 Add Performance Optimizations

- [ ] Implement query result caching
  - [ ] Cache frequent search queries
  - [ ] Set appropriate TTL (5 minutes)
  - [ ] Cache invalidation on index updates
  - [ ] Memory-efficient cache storage
- [ ] Add connection pooling optimizations
  - [ ] Use read-only connections for search queries
  - [ ] Implement query timeouts
  - [ ] Handle connection exhaustion gracefully
- [ ] Optimize FTS5 configuration
  - [ ] Configure appropriate tokenizers
  - [ ] Set optimal ranking functions
  - [ ] Tune index maintenance parameters

### 2.4.7 Add Error Handling and Validation

- [ ] Implement search query validation
  - [ ] Validate tag count and format
  - [ ] Sanitize text queries
  - [ ] Check for malicious query patterns
  - [ ] Return meaningful error messages
- [ ] Add database error handling
  - [ ] Handle FTS5 index corruption
  - [ ] Recover from query timeouts
  - [ ] Handle connection failures
  - [ ] Log errors with context
- [ ] Implement graceful degradation
  - [ ] Fallback to basic text search on FTS5 failures
  - [ ] Return partial results on timeouts
  - [ ] Provide alternative search strategies

### 2.4.8 Add Testing and Monitoring

- [ ] Create comprehensive unit tests
  - [ ] Test search query building
  - [ ] Test result mapping and ranking
  - [ ] Test error handling scenarios
  - [ ] Test performance characteristics
- [ ] Add search performance monitoring
  - [ ] Track query execution times
  - [ ] Monitor cache hit rates
  - [ ] Log slow queries (>100ms)
  - [ ] Track index size and health
- [ ] Create integration tests
  - [ ] Test with real FTS5 database
  - [ ] Test concurrent search operations
  - [ ] Test index maintenance operations
  - [ ] Test error recovery scenarios

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

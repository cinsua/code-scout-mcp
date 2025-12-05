# Querying Feature Specification

## Overview

The Querying feature provides semantic search capabilities with weighted relevance scoring, enabling efficient code discovery through tag-based queries optimized for LLM consumption.

## Architecture

### Structure
```
features/querying/
├── services/
│   ├── QueryEngine.ts          # Main query orchestration
│   ├── ScoringAlgorithm.ts     # Relevance scoring implementation
│   └── ResultBuilder.ts        # Response formatting
├── models/
│   ├── Query.ts                # Query data structures
│   ├── SearchResult.ts         # Result models
│   └── SearchFilters.ts        # Filtering options
├── events/
│   ├── QueryExecutedEvent.ts
│   └── ResultsGeneratedEvent.ts
├── utils/
│   ├── textMatching.ts         # Text similarity utilities
│   └── relevanceScoring.ts     # Scoring helpers
├── types/
│   └── QueryingTypes.ts        # TypeScript definitions
└── index.ts                    # Public API exports
```

## Core Components

### QueryEngine Service

**Purpose**: Main orchestrator for search operations that coordinates the complete query pipeline.

**Interface**:
```typescript
class QueryEngine {
  constructor(
    private storage: StorageService,
    private scorer: ScoringAlgorithm,
    private builder: ResultBuilder,
    private eventBus: EventBus
  ) {}

  async search(query: SearchQuery): Promise<SearchResponse>
  async searchByTags(tags: string[], options?: SearchOptions): Promise<SearchResponse>
  getSearchStatistics(): SearchStats
}
```

**Responsibilities**:
- Parse and validate search queries
- Coordinate FTS5 candidate retrieval
- Apply relevance scoring
- Format results for LLM consumption
- Publish query execution events

**SearchQuery**:
```typescript
interface SearchQuery {
  tags: string[];              // 1-5 search tags
  limit?: number;              // Max results (default: 20)
  filters?: SearchFilters;     // Optional filters
  includeContent?: boolean;    // Include file content
}

interface SearchFilters {
  language?: string;           // Filter by language
  fileType?: string;           // Filter by extension
  path?: string;               // Path pattern filter
  hasExports?: boolean;        // Files with exports
  hasTests?: boolean;          // Include/exclude test files
}
```

### ScoringAlgorithm Service

**Purpose**: Implements weighted relevance scoring to rank search results.

**Interface**:
```typescript
class ScoringAlgorithm {
  constructor(private weights: ScoringWeights) {}

  calculateScore(metadata: FileMetadata, queryTags: string[]): number
  calculateCoverage(text: string, tags: string[]): number
  applyPenalties(score: number, metadata: FileMetadata): number
}
```

**Scoring Weights**:
```typescript
interface ScoringWeights {
  filename: number;         // 5.0 - Highest specificity
  path: number;             // 3.0 - Directory context
  definitions: number;      // 3.0 - Core code elements
  imports: number;          // 2.0 - Dependencies
  documentation: number;    // 1.0 - Comments/docstrings
  derivedTags: number;      // 1.0 - Generated tags
}
```

**Scoring Logic**:
```typescript
function calculateScore(metadata: FileMetadata, queryTags: string[]): number {
  let score = 0;

  // Filename matching (highest weight)
  score += this.calculateCoverage(metadata.filename, queryTags) * this.weights.filename;

  // Path matching
  score += this.calculateCoverage(metadata.path, queryTags) * this.weights.path;

  // Definition matching
  for (const def of metadata.definitions) {
    score += this.calculateCoverage(def.name, queryTags) * this.weights.definitions;
    if (def.signature) {
      score += this.calculateCoverage(def.signature, queryTags) * this.weights.definitions;
    }
  }

  // Import matching
  for (const imp of metadata.imports) {
    score += this.calculateCoverage(imp.module, queryTags) * this.weights.imports;
  }

  // Documentation matching
  score += this.calculateCoverage(metadata.tags.join(' '), queryTags) * this.weights.documentation;

  // Apply penalties
  score = this.applyPenalties(score, metadata);

  return score;
}
```

### ResultBuilder Service

**Purpose**: Formats search results into LLM-optimized Markdown responses.

**Interface**:
```typescript
class ResultBuilder {
  constructor(private config: ResultConfig) {}

  buildResponse(results: ScoredResult[], query: SearchQuery): SearchResponse
  formatAsMarkdown(results: ScoredResult[]): string
  formatAsCompact(results: ScoredResult[]): string
}
```

**Result Formatting**:
```typescript
interface SearchResponse {
  total_files: number;
  execution_time: number;
  results: number;
  content: string; // Formatted Markdown
}

// Markdown Format Example:
/*
# Query Results
**Total files:** 15
**Execution time:** 4.23ms
**Results:** 15

### File: src/auth/middleware.py
> Authentication middleware for API protection

## Imports
- built_in: json, time, os
- external: fastapi, jwt, passlib
- internal: .models, .config

## Functions
### async def verify_token(token: str) -> dict:
### def create_access_token(user_id: str) -> str:
*/
```

## Search Pipeline

### 1. Tag Expansion
```typescript
function expandTags(tags: string[]): string[] {
  const expanded = new Set<string>();

  for (const tag of tags) {
    expanded.add(tag);
    expanded.add(tag.toLowerCase());
    expanded.add(tag.toUpperCase());
    // Add common variations
    if (tag.includes('_')) {
      expanded.add(tag.replace(/_/g, '-'));
      expanded.add(tag.replace(/_/g, ''));
    }
  }

  return Array.from(expanded);
}
```

### 2. FTS5 Candidate Retrieval
```sql
-- FTS5 query for tag matching
SELECT * FROM files_fts
WHERE filename MATCH 'user OR auth OR login'
   OR path MATCH 'user OR auth OR login'
   OR definitions MATCH 'user OR auth OR login'
   OR imports MATCH 'user OR auth OR login'
   OR docstrings MATCH 'user OR auth OR login'
ORDER BY rank
LIMIT 50; -- 2x requested limit for better scoring
```

### 3. Relevance Scoring
- Calculate weighted scores for each candidate
- Apply test file penalties (0.1x if not searching for tests)
- Sort by score descending
- Return top N results

### 4. Result Formatting
- Generate structured Markdown
- Categorize imports by type
- Include function signatures and decorators
- Provide file summaries for LLM context

## Business Rules

### Query Validation Rules
1. **Tag Limits**: Accept 1-5 tags maximum for performance
2. **Tag Filtering**: Remove empty or whitespace-only tags
3. **Case Insensitivity**: All matching is case-insensitive
4. **Expansion**: Query tags are expanded for broader matching

### Scoring Rules
1. **Weighted Scoring**: Different metadata sources have different weights
2. **Coverage Scoring**: Partial matches receive proportional scores
3. **Test File Penalty**: Non-test searches penalize test files by 90%
4. **Zero Score Filtering**: Results with zero score are excluded

### Result Rules
1. **Score-Based Sorting**: Results sorted by relevance score descending
2. **Limit Enforcement**: Return only requested number of top results
3. **Metadata Preservation**: Include all relevant metadata in results
4. **Performance Tracking**: Include execution time in response

## Performance Optimizations

### Query Performance Targets
- Simple queries: <30ms execution time
- Complex queries: <100ms execution time
- Memory usage: Minimal additional memory beyond result set
- Concurrent queries: Support multiple simultaneous searches

### Optimization Strategies
- FTS5 for fast full-text search
- Candidate over-retrieval for better scoring accuracy
- Lazy loading of metadata fields
- Connection pooling for database access
- Query result caching (5-minute TTL)

### Caching Strategy
```typescript
class QueryCache {
  private cache = new Map<string, CachedResult>();

  get(cacheKey: string): CachedResult | null
  set(cacheKey: string, result: SearchResponse): void
  invalidate(pattern: string): void
}

interface CachedResult {
  result: SearchResponse;
  timestamp: number;
  ttl: number;
}
```

## Error Handling

### Query Validation Errors
- Empty tag list: Return empty results with warning
- Too many tags: Reject with error message
- Invalid tag format: Filter out invalid tags and log

### Database Errors
- Connection failures: Retry with exponential backoff (3 attempts)
- Query timeouts: Return partial results with warning
- Data corruption: Log error and skip corrupted records

### Scoring Errors
- Invalid metadata: Skip problematic files with warning
- Missing fields: Use default values or skip scoring
- Calculation errors: Log and assign zero score

## Event System

### QueryExecutedEvent
```typescript
interface QueryExecutedEvent extends BaseEvent {
  type: 'query-executed';
  tags: string[];
  filters: SearchFilters;
  resultCount: number;
  executionTime: number;
  cacheHit: boolean;
}
```

### ResultsGeneratedEvent
```typescript
interface ResultsGeneratedEvent extends BaseEvent {
  type: 'results-generated';
  queryId: string;
  totalCandidates: number;
  finalResults: number;
  averageScore: number;
}
```

## Integration Points

### Storage Integration
- Uses FileRepository for metadata queries
- Executes FTS5 search queries
- Handles database connections and transactions

### Configuration Integration
- Respects search limits and performance settings
- Adapts scoring weights based on configuration
- Supports different output format preferences

### MCP Integration
- Provides search tool implementation
- Formats results for LLM consumption
- Handles tool input validation and error responses

## Testing Strategy

### Unit Tests
- Scoring algorithm validation with various metadata
- Tag expansion and normalization testing
- Result formatting accuracy
- Cache behavior testing

### Integration Tests
- End-to-end search pipeline testing
- Database query performance validation
- Concurrent search handling
- MCP tool integration testing

### Performance Tests
- Query latency under different loads
- Memory usage during large result sets
- Database query optimization validation
- Cache effectiveness measurement

### Scoring Tests
- Validate scoring accuracy against known test cases
- Test penalty application for test files
- Verify weight adjustments affect ranking
- Test edge cases (empty results, single matches)</content>
<parameter name="filePath">docsV2/querying-spec.md
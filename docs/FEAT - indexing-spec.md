# Indexing Feature Specification

## Overview

The Indexing feature handles repository scanning, file processing, and metadata extraction to build a searchable code index. It coordinates parsing, change detection, and storage operations.

## Architecture

### Structure
```
features/indexing/
├── services/
│   ├── IndexerService.ts       # Main indexing orchestration
│   ├── RepositoryScanner.ts    # File discovery and filtering
│   └── MetadataExtractor.ts    # Parse result processing
├── models/
│   ├── FileMetadata.ts         # Primary data model
│   ├── RepositoryInfo.ts       # Repository statistics
│   └── DefinitionTypes.ts      # Type definitions
├── events/
│   ├── IndexingStartedEvent.ts
│   ├── IndexingCompletedEvent.ts
│   └── FileIndexedEvent.ts
├── utils/
│   ├── hashing.ts              # SHA256 change detection
│   ├── moduleResolution.ts     # Import resolution utilities
│   └── statistics.ts           # Repository statistics
├── types/
│   └── IndexingTypes.ts        # TypeScript type definitions
└── index.ts                    # Public API exports
```

## Core Components

### IndexerService

**Purpose**: Main service that orchestrates the complete indexing process.

**Interface**:
```typescript
class IndexerService {
  constructor(
    private scanner: RepositoryScanner,
    private parser: ParserManager,
    private storage: StorageService,
    private eventBus: EventBus
  ) {}

  async indexRepository(path: string, options?: IndexOptions): Promise<RepositoryInfo>
  async indexFile(filePath: string): Promise<FileMetadata>
  async handleFileChange(change: FileChange): Promise<void>
  async getStatistics(): Promise<RepositoryStats>
}
```

**Responsibilities**:
- Coordinate full repository indexing
- Handle incremental updates from file changes
- Manage concurrent file processing
- Publish indexing progress events
- Provide indexing statistics and status

**IndexOptions**:
```typescript
interface IndexOptions {
  force?: boolean;        // Force full reindex
  maxWorkers?: number;    // Concurrent workers (default: 4)
  batchSize?: number;     // Files per batch (default: 100)
  includePatterns?: string[];
  excludePatterns?: string[];
}
```

### RepositoryScanner

**Purpose**: Discovers and filters files in the repository.

**Interface**:
```typescript
class RepositoryScanner {
  constructor(private config: ScanConfig) {}

  async scanRepository(rootPath: string): Promise<FileInfo[]>
  async scanDirectory(dirPath: string): Promise<FileInfo[]>
  shouldIncludeFile(filePath: string): boolean
  getRepositoryRoot(startPath: string): Promise<string>
}
```

**Responsibilities**:
- Recursive directory traversal
- File filtering based on patterns
- Repository root detection
- File metadata collection (size, modified time)

**ScanConfig**:
```typescript
interface ScanConfig {
  includeExtensions: string[];
  excludePatterns: string[];
  maxFileSize: number;
  maxDepth?: number;
}
```

### MetadataExtractor

**Purpose**: Processes parsing results and builds structured metadata.

**Interface**:
```typescript
class MetadataExtractor {
  constructor(private parser: ParserManager) {}

  async extractMetadata(filePath: string, content: string): Promise<FileMetadata>
  generateTags(metadata: FileMetadata): string[]
  validateMetadata(metadata: FileMetadata): ValidationResult
}
```

**Responsibilities**:
- Coordinate file parsing
- Build complete FileMetadata structure
- Generate search tags from metadata
- Validate extracted metadata

## Data Models

### FileMetadata
```typescript
interface FileMetadata {
  id: string;                    // UUID or hash-based ID
  path: string;                  // Relative repository path
  filename: string;              // File name with extension
  extension: string;             // File extension
  size: number;                  // File size in bytes
  lastModified: number;          // Modification timestamp
  hash: string;                  // SHA256 content hash
  language: string;              // Detected language
  definitions: Definition[];     // Extracted definitions
  imports: ImportMetadata[];     // Import statements
  symbols: SymbolMetadata[];     // Top-level symbols
  tags: string[];                // Generated search tags
  indexedAt: number;             // Indexing timestamp
}
```

### RepositoryInfo
```typescript
interface RepositoryInfo {
  path: string;                  // Repository root path
  totalFiles: number;            // Total indexed files
  languages: Record<string, number>; // Language distribution
  indexingDuration: number;      // Indexing time in ms
  indexedAt: number;             // Completion timestamp
  errors: IndexingError[];       // Any errors encountered
}
```

### Definition Types
```typescript
interface Definition {
  name: string;
  type: 'class' | 'function' | 'component' | 'variable' | 'type';
  line: number;
  column: number;
  exported: boolean;
  docstring?: string;
  decorators?: string[];
  signature?: string;
}

interface ImportMetadata {
  module: string;
  type: 'local' | 'external' | 'builtin';
  imports: string[];
  alias?: string;
  isDynamic: boolean;
  line: number;
}

interface SymbolMetadata {
  name: string;
  type: 'variable' | 'constant' | 'enum';
  line: number;
  exported: boolean;
}
```

## Tag Derivation System

### Tag Sources and Weights
```typescript
const TAG_WEIGHTS = {
  filename: 5.0,        // Highest specificity
  path: 3.0,            // Directory context
  definitions: 3.0,     // Core code elements
  imports: 2.0,         // Dependencies
  symbols: 2.0,         // Local symbols
  documentation: 1.0    // Comments/docstrings
};
```

### Tag Generation Process
1. **Filename Tags**: Split camelCase, PascalCase, snake_case
2. **Path Tags**: Extract directory names
3. **Definition Tags**: Class, function, component names
4. **Import Tags**: Module names and imported symbols
5. **Symbol Tags**: Variable and constant names
6. **Documentation Tags**: Tokenized comments and docstrings

### Processing Rules
```typescript
function processTags(rawTags: string[]): string[] {
  return rawTags
    .map(tag => tag.toLowerCase())
    .filter(tag => tag.length >= 3)
    .filter(tag => !COMMON_WORDS.has(tag))
    .filter(tag => /^[a-zA-Z0-9]+$/.test(tag)) // Alphanumeric only
    .filter((tag, index, arr) => arr.indexOf(tag) === index); // Deduplicate
}
```

## Change Detection

### SHA256 Hashing
```typescript
// hashing.ts
export function calculateFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function hasFileChanged(filePath: string, storedHash: string): Promise<boolean> {
  const content = await fs.readFile(filePath, 'utf8');
  const currentHash = calculateFileHash(content);
  return currentHash !== storedHash;
}
```

### Incremental Updates
- Compare file hashes before reprocessing
- Only reindex changed files
- Update timestamps and metadata
- Maintain indexing performance

## Business Rules

### File Processing Rules
1. **Change Detection**: Use SHA256 hashes to detect modifications
2. **Size Limits**: Skip files exceeding 10MB (configurable)
3. **Ignore Patterns**: Respect .gitignore and configured patterns
4. **Concurrent Processing**: Limit to 4 workers to prevent resource exhaustion

### Metadata Rules
1. **Completeness**: Extract all available metadata for each file
2. **Consistency**: Use consistent naming and structure
3. **Validation**: Validate metadata against type definitions
4. **Tag Generation**: Generate comprehensive search tags

### Indexing Rules
1. **Atomic Operations**: Ensure database consistency
2. **Progress Tracking**: Publish events for monitoring
3. **Error Recovery**: Continue processing other files on failures
4. **Resource Management**: Clean up resources after processing

## Event System

### IndexingStartedEvent
```typescript
interface IndexingStartedEvent extends BaseEvent {
  type: 'indexing-started';
  repositoryPath: string;
  options: IndexOptions;
  estimatedFiles: number;
}
```

### IndexingCompletedEvent
```typescript
interface IndexingCompletedEvent extends BaseEvent {
  type: 'indexing-completed';
  repositoryPath: string;
  stats: RepositoryStats;
  duration: number;
  errors: IndexingError[];
}
```

### FileIndexedEvent
```typescript
interface FileIndexedEvent extends BaseEvent {
  type: 'file-indexed';
  filePath: string;
  metadata: FileMetadata;
  processingTime: number;
}
```

## Error Handling

### Indexing Errors
- **File Read Errors**: Log and skip unreadable files
- **Parsing Errors**: Continue with other files
- **Database Errors**: Retry with exponential backoff
- **Resource Errors**: Implement circuit breakers

### Validation
- **Path Validation**: Ensure repository paths exist
- **Permission Checks**: Verify read access to files
- **Size Validation**: Check file size limits
- **Content Validation**: Basic content checks

## Performance Optimizations

### Concurrent Processing
- Worker pool for parallel file processing
- Configurable worker count (default: 4)
- Load balancing across workers

### Memory Management
- Stream large files instead of loading entirely
- Clean up parsed ASTs after processing
- Limit in-memory file cache

### Caching
- Cache module registry for import resolution
- Cache compiled tree-sitter queries
- Cache file system metadata

## Integration Points

### File-Watching Integration
- Subscribe to file change events
- Trigger incremental reindexing
- Handle batch change events

### Storage Integration
- Save metadata to database
- Update search indexes
- Handle transaction management

### Query Integration
- Provide metadata for search operations
- Support real-time index updates
- Handle index consistency

## Testing Strategy

### Unit Tests
- Individual service testing with mocks
- Tag generation validation
- Hash calculation accuracy
- File filtering logic

### Integration Tests
- End-to-end indexing pipeline
- Repository scanning accuracy
- Change detection reliability
- Concurrent processing

### Performance Tests
- Large repository indexing speed
- Memory usage monitoring
- Concurrent worker performance
- Incremental update efficiency</content>
<parameter name="filePath">docsV2/indexing-spec.md
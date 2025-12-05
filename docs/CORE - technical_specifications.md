# Code-Scout MCP Technical Specifications

## Overview

This document provides detailed technical specifications for implementing Code-Scout MCP, a standalone Model Context Protocol (MCP) server for efficient code indexing and tag-based search. It combines the feature-based modular architecture from `proposal_arch.md` with implementation details adapted from existing similar project documentation.

## Architecture Overview

Code-Scout follows a **Feature-Based Modular Architecture** optimized for LLM-assisted development:

```
src/
├── features/                    # Business features (self-contained)
│   ├── file-watching/          # File system monitoring with debouncing
│   ├── parsing/                # Language-specific code parsing
│   ├── indexing/               # Repository indexing and metadata extraction
│   ├── querying/               # Semantic search and retrieval
│   └── storage/                # Database operations and persistence
├── shared/                     # Common utilities and types
│   ├── types/                  # Shared TypeScript interfaces
│   ├── utils/                  # Utility functions
│   ├── constants/              # Application constants
│   └── events/                 # Event system utilities
├── config/                     # Configuration management
├── api/                        # External interfaces (MCP)
└── app.ts                      # Application entry point
```

### Core Principles

1. **LLM-First Design**: Simple, explicit, modular structure optimized for AI coding agents
2. **Feature Isolation**: Each feature is self-contained with clear boundaries
3. **Predictable Patterns**: Consistent structure across all features
4. **Incremental Development**: Features can be built and tested independently
5. **Minimal Cognitive Load**: Small, focused files with single responsibilities

## Feature Specifications

### 1. File-Watching Feature

**Purpose**: Monitor file system changes with intelligent debouncing

**Structure**:
```
features/file-watching/
├── services/
│   ├── FileWatcher.ts          # Main file system monitoring
│   ├── Debouncer.ts            # Individual file debouncing
│   └── BatchProcessor.ts       # Multi-file batch processing
├── events/
│   ├── FileChangedEvent.ts     # Single file change events
│   └── BatchChangeEvent.ts     # Batch file change events
├── utils/
│   └── pathUtils.ts            # File path utilities
└── index.ts
```

**Key Components**:

- **FileWatcher**: Uses `chokidar` for file system monitoring
- **Debouncer**: Prevents rapid-fire events for individual files (300ms)
- **BatchProcessor**: Groups multiple file changes (1 second window)
- **Event Types**: Clear TypeScript interfaces for all events

**Event Flow**:
```
File System → FileWatcher → Debouncer → EventBus → Indexer
                     ↘ BatchProcessor ↗
```

**Business Rules**:
- Debounce individual files for 300ms to prevent rapid updates
- Batch multiple file changes within 1-second windows
- Respect ignore patterns and file size limits
- Publish events for indexing triggers

### 2. Parsing Feature

**Purpose**: Language-agnostic code parsing with unified interface

**Structure**:
```
features/parsing/
├── services/
│   ├── ParserManager.ts        # Parser orchestration
│   └── BaseParser.ts           # Shared parsing logic
├── implementations/
│   ├── JavaScriptParser.ts     # Tree-sitter JS/TS parser
│   ├── TypeScriptParser.ts     # Tree-sitter TS parser
│   └── PythonParser.ts         # Tree-sitter Python parser
├── interfaces/
│   └── ParserInterface.ts      # Parser contract
├── utils/
│   ├── treeSitterUtils.ts      # Tree-sitter helpers
│   └── astUtils.ts             # AST manipulation utilities
└── index.ts
```

**Parser Capabilities**:
- **Tree-sitter Integration**: Robust, error-recovering parsing
- **Multi-language Support**: JavaScript, TypeScript, Python (extensible)
- **Type Definitions**: Extract classes, functions, components, imports
- **Metadata Extraction**: Comments, decorators, docstrings
- **Error Recovery**: Graceful handling of malformed code

**Supported Languages**:
- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)
- Python (.py)

### 3. Indexing Feature

**Purpose**: Repository scanning and metadata extraction

**Structure**:
```
features/indexing/
├── services/
│   ├── IndexerService.ts       # Main indexing orchestration
│   ├── RepositoryScanner.ts    # File discovery and filtering
│   └── MetadataExtractor.ts    # Process parsing results
├── models/
│   ├── FileMetadata.ts         # Primary data model
│   ├── RepositoryInfo.ts       # Repository statistics
│   └── DefinitionTypes.ts      # Type definitions
├── events/
│   ├── IndexingStartedEvent.ts
│   ├── IndexingCompletedEvent.ts
│   └── FileIndexedEvent.ts
├── utils/
│   ├── hashing.ts              # SHA256 file change detection
│   ├── moduleResolution.ts     # Import resolution
│   └── statistics.ts           # Repository statistics
└── index.ts
```

**Indexing Workflow**:
1. **Repository Discovery**: Scan files, detect repository root
2. **File Filtering**: Apply inclusion/exclusion patterns
3. **Change Detection**: SHA256 hash comparison for incremental updates
4. **Parsing**: Language-specific parsing via Parsing feature
5. **Metadata Extraction**: Build structured metadata
6. **Storage**: Persist to database via Storage feature

**Tag Derivation System**:

**Tag Sources (with weights)**:
- Filename (5x weight): Full filename, split camelCase/PascalCase/snake_case
- Path Segments (3x weight): Directory names in file path
- Code Elements (3x weight): Class/function/component names
- Imports (2x weight): Module names and imported symbols
- Local Symbols (2x weight): Top-level variables and constants
- Documentation (1x weight): Tokenized docstrings and comments

**Processing Rules**:
1. Normalize to lowercase
2. Remove tags < 3 characters
3. Remove non-alphanumeric characters
4. Deduplicate tags
5. Filter common programming keywords

### 4. Querying Feature

**Purpose**: Semantic search with weighted relevance scoring

**Structure**:
```
features/querying/
├── services/
│   ├── QueryEngine.ts          # Main query orchestration
│   ├── ScoringAlgorithm.ts     # Weighted relevance scoring
│   └── ResultBuilder.ts        # Search result formatting
├── models/
│   ├── Query.ts                # Query data model
│   ├── SearchResult.ts         # Search result model
│   └── SearchFilters.ts        # Query filtering options
├── events/
│   ├── QueryExecutedEvent.ts
│   └── ResultsGeneratedEvent.ts
├── utils/
│   ├── textMatching.ts         # Text similarity utilities
│   └── relevanceScoring.ts     # Scoring algorithm helpers
└── index.ts
```

**Scoring Algorithm**:
```typescript
const SCORING_WEIGHTS = {
  filename: 5.0,        // Highest specificity
  path: 3.0,            // Contextual location
  classes: 3.0,         // Core code elements
  functions: 3.0,       // Core code elements
  components: 3.0,      // Core code elements
  imports: 2.0,         // Dependencies
  decorators: 2.0,      // Metadata
  symbols: 2.0,         // Metadata
  docstrings: 1.0,      // Documentation
  comments: 1.0,        // Documentation
  derivedTags: 1.0      // Semantic tags
};
```

**Search Pipeline**:
1. Tag Input (1-5 tags)
2. Tag Expansion for broader matching
3. FTS5 candidate retrieval
4. Relevance scoring application
5. Result ranking and limiting
6. Markdown formatting for LLM consumption

### 5. Storage Feature

**Purpose**: Database abstraction and data persistence

**Structure**:
```
features/storage/
├── services/
│   ├── DatabaseService.ts      # Main database operations
│   ├── FileRepository.ts       # File metadata CRUD
│   └── SearchRepository.ts     # Search query operations
├── models/
│   ├── DatabaseSchema.ts       # Database structure
│   ├── Tables.ts               # Table definitions
│   └── Queries.ts              # SQL query builders
├── migrations/
│   ├── 001_initial_schema.ts
│   └── 002_add_fts_index.ts
├── utils/
│   ├── connectionPool.ts       # Database connection management
│   └── queryBuilder.ts         # SQL query utilities
└── index.ts
```

**Database Design**:
- SQLite with FTS5 extension for full-text search
- Connection pooling for performance
- Schema migrations for version control
- Project-local database isolation

## Data Models

### Core Interfaces

```typescript
export interface FileMetadata {
  id: string;                    // Unique identifier
  path: string;                  // Relative file path
  filename: string;              // File name with extension
  extension: string;             // File extension
  size: number;                  // File size in bytes
  lastModified: number;          // Modification timestamp
  hash: string;                  // SHA256 content hash
  language: string;              // Detected programming language
  definitions: Definition[];     // Code definitions
  imports: ImportMetadata[];     // Import statements
  indexedAt: number;             // Indexing timestamp
}

export interface Definition {
  name: string;                  // Symbol name
  type: 'class' | 'function' | 'component' | 'variable' | 'type';
  line: number;                  // Line number
  column: number;                // Column position
  exported: boolean;             // Export visibility
  docstring?: string;            // Documentation
  decorators?: string[];         // Decorators/metadata
  signature?: string;            // Function signature
}

export interface ImportMetadata {
  module: string;                // Module name/path
  type: 'local' | 'external' | 'builtin';  // Import classification
  imports: string[];             // Imported symbols
  alias?: string;                // Import alias
  isDynamic: boolean;            // Dynamic import flag
}
```

### Database Schema

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
  FOREIGN KEY (fileId) REFERENCES files(id)
);

CREATE VIRTUAL TABLE files_fts USING fts5(
  filename,
  path,
  content,
  definitions,
  imports,
  docstrings,
  content='files',
  content_rowid='rowid'
);
```

## API Contracts

### MCP Tools

**code-scout_search**
```typescript
interface SearchTool {
  name: "code-scout_search";
  description: "Search code using LLM-generated tags with relevance scoring";
  inputSchema: {
    type: "object";
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Array of search tags (1-5 tags) generated by LLM based on task context"
      };
      limit: { type: "number", default: 20, description: "Maximum results" };
      filters: {
        type: "object",
        properties: {
          language: { type: "string", description: "Filter by language" },
          fileType: { type: "string", description: "Filter by file type" },
          path: { type: "string", description: "Filter by path pattern" }
        }
      }
    };
    required: ["tags"];
  };
}
```

**code-scout_index**
```typescript
interface IndexTool {
  name: "code-scout_index";
  description: "Initialize or update code index for current directory";
  inputSchema: {
    type: "object";
    properties: {
      path: { type: "string", description: "Directory path to index (optional, defaults to current)" };
      force: { type: "boolean", default: false, description: "Force full reindex" };
      background: { type: "boolean", default: true, description: "Run indexing in background" };
    };
  };
}
```

**code-scout_status**
```typescript
interface StatusTool {
  name: "code-scout_status";
  description: "Get indexing status and database information";
  inputSchema: {
    type: "object";
    properties: {
      path: { type: "string", description: "Project path (optional, defaults to current)" };
    };
  };
}
```

### Response Formats

**Search Results**
```typescript
interface SearchResponse {
  total_files: number;
  execution_time: number;
  results: number;
  content: string; // Formatted Markdown response
}
```

## Configuration Schema

```typescript
interface AppConfig {
  indexing: {
    maxFileSize: number;        // 10MB default
    maxWorkers: number;         // 4 default
    batchSize: number;          // 100 default
    debounceMs: number;         // 300ms default
    batchWindowMs: number;      // 1000ms default
  };
  search: {
    defaultLimit: number;       // 20 default
    maxLimit: number;           // 100 default
    scoringWeights: {
      filename: number;         // 5.0
      path: number;             // 3.0
      definitions: number;      // 3.0
      imports: number;          // 2.0
      documentation: number;    // 1.0
    };
  };
  database: {
    path: string;               // "./code-scout.db"
    maxConnections: number;     // 10 default
  };
  watching: {
    enabled: boolean;           // true default
    ignorePatterns: string[];   // Default ignore patterns
  };
  languages: {
    javascript: LanguageConfig;
    typescript: LanguageConfig;
    python: LanguageConfig;
  };
}

interface LanguageConfig {
  extensions: string[];
  parser: string;
  features: string[];
}
```

## Error Handling Patterns

### Error Types
- **ValidationError**: Invalid input parameters
- **ParsingError**: File parsing failures
- **DatabaseError**: Database operation failures
- **FileSystemError**: File system access issues
- **ConfigurationError**: Invalid configuration

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    type: string;
    message: string;
    details?: any;
    timestamp: number;
  };
}
```

### Recovery Strategies
- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Continue processing other files on individual failures
- **Fallback Values**: Use defaults for missing optional configuration
- **Logging**: Comprehensive error logging with context

## Testing Strategy

### Unit Testing
- Service layer testing with mocked dependencies
- Utility function testing
- Data model validation testing
- Configuration parsing testing

### Integration Testing
- End-to-end indexing pipeline
- Search functionality with real database
- MCP protocol compliance
- File watching integration

### Performance Testing
- Query response time benchmarks
- Memory usage during indexing
- Concurrent operation handling
- Large repository scalability

## Gaps and Missing Information

### Implementation Details Needed
1. **Tree-sitter Grammar Versions**: Specific versions for each language parser
2. **FTS5 Query Optimization**: Detailed query patterns and indexing strategies
3. **Memory Management**: Specific limits and cleanup strategies for large files
4. **Event Bus Implementation**: Choice between EventEmitter, RxJS, or custom implementation
5. **Migration Scripts**: Database schema migration logic and rollback procedures

### Configuration Questions
1. **Default Ignore Patterns**: Comprehensive list of files/directories to ignore
2. **Performance Tuning**: Optimal values for batch sizes, timeouts, and limits
3. **Security Policies**: File access restrictions and sandboxing requirements

### Integration Points
1. **MCP Protocol Version**: Specific MCP specification version to target
2. **Claude Code Compatibility**: Version compatibility and integration testing
3. **VSCode Extension**: Requirements for VSCode MCP extension support

### Development Workflow
1. **Build System**: Choice between esbuild, webpack, or tsc for compilation
2. **Package Structure**: NPM package configuration and publishing strategy
3. **CLI Interface**: Command-line interface design for manual operations

Please review this initial technical specification and let me know which gaps need to be addressed first.</content>
<parameter name="filePath">docsV2/technical_specifications.md
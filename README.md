# Code Scout MCP Server

A Model Context Protocol (MCP) server that provides intelligent code indexing and tag-based search capabilities for LLM coding agents.

## 🚀 Features

- **Smart Code Indexing**: Fast indexing of TypeScript, JavaScript, and Python codebases with comprehensive metadata extraction
- **Tag-Based Search**: Intuitive search without complex vectorization or intent analysis - your LLM agent knows exactly what to look for
- **Real-Time File Watching**: Continuous monitoring and automatic updates as your codebase evolves
- **MCP Protocol Compliant**: Full compatibility with Model Context Protocol standards for seamless integration
- **Performance Optimized**: Built for speed and efficiency with local-only processing
- **Privacy First**: Runs entirely locally without external APIs, subscriptions, or data transmission
- **Context-Rich Summaries**: Delivers structured metadata including imports, exports, functions, components, classes, and top-level symbols - no raw code noise

## 🎯 Why Code Scout?

When LLM agents need to refactor, debug, or understand complex codebases, they typically perform extensive tool calls and repository traversals. Code Scout eliminates this overhead by providing:

- **Clean Context**: Structured metadata without code noise, enabling agents to quickly identify patterns and relationships
- **Duplicate Detection**: Easy identification of repeated methods, functions, and patterns across the codebase
- **Efficient Exploration**: Reduced tool usage and faster decision-making for coding tasks
- **Focused Understanding**: High-level overviews that help agents grasp codebase architecture without getting lost in implementation details

## 🚧 Development Status

This project is currently under active development. We're working towards a complete MVP with all core features implemented.

## 🗺️ Development Roadmap

### 📊 Overall Progress: 50% Complete

The project is structured in 8 phases, with Phase 1 (Infrastructure), Phase 2 (Data Layer), Phase 3 (Logging), and Phase 4 (Core Error Handling) fully completed.

### Phase 1: Project Setup and Infrastructure (Priority: Critical)

✅ 1.1 Initialize project structure and package.json

✅ 1.2 Configure TypeScript and build system with esbuild

✅ 1.3 Setup testing framework with Jest and CI/CD pipeline

✅ 1.4 Implement configuration management system

✅ 1.5 Setup code quality tools (ESLint, Prettier)

### Phase 2: Core Data Layer (Priority: Critical)

✅ 2.1 Implement database service with SQLite and better-sqlite3

✅ 2.2 Create database schema and migration system

✅ 2.3 Build file repository for CRUD operations

✅ 2.4 Implement search repository with FTS5 integration

✅ 2.5 Add connection pooling and performance optimizations

### Phase 3: Logging Framework (Priority: Critical)

✅ 3.1 Setup Pino logging infrastructure and configuration

✅ 3.2 Implement Logger class with structured logging and child loggers

✅ 3.3 Create LogManager for global access and dynamic configuration

✅ 3.4 Integrate with configuration management and environment variables

✅ 3.5 Add performance monitoring and error handling integration

✅ 3.6 Implement migration from console.log statements

✅ 3.7 Add testing integration and production deployment configuration

### Phase 4: Core Error Handling Infrastructure (Priority: Critical)

✅ 4.1 Implement core error types (ValidationError, ParsingError, FileSystemError, etc.)

✅ 4.2 Create retry logic infrastructure with exponential backoff

✅ 4.3 Build timeout management system for operations

✅ 4.4 Implement circuit breaker pattern for service protection

✅ 4.5 Create standardized error patterns with BaseService

✅ 4.6 Add error aggregation and monitoring capabilities

✅ 4.7 Implement graceful degradation manager

### Phase 5: Error Handling Integration (Priority: Critical)

🔄 5.1 Create error constants centralization and configuration

🔄 5.2 Refactor ConfigurationError to extend ServiceError

🔄 5.3 Refactor DatabaseError to extend ServiceError

🔄 5.4 Enhance ErrorFactory integration with legacy errors

🔄 5.5 Update service integration points with new error patterns

🔄 5.6 Create migration utilities for backward compatibility

🔄 5.7 Update configuration management with error handling

🔄 5.8 Add comprehensive testing strategy for error handling

### Phase 6: Language Parsing System (Priority: Critical)

6.1 Setup tree-sitter infrastructure and language parsers

6.2 Implement ParserManager for language detection and routing

6.3 Develop TypeScript/JavaScript parser with unified handling

6.4 Implement Python parser with tree-sitter-python

6.5 Create metadata extraction and validation system

### Phase 7: Repository Indexing (Priority: Critical)

7.1 Build RepositoryScanner for file discovery and filtering

7.2 Implement IndexerService for orchestration

7.3 Create change detection with SHA256 hashing

7.4 Implement tag derivation system with weighted scoring

7.5 Add concurrent processing and performance optimizations

### Phase 8: Query Engine and Search (Priority: High)

8.1 Implement QueryEngine for search orchestration

8.2 Create relevance scoring algorithm with weighted system

8.3 Build ResultBuilder for LLM-optimized formatting

8.4 Implement tag expansion and query optimization

8.5 Add query caching and performance monitoring

### Phase 9: File Watching System (Priority: High)

9.1 Implement FileWatcher with chokidar integration

9.2 Create Debouncer for individual file change handling

9.3 Build BatchProcessor for multi-file change aggregation

9.4 Add event system and integration with indexing

9.5 Implement ignore patterns and file filtering

### Phase 10: MCP Protocol Integration (Priority: Critical)

10.1 Setup MCP server with JSON-RPC 2.0 over stdio

10.2 Implement code-scout_search tool with validation

10.3 Create code-scout_index tool with background support

10.4 Add code-scout_status tool for monitoring

10.5 Implement error handling and response formatting

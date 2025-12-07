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

### 📊 Overall Progress: 40% Complete

The project is structured in 7 phases, with Phase 1 (Infrastructure) and Phase 2 (Data Layer) fully completed.

### Phase 1: Project Setup and Infrastructure (Priority: Critical)

[x] 1.1 Initialize project structure and package.json [Complexity: Low]
[x] 1.2 Configure TypeScript and build system with esbuild [Complexity: Low] → Depends: 1.1
[x] 1.3 Setup testing framework with Jest and CI/CD pipeline [Complexity: Medium] → Depends: 1.1
[x] 1.4 Implement configuration management system [Complexity: Medium] → Depends: 1.1
[x] 1.5 Setup code quality tools (ESLint, Prettier) [Complexity: Low] → Depends: 1.1

### Phase 2: Core Data Layer (Priority: Critical)

[x] 2.1 Implement database service with SQLite and better-sqlite3 [Complexity: High] → Depends: 1.2, 1.4
[x] 2.2 Create database schema and migration system [Complexity: High] → Depends: 2.1
[x] 2.3 Build file repository for CRUD operations [Complexity: Medium] → Depends: 2.2
[x] 2.4 Implement search repository with FTS5 integration [Complexity: High] → Depends: 2.2
[x] 2.5 Add connection pooling and performance optimizations [Complexity: Medium] → Depends: 2.1

### Phase 3: Language Parsing System (Priority: Critical)

[ ] 3.1 Setup tree-sitter infrastructure and language parsers [Complexity: High] → Depends: 1.2
[ ] 3.2 Implement ParserManager for language detection and routing [Complexity: High] → Depends: 3.1
[ ] 3.3 Develop TypeScript/JavaScript parser with unified handling [Complexity: High] → Depends: 3.2
[ ] 3.4 Implement Python parser with tree-sitter-python [Complexity: High] → Depends: 3.2
[ ] 3.5 Create metadata extraction and validation system [Complexity: Medium] → Depends: 3.3, 3.4

### Phase 4: Repository Indexing (Priority: Critical)

[ ] 4.1 Build RepositoryScanner for file discovery and filtering [Complexity: Medium] → Depends: 2.3
[ ] 4.2 Implement IndexerService for orchestration [Complexity: High] → Depends: 3.5, 4.1
[ ] 4.3 Create change detection with SHA256 hashing [Complexity: Medium] → Depends: 4.2
[ ] 4.4 Implement tag derivation system with weighted scoring [Complexity: High] → Depends: 4.2
[ ] 4.5 Add concurrent processing and performance optimizations [Complexity: Medium] → Depends: 4.2

### Phase 5: Query Engine and Search (Priority: High)

[ ] 5.1 Implement QueryEngine for search orchestration [Complexity: High] → Depends: 2.4, 4.4
[ ] 5.2 Create relevance scoring algorithm with weighted system [Complexity: High] → Depends: 5.1
[ ] 5.3 Build ResultBuilder for LLM-optimized formatting [Complexity: Medium] → Depends: 5.1
[ ] 5.4 Implement tag expansion and query optimization [Complexity: Medium] → Depends: 5.2
[ ] 5.5 Add query caching and performance monitoring [Complexity: Medium] → Depends: 5.1

### Phase 6: File Watching System (Priority: High)

[ ] 6.1 Implement FileWatcher with chokidar integration [Complexity: Medium] → Depends: 4.3
[ ] 6.2 Create Debouncer for individual file change handling [Complexity: Medium] → Depends: 6.1
[ ] 6.3 Build BatchProcessor for multi-file change aggregation [Complexity: Medium] → Depends: 6.2
[ ] 6.4 Add event system and integration with indexing [Complexity: Medium] → Depends: 6.3, 4.2
[ ] 6.5 Implement ignore patterns and file filtering [Complexity: Low] → Depends: 6.1

### Phase 7: MCP Protocol Integration (Priority: Critical)

[ ] 7.1 Setup MCP server with JSON-RPC 2.0 over stdio [Complexity: High] → Depends: 5.3
[ ] 7.2 Implement code-scout_search tool with validation [Complexity: High] → Depends: 7.1
[ ] 7.3 Create code-scout_index tool with background support [Complexity: High] → Depends: 7.1, 4.2
[ ] 7.4 Add code-scout_status tool for monitoring [Complexity: Medium] → Depends: 7.1, 4.2
[ ] 7.5 Implement error handling and response formatting [Complexity: Medium] → Depends: 7.2

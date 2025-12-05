# Task 1.1: Initialize Project Structure and package.json

## Overview
Create the foundational project structure and package.json configuration for the Code-Scout MCP server, establishing the complete development environment with all necessary dependencies and directory layout.

## Requirements from Documentation

### Technology Stack Requirements (from CORE - technology_stack.md)
- **Node.js 18+**: Runtime environment requirement
- **TypeScript 5.0+**: Latest stable version for type safety
- **Package Name**: `@code-scout/mcp-server`
- **Version**: `0.1.0`
- **Description**: "Code indexing and semantic search MCP server"

### Core Dependencies
```json
{
  "better-sqlite3": "^8.7.0",           // Synchronous SQLite wrapper
  "tree-sitter": "^0.22.0",             // Core parsing engine
  "tree-sitter-typescript": "^0.21.0",  // TypeScript/JavaScript parser
  "tree-sitter-python": "^0.21.0",      // Python parser
  "chokidar": "^3.5.0"                  // File system monitoring
}
```

### Development Dependencies
```json
{
  "typescript": "^5.0.0",               // TypeScript compiler
  "esbuild": "^0.19.0",                 // Fast build system
  "jest": "^29.0.0",                    // Testing framework
  "eslint": "^8.0.0",                   // Code linting
  "prettier": "^3.0.0",                 // Code formatting
  "@typescript-eslint/eslint-plugin": "^6.0.0",
  "@typescript-eslint/parser": "^6.0.0",
  "nodemon": "^3.0.0",                  // Auto-restart for development
  "tsx": "^4.0.0",                      // TypeScript execution
  "rimraf": "^5.0.0"                    // Cross-platform rm -rf
}
```

### Directory Structure Requirements (from CORE - technical_specifications.md)
```
code-scout-mcp/
├── src/
│   ├── features/                    # Business features (self-contained)
│   │   ├── file-watching/          # File system monitoring
│   │   ├── parsing/                # Language-specific code parsing
│   │   ├── indexing/               # Repository indexing
│   │   ├── querying/               # Semantic search
│   │   └── storage/                # Database operations
│   ├── shared/                     # Common utilities and types
│   │   ├── types/                  # Shared TypeScript interfaces
│   │   ├── utils/                  # Utility functions
│   │   ├── constants/              # Application constants
│   │   └── events/                 # Event system utilities
│   ├── config/                     # Configuration management
│   ├── api/                        # External interfaces (MCP)
│   ├── index.ts                    # Application entry point
│   └── cli.ts                      # CLI entry point
├── dist/                           # Built output
├── tests/                          # Test files
├── docs/                           # Documentation (already exists)
├── tasks/                          # Task definitions (already exists)
├── package.json                    # Package configuration
├── tsconfig.json                   # TypeScript configuration
├── esbuild.config.js               # Build configuration
├── jest.config.js                  # Test configuration
├── eslint.config.js                # Linting configuration
├── .prettierrc                     # Formatting configuration
└── .gitignore                      # Git ignore rules (already exists)
```

### Package.json Scripts Requirements
```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --target=node18 --outfile=dist/index.js --minify",
    "dev": "nodemon --exec tsx src/index.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist",
    "prebuild": "npm run clean",
    "postbuild": "cp package.json dist/"
  }
}
```

## Implementation Checklist

### 1.1.1 Create Package Configuration
- [ ] Create `package.json` with complete metadata and dependencies
- [ ] Set package name to `@code-scout/mcp-server`
- [ ] Configure main entry point as `dist/index.js`
- [ ] Add CLI binary configuration for `code-scout-mcp`
- [ ] Include all core and development dependencies with exact versions
- [ ] Add comprehensive npm scripts for development workflow
- [ ] Configure engines to require Node.js 18+
- [ ] Add proper keywords and repository information

### 1.1.2 Establish Directory Structure
- [ ] Create `src/` root directory
- [ ] Create `src/features/` with subdirectories for each feature:
  - [ ] `src/features/file-watching/`
  - [ ] `src/features/parsing/`
  - [ ] `src/features/indexing/`
  - [ ] `src/features/querying/`
  - [ ] `src/features/storage/`
- [ ] Create `src/shared/` with subdirectories:
  - [ ] `src/shared/types/`
  - [ ] `src/shared/utils/`
  - [ ] `src/shared/constants/`
  - [ ] `src/shared/events/`
- [ ] Create `src/config/` directory
- [ ] Create `src/api/` directory
- [ ] Create `tests/` directory
- [ ] Create `dist/` directory (will be populated by build)

### 1.1.3 Create Entry Point Files
- [ ] Create `src/index.ts` as main application entry point
- [ ] Create `src/cli.ts` as CLI entry point
- [ ] Add basic module exports for each feature directory
- [ ] Create placeholder index files in each feature directory

### 1.1.4 Setup Basic Configuration Files
- [ ] Create placeholder `tsconfig.json` (will be configured in task 1.2)
- [ ] Create placeholder `esbuild.config.js` (will be configured in task 1.2)
- [ ] Create placeholder `jest.config.js` (will be configured in task 1.3)
- [ ] Create placeholder `eslint.config.js` (will be configured in task 1.5)
- [ ] Create placeholder `.prettierrc` (will be configured in task 1.5)

### 1.1.5 Initialize Development Environment
- [ ] Run `npm install` to install all dependencies
- [ ] Verify package.json structure is valid
- [ ] Test basic TypeScript compilation with `npm run typecheck`
- [ ] Verify build script runs without errors (even with empty files)
- [ ] Test CLI binary configuration

## Code Templates

### package.json Template
```json
{
  "name": "@code-scout/mcp-server",
  "version": "0.1.0",
  "description": "Code indexing and semantic search MCP server",
  "main": "dist/index.js",
  "bin": {
    "code-scout-mcp": "dist/cli.js"
  },
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --target=node18 --outfile=dist/index.js --minify",
    "dev": "nodemon --exec tsx src/index.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist",
    "prebuild": "npm run clean",
    "postbuild": "cp package.json dist/"
  },
  "keywords": [
    "mcp",
    "code-search",
    "indexing",
    "semantic-search",
    "typescript",
    "python",
    "javascript"
  ],
  "author": "Code-Scout Team",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "better-sqlite3": "^8.7.0",
    "tree-sitter": "^0.22.0",
    "tree-sitter-typescript": "^0.21.0",
    "tree-sitter-python": "^0.21.0",
    "chokidar": "^3.5.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "esbuild": "^0.19.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "nodemon": "^3.0.0",
    "tsx": "^4.0.0",
    "rimraf": "^5.0.0",
    "@types/jest": "^29.0.0",
    "@types/node": "^18.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

### src/index.ts Template
```typescript
/**
 * Code-Scout MCP Server
 * Main application entry point
 */

export class CodeScoutServer {
  constructor() {
    // Server initialization will be implemented in subsequent tasks
  }

  async start(): Promise<void> {
    console.log('Code-Scout MCP Server starting...');
    // Implementation will follow in subsequent tasks
  }

  async stop(): Promise<void> {
    console.log('Code-Scout MCP Server stopping...');
    // Implementation will follow in subsequent tasks
  }
}

// Export for CLI usage
export default CodeScoutServer;
```

### src/cli.ts Template
```typescript
#!/usr/bin/env node

/**
 * Code-Scout MCP CLI
 * Command-line interface entry point
 */

import CodeScoutServer from './index';

async function main(): Promise<void> {
  const server = new CodeScoutServer();
  
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start Code-Scout MCP Server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
```

### Feature Index File Template (for each feature directory)
```typescript
/**
 * Feature: [Feature Name]
 * Placeholder index file - will be implemented in subsequent tasks
 */

// Re-exports will be added as features are implemented
export {};
```

## File Structure After Implementation
```
code-scout-mcp/
├── src/
│   ├── features/
│   │   ├── file-watching/
│   │   │   └── index.ts
│   │   ├── parsing/
│   │   │   └── index.ts
│   │   ├── indexing/
│   │   │   └── index.ts
│   │   ├── querying/
│   │   │   └── index.ts
│   │   └── storage/
│   │       └── index.ts
│   ├── shared/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── constants/
│   │   └── events/
│   ├── config/
│   ├── api/
│   ├── index.ts
│   └── cli.ts
├── dist/                    # Created by build process
├── tests/                   # Created for testing
├── docs/                    # Already exists
├── tasks/                   # Already exists
├── package.json             # New file
├── tsconfig.json            # Placeholder
├── esbuild.config.js        # Placeholder
├── jest.config.js           # Placeholder
├── eslint.config.js         # Placeholder
├── .prettierrc              # Placeholder
└── .gitignore               # Already exists
```

## Integration Points
- **Task 1.2**: TypeScript and build system configuration will complete the setup
- **Task 1.3**: Testing framework will use the established structure
- **Task 1.4**: Configuration management will integrate with the config directory
- **Task 1.5**: Code quality tools will work with the established file structure

## Validation Criteria
- [ ] `npm install` completes successfully without errors
- [ ] `npm run typecheck` runs without TypeScript errors
- [ ] `npm run build` produces output in `dist/` directory
- [ ] `npm run dev` starts the development server
- [ ] CLI binary `code-scout-mcp` is properly configured
- [ ] All directory structure matches specifications exactly
- [ ] Package.json validates against npm standards
- [ ] Node.js version requirement is enforced

## Acceptance Tests
- [ ] Verify package.json structure with `npm ls --json`
- [ ] Test TypeScript compilation with empty files
- [ ] Validate build process creates proper output
- [ ] Check CLI binary configuration with `npm pack`
- [ ] Verify all required directories are created
- [ ] Test npm scripts execute without errors
- [ ] Validate dependency versions are compatible
- [ ] Check Node.js engine requirement enforcement

## Quality Gates
- [ ] Package.json follows npm best practices
- [ ] Directory structure matches technical specifications
- [ ] All dependencies are properly versioned
- [ ] Scripts are comprehensive and functional
- [ ] Entry points are correctly configured
- [ ] CLI binary is properly set up
- [ ] Development environment is fully functional
- [ ] No security warnings in dependency audit

## Prerequisites for Next Tasks
This task must be completed before any subsequent tasks can begin, as it establishes the foundational project structure and development environment that all other tasks depend on.
# Technology Stack Decisions

## Core Dependencies

### Runtime Environment
- **Node.js 18+**: Required for modern TypeScript features and tree-sitter compatibility
- **TypeScript 5.0+**: Latest stable version for type safety and LLM understanding

### Database Layer
- **better-sqlite3**: Synchronous SQLite wrapper for better performance
  - Faster than async wrappers for our use case
  - Simpler API without promises
  - Better memory management
- **SQLite 3.40+**: With FTS5 extension for full-text search

### Parsing Layer
- **tree-sitter**: ^0.22.0 - Core parsing engine
- **tree-sitter-typescript**: ^0.21.0 - Handles JavaScript, TypeScript, JSX, TSX
- **tree-sitter-python**: ^0.21.0 - Python parsing

### File System Monitoring
- **chokidar**: ^3.5.0 - Cross-platform file watching

### Event System
- **Node.js EventEmitter**: Built-in, simple, and sufficient for our needs
  - No need for complex reactive programming
  - Lightweight and performant
  - Easy to understand for LLM agents

## Development Dependencies

### Build System
- **esbuild**: ^0.19.0 - Fast compilation and bundling
  - 10-100x faster than webpack/tsc
  - Native TypeScript support
  - Simple configuration

### Testing Framework
- **Jest**: ^29.0.0 - Comprehensive testing framework
  - Built-in mocking and assertions
  - Good TypeScript support
  - Parallel test execution

### Code Quality
- **ESLint**: ^8.0.0 - Code linting
- **Prettier**: ^3.0.0 - Code formatting
- **@typescript-eslint/eslint-plugin**: TypeScript-specific rules
- **@typescript-eslint/parser**: TypeScript parser for ESLint

### Development Tools
- **nodemon**: ^3.0.0 - Auto-restart during development
- **tsx**: ^4.0.0 - TypeScript execution for development
- **rimraf**: ^5.0.0 - Cross-platform rm -rf

## Package Structure

### package.json Configuration
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
    "typecheck": "tsc --noEmit"
  }
}
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

## Directory Structure

```
code-scout-node/
├── src/
│   ├── features/
│   ├── shared/
│   ├── config/
│   ├── api/
│   └── index.ts
├── dist/                 # Built output
├── docsV2/              # Technical documentation
├── tests/               # Test files
├── package.json
├── tsconfig.json
├── esbuild.config.js
├── jest.config.js
├── eslint.config.js
└── .prettierrc
```

## Implementation Plan

1. **Initialize Project**: Create package.json, tsconfig.json, and basic directory structure
2. **Install Dependencies**: Install all core and development dependencies
3. **Setup Build System**: Configure esbuild for compilation
4. **Setup Testing**: Configure Jest with TypeScript support
5. **Setup Code Quality**: Configure ESLint and Prettier
6. **Create Basic Types**: Implement shared types and interfaces
7. **Implement Storage Layer**: Start with database abstraction
8. **Implement Parsing Layer**: Tree-sitter integration
9. **Implement Core Features**: Build features incrementally
10. **Add MCP Integration**: Implement MCP protocol handlers

## Performance Considerations

- **esbuild**: Fast compilation for development iteration
- **better-sqlite3**: Synchronous operations for better performance
- **Tree-sitter**: Native performance for parsing
- **Jest**: Parallel test execution for fast feedback

## Compatibility

- **Node.js 18+**: Ensures modern JavaScript features
- **TypeScript 5.0+**: Latest type system features
- **Cross-platform**: All dependencies support Windows, macOS, Linux

This technology stack provides the foundation for a performant, maintainable, and LLM-friendly codebase.</content>
<parameter name="filePath">docsV2/technology_stack.md
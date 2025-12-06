# Technology Stack Decisions

## Core Dependencies

### Runtime Environment

- **Node.js 18+**: Required for modern TypeScript features and tree-sitter compatibility
- **TypeScript 5.0+**: Latest stable version for type safety and LLM understanding

### Database Layer

- **better-sqlite3**: ^11.4.0 (WiseLibs) - Synchronous SQLite wrapper for better performance
  - Pure JavaScript with prebuilt binaries (no compilation required)
  - Faster than async wrappers for our use case
  - Simpler API without promises
  - Better memory management
  - Cross-platform compatibility
- **SQLite 3.40+**: With FTS5 extension for full-text search

### Parsing Layer

- **tree-sitter**: ^0.21.1 - Core parsing engine
- **tree-sitter-typescript**: ^0.21.2 - Handles JavaScript, TypeScript, JSX, TSX
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

- **esbuild**: ^0.27.0 - Fast compilation and bundling
  - 10-100x faster than webpack/tsc
  - Native TypeScript support
  - Simple configuration

### Testing Framework

- **Jest**: ^30.2.0 - Comprehensive testing framework
  - Built-in mocking and assertions
  - Good TypeScript support
  - Parallel test execution

### Code Quality

- **ESLint**: ^9.39.1 - Code linting (latest version)
- **Prettier**: ^3.7.1 - Code formatting (latest version)
- **@typescript-eslint/eslint-plugin**: ^8.30.1 - TypeScript-specific rules
- **@typescript-eslint/parser**: ^8.30.1 - TypeScript parser for ESLint
- **@eslint/js**: ^9.39.1 - ESLint JavaScript configuration

### Development Tools

- **nodemon**: ^3.1.11 - Auto-restart during development
- **tsx**: ^4.21.0 - TypeScript execution for development
- **rimraf**: ^6.0.1 - Cross-platform rm -rf
- **ts-jest**: ^29.4.6 - Jest TypeScript preprocessor
- **@types/jest**: ^30.0.0 - Jest type definitions
- **@types/node**: ^18.0.0 - Node.js type definitions

## Package Structure

### package.json Configuration

```json
{
  "name": "@code-scout/mcp-server",
  "version": "0.1.0",
  "description": "Code indexing and semantic search MCP server",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "code-scout-mcp": "dist/cli.js"
  },
  "scripts": {
    "build": "node esbuild.config.js",
    "build:prod": "NODE_ENV=production node esbuild.config.js",
    "build:dev": "NODE_ENV=development node esbuild.config.js",
    "dev": "nodemon --exec tsx src/index.ts",
    "dev:watch": "node esbuild.config.js --watch",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "clean": "rimraf dist",
    "prebuild": "npm run typecheck",
    "postbuild": "node -e \"console.log('✅ Build process completed')\"",
    "size": "npm run build && du -sh dist/*"
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
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "removeComments": false,
    "importHelpers": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/features/*": ["src/features/*"],
      "@/shared/*": ["src/shared/*"],
      "@/config/*": ["src/config/*"],
      "@/api/*": ["src/api/*"]
    },
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "checkJs": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "**/*.test.ts", "**/*.spec.ts"]
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

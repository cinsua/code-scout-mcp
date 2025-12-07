# Task 3.1: Setup Tree-sitter Infrastructure and Language Parsers

## Overview

Implement the foundational tree-sitter infrastructure for language-agnostic code parsing, including parser interfaces, base classes, and language-specific implementations for TypeScript/JavaScript and Python.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Requirements from Documentation

### Technical Specifications (from CORE - technical_specifications.md)

- Use tree-sitter ^0.21.1 for parsing engine
- Support JavaScript (.js, .jsx), TypeScript (.ts, .tsx), Python (.py)
- Extract classes, functions, components, imports, symbols
- Handle syntax errors gracefully with error recovery
- Generate structured metadata for indexing
- Feature-based modular structure in `src/features/parsing/`

### Architecture Requirements (from FEAT - parsing-spec.md)

- ParserManager for orchestration (future task 3.2)
- Language-specific implementations
- Unified ParserInterface contract
- BaseParser abstract class for shared functionality
- Tree-sitter query system for code extraction
- Error handling and recovery mechanisms

### Technology Stack (from CORE - technology_stack.md)

- tree-sitter: ^0.21.1 - Core parsing engine
- tree-sitter-typescript: ^0.21.2 - Handles JavaScript, TypeScript, JSX, TSX
- tree-sitter-python: ^0.21.0 - Python parsing
- TypeScript 5.0+ for type safety
- Node.js 18+ runtime environment

## Implementation Checklist

### 3.1.1 Install Tree-sitter Dependencies

- [ ] Install tree-sitter core package: `npm install tree-sitter@^0.21.1`
- [ ] Install TypeScript grammar: `npm install tree-sitter-typescript@^0.21.2`
- [ ] Install Python grammar: `npm install tree-sitter-python@^0.21.0`
- [ ] Add type definitions: `npm install @types/tree-sitter@^0.21.1`
- [ ] Verify installations in package.json

### 3.1.2 Create Directory Structure

- [ ] Create `src/features/parsing/interfaces/` directory
- [ ] Create `src/features/parsing/services/` directory
- [ ] Create `src/features/parsing/implementations/` directory
- [ ] Create `src/features/parsing/utils/` directory
- [ ] Create `src/features/parsing/types/` directory

### 3.1.3 Define Core Interfaces and Types

- [ ] Create `src/features/parsing/interfaces/ParserInterface.ts`
  - [ ] Define Parser interface with parse(), getLanguage(), getSupportedExtensions()
  - [ ] Define ParsedMetadata interface with definitions, imports, symbols, errors
  - [ ] Define ParsingError interface with type, message, line, column
- [ ] Create `src/features/parsing/types/ParsingTypes.ts`
  - [ ] Define Definition interface (name, type, line, column, exported, etc.)
  - [ ] Define ImportMetadata interface (module, type, imports, alias, isDynamic)
  - [ ] Define SymbolMetadata interface (name, type, line, exported)
  - [ ] Define FileStats interface (size, lines, encoding)
  - [ ] Define LanguageDetection type mappings

### 3.1.4 Implement BaseParser Abstract Class

- [ ] Create `src/features/parsing/services/BaseParser.ts`
  - [ ] Implement abstract BaseParser class with language property
  - [ ] Add abstract parse() method
  - [ ] Implement calculateHash() method using SHA256
  - [ ] Implement getFileStats() method for file metadata
  - [ ] Implement detectLanguage() method from file extension
  - [ ] Add error handling and logging utilities
  - [ ] Add file size validation (10MB limit)

### 3.1.5 Implement TypeScriptParser

- [ ] Create `src/features/parsing/implementations/TypeScriptParser.ts`
  - [ ] Extend BaseParser with 'typescript' language
  - [ ] Initialize tree-sitter parser with TypeScript grammar
  - [ ] Set up language extensions: ['.js', '.jsx', '.ts', '.tsx']
  - [ ] Create tree-sitter queries for function extraction
  - [ ] Create tree-sitter queries for class extraction
  - [ ] Create tree-sitter queries for import extraction
  - [ ] Create tree-sitter queries for export detection
  - [ ] Implement parse() method with error recovery
  - [ ] Add JSX/TSX syntax handling
  - [ ] Implement metadata extraction functions

### 3.1.6 Implement PythonParser

- [ ] Create `src/features/parsing/implementations/PythonParser.ts`
  - [ ] Extend BaseParser with 'python' language
  - [ ] Initialize tree-sitter parser with Python grammar
  - [ ] Set up language extensions: ['.py']
  - [ ] Create tree-sitter queries for function extraction
  - [ ] Create tree-sitter queries for class extraction
  - [ ] Create tree-sitter queries for import extraction
  - [ ] Create tree-sitter queries for decorator handling
  - [ ] Implement parse() method with error recovery
  - [ ] Add Python-specific syntax handling (decorators, etc.)
  - [ ] Implement metadata extraction functions

### 3.1.7 Create Utility Functions

- [ ] Create `src/features/parsing/utils/treeSitterUtils.ts`
  - [ ] Implement query compilation and caching
  - [ ] Add node traversal helpers
  - [ ] Create AST node extraction utilities
  - [ ] Add syntax error detection functions
  - [ ] Implement node text extraction helpers
- [ ] Create `src/features/parsing/utils/astUtils.ts`
  - [ ] Implement AST manipulation utilities
  - [ ] Add node type checking functions
  - [ ] Create signature generation helpers
  - [ ] Add docstring extraction utilities
  - [ ] Implement decorator parsing functions

### 3.1.8 Add Error Handling and Validation

- [ ] Implement parsing error classification in BaseParser
- [ ] Add graceful degradation for syntax errors
- [ ] Create validation for extracted metadata
- [ ] Add timeout handling for large files (5 second limit)
- [ ] Implement memory usage monitoring
- [ ] Add comprehensive error logging

### 3.1.9 Update Feature Index and Exports

- [ ] Update `src/features/parsing/index.ts` with proper exports
  - [ ] Export Parser interface and types
  - [ ] Export BaseParser class
  - [ ] Export TypeScriptParser class
  - [ ] Export PythonParser class
  - [ ] Export utility functions
  - [ ] Add feature documentation

### 3.1.10 Create Basic Tests

- [ ] Create `tests/unit/features/parsing/` directory
- [ ] Create `TypeScriptParser.test.ts` with basic parsing tests
- [ ] Create `PythonParser.test.ts` with basic parsing tests
- [ ] Create `BaseParser.test.ts` with utility function tests
- [ ] Add test fixtures for simple code files
- [ ] Verify tests pass with `npm test`

## Code Templates

### ParserInterface Template

```typescript
// src/features/parsing/interfaces/ParserInterface.ts
export interface Parser {
  parse(content: string): Promise<ParsedMetadata>;
  getLanguage(): string;
  getSupportedExtensions(): string[];
}

export interface ParsedMetadata {
  definitions: Definition[];
  imports: ImportMetadata[];
  symbols: SymbolMetadata[];
  errors?: ParsingError[];
}

export interface ParsingError {
  type: 'syntax' | 'semantic' | 'other';
  message: string;
  line?: number;
  column?: number;
}
```

### BaseParser Template

```typescript
// src/features/parsing/services/BaseParser.ts
import { createHash } from 'crypto';
import {
  Parser,
  ParsedMetadata,
  ParsingError,
  FileStats,
} from '../interfaces/ParserInterface';

export abstract class BaseParser implements Parser {
  constructor(protected language: string) {}

  abstract parse(content: string): Promise<ParsedMetadata>;
  abstract getSupportedExtensions(): string[];

  getLanguage(): string {
    return this.language;
  }

  protected calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  protected getFileStats(content: string): FileStats {
    const lines = content.split('\n').length;
    return {
      size: Buffer.byteLength(content, 'utf8'),
      lines,
      encoding: 'utf8',
    };
  }

  protected detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    // Implementation based on extension mapping
    return this.language;
  }
}
```

### TypeScriptParser Template

```typescript
// src/features/parsing/implementations/TypeScriptParser.ts
import Parser from 'tree-sitter';
import * as TypeScript from 'tree-sitter-typescript';
import { BaseParser } from '../services/BaseParser';
import {
  ParsedMetadata,
  Definition,
  ImportMetadata,
} from '../interfaces/ParserInterface';

export class TypeScriptParser extends BaseParser {
  private parser: Parser;

  constructor() {
    super('typescript');
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript);
  }

  getSupportedExtensions(): string[] {
    return ['.js', '.jsx', '.ts', '.tsx'];
  }

  async parse(content: string): Promise<ParsedMetadata> {
    try {
      const tree = this.parser.parse(content);
      const definitions = this.extractDefinitions(tree);
      const imports = this.extractImports(tree);
      const symbols = this.extractSymbols(tree);
      const errors = this.extractErrors(tree);

      return {
        definitions,
        imports,
        symbols,
        errors,
      };
    } catch (error) {
      return {
        definitions: [],
        imports: [],
        symbols: [],
        errors: [
          {
            type: 'syntax',
            message:
              error instanceof Error ? error.message : 'Unknown parsing error',
          },
        ],
      };
    }
  }

  private extractDefinitions(tree: Parser.Tree): Definition[] {
    // Tree-sitter query implementation
    const definitions: Definition[] = [];
    // Implementation details...
    return definitions;
  }

  private extractImports(tree: Parser.Tree): ImportMetadata[] {
    // Tree-sitter query implementation
    const imports: ImportMetadata[] = [];
    // Implementation details...
    return imports;
  }

  // Additional extraction methods...
}
```

## File Structure

```
src/features/parsing/
├── interfaces/
│   └── ParserInterface.ts
├── services/
│   └── BaseParser.ts
├── implementations/
│   ├── TypeScriptParser.ts
│   └── PythonParser.ts
├── utils/
│   ├── treeSitterUtils.ts
│   └── astUtils.ts
├── types/
│   └── ParsingTypes.ts
└── index.ts
```

## Integration Points

- **Indexing Feature**: Will be called by IndexerService for file processing (future task 4.2)
- **Storage Feature**: Returns metadata for database storage (future task 2.3)
- **Configuration Feature**: Uses language configuration settings (future task 3.2)

## Validation Criteria

- [ ] All supported file types parse successfully
- [ ] Syntax errors don't crash the parser
- [ ] Extracted metadata matches expected schema
- [ ] Performance meets requirements (<100ms per file for typical files)
- [ ] Memory usage stays within limits (<50MB for parsing operations)
- [ ] Error handling follows project patterns
- [ ] All TypeScript types properly defined

## Acceptance Tests

- [ ] Unit tests for each parser implementation
- [ ] Integration tests with real code files
- [ ] Error handling tests with malformed code
- [ ] Performance benchmarks with large files
- [ ] Memory leak tests with continuous parsing
- [ ] Type safety validation with TypeScript compiler

## Quality Gates

- [ ] Code coverage > 90% for parsing logic
- [ ] All TypeScript types properly defined
- [ ] Error handling follows project patterns
- [ ] Documentation complete for all public APIs
- [ ] Performance benchmarks pass
- [ ] Memory usage within acceptable limits
- [ ] No ESLint or Prettier violations

## Dependencies

- **Task 1.2**: Configure TypeScript and build system (completed)
- **Task 1.4**: Configuration management system (completed)

## Next Steps

After completing this task, the foundation will be ready for:

- **Task 3.2**: Implement ParserManager for language detection and routing
- **Task 3.3**: Develop TypeScript/JavaScript parser with unified handling
- **Task 3.4**: Implement Python parser with tree-sitter-python

# Parsing Feature Specification

## Overview

The Parsing feature provides language-agnostic code parsing using tree-sitter for robust, error-recovering extraction of structured metadata from source code files.

## Architecture

### Structure
```
features/parsing/
├── services/
│   ├── ParserManager.ts        # Parser orchestration and routing
│   └── BaseParser.ts           # Shared parsing logic and utilities
├── implementations/
│   ├── TypeScriptParser.ts     # Tree-sitter TypeScript parser (handles JS/TS/JSX/TSX)
│   └── PythonParser.ts         # Tree-sitter Python parser
├── interfaces/
│   └── ParserInterface.ts      # Parser contract definition
├── utils/
│   ├── treeSitterUtils.ts      # Tree-sitter helper functions
│   └── astUtils.ts             # AST manipulation utilities
├── types/
│   └── ParsingTypes.ts         # TypeScript type definitions
└── index.ts                    # Public API exports
```

## Core Components

### ParserManager Service

**Purpose**: Orchestrates parser selection and execution based on file types.

**Interface**:
```typescript
class ParserManager {
  constructor(private parsers: Map<string, Parser>) {}

  async parseFile(filePath: string, content: string): Promise<FileMetadata>
  registerParser(language: string, parser: Parser): void
  getSupportedLanguages(): string[]
  isLanguageSupported(language: string): boolean
}
```

**Responsibilities**:
- Detect language from file extension
- Route files to appropriate language parser
- Handle parser initialization and caching
- Provide unified parsing interface

**Language Detection**:
```typescript
const LANGUAGE_EXTENSIONS = {
  typescript: ['.js', '.jsx', '.ts', '.tsx'], // Unified parser
  python: ['.py']
};
```

### BaseParser Abstract Class

**Purpose**: Provides common parsing functionality and utilities.

**Interface**:
```typescript
abstract class BaseParser {
  constructor(protected language: string) {}

  abstract parse(content: string): Promise<ParsedMetadata>

  protected calculateHash(content: string): string
  protected getFileStats(filePath: string): Promise<FileStats>
  protected detectLanguage(filePath: string): string
}
```

**Common Functionality**:
- SHA256 hash calculation for change detection
- File size and line counting
- Language detection from file extension
- Error handling and logging

### Language-Specific Parsers

#### TypeScriptParser (Unified JS/TS)
```typescript
class TypeScriptParser extends BaseParser {
  private parser: Parser;

  constructor() {
    super('typescript');
    this.parser = new Parser();
    this.parser.setLanguage(require('tree-sitter-typescript').typescript);
  }

  async parse(content: string): Promise<ParsedMetadata> {
    // Tree-sitter parsing logic for JS/TS/JSX/TSX
  }
}
```

#### PythonParser
```typescript
class PythonParser extends BaseParser {
  private parser: Parser;

  constructor() {
    super('python');
    this.parser = new Parser();
    this.parser.setLanguage(require('tree-sitter-python'));
  }

  async parse(content: string): Promise<ParsedMetadata> {
    // Tree-sitter parsing logic for Python
  }
}
```

## Parser Interface

```typescript
interface Parser {
  parse(content: string): Promise<ParsedMetadata>;
  getLanguage(): string;
  getSupportedExtensions(): string[];
}

interface ParsedMetadata {
  definitions: Definition[];
  imports: ImportMetadata[];
  symbols: SymbolMetadata[];
  errors?: ParsingError[];
}

interface ParsingError {
  type: 'syntax' | 'semantic' | 'other';
  message: string;
  line?: number;
  column?: number;
}
```

## Tree-sitter Integration

### Query System
Tree-sitter uses pattern matching queries to extract code elements:

```javascript
// Function extraction query
const functionQuery = `
(function_declaration
  name: (identifier) @function.name
  parameters: (formal_parameters) @function.params
  body: (statement_block) @function.body)
`;

// Class extraction query
const classQuery = `
(class_declaration
  name: (identifier) @class.name
  body: (class_body) @class.body)
`;
```

### Node Processing
```typescript
function extractFunction(node: SyntaxNode): FunctionDefinition {
  const name = node.childForFieldName('name')?.text;
  const params = extractParameters(node.childForFieldName('parameters'));
  const body = node.childForFieldName('body');

  return {
    name,
    type: 'function',
    signature: generateSignature(name, params),
    line: node.startPosition.row,
    column: node.startPosition.column,
    exported: isExported(node)
  };
}
```

## Metadata Extraction

### Definitions
Extract classes, functions, components, and other code elements:

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
```

### Imports
Classify and extract import statements:

```typescript
interface ImportMetadata {
  module: string;
  type: 'local' | 'external' | 'builtin';
  imports: string[];
  alias?: string;
  isDynamic: boolean;
  line: number;
}
```

### Symbols
Extract top-level symbols and identifiers:

```typescript
interface SymbolMetadata {
  name: string;
  type: 'variable' | 'constant' | 'enum' | 'interface';
  line: number;
  exported: boolean;
}
```

## Error Handling and Recovery

### Syntax Errors
Tree-sitter continues parsing despite syntax errors:
- Log errors but continue processing
- Mark problematic sections as ERROR nodes
- Extract partial metadata when possible

### Parser Failures
- Fallback to basic metadata extraction
- Skip files that cannot be parsed
- Provide detailed error reporting

### Memory Management
- Limit file size for parsing (10MB default)
- Clean up parser instances after use
- Implement timeout for long-running parses

## Business Rules

### File Processing
1. **Language Detection**: Based on file extension mapping
2. **Size Limits**: Skip files exceeding configured limits
3. **Encoding**: Assume UTF-8 encoding for all files
4. **Binary Files**: Skip binary files and non-text content

### Metadata Extraction
1. **Scope Limitation**: Only extract top-level symbols
2. **Completeness**: Extract all available metadata for each element
3. **Consistency**: Use consistent naming and structure across languages
4. **Validation**: Validate extracted metadata against schemas

### Performance
1. **Concurrent Parsing**: Support multiple files parsing simultaneously
2. **Caching**: Cache compiled queries and grammars
3. **Streaming**: Process large files efficiently
4. **Resource Limits**: Prevent resource exhaustion

## Integration Points

### Indexing Integration
- Called by IndexerService for file processing
- Returns structured metadata for storage
- Handles parsing errors gracefully

### Configuration Integration
- Accept parser-specific configuration
- Support dynamic parser registration
- Validate parser availability on startup

### Event System
- Publish parsing events for monitoring
- Subscribe to configuration changes
- Handle parsing queue management

## Testing Strategy

### Unit Tests
- Parser initialization and configuration
- Language detection accuracy
- Query compilation and execution
- Metadata extraction validation

### Integration Tests
- End-to-end parsing pipeline
- Multi-language file processing
- Error handling scenarios
- Performance benchmarks

### Parser Tests
- Tree-sitter grammar validation
- Query pattern correctness
- AST traversal accuracy
- Memory usage monitoring</content>
<parameter name="filePath">docsV2/parsing-spec.md
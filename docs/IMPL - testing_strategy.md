# Testing Strategy and Test Plans

## Testing Philosophy

### Quality Assurance Principles

- **Test-Driven Development**: Write tests before implementation where possible
- **Comprehensive Coverage**: Unit, integration, and end-to-end testing
- **Continuous Integration**: Automated testing on every change
- **Performance Regression**: Prevent performance degradation
- **Reliability Focus**: Ensure system stability and error handling

### Testing Pyramid

```
End-to-End Tests (10%)
    ↕
Integration Tests (20%)
    ↕
Unit Tests (70%)
```

## Test Infrastructure

### Testing Dependencies

```json
{
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/node": "^18.0.0",
    "jest": "^30.2.0",
    "ts-jest": "^29.4.6",
    "supertest": "^6.3.3",
    "testcontainers": "^10.2.1",
    "mock-fs": "^5.2.0",
    "nock": "^13.4.0"
  }
}
```

### Jest Configuration

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  maxWorkers: 4,
  // Modern Jest 30.x configuration
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};
```

### Test Setup

```typescript
// tests/setup.ts
import { jest } from '@jest/globals';

// Global test setup
beforeAll(async () => {
  // Setup test database
  // Configure test logging
  // Initialize test fixtures
});

afterAll(async () => {
  // Cleanup test database
  // Remove test files
  // Reset global state
});

// Custom matchers
expect.extend({
  toBeValidFileMetadata(received) {
    // Custom validation logic
  },
});
```

## Unit Testing

### Service Layer Testing

```typescript
// tests/unit/services/IndexerService.test.ts
describe('IndexerService', () => {
  let indexer: IndexerService;
  let mockScanner: jest.Mocked<RepositoryScanner>;
  let mockParser: jest.Mocked<ParserManager>;
  let mockStorage: jest.Mocked<StorageService>;

  beforeEach(() => {
    mockScanner = {
      scanRepository: jest.fn(),
    };
    mockParser = {
      parseFile: jest.fn(),
    };
    mockStorage = {
      saveFile: jest.fn(),
    };

    indexer = new IndexerService(mockScanner, mockParser, mockStorage);
  });

  describe('indexRepository', () => {
    it('should scan repository and parse files', async () => {
      mockScanner.scanRepository.mockResolvedValue([
        { path: 'src/main.ts', size: 1000, modified: Date.now() },
      ]);
      mockParser.parseFile.mockResolvedValue(mockFileMetadata);
      mockStorage.saveFile.mockResolvedValue();

      const result = await indexer.indexRepository('/project');

      expect(result.totalFiles).toBe(1);
      expect(mockScanner.scanRepository).toHaveBeenCalledWith('/project');
      expect(mockParser.parseFile).toHaveBeenCalled();
      expect(mockStorage.saveFile).toHaveBeenCalled();
    });

    it('should handle parsing errors gracefully', async () => {
      mockScanner.scanRepository.mockResolvedValue([mockFileInfo]);
      mockParser.parseFile.mockRejectedValue(new Error('Parse failed'));

      await expect(indexer.indexRepository('/project')).rejects.toThrow();
      // Verify error handling and partial success
    });
  });
});
```

### Utility Function Testing

```typescript
// tests/unit/utils/pathUtils.test.ts
describe('pathUtils', () => {
  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(normalizePath('src\\main.ts')).toBe('src/main.ts');
    });

    it('should handle UNC paths on Windows', () => {
      expect(normalizePath('\\\\server\\share\\file.ts')).toBe(
        '//server/share/file.ts'
      );
    });
  });

  describe('isIgnored', () => {
    const patterns = ['node_modules', '*.log', '.git'];

    it('should return true for ignored paths', () => {
      expect(isIgnored('node_modules/package.json', patterns)).toBe(true);
      expect(isIgnored('app.log', patterns)).toBe(true);
      expect(isIgnored('.git/config', patterns)).toBe(true);
    });

    it('should return false for non-ignored paths', () => {
      expect(isIgnored('src/main.ts', patterns)).toBe(false);
      expect(isIgnored('README.md', patterns)).toBe(false);
    });
  });
});
```

### Data Model Testing

```typescript
// tests/unit/models/FileMetadata.test.ts
describe('FileMetadata', () => {
  describe('validation', () => {
    it('should validate required fields', () => {
      const validMetadata: FileMetadata = {
        id: 'uuid-123',
        path: 'src/main.ts',
        filename: 'main.ts',
        extension: '.ts',
        size: 1000,
        lastModified: Date.now(),
        hash: 'sha256-hash',
        language: 'typescript',
        definitions: [],
        imports: [],
        symbols: [],
        tags: ['main', 'typescript'],
        indexedAt: Date.now(),
      };

      expect(() => validateFileMetadata(validMetadata)).not.toThrow();
    });

    it('should reject invalid paths', () => {
      const invalidMetadata = {
        ...validMetadata,
        path: '../../../etc/passwd', // Path traversal attempt
      };

      expect(() => validateFileMetadata(invalidMetadata)).toThrow(
        ValidationError
      );
    });
  });
});
```

## Integration Testing

### Feature Integration Tests

```typescript
// tests/integration/features/IndexingWorkflow.test.ts
describe('Indexing Workflow', () => {
  let testDb: Database;
  let indexer: IndexerService;
  let storage: StorageService;

  beforeEach(async () => {
    // Setup test database
    testDb = new Database(':memory:');
    await migrateDatabase(testDb);

    // Initialize services
    storage = new StorageService({ db: testDb });
    indexer = new IndexerService(
      new RepositoryScanner(),
      new ParserManager(),
      storage
    );
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe('Full Repository Indexing', () => {
    it('should index a complete repository', async () => {
      // Create test repository structure
      const testRepo = createTestRepository({
        'src/main.ts': `
          import { helper } from './utils';
          export class MainApp {
            constructor() {}
            run(): void {}
          }
        `,
        'src/utils.ts': `
          export function helper(): string {
            return 'test';
          }
        `,
      });

      const result = await indexer.indexRepository(testRepo.path);

      expect(result.totalFiles).toBe(2);
      expect(result.languages.typescript).toBe(2);

      // Verify database contents
      const files = await storage.getAllFiles();
      expect(files).toHaveLength(2);

      const mainFile = files.find((f) => f.filename === 'main.ts');
      expect(mainFile?.definitions).toHaveLength(1);
      expect(mainFile?.imports).toHaveLength(1);
    });

    it('should handle incremental updates', async () => {
      // Initial index
      const result1 = await indexer.indexRepository(testRepo.path);
      expect(result1.totalFiles).toBe(2);

      // Modify file
      fs.writeFileSync(
        path.join(testRepo.path, 'src/main.ts'),
        `
        import { helper } from './utils';
        import { logger } from './logger';
        export class MainApp {
          constructor() {}
          run(): void {}
          log(): void {}
        }
      `
      );

      const result2 = await indexer.indexRepository(testRepo.path);
      expect(result2.totalFiles).toBe(2); // Same count

      // Verify updated metadata
      const updatedFile = await storage.findByPath('src/main.ts');
      expect(updatedFile?.imports).toHaveLength(2);
      expect(updatedFile?.definitions[0].methods).toHaveLength(2);
    });
  });
});
```

### MCP Integration Tests

```typescript
// tests/integration/mcp/ServerIntegration.test.ts
describe('MCP Server Integration', () => {
  let server: MCPServer;
  let client: MCPClient;

  beforeEach(async () => {
    // Setup test server
    server = new MCPServer();
    await server.start({ stdio: false, port: 0 }); // Random port

    // Setup test client
    client = new MCPClient();
    await client.connect(server.port);
  });

  afterEach(async () => {
    await client.disconnect();
    await server.stop();
  });

  describe('Tool Execution', () => {
    it('should execute search tool successfully', async () => {
      // Initialize repository
      await client.callTool('code-scout_index', { path: testRepo.path });

      // Execute search
      const result = await client.callTool('code-scout_search', {
        tags: ['main', 'app'],
      });

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Query Results');
      expect(result.content[0].text).toContain('src/main.ts');
    });

    it('should handle invalid parameters', async () => {
      const result = await client.callTool('code-scout_search', {
        tags: [], // Invalid: empty tags
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('At least one search tag');
    });

    it('should handle background indexing', async () => {
      const result = await client.callTool('code-scout_index', {
        path: testRepo.path,
        background: true,
      });

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('background');

      // Wait for indexing to complete
      await waitForIndexingComplete();

      // Verify indexing results
      const status = await client.callTool('code-scout_status');
      expect(status.content[0].text).toContain('"status": "idle"');
    });
  });
});
```

## Performance Testing

### Benchmark Tests

```typescript
// tests/performance/IndexingBenchmark.test.ts
describe('Indexing Performance', () => {
  it('should index repository within time limits', async () => {
    const testRepo = createLargeTestRepository(1000); // 1000 files

    const startTime = Date.now();
    const result = await indexer.indexRepository(testRepo.path);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(300000); // 5 minutes max
    expect(result.totalFiles).toBe(1000);

    // Memory usage check
    const memUsage = process.memoryUsage();
    expect(memUsage.heapUsed).toBeLessThan(300 * 1024 * 1024); // 300MB max
  });

  it('should handle concurrent indexing operations', async () => {
    const repos = [
      createTestRepository('repo1', 100),
      createTestRepository('repo2', 100),
      createTestRepository('repo3', 100),
    ];

    const startTime = Date.now();
    const results = await Promise.all(
      repos.map((repo) => indexer.indexRepository(repo.path))
    );
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(60000); // 1 minute max for concurrent
    results.forEach((result) => expect(result.totalFiles).toBe(100));
  });
});
```

### Query Performance Tests

```typescript
// tests/performance/QueryBenchmark.test.ts
describe('Query Performance', () => {
  beforeAll(async () => {
    // Setup large test index
    await indexer.indexRepository(createLargeTestRepository(5000).path);
  });

  it('should execute simple queries within time limits', async () => {
    const tags = ['user', 'auth'];

    const startTime = process.hrtime.bigint();
    const result = await queryEngine.search({ tags, limit: 20 });
    const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // ms

    expect(duration).toBeLessThan(30); // 30ms max
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should handle complex queries efficiently', async () => {
    const tags = ['user', 'authentication', 'login', 'jwt', 'middleware'];

    const startTime = process.hrtime.bigint();
    const result = await queryEngine.search({ tags, limit: 50 });
    const duration = Number(process.hrtime.bigint() - startTime) / 1e6;

    expect(duration).toBeLessThan(100); // 100ms max
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should maintain performance under load', async () => {
    const queries = Array(10)
      .fill(null)
      .map((_, i) => ({
        tags: [`tag${i}`, 'common'],
        limit: 20,
      }));

    const startTime = process.hrtime.bigint();
    const results = await Promise.all(
      queries.map((q) => queryEngine.search(q))
    );
    const duration = Number(process.hrtime.bigint() - startTime) / 1e6;

    expect(duration).toBeLessThan(500); // 500ms max for 10 concurrent queries
    results.forEach((result) =>
      expect(result.results.length).toBeGreaterThan(0)
    );
  });
});
```

## Test Data Management

### Test Fixtures

```typescript
// tests/fixtures/index.ts
export const testRepositories = {
  simple: {
    'src/main.ts': `
      import { helper } from './utils';
      export class MainApp {
        run(): void {
          console.log('Hello World');
        }
      }
    `,
    'src/utils.ts': `
      export function helper(): string {
        return 'helper';
      }
    `,
  },
  complex: {
    // Large repository with multiple files
  },
};

export function createTestRepository(
  name: string,
  files: Record<string, string>
): TestRepo {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `code-scout-test-${name}-`)
  );

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  return {
    path: tempDir,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}
```

### Mock Services

```typescript
// tests/mocks/index.ts
export const mockFileMetadata: FileMetadata = {
  id: 'test-id',
  path: 'src/main.ts',
  filename: 'main.ts',
  extension: '.ts',
  size: 1000,
  lastModified: Date.now(),
  hash: 'mock-hash',
  language: 'typescript',
  definitions: [
    {
      name: 'MainApp',
      type: 'class',
      line: 3,
      column: 0,
      exported: true,
      signature: 'class MainApp',
      methods: ['run'],
    },
  ],
  imports: [
    {
      module: './utils',
      type: 'local',
      imports: ['helper'],
      line: 1,
    },
  ],
  symbols: [],
  tags: ['main', 'app', 'typescript'],
  indexedAt: Date.now(),
};
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run performance tests
        run: npm run test:performance

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:performance": "jest --testPathPattern=performance",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

## Code Coverage Requirements

### Coverage Thresholds

- **Statements**: 80% minimum
- **Branches**: 80% minimum
- **Functions**: 80% minimum
- **Lines**: 80% minimum

### Coverage Exclusions

- **Test Files**: Exclude test files from coverage
- **Configuration**: Exclude config files
- **Third-party**: Exclude vendored/third-party code
- **Generated**: Exclude generated code

This comprehensive testing strategy ensures code quality, prevents regressions, and validates system reliability across different scenarios and scales.

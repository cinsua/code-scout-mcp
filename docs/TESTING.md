# Testing Guide

This document provides comprehensive guidelines for testing the Code Scout MCP Server project.

## Testing Structure

The project follows a structured testing approach with three main categories:

### 📁 Test Directory Structure

```
tests/
├── setup.ts                    # Global test configuration
├── unit/                       # Unit tests (70% of tests)
│   ├── services/              # Service layer tests
│   ├── utils/                 # Utility function tests
│   └── models/                # Data model tests
├── integration/                # Integration tests (20% of tests)
│   ├── features/              # Feature workflow tests
│   └── mcp/                  # MCP protocol tests
├── performance/               # Performance tests (10% of tests)
│   ├── benchmarks/           # Performance benchmarks
│   └── load/                 # Load testing
├── fixtures/                  # Test data and utilities
│   ├── repositories/          # Test repository setups
│   ├── data/                 # Sample test data
│   └── index.ts              # Fixture exports
└── mocks/                     # Test mocks and stubs
    ├── services/              # Service mocks
    ├── data/                 # Data mocks
    └── index.ts              # Mock exports
```

## 🧪 Test Categories

### Unit Tests

- **Purpose**: Test individual functions and classes in isolation
- **Location**: `tests/unit/`
- **Coverage Target**: 70% of total tests
- **Execution**: `npm run test:unit`

### Integration Tests

- **Purpose**: Test component interactions and workflows
- **Location**: `tests/integration/`
- **Coverage Target**: 20% of total tests
- **Execution**: `npm run test:integration`

### Performance Tests

- **Purpose**: Benchmark performance and validate speed requirements
- **Location**: `tests/performance/`
- **Coverage Target**: 10% of total tests
- **Execution**: `npm run test:performance`

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:performance

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Pre-test Quality Checks

The `pretest` script automatically runs:

- **Linting**: `npm run lint` - Code style and quality checks
- **Type Checking**: `npm run typecheck` - TypeScript compilation validation

## 📊 Coverage Requirements

### Coverage Thresholds

- **Statements**: 80% minimum
- **Branches**: 80% minimum
- **Functions**: 80% minimum
- **Lines**: 80% minimum

### Coverage Exclusions

- Type definition files (`*.d.ts`)
- Index files (`index.ts`)
- Test files (all files in `tests/` directory)
- Configuration files

### Coverage Reports

Coverage reports are generated in multiple formats:

- **Text**: Console output
- **HTML**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info` (for CI/CD integration)

## 🛠️ Test Utilities

### Fixtures

Test fixtures provide reusable test data and setups:

```typescript
import { createTestRepository, createTestCodebase } from '../fixtures';

// Create a test repository with files
const testRepo = createTestRepository('my-test', {
  'src/index.ts': 'export function main() { return 42; }',
  'package.json': JSON.stringify({ name: 'test' }),
});

// Cleanup after test
testRepo.cleanup();
```

### Mocks

Pre-configured mocks for common dependencies:

```typescript
import { mockFileSystem, setupDefaultMocks, resetAllMocks } from '../mocks';

// Setup default mock behaviors
setupDefaultMocks();

// Use mocks in tests
(mockFileSystem.existsSync as any).mockReturnValue(true);

// Reset mocks after test
resetAllMocks();
```

### Custom Matchers

Custom Jest matchers for common validations:

```typescript
// Validate file metadata
expect(fileMetadata).toBeValidFileMetadata();

// Validate code index
expect(codeIndex).toBeValidCodeIndex();

// Validate search results
expect(searchResults).toBeValidSearchResult();
```

## 📝 Writing Tests

### Test File Naming

- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- Performance tests: `*.benchmark.test.ts`

### Test Structure

Follow the Arrange-Act-Assert pattern:

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
    setupDefaultMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    resetAllMocks();
  });

  describe('methodName', () => {
    it('should do something expected', async () => {
      // Arrange
      const input = 'test input';
      const expected = 'expected output';

      // Act
      const result = await component.methodName(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Performance Testing

Performance tests should validate speed requirements:

```typescript
describe('Performance Benchmarks', () => {
  it('should complete operation within threshold', async () => {
    const startTime = performance.now();

    // Perform operation
    await performOperation();

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
  });
});
```

## 🔄 CI/CD Integration

### GitHub Actions

The project includes automated testing via GitHub Actions:

- **Triggers**: Push and pull requests to main/develop branches
- **Node.js Versions**: 18 and 20 (matrix testing)
- **Quality Gates**: Linting, type checking, all test categories
- **Coverage**: Upload to Codecov for tracking

### Local Validation

Before committing, run the full test suite:

```bash
# Run complete quality check pipeline
npm test

# Or run steps manually
npm run lint
npm run typecheck
npm run test:coverage
```

## 🎯 Best Practices

### General Guidelines

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how
2. **Use Descriptive Names**: Test names should clearly describe what's being tested
3. **Keep Tests Independent**: Tests should not depend on each other
4. **Mock External Dependencies**: Use mocks for file system, network, database
5. **Clean Up After Tests**: Ensure no side effects between tests

### Performance Testing

1. **Set Realistic Thresholds**: Base thresholds on actual requirements
2. **Test Multiple Scenarios**: Best case, average case, worst case
3. **Monitor Memory Usage**: Check for memory leaks in long-running operations
4. **Use Realistic Data**: Test with actual file sizes and complexity

### Integration Testing

1. **Test Complete Workflows**: End-to-end user scenarios
2. **Use Real Dependencies**: Where possible, use actual components
3. **Test Error Scenarios**: How the system handles failures
4. **Validate Side Effects**: File creation, database changes, etc.

## 🐛 Debugging Tests

### Common Issues

1. **Mock Not Called**: Ensure mocks are properly set up before test execution
2. **Async Timeouts**: Increase timeout for slow operations using `jest.setTimeout()`
3. **Type Errors**: Use proper TypeScript typing for mocks and test data
4. **Coverage Failures**: Check that all critical paths are tested

### Debugging Tools

- **Console Logging**: Use `console.log` for debugging (removed in production)
- **Jest Debugging**: Run with `--detectOpenHandles` to detect unclosed handles
- **VS Code Debugging**: Use Jest extension for step-through debugging

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Performance Testing Guide](https://web.dev/performance-testing/)
- [TypeScript Testing](https://basarat.gitbook.io/typescript/testing/)

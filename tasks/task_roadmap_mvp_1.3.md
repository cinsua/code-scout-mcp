# Task 1.3: Setup Testing Framework with Jest and CI/CD Pipeline

## Overview

Implement comprehensive testing infrastructure using Jest with TypeScript support, configure CI/CD pipeline with GitHub Actions, and establish testing patterns for unit, integration, and performance testing.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Requirements from Documentation

### Testing Strategy Requirements (from IMPL - testing_strategy.md)

- **Testing Pyramid**: 70% Unit Tests, 20% Integration Tests, 10% End-to-End Tests
- **Coverage Thresholds**: 80% minimum for statements, branches, functions, and lines
- **Test Dependencies**: Jest ^29.7.0, ts-jest ^29.1.1, supertest ^6.3.3, testcontainers ^10.2.1, mock-fs ^5.2.0, nock ^13.4.0
- **Test Environment**: Node.js environment with TypeScript support
- **Performance Requirements**: Test timeout 10 seconds, max workers 4

### CI/CD Requirements

- **GitHub Actions**: Automated testing on push and pull request
- **Node.js Matrix**: Test on Node.js 18 and 20
- **Quality Gates**: Linting, type checking, unit tests, integration tests, performance tests
- **Coverage Reporting**: Upload coverage to Codecov

### Current Project State

- Basic Jest configuration exists in `jest.config.js` (placeholder)
- Jest and ts-jest already in devDependencies
- Test script exists in package.json
- No CI/CD pipeline configured
- No test directory structure

## Implementation Checklist

### 1.3.1 Install Additional Testing Dependencies

- [ ] Install missing testing dependencies: supertest, testcontainers, mock-fs, nock
- [ ] Verify all testing dependencies are at correct versions
- [ ] Update package.json with new dependencies
- [ ] Run `npm install` to install new dependencies

### 1.3.2 Configure Jest for TypeScript and Coverage

- [ ] Update `jest.config.js` with complete configuration from testing strategy
- [ ] Configure coverage thresholds (80% for all metrics)
- [ ] Setup coverage collection exclusions (test files, config files, index files)
- [ ] Configure test timeout and max workers
- [ ] Add setup file for global test configuration

### 1.3.3 Create Test Directory Structure

- [ ] Create `tests/` directory structure:
  ```
  tests/
  ├── setup.ts
  ├── unit/
  │   ├── services/
  │   ├── utils/
  │   └── models/
  ├── integration/
  │   ├── features/
  │   └── mcp/
  ├── performance/
  │   ├── benchmarks/
  │   └── load/
  ├── fixtures/
  │   ├── repositories/
  │   └── data/
  └── mocks/
      ├── services/
      └── data/
  ```
- [ ] Create index files for each test directory
- [ ] Add .gitkeep files to maintain directory structure

### 1.3.4 Setup Global Test Configuration

- [ ] Create `tests/setup.ts` with global test setup
- [ ] Configure global test timeout and environment
- [ ] Add custom Jest matchers for validation
- [ ] Setup test database initialization and cleanup
- [ ] Configure test logging and error handling

### 1.3.5 Create Test Utilities and Helpers

- [ ] Implement test repository creation utilities in `tests/fixtures/index.ts`
- [ ] Create mock services and data in `tests/mocks/index.ts`
- [ ] Add test helper functions for common operations
- [ ] Setup test data management and cleanup utilities

### 1.3.6 Update Package.json Scripts

- [ ] Add comprehensive test scripts:
  - `test:unit` - Run unit tests only
  - `test:integration` - Run integration tests only
  - `test:performance` - Run performance tests only
  - `test:coverage` - Run tests with coverage
  - `test:watch` - Run tests in watch mode
- [ ] Update existing test script to use new configuration
- [ ] Add pre-test hooks for linting and type checking

### 1.3.7 Setup GitHub Actions CI/CD Pipeline

- [ ] Create `.github/workflows/` directory
- [ ] Create `test.yml` workflow file with:
  - Trigger on push and pull request
  - Node.js matrix testing (18, 20)
  - Dependency caching
  - Linting and type checking steps
  - Unit, integration, and performance test execution
  - Coverage upload to Codecov
- [ ] Configure workflow permissions and secrets
- [ ] Add workflow status badges to README

### 1.3.8 Create Sample Tests for Each Category

- [ ] Create sample unit test in `tests/unit/services/` for a future service
- [ ] Create sample integration test in `tests/integration/features/` for workflow testing
- [ ] Create sample performance test in `tests/performance/benchmarks/` for benchmarking
- [ ] Verify all test categories run successfully

### 1.3.9 Configure Coverage Reporting

- [ ] Setup coverage directory and reporters (text, lcov, html)
- [ ] Configure coverage exclusions and thresholds
- [ ] Add coverage badge generation
- [ ] Test coverage reporting locally

### 1.3.10 Documentation and Validation

- [ ] Update README.md with testing instructions
- [ ] Document test structure and conventions
- [ ] Create testing guidelines for contributors
- [ ] Validate entire testing setup works end-to-end

## Code Templates

### Updated Jest Configuration

```javascript
// jest.config.js
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
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
```

### Global Test Setup

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
    const pass =
      received &&
      typeof received.path === 'string' &&
      typeof received.filename === 'string' &&
      typeof received.language === 'string';

    return {
      message: () => `expected ${received} to be valid file metadata`,
      pass,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidFileMetadata(): R;
    }
  }
}
```

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

### Test Repository Utility

```typescript
// tests/fixtures/index.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TestRepo {
  path: string;
  cleanup: () => void;
}

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

### Updated Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:performance": "jest --testPathPattern=performance",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "pretest": "npm run lint && npm run typecheck"
  }
}
```

## File Structure

```
tests/
├── setup.ts
├── unit/
│   ├── services/
│   │   └── .gitkeep
│   ├── utils/
│   │   └── .gitkeep
│   └── models/
│       └── .gitkeep
├── integration/
│   ├── features/
│   │   └── .gitkeep
│   └── mcp/
│       └── .gitkeep
├── performance/
│   ├── benchmarks/
│   │   └── .gitkeep
│   └── load/
│       └── .gitkeep
├── fixtures/
│   ├── repositories/
│   │   └── .gitkeep
│   ├── data/
│   │   └── .gitkeep
│   └── index.ts
└── mocks/
    ├── services/
    │   └── .gitkeep
    ├── data/
    │   └── .gitkeep
    └── index.ts

.github/
└── workflows/
    └── test.yml
```

## Integration Points

- **Build System**: Tests run before builds to ensure quality
- **TypeScript**: Full TypeScript support with ts-jest
- **ESLint**: Linting runs before tests in CI/CD
- **Code Coverage**: Integrated with CI/CD for quality monitoring
- **Performance**: Performance tests validate optimization goals

## Validation Criteria

- [ ] All test categories (unit, integration, performance) run successfully
- [ ] Coverage thresholds are enforced (80% minimum)
- [ ] CI/CD pipeline runs on all pull requests and pushes
- [ ] Test execution completes within reasonable time limits
- [ ] Coverage reports are generated and uploaded correctly
- [ ] Test utilities and fixtures work as expected

## Acceptance Tests

- [ ] Run `npm test` - should execute all tests successfully
- [ ] Run `npm run test:unit` - should execute only unit tests
- [ ] Run `npm run test:integration` - should execute only integration tests
- [ ] Run `npm run test:performance` - should execute only performance tests
- [ ] Run `npm run test:coverage` - should generate coverage report
- [ ] Push changes to trigger CI/CD pipeline - should pass all checks
- [ ] Create pull request - should trigger CI/CD pipeline with all tests passing

## Quality Gates

- [ ] All tests pass on Node.js 18 and 20
- [ ] Coverage meets 80% threshold for all metrics
- [ ] No linting errors or warnings
- [ ] No TypeScript compilation errors
- [ ] Performance tests complete within time limits
- [ ] CI/CD pipeline completes successfully
- [ ] Coverage reports are uploaded to Codecov

## Dependencies

- **Task 1.1**: Project structure must be initialized
- **Task 1.2**: TypeScript configuration must be complete
- **Future Tasks**: This testing framework will be used by all subsequent development tasks

## Notes

- This task establishes the foundation for all quality assurance in the project
- The testing infrastructure will evolve as features are implemented
- Performance benchmarks will be updated as the system grows
- CI/CD pipeline can be extended with additional quality gates in future phases

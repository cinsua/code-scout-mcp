// Global test setup
import { expect } from '@jest/globals';
import { LogManager } from '../src/shared/utils/LogManager';
import { initializeLogging } from '../src/config/logging';

export {};
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';

  // Initialize test logging using the test config (completely silent)
  initializeLogging({
    level: 'silent',
    format: 'json',
    file: { enabled: false },
    console: { enabled: false },
    structured: true,
  });

  const logger = LogManager.getLogger('test-setup');
  logger.info('Test environment initialized');

  // Setup test database (will be implemented when database is added)
  // await setupTestDatabase();

  // Configure test logging
  // configureTestLogging();

  // Initialize test fixtures
  // await initializeTestFixtures();
});

afterAll(async () => {
  // Cleanup test database (will be implemented when database is added)
  // await cleanupTestDatabase();

  // Remove test files
  // await cleanupTestFiles();

  // Reset global state
  delete process.env.NODE_ENV;

  // Reset LogManager to clean state
  LogManager.reset();
});

// Custom matchers for common validations
expect.extend({
  toBeValidFileMetadata(received) {
    const pass =
      received &&
      typeof received.path === 'string' &&
      typeof received.filename === 'string' &&
      typeof received.language === 'string';

    return {
      message: () =>
        `expected ${received} to be valid file metadata with path, filename, and language properties`,
      pass,
    };
  },

  toBeValidCodeIndex(received) {
    const pass =
      received &&
      Array.isArray(received.files) &&
      typeof received.totalFiles === 'number' &&
      typeof received.lastIndexed === 'string';

    return {
      message: () =>
        `expected ${received} to be valid code index with files array, totalFiles, and lastIndexed`,
      pass,
    };
  },

  toBeValidSearchResult(received) {
    const pass =
      received &&
      Array.isArray(received.results) &&
      typeof received.query === 'string' &&
      typeof received.totalResults === 'number';

    return {
      message: () =>
        `expected ${received} to be valid search result with results array, query, and totalResults`,
      pass,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidFileMetadata(): R;
      toBeValidCodeIndex(): R;
      toBeValidSearchResult(): R;
    }
  }
}

// Global test utilities
(global as any).testUtils = {
  // Helper to create test timeouts
  createTimeout: (ms: number = 5000) =>
    new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate test data
  generateTestId: () =>
    `test_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,

  // Helper to check if we're in test environment
  isTestEnvironment: () => process.env.NODE_ENV === 'test',
};

const logger = LogManager.getLogger('test-setup');
logger.info('Global test configuration loaded');

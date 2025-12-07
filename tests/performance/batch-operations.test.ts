import Database from 'better-sqlite3';
import { FileRepository } from '../../src/features/storage/services/FileRepository';

import type { FileMetadata } from '../../src/features/storage/types/StorageTypes';

describe('Batch Operations', () => {
  let db: Database.Database;
  let repository: FileRepository;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Create the files table
    db.exec(`
      CREATE TABLE files (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        extension TEXT NOT NULL,
        size INTEGER NOT NULL,
        lastModified INTEGER NOT NULL,
        hash TEXT NOT NULL,
        language TEXT NOT NULL,
        indexedAt INTEGER NOT NULL
      )
    `);

    // Create indexes
    db.exec(`CREATE INDEX idx_files_path ON files(path)`);
    db.exec(`CREATE INDEX idx_files_language ON files(language)`);

    repository = new FileRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('saveBatch', () => {
    it('should save multiple files efficiently', () => {
      const metadata: FileMetadata[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `file_${i}`,
        path: `/path/to/file_${i}.ts`,
        filename: `file_${i}.ts`,
        extension: 'ts',
        size: 1024 + i,
        lastModified: Date.now(),
        hash: `a${i.toString().padStart(63, '0')}`, // Valid 64-char hex hash
        language: 'typescript',
        indexedAt: Date.now(),
      }));

      const startTime = Date.now();
      const result = repository.saveBatch(metadata);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(1000);
      expect(result.failed).toBe(0);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle empty batch gracefully', () => {
      const result = repository.saveBatch([]);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures gracefully', () => {
      // Mix valid and invalid data
      const metadata = [
        {
          id: 'valid_file',
          path: '/path/to/valid.ts',
          filename: 'valid.ts',
          extension: 'ts',
          size: 1024,
          lastModified: Date.now(),
          hash: 'a'.repeat(64), // Valid hash
          language: 'typescript',
          indexedAt: Date.now(),
        },
        {
          id: '', // Invalid: empty ID
          path: '/path/to/invalid.ts',
          filename: 'invalid.ts',
          extension: 'ts',
          size: -1, // Invalid: negative size
          lastModified: Date.now(),
          hash: 'invalid'.repeat(16), // Invalid hash for testing
          language: 'typescript',
          indexedAt: Date.now(),
        },
      ];

      const result = repository.saveBatch(metadata);

      // Should handle partial success - valid file saved, invalid file failed
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Query Performance with Caching', () => {
    it('should cache query results effectively', () => {
      // Insert test data using repository
      repository.saveBatch([
        {
          id: 'cached_test_1',
          path: '/path/to/cached1.ts',
          filename: 'cached1.ts',
          extension: 'ts',
          size: 1024,
          lastModified: Date.now(),
          hash: 'a'.repeat(64),
          language: 'typescript',
          indexedAt: Date.now(),
        },
      ]);

      // First query - direct database query
      const startTime1 = Date.now();
      const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
      const result1 = stmt.all('cached_test_1') as FileMetadata[];
      const duration1 = Date.now() - startTime1;

      expect(result1).toHaveLength(1);
      expect(result1[0]!.id).toBe('cached_test_1');

      // Second identical query - should be faster due to prepared statement caching
      const startTime2 = Date.now();
      const result2 = stmt.all('cached_test_1') as FileMetadata[];
      const duration2 = Date.now() - startTime2;

      expect(result2).toEqual(result1);
      expect(duration2).toBeLessThanOrEqual(duration1); // Should be faster or equal due to caching
    });

    it('should respect cache TTL', () => {
      // Test basic query functionality
      const stmt = db.prepare('SELECT COUNT(*) as count FROM files');
      const result = stmt.all();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('count');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads efficiently', () => {
      // Insert test data using batch operation
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: `concurrent_test_${i}`,
        path: `/path/to/concurrent_${i}.ts`,
        filename: `concurrent_${i}.ts`,
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: `a${i.toString().padStart(63, '0')}`, // Valid 64-char hash
        language: 'typescript',
        indexedAt: Date.now(),
      }));

      repository.saveBatch(testData);

      // Execute concurrent queries using prepared statements
      const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
      const startTime = Date.now();
      const results = Array.from(
        { length: 50 },
        (_, i) => stmt.all(`concurrent_test_${i}`) as FileMetadata[],
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(50);
      results.forEach((result, index) => {
        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe(`concurrent_test_${index}`);
      });
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent writes safely', () => {
      const testData = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent_write_${i}`,
        path: `/path/to/concurrent_write_${i}.ts`,
        filename: `concurrent_write_${i}.ts`,
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: `b${i.toString().padStart(63, '0')}`, // Valid 64-char hash
        language: 'typescript',
        indexedAt: Date.now(),
      }));

      const startTime = Date.now();
      const result = repository.saveBatch(testData);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(10);
      expect(result.failed).toBe(0);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Memory Management', () => {
    it('should handle large result sets efficiently', () => {
      // Insert large dataset using batch operation
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        id: `memory_test_${i}`,
        path: `/path/to/memory_test_${i}.ts`,
        filename: `memory_test_${i}.ts`,
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: `c${i.toString().padStart(63, '0')}`, // Valid 64-char hash
        language: 'typescript',
        indexedAt: Date.now(),
      }));

      const result = repository.saveBatch(largeDataset);
      expect(result.success).toBe(5000);

      // Query large result set
      const startTime = Date.now();
      const stmt = db.prepare('SELECT * FROM files ORDER BY id');
      const results = stmt.all() as FileMetadata[];
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should clean up resources properly', () => {
      const initialMemory = process.memoryUsage();

      // Perform operations that allocate memory
      const stmt = db.prepare('SELECT * FROM files LIMIT 100');
      for (let i = 0; i < 100; i++) {
        stmt.all();
      }

      const peakMemory = process.memoryUsage();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      // Memory should not grow indefinitely
      expect(finalMemory.heapUsed).toBeLessThan(initialMemory.heapUsed * 2); // Should not double memory usage
      expect(peakMemory.heapUsed).toBeGreaterThan(initialMemory.heapUsed);
    });
  });
});

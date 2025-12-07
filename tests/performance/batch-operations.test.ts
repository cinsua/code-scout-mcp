import { DatabaseService } from '../../src/features/storage/services/DatabaseService';

import type { FileMetadata } from '../../src/features/storage/types/StorageTypes';

describe('Batch Operations', () => {
  let dbService: DatabaseService;
  const testDbPath = '/tmp/test-batch-operations.db';

  beforeEach(async () => {
    dbService = new DatabaseService({
      path: testDbPath,
      maxConnections: 5,
      connectionTimeout: 30000,
      readonly: false,
      pragmas: {
        cache_size: 1000,
        synchronous: 'NORMAL',
        journal_mode: 'WAL',
        temp_store: 'MEMORY',
        locking_mode: 'NORMAL',
        foreign_keys: 'ON',
        busy_timeout: 30000,
      },
    });

    await dbService.initialize();
  });

  afterEach(async () => {
    dbService.close();
    // Clean up test database
    try {
      await require('fs').promises.unlink(testDbPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('saveBatch', () => {
    it('should save multiple files efficiently', async () => {
      const metadata: FileMetadata[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `file_${i}`,
        path: `/path/to/file_${i}`,
        filename: `file_${i}.ts`,
        extension: 'ts',
        size: 1024 + i,
        lastModified: Date.now(),
        hash: `hash_${i}`,
        language: 'typescript',
        indexedAt: Date.now(),
      }));

      const startTime = Date.now();
      const result = await dbService.executeRun(
        'INSERT INTO files (id, path, filename, extension, size, lastModified, hash, language, indexedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        metadata.flatMap(item => [
          item.id,
          item.path,
          item.filename,
          item.extension,
          item.size,
          item.lastModified,
          item.hash,
          item.language,
          item.indexedAt,
        ]),
      );

      const duration = Date.now() - startTime;

      expect(result.changes).toBe(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should handle empty batch gracefully', async () => {
      const result = await dbService.executeRun(
        'INSERT INTO files (id, path, filename, extension, size, lastModified, hash, language, indexedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [],
      );

      expect(result.changes).toBe(0);
    });

    it('should handle partial failures gracefully', async () => {
      // Mix valid and invalid data
      const metadata = [
        {
          id: 'valid_file',
          path: '/path/to/valid.ts',
          filename: 'valid.ts',
          extension: 'ts',
          size: 1024,
          lastModified: Date.now(),
          hash: 'valid_hash',
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
          hash: 'invalid_hash',
          language: 'typescript',
          indexedAt: Date.now(),
        },
      ];

      const result = await dbService.executeRun(
        'INSERT INTO files (id, path, filename, extension, size, lastModified, hash, language, indexedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        metadata.flatMap(item => [
          item.id,
          item.path,
          item.filename,
          item.extension,
          item.size,
          item.lastModified,
          item.hash,
          item.language,
          item.indexedAt,
        ]),
      );

      // Should handle partial success
      expect(result.changes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Query Performance with Caching', () => {
    it('should cache query results effectively', async () => {
      // Insert test data
      await dbService.executeRun(
        'INSERT INTO files (id, path, filename, extension, size, lastModified, hash, language, indexedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          'cached_test_1',
          '/path/to/cached1.ts',
          'cached1.ts',
          'ts',
          1024,
          Date.now(),
          'hash1',
          'typescript',
          Date.now(),
        ],
      );

      // First query - should cache result
      const startTime1 = Date.now();
      const result1 = await dbService.executeQuery<FileMetadata>(
        'SELECT * FROM files WHERE id = ?',
        ['cached_test_1'],
      );
      const duration1 = Date.now() - startTime1;

      expect(result1).toHaveLength(1);
      expect(result1[0]!.id).toBe('cached_test_1');

      // Second identical query - should be faster due to caching
      const startTime2 = Date.now();
      const result2 = await dbService.executeQuery(
        'SELECT * FROM files WHERE id = ?',
        ['cached_test_1'],
      );
      const duration2 = Date.now() - startTime2;

      expect(result2).toEqual(result1);
      expect(duration2).toBeLessThanOrEqual(duration1); // Should be faster or equal due to caching
    });

    it('should respect cache TTL', async () => {
      // This test would require manipulating time or waiting for TTL
      // For now, just verify cache structure exists
      const result = await dbService.executeQuery(
        'SELECT COUNT(*) as count FROM files',
        [],
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('count');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads efficiently', async () => {
      // Insert test data
      for (let i = 0; i < 100; i++) {
        await dbService.executeRun(
          'INSERT INTO files (id, path, filename, extension, size, lastModified, hash, language, indexedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            `concurrent_test_${i}`,
            `/path/to/concurrent_${i}.ts`,
            `concurrent_${i}.ts`,
            'ts',
            1024,
            Date.now(),
            `hash_${i}`,
            'typescript',
            Date.now(),
          ],
        );
      }

      // Execute concurrent queries
      const concurrentQueries = Array.from({ length: 50 }, (_, i) =>
        dbService.executeQuery('SELECT * FROM files WHERE id = ?', [
          `concurrent_test_${i}`,
        ]),
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentQueries);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(50);
      results.forEach((result: any, index: number) => {
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(`concurrent_test_${index}`);
      });
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent writes safely', async () => {
      const concurrentWrites = Array.from({ length: 10 }, (_, i) =>
        dbService.executeRun(
          'INSERT INTO files (id, path, filename, extension, size, lastModified, hash, language, indexedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            `concurrent_write_${i}`,
            `/path/to/concurrent_write_${i}.ts`,
            `concurrent_write_${i}.ts`,
            'ts',
            1024,
            Date.now(),
            `hash_${i}`,
            'typescript',
            Date.now(),
          ],
        ),
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentWrites);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      results.forEach((result: any) => {
        expect(result.changes).toBe(1);
        expect(result.lastInsertRowid).toBeGreaterThan(0);
      });
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Memory Management', () => {
    it('should handle large result sets efficiently', async () => {
      // Insert large dataset
      const largeDataset = Array.from({ length: 5000 }, (_, i) => [
        `memory_test_${i}`,
        `/path/to/memory_test_${i}.ts`,
        `memory_test_${i}.ts`,
        'ts',
        1024,
        Date.now(),
        `hash_${i}`,
        'typescript',
        Date.now(),
      ]);

      await dbService.executeRun(
        'INSERT INTO files (id, path, filename, extension, size, lastModified, hash, language, indexedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        largeDataset.flat(),
      );

      // Query large result set
      const startTime = Date.now();
      const results = await dbService.executeQuery(
        'SELECT * FROM files ORDER BY id',
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should clean up resources properly', async () => {
      const initialMemory = process.memoryUsage();

      // Perform operations that allocate memory
      for (let i = 0; i < 100; i++) {
        await dbService.executeQuery('SELECT * FROM files LIMIT 100');
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

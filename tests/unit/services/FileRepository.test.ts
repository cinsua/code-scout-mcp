import Database from 'better-sqlite3';
import { FileRepository } from '@/features/storage/services/FileRepository';
import type { FileMetadata } from '@/features/storage/types/StorageTypes';

describe('FileRepository', () => {
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

  describe('save', () => {
    it('should save file metadata successfully', async () => {
      const metadata: FileMetadata = {
        id: 'test-1',
        path: '/test/file.ts',
        filename: 'file.ts',
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: 'a'.repeat(64), // Valid SHA-256 hash
        language: 'typescript',
        indexedAt: Date.now(),
      };

      expect(() => repository.save(metadata)).not.toThrow();

      // Verify the file was saved
      const found = await repository.findByPath('/test/file.ts');
      expect(found).toEqual(metadata);
    });

    it('should update existing file metadata', async () => {
      const metadata: FileMetadata = {
        id: 'test-1',
        path: '/test/file.ts',
        filename: 'file.ts',
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: 'a'.repeat(64),
        language: 'typescript',
        indexedAt: Date.now(),
      };

      await repository.save(metadata);

      // Update with new size
      const updatedMetadata = { ...metadata, size: 2048 };
      await repository.save(updatedMetadata);

      const found = await repository.findByPath('/test/file.ts');
      expect(found?.size).toBe(2048);
    });

    it('should validate required fields', async () => {
      const invalidMetadata = {
        id: 'test-1',
        // Missing required fields
      } as any;

      expect(() => repository.save(invalidMetadata)).toThrow(
        'Path must be a non-empty string',
      );
    });

    it('should validate hash format', async () => {
      const metadata: FileMetadata = {
        id: 'test-1',
        path: '/test/file.ts',
        filename: 'file.ts',
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: 'invalid-hash', // Invalid SHA-256 hash
        language: 'typescript',
        indexedAt: Date.now(),
      };

      expect(() => repository.save(metadata)).toThrow(
        'Hash must be a valid SHA-256 hash',
      );
    });
  });

  describe('findByPath', () => {
    it('should find file by path', async () => {
      const metadata: FileMetadata = {
        id: 'test-1',
        path: '/test/file.ts',
        filename: 'file.ts',
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: 'a'.repeat(64),
        language: 'typescript',
        indexedAt: Date.now(),
      };

      await repository.save(metadata);
      const found = await repository.findByPath('/test/file.ts');
      expect(found).toEqual(metadata);
    });

    it('should return null for non-existent file', async () => {
      const found = await repository.findByPath('/nonexistent/file.ts');
      expect(found).toBeNull();
    });

    it('should validate path parameter', async () => {
      expect(() => repository.findByPath('')).toThrow(
        'Path must be a non-empty string',
      );
      expect(() => repository.findByPath(null as any)).toThrow(
        'Path must be a non-empty string',
      );
    });
  });

  describe('findById', () => {
    it('should find file by ID', async () => {
      const metadata: FileMetadata = {
        id: 'test-1',
        path: '/test/file.ts',
        filename: 'file.ts',
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: 'a'.repeat(64),
        language: 'typescript',
        indexedAt: Date.now(),
      };

      await repository.save(metadata);
      const found = await repository.findById('test-1');
      expect(found).toEqual(metadata);
    });

    it('should return null for non-existent ID', async () => {
      const found = await repository.findById('nonexistent-id');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update file metadata partially', async () => {
      const metadata: FileMetadata = {
        id: 'test-1',
        path: '/test/file.ts',
        filename: 'file.ts',
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: 'a'.repeat(64),
        language: 'typescript',
        indexedAt: Date.now(),
      };

      await repository.save(metadata);

      // Update only size and language
      await repository.update('/test/file.ts', {
        size: 2048,
        language: 'javascript',
      });

      const found = await repository.findByPath('/test/file.ts');
      expect(found?.size).toBe(2048);
      expect(found?.language).toBe('javascript');
      expect(found?.id).toBe('test-1'); // Should remain unchanged
    });

    it('should throw error for non-existent file', async () => {
      expect(() =>
        repository.update('/nonexistent/file.ts', { size: 2048 }),
      ).toThrow('File not found for update');
    });

    it('should validate update data', async () => {
      expect(() => repository.update('/test/file.ts', {})).toThrow(
        'At least one field must be provided for update',
      );
    });
  });

  describe('delete', () => {
    it('should delete file successfully', async () => {
      const metadata: FileMetadata = {
        id: 'test-1',
        path: '/test/file.ts',
        filename: 'file.ts',
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: 'a'.repeat(64),
        language: 'typescript',
        indexedAt: Date.now(),
      };

      await repository.save(metadata);
      await repository.delete('/test/file.ts');

      const found = await repository.findByPath('/test/file.ts');
      expect(found).toBeNull();
    });

    it('should handle deletion of non-existent file gracefully', async () => {
      expect(() => repository.delete('/nonexistent/file.ts')).not.toThrow();
    });
  });

  describe('count', () => {
    it('should return zero for empty database', async () => {
      const count = await repository.count();
      expect(count).toBe(0);
    });

    it('should return correct count after adding files', async () => {
      const metadata: FileMetadata = {
        id: 'test-1',
        path: '/test/file.ts',
        filename: 'file.ts',
        extension: 'ts',
        size: 1024,
        lastModified: Date.now(),
        hash: 'a'.repeat(64),
        language: 'typescript',
        indexedAt: Date.now(),
      };

      await repository.save(metadata);
      const count = await repository.count();
      expect(count).toBe(1);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Add test data
      const files: FileMetadata[] = [
        {
          id: 'test-1',
          path: '/test/file1.ts',
          filename: 'file1.ts',
          extension: 'ts',
          size: 1024,
          lastModified: 1000,
          hash: 'a'.repeat(64),
          language: 'typescript',
          indexedAt: 1000,
        },
        {
          id: 'test-2',
          path: '/test/file2.js',
          filename: 'file2.js',
          extension: 'js',
          size: 2048,
          lastModified: 2000,
          hash: 'b'.repeat(64),
          language: 'javascript',
          indexedAt: 2000,
        },
        {
          id: 'test-3',
          path: '/test/file3.ts',
          filename: 'file3.ts',
          extension: 'ts',
          size: 512,
          lastModified: 3000,
          hash: 'c'.repeat(64),
          language: 'typescript',
          indexedAt: 3000,
        },
      ];

      for (const file of files) {
        await repository.save(file);
      }
    });

    it('should list all files', async () => {
      const files = await repository.list();
      expect(files).toHaveLength(3);
    });

    it('should filter by language', async () => {
      const files = await repository.list({ language: 'typescript' });
      expect(files).toHaveLength(2);
      expect(
        files.every((f: FileMetadata) => f.language === 'typescript'),
      ).toBe(true);
    });

    it('should filter by extension', async () => {
      const files = await repository.list({ extension: 'js' });
      expect(files).toHaveLength(1);
      expect(files[0]?.extension).toBe('js');
    });

    it('should support pagination', async () => {
      const files = await repository.list({ limit: 2, offset: 1 });
      expect(files).toHaveLength(2);
    });

    it('should support sorting', async () => {
      const files = await repository.list({ sortBy: 'size', sortOrder: 'ASC' });
      expect(files[0]?.size).toBe(512);
      expect(files[1]?.size).toBe(1024);
      expect(files[2]?.size).toBe(2048);
    });

    it('should validate sort options', async () => {
      expect(() => repository.list({ sortBy: 'invalid' as any })).toThrow(
        'Invalid sort field',
      );

      expect(() => repository.list({ sortOrder: 'INVALID' as any })).toThrow(
        'Invalid sort order',
      );
    });
  });

  describe('saveBatch', () => {
    it('should save multiple files successfully', async () => {
      const files: FileMetadata[] = [
        {
          id: 'test-1',
          path: '/test/file1.ts',
          filename: 'file1.ts',
          extension: 'ts',
          size: 1024,
          lastModified: Date.now(),
          hash: 'a'.repeat(64),
          language: 'typescript',
          indexedAt: Date.now(),
        },
        {
          id: 'test-2',
          path: '/test/file2.js',
          filename: 'file2.js',
          extension: 'js',
          size: 2048,
          lastModified: Date.now(),
          hash: 'b'.repeat(64),
          language: 'javascript',
          indexedAt: Date.now(),
        },
      ];

      const result = await repository.saveBatch(files);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toBeUndefined();

      const count = await repository.count();
      expect(count).toBe(2);
    });

    it('should handle validation errors in batch', async () => {
      const files = [
        {
          id: 'test-1',
          path: '/test/file1.ts',
          filename: 'file1.ts',
          extension: 'ts',
          size: 1024,
          lastModified: Date.now(),
          hash: 'a'.repeat(64),
          language: 'typescript',
          indexedAt: Date.now(),
        },
        {
          id: 'test-2',
          path: '/test/file2.js',
          filename: 'file2.js',
          extension: 'js',
          size: 2048,
          lastModified: Date.now(),
          hash: 'invalid-hash', // Invalid hash
          language: 'javascript',
          indexedAt: Date.now(),
        },
      ] as any;

      const result = await repository.saveBatch(files);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]?.id).toBe('test-2');
    });

    it('should handle empty batch', async () => {
      const result = await repository.saveBatch([]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('deleteBatch', () => {
    beforeEach(async () => {
      // Add test data
      const files: FileMetadata[] = [
        {
          id: 'test-1',
          path: '/test/file1.ts',
          filename: 'file1.ts',
          extension: 'ts',
          size: 1024,
          lastModified: Date.now(),
          hash: 'a'.repeat(64),
          language: 'typescript',
          indexedAt: Date.now(),
        },
        {
          id: 'test-2',
          path: '/test/file2.js',
          filename: 'file2.js',
          extension: 'js',
          size: 2048,
          lastModified: Date.now(),
          hash: 'b'.repeat(64),
          language: 'javascript',
          indexedAt: Date.now(),
        },
      ];

      await repository.saveBatch(files);
    });

    it('should delete multiple files successfully', async () => {
      const paths = ['/test/file1.ts', '/test/file2.js'];
      const result = await repository.deleteBatch(paths);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);

      const count = await repository.count();
      expect(count).toBe(0);
    });

    it('should handle non-existent files gracefully', async () => {
      const paths = ['/test/file1.ts', '/nonexistent/file.js'];
      const result = await repository.deleteBatch(paths);
      expect(result.success).toBe(1); // Only existing file deleted
      expect(result.failed).toBe(0); // Non-existent file not counted as error

      const count = await repository.count();
      expect(count).toBe(1);
    });

    it('should handle empty batch', async () => {
      const result = await repository.deleteBatch([]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});

/**
 * Unit tests for SearchRepository
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import { SearchRepository } from '@/features/storage/services/SearchRepository';
import { DatabaseService } from '@/features/storage/services/DatabaseService';
import {
  DatabaseError,
  SearchOptions,
} from '@/features/storage/types/StorageTypes';

// Mock DatabaseService
jest.mock('@/features/storage/services/DatabaseService');

describe('SearchRepository', () => {
  let searchRepository: SearchRepository;
  let mockDbService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock DatabaseService
    mockDbService = {
      executeQuery: jest.fn(),
      executeOne: jest.fn(),
      executeRun: jest.fn(),
    } as any;

    // Create SearchRepository instance
    searchRepository = new SearchRepository(mockDbService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('searchByTags', () => {
    it('should search by tags successfully', async () => {
      // Arrange
      const tags = ['typescript', 'react'];
      const options: SearchOptions = { limit: 10, includeSnippets: true };

      const mockResults = [
        {
          id: 'file1',
          path: '/src/components/Button.tsx',
          filename: 'Button.tsx',
          extension: 'tsx',
          language: 'typescript',
          size: 1024,
          lastModified: Date.now(),
          rank: 0.95,
          filename_snippet: '<mark>Button</mark>.tsx',
          path_snippet: '/src/components/<mark>Button</mark>.tsx',
          definitions_snippet: 'const <mark>Button</mark>: React.FC',
        },
      ];

      mockDbService.executeQuery.mockResolvedValue(mockResults);

      // Act
      const result = await searchRepository.searchByTags(tags, options);

      // Assert
      expect(result).toHaveLength(1);
      const firstResult = result[0]!;
      expect(firstResult).toMatchObject({
        id: 'file1',
        path: '/src/components/Button.tsx',
        filename: 'Button.tsx',
        score: 0.95,
      });
      expect(firstResult.matches?.length).toBe(3);
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE files_fts MATCH ? OR files_fts MATCH ?'),
        expect.arrayContaining([
          expect.stringMatching(/typescript/i),
          expect.stringMatching(/react/i),
        ]),
      );
    });

    it('should validate tags array', async () => {
      // Arrange & Act & Assert
      await expect(searchRepository.searchByTags([])).rejects.toThrow(
        "Tag search failed: Validation failed for field 'tags': Field 'tags' violates constraint: at least one tag required",
      );
      await expect(
        searchRepository.searchByTags([
          'tag1',
          'tag2',
          'tag3',
          'tag4',
          'tag5',
          'tag6',
        ]),
      ).rejects.toThrow(
        "Tag search failed: Validation failed for field 'tags': Field 'tags' value 6 is out of range. Expected less than or equal to 5",
      );
      await expect(searchRepository.searchByTags([''])).rejects.toThrow(
        "Tag search failed: Validation failed for field 'tags[0]': Field 'tags[0]' has invalid type. Expected non-empty string, got string",
      );
      await expect(
        searchRepository.searchByTags(['a'.repeat(101)]),
      ).rejects.toThrow(
        "Tag search failed: Validation failed for field 'tags[0]': Field 'tags[0]' value 101 is out of range. Expected less than or equal to 100",
      );
    });

    it('should apply filters correctly', async () => {
      // Arrange
      const tags = ['typescript'];
      const options: SearchOptions = {
        filters: {
          language: 'typescript',
          fileType: 'ts',
          path: 'src',
          sizeRange: { min: 100, max: 10000 },
          dateRange: { after: 1000000, before: 2000000 },
        },
      };

      mockDbService.executeQuery.mockResolvedValue([]);

      // Act
      await searchRepository.searchByTags(tags, options);

      // Assert
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND f.language = ?'),
        expect.arrayContaining(['typescript']),
      );
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND f.extension = ?'),
        expect.arrayContaining(['ts']),
      );
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND f.path LIKE ?'),
        expect.arrayContaining(['%src%']),
      );
    });

    it('should use over-retrieval when specified', async () => {
      // Arrange
      const tags = ['test'];
      const options: SearchOptions = { limit: 10, overRetrieve: true };

      mockDbService.executeQuery.mockResolvedValue([]);

      // Act
      await searchRepository.searchByTags(tags, options);

      // Assert
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([20, 0]), // 2x limit
      );
    });

    it('should cache results', async () => {
      // Arrange
      const tags = ['test'];
      const options: SearchOptions = { limit: 10 };

      mockDbService.executeQuery.mockResolvedValue([]);

      // Act
      await searchRepository.searchByTags(tags, options);
      await searchRepository.searchByTags(tags, options); // Second call should use cache

      // Assert
      expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1); // Called only once due to cache
    });
  });

  describe('searchByText', () => {
    it('should search by text query successfully', async () => {
      // Arrange
      const query = 'React component';
      const options: SearchOptions = { limit: 10, includeSnippets: true };

      const mockResults = [
        {
          id: 'file1',
          path: '/src/components/Button.tsx',
          filename: 'Button.tsx',
          extension: 'tsx',
          language: 'typescript',
          size: 1024,
          lastModified: Date.now(),
          rank: 0.95,
          filename_snippet: '<mark>Button</mark>.tsx',
          path_snippet: '/src/components/<mark>Button</mark>.tsx',
          definitions_snippet: 'const <mark>Button</mark>: React.FC',
          imports_snippet: "import React from '<mark>react</mark>'",
          docstrings_snippet:
            'A <mark>React</mark> <mark>component</mark> button',
        },
      ];

      mockDbService.executeQuery.mockResolvedValue(mockResults);

      // Act
      const result = await searchRepository.searchByText(query, options);

      // Assert
      expect(result).toHaveLength(1);
      const firstResult = result[0]!;
      expect(firstResult).toMatchObject({
        id: 'file1',
        path: '/src/components/Button.tsx',
        filename: 'Button.tsx',
        score: 0.95,
      });
      expect(firstResult.matches?.length).toBeGreaterThanOrEqual(3); // At least 3 fields with snippets
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE files_fts MATCH ?'),
        expect.arrayContaining([query]),
      );
    });

    it('should validate text query', async () => {
      // Arrange & Act & Assert
      await expect(searchRepository.searchByText('')).rejects.toThrow(
        "Text search failed: Validation failed for field 'query': Field 'query' violates constraint: cannot be empty or whitespace only",
      );
      await expect(
        searchRepository.searchByText('a'.repeat(1001)),
      ).rejects.toThrow(
        "Text search failed: Validation failed for field 'query': Field 'query' value 1001 is out of range. Expected less than or equal to 1000",
      );
      await expect(
        searchRepository.searchByText('DROP TABLE users;'),
      ).rejects.toThrow(
        "Text search failed: Validation failed for field 'query': Field 'query' violates constraint: contains potentially dangerous SQL patterns",
      );
    });

    it('should cache text search results', async () => {
      // Arrange
      const query = 'test query';

      mockDbService.executeQuery.mockResolvedValue([]);

      // Act
      await searchRepository.searchByText(query);
      await searchRepository.searchByText(query); // Second call should use cache

      // Assert
      expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSuggestions', () => {
    it('should get suggestions successfully', async () => {
      // Arrange
      const prefix = 'react';
      const limit = 10;

      const mockResults = [
        { text: 'react', type: 'tag', score: 100, context: null },
        { text: 'reactjs', type: 'tag', score: 50, context: null },
        {
          text: 'ReactComponent.tsx',
          type: 'filename',
          score: 25,
          context: '/src/components/',
        },
      ];

      mockDbService.executeQuery.mockResolvedValue(mockResults);

      // Act
      const result = await searchRepository.getSuggestions(prefix, limit);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        text: 'react',
        type: 'tag',
        score: 100,
      });
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tags MATCH ?'),
        expect.arrayContaining(['react*']),
      );
    });

    it('should validate suggestion prefix', async () => {
      // Arrange & Act & Assert
      await expect(
        searchRepository.getSuggestions('a'.repeat(101)),
      ).rejects.toThrow(
        "Suggestions query failed: Validation failed for field 'prefix': Field 'prefix' value 101 is out of range. Expected less than or equal to 100",
      );
    });
  });

  describe('rebuildIndex', () => {
    it('should rebuild index successfully', async () => {
      // Arrange
      const options = {
        onProgress: jest.fn(),
      };

      mockDbService.executeRun.mockResolvedValue({
        changes: 0,
        lastInsertRowid: 0,
      });
      mockDbService.executeOne.mockResolvedValue({ count: 100 });

      // Act
      const result = await searchRepository.rebuildIndex(options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.operation).toBe('rebuild');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockDbService.executeRun).toHaveBeenCalledWith(
        "INSERT INTO files_fts(files_fts) VALUES('rebuild')",
      );
      expect(options.onProgress).toHaveBeenCalledWith(
        0,
        'Starting index rebuild...',
      );
      expect(options.onProgress).toHaveBeenCalledWith(
        50,
        'Index rebuilt, optimizing...',
      );
      expect(options.onProgress).toHaveBeenCalledWith(
        100,
        'Index rebuild complete',
      );
    });

    it('should handle rebuild errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockDbService.executeRun.mockRejectedValue(error);

      // Act
      const result = await searchRepository.rebuildIndex();

      // Assert
      expect(result.success).toBe(false);
      expect(result.operation).toBe('rebuild');
      expect(result.error).toBe('Database error');
    });
  });

  describe('optimizeIndex', () => {
    it('should optimize index successfully', async () => {
      // Arrange
      mockDbService.executeRun.mockResolvedValue({
        changes: 0,
        lastInsertRowid: 0,
      });
      mockDbService.executeOne.mockResolvedValue({ count: 100 });

      // Act
      const result = await searchRepository.optimizeIndex();

      // Assert
      expect(result.success).toBe(true);
      expect(result.operation).toBe('optimize');
      expect(mockDbService.executeRun).toHaveBeenCalledWith(
        "INSERT INTO files_fts(files_fts) VALUES('optimize')",
      );
      expect(mockDbService.executeRun).toHaveBeenCalledWith('ANALYZE');
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      // Act
      const stats = searchRepository.getStats();

      // Assert
      expect(stats).toMatchObject({
        totalSearches: 0,
        avgSearchTime: 0,
        cacheHitRate: 0,
        indexSize: 0,
        documentCount: 0,
        lastIndexUpdate: 0,
      });
    });

    it('should update statistics after searches', async () => {
      // Arrange
      mockDbService.executeQuery.mockResolvedValue([]);

      // Act
      await searchRepository.searchByTags(['test']);
      await searchRepository.searchByTags(['test']); // Should hit cache

      // Assert
      const stats = searchRepository.getStats();
      expect(stats.totalSearches).toBe(2);
      expect(stats.avgSearchTime).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBe(50); // 1 cache hit out of 2 searches
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      // Arrange
      mockDbService.executeQuery.mockResolvedValue([]);
      await searchRepository.searchByTags(['test']); // Populate cache

      // Act
      searchRepository.clearCache();
      await searchRepository.searchByTags(['test']); // Should not use cache

      // Assert
      expect(mockDbService.executeQuery).toHaveBeenCalledTimes(2); // Called twice, no cache hit
    });
  });

  describe('error handling', () => {
    it('should wrap database errors in DatabaseError', async () => {
      // Arrange
      const dbError = new Error('Connection failed');
      mockDbService.executeQuery.mockRejectedValue(dbError);

      // Act & Assert
      await expect(searchRepository.searchByTags(['test'])).rejects.toThrow(
        DatabaseError,
      );
    });

    it('should handle malformed database responses', async () => {
      // Arrange
      mockDbService.executeQuery.mockResolvedValue([null, undefined, {}]);

      // Act
      const result = await searchRepository.searchByTags(['test']);

      // Assert
      expect(result).toHaveLength(3); // All rows should be mapped, even null/undefined ones
      expect(result[0]).toMatchObject({
        id: '',
        path: '',
        filename: '',
        score: 0,
        matches: [],
      });
    });
  });

  describe('tag expansion', () => {
    it('should expand tags with common variations', async () => {
      // Arrange
      const tags = ['js', 'ts'];
      mockDbService.executeQuery.mockResolvedValue([]);

      // Act
      await searchRepository.searchByTags(tags);

      // Assert
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE files_fts MATCH ? OR files_fts MATCH ?'),
        expect.arrayContaining([
          expect.stringMatching(/js/i),
          expect.stringMatching(/javascript/i),
          expect.stringMatching(/ts/i),
          expect.stringMatching(/typescript/i),
        ]),
      );
    });
  });

  describe('pagination', () => {
    it('should handle pagination correctly', async () => {
      // Arrange
      const options: SearchOptions = { limit: 10, offset: 20 };
      mockDbService.executeQuery.mockResolvedValue([]);

      // Act
      await searchRepository.searchByTags(['test'], options);

      // Assert
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([10, 20]),
      );
    });
  });

  describe('minimum score filtering', () => {
    it('should filter by minimum score', async () => {
      // Arrange
      const options: SearchOptions = { minScore: 0.5 };
      mockDbService.executeQuery.mockResolvedValue([]);

      // Act
      await searchRepository.searchByTags(['test'], options);

      // Assert
      expect(mockDbService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND fts.rank >= ?'),
        expect.arrayContaining([0.5]),
      );
    });
  });
});

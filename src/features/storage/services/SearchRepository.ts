/**
 * Search Repository - FTS5 integration for full-text search
 *
 * Provides efficient candidate retrieval for the QueryEngine with proper
 * ranking and filtering capabilities using SQLite FTS5 extension.
 */

import type {
  SearchCandidate,
  SearchOptions,
  SearchSuggestion,
  IndexMaintenanceOptions,
  IndexMaintenanceResult,
  SearchStats,
  SearchMatch,
} from '../types/StorageTypes';
import { DatabaseErrorType } from '../../../shared/errors/DatabaseError';
import { ErrorFactory } from '../../../shared/errors/ErrorFactory';
import { ErrorMigration } from '../../../shared/errors/ErrorMigration';
import { TIME_INTERVALS } from '../config/PerformanceConstants';
import { PERFORMANCE_THRESHOLDS } from '../config/PerformanceThresholds';
import { LogManager } from '../../../shared/utils/LogManager';
import {
  SERVICE_CONTEXTS,
  ERROR_AGGREGATION,
} from '../../../shared/utils/LoggingConstants';
import { ErrorAggregator } from '../../../shared/utils/ErrorLogger';

import type { DatabaseService } from './DatabaseService';

/**
 * Search Repository class for FTS5 operations
 */
export class SearchRepository {
  private readonly db: DatabaseService;
  private cache = new Map<
    string,
    { results: SearchCandidate[]; timestamp: number }
  >();
  private readonly cacheTimeout = TIME_INTERVALS.FIVE_MINUTES_MS;
  private readonly logger = LogManager.getLogger(SERVICE_CONTEXTS.QUERYING);
  private readonly errorAggregator = new ErrorAggregator();
  private totalSearchErrors = 0;
  private lastErrorCheck = Date.now();
  private stats: SearchStats = {
    totalSearches: 0,
    avgSearchTime: 0,
    cacheHitRate: 0,
    indexSize: 0,
    documentCount: 0,
    lastIndexUpdate: 0,
  };

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Search files by tags using FTS5
   *
   * @param tags - Array of tags to search for (1-5 tags limit)
   * @param options - Search options including filters and pagination
   * @returns Promise resolving to array of search candidates
   */
  async searchByTags(
    tags: string[],
    options?: SearchOptions,
  ): Promise<SearchCandidate[]> {
    const startTime = Date.now();

    try {
      // Validate input
      this.validateTags(tags);

      // Generate cache key
      const cacheKey = this.generateCacheKey('tags', tags, options);

      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.updateStats(Date.now() - startTime, true);
        return cached;
      }

      // Build and execute query
      const query = this.buildTagSearchQuery(tags, options);
      const results = await this.executeQuery(query, options);

      // Cache results
      this.setCache(cacheKey, results);

      // Update statistics
      this.updateStats(Date.now() - startTime, false);

      return results;
    } catch (error) {
      // Record error in aggregator for monitoring
      this.errorAggregator.recordError(
        error instanceof Error ? error : new Error('Unknown error'),
        'searchByTags',
      );
      this.totalSearchErrors++;

      throw ErrorFactory.database(
        DatabaseErrorType.QUERY_FAILED,
        `Tag search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          query: 'searchByTags',
          params: [tags, options],
          context: { operation: 'searchByTags' },
          original: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Search files by natural language text query
   *
   * @param query - Natural language search query
   * @param options - Search options including filters and pagination
   * @returns Promise resolving to array of search candidates
   */
  async searchByText(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchCandidate[]> {
    const startTime = Date.now();

    try {
      // Validate input
      this.validateTextQuery(query);

      // Generate cache key
      const cacheKey = this.generateCacheKey('text', [query], options);

      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.updateStats(Date.now() - startTime, true);
        return cached;
      }

      // Build and execute query
      const searchQuery = this.buildTextSearchQuery(query, options);
      const results = await this.executeQuery(searchQuery, options);

      // Cache results
      this.setCache(cacheKey, results);

      // Update statistics
      this.updateStats(Date.now() - startTime, false);

      return results;
    } catch (error) {
      // Record error in aggregator for monitoring
      this.errorAggregator.recordError(
        error instanceof Error ? error : new Error('Unknown error'),
        'searchByText',
      );
      this.totalSearchErrors++;

      throw ErrorFactory.database(
        DatabaseErrorType.QUERY_FAILED,
        `Text search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          query: 'searchByText',
          params: [query, options],
          context: { operation: 'searchByText' },
          original: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Get search suggestions for autocomplete
   *
   * @param prefix - Text prefix to get suggestions for
   * @param limit - Maximum number of suggestions to return
   * @returns Promise resolving to array of suggestions
   */
  async getSuggestions(
    prefix: string,
    limit: number = 20,
  ): Promise<SearchSuggestion[]> {
    try {
      // Validate input
      this.validateSuggestionPrefix(prefix);

      const query = this.buildSuggestionsQuery(prefix, limit);
      const results = await this.db.executeQuery(query.sql, query.params);

      return results.map((row: any) => ({
        text: row.text,
        type: row.type,
        score: row.score,
        context: row.context,
      }));
    } catch (error) {
      // Record error in aggregator for monitoring
      this.errorAggregator.recordError(
        error instanceof Error ? error : new Error('Unknown error'),
        'getSuggestions',
      );
      this.totalSearchErrors++;

      throw ErrorFactory.database(
        DatabaseErrorType.QUERY_FAILED,
        `Suggestions query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          query: 'getSuggestions',
          params: [prefix, limit],
          context: { operation: 'getSuggestions' },
          original: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Rebuild the FTS5 index
   *
   * @param options - Maintenance options with progress callback
   * @returns Promise resolving to maintenance result
   */
  async rebuildIndex(
    options?: IndexMaintenanceOptions,
  ): Promise<IndexMaintenanceResult> {
    const startTime = Date.now();

    try {
      const sizeBefore = await this.getIndexSize();

      // Report progress
      options?.onProgress?.(0, 'Starting index rebuild...');

      // Execute rebuild
      await this.db.executeRun(
        "INSERT INTO files_fts(files_fts) VALUES('rebuild')",
      );

      options?.onProgress?.(50, 'Index rebuilt, optimizing...');

      // Optimize after rebuild
      await this.optimizeIndex(options);

      options?.onProgress?.(100, 'Index rebuild complete');

      const sizeAfter = await this.getIndexSize();

      // Clear cache since index has changed
      this.cache.clear();

      return {
        success: true,
        operation: 'rebuild',
        duration: Date.now() - startTime,
        sizeBefore,
        sizeAfter,
      };
    } catch (error) {
      // Record error in aggregator for monitoring
      this.errorAggregator.recordError(
        error instanceof Error ? error : new Error('Unknown error'),
        'rebuildIndex',
      );
      this.totalSearchErrors++;

      return {
        success: false,
        operation: 'rebuild',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Optimize the FTS5 index
   *
   * @param options - Maintenance options with progress callback
   * @returns Promise resolving to maintenance result
   */
  async optimizeIndex(
    options?: IndexMaintenanceOptions,
  ): Promise<IndexMaintenanceResult> {
    const startTime = Date.now();

    try {
      const sizeBefore = await this.getIndexSize();

      options?.onProgress?.(0, 'Starting index optimization...');

      // Run optimization commands
      await this.db.executeRun(
        "INSERT INTO files_fts(files_fts) VALUES('optimize')",
      );

      options?.onProgress?.(50, 'Analyzing index...');

      // Analyze for better query planning
      await this.db.executeRun('ANALYZE');

      options?.onProgress?.(100, 'Index optimization complete');

      const sizeAfter = await this.getIndexSize();

      return {
        success: true,
        operation: 'optimize',
        duration: Date.now() - startTime,
        sizeBefore,
        sizeAfter,
      };
    } catch (error) {
      // Record error in aggregator for monitoring
      this.errorAggregator.recordError(
        error instanceof Error ? error : new Error('Unknown error'),
        'optimizeIndex',
      );
      this.totalSearchErrors++;

      return {
        success: false,
        operation: 'optimize',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get search statistics
   *
   * @returns Current search statistics
   */
  getStats(): SearchStats {
    return { ...this.stats };
  }

  /**
   * Clear the search cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Validate tags array
   */
  private validateTags(tags: string[]): void {
    if (!Array.isArray(tags)) {
      const actualType = Array.isArray(tags) ? 'array' : typeof tags;
      const error = ErrorFactory.validation(
        `Field 'tags' has invalid type. Expected array, got ${actualType}`,
        'tags',
        tags,
      );
      this.logger.warn('Tag validation failed: invalid type', {
        field: 'tags',
        value: tags,
        expectedType: 'array',
        operation: 'validateTags',
      });
      throw error;
    }

    if (tags.length === 0) {
      const error = ErrorFactory.validation(
        `Field 'tags' violates constraint: at least one tag required`,
        'tags',
        tags,
      );
      this.logger.warn('Tag validation failed: empty array', {
        field: 'tags',
        value: tags,
        constraint: 'minimum length 1',
        operation: 'validateTags',
      });
      throw error;
    }

    if (tags.length > 5) {
      const error = ErrorFactory.validation(
        `Field 'tags' value ${tags.length} is out of range. Expected less than or equal to 5`,
        'tags',
        tags.length,
      );
      this.logger.warn('Tag validation failed: too many tags', {
        field: 'tags',
        value: tags.length,
        constraint: 'maximum 5 tags',
        operation: 'validateTags',
      });
      throw error;
    }

    for (let i = 0; i < tags.length; i++) {
      const tag = tags.at(i);
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        const actualType = typeof tag;
        const error = ErrorFactory.validation(
          `Field 'tags' at index ${i} has invalid type. Expected non-empty string, got ${actualType}`,
          'tags',
          tag,
        );
        this.logger.warn('Tag validation failed: invalid tag', {
          field: 'tags',
          index: i,
          value: tag,
          expectedType: 'non-empty string',
          operation: 'validateTags',
        });
        throw error;
      }

      if (tag.length > 100) {
        const error = ErrorFactory.validation(
          `Field 'tags' at index ${i} value ${tag.length} is out of range. Expected less than or equal to 100`,
          'tags',
          tag.length,
        );
        this.logger.warn('Tag validation failed: tag too long', {
          field: 'tags',
          index: i,
          value: tag.length,
          constraint: 'maximum 100 characters',
          operation: 'validateTags',
        });
        throw error;
      }

      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        /["']\s*;/,
        /\b(drop|delete|update|insert|alter|create)\b/i,
        /--/,
        /\/\*/,
        /\*\//,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(tag)) {
          const error = ErrorFactory.validation(
            `Field 'tags' at index ${i} violates constraint: contains potentially dangerous SQL patterns`,
            'tags',
            tag,
          );
          this.logger.warn(
            'Tag validation failed: dangerous patterns detected',
            {
              field: 'tags',
              index: i,
              value: tag,
              constraint: 'no SQL injection patterns',
              operation: 'validateTags',
              pattern: pattern.toString(),
            },
          );
          throw error;
        }
      }
    }
  }

  /**
   * Validate text query
   */
  private validateTextQuery(query: string): void {
    if (typeof query !== 'string') {
      const actualType = typeof query;
      const error = ErrorFactory.validation(
        `Field 'query' has invalid type. Expected string, got ${actualType}`,
        'query',
        query,
      );
      this.logger.warn('Text query validation failed: invalid type', {
        field: 'query',
        value: query,
        expectedType: 'string',
        operation: 'validateTextQuery',
      });
      throw error;
    }

    if (query.trim().length === 0) {
      const error = ErrorFactory.validation(
        `Field 'query' violates constraint: cannot be empty or whitespace only`,
        'query',
        query,
      );
      this.logger.warn('Text query validation failed: empty query', {
        field: 'query',
        value: query,
        constraint: 'non-empty string',
        operation: 'validateTextQuery',
      });
      throw error;
    }

    if (query.length > 1000) {
      const error = ErrorFactory.validation(
        `Field 'query' value ${query.length} is out of range. Expected less than or equal to 1000`,
        'query',
        query.length,
      );
      this.logger.warn('Text query validation failed: query too long', {
        field: 'query',
        value: query.length,
        constraint: 'maximum 1000 characters',
        operation: 'validateTextQuery',
      });
      throw error;
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /["']\s*;/,
      /\b(drop|delete|update|insert|alter|create)\b/i,
      /--/,
      /\/\*/,
      /\*\//,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        const error = ErrorFactory.validation(
          `Field 'query' violates constraint: contains potentially dangerous SQL patterns`,
          'query',
          query,
        );
        this.logger.warn(
          'Text query validation failed: dangerous patterns detected',
          {
            field: 'query',
            value: query,
            constraint: 'no SQL injection patterns',
            operation: 'validateTextQuery',
            pattern: pattern.toString(),
          },
        );
        throw error;
      }
    }
  }

  /**
   * Validate suggestion prefix
   */
  private validateSuggestionPrefix(prefix: string): void {
    if (typeof prefix !== 'string') {
      const actualType = typeof prefix;
      const error = ErrorFactory.validation(
        `Field 'prefix' has invalid type. Expected string, got ${actualType}`,
        'prefix',
        prefix,
      );
      this.logger.warn('Suggestion prefix validation failed: invalid type', {
        field: 'prefix',
        value: prefix,
        expectedType: 'string',
        operation: 'validateSuggestionPrefix',
      });
      throw error;
    }

    if (prefix.length > 100) {
      const error = ErrorFactory.validation(
        `Field 'prefix' value ${prefix.length} is out of range. Expected less than or equal to 100`,
        'prefix',
        prefix.length,
      );
      this.logger.warn('Suggestion prefix validation failed: prefix too long', {
        field: 'prefix',
        value: prefix.length,
        constraint: 'maximum 100 characters',
        operation: 'validateSuggestionPrefix',
      });
      throw error;
    }
  }

  /**
   * Generate cache key for search queries
   */
  private generateCacheKey(
    type: 'tags' | 'text',
    terms: string[],
    options?: SearchOptions,
  ): string {
    const key = {
      type,
      terms: terms.sort(), // Sort for consistent keys
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
      filters: options?.filters ?? {},
      includeSnippets: options?.includeSnippets ?? false,
      minScore: options?.minScore ?? 0,
    };

    return JSON.stringify(key);
  }

  /**
   * Get results from cache if valid
   */
  private getFromCache(key: string): SearchCandidate[] | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.results;
  }

  /**
   * Set results in cache
   */
  private setCache(key: string, results: SearchCandidate[]): void {
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
    });

    // Clean up old cache entries periodically
    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Update search statistics
   */
  private updateStats(duration: number, cacheHit: boolean): void {
    this.stats.totalSearches++;

    // Update average search time
    this.stats.avgSearchTime =
      (this.stats.avgSearchTime * (this.stats.totalSearches - 1) + duration) /
      this.stats.totalSearches;

    // Update cache hit rate
    const totalCacheable = this.stats.totalSearches;
    const cacheHits =
      Math.round((this.stats.cacheHitRate * (totalCacheable - 1)) / 100) +
      (cacheHit ? 1 : 0);
    this.stats.cacheHitRate = (cacheHits / totalCacheable) * 100;
  }

  /**
   * Get current index size
   */
  private async getIndexSize(): Promise<number> {
    try {
      const result = await this.db.executeOne(
        'SELECT COUNT(*) as count FROM files_fts',
      );
      return (result as { count: number }).count;
    } catch {
      return 0;
    }
  }

  /**
   * Execute search query and map results
   */
  private async executeQuery(
    query: { sql: string; params: unknown[] },
    options?: SearchOptions,
  ): Promise<SearchCandidate[]> {
    try {
      const rows = await this.db.executeQuery(query.sql, query.params);

      return rows.map((row: any) => this.mapRowToSearchCandidate(row, options));
    } catch (error) {
      throw ErrorFactory.database(
        DatabaseErrorType.QUERY_FAILED,
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          query: query.sql,
          params: query.params,
          context: { operation: 'executeQuery' },
          original: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Map database row to SearchCandidate
   */
  private mapRowToSearchCandidate(
    row: any,
    options?: SearchOptions,
  ): SearchCandidate {
    // Handle null/undefined rows
    if (!row) {
      return {
        id: '',
        path: '',
        filename: '',
        score: 0,
        matches: [],
        metadata: {
          extension: '',
          language: '',
          size: 0,
          lastModified: 0,
        },
      };
    }

    const matches: SearchMatch[] = [];

    // Add matches based on available snippets
    if (options?.includeSnippets) {
      if (row.filename_snippet) {
        matches.push({
          field: 'filename',
          snippet: row.filename_snippet,
          startPosition: 0,
          endPosition: row.filename?.length ?? 0,
          terms: [],
        });
      }

      if (row.path_snippet) {
        matches.push({
          field: 'path',
          snippet: row.path_snippet,
          startPosition: 0,
          endPosition: row.path?.length ?? 0,
          terms: [],
        });
      }

      if (row.definitions_snippet) {
        matches.push({
          field: 'definitions',
          snippet: row.definitions_snippet,
          startPosition: 0,
          endPosition: row.definitions?.length ?? 0,
          terms: [],
        });
      }

      if (row.imports_snippet) {
        matches.push({
          field: 'imports',
          snippet: row.imports_snippet,
          startPosition: 0,
          endPosition: row.imports?.length ?? 0,
          terms: [],
        });
      }

      if (row.docstrings_snippet) {
        matches.push({
          field: 'docstrings',
          snippet: row.docstrings_snippet,
          startPosition: 0,
          endPosition: row.docstrings?.length ?? 0,
          terms: [],
        });
      }
    }

    return {
      id: row.id ?? '',
      path: row.path ?? '',
      filename: row.filename ?? '',
      score: row.rank ?? 0,
      matches,
      metadata: {
        extension: row.extension ?? '',
        language: row.language ?? '',
        size: row.size ?? 0,
        lastModified: row.lastModified ?? 0,
      },
    };
  }

  /**
   * Build tag search query
   */
  private buildTagSearchQuery(
    tags: string[],
    options?: SearchOptions,
  ): { sql: string; params: unknown[] } {
    // Expand tags for broader matching
    const expandedTags = this.expandTags(tags);

    // Build parameterized MATCH conditions for security
    const matchConditions = expandedTags
      .map(() => 'files_fts MATCH ?')
      .join(' OR ');

    const defaultLimit = 50;
    const opts = options ?? {};
    const limit = opts.overRetrieve
      ? (opts.limit ?? defaultLimit) * 2
      : (opts.limit ?? defaultLimit);
    const offset = opts.offset ?? 0;

    let sql = `
      SELECT
        f.id,
        f.path,
        f.filename,
        f.extension,
        f.language,
        f.size,
        f.lastModified,
        fts.rank,
        ${
          opts.includeSnippets
            ? `
          snippet(files_fts, 0, '<mark>', '</mark>', '...', 32) as filename_snippet,
          snippet(files_fts, 1, '<mark>', '</mark>', '...', 64) as path_snippet,
          snippet(files_fts, 2, '<mark>', '</mark>', '...', 128) as definitions_snippet,
        `
            : ''
        }
        1 as match_count
      FROM files f
      JOIN files_fts fts ON f.rowid = fts.rowid
      WHERE ${matchConditions}
    `;

    const params: unknown[] = [...expandedTags];

    // Add filters
    if (opts.filters) {
      if (opts.filters.language) {
        sql += ' AND f.language = ?';
        params.push(opts.filters.language);
      }

      if (opts.filters.fileType) {
        sql += ' AND f.extension = ?';
        params.push(opts.filters.fileType);
      }

      if (opts.filters.path) {
        sql += ' AND f.path LIKE ?';
        params.push(`%${opts.filters.path}%`);
      }

      if (opts.filters.sizeRange) {
        if (opts.filters.sizeRange.min !== undefined) {
          sql += ' AND f.size >= ?';
          params.push(opts.filters.sizeRange.min);
        }

        if (opts.filters.sizeRange.max !== undefined) {
          sql += ' AND f.size <= ?';
          params.push(opts.filters.sizeRange.max);
        }
      }

      if (opts.filters.dateRange) {
        if (opts.filters.dateRange.after !== undefined) {
          sql += ' AND f.lastModified >= ?';
          params.push(opts.filters.dateRange.after);
        }

        if (opts.filters.dateRange.before !== undefined) {
          sql += ' AND f.lastModified <= ?';
          params.push(opts.filters.dateRange.before);
        }
      }
    }

    // Add minimum score filter
    if (opts.minScore && opts.minScore > 0) {
      sql += ' AND fts.rank >= ?';
      params.push(opts.minScore);
    }

    sql += ' ORDER BY fts.rank DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return { sql, params };
  }

  /**
   * Build text search query
   */
  private buildTextSearchQuery(
    query: string,
    options?: SearchOptions,
  ): { sql: string; params: unknown[] } {
    const defaultLimit = 50;
    const opts = options ?? {};
    const limit = opts.overRetrieve
      ? (opts.limit ?? defaultLimit) * 2
      : (opts.limit ?? defaultLimit);
    const offset = opts.offset ?? 0;

    let sql = `
      SELECT 
        f.id,
        f.path,
        f.filename,
        f.extension,
        f.language,
        f.size,
        f.lastModified,
        fts.rank,
        ${
          opts.includeSnippets
            ? `
          snippet(files_fts, 0, '<mark>', '</mark>', '...', 32) as filename_snippet,
          snippet(files_fts, 1, '<mark>', '</mark>', '...', 64) as path_snippet,
          snippet(files_fts, 2, '<mark>', '</mark>', '...', 128) as definitions_snippet,
          snippet(files_fts, 3, '<mark>', '</mark>', '...', 128) as imports_snippet,
          snippet(files_fts, 4, '<mark>', '</mark>', '...', 128) as docstrings_snippet,
        `
            : ''
        }
        1 as match_count
      FROM files f
      JOIN files_fts fts ON f.rowid = fts.rowid
      WHERE files_fts MATCH ?
    `;

    const params: unknown[] = [query];

    // Add filters (same as tag search)
    if (opts.filters) {
      if (opts.filters.language) {
        sql += ' AND f.language = ?';
        params.push(opts.filters.language);
      }

      if (opts.filters.fileType) {
        sql += ' AND f.extension = ?';
        params.push(opts.filters.fileType);
      }

      if (opts.filters.path) {
        sql += ' AND f.path LIKE ?';
        params.push(`%${opts.filters.path}%`);
      }

      if (opts.filters.sizeRange) {
        if (opts.filters.sizeRange.min !== undefined) {
          sql += ' AND f.size >= ?';
          params.push(opts.filters.sizeRange.min);
        }

        if (opts.filters.sizeRange.max !== undefined) {
          sql += ' AND f.size <= ?';
          params.push(opts.filters.sizeRange.max);
        }
      }

      if (opts.filters.dateRange) {
        if (opts.filters.dateRange.after !== undefined) {
          sql += ' AND f.lastModified >= ?';
          params.push(opts.filters.dateRange.after);
        }

        if (opts.filters.dateRange.before !== undefined) {
          sql += ' AND f.lastModified <= ?';
          params.push(opts.filters.dateRange.before);
        }
      }
    }

    // Add minimum score filter
    if (opts.minScore && opts.minScore > 0) {
      sql += ' AND fts.rank >= ?';
      params.push(opts.minScore);
    }

    sql += ' ORDER BY fts.rank DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return { sql, params };
  }

  /**
   * Build suggestions query
   */
  private buildSuggestionsQuery(
    prefix: string,
    limit: number,
  ): { sql: string; params: unknown[] } {
    const sql = `
      SELECT DISTINCT 
        substr(tags, instr(tags, ?)) as text,
        'tag' as type,
        COUNT(*) as score,
        NULL as context
      FROM files_fts 
      WHERE tags MATCH ?
      GROUP BY text
      ORDER BY score DESC
      LIMIT ?
      
      UNION ALL
      
      SELECT DISTINCT 
        substr(filename, instr(filename, ?)) as text,
        'filename' as type,
        COUNT(*) as score,
        path as context
      FROM files_fts 
      WHERE filename MATCH ?
      GROUP BY text
      ORDER BY score DESC
      LIMIT ?
    `;

    const prefixPattern = `${prefix}*`;

    return {
      sql,
      params: [
        prefix,
        prefixPattern,
        Math.floor(limit / 2),
        prefix,
        prefixPattern,
        Math.ceil(limit / 2),
      ],
    };
  }

  /**
   * Expand tags for broader matching
   */
  private expandTags(tags: string[]): string[] {
    const expanded: string[] = [];

    for (const tag of tags) {
      expanded.push(tag);

      // Add case variations only if different from original
      const lowerTag = tag.toLowerCase();
      const upperTag = tag.toUpperCase();

      if (lowerTag !== tag) {
        expanded.push(lowerTag);
      }
      if (upperTag !== tag && upperTag !== lowerTag) {
        expanded.push(upperTag);
      }

      // Add common substitutions
      const substitutions = this.getTagSubstitutions(tag);
      expanded.push(...substitutions);
    }

    // Remove duplicates while preserving order
    return [...new Set(expanded)];
  }

  /**
   * Get common tag substitutions
   */
  private getTagSubstitutions(tag: string): string[] {
    const substitutions: string[] = [];

    // Common programming language substitutions
    const languageMap: Record<string, string[]> = {
      js: ['javascript'],
      ts: ['typescript'],
      py: ['python'],
      rb: ['ruby'],
      go: ['golang'],
      cs: ['csharp', 'c#'],
      cpp: ['c++'],
    };

    const languageSubstitutions = languageMap[tag.toLowerCase()];
    if (languageSubstitutions) {
      substitutions.push(...languageSubstitutions);
    }

    // Common framework substitutions
    const frameworkMap: Record<string, string[]> = {
      react: ['jsx', 'tsx'],
      vue: ['vuejs'],
      angular: ['ng'],
      express: ['expressjs'],
      django: ['djangopython'],
    };

    const frameworkSubstitutions = frameworkMap[tag.toLowerCase()];
    if (frameworkSubstitutions) {
      substitutions.push(...frameworkSubstitutions);
    }

    return substitutions;
  }

  /**
   * Create error boundary with automatic migration
   * Wraps operations that might throw legacy errors
   */
  private withErrorMigration<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return ErrorMigration.createAsyncErrorBoundary(operation, fn);
  }

  /**
   * Get error statistics and monitoring information
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorRate: number; // errors per minute
    criticalErrors: string[];
    recentErrorRate: number; // errors per minute in last 5 minutes
    errorTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    const now = Date.now();
    const timeSinceLastCheck = (now - this.lastErrorCheck) / (1000 * 60); // minutes
    const errorRate =
      timeSinceLastCheck > 0 ? this.totalSearchErrors / timeSinceLastCheck : 0;

    // Get recent error rate (last 5 minutes)
    const recentErrorRate = this.errorAggregator.getRealTimeErrorRate(5);

    // Get critical errors from aggregator
    const aggregatorStats = this.errorAggregator.getErrorStatistics();
    const criticalErrors = aggregatorStats.criticalErrors;

    return {
      totalErrors: this.totalSearchErrors,
      errorRate,
      criticalErrors,
      recentErrorRate: recentErrorRate.errorsPerMinute,
      errorTrend: recentErrorRate.trend,
    };
  }

  /**
   * Check for critical search failures and generate alerts
   */
  checkSearchFailureAlerts(): {
    alerts: string[];
    warnings: string[];
  } {
    const alerts: string[] = [];
    const warnings: string[] = [];

    const stats = this.getErrorStatistics();
    const aggregatorStats = this.errorAggregator.getErrorStatistics();

    // Check error rate thresholds
    if (
      stats.recentErrorRate >
      PERFORMANCE_THRESHOLDS.CRITICAL_ERROR_RATE_THRESHOLD
    ) {
      alerts.push(
        `Critical search error rate: ${stats.recentErrorRate.toFixed(2)} errors/minute (threshold: ${PERFORMANCE_THRESHOLDS.CRITICAL_ERROR_RATE_THRESHOLD})`,
      );
    } else if (
      stats.recentErrorRate > PERFORMANCE_THRESHOLDS.ERROR_RATE_THRESHOLD
    ) {
      warnings.push(
        `High search error rate: ${stats.recentErrorRate.toFixed(2)} errors/minute (threshold: ${PERFORMANCE_THRESHOLDS.ERROR_RATE_THRESHOLD})`,
      );
    }

    // Check for critical errors
    if (stats.criticalErrors.length > 0) {
      alerts.push(
        `Critical search errors detected: ${stats.criticalErrors.join(', ')}`,
      );
    }

    // Check error trend
    if (stats.errorTrend === 'increasing') {
      warnings.push('Search error rate is increasing - monitor closely');
    }

    // Check for high frequency errors
    if (
      aggregatorStats.mostFrequentError &&
      aggregatorStats.mostFrequentError.count >
        ERROR_AGGREGATION.CRITICAL_THRESHOLD
    ) {
      alerts.push(
        `Frequent search error: ${aggregatorStats.mostFrequentError.type} (${aggregatorStats.mostFrequentError.count} occurrences)`,
      );
    }

    return { alerts, warnings };
  }

  /**
   * Log aggregated error report for search operations
   */
  logErrorReport(): void {
    this.errorAggregator.logAggregatedErrors(this.logger);
  }

  /**
   * Reset error statistics (useful for testing or manual reset)
   */
  resetErrorStatistics(): void {
    this.errorAggregator.reset();
    this.totalSearchErrors = 0;
    this.lastErrorCheck = Date.now();
  }
}

import { ErrorMigration } from '@/shared/errors/ErrorMigration';
import { ValidationError } from '@/shared/errors/ValidationError';
import { LogManager } from '@/shared/utils/LogManager';

/**
 * Error factory methods for consistent error creation in query builders
 */
const QueryBuilderErrorFactory = {
  /**
   * Create validation error for invalid format
   */
  invalidFormat(
    field: string,
    value: any,
    expectedFormat: string,
  ): ValidationError {
    return ValidationError.invalidFormat(field, value, expectedFormat);
  },

  /**
   * Create validation error for invalid input
   */
  invalidInput(
    input: any,
    expectedType?: string,
    field?: string,
  ): ValidationError {
    return ValidationError.invalidInput(input, expectedType, field);
  },

  /**
   * Create validation error for invalid type
   */
  invalidType(
    field: string,
    value: any,
    expectedType: string,
  ): ValidationError {
    return ValidationError.invalidType(field, value, expectedType);
  },

  /**
   * Create validation error for constraint violation
   */
  constraintViolation(
    field: string,
    constraint: string,
    value?: any,
  ): ValidationError {
    return ValidationError.constraintViolation(field, constraint, value);
  },

  /**
   * Create validation error for out of range values
   */
  outOfRange(
    field: string,
    value: number,
    min?: number,
    max?: number,
  ): ValidationError {
    return ValidationError.outOfRange(field, value, min, max);
  },

  /**
   * Migrate legacy errors to ServiceError types
   */
  migrateError(
    error: Error,
    operation?: string,
  ): ReturnType<typeof ErrorMigration.migrateError> {
    return ErrorMigration.migrateError(error, operation);
  },

  /**
   * Create error boundary with automatic migration
   */
  createErrorBoundary<T>(operation: string, fn: () => T): T {
    return ErrorMigration.createErrorBoundary(operation, fn);
  },

  /**
   * Create async error boundary with automatic migration
   */
  createAsyncErrorBoundary<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return ErrorMigration.createAsyncErrorBoundary(operation, fn);
  },
};

/**
 * Query builder utilities for SQLite operations
 */

/**
 * SQL query builder class
 */
export class QueryBuilder {
  private query = '';
  private params: unknown[] = [];
  private logger = LogManager.getLogger('QueryBuilder');

  /**
   * Validate SQL identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[A-Z_a-z]\w*$/.test(identifier)) {
      this.logger.warn('Invalid SQL identifier detected', {
        operation: 'validateIdentifier',
        identifier,
        context: { queryBuilder: 'QueryBuilder' },
      });
      throw QueryBuilderErrorFactory.invalidFormat(
        'identifier',
        identifier,
        'valid SQL identifier (letters, numbers, underscores, starting with letter or underscore)',
      );
    }
  }

  /**
   * Validate table name
   */
  private validateTableName(table: string): void {
    this.validateIdentifier(table);
  }

  /**
   * Validate column name
   */
  private validateColumn(column: string): void {
    // Allow for qualified column names (table.column)
    const parts = column.split('.');
    parts.forEach(part => this.validateIdentifier(part));
  }

  /**
   * Start a SELECT query
   */
  select(columns: string | string[] = '*'): QueryBuilder {
    const cols = Array.isArray(columns) ? columns.join(', ') : columns;
    this.query = `SELECT ${cols}`;
    return this;
  }

  /**
   * Add FROM clause
   */
  from(table: string): QueryBuilder {
    this.validateTableName(table);
    this.query += ` FROM ${table}`;
    return this;
  }

  /**
   * Add WHERE clause
   */
  where(condition: string, ...params: unknown[]): QueryBuilder {
    if (this.query.includes('WHERE')) {
      this.query += ` AND ${condition}`;
    } else {
      this.query += ` WHERE ${condition}`;
    }
    this.params.push(...params);
    return this;
  }

  /**
   * Add WHERE clause with OR
   */
  orWhere(condition: string, ...params: unknown[]): QueryBuilder {
    if (this.query.includes('WHERE')) {
      this.query += ` OR ${condition}`;
    } else {
      this.query += ` WHERE ${condition}`;
    }
    this.params.push(...params);
    return this;
  }

  /**
   * Add IN clause
   */
  whereIn(column: string, values: unknown[]): QueryBuilder {
    if (values.length === 0) {
      this.where('1 = 0'); // Always false
      return this;
    }

    const placeholders = values.map(() => '?').join(', ');
    this.where(`${column} IN (${placeholders})`, ...values);
    return this;
  }

  /**
   * Add LIKE clause
   */
  whereLike(column: string, pattern: string): QueryBuilder {
    this.where(`${column} LIKE ?`, pattern);
    return this;
  }

  /**
   * Add BETWEEN clause
   */
  whereBetween(column: string, start: unknown, end: unknown): QueryBuilder {
    this.where(`${column} BETWEEN ? AND ?`, start, end);
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.validateColumn(column);
    if (this.query.includes('ORDER BY')) {
      this.query += `, ${column} ${direction}`;
    } else {
      this.query += ` ORDER BY ${column} ${direction}`;
    }
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): QueryBuilder {
    this.query += ` LIMIT ${count}`;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): QueryBuilder {
    this.query += ` OFFSET ${count}`;
    return this;
  }

  /**
   * Add GROUP BY clause
   */
  groupBy(columns: string | string[]): QueryBuilder {
    const cols = Array.isArray(columns) ? columns.join(', ') : columns;
    // Validate each column
    const columnList = Array.isArray(columns) ? columns : [columns];
    columnList.forEach(col => this.validateColumn(col));
    this.query += ` GROUP BY ${cols}`;
    return this;
  }

  /**
   * Add HAVING clause
   */
  having(condition: string, ...params: unknown[]): QueryBuilder {
    this.query += ` HAVING ${condition}`;
    this.params.push(...params);
    return this;
  }

  /**
   * Add JOIN clause
   */
  join(table: string, onCondition: string): QueryBuilder {
    this.validateTableName(table);
    this.query += ` JOIN ${table} ON ${onCondition}`;
    return this;
  }

  /**
   * Add LEFT JOIN clause
   */
  leftJoin(table: string, onCondition: string): QueryBuilder {
    this.validateTableName(table);
    this.query += ` LEFT JOIN ${table} ON ${onCondition}`;
    return this;
  }

  /**
   * Build and return the query and parameters
   */
  build(): { query: string; params: unknown[] } {
    const result = {
      query: this.query,
      params: [...this.params],
    };

    this.logger.debug('Query built successfully', {
      operation: 'build',
      queryLength: this.query.length,
      paramCount: this.params.length,
      context: { queryBuilder: 'QueryBuilder' },
    });

    return result;
  }

  /**
   * Reset the query builder
   */
  reset(): QueryBuilder {
    this.query = '';
    this.params = [];
    return this;
  }
}

/**
 * INSERT query builder
 */
export class InsertBuilder {
  private query = '';
  private params: unknown[] = [];
  private logger = LogManager.getLogger('InsertBuilder');

  /**
   * Validate SQL identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[A-Z_a-z]\w*$/.test(identifier)) {
      this.logger.warn('Invalid SQL identifier detected', {
        operation: 'validateIdentifier',
        identifier,
        context: { queryBuilder: 'InsertBuilder' },
      });
      throw QueryBuilderErrorFactory.invalidFormat(
        'identifier',
        identifier,
        'valid SQL identifier (letters, numbers, underscores, starting with letter or underscore)',
      );
    }
  }

  /**
   * Validate table name
   */
  private validateTableName(table: string): void {
    this.validateIdentifier(table);
  }

  /**
   * Start an INSERT query
   */
  insert(table: string): InsertBuilder {
    this.validateTableName(table);
    this.query = `INSERT INTO ${table}`;
    return this;
  }

  /**
   * Add OR REPLACE clause
   */
  orReplace(): InsertBuilder {
    this.query = this.query.replace('INSERT', 'INSERT OR REPLACE');
    return this;
  }

  /**
   * Add OR IGNORE clause
   */
  orIgnore(): InsertBuilder {
    this.query = this.query.replace('INSERT', 'INSERT OR IGNORE');
    return this;
  }

  /**
   * Set columns and values
   */
  values(data: Record<string, unknown>): InsertBuilder {
    const columns = Object.keys(data);
    // Validate column names
    columns.forEach(col => this.validateIdentifier(col));

    const placeholders = columns.map(() => '?').join(', ');

    this.query += ` (${columns.join(', ')}) VALUES (${placeholders})`;
    this.params.push(...Object.values(data));
    return this;
  }

  /**
   * Build and return the query and parameters
   */
  build(): { query: string; params: unknown[] } {
    const result = {
      query: this.query,
      params: [...this.params],
    };

    this.logger.debug('Insert query built successfully', {
      operation: 'build',
      queryLength: this.query.length,
      paramCount: this.params.length,
      context: { queryBuilder: 'InsertBuilder' },
    });

    return result;
  }
}

/**
 * UPDATE query builder
 */
export class UpdateBuilder {
  private query = '';
  private params: unknown[] = [];
  private logger = LogManager.getLogger('UpdateBuilder');

  /**
   * Validate SQL identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[A-Z_a-z]\w*$/.test(identifier)) {
      this.logger.warn('Invalid SQL identifier detected', {
        operation: 'validateIdentifier',
        identifier,
        context: { queryBuilder: 'UpdateBuilder' },
      });
      throw QueryBuilderErrorFactory.invalidFormat(
        'identifier',
        identifier,
        'valid SQL identifier (letters, numbers, underscores, starting with letter or underscore)',
      );
    }
  }

  /**
   * Validate table name
   */
  private validateTableName(table: string): void {
    this.validateIdentifier(table);
  }

  /**
   * Start an UPDATE query
   */
  update(table: string): UpdateBuilder {
    this.validateTableName(table);
    this.query = `UPDATE ${table}`;
    return this;
  }

  /**
   * Set columns and values
   */
  set(data: Record<string, unknown>): UpdateBuilder {
    const columns = Object.keys(data);
    // Validate column names
    columns.forEach(col => this.validateIdentifier(col));

    const assignments = columns.map(key => `${key} = ?`).join(', ');
    this.query += ` SET ${assignments}`;
    this.params.push(...Object.values(data));
    return this;
  }

  /**
   * Add WHERE clause
   */
  where(condition: string, ...params: unknown[]): UpdateBuilder {
    this.query += ` WHERE ${condition}`;
    this.params.push(...params);
    return this;
  }

  /**
   * Build and return the query and parameters
   */
  build(): { query: string; params: unknown[] } {
    const result = {
      query: this.query,
      params: [...this.params],
    };

    this.logger.debug('Update query built successfully', {
      operation: 'build',
      queryLength: this.query.length,
      paramCount: this.params.length,
      context: { queryBuilder: 'UpdateBuilder' },
    });

    return result;
  }
}

/**
 * DELETE query builder
 */
export class DeleteBuilder {
  private query = '';
  private params: unknown[] = [];
  private logger = LogManager.getLogger('DeleteBuilder');

  /**
   * Validate SQL identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[A-Z_a-z]\w*$/.test(identifier)) {
      this.logger.warn('Invalid SQL identifier detected', {
        operation: 'validateIdentifier',
        identifier,
        context: { queryBuilder: 'DeleteBuilder' },
      });
      throw QueryBuilderErrorFactory.invalidFormat(
        'identifier',
        identifier,
        'valid SQL identifier (letters, numbers, underscores, starting with letter or underscore)',
      );
    }
  }

  /**
   * Validate table name
   */
  private validateTableName(table: string): void {
    this.validateIdentifier(table);
  }

  /**
   * Start a DELETE query
   */
  delete(table: string): DeleteBuilder {
    this.validateTableName(table);
    this.query = `DELETE FROM ${table}`;
    return this;
  }

  /**
   * Add WHERE clause
   */
  where(condition: string, ...params: unknown[]): DeleteBuilder {
    this.query += ` WHERE ${condition}`;
    this.params.push(...params);
    return this;
  }

  /**
   * Build and return the query and parameters
   */
  build(): { query: string; params: unknown[] } {
    const result = {
      query: this.query,
      params: [...this.params],
    };

    this.logger.debug('Delete query built successfully', {
      operation: 'build',
      queryLength: this.query.length,
      paramCount: this.params.length,
      context: { queryBuilder: 'DeleteBuilder' },
    });

    return result;
  }
}

/**
 * FTS5 query builder for full-text search
 */
export class FTSQueryBuilder {
  private query = '';
  private params: unknown[] = [];

  /**
   * Start an FTS5 query
   */
  select(table: string, columns: string | string[] = '*'): FTSQueryBuilder {
    const cols = Array.isArray(columns) ? columns.join(', ') : columns;
    this.query = `SELECT ${cols} FROM ${table}`;
    return this;
  }

  /**
   * Add MATCH clause for FTS5
   */
  match(expression: string, table?: string): FTSQueryBuilder {
    if (table) {
      this.query += ` WHERE ${table} MATCH ?`;
    } else {
      this.query += ` MATCH ?`;
    }
    this.params.push(expression);
    return this;
  }

  /**
   * Add ORDER BY rank (FTS5 specific)
   */
  orderByRank(direction: 'ASC' | 'DESC' = 'DESC'): FTSQueryBuilder {
    this.query += ` ORDER BY rank ${direction}`;
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): FTSQueryBuilder {
    this.query += ` LIMIT ${count}`;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): FTSQueryBuilder {
    this.query += ` OFFSET ${count}`;
    return this;
  }

  /**
   * Build and return the query and parameters
   */
  build(): { query: string; params: unknown[] } {
    return {
      query: this.query,
      params: [...this.params],
    };
  }
}

/**
 * Search Query Builder for FTS5 operations
 */
export class SearchQueryBuilder {
  private static logger = LogManager.getLogger('SearchQueryBuilder');
  /**
   * Build tag search query with FTS5 MATCH
   */
  static buildTagSearchQuery(
    tags: string[],
    limit: number,
    offset: number = 0,
    includeSnippets: boolean = false,
    filters?: {
      language?: string;
      fileType?: string;
      path?: string;
      sizeRange?: { min?: number; max?: number };
      dateRange?: { after?: number; before?: number };
    },
    minScore?: number,
  ) {
    // Build FTS5 MATCH expression
    const tagQuery = tags.map(tag => `"${tag}"`).join(' OR ');

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
          includeSnippets
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
      WHERE files_fts MATCH ?
    `;

    const params: unknown[] = [tagQuery];

    // Add filters
    if (filters) {
      if (filters.language) {
        sql += ' AND f.language = ?';
        params.push(filters.language);
      }

      if (filters.fileType) {
        sql += ' AND f.extension = ?';
        params.push(filters.fileType);
      }

      if (filters.path) {
        sql += ' AND f.path LIKE ?';
        params.push(`%${filters.path}%`);
      }

      if (filters.sizeRange) {
        if (filters.sizeRange.min !== undefined) {
          sql += ' AND f.size >= ?';
          params.push(filters.sizeRange.min);
        }

        if (filters.sizeRange.max !== undefined) {
          sql += ' AND f.size <= ?';
          params.push(filters.sizeRange.max);
        }
      }

      if (filters.dateRange) {
        if (filters.dateRange.after !== undefined) {
          sql += ' AND f.lastModified >= ?';
          params.push(filters.dateRange.after);
        }

        if (filters.dateRange.before !== undefined) {
          sql += ' AND f.lastModified <= ?';
          params.push(filters.dateRange.before);
        }
      }
    }

    // Add minimum score filter
    if (minScore && minScore > 0) {
      sql += ' AND fts.rank >= ?';
      params.push(minScore);
    }

    sql += ' ORDER BY fts.rank DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = { sql, params };

    SearchQueryBuilder.logger.debug('Tag search query built successfully', {
      operation: 'buildTagSearchQuery',
      tagCount: tags.length,
      limit,
      offset,
      hasFilters: !!filters,
      includeSnippets,
      minScore,
      queryLength: sql.length,
      paramCount: params.length,
      context: { queryBuilder: 'SearchQueryBuilder' },
    });

    return result;
  }

  /**
   * Build text search query with FTS5 MATCH
   */
  static buildTextSearchQuery(
    query: string,
    limit: number,
    offset: number = 0,
    includeSnippets: boolean = false,
    filters?: {
      language?: string;
      fileType?: string;
      path?: string;
      sizeRange?: { min?: number; max?: number };
      dateRange?: { after?: number; before?: number };
    },
    minScore?: number,
  ) {
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
          includeSnippets
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
    if (filters) {
      if (filters.language) {
        sql += ' AND f.language = ?';
        params.push(filters.language);
      }

      if (filters.fileType) {
        sql += ' AND f.extension = ?';
        params.push(filters.fileType);
      }

      if (filters.path) {
        sql += ' AND f.path LIKE ?';
        params.push(`%${filters.path}%`);
      }

      if (filters.sizeRange) {
        if (filters.sizeRange.min !== undefined) {
          sql += ' AND f.size >= ?';
          params.push(filters.sizeRange.min);
        }

        if (filters.sizeRange.max !== undefined) {
          sql += ' AND f.size <= ?';
          params.push(filters.sizeRange.max);
        }
      }

      if (filters.dateRange) {
        if (filters.dateRange.after !== undefined) {
          sql += ' AND f.lastModified >= ?';
          params.push(filters.dateRange.after);
        }

        if (filters.dateRange.before !== undefined) {
          sql += ' AND f.lastModified <= ?';
          params.push(filters.dateRange.before);
        }
      }
    }

    // Add minimum score filter
    if (minScore && minScore > 0) {
      sql += ' AND fts.rank >= ?';
      params.push(minScore);
    }

    sql += ' ORDER BY fts.rank DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = { sql, params };

    SearchQueryBuilder.logger.debug('Text search query built successfully', {
      operation: 'buildTextSearchQuery',
      queryLength: query.length,
      limit,
      offset,
      hasFilters: !!filters,
      includeSnippets,
      minScore,
      sqlLength: sql.length,
      paramCount: params.length,
      context: { queryBuilder: 'SearchQueryBuilder' },
    });

    return result;
  }

  /**
   * Build suggestions query for autocomplete
   */
  static buildSuggestionsQuery(prefix: string, limit: number = 20) {
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
   * Build index maintenance query
   */
  static buildIndexMaintenanceQuery(
    operation: 'rebuild' | 'optimize' | 'analyze' | 'check',
  ) {
    switch (operation) {
      case 'rebuild':
        return {
          sql: "INSERT INTO files_fts(files_fts) VALUES('rebuild')",
          params: [] as unknown[],
        };

      case 'optimize':
        return {
          sql: "INSERT INTO files_fts(files_fts) VALUES('optimize')",
          params: [] as unknown[],
        };

      case 'analyze':
        return {
          sql: 'ANALYZE',
          params: [] as unknown[],
        };

      case 'check':
        return {
          sql: 'PRAGMA integrity_check',
          params: [] as unknown[],
        };

      default:
        SearchQueryBuilder.logger.warn('Unknown maintenance operation', {
          operation: 'buildIndexMaintenanceQuery',
          maintenanceOperation: operation,
          context: { queryBuilder: 'SearchQueryBuilder' },
        });
        throw QueryBuilderErrorFactory.invalidInput(
          operation,
          'maintenance operation',
          'rebuild|optimize|analyze|check',
        );
    }
  }

  /**
   * Sanitize search query to prevent injection
   */
  static sanitizeQuery(query: string): string {
    // Remove potentially dangerous characters
    return query
      .replace(/["']/g, '')
      .replace(/[;-]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .trim();
  }

  /**
   * Validate search parameters
   */
  static validateSearchParams(params: {
    tags?: string[];
    query?: string;
    limit?: number;
    offset?: number;
  }): void {
    if (params.tags) {
      if (!Array.isArray(params.tags)) {
        SearchQueryBuilder.logger.warn(
          'Invalid search params: tags must be array',
          {
            operation: 'validateSearchParams',
            field: 'tags',
            value: params.tags,
            context: { queryBuilder: 'SearchQueryBuilder' },
          },
        );
        throw QueryBuilderErrorFactory.invalidType(
          'tags',
          params.tags,
          'array',
        );
      }

      if (params.tags.length === 0) {
        SearchQueryBuilder.logger.warn(
          'Invalid search params: empty tags array',
          {
            operation: 'validateSearchParams',
            field: 'tags',
            value: params.tags,
            context: { queryBuilder: 'SearchQueryBuilder' },
          },
        );
        throw QueryBuilderErrorFactory.constraintViolation(
          'tags',
          'must contain at least one tag',
        );
      }

      if (params.tags.length > 5) {
        SearchQueryBuilder.logger.warn('Invalid search params: too many tags', {
          operation: 'validateSearchParams',
          field: 'tags',
          value: params.tags.length,
          context: { queryBuilder: 'SearchQueryBuilder' },
        });
        throw QueryBuilderErrorFactory.outOfRange(
          'tags',
          params.tags.length,
          undefined,
          5,
        );
      }

      for (const tag of params.tags) {
        if (typeof tag !== 'string' || tag.trim().length === 0) {
          SearchQueryBuilder.logger.warn('Invalid search params: invalid tag', {
            operation: 'validateSearchParams',
            field: 'tags',
            value: tag,
            context: { queryBuilder: 'SearchQueryBuilder' },
          });
          throw QueryBuilderErrorFactory.invalidType(
            'tag',
            tag,
            'non-empty string',
          );
        }

        if (tag.length > 100) {
          SearchQueryBuilder.logger.warn(
            'Invalid search params: tag too long',
            {
              operation: 'validateSearchParams',
              field: 'tags',
              value: tag.length,
              context: { queryBuilder: 'SearchQueryBuilder' },
            },
          );
          throw QueryBuilderErrorFactory.outOfRange(
            'tag',
            tag.length,
            undefined,
            100,
          );
        }
      }
    }

    if (params.query) {
      if (typeof params.query !== 'string') {
        SearchQueryBuilder.logger.warn(
          'Invalid search params: query must be string',
          {
            operation: 'validateSearchParams',
            field: 'query',
            value: params.query,
            context: { queryBuilder: 'SearchQueryBuilder' },
          },
        );
        throw QueryBuilderErrorFactory.invalidType(
          'query',
          params.query,
          'string',
        );
      }

      if (params.query.trim().length === 0) {
        SearchQueryBuilder.logger.warn('Invalid search params: empty query', {
          operation: 'validateSearchParams',
          field: 'query',
          value: params.query,
          context: { queryBuilder: 'SearchQueryBuilder' },
        });
        throw QueryBuilderErrorFactory.constraintViolation(
          'query',
          'cannot be empty',
        );
      }

      if (params.query.length > 1000) {
        SearchQueryBuilder.logger.warn(
          'Invalid search params: query too long',
          {
            operation: 'validateSearchParams',
            field: 'query',
            value: params.query.length,
            context: { queryBuilder: 'SearchQueryBuilder' },
          },
        );
        throw QueryBuilderErrorFactory.outOfRange(
          'query',
          params.query.length,
          undefined,
          1000,
        );
      }
    }

    if (params.limit !== undefined) {
      if (typeof params.limit !== 'number' || params.limit <= 0) {
        SearchQueryBuilder.logger.warn('Invalid search params: invalid limit', {
          operation: 'validateSearchParams',
          field: 'limit',
          value: params.limit,
          context: { queryBuilder: 'SearchQueryBuilder' },
        });
        throw QueryBuilderErrorFactory.invalidType(
          'limit',
          params.limit,
          'positive number',
        );
      }

      if (params.limit > 1000) {
        SearchQueryBuilder.logger.warn(
          'Invalid search params: limit too high',
          {
            operation: 'validateSearchParams',
            field: 'limit',
            value: params.limit,
            context: { queryBuilder: 'SearchQueryBuilder' },
          },
        );
        throw QueryBuilderErrorFactory.outOfRange(
          'limit',
          params.limit,
          undefined,
          1000,
        );
      }
    }

    if (params.offset !== undefined) {
      if (typeof params.offset !== 'number' || params.offset < 0) {
        SearchQueryBuilder.logger.warn(
          'Invalid search params: invalid offset',
          {
            operation: 'validateSearchParams',
            field: 'offset',
            value: params.offset,
            context: { queryBuilder: 'SearchQueryBuilder' },
          },
        );
        throw QueryBuilderErrorFactory.invalidType(
          'offset',
          params.offset,
          'non-negative number',
        );
      }
    }
  }

  /**
   * Expand tags with common variations
   */
  static expandTags(tags: string[]): string[] {
    const expanded: string[] = [];

    for (const tag of tags) {
      expanded.push(tag);

      // Add case variations
      if (tag.toLowerCase() !== tag) {
        expanded.push(tag.toLowerCase());
      }
      if (tag.toUpperCase() !== tag) {
        expanded.push(tag.toUpperCase());
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
  private static getTagSubstitutions(tag: string): string[] {
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
}

/**
 * Utility functions for common query patterns
 */
export class QueryUtils {
  /**
   * Escape a column name (wrap in quotes if needed)
   */
  static escapeColumn(name: string): string {
    // If the name contains special characters or is a reserved keyword, quote it
    if (!/^[A-Z_a-z]\w*$/.test(name)) {
      return `"${name.replace(/"/g, '""')}"`;
    }
    return name;
  }

  /**
   * Build a parameterized IN clause
   */
  static buildInClause(values: unknown[]): string {
    if (values.length === 0) {
      return '(1 = 0)'; // Always false
    }
    return `(${values.map(() => '?').join(', ')})`;
  }

  /**
   * Create a LIKE pattern for partial matching
   */
  static createLikePattern(
    value: string,
    position: 'start' | 'end' | 'both' = 'both',
  ): string {
    switch (position) {
      case 'start':
        return `${value}%`;
      case 'end':
        return `%${value}`;
      case 'both':
      default:
        return `%${value}%`;
    }
  }

  /**
   * Build a SET clause for UPDATE queries
   */
  static buildSetClause(data: Record<string, unknown>): {
    clause: string;
    params: unknown[];
  } {
    const assignments = Object.keys(data).map(key => `${key} = ?`);
    return {
      clause: assignments.join(', '),
      params: Object.values(data),
    };
  }

  /**
   * Build a VALUES clause for INSERT queries
   */
  static buildValuesClause(data: Record<string, unknown>): {
    columns: string;
    placeholders: string;
    params: unknown[];
  } {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data)
      .map(() => '?')
      .join(', ');
    return {
      columns,
      placeholders,
      params: Object.values(data),
    };
  }

  /**
   * Validate table name to prevent SQL injection
   */
  static validateTableName(name: string): boolean {
    return /^[A-Z_a-z]\w*$/.test(name);
  }

  /**
   * Validate column name to prevent SQL injection
   */
  static validateColumnName(name: string): boolean {
    return /^[A-Z_a-z]\w*$/.test(name);
  }
}

/**
 * Error migration utilities for query builder operations
 */
export class QueryBuilderErrorMigration {
  private static logger = LogManager.getLogger('QueryBuilderErrorMigration');

  /**
   * Migrate legacy validation errors to ServiceError types
   */
  static migrateValidationError(
    error: Error,
    operation: string,
  ): ValidationError {
    const migration = QueryBuilderErrorFactory.migrateError(error, operation);

    if (migration.wasLegacy) {
      this.logger.debug('Migrated legacy validation error', {
        operation,
        originalType: migration.originalType,
        migratedType: migration.migrated.constructor.name,
      });
    }

    return migration.migrated as ValidationError;
  }

  /**
   * Create error boundary for query builder operations with automatic migration
   */
  static createQueryErrorBoundary<T>(
    operation: string,
    queryBuilder: string,
    fn: () => T,
  ): T {
    try {
      return QueryBuilderErrorFactory.createErrorBoundary(operation, fn);
    } catch (error) {
      this.logger.warn('Query builder error caught and migrated', {
        operation,
        queryBuilder,
        errorType: (error as Error).constructor.name,
        errorMessage: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Create async error boundary for query builder operations
   */
  static async createAsyncQueryErrorBoundary<T>(
    operation: string,
    queryBuilder: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await QueryBuilderErrorFactory.createAsyncErrorBoundary(
        operation,
        fn,
      );
    } catch (error) {
      this.logger.warn('Async query builder error caught and migrated', {
        operation,
        queryBuilder,
        errorType: (error as Error).constructor.name,
        errorMessage: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Wrap query builder methods with error migration
   */
  static wrapQueryBuilderMethod<T extends (...args: any[]) => any>(
    method: T,
    operation: string,
    queryBuilder: string,
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = method.apply(this, args);

        // Handle promises
        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            throw this.migrateValidationError(
              error,
              `${queryBuilder}.${operation}`,
            );
          });
        }

        return result;
      } catch (error) {
        throw this.migrateValidationError(
          error as Error,
          `${queryBuilder}.${operation}`,
        );
      }
    }) as T;
  }

  /**
   * Batch migrate multiple errors from query operations
   */
  static migrateQueryErrors(
    errors: Error[],
    operation: string,
    queryBuilder: string,
  ) {
    const migrations = errors.map(error =>
      QueryBuilderErrorFactory.migrateError(
        error,
        `${queryBuilder}.${operation}`,
      ),
    );

    const legacyCount = migrations.filter(m => m.wasLegacy).length;

    if (legacyCount > 0) {
      this.logger.info('Batch migrated query errors', {
        operation,
        queryBuilder,
        totalErrors: errors.length,
        legacyErrors: legacyCount,
        migrationRate: ((legacyCount / errors.length) * 100).toFixed(1) + '%',
      });
    }

    return migrations;
  }
}

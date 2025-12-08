import type Database from 'better-sqlite3';

import {
  DatabaseError,
  DatabaseErrorType,
} from '@/shared/errors/DatabaseError';
import type {
  FileMetadata,
  ListOptions,
  BatchResult,
} from '@/features/storage/types/StorageTypes';
import { PERFORMANCE_LIMITS } from '@/features/storage/config/PerformanceConstants';
import { LogManager } from '@/shared/utils/LogManager';
import { SERVICE_CONTEXTS } from '@/shared/utils/LoggingConstants';

/**
 * Repository class for handling CRUD operations on file metadata
 */
export class FileRepository {
  private readonly db: Database.Database;
  private readonly saveStatement: Database.Statement;
  private readonly findByPathStatement: Database.Statement;
  private readonly findByIdStatement: Database.Statement;
  private readonly deleteStatement: Database.Statement;
  private readonly countStatement: Database.Statement;
  private readonly logger = LogManager.getLogger(SERVICE_CONTEXTS.STORAGE);

  constructor(database: Database.Database) {
    this.db = database;

    // Prepare frequently used statements for performance
    this.saveStatement = this.db.prepare(`
      INSERT OR REPLACE INTO files (
        id, path, filename, extension, size, lastModified, 
        hash, language, indexedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.findByPathStatement = this.db.prepare(`
      SELECT * FROM files WHERE path = ?
    `);

    this.findByIdStatement = this.db.prepare(`
      SELECT * FROM files WHERE id = ?
    `);

    this.deleteStatement = this.db.prepare(`
      DELETE FROM files WHERE path = ?
    `);

    this.countStatement = this.db.prepare(`
      SELECT COUNT(*) as count FROM files
    `);
  }

  /**
   * Save file metadata with UPSERT logic
   */
  save(metadata: FileMetadata): void {
    this.validateFileMetadata(metadata);

    try {
      this.saveStatement.run(
        metadata.id,
        metadata.path,
        metadata.filename,
        metadata.extension,
        metadata.size,
        metadata.lastModified,
        metadata.hash,
        metadata.language,
        metadata.indexedAt,
      );
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Failed to save file metadata: ${metadata.path}`,
        { original: error as Error, query: 'INSERT OR REPLACE INTO files...' },
      );
    }
  }

  /**
   * Find file metadata by path
   */
  findByPath(path: string): FileMetadata | null {
    if (!path || typeof path !== 'string') {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'Path must be a non-empty string',
        { context: { path } },
      );
    }

    try {
      const row = this.findByPathStatement.get(path) as any;
      return row ? this.mapRowToFileMetadata(row) : null;
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Failed to find file by path: ${path}`,
        {
          original: error as Error,
          query: 'SELECT * FROM files WHERE path = ?',
        },
      );
    }
  }

  /**
   * Find file metadata by ID
   */
  findById(id: string): FileMetadata | null {
    if (!id || typeof id !== 'string') {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'ID must be a non-empty string',
        { context: { id } },
      );
    }

    try {
      const row = this.findByIdStatement.get(id) as any;
      return row ? this.mapRowToFileMetadata(row) : null;
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Failed to find file by ID: ${id}`,
        { original: error as Error, query: 'SELECT * FROM files WHERE id = ?' },
      );
    }
  }

  /**
   * Update file metadata with partial data
   */
  update(path: string, metadata: Partial<FileMetadata>): void {
    if (!path || typeof path !== 'string') {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'Path must be a non-empty string',
        { context: { path } },
      );
    }

    if (Object.keys(metadata).length === 0) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'At least one field must be provided for update',
        { context: { path } },
      );
    }

    // Build dynamic UPDATE query
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    // Explicitly handle each allowed field to prevent object injection
    const fieldMap = [
      { key: 'filename', value: metadata.filename },
      { key: 'extension', value: metadata.extension },
      { key: 'size', value: metadata.size },
      { key: 'lastModified', value: metadata.lastModified },
      { key: 'hash', value: metadata.hash },
      { key: 'language', value: metadata.language },
      { key: 'indexedAt', value: metadata.indexedAt },
    ] as const;

    for (const { key, value } of fieldMap) {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) {
      return; // Nothing to update
    }

    const query = `
      UPDATE files 
      SET ${updateFields.join(', ')}
      WHERE path = ?
    `;

    updateValues.push(path);

    try {
      const stmt = this.db.prepare(query);
      const result = stmt.run(...updateValues);

      if (result.changes === 0) {
        throw new DatabaseError(
          DatabaseErrorType.CONSTRAINT_VIOLATION,
          `File not found for update: ${path}`,
          { context: { path } },
        );
      }
    } catch (error) {
      // Re-throw our custom error if it exists
      if (error instanceof DatabaseError) {
        throw error;
      }

      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Failed to update file: ${path}`,
        { original: error as Error, query, params: updateValues },
      );
    }
  }

  /**
   * Delete file metadata by path (CASCADE delete will remove related records)
   */
  delete(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'Path must be a non-empty string',
        { context: { path } },
      );
    }

    try {
      const result = this.deleteStatement.run(path);

      // Don't throw error if file doesn't exist - graceful deletion
      if (result.changes === 0) {
        // File was already deleted or never existed
      }
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Failed to delete file: ${path}`,
        { original: error as Error, query: 'DELETE FROM files WHERE path = ?' },
      );
    }
  }

  /**
   * Count total number of files
   */
  count(): number {
    try {
      const row = this.countStatement.get() as { count: number };
      return row.count;
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        'Failed to count files',
        {
          original: error as Error,
          query: 'SELECT COUNT(*) as count FROM files',
        },
      );
    }
  }

  /**
   * List files with pagination and filtering options
   */
  list(options: ListOptions = {}): FileMetadata[] {
    const {
      limit,
      offset,
      language,
      extension,
      pathPattern,
      sortBy = 'indexedAt',
      sortOrder = 'DESC',
    } = options;

    // Validate sort options
    const validSortFields = ['indexedAt', 'lastModified', 'size', 'filename'];
    const validSortOrders = ['ASC', 'DESC'];

    if (!validSortFields.includes(sortBy)) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        `Invalid sort field: ${sortBy}. Valid fields: ${validSortFields.join(', ')}`,
        { context: { sortBy } },
      );
    }

    if (!validSortOrders.includes(sortOrder)) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        `Invalid sort order: ${sortOrder}. Valid orders: ${validSortOrders.join(', ')}`,
        { context: { sortOrder } },
      );
    }

    // Build query dynamically
    const whereConditions: string[] = [];
    const queryParams: unknown[] = [];

    if (language) {
      whereConditions.push(`language = ?`);
      queryParams.push(language);
    }

    if (extension) {
      whereConditions.push(`extension = ?`);
      queryParams.push(extension);
    }

    if (pathPattern) {
      whereConditions.push(`path LIKE ?`);
      queryParams.push(pathPattern);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const limitClause = limit ? `LIMIT ?` : '';
    if (limit) {
      queryParams.push(limit);
    }

    const offsetClause = offset ? `OFFSET ?` : '';
    if (offset) {
      queryParams.push(offset);
    }

    const query = `
      SELECT * FROM files 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      ${limitClause}
      ${offsetClause}
    `;

    try {
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...queryParams) as any[];
      return rows.map(row => this.mapRowToFileMetadata(row));
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        'Failed to list files',
        { original: error as Error, query, params: queryParams },
      );
    }
  }

  /**
   * Save multiple files in a batch transaction
   */
  saveBatch(metadata: FileMetadata[]): BatchResult {
    if (metadata.length === 0) {
      return { success: 0, failed: 0, duration: 0 };
    }

    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];
    let successCount = 0;

    // Validate all metadata before starting transaction
    for (const item of metadata) {
      try {
        this.validateFileMetadata(item);
      } catch (error) {
        errors.push({
          id: item.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const validMetadata = metadata.filter(
      item => !errors.some(error => error.id === item.id),
    );

    if (validMetadata.length === 0) {
      return {
        success: 0,
        failed: metadata.length,
        duration: Date.now() - startTime,
        errors,
      };
    }

    // Process in chunks to avoid memory issues
    const CHUNK_SIZE = PERFORMANCE_LIMITS.MAX_CACHE_SIZE;

    try {
      const transaction = this.db.transaction((items: FileMetadata[]) => {
        for (const item of items) {
          try {
            this.saveStatement.run(
              item.id,
              item.path,
              item.filename,
              item.extension,
              item.size,
              item.lastModified,
              item.hash,
              item.language,
              item.indexedAt,
            );
            successCount++;
          } catch (error) {
            errors.push({
              id: item.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      });

      for (let i = 0; i < validMetadata.length; i += CHUNK_SIZE) {
        const chunk = validMetadata.slice(i, i + CHUNK_SIZE);
        transaction(chunk);
      }
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.TRANSACTION_FAILED,
        `Failed to save batch of ${metadata.length} files`,
        { original: error as Error },
      );
    }

    return {
      success: successCount,
      failed: metadata.length - successCount,
      duration: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Delete multiple files in a batch transaction
   */
  deleteBatch(paths: string[]): BatchResult {
    if (paths.length === 0) {
      return { success: 0, failed: 0, duration: 0 };
    }

    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];
    let successCount = 0;

    // Validate all paths before starting transaction
    for (const path of paths) {
      if (!path || typeof path !== 'string') {
        errors.push({
          id: path,
          error: 'Path must be a non-empty string',
        });
      }
    }

    const validPaths = paths.filter(
      path => !errors.some(error => error.id === path),
    );

    if (validPaths.length === 0) {
      return {
        success: 0,
        failed: paths.length,
        duration: Date.now() - startTime,
        errors,
      };
    }

    const deleteStmt = this.db.prepare(`DELETE FROM files WHERE path = ?`);

    try {
      const transaction = this.db.transaction((pathsToDelete: string[]) => {
        for (const path of pathsToDelete) {
          try {
            const result = deleteStmt.run(path);
            if (result.changes > 0) {
              successCount++;
            }
            // Don't count as error if file doesn't exist
          } catch (error) {
            errors.push({
              id: path,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      });

      // Process in chunks to avoid memory issues
      const CHUNK_SIZE = PERFORMANCE_LIMITS.MAX_CACHE_SIZE;
      for (let i = 0; i < validPaths.length; i += CHUNK_SIZE) {
        const chunk = validPaths.slice(i, i + CHUNK_SIZE);
        transaction(chunk);
      }
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.TRANSACTION_FAILED,
        `Failed to delete batch of ${paths.length} files`,
        { original: error as Error },
      );
    }

    // Calculate failed count (only actual errors, not non-existent files)
    const failedCount = errors.length;

    return {
      success: successCount,
      failed: failedCount,
      duration: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Map database row to FileMetadata interface
   */
  private mapRowToFileMetadata(row: any): FileMetadata {
    return {
      id: row.id,
      path: row.path,
      filename: row.filename,
      extension: row.extension,
      size: row.size,
      lastModified: row.lastModified,
      hash: row.hash,
      language: row.language,
      indexedAt: row.indexedAt,
    };
  }

  /**
   * Validate file metadata before saving
   */
  private validateFileMetadata(metadata: FileMetadata): void {
    // Explicitly check each required field to prevent object injection
    const requiredFieldValues = [
      { field: 'id', value: metadata.id },
      { field: 'path', value: metadata.path },
      { field: 'filename', value: metadata.filename },
      { field: 'extension', value: metadata.extension },
      { field: 'size', value: metadata.size },
      { field: 'lastModified', value: metadata.lastModified },
      { field: 'hash', value: metadata.hash },
      { field: 'language', value: metadata.language },
      { field: 'indexedAt', value: metadata.indexedAt },
    ] as const;

    for (const { field, value } of requiredFieldValues) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (value === null) {
        throw new DatabaseError(
          DatabaseErrorType.CONSTRAINT_VIOLATION,
          `Required field '${field}' is null`,
          { context: { field, metadata } },
        );
      }
    }

    // Type validations
    if (typeof metadata.id !== 'string' || !metadata.id.trim()) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'ID must be a non-empty string',
        { context: { id: metadata.id } },
      );
    }

    if (typeof metadata.path !== 'string' || !metadata.path.trim()) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'Path must be a non-empty string',
        { context: { path: metadata.path } },
      );
    }

    if (typeof metadata.size !== 'number' || metadata.size < 0) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'Size must be a non-negative number',
        { context: { size: metadata.size } },
      );
    }

    if (
      typeof metadata.lastModified !== 'number' ||
      metadata.lastModified < 0
    ) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'LastModified must be a non-negative number',
        { context: { lastModified: metadata.lastModified } },
      );
    }

    if (typeof metadata.indexedAt !== 'number' || metadata.indexedAt < 0) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'IndexedAt must be a non-negative number',
        { context: { indexedAt: metadata.indexedAt } },
      );
    }

    // Hash validation (should be a valid SHA-256 hash)
    if (
      typeof metadata.hash !== 'string' ||
      !/^[\da-f]{64}$/i.test(metadata.hash)
    ) {
      throw new DatabaseError(
        DatabaseErrorType.CONSTRAINT_VIOLATION,
        'Hash must be a valid SHA-256 hash (64 hex characters)',
        { context: { hash: metadata.hash } },
      );
    }
  }
}

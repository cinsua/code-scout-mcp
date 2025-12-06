/**
 * Query builder utilities for SQLite operations
 */

/**
 * SQL query builder class
 */
export class QueryBuilder {
  private query = '';
  private params: unknown[] = [];

  /**
   * Validate SQL identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[A-Z_a-z]\w*$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
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
    return {
      query: this.query,
      params: [...this.params],
    };
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

  /**
   * Validate SQL identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[A-Z_a-z]\w*$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
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
    return {
      query: this.query,
      params: [...this.params],
    };
  }
}

/**
 * UPDATE query builder
 */
export class UpdateBuilder {
  private query = '';
  private params: unknown[] = [];

  /**
   * Validate SQL identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[A-Z_a-z]\w*$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
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
    return {
      query: this.query,
      params: [...this.params],
    };
  }
}

/**
 * DELETE query builder
 */
export class DeleteBuilder {
  private query = '';
  private params: unknown[] = [];

  /**
   * Validate SQL identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[A-Z_a-z]\w*$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
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
    return {
      query: this.query,
      params: [...this.params],
    };
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

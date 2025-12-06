import type Database from 'better-sqlite3';

import type { InternalMigration } from './types';

/**
 * Initial schema migration
 */
export const migration: InternalMigration = {
  version: 1,
  name: 'initial_schema',
  checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA256 of 'initial_schema'
  up: (db: Database.Database): void => {
    // Create files table
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        modified_time DATETIME NOT NULL,
        indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create symbols table
    db.exec(`
      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        column_number INTEGER NOT NULL,
        parent_id INTEGER,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES symbols (id) ON DELETE SET NULL
      )
    `);

    // Create FTS5 virtual table for file content
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS file_content USING fts5(
        file_id,
        content,
        content='files',
        content_rowid='id'
      )
    `);

    // Create FTS5 virtual table for symbol search
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS symbol_search USING fts5(
        symbol_id,
        name,
        type,
        context,
        content='symbols',
        content_rowid='id'
      )
    `);

    // Create indexes for better performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_files_path ON files(path)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_symbols_file_id ON symbols(file_id)',
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols(type)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_symbols_parent_id ON symbols(parent_id)',
    );
  },
  down: (db: Database.Database): void => {
    // Drop FTS5 tables first (they depend on the main tables)
    db.exec('DROP TABLE IF EXISTS symbol_search');
    db.exec('DROP TABLE IF EXISTS file_content');

    // Drop main tables
    db.exec('DROP TABLE IF EXISTS symbols');
    db.exec('DROP TABLE IF EXISTS files');
  },
};

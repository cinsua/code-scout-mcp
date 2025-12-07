import type Database from 'better-sqlite3';

import type { InternalMigration } from './types';

/**
 * Initial schema migration
 */
export const migration: InternalMigration = {
  version: 1,
  name: 'initial_schema',
  checksum: '7fd4756c23f40d75a735259027845249ee368c74c11f8c498303ad28746e9521', // SHA256 of 'initial_schema'
  up: (db: Database.Database): void => {
    // Create files table
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

    // Create definitions table
    db.exec(`
      CREATE TABLE definitions (
        id TEXT PRIMARY KEY,
        fileId TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        line INTEGER NOT NULL,
        column INTEGER NOT NULL,
        exported BOOLEAN NOT NULL,
        docstring TEXT,
        decorators TEXT,
        signature TEXT,
        FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // Create imports table
    db.exec(`
      CREATE TABLE imports (
        id TEXT PRIMARY KEY,
        fileId TEXT NOT NULL,
        module TEXT NOT NULL,
        type TEXT NOT NULL,
        alias TEXT,
        line INTEGER NOT NULL,
        column INTEGER NOT NULL,
        FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // Create symbols table for local variables
    db.exec(`
      CREATE TABLE symbols (
        id TEXT PRIMARY KEY,
        fileId TEXT NOT NULL,
        definitionId TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        line INTEGER NOT NULL,
        column INTEGER NOT NULL,
        scope TEXT NOT NULL,
        FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (definitionId) REFERENCES definitions(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for query performance
    db.exec(`CREATE INDEX idx_files_path ON files(path)`);
    db.exec(`CREATE INDEX idx_files_language ON files(language)`);
    db.exec(`CREATE INDEX idx_definitions_file_id ON definitions(fileId)`);
    db.exec(`CREATE INDEX idx_definitions_type ON definitions(type)`);
    db.exec(`CREATE INDEX idx_imports_file_id ON imports(fileId)`);
    db.exec(`CREATE INDEX idx_imports_module ON imports(module)`);
    db.exec(`CREATE INDEX idx_symbols_file_id ON symbols(fileId)`);
    db.exec(`CREATE INDEX idx_symbols_definition_id ON symbols(definitionId)`);
    db.exec(`CREATE INDEX idx_symbols_name ON symbols(name)`);
  },
  down: (db: Database.Database): void => {
    db.exec(`DROP TABLE IF EXISTS symbols`);
    db.exec(`DROP TABLE IF EXISTS imports`);
    db.exec(`DROP TABLE IF EXISTS definitions`);
    db.exec(`DROP TABLE IF EXISTS files`);
  },
};

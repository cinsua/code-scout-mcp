import type Database from 'better-sqlite3';

import type { InternalMigration } from './types';

/**
 * Add FTS5 support migration
 */
export const migration: InternalMigration = {
  version: 2,
  name: 'add_fts_index',
  checksum: 'ead52b4b0490000491ee2ca75fd36747c540cfa47f8c5d2e4fd2b58f3648b785', // SHA256 of 'add_fts_index'
  up: (db: Database.Database): void => {
    // Create FTS5 virtual table
    db.exec(`
      CREATE VIRTUAL TABLE files_fts USING fts5(
        filename,
        path,
        definitions,
        imports,
        docstrings,
        tags,
        content='files',
        content_rowid='rowid',
        tokenize='porter unicode61'
      )
    `);

    // Create file_tags table
    db.exec(`
      CREATE TABLE file_tags (
        fileId TEXT NOT NULL,
        tag TEXT NOT NULL,
        weight REAL NOT NULL,
        FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE,
        UNIQUE(fileId, tag)
      )
    `);

    // Create FTS5 triggers for automatic index updates
    db.exec(`
      CREATE TRIGGER files_fts_insert AFTER INSERT ON files
      BEGIN
        INSERT INTO files_fts(rowid, filename, path, definitions, imports, docstrings, tags)
        VALUES (
          new.rowid,
          new.filename,
          new.path,
          (SELECT GROUP_CONCAT(name, ' ') FROM definitions WHERE fileId = new.id),
          (SELECT GROUP_CONCAT(module, ' ') FROM imports WHERE fileId = new.id),
          (SELECT GROUP_CONCAT(COALESCE(docstring, ''), ' ') FROM definitions WHERE fileId = new.id AND docstring IS NOT NULL),
          (SELECT GROUP_CONCAT(tag, ' ') FROM file_tags WHERE fileId = new.id)
        );
      END
    `);

    db.exec(`
      CREATE TRIGGER files_fts_update AFTER UPDATE ON files
      BEGIN
        UPDATE files_fts SET
          filename = new.filename,
          path = new.path,
          definitions = (SELECT GROUP_CONCAT(name, ' ') FROM definitions WHERE fileId = new.id),
          imports = (SELECT GROUP_CONCAT(module, ' ') FROM imports WHERE fileId = new.id),
          docstrings = (SELECT GROUP_CONCAT(COALESCE(docstring, ''), ' ') FROM definitions WHERE fileId = new.id AND docstring IS NOT NULL),
          tags = (SELECT GROUP_CONCAT(tag, ' ') FROM file_tags WHERE fileId = new.id)
        WHERE rowid = new.rowid;
      END
    `);

    db.exec(`
      CREATE TRIGGER files_fts_delete AFTER DELETE ON files
      BEGIN
        DELETE FROM files_fts WHERE rowid = old.rowid;
      END
    `);

    // Populate FTS5 index with existing data
    db.exec(`
      INSERT INTO files_fts(rowid, filename, path, definitions, imports, docstrings, tags)
      SELECT
        f.rowid,
        f.filename,
        f.path,
        COALESCE((SELECT GROUP_CONCAT(d.name, ' ') FROM definitions d WHERE d.fileId = f.id), ''),
        COALESCE((SELECT GROUP_CONCAT(i.module, ' ') FROM imports i WHERE i.fileId = f.id), ''),
        COALESCE((SELECT GROUP_CONCAT(d.docstring, ' ') FROM definitions d WHERE d.fileId = f.id AND d.docstring IS NOT NULL), ''),
        ''
      FROM files f
    `);

    // Create indexes for file_tags
    db.exec(`CREATE INDEX idx_file_tags_file_id ON file_tags(fileId)`);
    db.exec(`CREATE INDEX idx_file_tags_tag ON file_tags(tag)`);
    db.exec(`CREATE INDEX idx_file_tags_weight ON file_tags(weight)`);
  },
  down: (db: Database.Database): void => {
    db.exec(`DROP TRIGGER IF EXISTS files_fts_delete`);
    db.exec(`DROP TRIGGER IF EXISTS files_fts_update`);
    db.exec(`DROP TRIGGER IF EXISTS files_fts_insert`);
    db.exec(`DROP TABLE IF EXISTS file_tags`);
    db.exec(`DROP TABLE IF EXISTS files_fts`);
  },
};

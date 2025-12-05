# Database Schema and Migrations

## Database Architecture

### Technology Choice
- **SQLite 3.40+**: Embedded database with FTS5 extension
- **better-sqlite3**: Synchronous wrapper for better performance
- **Database Location**: `./.code-scout/database.db` (project-local)

### Design Principles
- **Normalized Schema**: Proper normalization for data integrity
- **FTS5 Integration**: Full-text search for tag-based queries
- **Migration System**: Version-controlled schema evolution
- **Performance Optimized**: Indexes and constraints for query performance

## Core Tables

### Files Table
```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,              -- UUID v4
  path TEXT NOT NULL UNIQUE,        -- Repository-relative path
  filename TEXT NOT NULL,           -- File name with extension
  extension TEXT NOT NULL,          -- File extension (.js, .ts, .py)
  size INTEGER NOT NULL,            -- File size in bytes
  lastModified INTEGER NOT NULL,    -- Unix timestamp
  hash TEXT NOT NULL,               -- SHA256 content hash
  language TEXT NOT NULL,           -- Detected language
  indexedAt INTEGER NOT NULL        -- Indexing timestamp
);

-- Indexes
CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_language ON files(language);
CREATE INDEX idx_files_hash ON files(hash);
CREATE INDEX idx_files_indexed_at ON files(indexedAt);
```

### Definitions Table
```sql
CREATE TABLE definitions (
  id TEXT PRIMARY KEY,              -- UUID v4
  fileId TEXT NOT NULL,             -- Foreign key to files.id
  name TEXT NOT NULL,               -- Symbol name
  type TEXT NOT NULL,               -- class|function|component|variable|type
  line INTEGER NOT NULL,            -- 1-based line number
  column INTEGER NOT NULL,          -- 0-based column position
  exported BOOLEAN NOT NULL,        -- Export visibility
  docstring TEXT,                   -- Documentation string
  decorators TEXT,                  -- JSON array of decorators
  signature TEXT,                   -- Full function/class signature

  FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_definitions_file_id ON definitions(fileId);
CREATE INDEX idx_definitions_type ON definitions(type);
CREATE INDEX idx_definitions_name ON definitions(name);
CREATE INDEX idx_definitions_exported ON definitions(exported);
```

### Imports Table
```sql
CREATE TABLE imports (
  id TEXT PRIMARY KEY,              -- UUID v4
  fileId TEXT NOT NULL,             -- Foreign key to files.id
  module TEXT NOT NULL,             -- Module name/path
  type TEXT NOT NULL,               -- local|external|builtin
  imports TEXT NOT NULL,            -- JSON array of imported symbols
  alias TEXT,                       -- Import alias if present
  isDynamic BOOLEAN NOT NULL DEFAULT 0, -- Dynamic import flag
  line INTEGER NOT NULL,            -- 1-based line number

  FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_imports_file_id ON imports(fileId);
CREATE INDEX idx_imports_module ON imports(module);
CREATE INDEX idx_imports_type ON imports(type);
```

### Symbols Table
```sql
CREATE TABLE symbols (
  id TEXT PRIMARY KEY,              -- UUID v4
  fileId TEXT NOT NULL,             -- Foreign key to files.id
  name TEXT NOT NULL,               -- Symbol name
  type TEXT NOT NULL,               -- variable|constant|enum
  line INTEGER NOT NULL,            -- 1-based line number
  exported BOOLEAN NOT NULL,        -- Export visibility

  FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_symbols_file_id ON symbols(fileId);
CREATE INDEX idx_symbols_type ON symbols(type);
CREATE INDEX idx_symbols_name ON symbols(name);
```

## Full-Text Search (FTS5)

### FTS5 Virtual Table
```sql
CREATE VIRTUAL TABLE files_fts USING fts5(
  filename,           -- File name for exact matching
  path,              -- Path segments for directory matching
  definitions,       -- Concatenated definition names
  imports,           -- Concatenated import modules
  docstrings,        -- Concatenated documentation
  tags,              -- Generated search tags
  content='files',   -- Source table
  content_rowid='rowid' -- Row ID mapping
);

-- FTS5 Configuration
-- Enable prefix searches (2-4 character prefixes)
-- Enable porter stemmer for better matching
-- Enable trigram tokenizer for partial matching
```

### FTS5 Triggers
```sql
-- Insert trigger
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
END;

-- Update trigger
CREATE TRIGGER files_fts_update AFTER UPDATE ON files
BEGIN
  UPDATE files_fts SET
    filename = new.filename,
    path = new.path
  WHERE rowid = new.rowid;
END;

-- Delete trigger
CREATE TRIGGER files_fts_delete AFTER DELETE ON files
BEGIN
  DELETE FROM files_fts WHERE rowid = old.rowid;
END;
```

### File Tags Table (for FTS5)
```sql
CREATE TABLE file_tags (
  fileId TEXT NOT NULL,
  tag TEXT NOT NULL,
  weight REAL NOT NULL,  -- 1.0, 2.0, 3.0, 5.0

  FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(fileId, tag)
);

-- Indexes
CREATE INDEX idx_file_tags_file_id ON file_tags(fileId);
CREATE INDEX idx_file_tags_tag ON file_tags(tag);
CREATE INDEX idx_file_tags_weight ON file_tags(weight);
```

## Migration System

### Migration Table
```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at INTEGER NOT NULL,
  checksum TEXT NOT NULL
);
```

### Migration Manager
```typescript
class MigrationManager {
  private migrations: Migration[] = [
    { version: 1, name: 'initial_schema', up: initialSchemaUp, down: initialSchemaDown },
    { version: 2, name: 'add_fts_index', up: addFtsIndexUp, down: addFtsIndexDown },
    // ... more migrations
  ];

  async migrate(targetVersion?: number): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    if (targetVersion === undefined) {
      targetVersion = Math.max(...this.migrations.map(m => m.version));
    }

    if (targetVersion > currentVersion) {
      await this.upgrade(currentVersion, targetVersion);
    } else if (targetVersion < currentVersion) {
      await this.downgrade(currentVersion, targetVersion);
    }
  }

  private async upgrade(fromVersion: number, toVersion: number): Promise<void> {
    for (let version = fromVersion + 1; version <= toVersion; version++) {
      const migration = this.migrations.find(m => m.version === version);
      if (!migration) throw new Error(`Migration ${version} not found`);

      await this.executeMigration(migration, 'up');
      await this.recordMigration(migration);
    }
  }
}
```

### Migration Scripts

#### Migration 001: Initial Schema
```typescript
export const up = async (db: Database): Promise<void> => {
  // Create core tables
  await db.execute(`
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

  await db.execute(`
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

  // Create indexes
  await db.execute(`CREATE INDEX idx_files_path ON files(path)`);
  await db.execute(`CREATE INDEX idx_definitions_file_id ON definitions(fileId)`);
};

export const down = async (db: Database): Promise<void> => {
  await db.execute(`DROP TABLE IF EXISTS definitions`);
  await db.execute(`DROP TABLE IF EXISTS files`);
};
```

#### Migration 002: Add FTS5 Index
```typescript
export const up = async (db: Database): Promise<void> => {
  // Create FTS5 virtual table
  await db.execute(`
    CREATE VIRTUAL TABLE files_fts USING fts5(
      filename, path, definitions, imports, docstrings, tags,
      content='files', content_rowid='rowid'
    )
  `);

  // Create file_tags table
  await db.execute(`
    CREATE TABLE file_tags (
      fileId TEXT NOT NULL,
      tag TEXT NOT NULL,
      weight REAL NOT NULL,
      FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE,
      UNIQUE(fileId, tag)
    )
  `);

  // Populate FTS5 with existing data
  await db.execute(`
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
};

export const down = async (db: Database): Promise<void> => {
  await db.execute(`DROP TABLE IF EXISTS file_tags`);
  await db.execute(`DROP TABLE IF EXISTS files_fts`);
};
```

## Database Operations

### Connection Management
```typescript
class DatabaseService {
  private db: Database;

  constructor(config: DatabaseConfig) {
    this.db = new Database(config.path);

    // Configure pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = memory');
  }

  execute<T>(query: string, params?: any[]): T {
    const stmt = this.db.prepare(query);
    return params ? stmt.get(params) as T : stmt.get() as T;
  }

  executeAll<T>(query: string, params?: any[]): T[] {
    const stmt = this.db.prepare(query);
    return params ? stmt.all(params) as T[] : stmt.all() as T[];
  }

  executeRun(query: string, params?: any[]): Database.RunResult {
    const stmt = this.db.prepare(query);
    return params ? stmt.run(params) : stmt.run();
  }

  transaction<T>(callback: () => T): T {
    return this.db.transaction(callback)();
  }
}
```

### Query Builders
```typescript
class FileQueries {
  static insert(file: FileMetadata): { sql: string; params: any[] } {
    return {
      sql: `
        INSERT INTO files (id, path, filename, extension, size, lastModified, hash, language, indexedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        file.id, file.path, file.filename, file.extension, file.size,
        file.lastModified, file.hash, file.language, file.indexedAt
      ]
    };
  }

  static findByPath(path: string): { sql: string; params: any[] } {
    return {
      sql: `SELECT * FROM files WHERE path = ?`,
      params: [path]
    };
  }
}
```

## Performance Optimizations

### Indexing Strategy
- **Composite Indexes**: Multi-column indexes for common query patterns
- **Partial Indexes**: Indexes on frequently filtered columns
- **FTS5 Optimization**: Optimized tokenizer and ranking functions
- **Query Planning**: Analyze and optimize slow queries

### Maintenance Operations
```typescript
class DatabaseMaintenance {
  // Rebuild FTS5 index
  async rebuildFtsIndex(): Promise<void> {
    await this.db.execute(`INSERT INTO files_fts(files_fts) VALUES('rebuild')`);
  }

  // Analyze query performance
  async analyzeQueries(): Promise<void> {
    await this.db.execute(`ANALYZE`);
  }

  // Vacuum database
  async vacuum(): Promise<void> {
    await this.db.execute(`VACUUM`);
  }

  // Integrity check
  async integrityCheck(): Promise<boolean> {
    const result = await this.db.execute(`PRAGMA integrity_check`);
    return result === 'ok';
  }
}
```

## Backup and Recovery

### Backup Strategy
```typescript
class DatabaseBackup {
  async createBackup(backupPath: string): Promise<void> {
    // SQLite backup using built-in backup API
    const backup = this.db.backup(backupPath);
    return new Promise((resolve, reject) => {
      backup.step(-1); // Full backup
      backup.finish();
      resolve();
    });
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    // Close current database
    this.db.close();

    // Copy backup file
    await fs.copyFile(backupPath, this.config.path);

    // Reopen database
    this.db = new Database(this.config.path);
  }
}
```

This database schema provides efficient storage, full-text search capabilities, and robust migration management for the code indexing system.
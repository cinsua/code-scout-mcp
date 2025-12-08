import { promises as fs } from 'node:fs';

import type { DatabaseConfig } from '@/features/storage/types/StorageTypes';
import { DatabaseService } from '@/features/storage/services/DatabaseService';

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  const testDbPath = './test-database-service.db';

  const testConfig: DatabaseConfig = {
    path: testDbPath,
    maxConnections: 5,
    connectionTimeout: 30000,
    readonly: false,
    pragmas: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: 10000,
      temp_store: 'MEMORY',
      locking_mode: 'NORMAL',
      foreign_keys: 'ON',
      busy_timeout: 30000,
    },
  };

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // File doesn't exist, which is fine
    }

    dbService = new DatabaseService(testConfig);
    await dbService.initialize();
  });

  afterEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (dbService) {
      dbService.close();
    }

    // Clean up test database file
    try {
      await fs.unlink(testDbPath);
    } catch {
      // File doesn't exist or can't be deleted, which is fine
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(dbService).toBeDefined();
      const stats = dbService.getStats();
      expect(stats.connections.total).toBeGreaterThanOrEqual(0);
    });

    it('should create database file', async () => {
      const stats = await fs.stat(testDbPath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('Query Execution', () => {
    it('should execute simple query', async () => {
      const result = await dbService.executeOne('SELECT 1 as test');
      expect(result).toEqual({ test: 1 });
    });

    it('should execute query with parameters', async () => {
      const result = await dbService.executeOne('SELECT ? as value', [42]);
      expect(result).toEqual({ value: 42 });
    });

    it('should execute query returning multiple rows', async () => {
      const results = await dbService.executeQuery(
        'SELECT 1 as id UNION SELECT 2 UNION SELECT 3',
      );
      expect(results).toHaveLength(3);
      expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('should execute run query', async () => {
      await dbService.executeRun(
        'CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)',
      );

      const result = await dbService.executeRun(
        'INSERT INTO test_table (name) VALUES (?)',
        ['test'],
      );

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeDefined();
    });
  });

  describe('Transactions', () => {
    beforeEach(async () => {
      await dbService.executeRun(
        'CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)',
      );
    });

    it('should execute transaction successfully', async () => {
      const result = await dbService.executeTransaction(db => {
        const stmt = db.prepare('INSERT INTO test_table (name) VALUES (?)');
        stmt.run('test1');
        stmt.run('test2');
        return 2; // Return number of inserted rows
      });

      expect(result).toBe(2);

      const count = await dbService.executeOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM test_table',
      );
      expect(count?.count).toBe(2);
    });

    it('should rollback on transaction error', async () => {
      await expect(async () => {
        await dbService.executeTransaction(db => {
          db.prepare('INSERT INTO test_table (name) VALUES (?)').run('test1');
          throw new Error('Test error');
        });
      }).rejects.toThrow('Test error');

      const count = await dbService.executeOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM test_table',
      );
      expect(count?.count).toBe(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track query statistics', async () => {
      // Execute some queries
      await dbService.executeOne('SELECT 1');
      await dbService.executeOne('SELECT 2');
      await dbService.executeQuery('SELECT 1 UNION SELECT 2');

      const stats = dbService.getStats();
      expect(stats.queries.total).toBe(3);
      expect(stats.queries.failed).toBe(0);
    });

    it('should track failed queries', async () => {
      try {
        await dbService.executeOne('SELECT * FROM nonexistent_table');
      } catch {
        // Expected to fail
      }

      const stats = dbService.getStats();
      expect(stats.queries.total).toBe(1);
      expect(stats.queries.failed).toBe(1);
    });

    it('should perform health check', () => {
      const health = dbService.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.accessible).toBe(true);
    });
  });

  describe('Migration System', () => {
    it('should run migrations on initialization', () => {
      const migrationManager = dbService.getMigrationManager();
      const currentVersion = migrationManager.getCurrentVersion();
      expect(currentVersion).toBeGreaterThan(0);
    });

    it('should track executed migrations', () => {
      const migrationManager = dbService.getMigrationManager();
      const executedMigrations = migrationManager.getExecutedMigrations();
      expect(executedMigrations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid SQL gracefully', async () => {
      await expect(async () => {
        await dbService.executeOne('INVALID SQL');
      }).rejects.toThrow();
    });

    it('should provide structured error information', async () => {
      try {
        await dbService.executeOne('SELECT * FROM nonexistent_table');
      } catch (error) {
        expect(error).toHaveProperty('type');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('timestamp');
      }
    });
  });
});

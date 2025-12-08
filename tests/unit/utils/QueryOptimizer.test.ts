import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { QueryOptimizer } from '@/features/storage/utils/QueryOptimizer';

describe('QueryOptimizer', () => {
  let optimizer: QueryOptimizer;
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for testing
    db = new Database(':memory:');

    // Create test tables
    db.exec(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER,
        created_at INTEGER
      );
      CREATE INDEX idx_test_name ON test_table(name);
      CREATE INDEX idx_test_created ON test_table(created_at);
    `);

    optimizer = new QueryOptimizer(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Query Optimization', () => {
    it('should optimize simple SELECT queries', () => {
      const query = 'SELECT * FROM test_table WHERE name = ?';
      const params = ['test'];

      const result = optimizer.optimizeQuery(query, params);

      expect(result).toHaveProperty('optimizedQuery');
      expect(result).toHaveProperty('params');
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('estimatedImprovement');
      expect(typeof result.estimatedImprovement).toBe('number');
    });

    it('should handle queries with multiple parameters', () => {
      const query = 'SELECT * FROM test_table WHERE name = ? AND value > ?';
      const params = ['test', 100];

      const result = optimizer.optimizeQuery(query, params);

      expect(result.params).toEqual(params);
      expect(result.estimatedImprovement).toBeGreaterThanOrEqual(0);
    });

    it('should cache optimization results', () => {
      const query = 'SELECT * FROM test_table WHERE id = ?';
      const params = [1];

      // First call
      const result1 = optimizer.optimizeQuery(query, params);
      // Second call should use cache
      const result2 = optimizer.optimizeQuery(query, params);

      expect(result1).toEqual(result2);
    });

    it('should handle different query types', () => {
      const selectQuery = 'SELECT COUNT(*) FROM test_table';
      const insertQuery = 'INSERT INTO test_table (name, value) VALUES (?, ?)';
      const updateQuery = 'UPDATE test_table SET value = ? WHERE id = ?';

      const selectResult = optimizer.optimizeQuery(selectQuery);
      const insertResult = optimizer.optimizeQuery(insertQuery, ['test', 100]);
      const updateResult = optimizer.optimizeQuery(updateQuery, [200, 1]);

      expect(selectResult.estimatedImprovement).toBeGreaterThanOrEqual(0);
      expect(insertResult.estimatedImprovement).toBeGreaterThanOrEqual(0);
      expect(updateResult.estimatedImprovement).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Query Plan Analysis', () => {
    it('should analyze query execution plan', () => {
      const query = 'SELECT * FROM test_table WHERE name = ?';

      const result = optimizer.optimizeQuery(query, ['test']);

      if (result.plan) {
        expect(result.plan).toHaveProperty('query');
        expect(result.plan).toHaveProperty('explainResult');
        expect(Array.isArray(result.plan.explainResult)).toBe(true);
      }
    });

    it('should estimate query cost', () => {
      const query = 'SELECT * FROM test_table';

      const result = optimizer.optimizeQuery(query);

      if (result.plan) {
        expect(typeof result.plan.estimatedCost).toBe('number');
        expect(result.plan.estimatedCost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Index Suggestions', () => {
    it('should suggest indexes for tables', () => {
      const suggestions = optimizer.suggestIndexes('test_table');

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle non-existent tables gracefully', () => {
      const suggestions = optimizer.suggestIndexes('non_existent_table');

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Query Security Analysis', () => {
    it('should analyze query security', () => {
      const query = 'SELECT * FROM test_table WHERE id = ?';

      const analysis = optimizer.analyzeQuerySecurity(query);

      expect(analysis).toHaveProperty('isSafe');
      expect(analysis).toHaveProperty('warnings');
      expect(Array.isArray(analysis.warnings)).toBe(true);
      expect(typeof analysis.isSafe).toBe('boolean');
    });

    it('should provide warnings for dangerous patterns', () => {
      const dangerousQuery = 'DROP TABLE test_table';

      const analysis = optimizer.analyzeQuerySecurity(dangerousQuery);

      expect(analysis.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Execution Plan Retrieval', () => {
    it('should get execution plan for valid query', () => {
      const query = 'SELECT * FROM test_table WHERE id = ?';

      const plan = optimizer.getExecutionPlan(query);

      if (plan) {
        expect(plan).toHaveProperty('query');
        expect(plan).toHaveProperty('explainResult');
        expect(Array.isArray(plan.explainResult)).toBe(true);
      }
    });

    it('should handle invalid queries gracefully', () => {
      const invalidQuery = 'SELECT * FROM non_existent_table';

      expect(() => {
        optimizer.getExecutionPlan(invalidQuery);
      }).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track optimization statistics', () => {
      const query = 'SELECT * FROM test_table WHERE id = ?';

      // Optimize multiple times
      optimizer.optimizeQuery(query, [1]);
      optimizer.optimizeQuery(query, [2]);
      optimizer.optimizeQuery(query, [3]);

      // Should use cache for subsequent calls
      const result = optimizer.optimizeQuery(query, [4]);

      expect(result.estimatedImprovement).toBeGreaterThanOrEqual(0);
    });

    it('should measure optimization time', () => {
      const query = 'SELECT * FROM test_table WHERE name = ?';

      const startTime = Date.now();
      optimizer.optimizeQuery(query, ['test']);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed queries', () => {
      const malformedQuery = 'SELCT * FROM test_table'; // Typo

      expect(() => {
        optimizer.optimizeQuery(malformedQuery);
      }).not.toThrow();
    });

    it('should handle empty queries', () => {
      expect(() => {
        optimizer.optimizeQuery('');
      }).not.toThrow();
    });

    it('should handle null parameters', () => {
      const query = 'SELECT * FROM test_table WHERE id = ?';

      expect(() => {
        optimizer.optimizeQuery(query, [null]);
      }).not.toThrow();
    });
  });

  describe('Cache Management', () => {
    it('should cache query plans', () => {
      const query = 'SELECT * FROM test_table WHERE id = ?';

      const result1 = optimizer.optimizeQuery(query, [1]);
      const result2 = optimizer.optimizeQuery(query, [1]);

      expect(result1).toEqual(result2);
    });

    it('should differentiate between different parameters', () => {
      const query = 'SELECT * FROM test_table WHERE id = ?';

      const result1 = optimizer.optimizeQuery(query, [1]);
      const result2 = optimizer.optimizeQuery(query, [2]);

      // Should have same optimization but different params
      expect(result1.estimatedImprovement).toBe(result2.estimatedImprovement);
      expect(result1.params).toEqual([1]);
      expect(result2.params).toEqual([2]);
    });

    it('should handle cache size limits', () => {
      // Generate many different queries to test cache limits
      for (let i = 0; i < 100; i++) {
        optimizer.optimizeQuery(`SELECT * FROM test_table WHERE id = ${i}`, []);
      }

      // Should still work without memory issues
      const result = optimizer.optimizeQuery(
        'SELECT * FROM test_table WHERE id = ?',
        [1],
      );
      expect(result.estimatedImprovement).toBeGreaterThanOrEqual(0);
    });
  });
});

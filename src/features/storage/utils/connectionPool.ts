import Database from 'better-sqlite3';

import type {
  DatabaseConfig,
  ConnectionPoolStats,
} from '../types/StorageTypes';

// Constants for connection pool health thresholds
const PERCENTAGE_MULTIPLIER = 100;
const CRITICAL_UTILIZATION_THRESHOLD = 0.9;
const WARNING_UTILIZATION_THRESHOLD = 0.8;

/**
 * Connection pool for better-sqlite3 database connections
 */
export class ConnectionPool {
  private connections: Database.Database[] = [];
  private allConnections: Set<Database.Database> = new Set();
  private waiting: Array<{
    resolve: (db: Database.Database) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private stats: ConnectionPoolStats = {
    created: 0,
    acquired: 0,
    released: 0,
    destroyed: 0,
    size: 0,
    available: 0,
    waiting: 0,
  };
  private isClosing = false;

  constructor(protected config: DatabaseConfig) {}

  /**
   * Acquire a database connection from the pool
   */
  getConnection(): Promise<Database.Database> {
    if (this.isClosing) {
      throw new Error('Connection pool is closing');
    }

    // Check if there's an available connection
    if (this.connections.length > 0) {
      const connection = this.connections.pop();
      if (connection) {
        this.stats.acquired++;
        this.stats.available = this.connections.length;
        return Promise.resolve(connection);
      }
    }

    // Create new connection if under limit
    if (this.stats.size < this.config.maxConnections) {
      const connection = this.createConnection();
      this.stats.created++;
      this.stats.size++;
      this.stats.acquired++;
      return Promise.resolve(connection);
    }

    // Wait for available connection
    return new Promise<Database.Database>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waiting.splice(index, 1);
          this.stats.waiting = this.waiting.length;
        }
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      this.waiting.push({
        resolve,
        reject,
        timeout,
      });
      this.stats.waiting = this.waiting.length;
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connection: Database.Database): void {
    if (this.isClosing) {
      connection.close();
      this.stats.destroyed++;
      this.stats.size--;
      return;
    }

    // Check if there are waiting requests
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        this.stats.waiting = this.waiting.length;
        this.stats.acquired++;
        waiter.resolve(connection);
      }
      return;
    }

    // Return connection to pool
    this.connections.push(connection);
    this.stats.released++;
    this.stats.available = this.connections.length;
  }

  /**
   * Close all connections and cleanup
   */
  closeAll(): void {
    this.isClosing = true;

    // Reject all waiting requests
    const waiting = this.waiting.splice(0);
    this.stats.waiting = 0;
    waiting.forEach(waiter => {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Connection pool is closing'));
    });

    // Close all connections
    this.allConnections.forEach(connection => {
      try {
        connection.close();
        this.stats.destroyed++;
        this.stats.size--;
      } catch {
        // Ignore errors during cleanup
      }
    });
    this.allConnections.clear();
    this.connections = [];
    this.stats.available = 0;
  }

  /**
   * Get connection pool statistics
   */
  getStats(): ConnectionPoolStats {
    return { ...this.stats };
  }

  /**
   * Create a new database connection with proper configuration
   */
  protected createConnection(): Database.Database {
    const db = new Database(this.config.path, {
      readonly: this.config.readonly,
      fileMustExist: false,
    });

    // Configure pragmas
    this.configurePragmas(db);

    // Track the connection
    this.allConnections.add(db);

    return db;
  }

  /**
   * Configure database pragmas for optimal performance
   */
  protected configurePragmas(db: Database.Database): void {
    const { pragmas } = this.config;

    // Set journal mode
    db.pragma(`journal_mode = ${pragmas.journal_mode}`);

    // Set synchronous mode
    db.pragma(`synchronous = ${pragmas.synchronous}`);

    // Set cache size
    db.pragma(`cache_size = ${pragmas.cache_size}`);

    // Set temp store
    db.pragma(`temp_store = ${pragmas.temp_store}`);

    // Set locking mode
    db.pragma(`locking_mode = ${pragmas.locking_mode}`);

    // Enable foreign keys
    db.pragma(`foreign_keys = ${pragmas.foreign_keys}`);

    // Set busy timeout
    db.pragma(`busy_timeout = ${pragmas.busy_timeout}`);

    // Optimize for our use case
    db.pragma('mmap_size = 268435456'); // 256MB
    db.pragma('optimize');
  }

  /**
   * Perform health check on the connection pool
   */
  healthCheck(): {
    status: 'healthy' | 'warning' | 'critical';
    details: Record<string, unknown>;
  } {
    const { size, available, waiting } = this.stats;
    const utilizationRate = size > 0 ? (size - available) / size : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const details: Record<string, unknown> = {
      totalConnections: size,
      availableConnections: available,
      waitingRequests: waiting,
      utilizationRate: Math.round(utilizationRate * PERCENTAGE_MULTIPLIER),
    };

    // Determine health status
    if (waiting > 0) {
      status = 'warning';
      details.warning = 'Requests waiting for connections';
    }

    if (utilizationRate > CRITICAL_UTILIZATION_THRESHOLD) {
      status = 'critical';
      details.critical = 'Connection pool nearly exhausted';
    } else if (utilizationRate > WARNING_UTILIZATION_THRESHOLD) {
      status = 'warning';
      details.warning = 'High connection pool utilization';
    }

    return { status, details };
  }
}

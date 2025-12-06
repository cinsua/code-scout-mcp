// Main exports
export { DatabaseService } from './services/DatabaseService';

// Types
export type {
  DatabaseConfig,
  DatabaseStats,
  DatabaseHealth,
  QueryOptions,
  TransactionCallback,
  DatabaseError,
  DatabaseErrorType,
  Migration,
  ConnectionPoolStats,
  BackupOptions,
  MaintenanceOptions,
} from './types/StorageTypes';

// Utilities
export { ConnectionPool } from './utils/connectionPool';
export {
  QueryBuilder,
  InsertBuilder,
  UpdateBuilder,
  DeleteBuilder,
  FTSQueryBuilder,
  QueryUtils,
} from './utils/queryBuilder';
export { DatabaseMaintenance } from './utils/databaseMaintenance';

// Migrations
export { MigrationManager } from './migrations/MigrationManager';

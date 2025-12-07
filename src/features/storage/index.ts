// Main exports
export { DatabaseService } from './services/DatabaseService';
export { FileRepository } from './services/FileRepository';
export { SearchRepository } from './services/SearchRepository';

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
  FileMetadata,
  ListOptions,
  BatchResult,
  SearchCandidate,
  SearchOptions,
  SearchSuggestion,
  SearchStats,
  IndexMaintenanceOptions,
  IndexMaintenanceResult,
  SearchMatch,
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
  SearchQueryBuilder,
} from './utils/queryBuilder';
export { DatabaseMaintenance } from './utils/databaseMaintenance';

// Migrations
export { MigrationManager } from './migrations/MigrationManager';

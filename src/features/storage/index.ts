// Main exports
export { DatabaseService } from './services/DatabaseService';
export { FileRepository } from './services/FileRepository';
export { SearchRepository } from './services/SearchRepository';
export { PerformanceService } from './services/PerformanceService';

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
  EnhancedConnectionPoolStats,
  PerformanceConfig,
  PerformanceReport,
  QueryMetrics,
  SlowQueryLog,
  PerformanceThresholds,
  QueryPlan,
  OptimizedQuery,
  ResourceStats,
} from './types/StorageTypes';

// Utilities
export { ConnectionPool } from './utils/connectionPool';
export { EnhancedConnectionPool } from './utils/EnhancedConnectionPool';
export { PerformanceMonitor } from './utils/PerformanceMonitor';
export { QueryOptimizer } from './utils/QueryOptimizer';
export { ResourceManager } from './utils/ResourceManager';
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

// Configuration
export { PerformanceConfigManager } from './config/PerformanceConfig';

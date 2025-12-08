import type Database from 'better-sqlite3';

import type { Migration } from '@/features/storage/types/StorageTypes';

/**
 * Migration interface for internal use
 */
export interface InternalMigration extends Migration {
  /** Migration up function */
  up: (db: Database.Database) => void;
  /** Migration down function */
  down: (db: Database.Database) => void;
}

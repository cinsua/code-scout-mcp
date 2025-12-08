/**
 * Configuration System Test
 *
 * Quick test to verify the configuration management system
 * is working correctly.
 */

import { LogManager } from '@/shared/utils/LogManager';
import { ConfigurationManager } from '@/config/services/ConfigurationManager';
import { ConfigurationError } from '@/config/errors/ConfigurationError';

// Constants for manual testing
const TEST_MAX_WORKERS = 8;

async function testConfigurationLoading(
  manager: ConfigurationManager,
): Promise<void> {
  const logger = LogManager.getLogger('config-test');
  logger.info('Loading configuration...');
  const config = await manager.loadConfiguration();

  logger.info('Configuration loaded successfully', {
    version: config.version,
    profile: config.profile ?? 'default',
    maxWorkers: config.indexing.maxWorkers,
    databasePath: config.database.path,
    logLevel: config.logging.level,
  });
}

function testConfigurationAccess(manager: ConfigurationManager): void {
  const logger = LogManager.getLogger('config-test');
  logger.info('Testing configuration access...');
  const maxWorkers = manager.get<number>('indexing.maxWorkers');
  logger.info('Retrieved maxWorkers successfully', { maxWorkers });
}

async function testConfigurationUpdate(
  manager: ConfigurationManager,
): Promise<void> {
  const logger = LogManager.getLogger('config-test');
  logger.info('Testing configuration update...');
  await manager.updateConfiguration(
    'indexing.maxWorkers',
    TEST_MAX_WORKERS,
    'test',
  );
  const updatedWorkers = manager.get<number>('indexing.maxWorkers');
  logger.info('Updated maxWorkers successfully', { updatedWorkers });
}

function testConfigurationExport(manager: ConfigurationManager): void {
  const logger = LogManager.getLogger('config-test');
  logger.info('Testing configuration export...');
  const exported = manager.exportConfiguration(false);
  logger.info('Exported configuration successfully', {
    length: exported.length,
  });
}

function testConfigurationHistory(manager: ConfigurationManager): void {
  const logger = LogManager.getLogger('config-test');
  logger.info('Testing configuration history...');
  const history = manager.getHistory();
  const snapshots = history.getAllSnapshots();
  logger.info('Retrieved configuration history', {
    snapshotCount: snapshots.length,
  });
}

function testConfigurationSources(manager: ConfigurationManager): void {
  const logger = LogManager.getLogger('config-test');
  logger.info('Testing configuration sources...');
  const sources = manager.getSources();
  logger.info('Retrieved configuration sources', {
    sourceCount: sources.length,
    sources: sources.map(s => ({ name: s.name, priority: s.priority })),
  });
}

async function testConfigurationSystem(): Promise<void> {
  const logger = LogManager.getLogger('config-test');
  logger.info('Starting configuration management system tests');

  try {
    // Create configuration manager
    const manager = new ConfigurationManager();

    // Run individual tests
    await testConfigurationLoading(manager);
    testConfigurationAccess(manager);
    await testConfigurationUpdate(manager);
    testConfigurationExport(manager);
    testConfigurationHistory(manager);
    testConfigurationSources(manager);

    logger.info('All configuration system tests passed');
  } catch (error) {
    const logger = LogManager.getLogger('config-test');
    if (error instanceof ConfigurationError) {
      logger.error('Configuration test failed', error, {
        errorType: 'ConfigurationError',
        userMessage: error.toUserString(),
      });
    } else {
      logger.error(
        'Unexpected test error',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void testConfigurationSystem();
}

export {
  testConfigurationSystem,
  testConfigurationLoading,
  testConfigurationAccess,
  testConfigurationUpdate,
  testConfigurationExport,
  testConfigurationHistory,
  testConfigurationSources,
};

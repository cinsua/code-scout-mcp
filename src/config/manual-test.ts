/**
 * Configuration System Test
 *
 * Quick test to verify the configuration management system
 * is working correctly.
 */

import { ConfigurationManager } from './services/ConfigurationManager';
import { ConfigurationError } from './errors/ConfigurationError';

// Constants for manual testing
const TEST_MAX_WORKERS = 8;

async function testConfigurationLoading(
  manager: ConfigurationManager,
): Promise<void> {
  console.log('1. Loading configuration...');
  const config = await manager.loadConfiguration();

  console.log('✓ Configuration loaded successfully');
  console.log(`   Version: ${config.version}`);
  console.log(`   Profile: ${config.profile ?? 'default'}`);
  console.log(`   Max Workers: ${config.indexing.maxWorkers}`);
  console.log(`   Database Path: ${config.database.path}`);
  console.log(`   Log Level: ${config.logging.level}`);
}

function testConfigurationAccess(manager: ConfigurationManager): void {
  console.log('\n2. Testing configuration access...');
  const maxWorkers = manager.get<number>('indexing.maxWorkers');
  console.log(`✓ Retrieved maxWorkers: ${maxWorkers}`);
}

async function testConfigurationUpdate(
  manager: ConfigurationManager,
): Promise<void> {
  console.log('\n3. Testing configuration update...');
  await manager.updateConfiguration(
    'indexing.maxWorkers',
    TEST_MAX_WORKERS,
    'test',
  );
  const updatedWorkers = manager.get<number>('indexing.maxWorkers');
  console.log(`✓ Updated maxWorkers: ${updatedWorkers}`);
}

function testConfigurationExport(manager: ConfigurationManager): void {
  console.log('\n4. Testing configuration export...');
  const exported = manager.exportConfiguration(false);
  console.log(`✓ Exported configuration (${exported.length} chars)`);
}

function testConfigurationHistory(manager: ConfigurationManager): void {
  console.log('\n5. Testing configuration history...');
  const history = manager.getHistory();
  const snapshots = history.getAllSnapshots();
  console.log(`✓ History contains ${snapshots.length} snapshots`);
}

function testConfigurationSources(manager: ConfigurationManager): void {
  console.log('\n6. Testing configuration sources...');
  const sources = manager.getSources();
  console.log(`✓ Found ${sources.length} configuration sources:`);
  sources.forEach(source => {
    console.log(`   - ${source.name} (priority: ${source.priority})`);
  });
}

async function testConfigurationSystem(): Promise<void> {
  console.log('Testing Configuration Management System...\n');

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

    console.log('\n✅ All configuration system tests passed!');
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`❌ Configuration Error: ${error.toUserString()}`);
    } else {
      console.error(
        `❌ Unexpected Error: ${error instanceof Error ? error.message : String(error)}`,
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

/**
 * Configuration System Test
 *
 * Quick test to verify the configuration management system
 * is working correctly.
 */

import { ConfigurationManager } from './services/ConfigurationManager';
import { ConfigurationError } from './errors/ConfigurationError';

async function testConfigurationSystem(): Promise<void> {
  console.log('Testing Configuration Management System...\n');

  try {
    // Create configuration manager
    const manager = new ConfigurationManager();

    // Test loading configuration
    console.log('1. Loading configuration...');
    const config = await manager.loadConfiguration();

    console.log('✓ Configuration loaded successfully');
    console.log(`   Version: ${config.version}`);
    console.log(`   Profile: ${config.profile || 'default'}`);
    console.log(`   Max Workers: ${config.indexing.maxWorkers}`);
    console.log(`   Database Path: ${config.database.path}`);
    console.log(`   Log Level: ${config.logging.level}`);

    // Test configuration access
    console.log('\n2. Testing configuration access...');
    const maxWorkers = manager.get<number>('indexing.maxWorkers');
    console.log(`✓ Retrieved maxWorkers: ${maxWorkers}`);

    // Test configuration update
    console.log('\n3. Testing configuration update...');
    await manager.updateConfiguration('indexing.maxWorkers', 8, 'test');
    const updatedWorkers = manager.get<number>('indexing.maxWorkers');
    console.log(`✓ Updated maxWorkers: ${updatedWorkers}`);

    // Test configuration export
    console.log('\n4. Testing configuration export...');
    const exported = manager.exportConfiguration(false);
    console.log(`✓ Exported configuration (${exported.length} chars)`);

    // Test configuration history
    console.log('\n5. Testing configuration history...');
    const history = manager.getHistory();
    const snapshots = history.getAllSnapshots();
    console.log(`✓ History contains ${snapshots.length} snapshots`);

    // Test configuration sources
    console.log('\n6. Testing configuration sources...');
    const sources = manager.getSources();
    console.log(`✓ Found ${sources.length} configuration sources:`);
    sources.forEach((source) => {
      console.log(`   - ${source.name} (priority: ${source.priority})`);
    });

    console.log('\n✅ All configuration system tests passed!');
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`❌ Configuration Error: ${error.toUserString()}`);
    } else {
      console.error(
        `❌ Unexpected Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConfigurationSystem();
}

export { testConfigurationSystem };

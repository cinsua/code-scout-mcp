#!/usr/bin/env node

/**
 * Code-Scout MCP CLI
 * Command-line interface entry point
 */

import { LogManager } from './shared/utils/LogManager';

import CodeScoutServer from './index';

function main(): void {
  const logger = LogManager.getLogger('cli');
  const server = new CodeScoutServer();

  logger.info('Starting Code-Scout MCP server');
  server.start();
}

// Handle process termination
process.on('SIGINT', () => {
  const logger = LogManager.getLogger('cli');
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  const logger = LogManager.getLogger('cli');
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

main();

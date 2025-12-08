#!/usr/bin/env node

/**
 * Code-Scout MCP CLI
 * Command-line interface entry point
 */

import { LogManager } from './shared/utils/LogManager';
import { validateErrorConstantEnvironment } from './shared/errors/ErrorConstants';

import CodeScoutServer from './index';

function main(): void {
  const logger = LogManager.getLogger('cli');

  // Validate error handling environment variables
  const envErrors = validateErrorConstantEnvironment();
  if (envErrors.length > 0) {
    logger.warn('Invalid error handling environment variables detected:', {
      errors: envErrors,
      suggestions:
        'Check environment variable names and values match expected format',
    });
  }

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

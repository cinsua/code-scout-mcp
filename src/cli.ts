#!/usr/bin/env node

/**
 * Code-Scout MCP CLI
 * Command-line interface entry point
 */

import CodeScoutServer from './index';

function main(): void {
  const server = new CodeScoutServer();

  server.start();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main();

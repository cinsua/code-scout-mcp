#!/usr/bin/env node

/**
 * Code-Scout MCP CLI
 * Command-line interface entry point
 */

import CodeScoutServer from './index';

async function main(): Promise<void> {
  const server = new CodeScoutServer();

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start Code-Scout MCP Server:', error);
    process.exit(1);
  }
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

void main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

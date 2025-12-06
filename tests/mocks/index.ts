// Test mocks entry point
// This file exports all test mocks and stubs

import { jest } from '@jest/globals';

// Mock file system operations
export const mockFileSystem = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
};

// Mock database operations
export const mockDatabase = {
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
} as any;

// Mock MCP server
export const mockMCPServer = {
  start: jest.fn(),
  stop: jest.fn(),
  handleRequest: jest.fn(),
  sendResponse: jest.fn(),
};

// Mock file watcher
export const mockFileWatcher = {
  watch: jest.fn(),
  unwatch: jest.fn(),
  on: jest.fn(),
  close: jest.fn(),
};

// Mock parser
export const mockParser = {
  parseFile: jest.fn(),
  parseDirectory: jest.fn(),
  getLanguage: jest.fn(),
  extractSymbols: jest.fn(),
};

// Mock indexer
export const mockIndexer = {
  indexFile: jest.fn(),
  indexDirectory: jest.fn(),
  search: jest.fn(),
  updateIndex: jest.fn(),
};

// Helper to reset all mocks
export function resetAllMocks() {
  Object.values(mockFileSystem).forEach((mock: any) => mock.mockReset());
  Object.values(mockDatabase).forEach((mock: any) => mock.mockReset());
  Object.values(mockMCPServer).forEach((mock: any) => mock.mockReset());
  Object.values(mockFileWatcher).forEach((mock: any) => mock.mockReset());
  Object.values(mockParser).forEach((mock: any) => mock.mockReset());
  Object.values(mockIndexer).forEach((mock: any) => mock.mockReset());
}

// Helper to setup default mock behaviors
export function setupDefaultMocks() {
  (mockFileSystem.existsSync as any).mockReturnValue(true);
  (mockFileSystem.readdirSync as any).mockReturnValue(['file1.ts', 'file2.js']);
  (mockFileSystem.statSync as any).mockReturnValue({
    isFile: () => true,
    isDirectory: () => false,
    size: 1024,
    mtime: new Date(),
  });

  (mockDatabase.query as any).mockResolvedValue([]);
  (mockDatabase.insert as any).mockResolvedValue({ id: 1, affectedRows: 1 });
  (mockDatabase.update as any).mockResolvedValue({ id: 1, affectedRows: 1 });
  (mockDatabase.delete as any).mockResolvedValue({ id: 1, affectedRows: 1 });

  (mockMCPServer.start as any).mockResolvedValue(undefined);
  (mockMCPServer.stop as any).mockResolvedValue(undefined);
  (mockMCPServer.handleRequest as any).mockResolvedValue({ success: true });

  (mockParser.parseFile as any).mockResolvedValue({
    language: 'typescript',
    symbols: [],
    ast: {},
  });

  (mockIndexer.indexFile as any).mockResolvedValue({ success: true });
  (mockIndexer.search as any).mockResolvedValue({
    results: [],
    total: 0,
  });
}

export const mocksLoaded = true;

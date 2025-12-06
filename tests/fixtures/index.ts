// Test fixtures entry point
// This file exports all test fixtures and utilities

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TestRepo {
  path: string;
  cleanup: () => void;
}

export function createTestRepository(
  name: string,
  files: Record<string, string>
): TestRepo {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `code-scout-test-${name}-`)
  );

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  return {
    path: tempDir,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

export function createTestFile(
  filename: string,
  content: string,
  language: string = 'typescript'
) {
  return {
    filename,
    content,
    language,
    path: `/test/${filename}`,
    size: content.length,
    lastModified: new Date().toISOString(),
  };
}

export function createTestCodebase() {
  return {
    'src/index.ts': `
export function main() {
  console.log('Hello, World!');
  return 42;
}

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
}
`,
    'src/utils.ts': `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}
`,
    'package.json': JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'jest',
          build: 'tsc',
        },
      },
      null,
      2
    ),
    'README.md': `# Test Project

This is a test project for unit testing purposes.

## Features

- Basic TypeScript setup
- Utility functions
- Example classes
`,
  };
}

export const fixturesLoaded = true;

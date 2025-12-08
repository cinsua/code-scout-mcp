/**
 * Shared utility functions for performance-related operations
 * Centralized to eliminate code duplication across the codebase
 */

import { sanitizeQueryForLogging as sanitizeQuery } from '@/shared/utils/QuerySanitizer';

/**
 * Hash a query string for identification and caching purposes
 * Uses a consistent hash algorithm across all components
 */
export function hashQuery(query: string): string {
  // Simple hash function - in production, use a proper hashing algorithm
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Generate a cache key for queries with parameters
 */
export function generateQueryCacheKey(
  query: string,
  params?: unknown[],
): string {
  const paramString = params ? JSON.stringify(params) : '';
  return `${hashQuery(query)}:${paramString}`;
}

/**
 * Validate if a string is a valid SQL identifier
 */
export function isValidSqlIdentifier(identifier: string): boolean {
  return /^[A-Z_a-z]\w*$/.test(identifier);
}

/**
 * Sanitize a query string for logging (remove sensitive data)
 */
export const sanitizeQueryForLogging = sanitizeQuery;

/**
 * Calculate percentage with proper bounds checking
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  const percentage = (value / total) * 100;
  return Math.min(Math.max(percentage, 0), 100);
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // eslint-disable-next-line security/detect-object-injection
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration in milliseconds to human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Clamp a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Check if a value is a valid number (not NaN or Infinity)
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Deep freeze an object for immutability (development only)
 */
export function deepFreeze<T>(obj: T): T {
  if (process.env.NODE_ENV === 'development') {
    Object.freeze(obj);
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (typeof value === 'object' && value !== null) {
          deepFreeze(value);
        }
      }
    }
  }
  return obj;
}

/**
 * Query sanitization utilities for secure logging
 * Removes sensitive data from SQL queries and other strings before logging
 */

/**
 * Maximum length for sanitized queries to prevent log bloat
 */
export const MAX_QUERY_LENGTH = 200;

/**
 * Placeholder used to replace sensitive data in sanitized queries
 */
export const SANITIZED_PLACEHOLDER = '***';

/**
 * Sanitize a query string for logging by removing sensitive data
 *
 * This function:
 * - Replaces string literals with placeholders
 * - Replaces numeric values with placeholders
 * - Normalizes whitespace
 * - Limits the total length to prevent log bloat
 *
 * @param query - The raw query string to sanitize
 * @returns The sanitized query string safe for logging
 */
export function sanitizeQueryForLogging(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  return query
    .replace(/'[^']*'/g, `'${SANITIZED_PLACEHOLDER}'`) // Replace string literals
    .replace(/\b\d+\b/g, SANITIZED_PLACEHOLDER) // Replace whole number words
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, MAX_QUERY_LENGTH); // Limit length for security and readability
}

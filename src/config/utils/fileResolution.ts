/**
 * File Resolution Utilities
 *
 * This module provides utilities for resolving configuration file paths,
 * normalizing paths, expanding environment variables, and handling fallbacks.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Stats } from 'fs';

import { ConfigurationError } from '@/config/errors/ConfigurationError';

/**
 * File resolution options
 */
export interface FileResolutionOptions {
  /**
   * Whether to expand environment variables
   */
  expandEnvVars?: boolean;

  /**
   * Whether to normalize paths
   */
  normalizePaths?: boolean;

  /**
   * Whether to resolve symlinks
   */
  resolveSymlinks?: boolean;

  /**
   * Whether to check file permissions
   */
  checkPermissions?: boolean;

  /**
   * Base directory for relative paths
   */
  baseDir?: string;
}

/**
 * File resolution result
 */
export interface FileResolutionResult {
  /**
   * Resolved absolute path
   */
  resolvedPath: string;

  /**
   * Whether the file exists
   */
  exists: boolean;

  /**
   * File stats if it exists
   */
  stats?: Stats;

  /**
   * Whether the file is readable
   */
  readable: boolean;

  /**
   * Whether the file is writable
   */
  writable: boolean;

  /**
   * Original path before resolution
   */
  originalPath: string;

  /**
   * Any warnings that occurred during resolution
   */
  warnings: string[];
}

/**
 * Check file existence and permissions
 */
async function checkFileInfo(
  resolvedPath: string,
  checkPermissions: boolean,
  warnings: string[],
): Promise<{
  exists: boolean;
  stats: Stats | undefined;
  readable: boolean;
  writable: boolean;
}> {
  let exists = false;
  let stats: Stats | undefined;
  let readable = false;
  let writable = false;

  try {
    stats = await fs.stat(resolvedPath);
    exists = true;

    // Check permissions if requested
    if (checkPermissions) {
      try {
        await fs.access(resolvedPath, fs.constants.R_OK);
        readable = true;
      } catch {
        warnings.push(`File is not readable: ${resolvedPath}`);
      }

      try {
        await fs.access(resolvedPath, fs.constants.W_OK);
        writable = true;
      } catch {
        // Not writable is not necessarily a warning
      }
    }
  } catch {
    // File doesn't exist
  }

  return { exists, stats, readable, writable };
}

/**
 * Resolve a file path with various options
 *
 * @param filePath - Path to resolve
 * @param options - Resolution options
 * @returns Promise<FileResolutionResult>
 */
/**
 * Process path through various transformations based on options
 */
async function processPath(
  filePath: string,
  options: Required<
    Pick<
      FileResolutionOptions,
      'expandEnvVars' | 'normalizePaths' | 'resolveSymlinks' | 'baseDir'
    >
  >,
  warnings: string[],
): Promise<string> {
  let processedPath = filePath;

  // Expand environment variables
  if (options.expandEnvVars) {
    processedPath = expandEnvironmentVariables(processedPath);
  }

  // Convert to absolute path if relative
  if (!path.isAbsolute(processedPath)) {
    processedPath = path.resolve(options.baseDir, processedPath);
  }

  // Normalize path separators and resolve .. and .
  if (options.normalizePaths) {
    processedPath = path.normalize(processedPath);
  }

  // Resolve symlinks if requested
  if (options.resolveSymlinks) {
    try {
      processedPath = await fs.realpath(processedPath);
    } catch (error) {
      warnings.push(
        `Failed to resolve symlinks: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return processedPath;
}

export async function resolveFile(
  filePath: string,
  options: FileResolutionOptions = {},
): Promise<FileResolutionResult> {
  const processedOptions = processResolutionOptions(options);
  const warnings: string[] = [];

  try {
    const resolvedPath = await processPath(
      filePath,
      processedOptions,
      warnings,
    );

    const fileInfo = await checkFileInfo(
      resolvedPath,
      processedOptions.checkPermissions,
      warnings,
    );

    return {
      resolvedPath,
      ...fileInfo,
      originalPath: filePath,
      warnings,
    };
  } catch (error) {
    throw new ConfigurationError(
      `Failed to resolve file path '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
      'FILE_RESOLUTION_ERROR',
    );
  }
}

/**
 * Process and normalize resolution options
 */
/**
 * Process and normalize resolution options
 */
function processResolutionOptions(
  options: FileResolutionOptions,
): Required<FileResolutionOptions> {
  return {
    expandEnvVars: options.expandEnvVars ?? true,
    normalizePaths: options.normalizePaths ?? true,
    resolveSymlinks: options.resolveSymlinks ?? false,
    checkPermissions: options.checkPermissions ?? true,
    baseDir: options.baseDir ?? process.cwd(),
  };
}

/**
 * Expand environment variables in a path string
 *
 * @param inputPath - Path with environment variables
 * @returns Expanded path
 */
export function expandEnvironmentVariables(inputPath: string): string {
  return inputPath.replace(
    /\$([A-Z_][\dA-Z_]*)|\${([A-Z_][\dA-Z_]*)}/g,
    (match, p1, p2) => {
      const varName = p1 ?? p2;
      const value = process.env[varName];

      if (value === undefined) {
        throw new ConfigurationError(
          `Environment variable '${varName}' is not set`,
          'ENV_VAR_NOT_SET',
        );
      }

      return value;
    },
  );
}

/**
 * Normalize a path and resolve any inconsistencies
 *
 * @param filePath - Path to normalize
 * @param baseDir - Base directory for relative paths
 * @returns Normalized absolute path
 */
export function normalizePath(
  filePath: string,
  baseDir: string = process.cwd(),
): string {
  // Convert to absolute if relative
  let normalized = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(baseDir, filePath);

  // Normalize path separators and resolve .. and .
  normalized = path.normalize(normalized);

  return normalized;
}

/**
 * Check if a path is safe (doesn't escape base directory)
 *
 * @param filePath - Path to check
 * @param baseDir - Base directory to contain the path
 * @returns boolean
 */
export function isPathSafe(
  filePath: string,
  baseDir: string = process.cwd(),
): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, filePath);

  return resolvedPath.startsWith(resolvedBase);
}

/**
 * Find configuration file with fallback handling
 *
 * @param possiblePaths - Array of possible config file paths
 * @param options - Resolution options
 * @returns Promise<FileResolutionResult | null>
 */
/**
 * Try to resolve a single config file path and collect errors
 */
async function tryResolveConfigPath(
  configPath: string,
  options: FileResolutionOptions,
  errors: string[],
): Promise<FileResolutionResult | null> {
  try {
    const result = await resolveFile(configPath, options);

    if (result.exists && result.readable) {
      return result;
    } else if (result.exists && !result.readable) {
      errors.push(`Config file exists but is not readable: ${configPath}`);
    }
  } catch (error) {
    errors.push(
      `Failed to resolve config file '${configPath}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return null;
}

export async function findConfigFileWithFallback(
  possiblePaths: string[],
  options: FileResolutionOptions = {},
): Promise<FileResolutionResult | null> {
  const errors: string[] = [];

  for (const configPath of possiblePaths) {
    const result = await tryResolveConfigPath(configPath, options, errors);
    if (result) {
      return result;
    }
  }

  // If we get here, no valid config file was found
  if (errors.length > 0) {
    throw new ConfigurationError(
      `No valid configuration file found. Errors:\n${errors.join('\n')}`,
      'NO_CONFIG_FILE_FOUND',
    );
  }

  return null;
}

/**
 * Validate file permissions for configuration files
 *
 * @param filePath - Path to the file
 * @param requireWritable - Whether file must be writable
 * @returns Promise<boolean>
 */
export async function validateFilePermissions(
  filePath: string,
  requireWritable: boolean = false,
): Promise<boolean> {
  try {
    // Check if file exists
    await fs.access(filePath, fs.constants.F_OK);

    // Check read permissions
    await fs.access(filePath, fs.constants.R_OK);

    // Check write permissions if required
    if (requireWritable) {
      await fs.access(filePath, fs.constants.W_OK);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create a secure temporary file path
 *
 * @param prefix - Prefix for the temporary file
 * @param suffix - Suffix for the temporary file
 * @returns Temporary file path
 */
export function createTempPath(
  prefix: string = 'code-scout',
  suffix: string = '.tmp',
): string {
  const timestamp = Date.now();
  const BASE36_RADIX = 36;
  const random = Math.random().toString(BASE36_RADIX).substring(2);
  return path.join(
    process.env.TMPDIR ?? process.env.TEMP ?? '/tmp',
    `${prefix}-${timestamp}-${random}${suffix}`,
  );
}

/**
 * Resolve multiple paths and return the first that exists
 *
 * @param paths - Array of paths to resolve
 * @param options - Resolution options
 * @returns Promise<FileResolutionResult | null>
 */
export async function resolveFirstExisting(
  paths: string[],
  options: FileResolutionOptions = {},
): Promise<FileResolutionResult | null> {
  for (const filePath of paths) {
    try {
      const result = await resolveFile(filePath, options);
      if (result.exists) {
        return result;
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Get file extension in a case-insensitive way
 *
 * @param filePath - File path
 * @returns Lowercase file extension (without dot)
 */
export function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.toLowerCase().substring(1);
}

/**
 * Check if a file has a valid configuration file extension
 *
 * @param filePath - File path to check
 * @returns boolean
 */
export function isValidConfigFile(filePath: string): boolean {
  const validExtensions = ['json', 'yaml', 'yml', 'toml', 'ini'];
  const ext = getFileExtension(filePath);
  return validExtensions.includes(ext);
}

/**
 * Convert a relative path to an absolute path based on different contexts
 *
 * @param filePath - Path to convert
 * @param contexts - Array of base directories to try
 * @returns Absolute path
 */
export function resolveAbsolutePath(
  filePath: string,
  contexts: string[] = [process.cwd()],
): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  for (const context of contexts) {
    const resolved = path.resolve(context, filePath);
    return resolved;
  }

  return path.resolve(process.cwd(), filePath);
}

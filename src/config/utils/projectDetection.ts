/**
 * Project Detection Utilities
 *
 * This module provides utilities for detecting project roots and identifying
 * project markers to determine where configuration files should be located.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Project markers that indicate the root of a project
 */
export const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'composer.json',
  'Gemfile',
  'go.mod',
  'requirements.txt',
  '.code-scout',
];

/**
 * Configuration file names to look for
 */
export const CONFIG_FILES = [
  'config.json',
  '.code-scout.json',
  'code-scout.config.json',
];

/**
 * Result of project detection
 */
export interface ProjectDetectionResult {
  /**
   * Path to the project root
   */
  rootPath: string;

  /**
   * Which markers were found
   */
  foundMarkers: string[];

  /**
   * Whether this is a valid project root
   */
  isValid: boolean;

  /**
   * Path to the configuration directory
   */
  configDir?: string;

  /**
   * Path to the configuration file
   */
  configFile?: string;
}

/**
 * Detect project root by searching upwards from a given path
 *
 * @param startPath - Path to start searching from (defaults to current working directory)
 * @param markers - List of markers to look for (defaults to PROJECT_MARKERS)
 * @returns Promise<ProjectDetectionResult>
 */
/**
 * Check for project markers in a directory
 */
async function checkMarkersInDirectory(
  dirPath: string,
  markers: string[],
): Promise<string[]> {
  const foundMarkers: string[] = [];

  for (const marker of markers) {
    const markerPath = path.join(dirPath, marker);
    try {
      const stats = await fs.stat(markerPath);
      if (stats.isFile() || stats.isDirectory()) {
        foundMarkers.push(marker);
      }
    } catch {
      // Marker doesn't exist, continue searching
    }
  }

  return foundMarkers;
}

/**
 * Create project detection result for a directory
 */
async function createProjectResult(
  rootPath: string,
  foundMarkers: string[],
  isValid: boolean,
): Promise<ProjectDetectionResult> {
  const configDir = path.join(rootPath, '.code-scout');
  const configFile = await findConfigFile(rootPath);

  return {
    rootPath,
    foundMarkers,
    isValid,
    configDir,
    configFile,
  };
}

export async function detectProjectRoot(
  startPath: string = process.cwd(),
  markers: string[] = PROJECT_MARKERS,
): Promise<ProjectDetectionResult> {
  let currentPath = path.resolve(startPath);

  // Search upwards until we find markers or reach filesystem root
  while (currentPath !== path.dirname(currentPath)) {
    const foundMarkers = await checkMarkersInDirectory(currentPath, markers);

    // If we found markers, this is our project root
    if (foundMarkers.length > 0) {
      return createProjectResult(currentPath, foundMarkers, true);
    }

    // Move up to parent directory
    currentPath = path.dirname(currentPath);
  }

  // If we reached here, we didn't find any project markers
  // Return the current directory as fallback
  return createProjectResult(currentPath, [], false);
}

/**
 * Find configuration file in a given directory
 *
 * @param dirPath - Directory to search in
 * @param configFiles - List of config file names to look for
 * @returns Promise<string | undefined>
 */
export async function findConfigFile(
  dirPath: string,
  configFiles: string[] = CONFIG_FILES,
): Promise<string | undefined> {
  // First check .code-scout/config.json
  const codeScoutDir = path.join(dirPath, '.code-scout');
  try {
    await fs.access(codeScoutDir);
    const configPath = path.join(codeScoutDir, 'config.json');
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      // .code-scout exists but config.json doesn't
    }
  } catch {
    // .code-scout directory doesn't exist
  }

  // Check for config files in the root directory
  for (const configFile of configFiles) {
    const configPath = path.join(dirPath, configFile);
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      // Config file doesn't exist
    }
  }

  return undefined;
}

/**
 * Check if a directory is a valid project root
 *
 * @param dirPath - Directory to check
 * @param markers - List of markers to look for
 * @returns Promise<boolean>
 */
export async function isValidProjectRoot(
  dirPath: string,
  markers: string[] = PROJECT_MARKERS,
): Promise<boolean> {
  const result = await detectProjectRoot(dirPath, markers);
  return result.isValid && result.rootPath === path.resolve(dirPath);
}

/**
 * Get all possible configuration file paths for a project
 *
 * @param projectRoot - Project root directory
 * @returns Array of possible config file paths
 */
export function getPossibleConfigPaths(projectRoot: string): string[] {
  return [
    path.join(projectRoot, '.code-scout', 'config.json'),
    path.join(projectRoot, 'config.json'),
    path.join(projectRoot, '.code-scout.json'),
    path.join(projectRoot, 'code-scout.config.json'),
  ];
}

/**
 * Find the nearest configuration file by searching upwards
 *
 * @param startPath - Path to start searching from
 * @returns Promise<string | undefined>
 */
export async function findNearestConfigFile(
  startPath: string = process.cwd(),
): Promise<string | undefined> {
  let currentPath = path.resolve(startPath);

  while (currentPath !== path.dirname(currentPath)) {
    const configFile = await findConfigFile(currentPath);
    if (configFile) {
      return configFile;
    }
    currentPath = path.dirname(currentPath);
  }

  return undefined;
}

/**
 * Create .code-scout directory if it doesn't exist
 *
 * @param projectRoot - Project root directory
 * @returns Promise<string> - Path to the created directory
 */
export async function ensureConfigDir(projectRoot: string): Promise<string> {
  const configDir = path.join(projectRoot, '.code-scout');

  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }

  return configDir;
}

/**
 * Check if a path is within a project directory
 *
 * @param filePath - File path to check
 * @param projectRoot - Project root directory
 * @returns boolean
 */
export function isPathInProject(
  filePath: string,
  projectRoot: string,
): boolean {
  const resolvedFilePath = path.resolve(filePath);
  const resolvedProjectRoot = path.resolve(projectRoot);

  return resolvedFilePath.startsWith(resolvedProjectRoot);
}

/**
 * Get relative path from project root
 *
 * @param filePath - File path
 * @param projectRoot - Project root directory
 * @returns string - Relative path
 */
export function getRelativePathFromProject(
  filePath: string,
  projectRoot: string,
): string {
  return path.relative(path.resolve(projectRoot), path.resolve(filePath));
}

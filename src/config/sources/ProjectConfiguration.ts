/**
 * Project Configuration Source
 *
 * This file implements configuration loading from project-specific
 * .code-scout/config.json file.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

import type { PartialAppConfig } from '@/config/types/ConfigTypes';
import { ConfigurationError } from '@/config/errors/ConfigurationError';
import { ConfigurationSource } from '@/config/sources/ConfigurationSource';

/**
 * File permissions for project configuration files (owner read/write, group/world read)
 */
const PROJECT_CONFIG_PERMISSIONS = 0o644;

/**
 * Mask for all file permissions
 */
const ALL_PERMISSIONS_MASK = 0o777;

/**
 * World read permission bit
 */
const WORLD_READ_PERMISSION = 0o004;

/**
 * Base for octal number conversion
 */
const OCTAL_BASE = 8;

/**
 * Project configuration source loading from .code-scout/config.json
 */
export class ProjectConfiguration extends ConfigurationSource {
  public readonly priority = 2; // Third priority
  public readonly name = 'project';

  /**
   * Path to project configuration file
   */
  private readonly configPath: string;

  /**
   * Project root directory
   */
  private readonly projectRoot: string;

  constructor(projectRoot?: string) {
    super();
    this.projectRoot = projectRoot ?? this.findProjectRootSync();
    this.configPath = path.join(this.projectRoot, '.code-scout', 'config.json');
  }

  /**
   * Load project configuration from .code-scout/config.json
   */
  async load(): Promise<PartialAppConfig> {
    await this.validateAvailability();

    const content = await fs.readFile(this.configPath, 'utf-8');
    const config = this.safeJsonParse(
      content,
      'project configuration file',
    ) as PartialAppConfig;

    return this.createPartialConfig(config);
  }

  /**
   * Check if project configuration file exists and is accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.configPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get path to project configuration file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get project root directory
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Find project root directory synchronously
   */
  private findProjectRootSync(): string {
    const startDir = process.cwd();
    let currentDir = startDir;

    while (currentDir !== path.dirname(currentDir)) {
      if (this.isProjectRoot(currentDir)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    // If no project root found, use current directory
    return startDir;
  }

  /**
   * Check if directory is a project root
   */
  private isProjectRoot(dir: string): boolean {
    const projectMarkers = [
      'package.json',
      'tsconfig.json',
      'pyproject.toml',
      'Cargo.toml',
      'pom.xml',
      'build.gradle',
      'requirements.txt',
      'setup.py',
      '.git',
    ];

    return projectMarkers.some(marker => {
      const markerPath = path.join(dir, marker);
      try {
        fsSync.accessSync(markerPath, fsSync.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if project configuration directory exists
   */
  async configDirExists(): Promise<boolean> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.access(configDir, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create project configuration directory if it doesn't exist
   */
  async ensureConfigDir(): Promise<void> {
    const configDir = path.dirname(this.configPath);

    try {
      await fs.mkdir(configDir, { recursive: true });
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to create project config directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        configDir,
        this.name,
      );
    }
  }

  /**
   * Save configuration to project file
   */
  async saveConfig(config: PartialAppConfig): Promise<void> {
    try {
      await this.ensureConfigDir();

      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(this.configPath, content, 'utf-8');

      // Set appropriate permissions
      await fs.chmod(this.configPath, PROJECT_CONFIG_PERMISSIONS);
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to save project configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.configPath,
        this.name,
      );
    }
  }

  /**
   * Remove project configuration file
   */
  async removeConfig(): Promise<void> {
    try {
      await fs.unlink(this.configPath);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw ConfigurationError.fileAccess(
          `Failed to remove project configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
          this.configPath,
          this.name,
        );
      }
    }
  }

  /**
   * Get file stats for project configuration
   */
  async getConfigStats(): Promise<{
    exists: boolean;
    size?: number;
    modified?: Date;
    permissions?: string;
  }> {
    try {
      const stats = await fs.stat(this.configPath);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        permissions: (stats.mode & ALL_PERMISSIONS_MASK).toString(OCTAL_BASE),
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Validate project configuration file permissions
   */
  async validatePermissions(): Promise<boolean> {
    try {
      const stats = await this.getConfigStats();

      if (!stats.exists) {
        return true; // No file to validate
      }

      // For project config, we allow group read but not world read
      const mode = parseInt(stats.permissions ?? '0', 8);
      const hasWorldRead = (mode & WORLD_READ_PERMISSION) !== 0;

      return !hasWorldRead;
    } catch {
      return false;
    }
  }

  /**
   * Fix permissions on project configuration file
   */
  async fixPermissions(): Promise<void> {
    try {
      await fs.chmod(this.configPath, PROJECT_CONFIG_PERMISSIONS);
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to fix permissions on project configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.configPath,
        this.name,
      );
    }
  }

  /**
   * Backup project configuration
   */
  async backupConfig(backupPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const defaultBackupPath = `${this.configPath}.backup.${timestamp}`;
    const finalBackupPath = backupPath ?? defaultBackupPath;

    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      await fs.writeFile(finalBackupPath, content, 'utf-8');
      await fs.chmod(finalBackupPath, PROJECT_CONFIG_PERMISSIONS);
      return finalBackupPath;
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to backup project configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.configPath,
        this.name,
      );
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      const content = await fs.readFile(backupPath, 'utf-8');
      await this.saveConfig(
        this.safeJsonParse(content, 'backup file') as PartialAppConfig,
      );
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        backupPath,
        this.name,
      );
    }
  }

  /**
   * List available backup files
   */
  async listBackups(): Promise<string[]> {
    try {
      const configDir = path.dirname(this.configPath);
      const files = await fs.readdir(configDir);
      const backupPattern = new RegExp(
        `${path.basename(this.configPath)}\\.backup\\..+`,
      );

      return files
        .filter(file => backupPattern.test(file))
        .map(file => path.join(configDir, file))
        .sort(); // Sort by filename (which includes timestamp)
    } catch {
      return [];
    }
  }

  /**
   * Detect Node.js project type from package.json
   */
  private async detectNodeProjectType(files: string[]): Promise<string | null> {
    if (!files.includes('package.json')) {
      return null;
    }

    try {
      const packageJson = await fs.readFile(
        path.join(this.projectRoot, 'package.json'),
        'utf-8',
      );
      const pkg = JSON.parse(packageJson);
      return pkg.type === 'module' ? 'esm-node' : 'cjs-node';
    } catch {
      return null;
    }
  }

  /**
   * Detect Python project
   */
  private detectPythonProject(files: string[]): string | null {
    if (
      files.includes('pyproject.toml') ||
      files.includes('requirements.txt')
    ) {
      return 'python';
    }
    return null;
  }

  /**
   * Detect Rust project
   */
  private detectRustProject(files: string[]): string | null {
    if (files.includes('Cargo.toml')) {
      return 'rust';
    }
    return null;
  }

  /**
   * Detect Java project
   */
  private detectJavaProject(files: string[]): string | null {
    if (files.includes('pom.xml') || files.includes('build.gradle')) {
      return 'java';
    }
    return null;
  }

  /**
   * Detect project type based on files in project root
   */
  async detectProjectType(): Promise<string> {
    try {
      const files = await fs.readdir(this.projectRoot);

      // Try different project type detectors
      const nodeType = await this.detectNodeProjectType(files);
      if (nodeType) {
        return nodeType;
      }

      const pythonType = this.detectPythonProject(files);
      if (pythonType) {
        return pythonType;
      }

      const rustType = this.detectRustProject(files);
      if (rustType) {
        return rustType;
      }

      const javaType = this.detectJavaProject(files);
      if (javaType) {
        return javaType;
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get metadata about this configuration source
   */
  override getMetadata(): Record<string, unknown> {
    return {
      ...super.getMetadata(),
      configPath: this.configPath,
      projectRoot: this.projectRoot,
    };
  }
}

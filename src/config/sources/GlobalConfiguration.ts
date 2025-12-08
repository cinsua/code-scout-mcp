/**
 * Global Configuration Source
 *
 * This file implements configuration loading from the global
 * ~/.code-scout/config.json file.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import type { PartialAppConfig } from '@/config/types/ConfigTypes';
import { ConfigurationError } from '@/config/errors/ConfigurationError';
import { ConfigurationSource } from '@/config/sources/ConfigurationSource';

/**
 * File permissions for configuration files (owner read/write only)
 */
const CONFIG_FILE_PERMISSIONS = 0o600;

/**
 * Mask for all file permissions
 */
const ALL_PERMISSIONS_MASK = 0o777;

/**
 * Group read permission bit
 */
const GROUP_READ_PERMISSION = 0o040;

/**
 * World read permission bit
 */
const WORLD_READ_PERMISSION = 0o004;

/**
 * Base for octal number conversion
 */
const OCTAL_BASE = 8;

/**
 * Global configuration source loading from user's home directory
 */
export class GlobalConfiguration extends ConfigurationSource {
  public readonly priority = 1; // Second lowest priority
  public readonly name = 'global';

  /**
   * Path to global configuration file
   */
  private readonly configPath: string;

  constructor() {
    super();
    this.configPath = path.join(os.homedir(), '.code-scout', 'config.json');
  }

  /**
   * Load global configuration from ~/.code-scout/config.json
   */
  async load(): Promise<PartialAppConfig> {
    await this.validateAvailability();

    const content = await fs.readFile(this.configPath, 'utf-8');
    const config = this.safeJsonParse(
      content,
      'global configuration file',
    ) as PartialAppConfig;

    return this.createPartialConfig(config);
  }

  /**
   * Check if global configuration file exists and is accessible
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
   * Get the path to the global configuration file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if global configuration directory exists
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
   * Create global configuration directory if it doesn't exist
   */
  async ensureConfigDir(): Promise<void> {
    const configDir = path.dirname(this.configPath);

    try {
      await fs.mkdir(configDir, { recursive: true });
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to create global config directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        configDir,
        this.name,
      );
    }
  }

  /**
   * Save configuration to global file
   */
  async saveConfig(config: PartialAppConfig): Promise<void> {
    try {
      await this.ensureConfigDir();

      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(this.configPath, content, 'utf-8');

      // Set restrictive permissions (owner read/write only)
      await fs.chmod(this.configPath, CONFIG_FILE_PERMISSIONS);
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to save global configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.configPath,
        this.name,
      );
    }
  }

  /**
   * Remove global configuration file
   */
  async removeConfig(): Promise<void> {
    try {
      await fs.unlink(this.configPath);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw ConfigurationError.fileAccess(
          `Failed to remove global configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
          this.configPath,
          this.name,
        );
      }
    }
  }

  /**
   * Get file stats for global configuration
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
   * Validate global configuration file permissions
   */
  async validatePermissions(): Promise<boolean> {
    try {
      const stats = await this.getConfigStats();

      if (!stats.exists) {
        return true; // No file to validate
      }

      // Check that file is not world-readable or group-readable
      const mode = parseInt(stats.permissions ?? '0', 8);
      const hasGroupRead = (mode & GROUP_READ_PERMISSION) !== 0;
      const hasWorldRead = (mode & WORLD_READ_PERMISSION) !== 0;

      return !hasGroupRead && !hasWorldRead;
    } catch {
      return false;
    }
  }

  /**
   * Fix permissions on global configuration file
   */
  async fixPermissions(): Promise<void> {
    try {
      await fs.chmod(this.configPath, CONFIG_FILE_PERMISSIONS);
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to fix permissions on global configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.configPath,
        this.name,
      );
    }
  }

  /**
   * Backup global configuration
   */
  async backupConfig(backupPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const defaultBackupPath = `${this.configPath}.backup.${timestamp}`;
    const finalBackupPath = backupPath ?? defaultBackupPath;

    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      await fs.writeFile(finalBackupPath, content, 'utf-8');
      await fs.chmod(finalBackupPath, CONFIG_FILE_PERMISSIONS);
      return finalBackupPath;
    } catch (error) {
      throw ConfigurationError.fileAccess(
        `Failed to backup global configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Get metadata about this configuration source
   */
  override getMetadata(): Record<string, unknown> {
    return {
      ...super.getMetadata(),
      configPath: this.configPath,
      configDir: path.dirname(this.configPath),
    };
  }
}

import pino from 'pino';

import type { LoggerConfig } from '../shared/utils/Logger';
import { LogManager } from '../shared/utils/LogManager';

import type { LoggingConfig } from './types/ConfigTypes';

/**
 * Logging configuration utilities for different environments
 */

export interface PinoLoggerConfig extends LoggerConfig {
  prettyPrint?: boolean;
  redact?: string[];
  destination?: pino.DestinationStream;
}

/**
 * Create development logging configuration
 * Features pretty printing and debug level logging
 */
export function createDevelopmentConfig(): PinoLoggerConfig {
  return {
    level: 'debug',
    prettyPrint: true,
    redact: ['password', 'token', 'secret', 'key'],
  };
}

/**
 * Create production logging configuration
 * Features structured JSON logging and info level
 */
export function createProductionConfig(): PinoLoggerConfig {
  return {
    level: 'info',
    prettyPrint: false,
    redact: ['password', 'token', 'secret', 'key', 'authorization'],
  };
}

/**
 * Create CI/CD logging configuration
 * Features minimal logging for automated environments
 */
export function createCicdConfig(): PinoLoggerConfig {
  return {
    level: 'warn',
    prettyPrint: false,
    redact: ['password', 'token', 'secret', 'key', 'authorization'],
  };
}

/**
 * Create test logging configuration
 * Features silent logging for unit tests
 */
export function createTestConfig(): PinoLoggerConfig {
  return {
    level: 'fatal', // Use fatal level for tests to minimize output
    prettyPrint: false,
  };
}

/**
 * Initialize logging system with configuration
 */
export function initializeLogging(config: LoggingConfig): void {
  let loggerConfig: PinoLoggerConfig;

  // Determine environment and create appropriate config
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  switch (nodeEnv) {
    case 'production':
      loggerConfig = createProductionConfig();
      break;
    case 'test':
      loggerConfig = createTestConfig();
      break;
    case 'cicd':
    case 'ci':
      loggerConfig = createCicdConfig();
      break;
    default:
      loggerConfig = createDevelopmentConfig();
  }

  // Override with explicit config values
  loggerConfig.level = config.level as pino.Level;

  // Apply file destination if configured
  if (config.file.enabled && config.file.path) {
    // For file logging, we'll need to set up proper destination
    // This would typically use pino.destination() or a transport
    loggerConfig.destination = pino.destination(config.file.path);
  }

  // Set the configuration in LogManager
  LogManager.setConfig(loggerConfig);
}

/**
 * Get current logging configuration
 */
export function getCurrentLoggingConfig(): PinoLoggerConfig | null {
  return LogManager.getCurrentConfig() as PinoLoggerConfig | null;
}

/**
 * Update log level dynamically
 */
export function setLogLevel(level: pino.Level): void {
  LogManager.setLogLevel(level);
}

/**
 * Get a service-specific logger
 */
export function getServiceLogger(service: string) {
  return LogManager.getLogger(service);
}

/**
 * Get the root logger
 */
export function getRootLogger() {
  return LogManager.getRootLogger();
}

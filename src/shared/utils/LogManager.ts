import type pino from 'pino';

import type { LoggerConfig } from './Logger';
import { Logger } from './Logger';

export { Logger } from './Logger';

export class LogManager {
  private static instance: Logger | null = null;
  private static config: LoggerConfig | null = null;
  private static loggerCache: Map<string, Logger> = new Map();

  static setLogLevel(level: pino.Level): void {
    if (this.instance) {
      this.instance.setLevel(level);
    }
  }

  static setConfig(config: LoggerConfig): void {
    this.config = config;
    // Reset instance and cache so they get recreated with new config
    this.instance = null;
    this.loggerCache.clear();
  }

  static getLogger(service?: string): Logger {
    this.instance ??= new Logger(this.config ?? undefined);

    if (!service) {
      return this.instance;
    }

    // Check cache first for service-specific loggers
    if (this.loggerCache.has(service)) {
      return this.loggerCache.get(service)!;
    }

    // Create and cache new child logger
    const childLogger = this.instance.child({ service });
    this.loggerCache.set(service, childLogger);
    return childLogger;
  }

  static getRootLogger(): Logger {
    this.instance ??= new Logger(this.config ?? undefined);

    return this.instance;
  }

  static getCurrentConfig(): LoggerConfig | null {
    return this.config;
  }

  static reset(): void {
    this.instance = null;
    this.config = null;
    this.loggerCache.clear();
  }
}

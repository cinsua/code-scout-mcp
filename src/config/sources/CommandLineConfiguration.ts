/**
 * Command Line Configuration Source
 *
 * This file implements configuration loading from command line
 * arguments with highest priority.
 */

import { ConfigurationSource } from './ConfigurationSource';
import { PartialAppConfig } from '../types/ConfigTypes';
import { ConfigurationError } from '../errors/ConfigurationError';

/**
 * Command line argument definition
 */
interface CliArgument {
  name: string;
  short?: string;
  configPath: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  defaultValue?: unknown;
  required?: boolean;
}

/**
 * Command line argument definitions
 */
const CLI_ARGUMENTS: CliArgument[] = [
  {
    name: '--db-path',
    configPath: 'database.path',
    type: 'string',
    description: 'Path to database file',
  },
  {
    name: '--max-workers',
    short: '-w',
    configPath: 'indexing.maxWorkers',
    type: 'number',
    description: 'Maximum number of indexing worker threads',
  },
  {
    name: '--watch',
    configPath: 'watching.enabled',
    type: 'boolean',
    description: 'Enable file watching',
  },
  {
    name: '--log-level',
    configPath: 'logging.level',
    type: 'string',
    description: 'Logging level (error, warn, info, debug, trace)',
  },
  {
    name: '--profile',
    short: '-p',
    configPath: 'profile',
    type: 'string',
    description: 'Configuration profile to use (development, production, cicd)',
  },
];

/**
 * Command line configuration source with highest priority
 */
export class CommandLineConfiguration extends ConfigurationSource {
  public readonly priority = 4;
  public readonly name = 'command-line';

  private parsedArgs: Map<string, unknown> = new Map();
  private rawArgs: string[];

  constructor(args?: string[]) {
    super();
    this.rawArgs = args || process.argv.slice(2);
    this.parseArguments();
  }

  async load(): Promise<PartialAppConfig> {
    try {
      await this.validateAvailability();

      const config: PartialAppConfig = {};

      for (const [key, value] of this.parsedArgs) {
        if (!key.startsWith('_')) {
          this.setNestedValue(config, key, value);
        }
      }

      return this.createPartialConfig(config);
    } catch (error) {
      this.handleLoadError(error);
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private parseArguments(): void {
    for (let i = 0; i < this.rawArgs.length; i++) {
      const arg = this.rawArgs[i];

      if (arg && arg.startsWith('--')) {
        this.parseLongArgument(arg, i);
      } else if (arg && arg.startsWith('-') && !arg.startsWith('--')) {
        this.parseShortArgument(arg, i);
      }
    }
  }

  private parseLongArgument(arg: string, index: number): void {
    const eqIndex = arg.indexOf('=');

    if (eqIndex > 0) {
      const name = arg.substring(0, eqIndex);
      const value = arg.substring(eqIndex + 1);
      this.setArgumentValue(name, value);
    } else {
      const cliArg = CLI_ARGUMENTS.find((a) => a.name === arg);

      if (cliArg) {
        if (cliArg.type === 'boolean') {
          this.setArgumentValue(arg, 'true');
        } else {
          const nextArg = this.rawArgs[index + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            this.setArgumentValue(arg, nextArg);
          } else {
            throw new ConfigurationError(
              `Argument ${arg} requires a value`,
              'INVALID_ARGUMENT'
            );
          }
        }
      }
    }
  }

  private parseShortArgument(arg: string, index: number): void {
    const chars = arg.substring(1);

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const cliArg = CLI_ARGUMENTS.find((a) => a.short === `-${char}`);

      if (cliArg) {
        if (cliArg.type === 'boolean') {
          this.setArgumentValue(cliArg.name, 'true');
        } else if (i === chars.length - 1) {
          const nextArg = this.rawArgs[index + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            this.setArgumentValue(cliArg.name, nextArg);
          } else {
            throw new ConfigurationError(
              `Argument -${char} requires a value`,
              'INVALID_ARGUMENT'
            );
          }
        }
      }
    }
  }

  private setArgumentValue(name: string, value: string): void {
    const cliArg = CLI_ARGUMENTS.find((a) => a.name === name);

    if (!cliArg) {
      throw new ConfigurationError(
        `Unknown argument: ${name}`,
        'UNKNOWN_ARGUMENT'
      );
    }

    const convertedValue = this.convertValue(value, cliArg);
    this.parsedArgs.set(cliArg.configPath, convertedValue);
  }

  private convertValue(value: string, cliArg: CliArgument): unknown {
    switch (cliArg.type) {
      case 'boolean':
        return this.parseBoolean(value, cliArg.name);

      case 'number':
        return this.parseNumber(value, cliArg.name);

      case 'string':
      default:
        return value;
    }
  }

  private parseBoolean(value: string, argName: string): boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;

    throw new ConfigurationError(
      `Invalid boolean value for ${argName}: ${value}. Use 'true' or 'false'`,
      'INVALID_BOOLEAN_VALUE'
    );
  }

  private parseNumber(value: string, argName: string): number {
    const num = Number(value);

    if (isNaN(num)) {
      throw new ConfigurationError(
        `Invalid number value for ${argName}: ${value}`,
        'INVALID_NUMBER_VALUE'
      );
    }

    return num;
  }

  private setNestedValue(obj: any, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i] as string;

      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }

      current = current[key];
    }

    const lastKey = keys[keys.length - 1] as string;
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  getArgument(path: string): unknown {
    return this.parsedArgs.get(path);
  }

  hasArgument(path: string): boolean {
    return this.parsedArgs.has(path);
  }

  getAllArguments(): Map<string, unknown> {
    return new Map(this.parsedArgs);
  }

  generateHelp(): string {
    let help = 'Code-Scout MCP Server\n\n';
    help += 'Usage: code-scout [options]\n\n';
    help += 'Options:\n';

    for (const arg of CLI_ARGUMENTS) {
      const short = arg.short ? `-${arg.short}, ` : '    ';
      help += `    ${short}${arg.name}  ${arg.description}\n`;
    }

    return help;
  }

  override getMetadata(): Record<string, unknown> {
    return {
      ...super.getMetadata(),
      rawArgs: this.rawArgs,
      parsedArgsCount: this.parsedArgs.size,
      supportedArguments: CLI_ARGUMENTS.length,
    };
  }
}

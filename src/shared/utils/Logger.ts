import pino from 'pino';

export interface LogContext {
  service: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  performance?: {
    duration: number;
    memoryUsage: number;
    cpuUsage?: number;
    queryCount?: number;
    cacheHits?: number;
    cacheMisses?: number;
  };
  error?: {
    code?: string;
    stack?: string;
    cause?: string;
  };
  request?: {
    id?: string;
    method?: string;
    url?: string;
    userAgent?: string;
  };
  [key: string]: any;
}

export interface LoggerConfig {
  level?: pino.Level;
  destination?: pino.DestinationStream;
  prettyPrint?: boolean;
  redact?: string[];
}

export class Logger {
  private logger: pino.Logger;

  constructor(config?: LoggerConfig) {
    this.logger = pino({
      level: config?.level ?? process.env.LOG_LEVEL ?? 'info',
      formatters: {
        level: label => ({ level: label }),
      },
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      ...(config?.destination && { destination: config.destination }),
      ...(config?.prettyPrint && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
      ...(config?.redact && { redact: config.redact }),
    });
  }

  child(context: LogContext): Logger {
    const childLogger = this.logger.child(context);
    return Object.assign(Object.create(Object.getPrototypeOf(this)), {
      logger: childLogger,
    });
  }

  trace(message: string, context?: any): void {
    this.logger.trace(context, message);
  }

  debug(message: string, context?: any): void {
    this.logger.debug(context, message);
  }

  info(message: string, context?: any): void {
    this.logger.info(context, message);
  }

  warn(message: string, context?: any): void {
    this.logger.warn(context, message);
  }

  error(message: string, error?: Error, context?: any): void {
    this.logger.error({ error, ...context }, message);
  }

  fatal(message: string, error?: Error, context?: any): void {
    this.logger.fatal({ error, ...context }, message);
  }

  setLevel(level: pino.Level): void {
    this.logger.level = level;
  }

  getLevel(): string {
    return this.logger.level;
  }
}

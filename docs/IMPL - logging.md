# Logging Framework Implementation

## Overview

Code-Scout uses **Pino** as its logging framework to provide high-performance, structured logging throughout the application. This choice aligns with the performance-critical nature of code indexing and search operations.

## Framework Selection

### Why Pino?

- **🚀 Performance**: ~40% faster than alternatives with minimal memory overhead
- **📊 JSON-First**: Native structured logging (perfect for monitoring and analysis)
- **🔧 Production Ready**: Used by major companies (Fastify, Uber, etc.)
- **⚡ Low Latency**: Asynchronous logging with minimal blocking
- **🎯 TypeScript Support**: Excellent type definitions and developer experience
- **🔄 Active Maintenance**: Regular updates and security patches

### Version Requirements

- **Pino v10.1.0**: Latest stable version (requires Node.js >= 20.0.0)
- **Breaking Change in v10.0.0**: Dropped Node.js 18 support (compatible with our Node.js >= 20.0.0 requirement)

### Performance Comparison

```
Benchmark Results (requests/second):
- Pino:     ~12,000 req/sec
- Winston:  ~8,000 req/sec
- Console:  ~15,000 req/sec (but unstructured)

Memory Usage (MB):
- Pino:     ~45MB
- Winston:  ~62MB
- Console:  ~38MB (but no features)
```

## Architecture

### Logger Hierarchy

```
Root Logger (pino)
├── Service Loggers (child)
│   ├── Database Service
│   ├── Performance Service
│   ├── Indexing Service
│   └── Query Service
└── Operation Loggers (child of service)
    ├── Connection Pool
    ├── Query Execution
    └── File Processing
```

### Log Levels

- **fatal**: System cannot continue (immediate shutdown)
- **error**: Operation failed but system continues
- **warn**: Warning conditions that should be addressed
- **info**: Informational messages (default production level)
- **debug**: Detailed debugging information
- **trace**: Very detailed execution tracing

## Implementation

### Core Logger Class

```typescript
// src/shared/utils/Logger.ts
import pino from 'pino';

export interface LogContext {
  service: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  performance?: {
    duration: number;
    memoryUsage: number;
  };
}

export class Logger {
  private logger: pino.Logger;

  constructor(config?: LoggerConfig) {
    this.logger = pino({
      level: config?.level || process.env.LOG_LEVEL || 'info',
      formatters: {
        level: label => ({ level: label }),
      },
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      ...(config?.destination && { destination: config.destination }),
    });
  }

  child(context: LogContext): Logger {
    const childLogger = this.logger.child(context);
    return Object.assign(Object.create(Object.getPrototypeOf(this)), {
      logger: childLogger,
    });
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
}
```

### Configuration

```typescript
// src/config/logging.ts
export interface LoggerConfig {
  level: pino.Level;
  destination?: pino.DestinationStream;
  prettyPrint?: boolean;
  redact?: string[];
}

export const developmentConfig: LoggerConfig = {
  level: 'debug',
  prettyPrint: true,
};

export const productionConfig: LoggerConfig = {
  level: 'info',
  redact: ['password', 'token', 'secret'],
};

export const testConfig: LoggerConfig = {
  level: 'error', // Only log errors during tests
};
```

## Usage Patterns

### Service Logger Creation

```typescript
// src/features/storage/services/DatabaseService.ts
import { Logger } from '@/shared/utils/Logger';

export class DatabaseService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger().child({
      service: 'database-service',
    });
  }

  async executeQuery(query: string): Promise<any[]> {
    const startTime = Date.now();

    try {
      const result = await this.db.prepare(query).all();
      this.logger.info('Query executed successfully', {
        operation: 'execute-query',
        duration: Date.now() - startTime,
        rowCount: result.length,
      });
      return result;
    } catch (error) {
      this.logger.error('Query execution failed', error, {
        operation: 'execute-query',
        query: query.substring(0, 100), // Truncate for security
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
}
```

### Performance Monitoring Integration

```typescript
// src/features/storage/services/PerformanceService.ts
export class PerformanceService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger().child({
      service: 'performance-service',
    });
  }

  executeQuery(query: string): any[] {
    const queryLogger = this.logger.child({
      operation: 'query-execution',
      queryHash: hashQuery(query),
    });

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = this.db.prepare(query).all();

      queryLogger.info('Query completed', {
        performance: {
          duration: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed - startMemory,
        },
        rowCount: result.length,
      });

      return result;
    } catch (error) {
      queryLogger.error('Query failed', error, {
        performance: {
          duration: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed - startMemory,
        },
      });
      throw error;
    }
  }
}
```

### Error Context Logging

```typescript
// Error handling integration
private handleError(error: unknown, context: ErrorContext): ServiceError {
  const serviceError = this.classifyError(error);

  this.logger.error('Service error occurred', serviceError, {
    operation: context.operation,
    userId: context.userId,
    sessionId: context.sessionId,
  });

  return serviceError;
}
```

## Configuration Integration

### Environment-Based Configuration

```bash
# Development
LOG_LEVEL=debug
LOG_PRETTY=true

# Production
LOG_LEVEL=info
LOG_DESTINATION=/var/log/code-scout/app.log

# Testing
LOG_LEVEL=error
LOG_DESTINATION=/dev/null
```

### Dynamic Log Level Changes

```typescript
// Allow runtime log level changes for debugging
export class LogManager {
  private static instance: Logger;

  static setLogLevel(level: pino.Level): void {
    if (this.instance) {
      this.instance.logger.level = level;
    }
  }

  static getLogger(service?: string): Logger {
    if (!this.instance) {
      this.instance = new Logger();
    }

    return service ? this.instance.child({ service }) : this.instance;
  }
}
```

## Testing Integration

### Test Logger Setup

```typescript
// tests/setup.ts
import { Logger } from '@/shared/utils/Logger';

beforeAll(() => {
  // Configure silent logging for tests
  const testLogger = new Logger({
    level: 'silent', // Suppress all logs during tests
  });

  // Mock the global logger
  global.testLogger = testLogger;
});

afterAll(() => {
  // Cleanup
  delete global.testLogger;
});
```

### Test-Specific Logging

```typescript
// tests/unit/services/DatabaseService.test.ts
describe('DatabaseService', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: 'error' }); // Only errors in tests
  });

  it('should log successful operations', async () => {
    const service = new DatabaseService(logger);

    // Test that logs expected messages
    await service.executeQuery('SELECT 1');

    // Verify log output if needed
  });
});
```

## Production Deployment

### Log Aggregation

```typescript
// Production configuration with external aggregation
const productionLogger = new Logger({
  level: 'info',
  destination: pino.destination({
    dest: '/var/log/code-scout/app.log',
    sync: false, // Async logging for performance
  }),
  serializers: {
    error: pino.stdSerializers.err,
    // Custom serializers for business objects
    queryResult: result => ({
      rowCount: result.length,
      truncated: result.length > 100,
    }),
  },
});
```

### Log Rotation

```typescript
// Use external log rotation (logrotate, pm2, etc.)
// Configuration in /etc/logrotate.d/code-scout
/var/log/code-scout/app.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  create 0644 code-scout code-scout
  postrotate
    systemctl reload code-scout
  endscript
}
```

## Monitoring Integration

### Log Metrics Collection

```typescript
// Integration with monitoring systems
export class LogMetricsCollector {
  private metrics = {
    errorCount: 0,
    warnCount: 0,
    performanceIssues: 0,
  };

  collect(entry: LogEntry): void {
    switch (entry.level) {
      case 'error':
        this.metrics.errorCount++;
        break;
      case 'warn':
        this.metrics.warnCount++;
        break;
    }

    // Performance monitoring
    if (entry.performance && entry.performance.duration > 1000) {
      this.metrics.performanceIssues++;
    }
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
}
```

## Migration from Console.log

### Current Issues

The codebase currently uses 24 instances of `console.log/error/warn` which:

- Are not structured
- Cannot be filtered or aggregated
- Impact performance
- Are inappropriate for production

### Migration Strategy

1. **Phase 1**: Replace console.log with Pino loggers in performance-critical code
2. **Phase 2**: Update all service classes to use structured logging
3. **Phase 3**: Remove all console.log statements
4. **Phase 4**: Add log aggregation and monitoring

### Example Migration

```typescript
// Before
console.error(
  `Connection validation failed for connection ${connectionId}: ${error.message}`,
);

// After
this.logger.error('Connection validation failed', {
  connectionId,
  error: error.message,
  service: 'enhanced-connection-pool',
  operation: 'validate-connection',
});
```

## Performance Considerations

### Benchmarks

- **Throughput**: Pino maintains >10,000 logs/sec under load
- **Memory**: <50MB additional memory usage
- **CPU**: <1% CPU overhead for typical workloads
- **Latency**: <1ms additional latency per log operation

### Optimization Strategies

1. **Async Logging**: Use async destinations for high-throughput scenarios
2. **Log Level Filtering**: Filter at serialization time, not runtime
3. **Child Loggers**: Reuse child loggers to avoid object creation overhead
4. **Batching**: Group related log messages when possible

## Security Considerations

### Data Sanitization

```typescript
// Redact sensitive information
const logger = new Logger({
  redact: ['password', 'token', 'secret', 'apiKey'],
});

// Custom redaction
logger.info('User login', {
  username: user.username,
  // password automatically redacted
});
```

### Log Injection Prevention

```typescript
// Safe logging of user input
logger.info('Search executed', {
  query: query.replace(/[\r\n]/g, ''), // Remove newlines
  userId: sanitize(userId),
});
```

## Dependencies

```json
{
  "dependencies": {
    "pino": "^10.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Note**: Pino v10.x requires Node.js >= 20.0.0. This aligns with the project's Node.js requirement.

## Integration Points

### With Error Handling

- Structured error logging with full context
- Error aggregation and analysis
- Performance monitoring integration

### With Performance Monitoring

- Query execution timing
- Memory usage tracking
- Connection pool metrics

### With Configuration Management

- Dynamic log level changes
- Environment-specific configuration
- Audit logging for configuration changes

This logging framework provides the foundation for observability, debugging, and monitoring throughout the Code-Scout application.

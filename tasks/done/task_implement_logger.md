# Task: Implement Comprehensive Logging Framework

## Overview

Implement a high-performance structured logging system using Pino v10.1.0 for Code-Scout MCP. This replaces all console.log statements with structured, production-ready logging that integrates with error handling, performance monitoring, and configuration management.

## Requirements from Documentation

### Core Requirements (from IMPL - logging.md)

- **Framework**: Pino v10.1.0 with Node.js >= 20.0.0 compatibility
- **Performance**: ~40% faster than alternatives, minimal memory overhead
- **Structured Logging**: JSON-first with Pino serializers
- **Hierarchy**: Root logger → Service loggers → Operation loggers
- **Log Levels**: fatal, error, warn, info, debug, trace
- **Configuration**: Environment-based (development/production/test)
- **Migration**: Replace 24 existing console.log/error/warn statements

### Integration Requirements

- **Error Handling**: Structured error logging with full context (IMPL - error_handling.md)
- **Performance Monitoring**: Query timing, memory usage tracking (CORE - technical_specifications.md)
- **Configuration Management**: Dynamic log level changes (IMPL - configuration_management.md)
- **Testing**: Silent logging for tests, proper test integration (IMPL - testing_strategy.md)

## Implementation Checklist

### 1.1 Setup Logging Infrastructure

- [ ] Install Pino dependencies: `pino@^10.1.0`
- [ ] Create `src/shared/utils/Logger.ts` with Pino integration
- [ ] Implement Logger class with child logger support
- [ ] Add LogContext interface for structured context
- [ ] Implement all log levels (fatal, error, warn, info, debug, trace)
- [ ] Add Pino serializers for Error, req, res objects

### 1.2 Create Logger Configuration System

- [ ] Create `src/config/logging.ts` with configuration interfaces
- [ ] Implement development config (debug level, pretty print)
- [ ] Implement production config (info level, redaction)
- [ ] Implement test config (error level, silent for tests)
- [ ] Add LoggerConfig interface with level, destination, prettyPrint, redact options

### 1.3 Implement LogManager for Global Access

- [ ] Create LogManager singleton class
- [ ] Add dynamic log level changes at runtime
- [ ] Implement service-specific logger creation
- [ ] Add environment-based configuration loading

### 1.4 Integrate with Configuration Management

- [ ] Add logging section to AppConfig interface
- [ ] Implement environment variable support (CODE*SCOUT_LOG*\*)
- [ ] Add configuration validation for logging settings
- [ ] Support dynamic configuration reloading

### 1.5 Implement Performance Monitoring Integration

- [ ] Add performance context to LogContext interface
- [ ] Create performance logging utilities
- [ ] Integrate with DatabaseService for query timing
- [ ] Add memory usage tracking in log context

### 1.6 Implement Error Handling Integration

- [ ] Create error logging utilities with full context
- [ ] Add error aggregation support
- [ ] Implement structured error logging patterns
- [ ] Add retry and recovery logging

### 1.7 Create Service Logger Integration

- [ ] Update DatabaseService to use structured logging
- [ ] Update PerformanceService with performance logging
- [ ] Update all services to use child loggers
- [ ] Add operation-specific logging contexts

### 1.8 Implement Migration from Console.log

- [ ] Identify all 24 console.log/error/warn statements in codebase
- [ ] Create migration mapping for each console statement
- [ ] Replace console statements with structured logging
- [ ] Verify no console statements remain

### 1.9 Add Testing Integration

- [ ] Update `tests/setup.ts` with Pino test configuration
- [ ] Create test logger utilities
- [ ] Add logging tests for each service
- [ ] Implement silent logging for unit tests

### 1.10 Setup Production Deployment

- [ ] Configure log aggregation (logrotate, external services)
- [ ] Add production log destinations
- [ ] Implement log rotation policies
- [ ] Add monitoring integration for log metrics

## Code Templates

### Logger Class Template

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

### LogManager Template

```typescript
// src/shared/utils/LogManager.ts
import { Logger } from './Logger';

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

### Service Integration Template

```typescript
// Example: src/features/storage/services/DatabaseService.ts
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

## File Structure

```
src/
├── shared/
│   └── utils/
│       ├── Logger.ts
│       └── LogManager.ts
├── config/
│   └── logging.ts
└── features/
    └── storage/
        └── services/
            └── DatabaseService.ts (updated)
```

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

## Validation Criteria

### Functional Validation

- [ ] All log levels work correctly (fatal through trace)
- [ ] Child loggers inherit context properly
- [ ] Structured logging produces valid JSON
- [ ] Performance logging captures timing and memory data
- [ ] Error logging includes full error context

### Integration Validation

- [ ] Configuration loading works for all environments
- [ ] Dynamic log level changes work at runtime
- [ ] All services use structured logging
- [ ] No console.log statements remain in codebase
- [ ] Test logging is properly silenced

### Performance Validation

- [ ] Logging overhead < 1% CPU under normal load
- [ ] Memory usage < 50MB additional overhead
- [ ] Log throughput > 10,000 logs/sec
- [ ] No blocking operations in hot paths

## Acceptance Tests

### Unit Tests

- [ ] Logger class instantiation and configuration
- [ ] Child logger creation and context inheritance
- [ ] All log level methods work correctly
- [ ] Error serialization works properly
- [ ] Performance context logging

### Integration Tests

- [ ] Service logger integration in DatabaseService
- [ ] Performance monitoring integration
- [ ] Configuration loading and validation
- [ ] Environment-specific configuration

### Migration Tests

- [ ] All console.log statements replaced
- [ ] Structured logging produces equivalent information
- [ ] Log output is parseable and searchable
- [ ] Error handling integration works

## Quality Gates

### Code Quality

- [ ] TypeScript types properly defined for all interfaces
- [ ] ESLint passes with no errors
- [ ] Code coverage > 90% for logging logic
- [ ] Documentation complete for all public APIs

### Performance Gates

- [ ] Logging benchmarks pass performance requirements
- [ ] Memory leak tests pass
- [ ] Concurrent logging stress tests pass

### Integration Gates

- [ ] All services successfully migrated to structured logging
- [ ] Configuration management integration complete
- [ ] Error handling integration complete
- [ ] Testing integration complete

## Migration Strategy

### Phase 1: Infrastructure (Tasks 1.1-1.4)

1. Install dependencies and create core Logger class
2. Implement configuration system
3. Create LogManager for global access
4. Integrate with configuration management

### Phase 2: Service Integration (Tasks 1.5-1.7)

1. Add performance monitoring integration
2. Implement error handling integration
3. Update all services to use structured logging

### Phase 3: Migration and Testing (Tasks 1.8-1.9)

1. Systematically replace all console.log statements
2. Add comprehensive testing integration
3. Validate all integrations work correctly

### Phase 4: Production Deployment (Task 1.10)

1. Setup production logging infrastructure
2. Configure log aggregation and monitoring
3. Deploy and validate in production environment

## Dependencies

### Runtime Dependencies

```json
{
  "dependencies": {
    "pino": "^10.1.0"
  }
}
```

### Development Dependencies

```json
{
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

### Engine Requirements

```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

## Risk Mitigation

### Performance Risks

- **Risk**: Logging overhead impacts performance
- **Mitigation**: Use async logging, level filtering, child logger reuse

### Migration Risks

- **Risk**: Console.log statements missed during migration
- **Mitigation**: Systematic grep search, automated testing, code review

### Configuration Risks

- **Risk**: Invalid logging configuration causes failures
- **Mitigation**: Comprehensive validation, fallback defaults, graceful degradation

This implementation provides a production-ready logging framework that meets all requirements from the technical specifications while maintaining high performance and developer experience.</content>
<parameter name="filePath">tasks/task_implement_logger.md

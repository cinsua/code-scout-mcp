# Error Handling and Recovery Patterns

## Error Classification

### Error Types

- **ValidationError**: Invalid input parameters or configuration
- **ParsingError**: File parsing failures or syntax errors
- **DatabaseError**: Database operation failures
- **FileSystemError**: File system access or permission issues
- **NetworkError**: Network communication failures (future)
- **TimeoutError**: Operation timeout exceeded
- **ResourceError**: Resource exhaustion (memory, CPU, disk)

### Error Severity Levels

- **Fatal**: System cannot continue operation
- **Error**: Operation failed but system can continue
- **Warning**: Operation succeeded with issues
- **Info**: Informational messages
- **Debug**: Detailed debugging information

## Error Response Format

### Structured Error Response

```typescript
interface ErrorResponse {
  error: {
    type: string; // Error classification
    code: string; // Specific error code
    message: string; // User-friendly message
    details?: any; // Additional error details
    timestamp: number; // Error occurrence time
    operation: string; // Operation that failed
    context?: {
      // Operation context
      filePath?: string;
      query?: string;
      parameters?: any;
    };
  };
  retryable?: boolean; // Whether operation can be retried
  retryAfter?: number; // Suggested retry delay in ms
}
```

### MCP Error Response

```typescript
interface MCPError {
  jsonrpc: '2.0';
  id: number | string | null;
  error: {
    code: number;
    message: string;
    data?: {
      type: string;
      details: any;
      retryable: boolean;
    };
  };
}
```

## Error Handling Patterns

### Try-Catch with Context

```typescript
class BaseService {
  protected async executeOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.handleError(error, context);
    }
  }

  private handleError(error: unknown, context: ErrorContext): ServiceError {
    const serviceError = this.classifyError(error);
    this.logError(serviceError, context);
    return serviceError;
  }
}
```

### Error Classification

```typescript
private classifyError(error: unknown): ServiceError {
  if (error instanceof ValidationError) {
    return new ServiceError('VALIDATION_ERROR', error.message, {
      retryable: false,
      severity: 'error'
    });
  }

  if (error instanceof DatabaseError) {
    return new ServiceError('DATABASE_ERROR', error.message, {
      retryable: true,
      retryAfter: 1000,
      severity: 'error'
    });
  }

  // Default to unknown error
  return new ServiceError('UNKNOWN_ERROR', 'An unexpected error occurred', {
    retryable: false,
    severity: 'fatal'
  });
}
```

## Recovery Strategies

### Retry Logic

```typescript
class RetryHandler {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(error) || attempt === options.maxAttempts) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, options);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    // Exponential backoff with jitter
    const baseDelay = options.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * options.jitterFactor * baseDelay;
    return Math.min(baseDelay + jitter, options.maxDelay);
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new CircuitBreakerError('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      this.lastFailureTime = Date.now();
    }
  }
}
```

## Graceful Degradation

### Fallback Strategies

- **Partial Results**: Return partial results when some operations fail
- **Default Values**: Use sensible defaults for missing data
- **Simplified Mode**: Fall back to basic functionality when advanced features fail
- **Offline Mode**: Continue operation with cached data when services are unavailable

### Service Degradation Levels

```typescript
enum DegradationLevel {
  FULL_FUNCTIONALITY = 'full',
  LIMITED_FUNCTIONALITY = 'limited',
  BASIC_FUNCTIONALITY = 'basic',
  EMERGENCY_MODE = 'emergency',
}

class DegradationManager {
  private currentLevel = DegradationLevel.FULL_FUNCTIONALITY;

  setDegradationLevel(level: DegradationLevel) {
    this.currentLevel = level;
    this.applyDegradationStrategies(level);
  }

  private applyDegradationStrategies(level: DegradationLevel) {
    switch (level) {
      case DegradationLevel.LIMITED_FUNCTIONALITY:
        // Disable real-time indexing
        this.disableRealTimeIndexing();
        break;
      case DegradationLevel.BASIC_FUNCTIONALITY:
        // Disable complex queries
        this.disableComplexQueries();
        break;
      case DegradationLevel.EMERGENCY_MODE:
        // Read-only mode
        this.enableReadOnlyMode();
        break;
    }
  }
}
```

## Logging and Monitoring

### Structured Logging

Code-Scout uses **Pino** for high-performance structured logging. See [IMPL - logging.md](IMPL%20-%20logging.md) for complete implementation details.

**Key Features:**

- JSON-first structured logging
- Child loggers for contextual logging
- Performance-optimized for high-throughput scenarios
- Environment-based configuration
- Production-ready log aggregation support

**Integration with Error Handling:**

```typescript
// Error logging with full context
this.logger.error('Service error occurred', serviceError, {
  operation: context.operation,
  userId: context.userId,
  sessionId: context.sessionId,
  performance: {
    duration: context.duration,
    memoryUsage: context.memoryUsage,
  },
});
```

### Error Aggregation

```typescript
class ErrorAggregator {
  private errors = new Map<string, ErrorStats>();

  recordError(error: ServiceError, context: ErrorContext) {
    const key = `${error.type}:${context.operation}`;
    const stats = this.errors.get(key) || {
      count: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      samples: [],
    };

    stats.count++;
    stats.lastSeen = Date.now();

    // Keep recent error samples
    if (stats.samples.length < 10) {
      stats.samples.push({
        timestamp: Date.now(),
        message: error.message,
        context,
      });
    }

    this.errors.set(key, stats);
  }

  getErrorStats(): ErrorStats[] {
    return Array.from(this.errors.values());
  }
}
```

## Timeout Management

### Operation Timeouts

```typescript
class TimeoutManager {
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutError: Error = new TimeoutError('Operation timed out'),
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(timeoutError), timeoutMs),
      ),
    ]);
  }
}
```

### Resource Timeouts

- **Database Queries**: 30-second timeout for database operations
- **File Parsing**: 10-second timeout per file
- **Network Requests**: 5-second timeout for external calls
- **Batch Operations**: 5-minute timeout for large batch operations

## Testing Error Scenarios

### Error Injection Testing

```typescript
class ErrorInjector {
  injectError(operation: string, errorType: string, probability: number) {
    if (Math.random() < probability) {
      throw new ServiceError(errorType, `Injected ${errorType} error`);
    }
  }
}
```

### Chaos Engineering

- **Random Failures**: Inject random errors to test resilience
- **Resource Exhaustion**: Simulate memory and CPU pressure
- **Network Failures**: Simulate network connectivity issues
- **Database Failures**: Test database connection failures

## Recovery Procedures

### Automatic Recovery

- **Service Restart**: Automatic restart of failed services
- **Data Repair**: Automatic repair of corrupted data
- **Index Rebuild**: Automatic index rebuilding on corruption
- **Configuration Reload**: Automatic configuration reloading

### Manual Recovery

- **Data Backup**: Restore from backup on data corruption
- **Index Reset**: Full reindexing when incremental updates fail
- **Configuration Reset**: Reset to default configuration
- **Service Restart**: Manual service restart procedures

This comprehensive error handling system ensures system reliability, user experience, and operational maintainability across various failure scenarios.

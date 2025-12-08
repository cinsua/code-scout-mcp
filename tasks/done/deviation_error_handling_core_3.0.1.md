# Task: Implement Core Error Handling Infrastructure

## Overview

Implement the critical error handling components that form the foundation of Code-Scout MCP's reliability and resilience. This includes core error types, retry logic, timeout management, standardized patterns, and error aggregation - essential infrastructure that must be in place before other features can operate reliably.

## Requirements from Documentation

### Error Classification (from IMPL - error_handling.md)

- **ValidationError**: Invalid input parameters or configuration
- **ParsingError**: File parsing failures or syntax errors
- **DatabaseError**: Database operation failures (partially implemented)
- **FileSystemError**: File system access or permission issues
- **NetworkError**: Network communication failures (future)
- **TimeoutError**: Operation timeout exceeded
- **ResourceError**: Resource exhaustion (memory, CPU, disk)

### Error Response Format

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
      filePath?: string;
      query?: string;
      parameters?: any;
    };
  };
  retryable?: boolean; // Whether operation can be retried
  retryAfter?: number; // Suggested retry delay in ms
}
```

### Recovery Strategies

- **Retry Logic**: Exponential backoff with jitter for transient failures
- **Circuit Breaker**: Prevent cascading failures
- **Timeout Management**: Configurable timeouts for different operations
- **Graceful Degradation**: Fallback strategies for service degradation

## Current Codebase Analysis

### Existing Components

- **ConfigurationError**: Well-implemented with detailed error codes and suggestions
- **DatabaseError**: Basic implementation with error types
- **ErrorLogger**: Structured logging with aggregation capabilities
- **Connection Pool Retry**: Basic retry logic in EnhancedConnectionPool
- **Timeout Handling**: Basic timeout in DatabaseService

### Missing Critical Components

- **Core Error Types**: ValidationError, ParsingError, FileSystemError, TimeoutError, ResourceError
- **Generic Retry Handler**: Reusable retry logic with exponential backoff
- **Timeout Manager**: Centralized timeout management for operations
- **Circuit Breaker**: Pattern implementation for service protection
- **Standardized Error Patterns**: BaseService with error handling
- **Error Aggregation**: Enhanced aggregation beyond basic ErrorLogger
- **Degradation Manager**: Graceful degradation strategies

## Implementation Checklist

### 1.1 Core Error Types Implementation

- [ ] Create `src/shared/errors/` directory structure
- [ ] Implement `ValidationError` class in `src/shared/errors/ValidationError.ts`
- [ ] Implement `ParsingError` class in `src/shared/errors/ParsingError.ts`
- [ ] Implement `FileSystemError` class in `src/shared/errors/FileSystemError.ts`
- [ ] Implement `TimeoutError` class in `src/shared/errors/TimeoutError.ts`
- [ ] Implement `ResourceError` class in `src/shared/errors/ResourceError.ts`
- [ ] Implement `NetworkError` class in `src/shared/errors/NetworkError.ts`
- [ ] Create `ServiceError` base class in `src/shared/errors/ServiceError.ts`
- [ ] Define error type enums in `src/shared/errors/ErrorTypes.ts`
- [ ] Create error factory functions in `src/shared/errors/ErrorFactory.ts`

### 1.2 Retry Logic Infrastructure

- [ ] Create `src/shared/utils/RetryHandler.ts` with exponential backoff
- [ ] Implement `RetryOptions` interface with configurable parameters
- [ ] Add jitter calculation for distributed systems
- [ ] Create `RetryableOperation` wrapper class
- [ ] Implement retry condition evaluation (isRetryable)
- [ ] Add retry metrics and monitoring
- [ ] Create retry policies (immediate, linear, exponential)

### 1.3 Timeout Management System

- [ ] Create `src/shared/utils/TimeoutManager.ts` class
- [ ] Implement `executeWithTimeout` method with Promise.race
- [ ] Add timeout configuration by operation type
- [ ] Create timeout presets (database: 30s, parsing: 10s, network: 5s)
- [ ] Implement timeout error wrapping
- [ ] Add timeout metrics collection
- [ ] Create cancellable timeout operations

### 1.4 Circuit Breaker Pattern

- [ ] Create `src/shared/utils/CircuitBreaker.ts` class
- [ ] Implement circuit states (closed, open, half-open)
- [ ] Add failure threshold and recovery timeout configuration
- [ ] Implement state transition logic
- [ ] Add circuit breaker metrics
- [ ] Create circuit breaker registry for multiple services
- [ ] Implement half-open success rate evaluation

### 1.5 Standardized Error Patterns

- [ ] Create `src/shared/services/BaseService.ts` abstract class
- [ ] Implement `executeOperation` method with try-catch wrapper
- [ ] Add error classification and transformation
- [ ] Implement context-aware error logging
- [ ] Create service error boundary pattern
- [ ] Add operation context propagation
- [ ] Implement error recovery strategies per service

### 1.6 Error Aggregation and Monitoring

- [ ] Enhance `ErrorAggregator` in `src/shared/utils/ErrorLogger.ts`
- [ ] Add error statistics collection (count, frequency, patterns)
- [ ] Implement error trend analysis
- [ ] Create error reporting dashboard data
- [ ] Add error correlation detection
- [ ] Implement error alerting thresholds
- [ ] Create error export functionality

### 1.7 Graceful Degradation Manager

- [ ] Create `src/shared/utils/DegradationManager.ts` class
- [ ] Implement degradation levels (full, limited, basic, emergency)
- [ ] Add service capability toggling
- [ ] Implement fallback strategy registration
- [ ] Create degradation triggers (resource usage, error rates)
- [ ] Add degradation recovery logic
- [ ] Implement degradation metrics

### 1.8 Error Response Formatting

- [ ] Create `src/shared/utils/ErrorFormatter.ts` utility
- [ ] Implement MCP error response formatting
- [ ] Add user-friendly error message generation
- [ ] Create error context serialization
- [ ] Implement error detail filtering for security
- [ ] Add error internationalization support

## Code Templates

### Core Error Types Template

```typescript
// src/shared/errors/ServiceError.ts
export abstract class ServiceError extends Error {
  public readonly type: string;
  public readonly code: string;
  public readonly timestamp: number;
  public readonly operation: string;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly context?: Record<string, any>;

  constructor(
    type: string,
    code: string,
    message: string,
    options: {
      retryable?: boolean;
      retryAfter?: number;
      context?: Record<string, any>;
      cause?: Error;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.code = code;
    this.timestamp = Date.now();
    this.operation = 'unknown'; // Set by service
    this.retryable = options.retryable ?? false;
    this.retryAfter = options.retryAfter;
    this.context = options.context;

    if (options.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      operation: this.operation,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      context: this.context,
      stack: this.stack,
    };
  }
}
```

### Retry Handler Template

```typescript
// src/shared/utils/RetryHandler.ts
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
  retryCondition?: (error: Error) => boolean;
}

export class RetryHandler {
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

        if (
          !this.isRetryable(error as Error, options) ||
          attempt === options.maxAttempts
        ) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, options);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  private isRetryable(error: Error, options: RetryOptions): boolean {
    if (options.retryCondition) {
      return options.retryCondition(error);
    }

    // Default retryable conditions
    return (
      error.name === 'DatabaseError' ||
      error.name === 'NetworkError' ||
      error.message.includes('timeout')
    );
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const baseDelay = options.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * options.jitterFactor * baseDelay;
    return Math.min(baseDelay + jitter, options.maxDelay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Timeout Manager Template

```typescript
// src/shared/utils/TimeoutManager.ts
export class TimeoutManager {
  private static readonly DEFAULT_TIMEOUTS = {
    database: 30000, // 30 seconds
    parsing: 10000, // 10 seconds
    network: 5000, // 5 seconds
    filesystem: 5000, // 5 seconds
    indexing: 300000, // 5 minutes
  };

  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs?: number,
    operationType?: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
  ): Promise<T> {
    const timeout =
      timeoutMs ?? TimeoutManager.DEFAULT_TIMEOUTS[operationType ?? 'database'];
    const timeoutError = new TimeoutError(
      `Operation timed out after ${timeout}ms`,
      operationType ?? 'unknown',
    );

    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(timeoutError), timeout),
      ),
    ]);
  }

  getDefaultTimeout(
    operationType: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
  ): number {
    return TimeoutManager.DEFAULT_TIMEOUTS[operationType];
  }
}
```

### Circuit Breaker Template

```typescript
// src/shared/utils/CircuitBreaker.ts
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  successThreshold: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
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

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.options.recoveryTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'closed';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

## File Structure

```
src/shared/
├── errors/
│   ├── ErrorTypes.ts
│   ├── ErrorFactory.ts
│   ├── ServiceError.ts
│   ├── ValidationError.ts
│   ├── ParsingError.ts
│   ├── FileSystemError.ts
│   ├── TimeoutError.ts
│   ├── ResourceError.ts
│   └── NetworkError.ts
├── services/
│   └── BaseService.ts
└── utils/
    ├── RetryHandler.ts
    ├── TimeoutManager.ts
    ├── CircuitBreaker.ts
    ├── DegradationManager.ts
    ├── ErrorFormatter.ts
    └── ErrorLogger.ts (enhanced)
```

## Integration Points

- **All Services**: Extend BaseService for standardized error handling
- **Database Operations**: Use RetryHandler and TimeoutManager
- **File Operations**: Use CircuitBreaker for file system access
- **Parsing Operations**: Use TimeoutManager for parsing timeouts
- **Configuration**: Integrate with existing ConfigurationError
- **Logging**: Enhanced ErrorLogger integration

## Validation Criteria

- [ ] All error types properly extend ServiceError base class
- [ ] Retry logic handles exponential backoff correctly
- [ ] Timeout manager prevents hanging operations
- [ ] Circuit breaker prevents cascade failures
- [ ] Error aggregation provides meaningful statistics
- [ ] BaseService pattern works across different services
- [ ] Error responses conform to MCP specification

## Acceptance Tests

- [ ] Unit tests for all error types and serialization
- [ ] Retry handler tests with various failure scenarios
- [ ] Timeout manager tests with operation cancellation
- [ ] Circuit breaker state transition tests
- [ ] Error aggregation accuracy tests
- [ ] BaseService error handling integration tests
- [ ] End-to-end error propagation tests

## Quality Gates

- [ ] TypeScript compilation without errors
- [ ] All error classes properly typed and documented
- [ ] Error handling patterns consistent across codebase
- [ ] Performance impact minimal (<1% overhead)
- [ ] Memory leaks absent in error scenarios
- [ ] Error messages user-friendly and actionable
- [ ] Logging provides sufficient debugging information

## Dependencies

- **Internal**: Logger, ConfigurationManager
- **External**: None (pure TypeScript implementation)

## Risk Assessment

- **Low Risk**: Infrastructure code with comprehensive testing
- **Mitigation**: Incremental implementation with feature flags
- **Fallback**: Existing error handling remains functional during transition</content>
  <parameter name="filePath">tasks/task_error_handling_core.md

# Task: Integrate Legacy Error Handlers with Core Error Handling Module

## Overview

Refactor legacy error handlers (ConfigurationError and DatabaseError) to extend the new ServiceError base class and integrate with the comprehensive error handling infrastructure. This will unify error handling patterns, eliminate code duplication, and provide centralized configuration for all error-related constants.

## Implementation Review Analysis

Based on the implementation review of the core error handling module, the following critical issues need to be addressed:

### 🔴 Critical Issues (Must Fix)

1. **Inconsistent Error Hierarchy**: DatabaseError and ConfigurationError don't extend ServiceError
2. **Scattered Hardcoded Constants**: Retry delays, timeouts, and thresholds are hardcoded across multiple files

### 🟡 Warnings (Should Fix)

3. **Code Duplication**: Factory method patterns and error context handling are duplicated
4. **Missing Centralized Configuration**: Error handling thresholds not configurable through central config

### ✅ Fixed Issues

**Operation Property Inconsistency**:

- **Issue**: DatabaseError constructor was overriding specific operations passed by factory methods with generic 'database_operation'
- **Fix**: Removed the `this.setOperation('database_operation')` call that was overwriting the operation parameter
- **Result**: Factory methods now preserve their specific operations:
  - `connectionFailed()` → `'database_connection_failed'`
  - `queryFailed()` → `'database_query_failed'`
  - `timeout()` → `'database_timeout'`
- **Tests Updated**: Modified test assertions to expect the correct specific operations instead of the generic one

### 🟢 Suggestions (Consider Improving)

5. **Performance Considerations**: Optimize error aggregation for high-frequency scenarios
6. **Documentation**: Expand integration examples and advanced feature documentation

## Requirements from Documentation

### Error Classification Integration (from IMPL - error_handling.md)

- All error types must extend ServiceError base class
- Standardized error response format across all modules
- Centralized retry logic and timeout management
- Unified error aggregation and monitoring

### Backward Compatibility Requirements

- Maintain existing public APIs for ConfigurationError and DatabaseError
- Preserve all existing factory methods and static constructors
- Ensure existing error codes and messages remain functional
- Support gradual migration path for dependent code

## Current Legacy Error Analysis

### ConfigurationError Analysis

**Location**: `src/config/errors/ConfigurationError.ts`
**Issues**:

- Extends Error instead of ServiceError
- Missing standardized properties (timestamp, operation, retryable)
- Hardcoded retry delays in suggestions
- No integration with centralized error handling

**Strengths to Preserve**:

- Comprehensive factory methods (validation, fileAccess, parsing, etc.)
- Detailed error codes and suggestions
- BatchValidationError implementation
- User-friendly formatting methods

### DatabaseError Analysis

**Location**: `src/features/storage/types/StorageTypes.ts`
**Issues**:

- Extends Error instead of ServiceError
- Missing standardized properties and methods
- No integration with retry logic or circuit breaker
- Hardcoded error handling patterns

**Strengths to Preserve**:

- Database-specific context (query, params, original error)
- Comprehensive error type enumeration
- Detailed error context tracking

## Implementation Checklist

### 1.1 Create Error Constants Centralization

- [ ] Create `src/shared/errors/ErrorConstants.ts` with all hardcoded values
- [ ] Extract retry delays from all error classes (1000, 2000, 3000, 5000, 10000, 60000)
- [ ] Extract timeout defaults from TimeoutManager and other files
- [ ] Extract degradation thresholds from DegradationManager
- [ ] Create environment variable support for all constants
- [ ] Add configuration schema for error handling constants

### 1.2 Refactor ConfigurationError to Extend ServiceError

- [ ] Update ConfigurationError class to extend ServiceError
- [ ] Add missing ServiceError properties (timestamp, operation, retryable, retryAfter)
- [ ] Update all factory methods to use centralized constants
- [ ] Maintain backward compatibility with existing API
- [ ] Integrate with ErrorFactory for standardized creation
- [ ] Update BatchValidationError to extend new ConfigurationError
- [ ] Add retry logic integration for retryable configuration errors

### 1.3 Refactor DatabaseError to Extend ServiceError

- [ ] Update DatabaseError class to extend ServiceError
- [ ] Add missing ServiceError properties while preserving database-specific context
- [ ] Update constructor to use centralized constants
- [ ] Integrate with retry logic for transient database errors
- [ ] Add circuit breaker integration for connection failures
- [ ] Maintain backward compatibility with existing usage patterns
- [ ] Update all DatabaseErrorType handling to use new infrastructure

### 1.4 Enhance ErrorFactory Integration

- [ ] Add ConfigurationError creation methods to ErrorFactory
- [ ] Add DatabaseError creation methods to ErrorFactory
- [ ] Implement error type detection and automatic wrapping
- [ ] Add legacy error migration utilities
- [ ] Create error conversion utilities for backward compatibility

### 1.5 Update Service Integration Points

- [ ] Update ConfigurationService to use new error handling patterns
- [ ] Update DatabaseService to leverage BaseService error handling
- [ ] Integrate retry logic in configuration loading operations
- [ ] Add circuit breaker for database connection attempts
- [ ] Update error logging to use enhanced ErrorLogger

### 1.6 Create Migration Utilities

- [ ] Create error migration utilities in `src/shared/errors/ErrorMigration.ts`
- [ ] Add automatic error wrapping for legacy errors
- [ ] Create compatibility layer for gradual migration
- [ ] Add deprecation warnings for legacy error usage
- [ ] Create migration testing utilities

### 1.7 Update Configuration Management

- [ ] Add error handling configuration to ConfigurationManager
- [ ] Create error configuration schema validation
- [ ] Add environment variable support for error constants
- [ ] Implement runtime error handling configuration updates
- [ ] Add error handling profile support (development, production)

### 1.8 Comprehensive Testing Strategy

- [ ] Create backward compatibility tests for existing error usage
- [ ] Add integration tests for new error handling patterns
- [ ] Create migration tests for legacy error conversion
- [ ] Add performance tests for error handling overhead
- [ ] Create chaos engineering tests for error scenarios
- [ ] Add configuration validation tests for error constants

## Code Templates

### ErrorConstants Template

```typescript
// src/shared/errors/ErrorConstants.ts
export const ERROR_CONSTANTS = {
  // Retry delays in milliseconds
  RETRY_DELAYS: {
    IMMEDIATE: 0,
    SHORT: 1000, // 1 second
    MEDIUM: 2000, // 2 seconds
    LONG: 5000, // 5 seconds
    EXTENDED: 10000, // 10 seconds
    MAXIMUM: 60000, // 1 minute
  },

  // Timeout defaults in milliseconds
  TIMEOUTS: {
    DATABASE: 30000, // 30 seconds
    PARSING: 10000, // 10 seconds
    NETWORK: 5000, // 5 seconds
    FILESYSTEM: 5000, // 5 seconds
    INDEXING: 300000, // 5 minutes
    QUERY: 30000, // 30 seconds
    CONNECTION: 10000, // 10 seconds
    DEFAULT: 10000, // 10 seconds
  },

  // Circuit breaker thresholds
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RECOVERY_TIMEOUT: 60000, // 1 minute
    MONITORING_PERIOD: 300000, // 5 minutes
    SUCCESS_THRESHOLD: 3,
  },

  // Degradation thresholds
  DEGRADATION: {
    ERROR_RATE_THRESHOLD: 0.1, // 10%
    RESPONSE_TIME_THRESHOLD: 5000, // 5 seconds
    MEMORY_USAGE_THRESHOLD: 0.8, // 80%
    CPU_USAGE_THRESHOLD: 0.9, // 90%
  },

  // Error aggregation settings
  AGGREGATION: {
    WINDOW_MS: 300000, // 5 minutes
    CLEANUP_INTERVAL_MS: 3600000, // 1 hour
    MAX_ERROR_ENTRIES: 10000,
  },
} as const;

// Environment variable mapping
export const ERROR_ENV_VARS = {
  RETRY_SHORT_DELAY: 'CS_ERROR_RETRY_SHORT_DELAY',
  RETRY_MEDIUM_DELAY: 'CS_ERROR_RETRY_MEDIUM_DELAY',
  TIMEOUT_DATABASE: 'CS_ERROR_TIMEOUT_DATABASE',
  TIMEOUT_PARSING: 'CS_ERROR_TIMEOUT_PARSING',
  CIRCUIT_BREAKER_THRESHOLD: 'CS_CIRCUIT_BREAKER_THRESHOLD',
  DEGRADATION_ERROR_RATE: 'CS_DEGRADATION_ERROR_RATE',
} as const;

// Helper functions to get configurable values
export function getRetryDelay(
  type: keyof typeof ERROR_CONSTANTS.RETRY_DELAYS,
): number {
  const envVar =
    ERROR_ENV_VARS[
      `RETRY_${type.toUpperCase()}_DELAY` as keyof typeof ERROR_ENV_VARS
    ];
  return envVar
    ? parseInt(process.env[envVar] || '', 10) ||
        ERROR_CONSTANTS.RETRY_DELAYS[type]
    : ERROR_CONSTANTS.RETRY_DELAYS[type];
}

export function getTimeout(
  type: keyof typeof ERROR_CONSTANTS.TIMEOUTS,
): number {
  const envVar =
    ERROR_ENV_VARS[
      `TIMEOUT_${type.toUpperCase()}` as keyof typeof ERROR_ENV_VARS
    ];
  return envVar
    ? parseInt(process.env[envVar] || '', 10) || ERROR_CONSTANTS.TIMEOUTS[type]
    : ERROR_CONSTANTS.TIMEOUTS[type];
}
```

### Refactored ConfigurationError Template

```typescript
// src/config/errors/ConfigurationError.ts
import { ServiceError } from '../shared/errors/ServiceError';
import {
  ERROR_CONSTANTS,
  getRetryDelay,
} from '../shared/errors/ErrorConstants';
import { ErrorFactory } from '../shared/errors/ErrorFactory';

export class ConfigurationError extends ServiceError {
  public readonly path?: string;
  public readonly source?: string;
  public readonly suggestions?: string[];

  constructor(
    message: string,
    code: string,
    options: {
      path?: string;
      source?: string;
      suggestions?: string[];
      retryable?: boolean;
      retryAfter?: number;
      operation?: string;
      context?: Record<string, any>;
      cause?: Error;
    } = {},
  ) {
    super('CONFIGURATION', code, message, {
      retryable: options.retryable ?? false,
      retryAfter: options.retryAfter ?? getRetryDelay('MEDIUM'),
      operation: options.operation ?? 'configuration',
      context: {
        ...options.context,
        path: options.path,
        source: options.source,
      },
      cause: options.cause,
    });

    this.path = options.path;
    this.source = options.source;
    this.suggestions = options.suggestions;
  }

  // Enhanced factory methods using centralized constants
  static validation(
    message: string,
    path: string,
    suggestions?: string[],
  ): ConfigurationError {
    return new ConfigurationError(
      `Validation failed: ${message}`,
      'VALIDATION_ERROR',
      {
        path,
        suggestions,
        retryable: true,
        retryAfter: getRetryDelay('SHORT'),
        operation: 'configuration_validation',
      },
    );
  }

  static fileAccess(
    message: string,
    path: string,
    source?: string,
  ): ConfigurationError {
    return new ConfigurationError(
      `File access error: ${message}`,
      'FILE_ACCESS_ERROR',
      {
        path,
        source,
        suggestions: ['Check file permissions', 'Verify file exists'],
        retryable: true,
        retryAfter: getRetryDelay('MEDIUM'),
        operation: 'configuration_file_access',
      },
    );
  }

  // ... other factory methods updated with centralized constants

  // Maintain backward compatibility
  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      path: this.path,
      source: this.source,
      suggestions: this.suggestions,
    };
  }

  toUserString(): string {
    let result = `${this.code}: ${this.message}`;

    if (this.path) {
      result += `\n  Path: ${this.path}`;
    }

    if (this.source) {
      result += `\n  Source: ${this.source}`;
    }

    if (this.suggestions && this.suggestions.length > 0) {
      result += '\n  Suggestions:';
      this.suggestions.forEach(suggestion => {
        result += `\n    - ${suggestion}`;
      });
    }

    if (this.retryable && this.retryAfter) {
      result += `\n  Retry after ${Math.ceil(this.retryAfter / 1000)} seconds`;
    }

    return result;
  }
}

// Enhanced BatchValidationError
export class BatchValidationError extends ConfigurationError {
  public readonly errors: ValidationErrorDetail[];

  constructor(errors: ValidationErrorDetail[]) {
    const message = `Validation failed with ${errors.length} error(s)`;
    super(message, 'VALIDATION_ERROR', {
      suggestions: [
        'Fix individual validation errors',
        'Check configuration format',
      ],
      retryable: false,
      operation: 'configuration_batch_validation',
      context: { errorCount: errors.length },
    });
    this.name = 'BatchValidationError';
    this.errors = errors;
  }

  // ... rest of BatchValidationError implementation
}
```

### Refactored DatabaseError Template

```typescript
// src/features/storage/types/StorageTypes.ts (partial)
import { ServiceError } from '../../shared/errors/ServiceError';
import {
  ERROR_CONSTANTS,
  getRetryDelay,
  getTimeout,
} from '../../shared/errors/ErrorConstants';
import { ErrorFactory } from '../../shared/errors/ErrorFactory';

export class DatabaseError extends ServiceError {
  public readonly original?: Error;
  public readonly query?: string;
  public readonly params?: unknown[];

  constructor(
    type: DatabaseErrorType,
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
      context?: Record<string, unknown>;
      retryable?: boolean;
      retryAfter?: number;
    } = {},
  ) {
    const isRetryable =
      options.retryable ?? DatabaseError.isRetryableType(type);
    const retryAfter =
      options.retryAfter ?? DatabaseError.getDefaultRetryDelay(type);

    super('DATABASE', type, message, {
      retryable: isRetryable,
      retryAfter,
      operation: 'database_operation',
      context: {
        ...options.context,
        query: options.query,
        params: options.params,
        originalError: options.original?.message,
      },
      cause: options.original,
    });

    this.original = options.original;
    this.query = options.query;
    this.params = options.params;
  }

  private static isRetryableType(type: DatabaseErrorType): boolean {
    switch (type) {
      case DatabaseErrorType.CONNECTION_FAILED:
      case DatabaseErrorType.TIMEOUT:
      case DatabaseErrorType.QUERY_FAILED:
        return true;
      case DatabaseErrorType.CONSTRAINT_VIOLATION:
      case DatabaseErrorType.CORRUPTION:
      case DatabaseErrorType.PERMISSION_DENIED:
        return false;
      default:
        return false;
    }
  }

  private static getDefaultRetryDelay(type: DatabaseErrorType): number {
    switch (type) {
      case DatabaseErrorType.CONNECTION_FAILED:
        return getRetryDelay('EXTENDED');
      case DatabaseErrorType.TIMEOUT:
        return getRetryDelay('LONG');
      case DatabaseErrorType.QUERY_FAILED:
        return getRetryDelay('MEDIUM');
      default:
        return getRetryDelay('SHORT');
    }
  }

  // Factory methods using ErrorFactory
  static connectionFailed(
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
    } = {},
  ): DatabaseError {
    return new DatabaseError(
      DatabaseErrorType.CONNECTION_FAILED,
      message,
      options,
    );
  }

  static queryFailed(
    message: string,
    query: string,
    params?: unknown[],
    original?: Error,
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.QUERY_FAILED, message, {
      query,
      params,
      original,
    });
  }

  static timeout(
    message: string,
    query?: string,
    params?: unknown[],
  ): DatabaseError {
    return new DatabaseError(DatabaseErrorType.TIMEOUT, message, {
      query,
      params,
      retryAfter: getTimeout('DATABASE'),
    });
  }

  // Maintain backward compatibility
  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      original: this.original?.message,
      query: this.query,
      params: this.params,
    };
  }
}
```

### ErrorFactory Integration Template

```typescript
// src/shared/errors/ErrorFactory.ts (enhanced)
export class ErrorFactory {
  // ... existing methods

  /**
   * Create ConfigurationError using factory pattern
   */
  static configuration(
    code: string,
    message: string,
    options: {
      path?: string;
      source?: string;
      suggestions?: string[];
      retryable?: boolean;
      retryAfter?: number;
      operation?: string;
      context?: Record<string, any>;
      cause?: Error;
    } = {},
  ): ConfigurationError {
    return new ConfigurationError(message, code, options);
  }

  /**
   * Create DatabaseError using factory pattern
   */
  static database(
    type: DatabaseErrorType,
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
      context?: Record<string, unknown>;
      retryable?: boolean;
      retryAfter?: number;
    } = {},
  ): DatabaseError {
    return new DatabaseError(type, message, options);
  }

  /**
   * Wrap legacy errors in appropriate ServiceError types
   */
  static wrapLegacyError(error: Error): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    if (error.name === 'ConfigurationError') {
      // Convert legacy ConfigurationError
      const legacy = error as any;
      return ErrorFactory.configuration(
        legacy.code || 'UNKNOWN_ERROR',
        legacy.message,
        {
          path: legacy.path,
          source: legacy.source,
          suggestions: legacy.suggestions,
          cause: error,
        },
      );
    }

    if (error.name === 'DatabaseError') {
      // Convert legacy DatabaseError
      const legacy = error as any;
      return ErrorFactory.database(
        legacy.type || 'QUERY_FAILED',
        legacy.message,
        {
          original: legacy.original,
          query: legacy.query,
          params: legacy.params,
          cause: error,
        },
      );
    }

    // Fallback to generic service error
    return ErrorFactory.service(error.message, 'LEGACY_ERROR', {
      cause: error,
    });
  }
}
```

## File Structure

```
src/shared/errors/
├── ErrorConstants.ts          # NEW: Centralized error constants
├── ErrorMigration.ts          # NEW: Legacy error migration utilities
├── ErrorFactory.ts            # ENHANCED: Add ConfigurationError and DatabaseError creation
├── ServiceError.ts            # EXISTING: Base class for all errors
├── ConfigurationError.ts      # REFACTORED: Now extends ServiceError
├── DatabaseError.ts           # MOVED: From storage/types, now extends ServiceError
└── ... (other existing error types)

src/config/errors/
├── ConfigurationError.ts      # REFACTORED: Import from shared/errors
└── index.ts                   # UPDATED: Re-export from shared location

src/features/storage/types/
├── StorageTypes.ts            # UPDATED: Remove DatabaseError, import from shared
└── index.ts                   # UPDATED: Re-export DatabaseError from shared
```

## Integration Points

### Configuration Service Integration

- **ConfigurationManager**: Use new ConfigurationError with retry logic
- **ConfigWatcher**: Integrate with circuit breaker for file watching
- **SchemaValidator**: Use enhanced validation error reporting
- **ProfileManager**: Add error handling profile support

### Storage Service Integration

- **DatabaseService**: Extend BaseService for standardized error handling
- **FileRepository**: Use new DatabaseError with circuit breaker
- **ConnectionPool**: Integrate with retry logic and timeout management
- **MigrationManager**: Use enhanced error reporting for migration failures

### Cross-Feature Integration

- **All Services**: Use ErrorFactory.wrapLegacyError() for gradual migration
- **Error Logging**: Enhanced ErrorLogger integration with new error types
- **Monitoring**: Error aggregation includes configuration and database errors
- **MCP Integration**: Standardized error responses for all error types

## Validation Criteria

- [ ] ConfigurationError extends ServiceError with full backward compatibility
- [ ] DatabaseError extends ServiceError with database-specific context preserved
- [ ] All hardcoded constants extracted to ErrorConstants.ts
- [ ] Environment variable support for all error constants
- [ ] ErrorFactory supports creation of all error types
- [ ] Legacy error wrapping works seamlessly
- [ ] No breaking changes to existing public APIs
- [ ] All existing tests pass without modification
- [ ] New error handling patterns work across all services

## Acceptance Tests

### Backward Compatibility Tests

- [ ] All existing ConfigurationError factory methods work unchanged
- [ ] All existing DatabaseError constructors work unchanged
- [ ] Error serialization format remains consistent
- [ ] Error message formatting preserved
- [ ] BatchValidationError functionality intact

### Integration Tests

- [ ] ConfigurationService uses new error handling with retry logic
- [ ] DatabaseService integrates with BaseService patterns
- [ ] Circuit breaker triggers for database connection failures
- [ ] Error aggregation includes new error types correctly
- [ ] Environment variable configuration works for constants

### Migration Tests

- [ ] Legacy error wrapping produces equivalent ServiceError instances
- [ ] Error type detection works for all legacy error types
- [ ] Gradual migration path works without breaking existing code
- [ ] Deprecation warnings issued for legacy patterns where appropriate

### Performance Tests

- [ ] Error creation overhead < 5% compared to legacy implementation
- [ ] Memory usage for error objects within acceptable limits
- [ ] Error aggregation performance with high error rates
- [ ] Circuit breaker performance under failure conditions

## Quality Gates

- [ ] TypeScript compilation without errors
- [ ] All existing unit tests pass without modification
- [ ] Code coverage > 90% for new error handling code
- [ ] No breaking changes to public APIs
- [ ] Performance benchmarks meet requirements
- [ ] Documentation updated for all new patterns
- [ ] Error handling constants properly documented
- [ ] Migration guide created for developers

## Dependencies

- **Internal**: ServiceError, ErrorFactory, RetryHandler, TimeoutManager, CircuitBreaker
- **External**: None (pure TypeScript implementation)
- **Configuration**: ConfigurationManager for error constants

## Risk Assessment

- **Medium Risk**: Refactoring existing error classes could break dependent code
- **Mitigation**: Comprehensive backward compatibility testing and gradual migration path
- **Fallback**: Maintain legacy error implementations alongside new ones during transition
- **Rollback**: Keep original error files as backup during initial deployment

## Migration Strategy

### Phase 1: Infrastructure (Low Risk)

1. Create ErrorConstants.ts with centralized values
2. Enhance ErrorFactory with new error types
3. Create migration utilities

### Phase 2: Core Refactoring (Medium Risk)

1. Refactor ConfigurationError to extend ServiceError
2. Refactor DatabaseError to extend ServiceError
3. Update integration points gradually

### Phase 3: Service Integration (Medium Risk)

1. Update ConfigurationService and DatabaseService
2. Add circuit breaker and retry logic integration
3. Enable enhanced error aggregation

### Phase 4: Cleanup (Low Risk)

1. Remove deprecated legacy patterns
2. Update documentation and examples
3. Add comprehensive testing coverage

This comprehensive refactoring plan will unify error handling across the entire codebase while maintaining full backward compatibility and providing a smooth migration path.

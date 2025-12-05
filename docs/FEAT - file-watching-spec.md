# File-Watching Feature Specification

## Overview

The File-Watching feature provides intelligent file system monitoring with debouncing and batching capabilities to efficiently track repository changes for incremental indexing.

## Architecture

### Structure
```
features/file-watching/
├── services/
│   ├── FileWatcher.ts          # Main file system monitoring service
│   ├── Debouncer.ts            # Individual file change debouncing
│   └── BatchProcessor.ts       # Multi-file batch processing
├── events/
│   ├── FileChangedEvent.ts     # Single file change notification
│   └── BatchChangeEvent.ts     # Batch file changes notification
├── utils/
│   └── pathUtils.ts            # File path manipulation utilities
├── types/
│   └── FileWatchingTypes.ts    # TypeScript type definitions
└── index.ts                    # Public API exports
```

## Core Components

### FileWatcher Service

**Purpose**: Main service that monitors file system changes using chokidar.

**Interface**:
```typescript
class FileWatcher {
  constructor(
    private eventBus: EventBus,
    private config: FileWatcherConfig
  ) {}

  async watch(directory: string): Promise<void>
  async unwatch(): Promise<void>
  getWatchedPaths(): string[]
}
```

**Responsibilities**:
- Initialize chokidar watcher with appropriate options
- Filter events based on ignore patterns and file types
- Route events to debouncer for processing
- Handle watcher lifecycle (start/stop/cleanup)

**Configuration**:
```typescript
interface FileWatcherConfig {
  ignorePatterns: string[];
  watchOptions: {
    ignored: string[];
    persistent: boolean;
    ignoreInitial: boolean;
    awaitWriteFinish: {
      stabilityThreshold: number;  // 300ms
      pollInterval: number;        // 100ms
    };
  };
}
```

### Debouncer Service

**Purpose**: Prevents rapid-fire events for individual files by implementing time-based debouncing.

**Interface**:
```typescript
class Debouncer {
  constructor(
    private eventBus: EventBus,
    private debounceMs: number = 300
  ) {}

  debounce(filePath: string, eventType: FileEventType): void
  flush(filePath: string): void
  flushAll(): void
}
```

**Responsibilities**:
- Maintain per-file debounce timers
- Emit FileChangedEvent after debounce period
- Handle timer cleanup and memory management
- Support immediate flush for batch operations

**Business Rules**:
- Debounce period: 300ms (configurable)
- Only emit events for actual changes (not duplicates)
- Clean up timers on file removal

### BatchProcessor Service

**Purpose**: Groups multiple file changes within time windows for efficient batch processing.

**Interface**:
```typescript
class BatchProcessor {
  constructor(
    private eventBus: EventBus,
    private batchWindowMs: number = 1000
  ) {}

  addChange(change: FileChange): void
  processBatch(): void
  getPendingChanges(): FileChange[]
}
```

**Responsibilities**:
- Collect file changes within time windows
- Emit BatchChangeEvent when window expires
- Merge duplicate changes for same file
- Provide batch statistics and metrics

**Business Rules**:
- Batch window: 1000ms (configurable)
- Maximum batch size: 100 files (configurable)
- Prioritize recent changes over older ones

## Event System

### FileChangedEvent
```typescript
interface FileChangedEvent extends BaseEvent {
  type: 'file-changed';
  filePath: string;
  eventType: 'add' | 'change' | 'unlink';
  stats?: fs.Stats;
}
```

### BatchChangeEvent
```typescript
interface BatchChangeEvent extends BaseEvent {
  type: 'batch-changed';
  changes: FileChange[];
  batchId: string;
  totalFiles: number;
}

interface FileChange {
  path: string;
  type: 'add' | 'change' | 'unlink';
  timestamp: number;
}
```

## Utility Functions

### Path Utilities
```typescript
// pathUtils.ts
export function normalizePath(path: string): string
export function isIgnored(path: string, patterns: string[]): boolean
export function getRelativePath(fullPath: string, rootPath: string): string
export function shouldWatchFile(filePath: string): boolean
```

## Business Rules

### File Filtering
1. **Ignore Patterns**: Respect .gitignore and configured ignore patterns
2. **File Types**: Only watch supported source files (.js, .ts, .py, etc.)
3. **Size Limits**: Skip files exceeding configured size limits
4. **Hidden Files**: Ignore dot-files and hidden directories

### Event Processing
1. **Debouncing**: Individual file changes debounced for 300ms
2. **Batching**: Multiple changes batched within 1-second windows
3. **Deduplication**: Remove duplicate events for same file
4. **Ordering**: Process events in chronological order

### Performance Considerations
1. **Memory Limits**: Limit concurrent debounce timers
2. **CPU Usage**: Efficient event processing without blocking
3. **Resource Cleanup**: Proper cleanup of timers and watchers
4. **Scalability**: Handle large numbers of files efficiently

## Error Handling

### Watcher Errors
- **Permission Denied**: Log error and continue monitoring other files
- **Path Not Found**: Validate paths before starting watcher
- **Too Many Files**: Implement file count limits

### Event Processing Errors
- **Invalid Paths**: Skip malformed file paths
- **Missing Files**: Handle deleted files gracefully
- **Event Overload**: Implement backpressure mechanisms

## Integration Points

### Event Bus Integration
- Subscribe to internal events for coordination
- Publish events to other features (indexing)
- Handle event routing and filtering

### Configuration Integration
- Accept configuration from main config system
- Support dynamic reconfiguration
- Validate configuration on startup

### Lifecycle Management
- Start/stop with application lifecycle
- Clean shutdown with proper resource cleanup
- Health checks and status reporting

## Testing Strategy

### Unit Tests
- FileWatcher initialization and configuration
- Debouncer timer management and cleanup
- BatchProcessor window management
- Path utility functions

### Integration Tests
- End-to-end file watching with real file system
- Event publishing and consumption
- Configuration loading and validation
- Error handling scenarios

### Performance Tests
- Large directory scanning performance
- High-frequency file change handling
- Memory usage under load
- Concurrent operation limits</content>
<parameter name="filePath">docsV2/file-watching-spec.md
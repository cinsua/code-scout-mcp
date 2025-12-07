# Configuration Management

## Configuration Architecture

### Configuration Sources (Priority Order)

1. **Command Line Arguments**: Highest priority, runtime overrides
2. **Environment Variables**: Container and deployment configuration
3. **Project Configuration**: `.code-scout/config.json` in project root
4. **Global Configuration**: `~/.code-scout/config.json` user home
5. **Default Values**: Built-in sensible defaults (lowest priority)

### Configuration File Format

```json
{
  "indexing": {
    "maxFileSize": 10485760,
    "maxWorkers": 4,
    "batchSize": 100,
    "debounceMs": 300,
    "batchWindowMs": 1000
  },
  "search": {
    "defaultLimit": 20,
    "maxLimit": 100,
    "scoringWeights": {
      "filename": 5.0,
      "path": 3.0,
      "definitions": 3.0,
      "imports": 2.0,
      "documentation": 1.0
    }
  },
  "database": {
    "path": "./.code-scout/database.db",
    "maxConnections": 10,
    "connectionTimeout": 30000
  },
  "watching": {
    "enabled": true,
    "ignorePatterns": [
      "node_modules",
      ".git",
      "dist",
      "build",
      "__pycache__",
      "*.pyc"
    ]
  },
  "languages": {
    "typescript": {
      "extensions": [".js", ".jsx", ".ts", ".tsx"],
      "parser": "TypeScriptParser"
    },
    "python": {
      "extensions": [".py"],
      "parser": "PythonParser"
    }
  }
}
```

## Configuration Loading

### Configuration Manager

```typescript
class ConfigurationManager {
  async loadConfiguration(): Promise<AppConfig> {
    const sources = [
      await this.loadDefaults(),
      await this.loadGlobalConfig(),
      await this.loadProjectConfig(),
      this.loadEnvironmentVariables(),
      this.parseCommandLineArgs(),
    ];

    return this.mergeConfigurations(sources);
  }

  private mergeConfigurations(sources: Partial<AppConfig>[]): AppConfig {
    // Deep merge with priority order (later sources override earlier)
  }
}
```

### File Discovery

- **Project Root Detection**: Search upwards from current directory for project markers
- **Configuration File Resolution**: Resolve relative paths and environment variables
- **Fallback Handling**: Graceful fallback when configuration files are missing

## Environment Variables

### Naming Convention

- **Prefix**: `CODE_SCOUT_` for all environment variables
- **Hierarchy**: Use underscores for nested properties
- **Types**: Support string, number, boolean, and JSON values

### Supported Variables

```bash
# Database Configuration
CODE_SCOUT_DB_PATH=./.code-scout/database.db
CODE_SCOUT_DB_MAX_CONNECTIONS=10
CODE_SCOUT_DB_CONNECTION_TIMEOUT=30000

# Indexing Configuration
CODE_SCOUT_INDEX_MAX_FILE_SIZE=10485760
CODE_SCOUT_INDEX_MAX_WORKERS=4
CODE_SCOUT_INDEX_BATCH_SIZE=100
CODE_SCOUT_INDEX_DEBOUNCE_MS=300
CODE_SCOUT_INDEX_BATCH_WINDOW_MS=1000

# Search Configuration
CODE_SCOUT_SEARCH_DEFAULT_LIMIT=20
CODE_SCOUT_SEARCH_MAX_LIMIT=100

# File Watching
CODE_SCOUT_WATCH_ENABLED=true
CODE_SCOUT_WATCH_IGNORE_PATTERNS=node_modules,.git,dist

# Languages (JSON string)
CODE_SCOUT_LANGUAGES='{"typescript":{"extensions":[".js",".jsx",".ts",".tsx"],"parser":"TypeScriptParser"}}'
```

## Validation and Error Handling

### Schema Validation

- **JSON Schema**: Validate configuration structure and types
- **Semantic Validation**: Check value ranges and relationships
- **Dependency Validation**: Ensure required dependencies are met

### Error Reporting

- **Clear Messages**: Descriptive error messages for validation failures
- **Suggestions**: Provide correction suggestions for common mistakes
- **Partial Loading**: Load valid parts of configuration when possible

## Dynamic Configuration

### Hot Reloading

- **File Watching**: Monitor configuration files for changes
- **Graceful Updates**: Apply changes without restarting services
- **Validation**: Validate new configuration before applying
- **Rollback**: Revert to previous configuration on failure

### Runtime Overrides

- **Command Line**: Allow runtime parameter overrides
- **Environment**: Support dynamic environment variable changes
- **API Endpoints**: Future configuration management API

## Configuration Profiles

### Development Profile

```json
{
  "indexing": {
    "maxWorkers": 2,
    "batchSize": 50
  },
  "database": {
    "path": "./.code-scout/dev.db"
  },
  "watching": {
    "enabled": true
  }
}
```

### Production Profile

```json
{
  "indexing": {
    "maxWorkers": 8,
    "batchSize": 200
  },
  "database": {
    "maxConnections": 20
  },
  "watching": {
    "enabled": false
  }
}
```

### CI/CD Profile

```json
{
  "indexing": {
    "maxWorkers": 1,
    "batchSize": 10
  },
  "watching": {
    "enabled": false
  }
}
```

## Configuration Migration

### Version Management

- **Version Tracking**: Track configuration schema versions
- **Automatic Migration**: Migrate old configurations to new format
- **Backward Compatibility**: Support multiple configuration versions
- **Migration Scripts**: Automated configuration updates

### Deprecation Handling

- **Deprecation Warnings**: Warn about deprecated configuration options
- **Migration Guides**: Provide migration documentation
- **Graceful Degradation**: Support old options with warnings

## Security Considerations

### Sensitive Data Handling

- **No Secrets**: Configuration does not contain passwords or API keys
- **File Permissions**: Restrictive permissions on configuration files
- **Environment Isolation**: Secure environment variable handling
- **Audit Logging**: Pino-based audit logging for configuration changes (see [IMPL - logging.md](IMPL%20-%20logging.md))

### Access Control

- **File Access**: Control who can read/write configuration files
- **Runtime Access**: Limit configuration modification at runtime
- **Validation**: Prevent malicious configuration values

## Testing Configuration

### Configuration Testing

- **Unit Tests**: Test configuration loading and validation
- **Integration Tests**: Test configuration in different environments
- **Migration Tests**: Test configuration migration scripts

### Environment Testing

- **Development**: Test with development configuration
- **Production**: Test with production-like configuration
- **Edge Cases**: Test with invalid and edge-case configurations

This configuration management system provides flexible, secure, and maintainable configuration handling across different environments and use cases.

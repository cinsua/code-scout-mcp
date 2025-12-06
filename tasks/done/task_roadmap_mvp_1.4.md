# Task 1.4: Implement Configuration Management System

## Overview

Implement a comprehensive configuration management system that supports multiple configuration sources, validation, hot reloading, and environment-specific profiles for the Code-Scout MCP server.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Requirements from Documentation

### Configuration Architecture (from IMPL - configuration_management.md)

- **Priority Order**: Command Line > Environment Variables > Project Config > Global Config > Defaults
- **Configuration Sources**: 5-tier configuration loading with proper precedence
- **File Format**: JSON configuration with nested structure for all features
- **Environment Variables**: CODE*SCOUT* prefix with underscore hierarchy
- **Validation**: JSON Schema validation with semantic checks
- **Hot Reloading**: File watching for configuration changes
- **Profiles**: Development, Production, CI/CD configurations

### Technical Specifications (from CORE - technical_specifications.md)

- **Location**: `src/config/` directory for configuration management
- **AppConfig Interface**: Complete TypeScript interface definitions
- **Feature Integration**: Configuration for all 5 core features
- **Error Handling**: ConfigurationError type for invalid configurations
- **Security**: No sensitive data, restrictive file permissions

## Implementation Checklist

### 1.4.1 Setup Configuration Infrastructure

- [x] Create `src/config/` directory structure
- [x] Define TypeScript interfaces in `src/config/types/ConfigTypes.ts`
- [x] Create JSON Schema for validation in `src/config/schema/config-schema.json`
- [x] Setup configuration models in `src/config/models/Configuration.ts`
- [x] Create configuration errors in `src/config/errors/ConfigurationError.ts`

### 1.4.2 Implement Configuration Sources

- [x] Create `src/config/sources/DefaultConfiguration.ts` for built-in defaults
- [x] Implement `src/config/sources/GlobalConfiguration.ts` for `~/.code-scout/config.json`
- [x] Create `src/config/sources/ProjectConfiguration.ts` for `.code-scout/config.json`
- [x] Implement `src/config/sources/EnvironmentConfiguration.ts` for CODE*SCOUT* variables
- [x] Create `src/config/sources/CommandLineConfiguration.ts` for CLI arguments

### 1.4.3 Build Configuration Manager

- [x] Create `src/config/services/ConfigurationManager.ts` main orchestration
- [x] Implement configuration loading with priority order
- [x] Add deep merge functionality for configuration sources
- [x] Create configuration validation with JSON Schema
- [x] Add error handling and partial loading support

### 1.4.4 Add File Discovery and Resolution

- [x] Implement project root detection in `src/config/utils/projectDetection.ts`
- [x] Create configuration file resolution in `src/config/utils/fileResolution.ts`
- [x] Add path normalization and environment variable expansion
- [x] Implement fallback handling for missing configuration files
- [x] Create configuration file permission validation

### 1.4.5 Implement Environment Variable Support

- [x] Create environment variable parser in `src/config/utils/envParser.ts`
- [x] Implement CODE*SCOUT* prefix handling
- [x] Add type conversion (string, number, boolean, JSON)
- [x] Create hierarchy flattening for nested properties
- [x] Add validation for environment variable values

### 1.4.6 Add Configuration Validation

- [x] Implement JSON Schema validation in `src/config/validators/SchemaValidator.ts`
- [x] Create semantic validation in `src/config/validators/SemanticValidator.ts`
- [x] Add dependency validation between configuration sections
- [x] Implement clear error messages with suggestions
- [x] Create partial configuration loading for valid sections

### 1.4.7 Implement Hot Reloading

- [x] Create configuration file watcher in `src/config/services/ConfigWatcher.ts`
- [x] Implement graceful configuration updates
- [x] Add validation before applying new configuration
- [x] Create rollback mechanism for failed updates
- [x] Add configuration change event emission

### 1.4.8 Add Configuration Profiles

- [x] Create profile definitions in `src/config/profiles/`
- [x] Implement development profile configuration
- [x] Create production profile configuration
- [x] Add CI/CD profile configuration
- [x] Implement profile selection and loading

### 1.4.9 Add Security and Migration Support

- [x] Implement file permission validation
- [x] Add configuration version tracking
- [x] Create migration scripts for configuration changes
- [x] Add deprecation warning system
- [x] Implement audit logging for configuration changes

### 1.4.10 Create Configuration API

- [x] Create main configuration interface in `src/config/index.ts`
- [x] Add configuration access methods
- [x] Implement configuration update methods
- [x] Add configuration reset functionality
- [x] Create configuration export/import methods

## Code Templates

### Configuration Types Template

```typescript
// src/config/types/ConfigTypes.ts
export interface AppConfig {
  indexing: IndexingConfig;
  search: SearchConfig;
  database: DatabaseConfig;
  watching: WatchingConfig;
  languages: LanguagesConfig;
}

export interface IndexingConfig {
  maxFileSize: number;
  maxWorkers: number;
  batchSize: number;
  debounceMs: number;
  batchWindowMs: number;
}

export interface SearchConfig {
  defaultLimit: number;
  maxLimit: number;
  scoringWeights: ScoringWeights;
}

export interface ScoringWeights {
  filename: number;
  path: number;
  definitions: number;
  imports: number;
  documentation: number;
}

export interface DatabaseConfig {
  path: string;
  maxConnections: number;
  connectionTimeout: number;
}

export interface WatchingConfig {
  enabled: boolean;
  ignorePatterns: string[];
}

export interface LanguagesConfig {
  typescript: LanguageConfig;
  javascript: LanguageConfig;
  python: LanguageConfig;
}

export interface LanguageConfig {
  extensions: string[];
  parser: string;
}
```

### Configuration Manager Template

```typescript
// src/config/services/ConfigurationManager.ts
export class ConfigurationManager {
  private config: AppConfig | null = null;
  private sources: ConfigurationSource[] = [];
  private watcher: ConfigWatcher | null = null;

  constructor() {
    this.sources = [
      new DefaultConfiguration(),
      new GlobalConfiguration(),
      new ProjectConfiguration(),
      new EnvironmentConfiguration(),
      new CommandLineConfiguration(),
    ];
  }

  async loadConfiguration(): Promise<AppConfig> {
    const configurations = await Promise.all(
      this.sources.map((source) => source.load())
    );

    const mergedConfig = this.mergeConfigurations(configurations);
    const validatedConfig = await this.validateConfiguration(mergedConfig);

    this.config = validatedConfig;
    return validatedConfig;
  }

  private mergeConfigurations(sources: Partial<AppConfig>[]): AppConfig {
    return sources.reduce((merged, source) => {
      return deepMerge(merged, source);
    }, {} as AppConfig);
  }

  private async validateConfiguration(
    config: Partial<AppConfig>
  ): Promise<AppConfig> {
    const schemaValidator = new SchemaValidator();
    const semanticValidator = new SemanticValidator();

    await schemaValidator.validate(config);
    await semanticValidator.validate(config);

    return config as AppConfig;
  }
}
```

### Configuration Source Template

```typescript
// src/config/sources/ConfigurationSource.ts
export abstract class ConfigurationSource {
  abstract load(): Promise<Partial<AppConfig>>;
  abstract priority: number;
}

// src/config/sources/ProjectConfiguration.ts
export class ProjectConfiguration extends ConfigurationSource {
  priority = 3; // Third priority after defaults and global

  async load(): Promise<Partial<AppConfig>> {
    const projectRoot = await this.findProjectRoot();
    const configPath = path.join(projectRoot, '.code-scout', 'config.json');

    if (!(await fileExists(configPath))) {
      return {};
    }

    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  }

  private async findProjectRoot(): Promise<string> {
    // Search upwards for package.json, .git, or other project markers
  }
}
```

### Environment Variable Parser Template

```typescript
// src/config/utils/envParser.ts
export class EnvironmentParser {
  parse(): Partial<AppConfig> {
    const env = process.env;
    const config: any = {};

    // Database configuration
    if (env.CODE_SCOUT_DB_PATH) {
      config.database = config.database || {};
      config.database.path = env.CODE_SCOUT_DB_PATH;
    }

    if (env.CODE_SCOUT_DB_MAX_CONNECTIONS) {
      config.database = config.database || {};
      config.database.maxConnections = parseInt(
        env.CODE_SCOUT_DB_MAX_CONNECTIONS,
        10
      );
    }

    // Indexing configuration
    if (env.CODE_SCOUT_INDEX_MAX_FILE_SIZE) {
      config.indexing = config.indexing || {};
      config.indexing.maxFileSize = parseInt(
        env.CODE_SCOUT_INDEX_MAX_FILE_SIZE,
        10
      );
    }

    // Parse JSON environment variables
    if (env.CODE_SCOUT_LANGUAGES) {
      try {
        config.languages = JSON.parse(env.CODE_SCOUT_LANGUAGES);
      } catch (error) {
        throw new ConfigurationError(
          `Invalid JSON in CODE_SCOUT_LANGUAGES: ${error.message}`
        );
      }
    }

    return config;
  }
}
```

## File Structure

```
src/config/
├── types/
│   └── ConfigTypes.ts
├── models/
│   └── Configuration.ts
├── services/
│   ├── ConfigurationManager.ts
│   └── ConfigWatcher.ts
├── sources/
│   ├── ConfigurationSource.ts
│   ├── DefaultConfiguration.ts
│   ├── GlobalConfiguration.ts
│   ├── ProjectConfiguration.ts
│   ├── EnvironmentConfiguration.ts
│   └── CommandLineConfiguration.ts
├── validators/
│   ├── SchemaValidator.ts
│   └── SemanticValidator.ts
├── utils/
│   ├── projectDetection.ts
│   ├── fileResolution.ts
│   └── envParser.ts
├── profiles/
│   ├── development.json
│   ├── production.json
│   └── cicd.json
├── schema/
│   └── config-schema.json
├── errors/
│   └── ConfigurationError.ts
└── index.ts
```

## Integration Points

- **All Features**: Configuration provides settings for indexing, parsing, querying, storage, and file-watching
- **CLI Interface**: Command line arguments override other configuration sources
- **Database Service**: Uses database configuration for connections and paths
- **MCP Protocol**: Configuration affects tool behavior and limits

## Validation Criteria

- [ ] All configuration sources load in correct priority order
- [ ] Environment variables properly override configuration files
- [ ] JSON Schema validation catches invalid configurations
- [ ] Hot reloading updates configuration without service restart
- [ ] Profile selection works for different environments
- [ ] Error messages are clear and actionable

## Acceptance Tests

- [ ] Unit tests for each configuration source
- [ ] Integration tests for configuration loading and merging
- [ ] Validation tests with invalid configurations
- [ ] Hot reloading tests with file changes
- [ ] Environment variable parsing tests
- [ ] Profile loading tests
- [ ] Security tests for file permissions
- [ ] Migration tests for configuration version changes

## Quality Gates

- [ ] Code coverage > 95% for configuration logic
- [ ] All TypeScript interfaces properly defined
- [ ] JSON Schema matches configuration interfaces
- [ ] Error handling follows project patterns
- [ ] Documentation complete for all configuration options
- [ ] Performance tests pass for configuration loading
- [ ] Security tests pass for file access validation

## Default Configuration Values

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
    "javascript": {
      "extensions": [".js", ".jsx"],
      "parser": "JavaScriptParser"
    },
    "python": {
      "extensions": [".py"],
      "parser": "PythonParser"
    }
  }
}
```

## Environment Variables Reference

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

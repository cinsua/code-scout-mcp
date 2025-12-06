/**
 * Semantic Validator
 *
 * This module provides semantic validation for configuration objects,
 * checking logical consistency, dependencies, and business rules.
 */

import {
  PartialAppConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types/ConfigTypes';

/**
 * Semantic validation options
 */
export interface SemanticValidatorOptions {
  /**
   * Whether to perform strict validation
   */
  strict?: boolean;

  /**
   * Whether to check performance implications
   */
  checkPerformance?: boolean;

  /**
   * Whether to check security implications
   */
  checkSecurity?: boolean;

  /**
   * Whether to validate cross-section dependencies
   */
  checkDependencies?: boolean;
}

/**
 * Validation rule definition
 */
export interface ValidationRule {
  /**
   * Rule name
   */
  name: string;

  /**
   * Rule description
   */
  description: string;

  /**
   * Validation function
   */
  validate: (config: PartialAppConfig) => ValidationResult;

  /**
   * Rule severity (error, warning, info)
   */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Semantic Validator class
 */
export class SemanticValidator {
  private options: Required<SemanticValidatorOptions>;
  private rules: ValidationRule[] = [];

  constructor(options: SemanticValidatorOptions = {}) {
    this.options = {
      strict: options.strict ?? true,
      checkPerformance: options.checkPerformance ?? true,
      checkSecurity: options.checkSecurity ?? true,
      checkDependencies: options.checkDependencies ?? true,
    };

    this.initializeRules();
  }

  /**
   * Validate configuration semantically
   *
   * @param config - Configuration to validate
   * @returns ValidationResult
   */
  validate(config: PartialAppConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const rule of this.rules) {
      try {
        const result = rule.validate(config);

        // Filter results by severity
        if (rule.severity === 'error') {
          errors.push(...result.errors);
        } else if (rule.severity === 'warning') {
          warnings.push(...result.warnings);
        }

        // Always include warnings from error rules
        warnings.push(...result.warnings);
      } catch (error) {
        errors.push({
          path: 'semantic',
          message: `Validation rule '${rule.name}' failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'RULE_EXECUTION_ERROR',
          suggestion: 'Check the configuration and try again',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Add a custom validation rule
   *
   * @param rule - Validation rule to add
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a validation rule by name
   *
   * @param name - Rule name to remove
   */
  removeRule(name: string): void {
    this.rules = this.rules.filter((rule) => rule.name !== name);
  }

  /**
   * Get all validation rules
   *
   * @returns Array of validation rules
   */
  getRules(): ValidationRule[] {
    return [...this.rules];
  }

  /**
   * Initialize built-in validation rules
   */
  private initializeRules(): void {
    // Database validation rules
    if (this.options.checkDependencies) {
      this.addRule({
        name: 'database-consistency',
        description: 'Validate database configuration consistency',
        severity: 'error',
        validate: (config) => this.validateDatabaseConsistency(config),
      });
    }

    // Indexing validation rules
    if (this.options.checkPerformance) {
      this.addRule({
        name: 'indexing-performance',
        description: 'Validate indexing configuration for performance',
        severity: 'warning',
        validate: (config) => this.validateIndexingPerformance(config),
      });
    }

    // Search validation rules
    this.addRule({
      name: 'search-logic',
      description: 'Validate search configuration logic',
      severity: 'error',
      validate: (config) => this.validateSearchLogic(config),
    });

    // File watching validation rules
    this.addRule({
      name: 'watching-configuration',
      description: 'Validate file watching configuration',
      severity: 'warning',
      validate: (config) => this.validateWatchingConfiguration(config),
    });

    // Security validation rules
    if (this.options.checkSecurity) {
      this.addRule({
        name: 'security-configuration',
        description: 'Validate security configuration',
        severity: 'error',
        validate: (config) => this.validateSecurityConfiguration(config),
      });
    }

    // Language configuration validation
    this.addRule({
      name: 'language-configuration',
      description: 'Validate language configuration',
      severity: 'error',
      validate: (config) => this.validateLanguageConfiguration(config),
    });

    // Logging validation rules
    this.addRule({
      name: 'logging-configuration',
      description: 'Validate logging configuration',
      severity: 'warning',
      validate: (config) => this.validateLoggingConfiguration(config),
    });

    // Cross-section dependencies
    if (this.options.checkDependencies) {
      this.addRule({
        name: 'cross-section-dependencies',
        description: 'Validate dependencies between configuration sections',
        severity: 'error',
        validate: (config) => this.validateCrossSectionDependencies(config),
      });
    }
  }

  /**
   * Validate database configuration consistency
   */
  private validateDatabaseConsistency(
    config: PartialAppConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.database) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { database } = config;

    // Check database type consistency
    if (database.type === 'sqlite' && database.connectionString) {
      warnings.push({
        path: 'database.connectionString',
        message: 'connectionString is ignored for SQLite databases',
        code: 'IGNORED_SETTING',
      });
    }

    if (database.type !== 'sqlite' && !database.connectionString) {
      errors.push({
        path: 'database.connectionString',
        message: `connectionString is required for ${database.type} databases`,
        code: 'MISSING_CONNECTION_STRING',
        suggestion: 'Provide a valid connection string for the database',
      });
    }

    // Validate connection limits
    if (database.maxConnections && database.maxConnections < 1) {
      errors.push({
        path: 'database.maxConnections',
        message: 'maxConnections must be at least 1',
        code: 'INVALID_CONNECTION_LIMIT',
        suggestion: 'Set maxConnections to a positive integer',
      });
    }

    if (database.maxConnections && database.maxConnections > 100) {
      warnings.push({
        path: 'database.maxConnections',
        message: 'High maxConnections may impact performance',
        code: 'HIGH_CONNECTION_LIMIT',
        suggestion:
          'Consider reducing maxConnections or implementing connection pooling',
      });
    }

    // Validate timeout
    if (database.connectionTimeout && database.connectionTimeout < 1000) {
      warnings.push({
        path: 'database.connectionTimeout',
        message: 'Very low connection timeout may cause frequent failures',
        code: 'LOW_TIMEOUT',
        suggestion: 'Consider increasing connectionTimeout to at least 1000ms',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate indexing configuration for performance
   */
  private validateIndexingPerformance(
    config: PartialAppConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.indexing) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { indexing } = config;

    // Check worker vs batch size ratio
    if (indexing.maxWorkers && indexing.batchSize) {
      if (indexing.maxWorkers > indexing.batchSize) {
        warnings.push({
          path: 'indexing.maxWorkers',
          message: 'maxWorkers greater than batchSize may be inefficient',
          code: 'INEFFICIENT_WORKER_RATIO',
          suggestion: 'Consider increasing batchSize or reducing maxWorkers',
        });
      }
    }

    // Check file size limits
    if (indexing.maxFileSize && indexing.maxFileSize > 100 * 1024 * 1024) {
      // 100MB
      warnings.push({
        path: 'indexing.maxFileSize',
        message: 'Large maxFileSize may impact indexing performance',
        code: 'LARGE_FILE_SIZE',
        suggestion: 'Consider reducing maxFileSize or implementing streaming',
      });
    }

    // Check debounce timing
    if (indexing.debounceMs && indexing.debounceMs > 5000) {
      warnings.push({
        path: 'indexing.debounceMs',
        message: 'High debounce delay may slow down indexing updates',
        code: 'HIGH_DEBOUNCE',
        suggestion: 'Consider reducing debounceMs for more responsive indexing',
      });
    }

    // Check depth limits
    if (indexing.maxDepth && indexing.maxDepth > 20) {
      warnings.push({
        path: 'indexing.maxDepth',
        message: 'Very deep directory traversal may be slow',
        code: 'DEEP_TRAVERSAL',
        suggestion: 'Consider reducing maxDepth or using ignore patterns',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate search configuration logic
   */
  private validateSearchLogic(config: PartialAppConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.search) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { search } = config;

    // Check limit consistency
    if (search.defaultLimit && search.maxLimit) {
      if (search.defaultLimit > search.maxLimit) {
        errors.push({
          path: 'search.defaultLimit',
          message: 'defaultLimit cannot be greater than maxLimit',
          code: 'INVALID_LIMIT_RANGE',
          suggestion: 'Set defaultLimit <= maxLimit',
        });
      }
    }

    // Check fuzzy threshold
    if (search.fuzzyThreshold !== undefined) {
      if (search.fuzzyThreshold < 0 || search.fuzzyThreshold > 1) {
        errors.push({
          path: 'search.fuzzyThreshold',
          message: 'fuzzyThreshold must be between 0 and 1',
          code: 'INVALID_FUZZY_THRESHOLD',
          suggestion: 'Set fuzzyThreshold to a value between 0 and 1',
        });
      }
    }

    // Check scoring weights
    if (search.scoringWeights) {
      const weights = search.scoringWeights;
      const totalWeight = Object.values(weights).reduce(
        (sum, weight) => sum + weight,
        0
      );

      if (totalWeight === 0) {
        errors.push({
          path: 'search.scoringWeights',
          message: 'At least one scoring weight must be greater than 0',
          code: 'ZERO_SCORING_WEIGHTS',
          suggestion: 'Set at least one scoring weight to a positive value',
        });
      }

      // Check for negative weights
      for (const [key, weight] of Object.entries(weights)) {
        if (weight < 0) {
          warnings.push({
            path: `search.scoringWeights.${key}`,
            message: `Negative scoring weight for ${key}`,
            code: 'NEGATIVE_WEIGHT',
            suggestion: 'Consider using positive weights for better results',
          });
        }
      }
    }

    // Check timeout
    if (search.timeoutMs && search.timeoutMs < 1000) {
      warnings.push({
        path: 'search.timeoutMs',
        message: 'Very low search timeout may cause premature failures',
        code: 'LOW_SEARCH_TIMEOUT',
        suggestion: 'Consider increasing timeoutMs to at least 1000ms',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate file watching configuration
   */
  private validateWatchingConfiguration(
    config: PartialAppConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.watching) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { watching } = config;

    // Check ignore patterns
    if (watching.ignorePatterns && watching.includePatterns) {
      const conflicts = watching.ignorePatterns.filter((pattern) =>
        watching.includePatterns!.includes(pattern)
      );

      if (conflicts.length > 0) {
        warnings.push({
          path: 'watching.ignorePatterns',
          message: `Patterns in both ignore and include: ${conflicts.join(', ')}`,
          code: 'CONFLICTING_PATTERNS',
          suggestion:
            'Remove conflicting patterns from ignore or include lists',
        });
      }
    }

    // Check polling interval
    if (watching.pollingInterval && watching.pollingInterval < 100) {
      warnings.push({
        path: 'watching.pollingInterval',
        message: 'Very low polling interval may impact performance',
        code: 'HIGH_POLLING_FREQUENCY',
        suggestion: 'Consider increasing pollingInterval to reduce CPU usage',
      });
    }

    // Check debounce timing
    if (watching.debounceMs && watching.debounceMs > 2000) {
      warnings.push({
        path: 'watching.debounceMs',
        message: 'High debounce delay may slow down file change detection',
        code: 'HIGH_WATCH_DEBOUNCE',
        suggestion: 'Consider reducing debounceMs for more responsive watching',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate security configuration
   */
  private validateSecurityConfiguration(
    config: PartialAppConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.security) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { security } = config;

    // Check allowed extensions
    if (security.allowedExtensions && security.allowedExtensions.length === 0) {
      warnings.push({
        path: 'security.allowedExtensions',
        message:
          'No allowed extensions specified - all files will be processed',
        code: 'NO_ALLOWED_EXTENSIONS',
        suggestion: 'Specify allowed extensions for better security',
      });
    }

    // Check blocked patterns
    if (security.blockedPatterns && security.blockedPatterns.length === 0) {
      warnings.push({
        path: 'security.blockedPatterns',
        message:
          'No blocked patterns specified - potentially unsafe files may be processed',
        code: 'NO_BLOCKED_PATTERNS',
        suggestion: 'Add blocked patterns for sensitive files',
      });
    }

    // Check path length
    if (security.maxPathLength && security.maxPathLength > 4096) {
      warnings.push({
        path: 'security.maxPathLength',
        message: 'Very high maxPathLength may allow path traversal attacks',
        code: 'HIGH_PATH_LENGTH',
        suggestion: 'Consider reducing maxPathLength to a reasonable value',
      });
    }

    // Check sandbox configuration
    if (security.enableSandbox && !security.sandbox) {
      errors.push({
        path: 'security.sandbox',
        message: 'Sandbox is enabled but no sandbox configuration provided',
        code: 'MISSING_SANDBOX_CONFIG',
        suggestion: 'Provide sandbox configuration or disable sandbox',
      });
    }

    if (security.sandbox) {
      if (security.sandbox.timeoutMs && security.sandbox.timeoutMs < 1000) {
        warnings.push({
          path: 'security.sandbox.timeoutMs',
          message:
            'Very low sandbox timeout may cause legitimate operations to fail',
          code: 'LOW_SANDBOX_TIMEOUT',
          suggestion: 'Consider increasing sandbox timeoutMs',
        });
      }

      if (
        security.sandbox.memoryLimitMB &&
        security.sandbox.memoryLimitMB < 64
      ) {
        warnings.push({
          path: 'security.sandbox.memoryLimitMB',
          message: 'Very low memory limit may cause operations to fail',
          code: 'LOW_MEMORY_LIMIT',
          suggestion: 'Consider increasing memoryLimitMB',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate language configuration
   */
  private validateLanguageConfiguration(
    config: PartialAppConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.languages) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { languages } = config;

    // Check each language configuration
    for (const [langName, langConfig] of Object.entries(languages)) {
      if (!langConfig.extensions || langConfig.extensions.length === 0) {
        errors.push({
          path: `languages.${langName}.extensions`,
          message: `No file extensions specified for ${langName}`,
          code: 'NO_EXTENSIONS',
          suggestion: `Add at least one file extension for ${langName}`,
        });
      }

      if (!langConfig.parser) {
        errors.push({
          path: `languages.${langName}.parser`,
          message: `No parser specified for ${langName}`,
          code: 'NO_PARSER',
          suggestion: `Specify a parser for ${langName}`,
        });
      }

      // Check for duplicate extensions
      const allExtensions: string[] = [];
      for (const [name, config] of Object.entries(languages)) {
        if (config.extensions) {
          allExtensions.push(...config.extensions);
        }
      }

      const duplicates = allExtensions.filter(
        (ext, index) => allExtensions.indexOf(ext) !== index
      );
      if (duplicates.length > 0) {
        warnings.push({
          path: 'languages',
          message: `Duplicate file extensions: ${[...new Set(duplicates)].join(', ')}`,
          code: 'DUPLICATE_EXTENSIONS',
          suggestion:
            'Remove duplicate extensions from language configurations',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate logging configuration
   */
  private validateLoggingConfiguration(
    config: PartialAppConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.logging) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { logging } = config;

    // Check file logging configuration
    if (logging.file?.enabled && !logging.file?.path) {
      warnings.push({
        path: 'logging.file.path',
        message: 'File logging enabled but no path specified',
        code: 'NO_LOG_PATH',
        suggestion: 'Specify a log file path or disable file logging',
      });
    }

    // Check log level
    if (logging.level === 'trace' || logging.level === 'debug') {
      warnings.push({
        path: 'logging.level',
        message: 'Verbose logging may impact performance in production',
        code: 'VERBOSE_LOGGING',
        suggestion: 'Consider using info or warn level in production',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate cross-section dependencies
   */
  private validateCrossSectionDependencies(
    config: PartialAppConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if watching is enabled but indexing is disabled
    if (config.watching?.enabled && !config.indexing) {
      warnings.push({
        path: 'watching.enabled',
        message: 'File watching enabled but indexing configuration not found',
        code: 'WATCHING_WITHOUT_INDEXING',
        suggestion: 'Configure indexing or disable file watching',
      });
    }

    // Check database path vs file watching
    if (config.database?.path && config.watching?.enabled) {
      const dbPath = config.database.path;
      const ignorePatterns = config.watching.ignorePatterns || [];

      const shouldIgnoreDb = ignorePatterns.some(
        (pattern) => dbPath.includes(pattern) || pattern.includes('database')
      );

      if (!shouldIgnoreDb) {
        warnings.push({
          path: 'watching.ignorePatterns',
          message: 'Database file may trigger unnecessary file watching events',
          code: 'DATABASE_NOT_IGNORED',
          suggestion: 'Add database path to ignore patterns',
        });
      }
    }

    // Check search limits vs indexing batch size
    if (config.search?.maxLimit && config.indexing?.batchSize) {
      if (config.search.maxLimit > config.indexing.batchSize * 10) {
        warnings.push({
          path: 'search.maxLimit',
          message: 'Search limit much higher than indexing batch size',
          code: 'MISMATCHED_LIMITS',
          suggestion:
            'Consider aligning search limits with indexing configuration',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }
}

/**
 * Create a default semantic validator instance
 *
 * @param options - Validator options
 * @returns SemanticValidator instance
 */
export function createSemanticValidator(
  options?: SemanticValidatorOptions
): SemanticValidator {
  return new SemanticValidator(options);
}

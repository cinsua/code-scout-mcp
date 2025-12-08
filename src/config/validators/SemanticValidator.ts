/**
 * Semantic Validator
 *
 * This module provides semantic validation for configuration objects,
 * checking logical consistency, dependencies, and business rules.
 */

import type {
  PartialAppConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DatabaseConfig,
  IndexingConfig,
  SearchConfig,
  SecurityConfig,
  WatchingConfig,
  LanguageConfig,
} from '@/config/types/ConfigTypes';
import { ConfigurationError } from '@/config/errors/ConfigurationError';
import { ErrorFactory } from '@/shared/errors/ErrorFactory';
import { ErrorMigration } from '@/shared/errors/ErrorMigration';
import { LogManager } from '@/shared/utils/LogManager';

/**
 * Maximum recommended database connections
 */
const MAX_RECOMMENDED_CONNECTIONS = 100;

/**
 * Minimum timeout in milliseconds
 */
const MIN_TIMEOUT_MS = 1000;

/**
 * Maximum recommended file size for indexing
 */
const MAX_RECOMMENDED_FILE_SIZE = 5000;

/**
 * Maximum recommended directory traversal depth
 */
const MAX_RECOMMENDED_DEPTH = 20;

/**
 * Maximum recommended database file size
 */
const MAX_RECOMMENDED_DB_SIZE = 4096;

/**
 * Maximum recommended workers
 */
const MAX_RECOMMENDED_WORKERS = 64;

/**
 * Minimum recommended polling interval in milliseconds
 */
const MIN_POLLING_INTERVAL_MS = 100;

/**
 * Maximum recommended debounce timing in milliseconds
 */
const MAX_DEBOUNCE_MS = 2000;

/**
 * Multiplier for search limit vs indexing batch size
 */
const SEARCH_LIMIT_MULTIPLIER = 10;

/**
 * Number of bytes in a kilobyte
 */
const BYTES_PER_KB = 1024;

/**
 * Number of kilobytes in a megabyte
 */
const KB_PER_MB = 1024;

/**
 * Number of megabytes for recommended index file size
 */
const RECOMMENDED_INDEX_MB = 100;

/**
 * Maximum recommended file size for indexing (100MB)
 */
const MAX_RECOMMENDED_INDEX_FILE_SIZE =
  RECOMMENDED_INDEX_MB * BYTES_PER_KB * KB_PER_MB;

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
  private logger = LogManager.getLogger('SemanticValidator');

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
      const result = this.executeValidationRule(rule, config);

      // Filter results by severity
      if (rule.severity === 'error') {
        errors.push(...result.errors);
      } else if (rule.severity === 'warning') {
        warnings.push(...result.warnings);
      }

      // Always include warnings from error rules
      warnings.push(...result.warnings);
    }

    // Log validation failures
    if (errors.length > 0) {
      this.logger.warn('Semantic validation completed with errors', {
        errorCount: errors.length,
        warningCount: warnings.length,
        errorCodes: errors.map(e => e.code),
      });
    } else if (warnings.length > 0) {
      this.logger.info('Semantic validation completed with warnings', {
        warningCount: warnings.length,
        warningCodes: warnings.map(w => w.code),
      });
    } else {
      this.logger.debug('Semantic validation completed successfully');
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
    this.rules = this.rules.filter(rule => rule.name !== name);
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
    this.addDatabaseRules();
    this.addIndexingRules();
    this.addSearchRules();
    this.addWatchingRules();
    this.addSecurityRules();
    this.addLanguageRules();
    this.addLoggingRules();
    this.addDependencyRules();
  }

  /**
   * Create configuration errors using ErrorFactory for consistency
   */
  private createConfigurationError(
    code: string,
    message: string,
    options: {
      path?: string;
      suggestions?: string[];
      operation?: string;
      cause?: Error;
    } = {},
  ): ConfigurationError {
    // Use ErrorFactory for consistent error creation
    return ErrorFactory.configuration(
      code,
      message,
      options,
    ) as ConfigurationError;
  }

  /**
   * Migrate legacy errors to ServiceError format
   */
  private migrateLegacyError(
    error: Error,
    operation?: string,
  ): ConfigurationError {
    try {
      const migrationResult = ErrorMigration.migrateError(
        error,
        operation ?? 'semantic_validation',
      );

      if (migrationResult.wasLegacy) {
        this.logger.debug('Migrated legacy error in semantic validation', {
          originalType: migrationResult.originalType,
          operation,
        });
      }

      // Ensure we return a ConfigurationError
      if (migrationResult.migrated instanceof ConfigurationError) {
        return migrationResult.migrated;
      }

      // If migration resulted in a different error type, wrap it
      return this.createConfigurationError(
        'LEGACY_ERROR_MIGRATION',
        `Migrated error: ${migrationResult.migrated.message}`,
        {
          operation: operation ?? 'semantic_validation',
          cause: migrationResult.migrated,
        },
      );
    } catch (migrationError) {
      // If migration fails, create a safe fallback error
      this.logger.warn('Error migration failed, creating fallback error', {
        migrationError:
          migrationError instanceof Error
            ? migrationError.message
            : String(migrationError),
        originalError: error.message,
      });

      return this.createConfigurationError(
        'MIGRATION_FAILED',
        'Failed to migrate legacy error, using fallback',
        {
          operation: operation ?? 'semantic_validation',
          cause: error,
        },
      );
    }
  }

  /**
   * Safely execute validation rules with error migration support
   */
  private executeValidationRule(
    rule: ValidationRule,
    config: PartialAppConfig,
  ): ValidationResult {
    try {
      return rule.validate(config);
    } catch (error) {
      // If rule execution fails, try to migrate the error
      const migratedError = this.migrateLegacyError(
        error instanceof Error ? error : new Error(String(error)),
        `rule_${rule.name}`,
      );

      this.logger.error(
        'Validation rule execution failed with migrated error',
        migratedError,
        {
          rule: rule.name,
          ruleDescription: rule.description,
          severity: rule.severity,
        },
      );

      // Re-throw the migrated error
      throw migratedError;
    }
  }

  /**
   * Add database-related validation rules
   */
  private addDatabaseRules(): void {
    if (this.options.checkDependencies) {
      this.addRule({
        name: 'database-consistency',
        description: 'Validate database configuration consistency',
        severity: 'error',
        validate: config => this.validateDatabaseConsistency(config),
      });
    }
  }

  /**
   * Add indexing-related validation rules
   */
  private addIndexingRules(): void {
    if (this.options.checkPerformance) {
      this.addRule({
        name: 'indexing-performance',
        description: 'Validate indexing configuration for performance',
        severity: 'warning',
        validate: config => this.validateIndexingPerformance(config),
      });
    }
  }

  /**
   * Add search-related validation rules
   */
  private addSearchRules(): void {
    this.addRule({
      name: 'search-logic',
      description: 'Validate search configuration logic',
      severity: 'error',
      validate: config => this.validateSearchLogic(config),
    });
  }

  /**
   * Add file watching validation rules
   */
  private addWatchingRules(): void {
    this.addRule({
      name: 'watching-configuration',
      description: 'Validate file watching configuration',
      severity: 'warning',
      validate: config => this.validateWatchingConfiguration(config),
    });
  }

  /**
   * Add security validation rules
   */
  private addSecurityRules(): void {
    if (this.options.checkSecurity) {
      this.addRule({
        name: 'security-configuration',
        description: 'Validate security configuration',
        severity: 'error',
        validate: config => this.validateSecurityConfiguration(config),
      });
    }
  }

  /**
   * Add language configuration validation rules
   */
  private addLanguageRules(): void {
    this.addRule({
      name: 'language-configuration',
      description: 'Validate language configuration',
      severity: 'error',
      validate: config => this.validateLanguageConfiguration(config),
    });
  }

  /**
   * Add logging validation rules
   */
  private addLoggingRules(): void {
    this.addRule({
      name: 'logging-configuration',
      description: 'Validate logging configuration',
      severity: 'warning',
      validate: config => this.validateLoggingConfiguration(config),
    });
  }

  /**
   * Add cross-section dependency validation rules
   */
  private addDependencyRules(): void {
    if (this.options.checkDependencies) {
      this.addRule({
        name: 'cross-section-dependencies',
        description: 'Validate dependencies between configuration sections',
        severity: 'error',
        validate: config => this.validateCrossSectionDependencies(config),
      });
    }
  }

  /**
   * Validate database type consistency
   */
  private validateDatabaseTypeConsistency(
    database: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const db = database as Partial<DatabaseConfig>;
    if (db.type === 'sqlite' && db.connectionString) {
      warnings.push({
        path: 'database.connectionString',
        message: 'connectionString is ignored for SQLite databases',
        code: 'IGNORED_SETTING',
      });
    }

    if (db.type !== 'sqlite' && !db.connectionString) {
      errors.push({
        path: 'database.connectionString',
        message: `connectionString is required for ${db.type} databases`,
        code: 'MISSING_CONNECTION_STRING',
        suggestion: 'Provide a valid connection string for the database',
      });
    }
  }

  /**
   * Validate database connection limits
   */
  private validateConnectionLimits(
    database: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const db = database as Partial<DatabaseConfig>;
    if (db.maxConnections && db.maxConnections < 1) {
      errors.push({
        path: 'database.maxConnections',
        message: 'maxConnections must be at least 1',
        code: 'INVALID_CONNECTION_LIMIT',
        suggestion: 'Set maxConnections to a positive integer',
      });
    }

    if (db.maxConnections && db.maxConnections > MAX_RECOMMENDED_CONNECTIONS) {
      warnings.push({
        path: 'database.maxConnections',
        message: 'High maxConnections may impact performance',
        code: 'HIGH_CONNECTION_LIMIT',
        suggestion:
          'Consider reducing maxConnections or implementing connection pooling',
      });
    }
  }

  /**
   * Validate database connection timeout
   */
  private validateConnectionTimeout(
    database: unknown,
    warnings: ValidationWarning[],
  ): void {
    const db = database as Partial<DatabaseConfig>;
    if (db.connectionTimeout && db.connectionTimeout < MIN_TIMEOUT_MS) {
      warnings.push({
        path: 'database.connectionTimeout',
        message: 'Very low connection timeout may cause frequent failures',
        code: 'LOW_TIMEOUT',
        suggestion: 'Consider increasing connectionTimeout to at least 1000ms',
      });
    }
  }

  /**
   * Validate database configuration consistency
   */
  private validateDatabaseConsistency(
    config: PartialAppConfig,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.database) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { database } = config;

    this.validateDatabaseTypeConsistency(database, errors, warnings);
    this.validateConnectionLimits(database, errors, warnings);
    this.validateConnectionTimeout(database, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate worker to batch size ratio
   */
  private validateWorkerBatchRatio(
    indexing: unknown,
    warnings: ValidationWarning[],
  ): void {
    const idx = indexing as Partial<IndexingConfig>;
    if (idx.maxWorkers && idx.batchSize) {
      if (idx.maxWorkers > idx.batchSize) {
        warnings.push({
          path: 'indexing.maxWorkers',
          message: 'maxWorkers greater than batchSize may be inefficient',
          code: 'INEFFICIENT_WORKER_RATIO',
          suggestion: 'Consider increasing batchSize or reducing maxWorkers',
        });
      }
    }
  }

  /**
   * Validate file size limits
   */
  private validateFileSizeLimits(
    indexing: IndexingConfig,
    warnings: ValidationWarning[],
  ): void {
    if (
      indexing.maxFileSize &&
      indexing.maxFileSize > MAX_RECOMMENDED_INDEX_FILE_SIZE
    ) {
      warnings.push({
        path: 'indexing.maxFileSize',
        message: 'Large maxFileSize may impact indexing performance',
        code: 'LARGE_FILE_SIZE',
        suggestion: 'Consider reducing maxFileSize or implementing streaming',
      });
    }
  }

  /**
   * Validate debounce timing
   */
  private validateDebounceTiming(
    indexing: IndexingConfig,
    warnings: ValidationWarning[],
  ): void {
    if (
      indexing.debounceMs &&
      indexing.debounceMs > MAX_RECOMMENDED_FILE_SIZE
    ) {
      warnings.push({
        path: 'indexing.debounceMs',
        message: 'High debounce delay may slow down indexing updates',
        code: 'HIGH_DEBOUNCE',
        suggestion: 'Consider reducing debounceMs for more responsive indexing',
      });
    }
  }

  /**
   * Validate depth limits
   */
  private validateDepthLimits(
    indexing: IndexingConfig,
    warnings: ValidationWarning[],
  ): void {
    if (indexing.maxDepth && indexing.maxDepth > MAX_RECOMMENDED_DEPTH) {
      warnings.push({
        path: 'indexing.maxDepth',
        message: 'Very deep directory traversal may be slow',
        code: 'DEEP_TRAVERSAL',
        suggestion: 'Consider reducing maxDepth or using ignore patterns',
      });
    }
  }

  /**
   * Validate indexing configuration for performance
   */
  private validateIndexingPerformance(
    config: PartialAppConfig,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.indexing) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { indexing } = config;

    this.validateWorkerBatchRatio(indexing, warnings);
    this.validateFileSizeLimits(indexing, warnings);
    this.validateDebounceTiming(indexing, warnings);
    this.validateDepthLimits(indexing, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate search limits consistency
   */
  private validateSearchLimits(
    search: SearchConfig,
    errors: ValidationError[],
  ): void {
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
  }

  /**
   * Validate fuzzy threshold range
   */
  private validateFuzzyThreshold(
    search: SearchConfig,
    errors: ValidationError[],
  ): void {
    if (search.fuzzyThreshold < 0 || search.fuzzyThreshold > 1) {
      errors.push({
        path: 'search.fuzzyThreshold',
        message: 'fuzzyThreshold must be between 0 and 1',
        code: 'INVALID_FUZZY_THRESHOLD',
        suggestion: 'Set fuzzyThreshold to a value between 0 and 1',
      });
    }
  }

  /**
   * Validate scoring weights
   */
  private validateScoringWeights(
    search: SearchConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const weights = Object.values(search.scoringWeights) as number[];
    const totalWeight = weights.reduce(
      (sum: number, weight: number) => sum + weight,
      0,
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

  /**
   * Validate search timeout
   */
  private validateSearchTimeout(
    search: SearchConfig,
    warnings: ValidationWarning[],
  ): void {
    if (search.timeoutMs && search.timeoutMs < MIN_TIMEOUT_MS) {
      warnings.push({
        path: 'search.timeoutMs',
        message: 'Very low search timeout may cause premature failures',
        code: 'LOW_SEARCH_TIMEOUT',
        suggestion: 'Consider increasing timeoutMs to at least 1000ms',
      });
    }
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

    this.validateSearchLimits(search, errors);
    this.validateFuzzyThreshold(search, errors);
    this.validateScoringWeights(search, errors, warnings);
    this.validateSearchTimeout(search, warnings);

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
    config: PartialAppConfig,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.watching) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { watching } = config;

    this.validateWatchingPatterns(watching, warnings);
    this.validateWatchingTiming(watching, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate watching patterns for conflicts
   */
  private validateWatchingPatterns(
    watching: WatchingConfig,
    warnings: ValidationWarning[],
  ): void {
    const conflicts = watching.ignorePatterns.filter((pattern: string) =>
      watching.includePatterns.includes(pattern),
    );

    if (conflicts.length > 0) {
      warnings.push({
        path: 'watching.ignorePatterns',
        message: `Patterns in both ignore and include: ${conflicts.join(', ')}`,
        code: 'CONFLICTING_PATTERNS',
        suggestion: 'Remove conflicting patterns from ignore or include lists',
      });
    }
  }

  /**
   * Validate watching timing configurations
   */
  private validateWatchingTiming(
    watching: WatchingConfig,
    warnings: ValidationWarning[],
  ): void {
    // Check polling interval
    if (
      watching.pollingInterval &&
      watching.pollingInterval < MIN_POLLING_INTERVAL_MS
    ) {
      warnings.push({
        path: 'watching.pollingInterval',
        message: 'Very low polling interval may impact performance',
        code: 'HIGH_POLLING_FREQUENCY',
        suggestion: 'Consider increasing pollingInterval to reduce CPU usage',
      });
    }

    // Check debounce timing
    if (watching.debounceMs && watching.debounceMs > MAX_DEBOUNCE_MS) {
      warnings.push({
        path: 'watching.debounceMs',
        message: 'High debounce delay may slow down file change detection',
        code: 'HIGH_WATCH_DEBOUNCE',
        suggestion: 'Consider reducing debounceMs for more responsive watching',
      });
    }
  }

  /**
   * Validate extensions and patterns
   */
  private validateExtensionsAndPatterns(
    security: SecurityConfig,
    warnings: ValidationWarning[],
  ): void {
    if (security.allowedExtensions.length === 0) {
      warnings.push({
        path: 'security.allowedExtensions',
        message:
          'No allowed extensions specified - all files will be processed',
        code: 'NO_ALLOWED_EXTENSIONS',
        suggestion: 'Specify allowed extensions for better security',
      });
    }

    if (security.blockedPatterns.length === 0) {
      warnings.push({
        path: 'security.blockedPatterns',
        message:
          'No blocked patterns specified - potentially unsafe files may be processed',
        code: 'NO_BLOCKED_PATTERNS',
        suggestion: 'Add blocked patterns for sensitive files',
      });
    }
  }

  /**
   * Validate path length limits
   */
  private validatePathLength(
    security: SecurityConfig,
    warnings: ValidationWarning[],
  ): void {
    if (security.maxPathLength > MAX_RECOMMENDED_DB_SIZE) {
      warnings.push({
        path: 'security.maxPathLength',
        message: 'Very high maxPathLength may allow path traversal attacks',
        code: 'HIGH_PATH_LENGTH',
        suggestion: 'Consider reducing maxPathLength to a reasonable value',
      });
    }
  }

  /**
   * Validate sandbox configuration
   */
  private validateSandboxConfiguration(
    security: SecurityConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    if (security.enableSandbox && !security.sandbox) {
      errors.push({
        path: 'security.sandbox',
        message: 'Sandbox is enabled but no sandbox configuration provided',
        code: 'MISSING_SANDBOX_CONFIG',
        suggestion: 'Provide sandbox configuration or disable sandbox',
      });
      return;
    }

    if (!security.sandbox) {
      return;
    }

    this.validateSandboxTimeout(security.sandbox, warnings);
    this.validateSandboxMemoryLimit(security.sandbox, warnings);
  }

  /**
   * Validate sandbox timeout configuration
   */
  private validateSandboxTimeout(
    sandbox: NonNullable<SecurityConfig['sandbox']>,
    warnings: ValidationWarning[],
  ): void {
    if (sandbox.timeoutMs && sandbox.timeoutMs < MIN_TIMEOUT_MS) {
      warnings.push({
        path: 'security.sandbox.timeoutMs',
        message:
          'Very low sandbox timeout may cause legitimate operations to fail',
        code: 'LOW_SANDBOX_TIMEOUT',
        suggestion: 'Consider increasing sandbox timeoutMs',
      });
    }
  }

  /**
   * Validate sandbox memory limit configuration
   */
  private validateSandboxMemoryLimit(
    sandbox: NonNullable<SecurityConfig['sandbox']>,
    warnings: ValidationWarning[],
  ): void {
    if (
      sandbox.memoryLimitMB &&
      sandbox.memoryLimitMB < MAX_RECOMMENDED_WORKERS
    ) {
      warnings.push({
        path: 'security.sandbox.memoryLimitMB',
        message: 'Very low memory limit may cause operations to fail',
        code: 'LOW_MEMORY_LIMIT',
        suggestion: 'Consider increasing memoryLimitMB',
      });
    }
  }

  /**
   * Validate security configuration
   */
  private validateSecurityConfiguration(
    config: PartialAppConfig,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.security) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { security } = config;

    this.validateExtensionsAndPatterns(security, warnings);
    this.validatePathLength(security, warnings);
    this.validateSandboxConfiguration(security, errors, warnings);

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
    config: PartialAppConfig,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.languages) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { languages } = config;

    // Check each language configuration
    for (const [langName, langConfig] of Object.entries(languages)) {
      this.validateLanguageConfig(langName, langConfig, errors);
    }

    // Check for duplicate extensions across all languages
    this.validateDuplicateExtensions(languages, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Validate individual language configuration
   */
  private validateLanguageConfig(
    langName: string,
    langConfig: LanguageConfig,
    errors: ValidationError[],
  ): void {
    if (langConfig.extensions.length === 0) {
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
  }

  /**
   * Validate for duplicate extensions across languages
   */
  private validateDuplicateExtensions(
    languages: Record<string, LanguageConfig>,
    warnings: ValidationWarning[],
  ): void {
    const allExtensions: string[] = [];
    for (const config of Object.values(languages)) {
      allExtensions.push(...config.extensions);
    }

    const duplicates = allExtensions.filter(
      (ext, index) => allExtensions.indexOf(ext) !== index,
    );
    if (duplicates.length > 0) {
      warnings.push({
        path: 'languages',
        message: `Duplicate file extensions: ${Array.from(new Set(duplicates)).join(', ')}`,
        code: 'DUPLICATE_EXTENSIONS',
        suggestion: 'Remove duplicate extensions from language configurations',
      });
    }
  }

  /**
   * Validate logging configuration
   */
  private validateLoggingConfiguration(
    config: PartialAppConfig,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.logging) {
      return { valid: true, errors: [], warnings: [], config };
    }

    const { logging } = config;

    // Check file logging configuration
    if (logging.file.enabled && !logging.file.path) {
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
   * Validate that watching and indexing are properly configured together
   */
  private validateWatchingIndexingDependency(
    config: PartialAppConfig,
    warnings: ValidationWarning[],
  ): void {
    if (config.watching?.enabled && !config.indexing) {
      warnings.push({
        path: 'watching.enabled',
        message: 'File watching enabled but indexing configuration not found',
        code: 'WATCHING_WITHOUT_INDEXING',
        suggestion: 'Configure indexing or disable file watching',
      });
    }
  }

  /**
   * Validate database path conflicts with file watching
   */
  private validateDatabaseWatchingConflict(
    config: PartialAppConfig,
    warnings: ValidationWarning[],
  ): void {
    if (config.database?.path && config.watching?.enabled) {
      const dbPath = config.database.path;
      const ignorePatterns = config.watching.ignorePatterns;

      const shouldIgnoreDb = ignorePatterns.some(
        pattern => dbPath.includes(pattern) || pattern.includes('database'),
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
  }

  /**
   * Validate search limits align with indexing batch size
   */
  private validateSearchIndexingLimits(
    config: PartialAppConfig,
    warnings: ValidationWarning[],
  ): void {
    if (config.search?.maxLimit && config.indexing?.batchSize) {
      if (
        config.search.maxLimit >
        config.indexing.batchSize * SEARCH_LIMIT_MULTIPLIER
      ) {
        warnings.push({
          path: 'search.maxLimit',
          message: 'Search limit much higher than indexing batch size',
          code: 'MISMATCHED_LIMITS',
          suggestion:
            'Consider aligning search limits with indexing configuration',
        });
      }
    }
  }

  /**
   * Validate cross-section dependencies
   */
  private validateCrossSectionDependencies(
    config: PartialAppConfig,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateWatchingIndexingDependency(config, warnings);
    this.validateDatabaseWatchingConflict(config, warnings);
    this.validateSearchIndexingLimits(config, warnings);

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
  options?: SemanticValidatorOptions,
): SemanticValidator {
  return new SemanticValidator(options);
}

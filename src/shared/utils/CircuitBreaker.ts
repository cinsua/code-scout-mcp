import { ServiceError } from '../errors/ServiceError';
import {
  getCircuitBreakerConstant,
  getTimeout,
} from '../errors/ErrorConstants';

// Concrete implementation of ServiceError for circuit breaker use
class ConcreteServiceError extends ServiceError {
  constructor(type: string, code: string, message: string, options?: any) {
    super(type, code, message, options);
  }
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  successThreshold: number;
  timeout?: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  failureRate: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  stateChanges: number;
  uptime: number;
}

/**
 * Circuit breaker pattern implementation for service protection.
 * Prevents cascade failures by temporarily stopping calls to failing services.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private stateChanges = 0;
  private startTime = Date.now();
  private successHistory: Array<number> = [];

  constructor(private options: CircuitBreakerOptions) {
    this.validateOptions();
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new ConcreteServiceError(
          'SERVICE',
          'CIRCUIT_BREAKER_OPEN',
          `Circuit breaker is open. Next attempt in ${this.getTimeUntilNextAttempt()}ms`,
          { retryable: false },
        );
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute operation with optional timeout
   */
  private executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.options.timeout) {
      return operation();
    }

    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          reject(
            new ConcreteServiceError(
              'TIMEOUT',
              'CIRCUIT_BREAKER_TIMEOUT',
              `Operation timed out after ${this.options.timeout}ms`,
              { retryable: true },
            ),
          );
        }, this.options.timeout),
      ),
    ]);
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get detailed statistics
   */
  getStats(): CircuitBreakerStats {
    const uptime = Date.now() - this.startTime;
    const failureRate =
      this.totalRequests > 0
        ? (this.failureCount / this.totalRequests) * 100
        : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChanges: this.stateChanges,
      uptime,
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    const previousState = this.state;
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.successHistory = [];

    if (previousState !== 'closed') {
      this.stateChanges++;
      if (this.options.onStateChange) {
        this.options.onStateChange(previousState, 'closed');
      }
    }
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(): void {
    this.transitionTo('open');
  }

  /**
   * Check if circuit breaker is currently closed (allowing requests)
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Check if circuit breaker is currently open (blocking requests)
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Check if circuit breaker is currently half-open (testing recovery)
   */
  isHalfOpen(): boolean {
    return this.state === 'half-open';
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    // Track success history for half-open state
    if (this.state === 'half-open') {
      this.successHistory.push(Date.now());

      // Keep only recent successes within monitoring period
      const cutoff = Date.now() - this.options.monitoringPeriod;
      this.successHistory = this.successHistory.filter(time => time > cutoff);
    }

    if (this.options.onSuccess) {
      this.options.onSuccess();
    }

    if (this.state === 'half-open') {
      if (this.successHistory.length >= this.options.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.options.onFailure) {
      this.options.onFailure(error);
    }

    if (this.state === 'closed') {
      if (this.failureCount >= this.options.failureThreshold) {
        this.transitionTo('open');
      }
    } else if (this.state === 'half-open') {
      this.transitionTo('open');
    }
  }

  /**
   * Check if circuit breaker should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.options.recoveryTimeout;
  }

  /**
   * Get time until next attempt is allowed
   */
  private getTimeUntilNextAttempt(): number {
    const timeSinceFailure = Date.now() - this.lastFailureTime;
    return Math.max(0, this.options.recoveryTimeout - timeSinceFailure);
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;
    this.stateChanges++;

    // Reset counters based on state transition
    if (newState === 'closed') {
      this.failureCount = 0;
      this.successHistory = [];
    } else if (newState === 'half-open') {
      this.successHistory = [];
    }

    if (this.options.onStateChange) {
      this.options.onStateChange(previousState, newState);
    }
  }

  /**
   * Validate circuit breaker options
   */
  private validateOptions(): void {
    if (this.options.failureThreshold <= 0) {
      throw new Error('failureThreshold must be greater than 0');
    }

    if (this.options.recoveryTimeout <= 0) {
      throw new Error('recoveryTimeout must be greater than 0');
    }

    if (this.options.monitoringPeriod <= 0) {
      throw new Error('monitoringPeriod must be greater than 0');
    }

    if (this.options.successThreshold <= 0) {
      throw new Error('successThreshold must be greater than 0');
    }
  }

  /**
   * Create circuit breaker with default options
   */
  static createDefault(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: getCircuitBreakerConstant('FAILURE_THRESHOLD'),
      recoveryTimeout: getCircuitBreakerConstant('RECOVERY_TIMEOUT'),
      monitoringPeriod: getCircuitBreakerConstant('MONITORING_PERIOD'),
      successThreshold: getCircuitBreakerConstant('SUCCESS_THRESHOLD'),
      timeout: getTimeout('CONNECTION'),
      onStateChange: (_from, _to) => {
        // Use proper logging instead of console
      },
    });
  }

  /**
   * Create circuit breaker for fast-failing services
   */
  static createFastFailing(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3, // Lower threshold for fast failing
      recoveryTimeout: getCircuitBreakerConstant('RECOVERY_TIMEOUT') / 2, // Faster recovery
      monitoringPeriod: getCircuitBreakerConstant('MONITORING_PERIOD') / 5, // Shorter monitoring
      successThreshold: 2, // Lower success threshold
      timeout: getTimeout('NETWORK'), // Shorter timeout
      onStateChange: (_from, _to) => {
        // State change logging removed - use proper logging in production
      },
    });
  }

  /**
   * Create circuit breaker for resilient services
   */
  static createResilient(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: getCircuitBreakerConstant('FAILURE_THRESHOLD') * 2, // Higher threshold
      recoveryTimeout: getCircuitBreakerConstant('RECOVERY_TIMEOUT') * 2, // Longer recovery
      monitoringPeriod: getCircuitBreakerConstant('MONITORING_PERIOD') * 2, // Longer monitoring
      successThreshold: getCircuitBreakerConstant('SUCCESS_THRESHOLD') * 2, // Higher success threshold
      timeout: getTimeout('DATABASE'), // Longer timeout
      onStateChange: (_from, _to) => {
        // Use proper logging instead of console
      },
    });
  }
}

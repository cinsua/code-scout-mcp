import { ServiceError, type ServiceErrorOptions } from './ServiceError';
import { ErrorType, NetworkErrorCodes } from './ErrorTypes';

export interface NetworkErrorContext {
  host?: string;
  port?: number;
  url?: string;
  protocol?: string;
  statusCode?: number;
  dnsError?: string;
  retryCount?: number;
  timeout?: number;
}

export interface NetworkErrorOptions extends ServiceErrorOptions {
  context?: NetworkErrorContext;
}

/**
 * Error thrown when network operations fail.
 * Provides detailed information about network failures including
 * hosts, ports, URLs, protocols, and status codes.
 */
export class NetworkError extends ServiceError {
  public override readonly context?: NetworkErrorContext;

  constructor(
    code: NetworkErrorCodes,
    message: string,
    options: NetworkErrorOptions = {},
  ) {
    super(ErrorType.NETWORK, code, message, {
      ...options,
      retryable: true, // Network errors are generally retryable
      retryAfter: options.retryAfter ?? 1000, // Default 1 second retry delay
    });

    this.context = options.context;
  }

  /**
   * Create a network error for connection refused
   */
  static connectionRefused(
    host: string,
    port?: number,
    retryCount?: number,
  ): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.CONNECTION_REFUSED,
      `Connection refused${host ? ` to ${host}` : ''}${port ? `:${port}` : ''}${retryCount ? ` after ${retryCount} attempts` : ''}`,
      {
        context: {
          host,
          port,
          retryCount,
        },
      },
    );
  }

  /**
   * Create a network error for connection timeout
   */
  static connectionTimeout(
    host: string,
    port?: number,
    timeout?: number,
  ): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.CONNECTION_TIMEOUT,
      `Connection timeout${host ? ` to ${host}` : ''}${port ? `:${port}` : ''}${timeout ? ` after ${timeout}ms` : ''}`,
      {
        context: {
          host,
          port,
          timeout,
        },
        retryAfter: 2000, // Longer retry delay for timeouts
      },
    );
  }

  /**
   * Create a network error for DNS resolution failure
   */
  static dnsResolutionFailed(
    hostname: string,
    dnsError?: string,
  ): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.DNS_RESOLUTION_FAILED,
      `DNS resolution failed for '${hostname}'${dnsError ? `: ${dnsError}` : ''}`,
      {
        context: {
          host: hostname,
          dnsError,
        },
        retryAfter: 5000, // Longer retry delay for DNS issues
      },
    );
  }

  /**
   * Create a network error for unreachable host
   */
  static hostUnreachable(host: string, port?: number): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.HOST_UNREACHABLE,
      `Host unreachable${host ? `: ${host}` : ''}${port ? `:${port}` : ''}`,
      {
        context: {
          host,
          port,
        },
      },
    );
  }

  /**
   * Create a network error for unreachable network
   */
  static networkUnreachable(network?: string): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.NETWORK_UNREACHABLE,
      `Network unreachable${network ? `: ${network}` : ''}`,
      {
        context: {},
        retryAfter: 10000, // Longer retry delay for network issues
      },
    );
  }

  /**
   * Create a network error for protocol errors
   */
  static protocolError(
    protocol: string,
    message: string,
    url?: string,
  ): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.PROTOCOL_ERROR,
      `Protocol error (${protocol}): ${message}${url ? ` for ${url}` : ''}`,
      {
        context: {
          protocol,
          url,
        },
      },
    );
  }

  /**
   * Create a network error for SSL/TLS errors
   */
  static sslError(message: string, host?: string, port?: number): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.SSL_ERROR,
      `SSL/TLS error${host ? ` for ${host}` : ''}${port ? `:${port}` : ''}: ${message}`,
      {
        context: {
          host,
          port,
          protocol: 'https',
        },
        retryAfter: 3000, // 3 second retry delay for SSL errors
      },
    );
  }

  /**
   * Create a network error for authentication failures
   */
  static authenticationFailed(resource: string, reason?: string): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.AUTHENTICATION_FAILED,
      `Authentication failed for ${resource}${reason ? `: ${reason}` : ''}`,
      {
        context: {
          url: resource,
        },
        retryable: false, // Authentication errors are not retryable
      },
    );
  }

  /**
   * Create a network error for rate limiting
   */
  static rateLimited(
    resource: string,
    retryAfter?: number,
    statusCode?: number,
  ): NetworkError {
    return new NetworkError(
      NetworkErrorCodes.RATE_LIMITED,
      `Rate limited for ${resource}${statusCode ? ` (status: ${statusCode})` : ''}`,
      {
        context: {
          url: resource,
          statusCode,
        },
        retryAfter: retryAfter ?? 60000, // Default 1 minute retry for rate limiting
      },
    );
  }

  /**
   * Get the host associated with this error
   */
  public getHost(): string | undefined {
    return this.context?.host;
  }

  /**
   * Get the port associated with this error
   */
  public getPort(): number | undefined {
    return this.context?.port;
  }

  /**
   * Get the URL associated with this error
   */
  public getURL(): string | undefined {
    return this.context?.url;
  }

  /**
   * Get the protocol associated with this error
   */
  public getProtocol(): string | undefined {
    return this.context?.protocol;
  }

  /**
   * Get the HTTP status code associated with this error
   */
  public getStatusCode(): number | undefined {
    return this.context?.statusCode;
  }

  /**
   * Get the DNS error message
   */
  public getDNSError(): string | undefined {
    return this.context?.dnsError;
  }

  /**
   * Get the number of retry attempts
   */
  public getRetryCount(): number | undefined {
    return this.context?.retryCount;
  }

  /**
   * Get the timeout duration
   */
  public getTimeout(): number | undefined {
    return this.context?.timeout;
  }

  /**
   * Check if this error is related to a specific host
   */
  public isHostError(host: string): boolean {
    return this.context?.host === host;
  }

  /**
   * Check if this error is related to a specific URL
   */
  public isURLError(url: string): boolean {
    return this.context?.url === url;
  }

  /**
   * Check if this error is related to a specific protocol
   */
  public isProtocolError(protocol: string): boolean {
    return this.context?.protocol === protocol;
  }

  /**
   * Get a formatted host:port string
   */
  public getHostPort(): string {
    if (this.context?.host) {
      const port = this.context.port;
      return port ? `${this.context.host}:${port}` : this.context.host;
    }
    return '';
  }

  /**
   * Convert to user-friendly string with network information
   */
  public override toUserString(): string {
    let result = super.toUserString();

    const hostPort = this.getHostPort();
    if (hostPort) {
      result += `\n  Host: ${hostPort}`;
    }

    if (this.context?.url) {
      result += `\n  URL: ${this.context.url}`;
    }

    if (this.context?.protocol) {
      result += `\n  Protocol: ${this.context.protocol}`;
    }

    if (this.context?.statusCode) {
      result += `\n  Status code: ${this.context.statusCode}`;
    }

    if (this.context?.dnsError) {
      result += `\n  DNS error: ${this.context.dnsError}`;
    }

    if (this.context?.retryCount) {
      result += `\n  Retry attempts: ${this.context.retryCount}`;
    }

    if (this.context?.timeout) {
      result += `\n  Timeout: ${this.context.timeout}ms`;
    }

    return result;
  }
}

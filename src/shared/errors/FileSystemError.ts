import {
  ServiceError,
  type ServiceErrorOptions,
} from '@/shared/errors/ServiceError';
import { ErrorType, FileSystemErrorCodes } from '@/shared/errors/ErrorTypes';

export interface FileSystemErrorContext {
  filePath?: string;
  directory?: string;
  operation?: string;
  permissions?: string;
  errorCode?: number;
  diskSpace?: number;
  fileSize?: number;
}

export interface FileSystemErrorOptions extends ServiceErrorOptions {
  context?: FileSystemErrorContext;
}

/**
 * Error thrown when file system operations fail.
 * Provides detailed information about file system failures including
 * paths, operations, permissions, and disk space information.
 */
export class FileSystemError extends ServiceError {
  public override readonly context?: FileSystemErrorContext;

  constructor(
    code: FileSystemErrorCodes,
    message: string,
    options: FileSystemErrorOptions = {},
  ) {
    super(ErrorType.FILESYSTEM, code, message, {
      ...options,
      retryable: code === FileSystemErrorCodes.IO_ERROR, // Only IO errors are retryable
    });

    this.context = options.context;
  }

  /**
   * Create a file system error for file not found
   */
  static fileNotFound(filePath: string, operation?: string): FileSystemError {
    return new FileSystemError(
      FileSystemErrorCodes.FILE_NOT_FOUND,
      `File not found: ${filePath}${operation ? ` during ${operation}` : ''}`,
      {
        context: {
          filePath,
          operation,
        },
      },
    );
  }

  /**
   * Create a file system error for permission denied
   */
  static permissionDenied(
    path: string,
    operation: string,
    permissions?: string,
  ): FileSystemError {
    return new FileSystemError(
      FileSystemErrorCodes.PERMISSION_DENIED,
      `Permission denied${operation ? ` for ${operation}` : ''}: ${path}`,
      {
        context: {
          filePath: path,
          operation,
          permissions,
        },
      },
    );
  }

  /**
   * Create a file system error for file already exists
   */
  static fileExists(filePath: string, operation?: string): FileSystemError {
    return new FileSystemError(
      FileSystemErrorCodes.FILE_EXISTS,
      `File already exists: ${filePath}${operation ? ` during ${operation}` : ''}`,
      {
        context: {
          filePath,
          operation,
        },
      },
    );
  }

  /**
   * Create a file system error for invalid path
   */
  static invalidPath(
    path: string,
    reason?: string,
    operation?: string,
  ): FileSystemError {
    return new FileSystemError(
      FileSystemErrorCodes.INVALID_PATH,
      `Invalid path: ${path}${reason ? ` (${reason})` : ''}${operation ? ` during ${operation}` : ''}`,
      {
        context: {
          filePath: path,
          operation,
        },
      },
    );
  }

  /**
   * Create a file system error for disk full
   */
  static diskFull(
    path?: string,
    requiredSpace?: number,
    availableSpace?: number,
  ): FileSystemError {
    const message = `Disk full${requiredSpace ? ` (required: ${requiredSpace} bytes)` : ''}${availableSpace ? ` (available: ${availableSpace} bytes)` : ''}`;

    return new FileSystemError(FileSystemErrorCodes.DISK_FULL, message, {
      context: {
        filePath: path,
        diskSpace: availableSpace,
      },
      retryable: false, // Disk full is not retryable
    });
  }

  /**
   * Create a file system error for general I/O errors
   */
  static ioError(
    message: string,
    filePath?: string,
    operation?: string,
    errorCode?: number,
  ): FileSystemError {
    return new FileSystemError(
      FileSystemErrorCodes.IO_ERROR,
      `I/O error${operation ? ` during ${operation}` : ''}${filePath ? `: ${filePath}` : ''}: ${message}`,
      {
        context: {
          filePath,
          operation,
          errorCode,
        },
      },
    );
  }

  /**
   * Create a file system error for directory not found
   */
  static directoryNotFound(
    directory: string,
    operation?: string,
  ): FileSystemError {
    return new FileSystemError(
      FileSystemErrorCodes.DIRECTORY_NOT_FOUND,
      `Directory not found: ${directory}${operation ? ` during ${operation}` : ''}`,
      {
        context: {
          directory,
          operation,
        },
      },
    );
  }

  /**
   * Create a file system error for path not being a directory
   */
  static notADirectory(path: string, operation?: string): FileSystemError {
    return new FileSystemError(
      FileSystemErrorCodes.NOT_A_DIRECTORY,
      `Path is not a directory: ${path}${operation ? ` during ${operation}` : ''}`,
      {
        context: {
          directory: path,
          operation,
        },
      },
    );
  }

  /**
   * Create a file system error for path not being a file
   */
  static notAFile(path: string, operation?: string): FileSystemError {
    return new FileSystemError(
      FileSystemErrorCodes.NOT_A_FILE,
      `Path is not a file: ${path}${operation ? ` during ${operation}` : ''}`,
      {
        context: {
          filePath: path,
          operation,
        },
      },
    );
  }

  /**
   * Get the file path associated with this error
   */
  public getFilePath(): string | undefined {
    return this.context?.filePath;
  }

  /**
   * Get the directory associated with this error
   */
  public getDirectory(): string | undefined {
    return this.context?.directory;
  }

  /**
   * Get the operation that failed
   */
  public getOperation(): string | undefined {
    return this.context?.operation;
  }

  /**
   * Get the permissions information
   */
  public getPermissions(): string | undefined {
    return this.context?.permissions;
  }

  /**
   * Get the system error code
   */
  public getErrorCode(): number | undefined {
    return this.context?.errorCode;
  }

  /**
   * Get the available disk space
   */
  public getDiskSpace(): number | undefined {
    return this.context?.diskSpace;
  }

  /**
   * Get the file size
   */
  public getFileSize(): number | undefined {
    return this.context?.fileSize;
  }

  /**
   * Check if this error is related to a specific file
   */
  public isFileError(filePath: string): boolean {
    return this.context?.filePath === filePath;
  }

  /**
   * Check if this error is related to a specific directory
   */
  public isDirectoryError(directory: string): boolean {
    return this.context?.directory === directory;
  }

  /**
   * Check if this error is related to a specific operation
   */
  public isOperationError(operation: string): boolean {
    return this.context?.operation === operation;
  }

  /**
   * Convert to user-friendly string with file system information
   */
  public override toUserString(): string {
    let result = super.toUserString();

    if (this.context?.filePath) {
      result += `\n  File: ${this.context.filePath}`;
    }

    if (this.context?.directory) {
      result += `\n  Directory: ${this.context.directory}`;
    }

    if (this.context?.operation) {
      result += `\n  Operation: ${this.context.operation}`;
    }

    if (this.context?.permissions) {
      result += `\n  Permissions: ${this.context.permissions}`;
    }

    if (this.context?.errorCode) {
      result += `\n  Error code: ${this.context.errorCode}`;
    }

    if (this.context?.diskSpace) {
      result += `\n  Available disk space: ${this.context.diskSpace} bytes`;
    }

    return result;
  }
}

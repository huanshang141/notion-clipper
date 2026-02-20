/**
 * Error Codes and Messages
 * Centralized error definitions for the extension
 */

export const ERROR_CODES = {
  // Authentication errors
  AUTH_INVALID_FORMAT: 'ERR_AUTH_INVALID_FORMAT',
  AUTH_INVALID_KEY: 'ERR_AUTH_INVALID_KEY',
  AUTH_EXPIRED: 'ERR_AUTH_EXPIRED',
  AUTH_UNAUTHORIZED: 'ERR_AUTH_UNAUTHORIZED',
  AUTH_NOT_FOUND: 'ERR_AUTH_NOT_FOUND',

  // Network errors
  NET_TIMEOUT: 'ERR_NET_TIMEOUT',
  NET_OFFLINE: 'ERR_NET_OFFLINE',
  NET_CORS: 'ERR_NET_CORS',
  NET_REQUEST_FAILED: 'ERR_NET_REQUEST_FAILED',

  // Notion API errors
  NOTION_RATE_LIMIT: 'ERR_NOTION_RATE_LIMIT',
  NOTION_NOT_FOUND: 'ERR_NOTION_NOT_FOUND',
  NOTION_INVALID_DATABASE: 'ERR_NOTION_INVALID_DATABASE',
  NOTION_INVALID_PROPERTY: 'ERR_NOTION_INVALID_PROPERTY',
  NOTION_PAGE_CREATE_FAILED: 'ERR_NOTION_PAGE_CREATE_FAILED',

  // Content extraction errors
  EXTRACT_NO_CONTENT: 'ERR_EXTRACT_NO_CONTENT',
  EXTRACT_FAILED: 'ERR_EXTRACT_FAILED',
  EXTRACT_TIMEOUT: 'ERR_EXTRACT_TIMEOUT',

  // Image errors
  IMG_DOWNLOAD_FAILED: 'ERR_IMG_DOWNLOAD_FAILED',
  IMG_SIZE_EXCEEDED: 'ERR_IMG_SIZE_EXCEEDED',
  IMG_INVALID_URL: 'ERR_IMG_INVALID_URL',
  IMG_PROCESSING_FAILED: 'ERR_IMG_PROCESSING_FAILED',

  // Validation errors
  VALIDATION_MISSING_FIELD: 'ERR_VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_TYPE: 'ERR_VALIDATION_INVALID_TYPE',
  VALIDATION_INVALID_FORMAT: 'ERR_VALIDATION_INVALID_FORMAT',

  // General errors
  UNKNOWN_ERROR: 'ERR_UNKNOWN_ERROR',
  NOT_IMPLEMENTED: 'ERR_NOT_IMPLEMENTED',
};

export const ERROR_MESSAGES: Record<string, string> = {
  // Authentication
  [ERROR_CODES.AUTH_INVALID_FORMAT]: 'API key format is invalid. Please ensure it starts with "ntn_"',
  [ERROR_CODES.AUTH_INVALID_KEY]: 'The API key is invalid or incorrect',
  [ERROR_CODES.AUTH_EXPIRED]: 'Your API key has expired. Please provide a new one',
  [ERROR_CODES.AUTH_UNAUTHORIZED]: 'You are not authorized to perform this action',
  [ERROR_CODES.AUTH_NOT_FOUND]: 'Authentication credentials not found',

  // Network
  [ERROR_CODES.NET_TIMEOUT]: 'Request timed out. Please check your internet connection',
  [ERROR_CODES.NET_OFFLINE]: 'You are offline. Please check your internet connection',
  [ERROR_CODES.NET_CORS]: 'Cross-origin request blocked. Please try again',
  [ERROR_CODES.NET_REQUEST_FAILED]: 'Network request failed. Please try again',

  // Notion API
  [ERROR_CODES.NOTION_RATE_LIMIT]: 'Notion API rate limit exceeded. Please wait a moment and try again',
  [ERROR_CODES.NOTION_NOT_FOUND]: 'The requested resource was not found in Notion',
  [ERROR_CODES.NOTION_INVALID_DATABASE]: 'The selected database is invalid or no longer exists',
  [ERROR_CODES.NOTION_INVALID_PROPERTY]: 'One or more database properties are invalid',
  [ERROR_CODES.NOTION_PAGE_CREATE_FAILED]: 'Failed to create page in Notion. Please check your database settings',

  // Content extraction
  [ERROR_CODES.EXTRACT_NO_CONTENT]: 'Could not extract content from this page',
  [ERROR_CODES.EXTRACT_FAILED]: 'Content extraction failed. The page might not be supported',
  [ERROR_CODES.EXTRACT_TIMEOUT]: 'Content extraction timed out',

  // Image
  [ERROR_CODES.IMG_DOWNLOAD_FAILED]: 'Failed to download image',
  [ERROR_CODES.IMG_SIZE_EXCEEDED]: 'Image is too large (max 5MB)',
  [ERROR_CODES.IMG_INVALID_URL]: 'Invalid image URL',
  [ERROR_CODES.IMG_PROCESSING_FAILED]: 'Image processing failed',

  // Validation
  [ERROR_CODES.VALIDATION_MISSING_FIELD]: 'Required field is missing',
  [ERROR_CODES.VALIDATION_INVALID_TYPE]: 'Invalid data type',
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Invalid format',

  // General
  [ERROR_CODES.UNKNOWN_ERROR]: 'An unknown error occurred',
  [ERROR_CODES.NOT_IMPLEMENTED]: 'This feature is not yet implemented',
};

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, any>;

  constructor(
    code: string,
    message?: string,
    statusCode?: number,
    details?: Record<string, any>
  ) {
    const finalMessage = message || ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
    super(finalMessage);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Error handler for HTTP requests
 */
export function handleHttpError(status: number, statusText: string): AppError {
  if (status === 401) {
    return new AppError(
      ERROR_CODES.AUTH_UNAUTHORIZED,
      'Authentication failed. Please check your API key',
      status
    );
  }
  if (status === 429) {
    return new AppError(
      ERROR_CODES.NOTION_RATE_LIMIT,
      'API rate limit exceeded. Please wait a moment',
      status
    );
  }
  if (status === 404) {
    return new AppError(
      ERROR_CODES.NOTION_NOT_FOUND,
      'Resource not found',
      status
    );
  }
  if (status >= 500) {
    return new AppError(
      ERROR_CODES.NET_REQUEST_FAILED,
      `Server error: ${status} ${statusText}`,
      status
    );
  }
  if (status >= 400) {
    return new AppError(
      ERROR_CODES.NET_REQUEST_FAILED,
      `Request failed: ${status} ${statusText}`,
      status
    );
  }

  return new AppError(
    ERROR_CODES.UNKNOWN_ERROR,
    `Unexpected status: ${status}`,
    status
  );
}

/**
 * Convert fetch error to AppError
 */
export function handleFetchError(error: Error | unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const errorStr = String(error);

  if (errorStr.includes('network') || errorStr.includes('Failed to fetch')) {
    return new AppError(
      ERROR_CODES.NET_REQUEST_FAILED,
      'Network error occurred. Please check your internet connection'
    );
  }

  if (errorStr.includes('timeout') || errorStr.includes('Timeout')) {
    return new AppError(
      ERROR_CODES.NET_TIMEOUT,
      'Request timed out. Please try again'
    );
  }

  if (errorStr.includes('CORS') || errorStr.includes('cors')) {
    return new AppError(
      ERROR_CODES.NET_CORS,
      'Cross-origin request blocked'
    );
  }

  return new AppError(
    ERROR_CODES.UNKNOWN_ERROR,
    error instanceof Error ? error.message : 'Unknown error occurred'
  );
}

/**
 * Logger for debugging
 */
export class Logger {
  private static isDevelopment = true; // Set based on build

  static info(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, data || '');
    }
  }

  static warn(message: string, data?: any) {
    console.warn(`[WARN] ${message}`, data || '');
  }

  static error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error || '');
    if (error instanceof AppError) {
      console.error('  Error Code:', error.code);
      console.error('  Status Code:', error.statusCode);
      if (error.details) {
        console.error('  Details:', error.details);
      }
    }
  }

  static debug(message: string, data?: any) {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  }
}


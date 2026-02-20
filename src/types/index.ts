/**
 * Core type definitions for Notion Clipper
 */

/**
 * Extracted article content from a web page
 */
export interface ExtractedArticle {
  title: string;
  content: string; // Markdown format
  url: string;
  mainImage?: string; // URL or data URI for the main image
  images: ExtractedImage[];
  excerpt?: string;
  authorName?: string;
  publishDate?: string;
  domain?: string;
}

/**
 * Image metadata from extracted content
 */
export interface ExtractedImage {
  src: string; // Original URL
  alt?: string;
  width?: number;
  height?: number;
  isMainImage?: boolean;
}

/**
 * Authentication token and refresh info
 */
export interface NotionAuthToken {
  accessToken: string;
  tokenType: string;
  expiresAt?: number;
  refreshToken?: string;
  workspaceName?: string;
  workspaceId?: string;
  workspaceIcon?: string;
}

/**
 * User's Notion workspace info
 */
export interface NotionWorkspace {
  id: string;
  name: string;
  icon?: string;
}

/**
 * Notion database metadata
 */
export interface NotionDatabase {
  id: string;
  title: string;
  icon?: string;
  parent?: {
    type: 'workspace' | 'page';
    workspace_id?: string;
    page_id?: string;
  };
}

/**
 * Notion property (field) schema
 */
export interface NotionProperty {
  id: string;
  name: string;
  type: string;
  // Field-specific configurations stored here
  config?: Record<string, any>;
}

/**
 * Field mapping configuration
 * Maps extracted content fields to Notion database properties
 */
export interface FieldMapping {
  [notionPropertyId: string]: {
    propertyName: string;
    propertyType: string;
    sourceField?: string; // Which field from ExtractedArticle to use
    customValue?: any; // For constant values
    isRequired?: boolean;
    isEnabled?: boolean;
  };
}

/**
 * Popup saving form data
 */
export interface SaveFormData {
  databaseId: string;
  mappedFields: Record<string, any>; // property_id -> value
  shouldDownloadImages: boolean;
}

/**
 * Chrome runtime message structures
 */
export interface ChromeMessage<T = any> {
  action: string;
  data?: T;
  id?: string;
}

/**
 * Extract content message from popup to background
 */
export interface ExtractContentRequest extends ChromeMessage {
  action: 'EXTRACT_CONTENT';
  data: {
    url: string;
  };
}

/**
 * Extract response
 */
export interface ExtractContentResponse {
  success: boolean;
  article?: ExtractedArticle;
  error?: string;
}

/**
 * Save to Notion message
 */
export interface SaveToNotionRequest extends ChromeMessage {
  action: 'SAVE_TO_NOTION';
  data: {
    article: ExtractedArticle;
    databaseId: string;
    fieldMapping: Record<string, any>;
    shouldDownloadImages: boolean;
  };
}

/**
 * Auth status request/response
 */
export interface AuthStatusRequest extends ChromeMessage {
  action: 'GET_AUTH_STATUS';
}

export interface AuthStatusResponse {
  isAuthenticated: boolean;
  token?: NotionAuthToken;
  workspace?: NotionWorkspace;
  error?: string;
}

/**
 * Logout request
 */
export interface LogoutRequest extends ChromeMessage {
  action: 'LOGOUT';
}

/**
 * Get databases list request
 */
export interface GetDatabasesRequest extends ChromeMessage {
  action: 'GET_DATABASES';
  data?: {
    workspaceId?: string;
  };
}

export interface GetDatabasesResponse {
  databases: NotionDatabase[];
  error?: string;
}

/**
 * Get database schema request
 */
export interface GetDatabaseSchemaRequest extends ChromeMessage {
  action: 'GET_DATABASE_SCHEMA';
  data: {
    databaseId: string;
  };
}

export interface GetDatabaseSchemaResponse {
  properties: NotionProperty[];
  error?: string;
}

/**
 * Storage schema
 */
export interface StorageData {
  auth?: NotionAuthToken;
  lastWorkspace?: NotionWorkspace;
  lastDatabase?: NotionDatabase;
  fieldMappings?: Record<string, FieldMapping>; // database_id -> FieldMapping
  settings?: {
    autoDownloadImages?: boolean;
    debugMode?: boolean;
  };
}

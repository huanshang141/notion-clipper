/**
 * Application constants
 */

// Notion API Configuration
export const NOTION_API_BASE = 'https://api.notion.com/v1';
export const NOTION_API_VERSION = '2025-09-03';

/**
 * Authentication Configuration
 * Using Internal Integration Token model (API Key)
 * Users provide their own Notion Internal Integration token
 */
export const AUTH_CONFIG = {
  tokenType: 'internal_integration',
  apiKeyRequired: true,
} as const;

// Message Actions
export const MESSAGE_ACTIONS = {
  EXTRACT_CONTENT: 'EXTRACT_CONTENT',
  SAVE_TO_NOTION: 'SAVE_TO_NOTION',
  OPEN_EDITOR_WITH_ARTICLE: 'OPEN_EDITOR_WITH_ARTICLE',
  GET_EDITOR_DRAFT: 'GET_EDITOR_DRAFT',
  GET_AUTH_STATUS: 'GET_AUTH_STATUS',
  AUTHENTICATE: 'AUTHENTICATE',
  LOGOUT: 'LOGOUT',
  GET_DATABASES: 'GET_DATABASES',
  GET_DATABASE_SCHEMA: 'GET_DATABASE_SCHEMA',
  GET_AUTO_FIELD_MAPPING: 'GET_AUTO_FIELD_MAPPING',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  LAST_WORKSPACE: 'last_workspace',
  LAST_DATABASE: 'last_database',
  SETTINGS: 'settings',
} as const;

// Default Field Mappings
export const DEFAULT_NOTION_FIELD_TYPES = {
  TITLE: 'title',
  RICH_TEXT: 'rich_text',
  TEXT: 'text',
  URL: 'url',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  CHECKBOX: 'checkbox',
  DATE: 'date',
  FILES: 'files',
  RELATION: 'relation',
} as const;

// Common field name patterns for auto-detection
export const COMMON_FIELD_NAMES = {
  TITLE: ['title', 'name', 'heading', '标题', 'headline', 'subject', 'topic'],
  CONTENT: ['content', 'body', 'article', 'text', '内容', '正文', 'description', 'description', 'body_text', 'body_html'],
  URL: ['url', 'link', 'source', 'uri', '链接', '网址', 'page_url', 'web_url', 'page_link', 'ref'],
  COVER: ['cover', 'image', 'main_image', 'thumbnail', '封面', '图片', 'featured_image', 'hero_image', 'og_image'],
  TAG: ['tag', 'tags', 'category', 'categories', '标签', '分类', 'keywords', 'topic', 'subject'],
  AUTHOR: ['author', 'username', 'creator', '作者', 'writer', 'by_line', 'byline', 'publisher'],
  DATE: ['date', 'published_date', 'create_date', '日期', 'publish_time', 'publish_date', 'pub_date', 'posted_at', 'created_at'],
  EXCERPT: ['excerpt', 'summary', '摘要', 'abstract', 'description', 'preview'],
} as const;

// UI Constants
export const UI_CONSTANTS = {
  POPUP_WIDTH: 420,
  POPUP_HEIGHT: 560,
  LOADING_TIMEOUT: 10000,
  SAVE_TIMEOUT: 30000,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'Please authenticate with Notion first',
  NO_DATABASE_SELECTED: 'Please select a database',
  EXTRACTION_FAILED: 'Failed to extract page content',
  SAVE_FAILED: 'Failed to save to Notion',
  NETWORK_ERROR: 'Network error occurred',
  AUTH_FAILED: 'Authentication failed',
  INVALID_TOKEN: 'Invalid or expired token',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SAVED_TO_NOTION: 'Successfully saved to Notion!',
  AUTH_SUCCESS: 'Successfully authenticated',
  EXTRACTION_SUCCESS: 'Content extracted successfully',
} as const;

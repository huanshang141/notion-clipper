/**
 * Background Script (Service Worker)
 * Runs in the background and handles core extension logic
 */

import { MESSAGE_ACTIONS } from '../utils/constants';
import { sendToContentScript } from '../utils/ipc';
import AuthService from '../services/auth';
import NotionService from '../services/notion';
import ExtractService from '../services/extract';
import ImageService from '../services/image';
import StorageService from '../services/storage';
import {
  ChromeMessage,
  ExtractContentResponse,
  AuthStatusResponse,
  GetDatabasesResponse,
  GetDatabaseSchemaResponse,
} from '../types';

/**
 * Listen for messages from popup, content script, and options page
 */
chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
  // Handle each message type
  switch (message.action) {
    case MESSAGE_ACTIONS.EXTRACT_CONTENT:
      handleExtractContent(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.GET_AUTH_STATUS:
      handleGetAuthStatus(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.LOGOUT:
      handleLogout(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.GET_DATABASES:
      handleGetDatabases(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.GET_DATABASE_SCHEMA:
      handleGetDatabaseSchema(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.SAVE_TO_NOTION:
      handleSaveToNotion(message, sender, sendResponse);
      return true;

    default:
      return false;
  }
});

/**
 * Extract content from the current tab
 */
async function handleExtractContent(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtractContentResponse) => void
) {
  try {
    if (!sender.tab?.id) {
      throw new Error('Invalid tab context');
    }

    // Send extraction request to content script
    const contentResponse: any = await sendToContentScript(sender.tab.id, {
      action: 'EXTRACT_PAGE_CONTENT',
    });

    if (!contentResponse.success) {
      throw new Error(contentResponse.error || 'Failed to extract content');
    }

    // The content script returns the extracted article
    const article = contentResponse.article;

    // Ensure content is in Markdown format
    let markdown = article.content;
    if (article.content?.includes('<')) {
      // If HTML is returned, convert to Markdown via Readability
      // For now, use HTML as-is in a code block
      markdown = `${'```'}html\n${article.content}\n${'```'}`;
    }

    sendResponse({
      success: true,
      article: {
        ...article,
        content: markdown,
      },
    });
  } catch (error) {
    console.error('Extraction error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
    });
  }
}

/**
 * Get current authentication status
 */
async function handleGetAuthStatus(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: AuthStatusResponse) => void
) {
  try {
    const isAuthenticated = await AuthService.isAuthenticated();

    if (!isAuthenticated) {
      sendResponse({
        isAuthenticated: false,
      });
      return;
    }

    const token = await AuthService.getToken();
    if (!token) {
      sendResponse({
        isAuthenticated: false,
      });
      return;
    }

    const workspace = {
      id: token.workspaceId || '',
      name: token.workspaceName || 'My Workspace',
      icon: token.workspaceIcon,
    };

    sendResponse({
      isAuthenticated: true,
      token,
      workspace,
    });
  } catch (error) {
    console.error('Auth status error:', error);
    sendResponse({
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Failed to get auth status',
    });
  }
}

/**
 * Logout user
 */
async function handleLogout(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; error?: string }) => void
) {
  try {
    await AuthService.logout();
    NotionService.reset();

    sendResponse({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Logout failed',
    });
  }
}

/**
 * Get list of databases
 */
async function handleGetDatabases(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: GetDatabasesResponse) => void
) {
  try {
    const isAuthenticated = await AuthService.isAuthenticated();
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    const databases = await NotionService.listDatabases();
    sendResponse({ databases });
  } catch (error) {
    console.error('Get databases error:', error);
    sendResponse({
      databases: [],
      error: error instanceof Error ? error.message : 'Failed to get databases',
    });
  }
}

/**
 * Get database schema
 */
async function handleGetDatabaseSchema(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: GetDatabaseSchemaResponse) => void
) {
  try {
    const databaseId = message.data?.databaseId;
    if (!databaseId) {
      throw new Error('Database ID is required');
    }

    const properties = await NotionService.getDatabaseSchema(databaseId);
    sendResponse({ properties });
  } catch (error) {
    console.error('Get database schema error:', error);
    sendResponse({
      properties: [],
      error: error instanceof Error ? error.message : 'Failed to get database schema',
    });
  }
}

/**
 * Save article to Notion
 */
async function handleSaveToNotion(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; url?: string; error?: string }) => void
) {
  try {
    const { article, databaseId, fieldMapping, shouldDownloadImages } = message.data;

    if (!article || !databaseId) {
      throw new Error('Missing required parameters');
    }

    const isAuthenticated = await AuthService.isAuthenticated();
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    // Process images if requested
    let imagesMap: Record<string, string> = {};
    if (shouldDownloadImages && article.images?.length > 0) {
      try {
        imagesMap = await ImageService.processImagesForNotion(
          article.images,
          true
        );
      } catch (error) {
        console.error('Image processing failed:', error);
        // Continue without images
      }
    }

    // Create page in Notion
    const result = await NotionService.createPage(
      databaseId,
      article,
      fieldMapping,
      imagesMap
    );

    // Save last used database
    await StorageService.setLastDatabase(databaseId, `Database ${databaseId.slice(0, 8)}`);

    sendResponse({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error('Save to Notion error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save to Notion',
    });
  }
}

console.log('Notion Clipper background script loaded');

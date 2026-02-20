/**
 * Background Script (Service Worker)
 * Runs in the background and handles core extension logic
 */

import { MESSAGE_ACTIONS } from '../utils/constants';
import { sendToContentScript, getActiveTab } from '../utils/ipc';
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
  ExtractedImage,
  EditorDraft,
} from '../types';

console.log('[NotionClipper Background] Service Worker initialized');

/**
 * Listen for messages from popup, content script, and options page
 */
chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
  console.log('[NotionClipper Background] Message received:', {
    action: message.action,
    senderUrl: sender.url,
    senderId: sender.id,
  });
  
  // Handle each message type
  switch (message.action) {
    case MESSAGE_ACTIONS.EXTRACT_CONTENT:
      handleExtractContent(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.AUTHENTICATE:
      handleAuthenticate(message, sender, sendResponse);
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

    case MESSAGE_ACTIONS.GET_AUTO_FIELD_MAPPING:
      handleGetAutoFieldMapping(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.SAVE_TO_NOTION:
      handleSaveToNotion(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.OPEN_EDITOR_WITH_ARTICLE:
      handleOpenEditorWithArticle(message, sender, sendResponse);
      return true;

    case MESSAGE_ACTIONS.GET_EDITOR_DRAFT:
      handleGetEditorDraft(message, sender, sendResponse);
      return true;

    default:
      return false;
  }
});

/**
 * Authenticate user with API Key
 */
async function handleAuthenticate(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; token?: any; error?: string }) => void
) {
  try {
    const apiKey = message.data?.apiKey;
    if (!apiKey) {
      throw new Error('API key is required');
    }

    const token = await AuthService.authenticateWithApiKey(apiKey);

    sendResponse({
      success: true,
      token,
    });
  } catch (error) {
    console.error('Authentication error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
}

async function handleOpenEditorWithArticle(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; draftId?: string; error?: string }) => void
) {
  try {
    const article = message.data?.article;
    if (!article) {
      throw new Error('Article is required to open editor');
    }

    const draftId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const draft: EditorDraft = {
      id: draftId,
      article,
      selectedDatabaseId: message.data?.selectedDatabaseId,
      createdAt: Date.now(),
    };

    await StorageService.setEditorDraft(draft);

    const editorUrl = chrome.runtime.getURL(`dist/editor.html?draftId=${encodeURIComponent(draftId)}`);
    await chrome.tabs.create({ url: editorUrl });

    sendResponse({ success: true, draftId });
  } catch (error) {
    console.error('Open editor error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open editor',
    });
  }
}

async function handleGetEditorDraft(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; draft?: EditorDraft; error?: string }) => void
) {
  try {
    const draftId = message.data?.draftId;
    if (!draftId) {
      throw new Error('draftId is required');
    }

    const draft = await StorageService.getEditorDraft(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    sendResponse({ success: true, draft });
  } catch (error) {
    console.error('Get editor draft error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get editor draft',
    });
  }
}

/**
 * Extract content from the current tab
 */
async function handleExtractContent(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtractContentResponse) => void
) {
  try {
    console.log('[NotionClipper Background] Handling EXTRACT_CONTENT request');
    
    // Get the active tab (instead of relying on sender.tab which may be undefined from popup)
    const activeTab = await getActiveTab();
    
    if (!activeTab?.id) {
      throw new Error('No active tab found');
    }

    console.log('[NotionClipper Background] Active tab ID:', activeTab.id);

    // 1. Check if content script is loaded via PING
    let isContentScriptLoaded = false;
    try {
      console.log('[NotionClipper Background] Pinging content script...');
      const pingResponse = await sendToContentScript(activeTab.id, { action: 'PING' });
      if (pingResponse && pingResponse.success) {
        isContentScriptLoaded = true;
        console.log('[NotionClipper Background] Content script is already loaded.');
      }
    } catch (error) {
      console.log('[NotionClipper Background] Content script not responding to PING, will attempt to inject.');
    }

    // 2. Inject content script if not loaded
    if (!isContentScriptLoaded) {
      try {
        console.log('[NotionClipper Background] Injecting content script programmatically...');
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['dist/content.js']
        });
        console.log('[NotionClipper Background] Content script injected successfully.');
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectError) {
        console.error('[NotionClipper Background] Failed to inject content script:', injectError);
        throw new Error('Cannot access this page. Please refresh the page or try another website.');
      }
    }

    // Try to send extraction request to content script with retry logic
    let contentResponse: any;
    let retries = 3;
    let lastError: any;

    while (retries > 0) {
      try {
        console.log(`[NotionClipper Background] Attempting content script communication (${4 - retries}/3)...`);
        contentResponse = await Promise.race([
          sendToContentScript(activeTab.id, {
            action: 'EXTRACT_PAGE_CONTENT',
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Content script communication timeout')), 10000)
          ),
        ]);
        console.log('[NotionClipper Background] Content script responded successfully');
        break;
      } catch (error) {
        lastError = error;
        console.warn(`[NotionClipper Background] Content script communication failed (attempt ${4 - retries}):`, error);
        retries--;
        
        if (retries > 0) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    if (!contentResponse) {
      throw lastError || new Error('Failed to communicate with content script after 3 attempts');
    }

    if (!contentResponse.success) {
      throw new Error(contentResponse.error || 'Failed to extract content');
    }

    // The content script returns the extracted article
    const article = contentResponse.article;

    console.log('[NotionClipper Background] Article received:', {
      title: article.title,
      contentLength: article.content?.length,
      imagesCount: article.images?.length,
    });

    sendResponse({
      success: true,
      article,
    });
  } catch (error) {
    console.error('[NotionClipper Background] Extraction error:', error);
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
 * Get auto-detected field mapping for a database
 */
async function handleGetAutoFieldMapping(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { fieldMapping?: Record<string, any>; error?: string }) => void
) {
  try {
    const databaseId = message.data?.databaseId;
    if (!databaseId) {
      throw new Error('Database ID is required');
    }

    const fieldMapping = await NotionService.autoDetectFieldMapping(databaseId);
    sendResponse({ fieldMapping });
  } catch (error) {
    console.error('Get auto field mapping error:', error);
    sendResponse({
      error: error instanceof Error ? error.message : 'Failed to get field mapping',
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

    // Process images referenced in markdown content if requested
    let imagesMap: Record<string, string> = {};
    if (shouldDownloadImages) {
      try {
        const markdownImageUrls = extractMarkdownImageUrls(article.content || '', article.url);
        const imageUrlsToUpload = new Set<string>(markdownImageUrls);
        if (article.mainImage?.startsWith('http')) {
          imageUrlsToUpload.add(article.mainImage);
        }

        if (imageUrlsToUpload.size === 0) {
          console.log('[NotionClipper Background] No markdown images found for upload');
        }

        const imagesForUpload: ExtractedImage[] = Array.from(imageUrlsToUpload).map((src) => ({ src }));

        console.log('[NotionClipper Background] Downloading images for upload to Notion...');
        const { results, errors } = await ImageService.downloadImages(imagesForUpload);
        
        if (errors.size > 0) {
          console.warn('[NotionClipper Background] Some images failed to download:', errors);
        }
        
        console.log(`[NotionClipper Background] Successfully downloaded ${results.size} images. Starting upload...`);

        // Upload each downloaded image to Notion
        for (const [src, blob] of results.entries()) {
          try {
            const ext = ImageService.getImageExtension(blob);
            const filename = `image-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
            
            // Upload to Notion API
            const fileUploadId = await NotionService.uploadFile(blob, filename);
            imagesMap[src] = fileUploadId;
            console.log(`[NotionClipper Background] Uploaded image ${src} -> ${fileUploadId}`);
          } catch (uploadError) {
            console.error(`[NotionClipper Background] Failed to upload image ${src}:`, uploadError);
            // Fallback to original URL is handled in NotionService if map entry is missing
          }
        }
      } catch (error) {
        console.error('Image processing failed:', error);
        // Continue without images (or with original URLs)
      }
    }

    // Create page in Notion
    const result = await NotionService.createPage(
      databaseId,
      article,
      fieldMapping,
      imagesMap
    );

    if (shouldDownloadImages) {
      try {
        const migration = await NotionService.migrateExternalImageBlocks(result.id);
        console.log('[NotionClipper Background] External image migration result:', migration);
      } catch (migrationError) {
        console.warn('[NotionClipper Background] External image migration skipped due to error:', migrationError);
      }
    }

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

function extractMarkdownImageUrls(markdown: string, baseUrl?: string): string[] {
  if (!markdown) {
    return [];
  }

  const urls = new Set<string>();
  const imageRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null = imageRegex.exec(markdown);

  while (match) {
    const rawUrl = match[1]?.trim();
    if (rawUrl) {
      try {
        const resolved = baseUrl ? new URL(rawUrl, baseUrl).href : rawUrl;
        if (resolved.startsWith('http')) {
          urls.add(resolved);
        }
      } catch {
        // Ignore invalid URL
      }
    }
    match = imageRegex.exec(markdown);
  }

  return Array.from(urls);
}

console.log('Notion Clipper background script loaded');

/**
 * IPC (Inter-Process Communication) utilities for Chrome extension
 * Provides helpers for sending/receiving messages between scripts
 */

import { ChromeMessage } from '../types';

/**
 * Send message to background script
 * Used by popup and content scripts
 */
export function sendToBackground<T = any>(message: ChromeMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send message to content script of a specific tab
 * Used by background script
 */
export function sendToContentScript<T = any>(
  tabId: number,
  message: ChromeMessage
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send message to specific tab
 * Used from popup or other contexts
 */
export function sendToTab<T = any>(
  tabId: number,
  message: ChromeMessage
): Promise<T> {
  return sendToContentScript(tabId, message);
}

/**
 * Get active tab information
 */
export function getActiveTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (tabs.length > 0) {
        resolve(tabs[0]);
      } else {
        reject(new Error('No active tab found'));
      }
    });
  });
}

/**
 * Create a simple response handler factory
 */
export function createMessageHandler<T>(
  action: string,
  handler: (data: any) => Promise<T>
): (
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean {
  return (message, sender, sendResponse) => {
    if (message.action === action) {
      handler(message.data)
        .then((result) => {
          sendResponse({ success: true, data: result });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return true; // Keep the response channel open
    }
    return false;
  };
}

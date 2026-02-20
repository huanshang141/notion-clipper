/**
 * Chrome Storage API wrapper
 * Provides unified interface for storing and retrieving app data
 */

import { StorageData, NotionAuthToken } from '../types';

class StorageService {
  private static readonly STORAGE_KEY = 'notion_clipper_data';

  /**
   * Get the entire storage data
   */
  static async getData(): Promise<StorageData> {
    return new Promise((resolve) => {
      chrome.storage.sync.get([this.STORAGE_KEY], (result) => {
        resolve(result[this.STORAGE_KEY] || {});
      });
    });
  }

  /**
   * Save the entire storage data
   */
  static async setData(data: StorageData): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [this.STORAGE_KEY]: data }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get authentication token
   */
  static async getAuthToken(): Promise<NotionAuthToken | null> {
    const data = await this.getData();
    return data.auth || null;
  }

  /**
   * Save authentication token
   */
  static async setAuthToken(token: NotionAuthToken): Promise<void> {
    const data = await this.getData();
    data.auth = token;
    await this.setData(data);
  }

  /**
   * Clear authentication token
   */
  static async clearAuthToken(): Promise<void> {
    const data = await this.getData();
    delete data.auth;
    await this.setData(data);
  }

  /**
   * Get a specific setting value
   */
  static async getSetting(key: string): Promise<any> {
    const data = await this.getData();
    return data.settings?.[key as keyof typeof data.settings];
  }

  /**
   * Set a specific setting value
   */
  static async setSetting(key: string, value: any): Promise<void> {
    const data = await this.getData();
    if (!data.settings) {
      data.settings = {};
    }
    (data.settings as Record<string, any>)[key] = value;
    await this.setData(data);
  }

  /**
   * Get last used workspace
   */
  static async getLastWorkspace() {
    const data = await this.getData();
    return data.lastWorkspace || null;
  }

  /**
   * Save last used workspace
   */
  static async setLastWorkspace(workspaceId: string, workspaceName: string) {
    const data = await this.getData();
    if (!data.lastWorkspace) {
      data.lastWorkspace = { id: workspaceId, name: workspaceName };
    } else {
      data.lastWorkspace.id = workspaceId;
      data.lastWorkspace.name = workspaceName;
    }
    await this.setData(data);
  }

  /**
   * Get last used database
   */
  static async getLastDatabase() {
    const data = await this.getData();
    return data.lastDatabase || null;
  }

  /**
   * Save last used database
   */
  static async setLastDatabase(databaseId: string, databaseTitle: string) {
    const data = await this.getData();
    if (!data.lastDatabase) {
      data.lastDatabase = { id: databaseId, title: databaseTitle };
    } else {
      data.lastDatabase.id = databaseId;
      data.lastDatabase.title = databaseTitle;
    }
    await this.setData(data);
  }

  /**
   * Clear all data (logout)
   */
  static async clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove([this.STORAGE_KEY], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}

export default StorageService;

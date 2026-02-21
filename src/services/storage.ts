/**
 * Chrome Storage API wrapper
 * Provides unified interface for storing and retrieving app data
 */

import { StorageData, NotionAuthToken, EditorDraft } from '../types';

class StorageService {
  private static readonly STORAGE_KEY = 'notion_clipper_data';
  private static readonly EDITOR_DRAFT_PREFIX = 'notion_editor_draft_';

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

  static async setEditorDraft(draft: EditorDraft): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(
        { [`${this.EDITOR_DRAFT_PREFIX}${draft.id}`]: draft },
        () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        }
      );
    });
  }

  static async getEditorDraft(draftId: string): Promise<EditorDraft | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([`${this.EDITOR_DRAFT_PREFIX}${draftId}`], (result) => {
        resolve(result[`${this.EDITOR_DRAFT_PREFIX}${draftId}`] || null);
      });
    });
  }

  static async removeEditorDraft(draftId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([`${this.EDITOR_DRAFT_PREFIX}${draftId}`], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  static async updateEditorDraft(draftId: string, updates: Partial<EditorDraft>): Promise<EditorDraft | null> {
    const existing = await this.getEditorDraft(draftId);
    if (!existing) {
      return null;
    }

    const nextDraft: EditorDraft = {
      ...existing,
      ...updates,
      article: {
        ...existing.article,
        ...(updates.article || {}),
      },
      updatedAt: Date.now(),
    };

    await this.setEditorDraft(nextDraft);
    return nextDraft;
  }

  static async getLatestEditorDraftByUrl(url: string): Promise<EditorDraft | null> {
    if (!url) {
      return null;
    }

    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        const drafts: EditorDraft[] = Object.entries(result)
          .filter(([key]) => key.startsWith(this.EDITOR_DRAFT_PREFIX))
          .map(([, value]) => value as EditorDraft)
          .filter((draft) => draft?.article?.url === url);

        if (drafts.length === 0) {
          resolve(null);
          return;
        }

        drafts.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        resolve(drafts[0]);
      });
    });
  }

  static async upsertEditorDraftByUrl(
    url: string,
    article: Partial<EditorDraft['article']>,
    selectedDatabaseId?: string
  ): Promise<EditorDraft> {
    const existing = await this.getLatestEditorDraftByUrl(url);

    if (existing) {
      const nextDraft: EditorDraft = {
        ...existing,
        selectedDatabaseId: selectedDatabaseId ?? existing.selectedDatabaseId,
        article: {
          ...existing.article,
          ...article,
        },
        updatedAt: Date.now(),
      };

      await this.setEditorDraft(nextDraft);
      return nextDraft;
    }

    const draftId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const newDraft: EditorDraft = {
      id: draftId,
      article: {
        title: article.title || 'Untitled',
        content: article.content || '',
        url,
        images: article.images || [],
        rawHtml: article.rawHtml,
        contentFormat: article.contentFormat,
        mainImage: article.mainImage,
        favicon: article.favicon,
        excerpt: article.excerpt,
        authorName: article.authorName,
        publishDate: article.publishDate,
        domain: article.domain,
      },
      selectedDatabaseId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.setEditorDraft(newDraft);
    return newDraft;
  }
}

export default StorageService;

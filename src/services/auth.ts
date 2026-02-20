/**
 * Authentication Service
 * Handles API Key authentication with Notion Internal Integration
 * Users provide their own Internal Integration Token
 */

import StorageService from './storage';
import { NotionAuthToken } from '../types';
import { NOTION_API_VERSION } from '../utils/constants';

class AuthService {
  /**
   * Authenticate with API Key (primary method for MVP)
   */
  async authenticateWithApiKey(apiKey: string): Promise<NotionAuthToken> {
    try {
      // Trim and validate API key format
      apiKey = apiKey.trim();
      
      // Notion API keys start with "ntn_"
      if (!apiKey.startsWith('ntn_')) {
        throw new Error('Invalid API key format. API keys should start with "ntn_"');
      }

      // Validate API key by making a test request
      const response = await fetch('https://api.notion.com/v1/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': NOTION_API_VERSION,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid or expired API key');
        }
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const token: NotionAuthToken = {
        accessToken: apiKey,
        tokenType: 'bearer',
        workspaceName: data.workspace?.name || (data as any).workspace_name || 'My Workspace',
        workspaceId: data.workspace_id,
      };

      // Save token to storage
      await StorageService.setAuthToken(token);
      return token;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      throw new Error(`Authentication failed: ${message}`);
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) return false;

      // Validate token is still valid
      const response = await fetch('https://api.notion.com/v1/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Notion-Version': NOTION_API_VERSION,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get current authentication token
   */
  async getToken(): Promise<NotionAuthToken | null> {
    return StorageService.getAuthToken();
  }

  /**
   * Logout - clear stored authentication
   */
  async logout(): Promise<void> {
    await StorageService.clearAuthToken();
  }

  /**
   * Get authentication status with workspace info
   */
  async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    token?: NotionAuthToken;
    workspace?: { id: string; name: string };
  }> {
    try {
      const token = await this.getToken();
      if (!token) {
        return { isAuthenticated: false };
      }

      const isValid = await this.isAuthenticated();
      if (!isValid) {
        return { isAuthenticated: false };
      }

      return {
        isAuthenticated: true,
        token,
        workspace: {
          id: token.workspaceId || '',
          name: token.workspaceName || 'Unknown',
        },
      };
    } catch {
      return { isAuthenticated: false };
    }
  }
}

export default new AuthService();

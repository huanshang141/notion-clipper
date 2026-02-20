/**
 * Authentication Service
 * Handles OAuth and API Key authentication with Notion
 */

import StorageService from './storage';
import { NotionAuthToken } from '../types';
import { OAUTH_CONFIG, NOTION_API_VERSION } from '../utils/constants';

class AuthService {
  /**
   * Start OAuth flow
   * Opens Notion authorization URL in a new window
   */
  async startOAuthFlow(): Promise<NotionAuthToken> {
    if (!OAUTH_CONFIG.clientId) {
      throw new Error('OAuth client ID not configured. Please set NOTION_CLIENT_ID environment variable.');
    }

    return new Promise((resolve, reject) => {
      // Build OAuth URL
      const authUrl = new URL('https://api.notion.com/oauth/authorize');
      authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientId);
      authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('owner', 'user');

      // Open authorization window
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        async (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            reject(
              new Error(
                chrome.runtime.lastError?.message || 'OAuth 授权被用户取消'
              )
            );
            return;
          }

          try {
            // Extract authorization code from redirect URL
            const url = new URL(redirectUrl);
            const code = url.searchParams.get('code');

            if (!code) {
              throw new Error('No authorization code received');
            }

            // Exchange code for access token via background script
            // In production, this should be done securely on a backend
            throw new Error('OAuth flow requires backend support. Please use API Key authentication instead.');
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Authenticate with API Key (primary method for MVP)
   */
  async authenticateWithApiKey(apiKey: string): Promise<NotionAuthToken> {
    try {
      // Trim and validate API key format
      apiKey = apiKey.trim();
      
      if (!apiKey.startsWith('secret_')) {
        throw new Error('Invalid API key format. API keys should start with "secret_"');
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

/**
 * Authentication Service
 * Handles OAuth and API Key authentication with Notion
 */

import StorageService from './storage';
import { NotionAuthToken } from '../types';
import { OAUTH_CONFIG } from '../utils/constants';

class AuthService {
  /**
   * Start OAuth flow
   * Opens Notion authorization URL in a new window
   */
  async startOAuthFlow(): Promise<NotionAuthToken> {
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
                chrome.runtime.lastError?.message || 'OAuth flow canceled'
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

            // Exchange code for access token
            const response = await fetch('https://api.notion.com/v1/oauth/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                grant_type: 'authorization_code',
                code,
                redirect_uri: OAUTH_CONFIG.redirectUri,
                client_id: OAUTH_CONFIG.clientId,
                client_secret: process.env.NOTION_CLIENT_SECRET || '', // 需要配置
              }),
            });

            if (!response.ok) {
              throw new Error(`Token exchange failed: ${response.statusText}`);
            }

            const data = await response.json();
            const token: NotionAuthToken = {
              accessToken: data.access_token,
              tokenType: data.token_type,
              expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
              workspaceName: data.workspace_name,
              workspaceId: data.workspace_id,
              workspaceIcon: data.workspace_icon,
            };

            // Save token
            await StorageService.setAuthToken(token);
            resolve(token);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Authenticate with API Key
   */
  async authenticateWithApiKey(apiKey: string): Promise<NotionAuthToken> {
    try {
      // Validate API key by making a test request
      const response = await fetch('https://api.notion.com/v1/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2024-02-15',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid API key');
      }

      const data = await response.json();

      const token: NotionAuthToken = {
        accessToken: apiKey,
        tokenType: 'bearer',
        workspaceName: data.workspace?.name || 'My Workspace',
        workspaceId: data.workspace_id,
      };

      // Save token
      await StorageService.setAuthToken(token);
      return token;
    } catch (error) {
      throw new Error(`Authentication failed: ${error}`);
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
          'Notion-Version': '2024-02-15',
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
   * Refresh token if needed (for OAuth tokens)
   */
  async refreshTokenIfNeeded(): Promise<NotionAuthToken | null> {
    const token = await StorageService.getAuthToken();
    if (!token) return null;

    // If no expiration, assume it's an API key that doesn't expire
    if (!token.expiresAt) return token;

    // If token isn't expiring soon, return as is
    const now = Date.now();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes

    if (token.expiresAt - now > refreshThreshold) {
      return token;
    }

    // Token is expiring, try to refresh (requires client_secret)
    if (!token.refreshToken) {
      // Can't refresh without refresh token
      throw new Error('Token expired and cannot be refreshed');
    }

    try {
      const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
          client_id: OAUTH_CONFIG.clientId,
          client_secret: process.env.NOTION_CLIENT_SECRET || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const newToken: NotionAuthToken = {
        accessToken: data.access_token,
        tokenType: data.token_type,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        refreshToken: data.refresh_token || token.refreshToken,
        workspaceName: token.workspaceName,
        workspaceId: token.workspaceId,
      };

      await StorageService.setAuthToken(newToken);
      return newToken;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error}`);
    }
  }
}

export default new AuthService();

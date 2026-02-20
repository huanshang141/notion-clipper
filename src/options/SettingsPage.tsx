/**
 * Options/Settings Page Component
 */

import React, { useState, useEffect } from 'react';
import { sendToBackground } from '../utils/ipc';
import StorageService from '../services/storage';
import { NotionAuthToken } from '../types';
import './options.css';

export default function SettingsPage() {
  const [token, setToken] = useState<NotionAuthToken | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [autoDownloadImages, setAutoDownloadImages] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const auth = await StorageService.getAuthToken();
      setToken(auth);

      const autoDownload = await StorageService.getSetting('autoDownloadImages');
      const debug = await StorageService.getSetting('debugMode');

      setAutoDownloadImages(autoDownload !== false);
      setDebugMode(debug === true);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleImportApiKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      showMessage('Please enter an API key', 'error');
      return;
    }

    setIsConnecting(true);

    try {
      // Try to connect with the API key
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
      const newToken: NotionAuthToken = {
        accessToken: apiKey,
        tokenType: 'bearer',
        workspaceName: data.workspace?.name || 'My Workspace',
        workspaceId: data.workspace_id,
      };

      await StorageService.setAuthToken(newToken);
      setToken(newToken);
      setApiKey('');

      showMessage('API key successfully imported', 'success');
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Failed to import API key',
        'error'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await sendToBackground({ action: 'LOGOUT' });
      setToken(null);
      showMessage('Logged out successfully', 'success');
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Failed to logout',
        'error'
      );
    }
  };

  const handleAutoDownloadChange = async (checked: boolean) => {
    setAutoDownloadImages(checked);
    await StorageService.setSetting('autoDownloadImages', checked);
    showMessage('Settings saved', 'info');
  };

  const handleDebugModeChange = async (checked: boolean) => {
    setDebugMode(checked);
    await StorageService.setSetting('debugMode', checked);
    showMessage('Settings saved', 'info');
  };

  const showMessage = (msg: string, type: 'success' | 'error' | 'info') => {
    setMessage(msg);
    setMessageType(type);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      setMessage('');
    }, 3000);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Notion Clipper Settings</h1>
        <p>Configure how Notion Clipper saves content to your workspace</p>
      </div>

      {message && (
        <div className={`message message-${messageType}`}>
          {message}
        </div>
      )}

      <div className="settings-container">
        {/* Authentication Section */}
        <section className="settings-section">
          <h2>Authentication</h2>

          {token ? (
            <div className="auth-status">
              <div className="auth-info">
                <p className="auth-status-ok">✓ Connected</p>
                <p className="workspace-name">
                  Workspace: <strong>{token.workspaceName}</strong>
                </p>
              </div>
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </div>
          ) : (
            <form onSubmit={handleImportApiKey} className="api-key-form">
              <div className="form-group">
                <label htmlFor="apiKey">Notion API Key</label>
                <input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="secret_ABC123..."
                  disabled={isConnecting}
                />
                <p className="help-text">
                  Get your API key from{' '}
                  <a
                    href="https://www.notion.so/my-integrations"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Notion Integrations
                  </a>
                </p>
              </div>

              <button type="submit" disabled={isConnecting} className="btn-primary">
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          )}
        </section>

        {/* Content Processing Section */}
        <section className="settings-section">
          <h2>Content Processing</h2>

          <div className="setting-item">
            <div className="setting-label">
              <label htmlFor="autoDownloadImages">Auto-download Images</label>
              <p>Automatically download and upload images to Notion</p>
            </div>
            <input
              id="autoDownloadImages"
              type="checkbox"
              checked={autoDownloadImages}
              onChange={(e) => handleAutoDownloadChange(e.target.checked)}
            />
          </div>
        </section>

        {/* Debug Section */}
        <section className="settings-section">
          <h2>Advanced</h2>

          <div className="setting-item">
            <div className="setting-label">
              <label htmlFor="debugMode">Debug Mode</label>
              <p>Enable debug logging in the browser console</p>
            </div>
            <input
              id="debugMode"
              type="checkbox"
              checked={debugMode}
              onChange={(e) => handleDebugModeChange(e.target.checked)}
            />
          </div>
        </section>

        {/* Help Section */}
        <section className="settings-section">
          <h2>Help & Resources</h2>

          <div className="help-links">
            <a href="https://developers.notion.com" target="_blank" rel="noreferrer">
              Notion API Documentation
            </a>
            <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">
              Manage Integrations
            </a>
            <a href="https://github.com/your-repo/issues" target="_blank" rel="noreferrer">
              Report an Issue
            </a>
          </div>
        </section>

        {/* About Section */}
        <section className="settings-section about-section">
          <h2>About</h2>
          <p>
            Notion Clipper v0.1.0
            <br />
            A Chrome extension to save web content to Notion
          </p>
        </section>
      </div>
    </div>
  );
}

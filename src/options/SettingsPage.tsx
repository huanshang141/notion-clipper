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
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [autoDownloadImages, setAutoDownloadImages] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const auth = await StorageService.getAuthToken();
      setToken(auth);

      const autoDownload = await StorageService.getSetting('autoDownloadImages');
      const debug = await StorageService.getSetting('debugMode');
      const savedTheme = await StorageService.getSetting('theme');

      setAutoDownloadImages(autoDownload !== false);
      setDebugMode(debug === true);
      setTheme(savedTheme === 'dark' ? 'dark' : 'light');

      document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleImportApiKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      showMessage('请输入 API Key', 'error');
      return;
    }

    setIsConnecting(true);

    try {
      // Send authentication request to background script
      const response = await sendToBackground({
        action: 'AUTHENTICATE',
        data: { apiKey: apiKey.trim() },
      });

      if (response.success) {
        await loadSettings();
        setApiKey('');
        showMessage('API Key 导入成功', 'success');
      } else {
        showMessage(
          response.error || 'API Key 验证失败，请检查是否正确',
          'error'
        );
      }
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : '导入失败',
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
      showMessage('成功退出登录', 'success');
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : '退出登录失败',
        'error'
      );
    }
  };

  const handleTestConnection = async () => {
    if (!token) {
      showMessage('请先验证 API Key', 'error');
      return;
    }

    setIsTesting(true);

    try {
      // Test by fetching user info
      const response = await fetch('https://api.notion.com/v1/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Notion-Version': '2025-09-03',
        },
      });

      if (!response.ok) {
        throw new Error(`连接失败: ${response.status}`);
      }

      const data = await response.json();
      showMessage(
        `✓ 连接成功！工作区: ${data.workspace_name || 'Unknown'}`,
        'success'
      );
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : '连接测试失败',
        'error'
      );
    } finally {
      setIsTesting(false);
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

  const handleThemeChange = async (nextTheme: 'light' | 'dark') => {
    setTheme(nextTheme);
    await StorageService.setSetting('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    showMessage('Theme updated', 'info');
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
                <p className="auth-status-ok">✓ 已连接</p>
                <p className="workspace-name">
                  工作区: <strong>{token.workspaceName}</strong>
                </p>
              </div>
              <div className="auth-actions">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="btn-test"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                <button onClick={handleLogout} className="btn-logout">
                  退出登录
                </button>
              </div>
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

        <section className="settings-section">
          <h2>Appearance</h2>

          <div className="setting-item">
            <div className="setting-label">
              <label htmlFor="theme">Theme</label>
              <p>Apply to popup and in-page preview editor</p>
            </div>
            <select
              id="theme"
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark')}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
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

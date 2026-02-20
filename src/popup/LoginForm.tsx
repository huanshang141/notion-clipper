/**
 * Login Form Component
 */

import React, { useState } from 'react';

interface LoginFormProps {
  onSubmit: (apiKey: string) => Promise<void>;
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSubmit(apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-form">
      <div className="form-header">
        <h2>Connect to Notion</h2>
        <p>Please enter your Notion API key to get started</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="apiKey">Notion API Key</label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError('');
            }}
            placeholder="secret_ABC123..."
            disabled={isLoading}
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

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={isLoading} className="submit-btn">
          {isLoading ? 'Connecting...' : 'Connect'}
        </button>
      </form>

      <div className="info-section">
        <h3>How to get an API key:</h3>
        <ol>
          <li>Go to https://www.notion.so/my-integrations</li>
          <li>Click "Create new integration"</li>
          <li>Give it a name and select your workspace</li>
          <li>Copy the "Internal Integration Token"</li>
          <li>Paste it here</li>
        </ol>
      </div>
    </div>
  );
}

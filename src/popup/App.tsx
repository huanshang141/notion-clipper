/**
 * Popup App Component
 * Main UI for the extension
 */

import { useState, useEffect } from 'react';
import { sendToBackground } from '../utils/ipc';
import AuthService from '../services/auth';
import StorageService from '../services/storage';
import {
  ExtractedArticle,
  NotionDatabase,
  NotionProperty,
  NotionAuthToken,
} from '../types';
import LoginForm from './LoginForm';
import SaveForm from './SaveForm';
import './App.css';

interface AppState {
  isCheckingAuth: boolean;
  isAuthenticated: boolean;
  token?: NotionAuthToken;
  isExtracting: boolean;
  article?: ExtractedArticle;
  databases: NotionDatabase[];
  selectedDatabaseId?: string;
  databaseSchema?: NotionProperty[];
  isSaving: boolean;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
}

export default function App() {
  const [state, setState] = useState<AppState>({
    isCheckingAuth: true,
    isAuthenticated: false,
    databases: [],
    isExtracting: false,
    isSaving: false,
  });

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Extract content when app loads
  useEffect(() => {
    if (state.isAuthenticated && !state.article) {
      extractContent();
    }
  }, [state.isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      const response = await sendToBackground({
        action: 'GET_AUTH_STATUS',
      });

      setState((prev) => ({
        ...prev,
        isCheckingAuth: false,
        isAuthenticated: response.isAuthenticated,
        token: response.token,
      }));

      if (response.isAuthenticated) {
        loadDatabases();
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isCheckingAuth: false,
        message: 'Failed to check auth status',
        messageType: 'error',
      }));
    }
  };

  const loadDatabases = async () => {
    try {
      const response = await sendToBackground({
        action: 'GET_DATABASES',
      });

      if (response.databases && response.databases.length > 0) {
        const lastDb = await StorageService.getLastDatabase();
        const selectedId = lastDb?.id || response.databases[0].id;

        setState((prev) => ({
          ...prev,
          databases: response.databases,
          selectedDatabaseId: selectedId,
        }));

        // Load schema for the selected database
        loadDatabaseSchema(selectedId);
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
    }
  };

  const loadDatabaseSchema = async (databaseId: string) => {
    try {
      const response = await sendToBackground({
        action: 'GET_DATABASE_SCHEMA',
        data: { databaseId },
      });

      setState((prev) => ({
        ...prev,
        selectedDatabaseId: databaseId,
        databaseSchema: response.properties,
      }));
    } catch (error) {
      console.error('Failed to load database schema:', error);
    }
  };

  const extractContent = async () => {
    setState((prev) => ({ ...prev, isExtracting: true }));

    try {
      const response = await sendToBackground({
        action: 'EXTRACT_CONTENT',
      });

      if (response.success && response.article) {
        setState((prev) => ({
          ...prev,
          article: response.article,
          message: 'Content extracted successfully',
          messageType: 'success',
        }));
      } else {
        throw new Error(response.error || 'Extraction failed');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Failed to extract content',
        messageType: 'error',
      }));
    } finally {
      setState((prev) => ({ ...prev, isExtracting: false }));
    }
  };

  const handleLogin = async (apiKey: string) => {
    try {
      const token = await AuthService.authenticateWithApiKey(apiKey);

      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        token,
        message: 'Successfully authenticated',
        messageType: 'success',
      }));

      await loadDatabases();
      await extractContent();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Authentication failed',
        messageType: 'error',
      }));
    }
  };

  const handleDatabaseChange = (databaseId: string) => {
    loadDatabaseSchema(databaseId);
  };

  const handleSave = async (fieldMapping: Record<string, any>) => {
    if (!state.article || !state.selectedDatabaseId) {
      return;
    }

    setState((prev) => ({ ...prev, isSaving: true, message: undefined }));

    try {
      const response = await sendToBackground({
        action: 'SAVE_TO_NOTION',
        data: {
          article: state.article,
          databaseId: state.selectedDatabaseId,
          fieldMapping,
          shouldDownloadImages: true,
        },
      });

      if (response.success) {
        setState((prev) => ({
          ...prev,
          message: `Saved to Notion! ${response.url ? `Open: ${response.url}` : ''}`,
          messageType: 'success',
        }));

        // Reset form for next save
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            article: undefined,
          }));
          extractContent();
        }, 2000);
      } else {
        throw new Error(response.error || 'Save failed');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Failed to save',
        messageType: 'error',
      }));
    } finally {
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const handleLogout = async () => {
    try {
      await sendToBackground({ action: 'LOGOUT' });

      setState({
        isCheckingAuth: false,
        isAuthenticated: false,
        databases: [],
        isExtracting: false,
        isSaving: false,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        message: 'Failed to logout',
        messageType: 'error',
      }));
    }
  };

  // Render loading state
  if (state.isCheckingAuth) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Render login form if not authenticated
  if (!state.isAuthenticated) {
    return (
      <div className="popup-container">
        <LoginForm onSubmit={handleLogin} />
      </div>
    );
  }

  // Render save form if authenticated
  return (
    <div className="popup-container">
      <div className="popup-header">
        <h2>Save to Notion</h2>
        <button className="logout-btn" onClick={handleLogout} title="Logout">
          ⊗
        </button>
      </div>

      {state.message && (
        <div className={`message message-${state.messageType}`}>
          {state.message}
        </div>
      )}

      {state.isExtracting ? (
        <div className="loading">Extracting content...</div>
      ) : state.article ? (
        <SaveForm
          article={state.article}
          databases={state.databases}
          selectedDatabaseId={state.selectedDatabaseId}
          databaseSchema={state.databaseSchema}
          isSaving={state.isSaving}
          onDatabaseChange={handleDatabaseChange}
          onSave={handleSave}
        />
      ) : (
        <div className="no-article">
          <p>No content to save</p>
          <button onClick={extractContent}>Try Again</button>
        </div>
      )}
    </div>
  );
}

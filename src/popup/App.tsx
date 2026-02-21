import { useState, useEffect } from 'react';
import { sendToBackground } from '../utils/ipc';
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

  useEffect(() => {
    void checkAuthStatus();
  }, []);

  useEffect(() => {
    if (state.isAuthenticated && !state.article) {
      void extractContent();
    }
  }, [state.isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      const response = await sendToBackground<any>({
        action: 'GET_AUTH_STATUS',
      });

      setState((prev) => ({
        ...prev,
        isCheckingAuth: false,
        isAuthenticated: response.isAuthenticated,
        token: response.token,
      }));

      if (response.isAuthenticated) {
        await loadDatabases();
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isCheckingAuth: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to check authentication status',
        messageType: 'error',
      }));
    }
  };

  const loadDatabases = async () => {
    try {
      const response = await sendToBackground<any>({
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

        await loadDatabaseSchema(selectedId);
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
    }
  };

  const loadDatabaseSchema = async (databaseId: string) => {
    try {
      const response = await sendToBackground<any>({
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
      const response = await sendToBackground<any>({
        action: 'EXTRACT_CONTENT',
      });

      if (response.success && response.article) {
        let nextArticle: ExtractedArticle = response.article;

        const draftResponse = await sendToBackground<any>({
          action: 'GET_EDITOR_DRAFT_BY_URL',
          data: { url: response.article.url },
        });

        if (draftResponse.success && draftResponse.draft?.article?.content) {
          nextArticle = {
            ...response.article,
            content: draftResponse.draft.article.content,
            rawHtml: draftResponse.draft.article.rawHtml,
          };
        }

        setState((prev) => ({
          ...prev,
          article: nextArticle,
          message: 'Content extracted successfully',
          messageType: 'success',
        }));
      } else {
        throw new Error(response.error || 'Extraction failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract content';
      setState((prev) => ({
        ...prev,
        message: errorMessage,
        messageType: 'error',
      }));
    } finally {
      setState((prev) => ({ ...prev, isExtracting: false }));
    }
  };

  const handleLogin = async (apiKey: string) => {
    try {
      const response = await sendToBackground<any>({
        action: 'AUTHENTICATE',
        data: { apiKey },
      });

      if (response.success && response.token) {
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          token: response.token,
          message: 'Successfully authenticated',
          messageType: 'success',
        }));

        await loadDatabases();
        await extractContent();
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Authentication failed',
        messageType: 'error',
      }));
    }
  };

  const handleSave = async (fieldMapping: Record<string, any>, articleToSave: ExtractedArticle) => {
    if (!articleToSave || !state.selectedDatabaseId) {
      return;
    }

    setState((prev) => ({ ...prev, isSaving: true, message: undefined }));

    try {
      const response = await sendToBackground<any>({
        action: 'SAVE_TO_NOTION',
        data: {
          article: articleToSave,
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

  const handleOpenContentEditor = async (articleToEdit: ExtractedArticle) => {
    try {
      const response = await sendToBackground<any>({
        action: 'OPEN_EDITOR_WITH_ARTICLE',
        data: {
          article: articleToEdit,
          selectedDatabaseId: state.selectedDatabaseId,
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to open content editor');
      }

      setState((prev) => ({
        ...prev,
        message: 'In-page preview editor opened on current webpage',
        messageType: 'info',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Failed to open content editor',
        messageType: 'error',
      }));
    }
  };

  const handleDatabaseChange = (databaseId: string) => {
    void loadDatabaseSchema(databaseId);
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
    } catch {
      setState((prev) => ({
        ...prev,
        message: 'Failed to logout',
        messageType: 'error',
      }));
    }
  };

  if (state.isCheckingAuth) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return (
      <div className="popup-container">
        <LoginForm onSubmit={handleLogin} />
      </div>
    );
  }

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
          onOpenContentEditor={handleOpenContentEditor}
        />
      ) : (
        <div className="no-article">
          <p>No content to save</p>
          <button onClick={() => void extractContent()}>Try Again</button>
        </div>
      )}
    </div>
  );
}

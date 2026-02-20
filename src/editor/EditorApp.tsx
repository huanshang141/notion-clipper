import { useEffect, useMemo, useState } from 'react';
import { sendToBackground } from '../utils/ipc';
import StorageService from '../services/storage';
import {
  ExtractedArticle,
  NotionDatabase,
  NotionProperty,
  NotionAuthToken,
} from '../types';
import LoginForm from '../popup/LoginForm';
import SaveForm from '../popup/SaveForm';

interface EditorState {
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

function getDraftIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('draftId');
}

export default function EditorApp() {
  const draftId = useMemo(() => getDraftIdFromUrl(), []);
  const [state, setState] = useState<EditorState>({
    isCheckingAuth: true,
    isAuthenticated: false,
    databases: [],
    isExtracting: false,
    isSaving: false,
  });

  useEffect(() => {
    void initialize();
  }, []);

  const initialize = async () => {
    try {
      const authStatus = await sendToBackground<any>({ action: 'GET_AUTH_STATUS' });
      setState((prev) => ({
        ...prev,
        isCheckingAuth: false,
        isAuthenticated: authStatus.isAuthenticated,
        token: authStatus.token,
      }));

      if (!authStatus.isAuthenticated) {
        return;
      }

      let preferredDatabaseId: string | undefined;
      if (draftId) {
        const draftResponse = await sendToBackground<any>({
          action: 'GET_EDITOR_DRAFT',
          data: { draftId },
        });

        if (draftResponse.success && draftResponse.draft?.article) {
          preferredDatabaseId = draftResponse.draft.selectedDatabaseId;
          setState((prev) => ({
            ...prev,
            article: draftResponse.draft.article,
          }));
        }
      }

      await loadDatabases(preferredDatabaseId);

      setState((prev) => {
        if (prev.article) {
          return prev;
        }
        return {
          ...prev,
          message: 'No draft found, extracting from current page...',
          messageType: 'info',
        };
      });

      setTimeout(() => {
        setState((prev) => {
          if (prev.article) {
            return prev;
          }
          void extractContent();
          return prev;
        });
      }, 0);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isCheckingAuth: false,
        message: error instanceof Error ? error.message : 'Failed to initialize editor',
        messageType: 'error',
      }));
    }
  };

  const loadDatabases = async (preferredDatabaseId?: string) => {
    const response = await sendToBackground<any>({ action: 'GET_DATABASES' });

    if (response.databases && response.databases.length > 0) {
      const lastDb = await StorageService.getLastDatabase();
      const selectedId = preferredDatabaseId || lastDb?.id || response.databases[0].id;

      setState((prev) => ({
        ...prev,
        databases: response.databases,
        selectedDatabaseId: selectedId,
      }));

      await loadDatabaseSchema(selectedId);
    }
  };

  const loadDatabaseSchema = async (databaseId: string) => {
    const response = await sendToBackground<any>({
      action: 'GET_DATABASE_SCHEMA',
      data: { databaseId },
    });

    setState((prev) => ({
      ...prev,
      selectedDatabaseId: databaseId,
      databaseSchema: response.properties,
    }));
  };

  const extractContent = async () => {
    setState((prev) => ({ ...prev, isExtracting: true }));

    try {
      const response = await sendToBackground<any>({ action: 'EXTRACT_CONTENT' });
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
      const response = await sendToBackground<any>({
        action: 'AUTHENTICATE',
        data: { apiKey },
      });

      if (!response.success || !response.token) {
        throw new Error(response.error || 'Authentication failed');
      }

      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        token: response.token,
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

      if (!response.success) {
        throw new Error(response.error || 'Save failed');
      }

      setState((prev) => ({
        ...prev,
        message: `Saved to Notion! ${response.url ? `Open: ${response.url}` : ''}`,
        messageType: 'success',
      }));
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
    await sendToBackground({ action: 'LOGOUT' });
    setState({
      isCheckingAuth: false,
      isAuthenticated: false,
      databases: [],
      isExtracting: false,
      isSaving: false,
    });
  };

  if (state.isCheckingAuth) {
    return (
      <div className="popup-container">
        <div className="loading">Loading editor...</div>
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
        <h2>Notion Editor</h2>
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
          onDatabaseChange={(databaseId) => {
            void loadDatabaseSchema(databaseId);
          }}
          onSave={handleSave}
        />
      ) : (
        <div className="no-article">
          <p>No content to edit</p>
          <button onClick={() => void extractContent()}>Extract Again</button>
        </div>
      )}
    </div>
  );
}

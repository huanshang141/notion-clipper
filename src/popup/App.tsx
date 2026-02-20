import { useEffect, useState } from 'react';
import { sendToBackground } from '../utils/ipc';
import { ExtractedArticle, NotionAuthToken } from '../types';
import LoginForm from './LoginForm';
import './App.css';

interface AppState {
  isCheckingAuth: boolean;
  isAuthenticated: boolean;
  token?: NotionAuthToken;
  isExtracting: boolean;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
}

export default function App() {
  const [state, setState] = useState<AppState>({
    isCheckingAuth: true,
    isAuthenticated: false,
    isExtracting: false,
  });

  useEffect(() => {
    void checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await sendToBackground<any>({ action: 'GET_AUTH_STATUS' });
      setState((prev) => ({
        ...prev,
        isCheckingAuth: false,
        isAuthenticated: response.isAuthenticated,
        token: response.token,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isCheckingAuth: false,
        message: error instanceof Error ? error.message : 'Failed to check authentication status',
        messageType: 'error',
      }));
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
    } catch (error) {
      setState((prev) => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Authentication failed',
        messageType: 'error',
      }));
    }
  };

  const handleOpenEditor = async () => {
    setState((prev) => ({ ...prev, isExtracting: true, message: undefined }));

    try {
      const extractResponse = await sendToBackground<any>({ action: 'EXTRACT_CONTENT' });
      if (!extractResponse.success || !extractResponse.article) {
        throw new Error(extractResponse.error || 'Failed to extract content');
      }

      const article: ExtractedArticle = extractResponse.article;
      const openResponse = await sendToBackground<any>({
        action: 'OPEN_EDITOR_WITH_ARTICLE',
        data: { article },
      });

      if (!openResponse.success) {
        throw new Error(openResponse.error || 'Failed to open editor');
      }

      setState((prev) => ({
        ...prev,
        message: 'Editor opened in a new tab',
        messageType: 'success',
      }));

      setTimeout(() => {
        window.close();
      }, 300);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Failed to open editor',
        messageType: 'error',
      }));
    } finally {
      setState((prev) => ({ ...prev, isExtracting: false }));
    }
  };

  const handleLogout = async () => {
    try {
      await sendToBackground({ action: 'LOGOUT' });
      setState({
        isCheckingAuth: false,
        isAuthenticated: false,
        isExtracting: false,
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
        <h2>Notion Clipper</h2>
        <button className="logout-btn" onClick={handleLogout} title="Logout">
          ⊗
        </button>
      </div>

      {state.message && (
        <div className={`message message-${state.messageType}`}>
          {state.message}
        </div>
      )}

      <div className="no-article" style={{ padding: '24px 16px' }}>
        <p>Open the full editor to preview and refine content before saving.</p>
        <button onClick={() => void handleOpenEditor()} disabled={state.isExtracting}>
          {state.isExtracting ? 'Preparing editor...' : 'Open Editor'}
        </button>
      </div>
    </div>
  );
}

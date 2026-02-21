import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { sendToBackground } from '../utils/ipc';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});
turndownService.remove(['script', 'style']);

function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const blockedTags = ['script', 'style', 'iframe', 'object', 'embed', 'noscript'];

  blockedTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }

      if ((name === 'src' || name === 'href') && value.startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

function getDraftId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('draftId');
}

export default function EditorApp() {
  const draftId = useMemo(() => getDraftId(), []);
  const [markdown, setMarkdown] = useState('');
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Loading draft...');

  useEffect(() => {
    void loadDraft();
  }, []);

  const loadDraft = async () => {
    if (!draftId) {
      setStatus('Missing draftId');
      return;
    }

    const response = await sendToBackground<any>({
      action: 'GET_EDITOR_DRAFT',
      data: { draftId },
    });

    if (!response.success || !response.draft?.article) {
      setStatus(response.error || 'Draft not found');
      return;
    }

    const article = response.draft.article;
    const initialMarkdown = article.content || '';
    setTitle(article.title || 'Untitled');
    setMarkdown(initialMarkdown);
    setHtml(sanitizeHtml(marked.parse(initialMarkdown) as string));
    setStatus('Draft loaded');
  };

  const handleEditorInput = (nextHtml: string) => {
    const sanitized = sanitizeHtml(nextHtml);
    const nextMarkdown = turndownService.turndown(sanitized);
    setHtml(sanitized);
    setMarkdown(nextMarkdown);
  };

  const saveDraft = async () => {
    if (!draftId) {
      return;
    }

    const response = await sendToBackground<any>({
      action: 'UPDATE_EDITOR_DRAFT',
      data: {
        draftId,
        article: {
          title,
          content: markdown,
          rawHtml: html,
          contentFormat: 'markdown',
        },
      },
    });

    if (!response.success) {
      setStatus(response.error || 'Failed to save draft');
      return;
    }

    setStatus('Draft saved. You can return to extension popup and click Try Again to reload.');
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h2>Content Editor</h2>
      </div>

      <div className="message message-info" style={{ marginTop: 0 }}>
        {status}
      </div>

      <div className="form-group" style={{ padding: '16px 16px 0' }}>
        <label>Title (read-only)</label>
        <input type="text" value={title} readOnly />
      </div>

      <div className="form-group" style={{ padding: '0 16px' }}>
        <label>Content (WYSIWYG edit + markdown sync)</label>
        <div className="live-editor-grid">
          <div
            className="live-editor-textarea"
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: html }}
            onInput={(e) => handleEditorInput((e.currentTarget as HTMLDivElement).innerHTML)}
          />
          <div className="live-editor-preview" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>

      <div className="form-actions" style={{ margin: '16px' }}>
        <button type="button" className="save-btn" onClick={() => void saveDraft()}>
          Save Content Draft
        </button>
      </div>
    </div>
  );
}

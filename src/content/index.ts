import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { MESSAGE_ACTIONS } from '../utils/constants';

console.log('[NotionClipper] Content script loaded');

let inlineEditorRoot: HTMLDivElement | null = null;
let inlineEditorEditable: HTMLDivElement | null = null;
let inlineEditorStatus: HTMLSpanElement | null = null;
let inlineEditorArticle: any = null;
let inlineEditorSelectedDatabaseId: string | undefined;

const inlineEditorTurndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});
inlineEditorTurndown.remove(['script', 'style']);

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[NotionClipper] Content script received message:', message.action);
  
  if (message.action === 'PING') {
    sendResponse({ success: true, message: 'PONG' });
    return false;
  }

  if (message.action === 'EXTRACT_PAGE_CONTENT') {
    extractPageContent()
      .then((article) => {
        console.log('[NotionClipper] Content extracted successfully');
        sendResponse({
          success: true,
          article,
        });
      })
      .catch((error) => {
        console.error('[NotionClipper] Content extraction error:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Extraction failed',
        });
      });

    return true; // Keep the channel open for async response
  }

  if (message.action === MESSAGE_ACTIONS.OPEN_INLINE_EDITOR) {
    try {
      openInlineEditor(message.data?.article, message.data?.selectedDatabaseId);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open inline editor',
      });
    }
    return false;
  }

  return false;
});

function openInlineEditor(article: any, selectedDatabaseId?: string) {
  if (!article) {
    throw new Error('Article is required for inline editor');
  }

  inlineEditorArticle = article;
  inlineEditorSelectedDatabaseId = selectedDatabaseId;

  if (inlineEditorRoot) {
    inlineEditorRoot.remove();
    inlineEditorRoot = null;
    inlineEditorEditable = null;
    inlineEditorStatus = null;
  }

  const root = document.createElement('div');
  root.id = 'notion-clipper-inline-editor';
  root.style.position = 'fixed';
  root.style.top = '0';
  root.style.left = '0';
  root.style.width = '100vw';
  root.style.height = '100vh';
  root.style.zIndex = '2147483646';
  root.style.background = 'rgba(17, 24, 39, 0.86)';
  root.style.backdropFilter = 'blur(2px)';
  root.style.display = 'flex';
  root.style.justifyContent = 'center';
  root.style.alignItems = 'center';
  root.style.padding = '24px';

  const panel = document.createElement('div');
  panel.style.width = 'min(1100px, 100%)';
  panel.style.height = 'min(90vh, 100%)';
  panel.style.background = '#fff';
  panel.style.borderRadius = '12px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.overflow = 'hidden';
  panel.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.gap = '12px';
  header.style.padding = '14px 16px';
  header.style.borderBottom = '1px solid #e5e7eb';

  const title = document.createElement('div');
  title.style.fontSize = '16px';
  title.style.fontWeight = '600';
  title.style.color = '#111827';
  title.textContent = `Preview & Edit: ${article.title || 'Untitled'}`;

  const status = document.createElement('span');
  status.style.fontSize = '12px';
  status.style.color = '#6b7280';
  status.textContent = '直接编辑渲染内容；框选后将恢复为 markdown 语法';
  inlineEditorStatus = status;

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save Draft';
  applyButtonStyle(saveButton, '#2563eb', '#ffffff');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  applyButtonStyle(closeButton, '#f3f4f6', '#111827');

  const body = document.createElement('div');
  body.style.flex = '1';
  body.style.padding = '16px';
  body.style.overflow = 'auto';
  body.style.background = '#f8fafc';

  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.style.minHeight = '100%';
  editor.style.padding = '16px';
  editor.style.border = '1px solid #e5e7eb';
  editor.style.borderRadius = '8px';
  editor.style.background = '#ffffff';
  editor.style.fontSize = '15px';
  editor.style.lineHeight = '1.65';
  editor.style.outline = 'none';
  editor.style.whiteSpace = 'normal';
  editor.style.wordBreak = 'break-word';
  editor.innerHTML = sanitizeHtml(marked.parse(article.content || '') as string);
  inlineEditorEditable = editor;

  editor.addEventListener('mouseup', () => {
    restoreSelectionToMarkdown(editor);
  });

  saveButton.addEventListener('click', () => {
    void saveInlineEditorDraft();
  });

  closeButton.addEventListener('click', () => {
    closeInlineEditor();
  });

  root.addEventListener('click', (event) => {
    if (event.target === root) {
      closeInlineEditor();
    }
  });

  document.addEventListener('keydown', handleInlineEditorKeydown, true);

  actions.appendChild(saveButton);
  actions.appendChild(closeButton);
  header.appendChild(title);
  header.appendChild(actions);
  body.appendChild(status);
  body.appendChild(editor);
  panel.appendChild(header);
  panel.appendChild(body);
  root.appendChild(panel);

  document.documentElement.appendChild(root);
  inlineEditorRoot = root;
  editor.focus();
}

function applyButtonStyle(button: HTMLButtonElement, background: string, color: string) {
  button.style.border = 'none';
  button.style.borderRadius = '6px';
  button.style.padding = '8px 12px';
  button.style.cursor = 'pointer';
  button.style.fontSize = '13px';
  button.style.fontWeight = '600';
  button.style.background = background;
  button.style.color = color;
}

function handleInlineEditorKeydown(event: KeyboardEvent) {
  if (!inlineEditorRoot) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeInlineEditor();
  }
}

function closeInlineEditor() {
  if (inlineEditorRoot) {
    inlineEditorRoot.remove();
    inlineEditorRoot = null;
    inlineEditorEditable = null;
    inlineEditorStatus = null;
  }
  document.removeEventListener('keydown', handleInlineEditorKeydown, true);
}

function restoreSelectionToMarkdown(container: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return;
  }

  const range = selection.getRangeAt(0);
  const common = range.commonAncestorContainer;
  const parentElement = common.nodeType === Node.ELEMENT_NODE
    ? (common as HTMLElement)
    : common.parentElement;

  if (!parentElement || !container.contains(parentElement)) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.appendChild(range.cloneContents());
  const selectedHtml = sanitizeHtml(wrapper.innerHTML);
  const selectedMarkdown = inlineEditorTurndown.turndown(selectedHtml).trim();
  if (!selectedMarkdown) {
    return;
  }

  range.deleteContents();
  const textNode = document.createTextNode(selectedMarkdown);
  range.insertNode(textNode);

  const nextRange = document.createRange();
  nextRange.setStartAfter(textNode);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);

  if (inlineEditorStatus) {
    inlineEditorStatus.textContent = '已将选区恢复为 markdown 语法，可继续编辑';
  }
}

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

async function saveInlineEditorDraft() {
  if (!inlineEditorEditable || !inlineEditorArticle) {
    return;
  }

  const html = sanitizeHtml(inlineEditorEditable.innerHTML || '');
  const markdown = inlineEditorTurndown.turndown(html);

  const response = await chrome.runtime.sendMessage({
    action: MESSAGE_ACTIONS.UPDATE_EDITOR_DRAFT_BY_URL,
    data: {
      url: inlineEditorArticle.url,
      selectedDatabaseId: inlineEditorSelectedDatabaseId,
      article: {
        ...inlineEditorArticle,
        content: markdown,
        rawHtml: html,
        contentFormat: 'markdown',
      },
    },
  });

  if (response?.success) {
    if (inlineEditorStatus) {
      inlineEditorStatus.textContent = '草稿已保存，回到插件弹窗即可直接保存到 Notion';
    }
    return;
  }

  if (inlineEditorStatus) {
    inlineEditorStatus.textContent = response?.error || '保存失败，请重试';
  }
}

/**
 * Extract page content using Readability and convert to Markdown
 */
async function extractPageContent(): Promise<any> {
  try {
    console.log('[NotionClipper] Starting content extraction...');

    // Clone the document to avoid mutating the original
    const clonedDoc = document.cloneNode(true) as Document;

    // Pre-process: Remove unnecessary elements that might confuse Readability
    const elementsToRemove = clonedDoc.querySelectorAll(
      '.ads, .ad, .sidebar, .comment, .comments, #comments, footer, nav, .social-share, .newsletter-signup, script, style, noscript, iframe'
    );
    elementsToRemove.forEach(el => el.parentNode?.removeChild(el));

    // Handle lazy loaded images (data-src -> src) commonly used on Wechat/Medium etc.
    const images = clonedDoc.querySelectorAll('img');
    images.forEach(img => {
      const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-original');
      if (dataSrc) {
        img.setAttribute('src', dataSrc);
      }
    });

    const extractionResult = extractSmartContent(clonedDoc);

    console.log('[NotionClipper] Article parsed:', {
      title: extractionResult.title,
      contentLength: extractionResult.html?.length,
      strategy: extractionResult.strategy,
    });

    // Convert HTML content to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    // Configure turndown to ignore scripts and styles if any remain
    turndownService.remove(['script', 'style']);

    const markdownContent = turndownService.turndown(extractionResult.html);

    // Extract original images from the page (for uploading)
    const pageImages = extractImages();
    const mainImage = extractMainImage();
    const favicon = extractFavicon();

    // Extract metadata
    const metadata = extractMetadata();

    const result = {
      title: extractionResult.title || document.title || 'Untitled',
      content: markdownContent,
      rawHtml: extractionResult.html,
      contentFormat: 'markdown',
      extractionStrategy: extractionResult.strategy,
      url: window.location.href,
      mainImage,
      favicon,
      images: pageImages,
      excerpt: extractionResult.excerpt,
      domain: new URL(window.location.href).hostname,
      publishDate: metadata.publishDate,
      authorName: metadata.authorName,
    };

    console.log('[NotionClipper] Extraction result:', {
      title: result.title,
      contentLength: markdownContent?.length,
      imagesCount: pageImages.length,
      mainImage: !!mainImage,
    });

    return result;
  } catch (error) {
    console.error('[NotionClipper] Content extraction error:', error);
    throw error;
  }
}

function extractSmartContent(
  doc: Document
): { title: string; html: string; excerpt?: string; strategy: 'readability' | 'fallback-main-content' | 'fallback-body' } {
  const reader = new Readability(doc);
  const article = reader.parse();

  if (article?.content?.trim()) {
    return {
      title: article.title || doc.title || 'Untitled',
      html: article.content,
      excerpt: article.excerpt || undefined,
      strategy: 'readability',
    };
  }

  const mainContent = doc.querySelector('main, article, .post-content, .article-content, .entry-content, [role="main"]');
  if (mainContent?.innerHTML?.trim()) {
    return {
      title: doc.title || 'Untitled',
      html: mainContent.innerHTML,
      strategy: 'fallback-main-content',
    };
  }

  return {
    title: doc.title || 'Untitled',
    html: doc.body?.innerHTML || '',
    strategy: 'fallback-body',
  };
}

/**
 * Extract images from the page
 */
function extractImages(): Array<any> {
  const images: Array<any> = [];
  const imageElements = document.querySelectorAll('img');

  imageElements.forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');

    if (src && !images.find((i) => i.src === src)) {
      images.push({
        src: resolveUrl(src),
        alt: img.getAttribute('alt'),
        width: img.naturalWidth || parseInt(img.getAttribute('width') || '0'),
        height: img.naturalHeight || parseInt(img.getAttribute('height') || '0'),
      });
    }
  });

  return images.slice(0, 20); // Limit to 20 images
}

/**
 * Extract main image from meta tags
 */
function extractMainImage() {
  // Try OpenGraph image
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const content = ogImage.getAttribute('content');
    if (content) return resolveUrl(content);
  }

  // Try Twitter image
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (twitterImage) {
    const content = twitterImage.getAttribute('content');
    if (content) return resolveUrl(content);
  }

  // Try first large image
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.naturalWidth > 200 && img.naturalHeight > 200) {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src) return resolveUrl(src);
    }
  }

  return undefined;
}

/**
 * Extract metadata from page
 */
function extractMetadata() {
  let publishDate: string | undefined;
  let authorName: string | undefined;

  // Try to find publish date
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="publish_date"]',
    'meta[itemprop="datePublished"]',
    'time[datetime]',
  ];

  for (const selector of dateSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      publishDate = element.getAttribute('content') || element.getAttribute('datetime') || undefined;
      if (publishDate) break;
    }
  }

  // Try to find author
  const authorSelectors = [
    'meta[property="article:author"]',
    'meta[name="author"]',
    'meta[itemprop="author"]',
    'span.author-name',
    'div.author',
  ];

  for (const selector of authorSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      authorName = element.getAttribute('content') || element.textContent?.trim() || undefined;
      if (authorName) break;
    }
  }

  return { publishDate, authorName };
}

/**
 * Extract favicon
 */
function extractFavicon(): string | undefined {
  const selectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const href = element.getAttribute('href');
      if (href) {
        return resolveUrl(href);
      }
    }
  }

  // Fallback to default location
  return new URL('/favicon.ico', window.location.origin).href;
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

console.log('Notion Clipper content script loaded');

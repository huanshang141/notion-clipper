import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

console.log('[NotionClipper] Content script loaded');

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
  return false;
});

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

    // Use Readability to extract content
    // We instantiate it directly since we imported it
    const reader = new Readability(clonedDoc);
    const article = reader.parse();

    if (!article) {
      throw new Error('Could not parse article content');
    }

    console.log('[NotionClipper] Article parsed:', {
      title: article.title,
      contentLength: article.content?.length,
    });

    // Convert HTML content to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    // Configure turndown to ignore scripts and styles if any remain
    turndownService.remove(['script', 'style']);

    const markdownContent = turndownService.turndown(article.content);

    // Extract original images from the page (for uploading)
    const pageImages = extractImages();
    const mainImage = extractMainImage();
    const favicon = extractFavicon();

    // Extract metadata
    const metadata = extractMetadata();

    const result = {
      title: article.title || document.title || 'Untitled',
      content: markdownContent, // Send Markdown instead of HTML
      url: window.location.href,
      mainImage,
      favicon,
      images: pageImages,
      excerpt: article.excerpt,
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

/**
 * Content Script
 * Runs in the context of web pages
 * Communicates with background script via chrome.runtime.sendMessage
 */

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'EXTRACT_PAGE_CONTENT') {
    extractPageContent()
      .then((article) => {
        sendResponse({
          success: true,
          article,
        });
      })
      .catch((error) => {
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
 * Extract page content using Readability
 */
async function extractPageContent(): Promise<any> {
  try {
    // Dynamically import Readability
    // Note: We'll bundle this with the extension
    const { Readability } = await importReadability();

    // Clone the document to avoid mutating the original
    const clonedDoc = document.cloneNode(true) as Document;

    // Use Readability to extract content
    const reader = new Readability(clonedDoc);
    const article = reader.parse();

    if (!article) {
      throw new Error('Could not extract article');
    }

    // Extract images from the original HTML
    const images = extractImages();
    const mainImage = extractMainImage();

    // Extract metadata
    const metadata = extractMetadata();

    // Convert HTML to Markdown (for now, keep as HTML)
    // Full implementation would use turndown library
    const content = article.content;

    return {
      title: article.title || document.title || 'Untitled',
      content,
      url: window.location.href,
      mainImage,
      images,
      excerpt: article.excerpt,
      domain: new URL(window.location.href).hostname,
      publishDate: metadata.publishDate,
      authorName: metadata.authorName,
    };
  } catch (error) {
    console.error('Content extraction error:', error);
    throw error;
  }
}

/**
 * Import Readability library
 * In the bundled extension, this will be available
 */
async function importReadability(): Promise<any> {
  // Check if Readability is already loaded
  if ((window as any).Readability) {
    return { Readability: (window as any).Readability };
  }

  // For now, provide a simple fallback
  // In full implementation, we'll bundle @mozilla/readability
  return {
    Readability: class {
      constructor(doc: Document) {}
      parse() {
        return {
          title: document.title,
          content: document.body.innerHTML,
          excerpt: '',
        };
      }
    },
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

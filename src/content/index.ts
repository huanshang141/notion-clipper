/**
 * Content Script
 * Runs in the context of web pages
 * Communicates with background script via chrome.runtime.sendMessage
 */

console.log('[NotionClipper] Content script loaded');

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[NotionClipper] Content script received message:', message.action);
  
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
 * Extract page content using Readability
 */
async function extractPageContent(): Promise<any> {
  try {
    console.log('[NotionClipper] Starting content extraction...');
    
    // Import Readability from global scope (injected by webpack bundle)
    if (typeof (window as any).Readability === 'undefined') {
      console.warn('[NotionClipper] Readability not found in window, attempting to load...');
      // Try to get Readability from the page context
      const Readability = await loadReadability();
      if (!Readability) {
        throw new Error('Readability library not available');
      }
      (window as any).Readability = Readability;
    }

    // Clone the document to avoid mutating the original
    const clonedDoc = document.cloneNode(true) as Document;

    // Use Readability to extract content
    const Readability = (window as any).Readability;
    const reader = new Readability(clonedDoc);
    const article = reader.parse();

    if (!article) {
      throw new Error('Could not parse article content');
    }

    console.log('[NotionClipper] Article parsed:', {
      title: article.title,
      contentLength: article.content?.length,
    });

    // Extract images from the original HTML
    const images = extractImages();
    const mainImage = extractMainImage();

    // Extract metadata
    const metadata = extractMetadata();

    // Convert HTML to Markdown (for now, keep as HTML)
    // Full implementation would use turndown library
    const content = article.content;

    const result = {
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

    console.log('[NotionClipper] Extraction result:', {
      title: result.title,
      contentLength: content?.length,
      imagesCount: images.length,
      mainImage: !!mainImage,
    });

    return result;
  } catch (error) {
    console.error('[NotionClipper] Content extraction error:', error);
    throw error;
  }
}

/**
 * Load Readability library with fallback
 */
async function loadReadability(): Promise<any> {
  try {
    // Check if Readability is already available globally
    if ((window as any).Readability) {
      return (window as any).Readability;
    }

    // Try to create a minimal Readability clone for DOM extraction
    // This is a fallback when the full library isn't available
    return class SimpleReadability {
      content: any;
      constructor(doc: Document, options?: any) {
        this.content = doc.body.innerHTML;
      }
      parse() {
        return {
          title: document.title,
          content: this.content,
          excerpt: '',
          byline: '',
        };
      }
    };
  } catch (error) {
    console.error('[NotionClipper] Failed to load Readability:', error);
    return null;
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

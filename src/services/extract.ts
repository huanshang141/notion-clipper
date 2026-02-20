/**
 * Content Extraction Service
 * Extracts article content from web pages using Readability
 */

import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { ExtractedArticle, ExtractedImage } from '../types';

class ExtractService {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      fence: '```',
    });
  }

  /**
   * Extract article content using Readability
   * (This method is called from content.js via IPC)
   * For now, we provide the core logic that will run in content.js
   */
  static getExtractionScript(): string {
    return `
(function() {
  // Load Readability library
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('dist/readability-bundle.js');
  document.head.appendChild(script);

  window.addEventListener('load', function() {
    try {
      const clonedDoc = document.cloneNode(true);
      const reader = new Readability(clonedDoc);
      const article = reader.parse();
      
      if (!article) {
        window.parent.postMessage({
          type: 'EXTRACTION_RESULT',
          success: false,
          error: 'Could not extract article'
        }, '*');
        return;
      }

      // Extract images
      const images = [];
      const imageElements = clonedDoc.querySelectorAll('img');
      imageElements.forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && !images.find(i => i.src === src)) {
          images.push({
            src,
            alt: img.getAttribute('alt'),
            width: img.naturalWidth || parseInt(img.getAttribute('width')),
            height: img.naturalHeight || parseInt(img.getAttribute('height')),
          });
        }
      });

      // Get main image from OpenGraph or first large image
      const mainImage = getMainImage(clonedDoc);

      window.parent.postMessage({
        type: 'EXTRACTION_RESULT',
        success: true,
        article: {
          title: article.title,
          content: article.content,
          url: window.location.href,
          mainImage,
          images,
          excerpt: article.excerpt,
          domain: new URL(window.location.href).hostname,
          publishDate: getPublishDate(clonedDoc),
          authorName: getAuthorName(clonedDoc),
        }
      }, '*');
    } catch (error) {
      window.parent.postMessage({
        type: 'EXTRACTION_RESULT',
        success: false,
        error: error.message
      }, '*');
    }
  }, { once: true });

  function getMainImage(doc) {
    // Try OpenGraph image first
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
      return ogImage.getAttribute('content');
    }

    // Try Twitter image
    const twitterImage = doc.querySelector('meta[name="twitter:image"]');
    if (twitterImage) {
      return twitterImage.getAttribute('content');
    }

    // Get first large image from content
    const images = doc.querySelectorAll('img');
    for (const img of images) {
      if (img.naturalWidth > 200 && img.naturalHeight > 200) {
        return img.getAttribute('src') || img.getAttribute('data-src');
      }
    }

    return null;
  }

  function getPublishDate(doc) {
    // Try various date meta tags
    const dateSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="publish_date"]',
      'meta[itemprop="datePublished"]',
      'time[datetime]',
    ];

    for (const selector of dateSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        return element.getAttribute('content') || element.getAttribute('datetime');
      }
    }

    return null;
  }

  function getAuthorName(doc) {
    // Try various author meta tags
    const authorSelectors = [
      'meta[property="article:author"]',
      'meta[name="author"]',
      'meta[itemprop="author"]',
      'span.author-name',
      'div.author',
    ];

    for (const selector of authorSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        return element.getAttribute('content') || element.textContent?.trim();
      }
    }

    return null;
  }
})();
    `;
  }

  /**
   * Extract article from HTML content (used by background script)
   */
  extractFromHTML(html: string, url: string): ExtractedArticle | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Use Readability to extract content
      const reader = new Readability(doc);
      const article = reader.parse();

      if (!article) {
        return null;
      }

      // Convert HTML to Markdown
      const markdown = this.turndownService.turndown(article.content);

      // Extract images from content
      const images = this.extractImages(article.content);

      // Extract main image
      const mainImage = this.extractMainImage(html);

      return {
        title: article.title || 'Untitled',
        content: markdown,
        url,
        mainImage,
        images,
        excerpt: article.excerpt,
        domain: new URL(url).hostname,
      };
    } catch (error) {
      console.error('Extraction failed:', error);
      return null;
    }
  }

  /**
   * Extract images from HTML content
   */
  private extractImages(html: string): ExtractedImage[] {
    const images: ExtractedImage[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const imgElements = doc.querySelectorAll('img');
    imgElements.forEach((img) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src && !images.find((i) => i.src === src)) {
        images.push({
          src,
          alt: img.getAttribute('alt') || undefined,
          width: parseInt(img.getAttribute('width') || '0'),
          height: parseInt(img.getAttribute('height') || '0'),
        });
      }
    });

    return images.slice(0, 20); // Limit to 20 images
  }

  /**
   * Extract main image from HTML
   */
  private extractMainImage(html: string): string | undefined {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try OpenGraph image
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const content = ogImage.getAttribute('content');
      if (content) return content;
    }

    // Try Twitter image
    const twitterImage = doc.querySelector('meta[name="twitter:image"]');
    if (twitterImage) {
      const content = twitterImage.getAttribute('content');
      if (content) return content;
    }

    return undefined;
  }

  /**
   * Clean up HTML content
   */
  cleanHTML(html: string): string {
    // Remove script and style tags
    let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    return cleaned;
  }
}

export default new ExtractService();

/**
 * Notion API Service
 * Handles all interactions with Notion API
 */

import requestService from '../utils/request';
import { marked } from 'marked';
import StorageService from './storage';
import {
  NotionDatabase,
  NotionProperty,
  ExtractedArticle,
  NotionAuthToken,
} from '../types';
import { COMMON_FIELD_NAMES, DEFAULT_NOTION_FIELD_TYPES } from '../utils/constants';

class NotionService {
  private lastRequestTime = 0;
  private requestCount = 0;
  private readonly RATE_LIMIT_CHECK_MS = 60000; // 1 minute window

  /**
   * Get user's workspace information
   */
  async getWorkspace() {
    try {
      const response = await requestService.notionGet<any>('/users/me');
      return {
        id: response.workspace_id,
        name: response.workspace?.name || response.workspace_name || 'My Workspace',
        icon: response.workspace?.icon,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get workspace: ${message}`);
    }
  }

  /**
   * List all databases accessible to the user
   * NOTE: Notion API 2025-09-03 returns data_source objects instead of database objects
   */
  async listDatabases(): Promise<NotionDatabase[]> {
    try {
      this.checkRateLimit();

      // In Notion API, search for data_source objects
      const response = await requestService.notionPost<any>(
        '/search',
        {
          filter: {
            value: 'data_source',
            property: 'object',
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time',
          },
          page_size: 100,
        }
      );

      this.recordRequest();

      if (!response.results || !Array.isArray(response.results)) {
        console.warn('Unexpected response format from data source search');
        return [];
      }

      return response.results
        .filter((ds: any) => ds && ds.id)
        .map((ds: any) => ({
          id: ds.id,  // This is the data_source_id
          databaseId: ds.id,  // In 2025-09-03 API, data_source_id is used as database ID
          title: ds.name || this.extractDataSourceTitle(ds), // data_source has 'name'
          icon: ds.icon,
          parent: ds.database_parent,  // Parent database info
          lastEditedTime: ds.last_edited_time,
        }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('429')) {
        throw new Error('Rate limited. Please try again in a moment.');
      }
      throw new Error(`Failed to list databases: ${message}`);
    }
  }

  /**
   * Get database schema (properties/fields) from data source
   * NOTE: In Notion API 2025-09-03, use data_source_id instead of database_id
   */
  async getDatabaseSchema(dataSourceId: string): Promise<NotionProperty[]> {
    try {
      if (!dataSourceId || typeof dataSourceId !== 'string') {
        throw new Error('Invalid data source ID');
      }

      this.checkRateLimit();

      // Use data_source endpoint instead of database endpoint
      const response = await requestService.notionGet<any>(
        `/data_sources/${dataSourceId}`
      );

      this.recordRequest();

      const properties = response.properties || {};
      const schema: NotionProperty[] = [];

      for (const [key, prop] of Object.entries(properties)) {
        if (prop && typeof prop === 'object') {
          schema.push({
            id: key,
            name: (prop as any).name || key,
            type: (prop as any).type || 'unknown',
            config: (prop as any)[(prop as any).type], // Store type-specific config
          });
        }
      }

      return schema;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('404')) {
        throw new Error('Data source not found. Check the data source ID.');
      }
      throw new Error(`Failed to get data source schema: ${message}`);
    }
  }

  /**
   * Auto-detect field mapping from database schema
   * Returns a mapping of Notion property IDs to extracted article fields
   */
  async autoDetectFieldMapping(databaseId: string): Promise<Record<string, any>> {
    try {
      const properties = await this.getDatabaseSchema(databaseId);
      const mapping: Record<string, any> = {};

      for (const prop of properties) {
        const detectedField = this.detectFieldType(prop.name, prop.type);
        if (detectedField) {
          mapping[prop.id] = {
            propertyId: prop.id,
            propertyName: prop.name,
            propertyType: prop.type,
            sourceField: detectedField,
            isEnabled: true,
            config: prop.config,
          };
        }
      }

      return mapping;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Detect which article field a Notion property should map to
   * based on the property name and type
   */
  private detectFieldType(
    propertyName: string,
    propertyType: string
  ): string | null {
    const lowerName = propertyName.toLowerCase();

    // Check title fields (priority: exact type match > name match)
    if (propertyType === 'title') {
      return 'title';
    }
    if (COMMON_FIELD_NAMES.TITLE.some((name) => lowerName.includes(name))) {
      return 'title';
    }

    // Check content/body fields
    if (
      propertyType === 'rich_text' &&
      COMMON_FIELD_NAMES.CONTENT.some((name) => lowerName.includes(name))
    ) {
      return 'content';
    }
    if (
      propertyType === 'text' &&
      COMMON_FIELD_NAMES.CONTENT.some((name) => lowerName.includes(name))
    ) {
      return 'content';
    }

    // Check URL fields
    if (propertyType === 'url') {
      return 'url';
    }
    if (COMMON_FIELD_NAMES.URL.some((name) => lowerName.includes(name))) {
      return 'url';
    }

    // Check cover/image fields
    if (
      propertyType === 'files' &&
      COMMON_FIELD_NAMES.COVER.some((name) => lowerName.includes(name))
    ) {
      return 'mainImage';
    }

    // Check tag fields
    if (
      (propertyType === 'select' || propertyType === 'multi_select') &&
      COMMON_FIELD_NAMES.TAG.some((name) => lowerName.includes(name))
    ) {
      return 'tags';
    }

    // Check date fields
    if (
      propertyType === 'date' &&
      COMMON_FIELD_NAMES.DATE.some((name) => lowerName.includes(name))
    ) {
      return 'publishedDate';
    }

    return null;
  }

  /**
   * Create a file upload and send content to Notion
   * Returns the file upload ID
   */
  async uploadFile(file: Blob, filename: string): Promise<string> {
    try {
      this.checkRateLimit();

      // Step 1: Create file upload
      const createResp = await requestService.notionPost<any>('/file_uploads', {
        mode: 'single_part',
        filename: filename,
        content_type: file.type || 'application/octet-stream',
      });
      this.recordRequest();

      if (!createResp.id) {
        throw new Error('Failed to create file upload session');
      }

      // Step 2: Send file content
      const formData = new FormData();
      formData.append('file', file, filename);

      const sendResp = await requestService.uploadFileToNotion(createResp.id, formData);
      this.recordRequest();

      if (sendResp.status === 'uploaded') {
        return sendResp.id;
      }

      throw new Error(`File upload incomplete: Status ${sendResp.status}`);
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  /**
   * Create a page in the specified data source
   * NOTE: In Notion API 2025-09-03, use data_source_id instead of database_id
   */
  async createPage(
    dataSourceId: string,
    article: ExtractedArticle,
    fieldMapping: Record<string, any>,
    imagesData?: Record<string, string> // filename/url -> upload_url or file_upload_id mapping
  ): Promise<{ id: string; url: string }> {
    try {
      if (!dataSourceId || !article) {
        throw new Error('Missing required parameters: dataSourceId or article');
      }

      this.checkRateLimit();

      const properties: Record<string, any> = {};

      // Build properties based on field mapping
      for (const [propId, mapping] of Object.entries(fieldMapping)) {
        if (!mapping || mapping.isEnabled === false) continue;

        let value: any = null;
        const propertyKey = mapping.propertyName || propId;

        if (this.isNotionPropertyValueObject(mapping)) {
          value = mapping;
        }

        // If mapping has a sourceField, extract from article
        else if (mapping.sourceField) {
          const sourceValue = (article as any)[mapping.sourceField];
          value = this.buildPropertyValue(
            mapping.propertyType,
            sourceValue,
            imagesData
          );
        } else if (mapping.customValue !== undefined) {
          // Use custom value if provided
          value = this.buildPropertyValue(
            mapping.propertyType,
            mapping.customValue,
            imagesData
          );
        }

        if (value !== null) {
          properties[propertyKey] = value;
        }
      }

      // Build page content (children blocks)
      const contentBlocks = this.buildContentBlocksFromMarkdown(article.content || '', imagesData);
      const children: any[] = [...contentBlocks];

      // Prepare Icon and Cover
      let icon: any = undefined;
      // Use favicon if available
      if (article.favicon && article.favicon.startsWith('http') && article.favicon.length <= 2000) {
        icon = {
          type: 'external',
          external: { url: article.favicon },
        };
      }

      let cover: any = undefined;
      // Use mainImage as cover
      if (article.mainImage) {
        // Check if main image was uploaded
        const mainImageRef = imagesData?.[article.mainImage] || article.mainImage;
        const isMainUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mainImageRef);
        
        if (isMainUuid) {
           cover = {
             type: 'file_upload',
             file_upload: { id: mainImageRef }
           };
        } else if (mainImageRef.startsWith('http') && mainImageRef.length <= 2000) {
           cover = {
             type: 'external',
             external: { url: mainImageRef }
           };
        }
      }

      // Create the page using data_source_id (2025-09-03 API)
      const initialChildren = children.slice(0, 100);
      const pagePayload: any = {
        parent: { 
          type: 'data_source_id',
          data_source_id: dataSourceId 
        },
        properties,
        children: initialChildren.length > 0 ? initialChildren : undefined,
      };

      if (icon) pagePayload.icon = icon;
      if (cover) pagePayload.cover = cover;

      const response = await requestService.notionPost<any>(
        '/pages',
        pagePayload
      );
      this.recordRequest();

      if (!response.id) {
        throw new Error('No page ID returned from Notion');
      }

      const remainingChildren = children.slice(100);
      if (remainingChildren.length > 0) {
        await this.appendBlockChildrenInBatches(response.id, remainingChildren);
      }

      return {
        id: response.id,
        url: `https://notion.so/${response.id.replace(/-/g, '')}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('429')) {
        throw new Error('Notion API rate limited. Please try again later.');
      }
      if (message.includes('401')) {
        throw new Error('Authentication failed. Please check your API key.');
      }
      throw new Error(`Failed to create page: ${message}`);
    }
  }

  private isNotionPropertyValueObject(value: any): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const propertyValueKeys = [
      'title',
      'rich_text',
      'url',
      'files',
      'checkbox',
      'select',
      'multi_select',
      'date',
      'number',
      'email',
      'phone_number',
      'people',
      'relation',
      'status',
    ];

    return propertyValueKeys.some((key) => key in value);
  }

  private buildContentBlocksFromMarkdown(markdown: string, imagesData?: Record<string, string>): any[] {
    if (!markdown || !markdown.trim()) {
      return [];
    }

    const tokens = marked.lexer(markdown, {
      gfm: true,
      breaks: true,
    });

    const blocks: any[] = [];
    tokens.forEach((token: any) => {
      if (token.type === 'heading') {
        const level = Math.min(Math.max(Number(token.depth || 1), 1), 3);
        const type = `heading_${level}`;
        const text = this.toPlainText(token.text || token.raw || '');
        this.pushTextBlocks(blocks, type, type, text);
        return;
      }

      if (token.type === 'paragraph') {
        const inlineTokens: any[] = Array.isArray(token.tokens) ? token.tokens : [];
        const imageTokens = inlineTokens.filter((t) => t.type === 'image');
        const text = this.toPlainText(token.text || token.raw || '');

        if (text) {
          this.pushTextBlocks(blocks, 'paragraph', 'paragraph', text);
        }

        imageTokens.forEach((imageToken) => {
          const originalUrl = (imageToken.href || '').trim();
          const imageRef = imagesData?.[originalUrl] || originalUrl;
          const imageBlock = this.buildImageBlock(imageRef, this.toPlainText(imageToken.text || ''));
          if (imageBlock) {
            blocks.push(imageBlock);
          }
        });
        return;
      }

      if (token.type === 'image') {
        const originalUrl = (token.href || '').trim();
        const imageRef = imagesData?.[originalUrl] || originalUrl;
        const imageBlock = this.buildImageBlock(imageRef, this.toPlainText(token.text || ''));
        if (imageBlock) {
          blocks.push(imageBlock);
        }
        return;
      }

      if (token.type === 'list') {
        const listType = token.ordered ? 'numbered_list_item' : 'bulleted_list_item';
        const items: any[] = Array.isArray(token.items) ? token.items : [];
        items.forEach((item) => {
          const text = this.toPlainText(item.text || item.raw || '');
          this.pushTextBlocks(blocks, listType, listType, text);
        });
        return;
      }

      if (token.type === 'code') {
        const codeText = token.text || '';
        this.splitTextByLimit(codeText, 2000).forEach((chunk) => {
          blocks.push({
            object: 'block',
            type: 'code',
            code: {
              language: (token.lang || 'plain text').substring(0, 20),
              rich_text: [
                {
                  type: 'text',
                  text: { content: chunk },
                },
              ],
            },
          });
        });
        return;
      }

      if (token.type === 'blockquote') {
        const text = this.toPlainText(token.text || token.raw || '');
        this.pushTextBlocks(blocks, 'quote', 'quote', text);
        return;
      }

      if (token.type === 'hr') {
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {},
        });
      }
    });

    return blocks;
  }

  private pushTextBlocks(blocks: any[], type: string, contentKey: string, text: string): void {
    if (!text) {
      return;
    }

    this.splitTextByLimit(text, 2000).forEach((chunk) => {
      blocks.push({
        object: 'block',
        type,
        [contentKey]: {
          rich_text: [
            {
              type: 'text',
              text: { content: chunk },
            },
          ],
        },
      });
    });
  }

  private toPlainText(text: string): string {
    return (text || '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .trim();
  }

  private splitTextByLimit(text: string, limit: number): string[] {
    if (!text || text.length <= limit) {
      return text ? [text] : [];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      chunks.push(text.slice(start, start + limit));
      start += limit;
    }

    return chunks;
  }

  private buildImageBlock(imageRef: string, alt?: string): any | null {
    if (!imageRef) {
      return null;
    }

    const caption = alt
      ? [
          {
            type: 'text',
            text: { content: alt.substring(0, 2000) },
          },
        ]
      : [];

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageRef);
    if (isUuid) {
      return {
        object: 'block',
        type: 'image',
        image: {
          type: 'file_upload',
          file_upload: { id: imageRef },
          caption,
        },
      };
    }

    if (!imageRef.startsWith('http') || imageRef.length > 2000) {
      return null;
    }

    return {
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: { url: imageRef },
        caption,
      },
    };
  }

  private async appendBlockChildrenInBatches(parentBlockId: string, children: any[]): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < children.length; i += batchSize) {
      const batch = children.slice(i, i + batchSize);
      await requestService.notionPatch(`/blocks/${parentBlockId}/children`, {
        children: batch,
      });
      this.recordRequest();
    }
  }

  async migrateExternalImageBlocks(pageId: string): Promise<{ processed: number; migrated: number; failed: number }> {
    const stats = { processed: 0, migrated: 0, failed: 0 };
    const queue: string[] = [pageId];

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = await this.listAllBlockChildren(parentId);

      for (const block of children) {
        if (block.has_children && block.id) {
          queue.push(block.id);
        }

        if (block.type === 'image' && block.image?.type === 'external' && block.image?.external?.url) {
          stats.processed += 1;
          try {
            const imageUrl = block.image.external.url;
            const blob = await this.downloadExternalImage(imageUrl);
            const filename = this.buildImageFilename(imageUrl, blob.type);
            const fileUploadId = await this.uploadFile(blob, filename);

            await requestService.notionPatch(`/blocks/${block.id}`, {
              image: {
                type: 'file_upload',
                file_upload: { id: fileUploadId },
                caption: block.image.caption || [],
              },
            });
            this.recordRequest();

            stats.migrated += 1;
          } catch (error) {
            stats.failed += 1;
            console.warn('[NotionService] Failed to migrate external image block:', block.id, error);
          }
        }
      }
    }

    return stats;
  }

  private async listAllBlockChildren(blockId: string): Promise<any[]> {
    const allChildren: any[] = [];
    let nextCursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const query = new URLSearchParams({ page_size: '100' });
      if (nextCursor) {
        query.set('start_cursor', nextCursor);
      }

      const response = await requestService.notionRequest<any>({
        method: 'GET',
        url: `/blocks/${blockId}/children?${query.toString()}`,
      });
      this.recordRequest();

      const results = Array.isArray(response.results) ? response.results : [];
      allChildren.push(...results);
      hasMore = Boolean(response.has_more);
      nextCursor = response.next_cursor || undefined;
    }

    return allChildren;
  }

  private async downloadExternalImage(url: string): Promise<Blob> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.blob();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildImageFilename(url: string, mimeType?: string): string {
    const urlPath = url.split('?')[0];
    const lastPart = urlPath.split('/').pop() || '';
    const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(lastPart);

    if (hasExt) {
      return lastPart;
    }

    const extension = this.getImageExtensionByMime(mimeType);
    return `image-${Date.now()}.${extension}`;
  }

  private getImageExtensionByMime(mimeType?: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };

    if (!mimeType) {
      return 'jpg';
    }

    return mimeToExt[mimeType] || 'jpg';
  }

  /**
   * Build a Notion property value based on type and source data
   */
  private buildPropertyValue(
    propertyType: string,
    value: any,
    imagesMap?: Record<string, string>
  ): any {
    if (!value && propertyType !== 'checkbox') {
      return null;
    }

    try {
      switch (propertyType) {
        case 'title':
          return {
            title: [
              {
                type: 'text',
                text: {
                  content: String(value || '').substring(0, 2000),
                },
              },
            ],
          };

        case 'rich_text':
        case 'text':
          return {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: String(value || '').substring(0, 2000),
                },
              },
            ],
          };

        case 'url':
          // Validate URL format
          const urlStr = String(value || '');
          if (urlStr && (urlStr.startsWith('http') || urlStr.startsWith('/'))) {
            return { url: urlStr };
          }
          return null;

        case 'files':
          // For images uploaded to Notion or external images
          if (imagesMap && Object.keys(imagesMap).length > 0) {
            const imageRef = Object.values(imagesMap)[0];
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageRef);
            
            if (isUuid) {
              return {
                files: [
                  {
                    name: 'image',
                    type: 'file_upload',
                    file_upload: { id: imageRef },
                  },
                ],
              };
            }
            
            return {
              files: [
                {
                  name: 'image',
                  type: 'external',
                  external: { url: imageRef },
                },
              ],
            };
          }
          // Try to use the value as an image URL
          if (value && String(value).startsWith('http')) {
            return {
              files: [
                {
                  name: 'image',
                  type: 'external',
                  external: { url: String(value) },
                },
              ],
            };
          }
          return null;

        case 'checkbox':
          return {
            checkbox: Boolean(value),
          };

        case 'select':
          const selectValue = String(value || '').substring(0, 100).trim();
          if (selectValue) {
            return {
              select: {
                name: selectValue,
              },
            };
          }
          return null;

        case 'multi_select':
          const tags = Array.isArray(value) ? value : [value];
          const validTags = tags
            .filter((tag) => tag)
            .map((tag) => ({
              name: String(tag).substring(0, 100).trim(),
            }))
            .filter((tag) => tag.name);

          if (validTags.length > 0) {
            return {
              multi_select: validTags,
            };
          }
          return null;

        case 'date':
          // Validate date format (YYYY-MM-DD or ISO 8601)
          const dateStr = String(value || '').substring(0, 10);
          if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return {
              date: {
                start: dateStr,
              },
            };
          }
          return null;

        case 'number':
          const num = Number(value);
          if (!isNaN(num)) {
            return { number: num };
          }
          return null;

        case 'email':
          const email = String(value || '').trim();
          if (email && email.includes('@')) {
            return { email };
          }
          return null;

        case 'phone_number':
          return { phone_number: String(value || '').trim() };

        default:
          console.warn(`Unsupported property type: ${propertyType}`);
          return null;
      }
    } catch (error) {
      console.error(`Error building property value for type ${propertyType}:`, error);
      return null;
    }
  }

  /**
   * Extract title from data source response
   */
  private extractDataSourceTitle(ds: any): string {
    // Data source from search results might have title directly
    if (ds.title && typeof ds.title === 'string') {
      return ds.title;
    }
    // Or in an array format
    if (Array.isArray(ds.title) && ds.title.length > 0) {
      return ds.title[0]?.plain_text || 'Untitled';
    }
    // Fallback to database title if available
    return 'Untitled';
  }

  /**
   * Extract title from various database response formats (legacy)
   */
  private extractTitle(db: any): string {
    if (db.title && typeof db.title === 'string') {
      return db.title;
    }
    if (Array.isArray(db.title) && db.title.length > 0) {
      return db.title[0]?.plain_text || 'Untitled';
    }
    if (db.properties?.Name?.title) {
      const nameTitle = db.properties.Name.title;
      if (Array.isArray(nameTitle) && nameTitle.length > 0) {
        return nameTitle[0]?.plain_text || 'Untitled';
      }
    }
    return 'Untitled';
  }

  /**
   * Rate limiting helpers
   */
  private checkRateLimit(): void {
    const now = Date.now();
    if (now - this.lastRequestTime > this.RATE_LIMIT_CHECK_MS) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Notion API limit is 3 requests per second
    // We check per minute to be conservative
    if (this.requestCount > 100) {
      throw new Error('Rate limit exceeded. Too many requests.');
    }
  }

  private recordRequest(): void {
    this.requestCount++;
  }

  /**
   * Get data source by ID (Notion API 2025-09-03)
   */
  async getDataSource(dataSourceId: string): Promise<any> {
    try {
      if (!dataSourceId || typeof dataSourceId !== 'string') {
        throw new Error('Invalid data source ID');
      }

      this.checkRateLimit();

      const response = await requestService.notionGet<any>(
        `/data_sources/${dataSourceId}`
      );

      this.recordRequest();
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get data source: ${message}`);
    }
  }

  /**
   * Query a data source (Notion API 2025-09-03)
   */
  async queryDataSource(
    dataSourceId: string,
    sorts?: any[],
    filter?: any,
    pageSize?: number
  ): Promise<any> {
    try {
      if (!dataSourceId || typeof dataSourceId !== 'string') {
        throw new Error('Invalid data source ID');
      }

      this.checkRateLimit();

      const response = await requestService.notionPost<any>(
        `/data_sources/${dataSourceId}/query`,
        {
          sorts: sorts || [],
          filter: filter || {},
          page_size: pageSize || 100,
        }
      );

      this.recordRequest();
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to query data source: ${message}`);
    }
  }

  /**
   * Reset client (called on logout)
   */
  reset(): void {
    requestService.resetNotionClient();
    this.lastRequestTime = 0;
    this.requestCount = 0;
  }
}

export default new NotionService();

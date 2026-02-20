/**
 * Notion API Service
 * Handles all interactions with Notion API
 */

import requestService from '../utils/request';
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

      // In Notion API 2025-09-03, search for data_source instead of database
      const response = await requestService.notionPost<any>(
        '/search',
        {
          filter: {
            value: 'database',  // Reverted to 'database' as 'data_source' is non-standard
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
          title: this.extractDataSourceTitle(ds),
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
   * Create a page in the specified data source
   * NOTE: In Notion API 2025-09-03, use data_source_id instead of database_id
   */
  async createPage(
    dataSourceId: string,
    article: ExtractedArticle,
    fieldMapping: Record<string, any>,
    imagesWithUrls?: Record<string, string> // filename -> upload_url mapping
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

        // If mapping has a sourceField, extract from article
        if (mapping.sourceField) {
          const sourceValue = (article as any)[mapping.sourceField];
          value = this.buildPropertyValue(
            mapping.propertyType,
            sourceValue,
            imagesWithUrls
          );
        } else if (mapping.customValue !== undefined) {
          // Use custom value if provided
          value = this.buildPropertyValue(
            mapping.propertyType,
            mapping.customValue,
            imagesWithUrls
          );
        }

        if (value !== null) {
          properties[propId] = value;
        }
      }

      this.recordRequest();

      // Build page content (children blocks)
      const children: any[] = [];

      // Add content as paragraph blocks if not already mapped
      if (article.content) {
        const contentLines = article.content.split('\n');
        const blockLimit = 20; // Notion has block limits per page

        for (let i = 0; i < Math.min(contentLines.length, blockLimit); i++) {
          const line = contentLines[i].trim();
          if (!line) continue;

          children.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: line.substring(0, 2000), // Notion text limit
                  },
                },
              ],
            },
          });
        }
      }

      // Add images as separate blocks
      if (article.images && article.images.length > 0) {
        const imageLimit = 10;
        for (let i = 0; i < Math.min(article.images.length, imageLimit); i++) {
          const img = article.images[i];
          if (img && img.src) {
            // Use uploaded URL if available, otherwise use original
            const imageUrl = imagesWithUrls?.[img.src] || img.src;
            
            // Determine if URL is data URI (for embedded images)
            const isDataUri = imageUrl.startsWith('data:');
            
            // Validate URL length (Notion API limit is 2000 characters)
            if (imageUrl.length > 2000) {
              console.warn(`[NotionService] Image URL too long (${imageUrl.length} chars). Skipping image.`);
              continue;
            }

            children.push({
              object: 'block',
              type: 'image',
              image: {
                type: 'external',
                external: {
                  url: imageUrl,
                },
              },
            });
          }
        }
      }

      // Prepare Icon and Cover
      let icon: any = undefined;
      // Use favicon if available and is a valid URL (not data URI if too long, but we'll try)
      if (article.favicon && article.favicon.startsWith('http')) {
        if (article.favicon.length <= 2000) {
          icon = {
            type: 'external',
            external: { url: article.favicon },
          };
        }
      }

      let cover: any = undefined;
      // Use mainImage as cover
      if (article.mainImage && article.mainImage.startsWith('http')) {
        if (article.mainImage.length <= 2000) {
          cover = {
            type: 'external',
            external: { url: article.mainImage },
          };
        }
      }

      // Create the page using database_id (standard API)
      const pagePayload: any = {
        parent: { database_id: dataSourceId },
        properties,
        children: children.length > 0 ? children : undefined,
      };

      if (icon) pagePayload.icon = icon;
      if (cover) pagePayload.cover = cover;

      const response = await requestService.notionPost<any>(
        '/pages',
        pagePayload
      );

      if (!response.id) {
        throw new Error('No page ID returned from Notion');
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
            const uploadedUrl = Object.values(imagesMap)[0];
            return {
              files: [
                {
                  name: 'image',
                  type: 'external',
                  external: { url: uploadedUrl },
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

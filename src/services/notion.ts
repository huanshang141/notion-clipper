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
  /**
   * Get user's workspace information
   */
  async getWorkspace() {
    try {
      const response = await requestService.notionGet<any>('/users/me');
      return {
        id: response.workspace_id,
        name: response.workspace?.name || 'My Workspace',
        icon: response.workspace?.icon,
      };
    } catch (error) {
      throw new Error(`Failed to get workspace: ${error}`);
    }
  }

  /**
   * List all databases accessible to the user
   */
  async listDatabases(): Promise<NotionDatabase[]> {
    try {
      const response = await requestService.notionPost<any>(
        '/search',
        {
          filter: {
            value: 'database',
            property: 'object',
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time',
          },
        }
      );

      return response.results.map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled',
        icon: db.icon,
        parent: db.parent,
      }));
    } catch (error) {
      throw new Error(`Failed to list databases: ${error}`);
    }
  }

  /**
   * Get database schema (properties/fields)
   */
  async getDatabaseSchema(databaseId: string): Promise<NotionProperty[]> {
    try {
      const response = await requestService.notionGet<any>(
        `/databases/${databaseId}`
      );

      const properties = response.properties || {};
      return Object.entries(properties).map(([key, prop]: any) => ({
        id: key,
        name: prop.name,
        type: prop.type,
        config: prop[prop.type], // Store type-specific config
      }));
    } catch (error) {
      throw new Error(`Failed to get database schema: ${error}`);
    }
  }

  /**
   * Auto-detect field mapping from database schema
   * Returns a mapping of Notion property IDs to extracted article fields
   */
  async autoDetectFieldMapping(databaseId: string): Promise<Record<string, any>> {
    const properties = await this.getDatabaseSchema(databaseId);
    const mapping: Record<string, any> = {};

    for (const prop of properties) {
      const detectedField = this.detectFieldType(prop.name, prop.type);
      if (detectedField) {
        mapping[prop.id] = {
          propertyName: prop.name,
          propertyType: prop.type,
          sourceField: detectedField,
          isEnabled: true,
        };
      }
    }

    return mapping;
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

    // Check title fields
    if (
      propertyType === 'title' ||
      COMMON_FIELD_NAMES.TITLE.some((name) => lowerName.includes(name))
    ) {
      return 'title';
    }

    // Check content/body fields
    if (
      propertyType === 'rich_text' &&
      COMMON_FIELD_NAMES.CONTENT.some((name) => lowerName.includes(name))
    ) {
      return 'content';
    }

    // Check URL fields
    if (
      propertyType === 'url' ||
      COMMON_FIELD_NAMES.URL.some((name) => lowerName.includes(name))
    ) {
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

    return null;
  }

  /**
   * Create a page in the specified database
   */
  async createPage(
    databaseId: string,
    article: ExtractedArticle,
    fieldMapping: Record<string, any>,
    imagesWithUrls?: Record<string, string> // filename -> upload_url mapping
  ): Promise<{ id: string; url: string }> {
    try {
      const properties: Record<string, any> = {};

      // Build properties based on field mapping
      for (const [propId, mapping] of Object.entries(fieldMapping)) {
        if (!mapping.isEnabled) continue;

        const value = this.buildPropertyValue(
          mapping.propertyType,
          mapping.sourceField ? (article as any)[mapping.sourceField] : mapping.customValue,
          imagesWithUrls
        );

        if (value !== null) {
          properties[propId] = value;
        }
      }

      // Build page content (children blocks)
      const children: any[] = [];

      // Add content as paragraph blocks if not already mapped
      if (article.content) {
        const contentParagraphs = article.content.split('\n').filter((p) => p.trim());
        for (const paragraph of contentParagraphs.slice(0, 20)) { // limit to 20 blocks
          children.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: paragraph.substring(0, 2000), // Notion text limit
                  },
                },
              ],
            },
          });
        }
      }

      // Add images as separate blocks
      if (article.images && article.images.length > 0) {
        for (const img of article.images.slice(0, 10)) { // limit to 10 images
          if (imagesWithUrls && imagesWithUrls[img.src]) {
            children.push({
              object: 'block',
              type: 'image',
              image: {
                type: 'file',
                file: {
                  url: imagesWithUrls[img.src],
                },
              },
            });
          }
        }
      }

      const response = await requestService.notionPost<any>(
        '/pages',
        {
          parent: { database_id: databaseId },
          properties,
          children,
        }
      );

      return {
        id: response.id,
        url: response.public_url || `https://notion.so/${response.id.replace(/-/g, '')}`,
      };
    } catch (error) {
      throw new Error(`Failed to create page: ${error}`);
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

    switch (propertyType) {
      case 'title':
        return {
          title: [
            {
              type: 'text',
              text: {
                content: String(value).substring(0, 2000),
              },
            },
          ],
        };

      case 'rich_text':
        return {
          rich_text: [
            {
              type: 'text',
              text: {
                content: String(value).substring(0, 2000),
              },
            },
          ],
        };

      case 'url':
        return {
          url: String(value),
        };

      case 'files':
        // For images uploaded to Notion
        if (imagesMap && Object.keys(imagesMap).length > 0) {
          const uploadedUrl = Object.values(imagesMap)[0]; // Use first uploaded image
          return {
            files: [
              {
                name: 'image',
                type: 'file',
                file: { url: uploadedUrl },
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
        return {
          select: {
            name: String(value).substring(0, 100),
          },
        };

      case 'multi_select':
        const tags = Array.isArray(value) ? value : [value];
        return {
          multi_select: tags.map((tag: any) => ({
            name: String(tag).substring(0, 100),
          })),
        };

      case 'date':
        return {
          date: {
            start: String(value),
          },
        };

      default:
        return null;
    }
  }

  /**
   * Get upload URL for uploading files/images to Notion
   */
  async getImageUploadUrl(imageData: Blob, filename: string): Promise<string> {
    try {
      // Notion uses S3 for file uploads
      // For MVP, we'll store the image as a file in the page
      // In production, consider using Notion's file upload API

      // For now, return a placeholder - actual implementation depends on your backend
      console.warn('Image upload not fully implemented - using external links');
      return '';
    } catch (error) {
      throw new Error(`Failed to get upload URL: ${error}`);
    }
  }

  /**
   * Reset client (called on logout)
   */
  reset(): void {
    requestService.resetNotionClient();
  }
}

export default new NotionService();

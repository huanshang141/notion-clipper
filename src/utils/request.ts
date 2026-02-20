/**
 * HTTP Request utilities with token handling
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import StorageService from '../services/storage';
import { NOTION_API_BASE, NOTION_API_VERSION } from './constants';

class RequestService {
  private notionAxios: AxiosInstance | null = null;
  private generalAxios: AxiosInstance;

  constructor() {
    this.generalAxios = axios.create({
      timeout: 10000,
    });
  }

  /**
   * Initialize Notion API client with authentication
   */
  async initNotionClient(): Promise<AxiosInstance> {
    if (this.notionAxios) {
      return this.notionAxios;
    }

    const token = await StorageService.getAuthToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    this.notionAxios = axios.create({
      baseURL: NOTION_API_BASE,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json',
      },
    });

    return this.notionAxios;
  }

  /**
   * Make authenticated request to Notion API
   */
  async notionRequest<T = any>(
    config: AxiosRequestConfig
  ): Promise<T> {
    const client = await this.initNotionClient();
    const response = await client.request<T>(config);
    return response.data;
  }

  /**
   * Simple GET request to Notion API
   */
  async notionGet<T = any>(url: string): Promise<T> {
    return this.notionRequest<T>({ method: 'GET', url });
  }

  /**
   * Simple POST request to Notion API
   */
  async notionPost<T = any>(url: string, data: any): Promise<T> {
    return this.notionRequest<T>({ method: 'POST', url, data });
  }

  /**
   * Simple PATCH request to Notion API
   */
  async notionPatch<T = any>(url: string, data: any): Promise<T> {
    return this.notionRequest<T>({ method: 'PATCH', url, data });
  }

  /**
   * Download a file (used for images)
   */
  async downloadFile(url: string): Promise<Blob> {
    const response = await this.generalAxios.get<Blob>(url, {
      responseType: 'blob',
      timeout: 15000,
    });
    return response.data;
  }

  /**
   * Upload file to a given URL with PUT method
   */
  async uploadFile(
    url: string,
    file: Blob,
    contentType?: string
  ): Promise<void> {
    await this.generalAxios.put(url, file, {
      headers: {
        'Content-Type': contentType || file.type || 'application/octet-stream',
      },
      timeout: 30000,
    });
  }

  /**
   * Reset the Notion client (e.g., after logout)
   */
  resetNotionClient(): void {
    this.notionAxios = null;
  }
}

export default new RequestService();

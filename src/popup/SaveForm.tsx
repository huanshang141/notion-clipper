/**
 * Save Form Component
 * Handles field mapping and saving articles to Notion
 */

import React, { useState, useEffect } from 'react';
import { sendToBackground } from '../utils/ipc';
import { ExtractedArticle, NotionDatabase, NotionProperty } from '../types';

interface FieldMappingConfig {
  propertyId: string;
  propertyName: string;
  propertyType: string;
  sourceField?: string;
  isEnabled: boolean;
  value?: any;
  config?: any;
}

const SOURCE_FIELD_OPTIONS = [
  { value: '', label: 'Not mapped' },
  { value: 'title', label: 'Page Title' },
  { value: 'content', label: 'Page Content' },
  { value: 'url', label: 'Url' },
  { value: 'mainImage', label: 'Main Image' },
  { value: 'favicon', label: 'Website Icon' },
  { value: 'authorName', label: 'Author' },
  { value: 'publishDate', label: 'Publish Date' },
  { value: 'excerpt', label: 'Excerpt' },
  { value: 'domain', label: 'Domain' },
  { value: 'custom', label: 'Custom Input' },
];

interface SaveFormProps {
  article: ExtractedArticle;
  databases: NotionDatabase[];
  selectedDatabaseId?: string;
  databaseSchema?: NotionProperty[];
  isSaving: boolean;
  onDatabaseChange: (databaseId: string) => void;
  onSave: (fieldMapping: Record<string, any>, article: ExtractedArticle) => Promise<void>;
  onOpenContentEditor: (article: ExtractedArticle) => Promise<void>;
}

export default function SaveForm({
  article,
  databases,
  selectedDatabaseId,
  databaseSchema,
  isSaving,
  onDatabaseChange,
  onSave,
  onOpenContentEditor,
}: SaveFormProps) {
  const [title, setTitle] = useState(article.title);
  const [fieldMappings, setFieldMappings] = useState<Record<string, FieldMappingConfig>>({});
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Build property values based on article data and field type
  const buildPropertyValue = (propertyType: string, sourceField?: string): any => {
    if (!sourceField) {
      return null;
    }

    const value = (article as any)[sourceField];
    
    if (!value && propertyType !== 'checkbox') {
      return null;
    }

    switch (propertyType) {
      case 'title':
        return {
          title: [
            {
              type: 'text',
              text: { content: String(value || '').substring(0, 2000) },
            },
          ],
        };

      case 'rich_text':
      case 'text':
        return {
          rich_text: [
            {
              type: 'text',
              text: { content: String(value || '').substring(0, 2000) },
            },
          ],
        };

      case 'url':
        const urlStr = String(value || '');
        if (urlStr && (urlStr.startsWith('http') || urlStr.startsWith('/'))) {
          return { url: urlStr };
        }
        return null;

      case 'files':
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
        return { checkbox: Boolean(value) };

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
        return null;
    }
  };

  useEffect(() => {
    setTitle(article.title);
  }, [article]);

  // Initialize field mapping from schema
  useEffect(() => {
    if (databaseSchema && databaseSchema.length > 0) {
      initializeFieldMapping();
    }
  }, [databaseSchema, article]);

  const initializeFieldMapping = async () => {
    try {
      // Get recommended field mapping from background script
      const response = await sendToBackground({
        action: 'GET_AUTO_FIELD_MAPPING',
        data: { databaseId: selectedDatabaseId },
      });

      const autoMapping =
        response.fieldMapping && typeof response.fieldMapping === 'object'
          ? (response.fieldMapping as Record<string, any>)
          : {};

      const newMappings: Record<string, FieldMappingConfig> = {};

      (databaseSchema || []).forEach((prop) => {
        const m = autoMapping[prop.id];
        newMappings[prop.id] = {
          propertyId: prop.id,
          propertyName: prop.name,
          propertyType: prop.type,
          sourceField: m?.sourceField || '',
          isEnabled: !!m?.sourceField,
          config: m?.config || prop.config,
        };
      });

      setFieldMappings(newMappings);
    } catch (error) {
      console.error('Failed to get auto field mapping:', error);
      // Fallback to simple mapping if auto-mapping fails
      fallbackFieldMapping();
    }
  };

  const fallbackFieldMapping = () => {
    const newMappings: Record<string, FieldMappingConfig> = {};

    // Define common field name patterns
    const COMMON_FIELD_NAMES = {
      TITLE: ['title', 'name', 'heading', '标题', 'headline', 'subject'],
      CONTENT: ['content', 'body', 'article', '内容', 'description'],
      URL: ['url', 'link', 'source', 'uri', '链接', 'web_url'],
      COVER: ['cover', 'image', 'main_image', 'thumbnail', '封面', 'featured_image'],
      EXCERPT: ['excerpt', 'summary', '摘要', 'abstract'],
    };

    if (databaseSchema) {
      databaseSchema.forEach((prop) => {
        const lowerName = prop.name.toLowerCase();
        let sourceField: string | undefined;

        if (prop.type === 'title' || COMMON_FIELD_NAMES.TITLE.some((n) => lowerName.includes(n))) {
          sourceField = 'title';
        } else if (
          (prop.type === 'rich_text' || prop.type === 'text') &&
          COMMON_FIELD_NAMES.CONTENT.some((n) => lowerName.includes(n))
        ) {
          sourceField = 'content';
        } else if (prop.type === 'url' || COMMON_FIELD_NAMES.URL.some((n) => lowerName.includes(n))) {
          sourceField = 'url';
        } else if (
          prop.type === 'files' &&
          COMMON_FIELD_NAMES.COVER.some((n) => lowerName.includes(n))
        ) {
          sourceField = 'mainImage';
        } else if (
          prop.type === 'rich_text' &&
          COMMON_FIELD_NAMES.EXCERPT.some((n) => lowerName.includes(n))
        ) {
          sourceField = 'excerpt';
        }

        newMappings[prop.id] = {
          propertyId: prop.id,
          propertyName: prop.name,
          propertyType: prop.type,
          sourceField,
          isEnabled: !!sourceField,
        };

        if (sourceField) {
          const value = buildPropertyValue(prop.type, sourceField);
          if (value !== null) {
            newMappings[prop.id].value = value;
          }
        }
      });

      setFieldMappings(newMappings);
    }
  };

  const handleFieldSourceChange = (propertyId: string, sourceField: string) => {
    setFieldMappings((prev) => {
      const current = prev[propertyId];
      if (!current) {
        return prev;
      }

      const next: FieldMappingConfig = {
        ...current,
        sourceField,
        isEnabled: !!sourceField,
      };

      if (sourceField === 'custom') {
        next.value = buildPropertyValueForValue(current.propertyType, '') || undefined;
      } else {
        delete next.value;
      }

      return {
        ...prev,
        [propertyId]: next,
      };
    });
  };

  const handleCustomValueChange = (propertyId: string, rawValue: string) => {
    setFieldMappings((prev) => {
      const current = prev[propertyId];
      if (!current) {
        return prev;
      }

      const builtValue = buildPropertyValueForValue(current.propertyType, rawValue);
      return {
        ...prev,
        [propertyId]: {
          ...current,
          value: builtValue,
        },
      };
    });
  };

  const handleDatabaseChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDatabaseId = e.target.value;
    setIsLoadingSchema(true);
    onDatabaseChange(newDatabaseId);
    // Schema loading is handled by parent, just reset loading state after a delay
    setTimeout(() => setIsLoadingSchema(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalArticle: ExtractedArticle = {
      ...article,
      title,
      content: article.content,
      contentFormat: 'markdown',
    };

    // Build final field mapping with current values
    const finalMapping: Record<string, any> = {};

    for (const [propId, config] of Object.entries(fieldMappings)) {
      if (!config.isEnabled) continue;

      if (config.sourceField && config.sourceField !== 'custom') {
        const value = buildPropertyValueFromArticle(finalArticle, config.propertyType, config.sourceField);
        if (value !== null) {
          finalMapping[propId] = value;
        }
      } else if (config.sourceField === 'custom' && config.value !== null) {
        finalMapping[propId] = config.value;
      }
    }

    await onSave(finalMapping, finalArticle);
  };

  const buildPropertyValueFromArticle = (
    sourceArticle: ExtractedArticle,
    propertyType: string,
    sourceField?: string
  ) => {
    if (!sourceField) {
      return null;
    }

    const value = (sourceArticle as any)[sourceField];
    if (value === undefined && sourceField === 'title') {
      return buildPropertyValueForValue(propertyType, sourceArticle.title);
    }
    return buildPropertyValueForValue(propertyType, value);
  };

  const buildPropertyValueForValue = (propertyType: string, value: any) => {
    if (!value && propertyType !== 'checkbox') {
      return null;
    }

    switch (propertyType) {
      case 'title':
        return {
          title: [
            {
              type: 'text',
              text: { content: String(value || '').substring(0, 2000) },
            },
          ],
        };

      case 'rich_text':
      case 'text':
        return {
          rich_text: [
            {
              type: 'text',
              text: { content: String(value || '').substring(0, 2000) },
            },
          ],
        };

      case 'url': {
        const urlStr = String(value || '');
        if (urlStr && (urlStr.startsWith('http') || urlStr.startsWith('/'))) {
          return { url: urlStr };
        }
        return null;
      }

      case 'files':
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
        return { checkbox: Boolean(value) };

      case 'select': {
        const selectValue = String(value || '').substring(0, 100).trim();
        return selectValue ? { select: { name: selectValue } } : null;
      }

      case 'multi_select': {
        const tags = Array.isArray(value) ? value : [value];
        const validTags = tags
          .filter((tag) => tag)
          .map((tag) => ({ name: String(tag).substring(0, 100).trim() }))
          .filter((tag) => tag.name);

        return validTags.length > 0 ? { multi_select: validTags } : null;
      }

      case 'date': {
        const dateStr = String(value || '').substring(0, 10);
        return dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)
          ? { date: { start: dateStr } }
          : null;
      }

      case 'number': {
        const num = Number(value);
        return !isNaN(num) ? { number: num } : null;
      }

      case 'email': {
        const email = String(value || '').trim();
        return email && email.includes('@') ? { email } : null;
      }

      case 'phone_number':
        return { phone_number: String(value || '').trim() };

      default:
        return null;
    }
  };

  return (
    <form className="save-form" onSubmit={handleSubmit}>
      {/* Article Preview */}
      <div className="article-preview">
        {article.mainImage && (
          <img src={article.mainImage} alt="Article preview" className="preview-image" />
        )}
        <h3>{title}</h3>
        <p className="preview-url">{article.domain}</p>
      </div>

      {/* Database Selection */}
      <div className="form-group">
        <label htmlFor="database">Save to Database</label>
        <select
          id="database"
          value={selectedDatabaseId || ''}
          onChange={handleDatabaseChange}
          disabled={isSaving || isLoadingSchema}
        >
          {databases.map((db) => (
            <option key={db.id} value={db.id}>
              {db.title}
            </option>
          ))}
        </select>
      </div>

      {/* Title Field */}
      <div className="form-group">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSaving}
        />
      </div>

      <div className="form-group">
        <label>Content (WYSIWYG edit + markdown sync)</label>
        <div className="schema-preview" style={{ marginTop: 8 }}>
          <p className="preview-url">Current markdown length: {article.content?.length || 0}</p>
          <button
            type="button"
            className="save-btn"
            style={{ marginTop: 8 }}
            onClick={() => onOpenContentEditor({ ...article, title })}
            disabled={isSaving}
          >
            Open In-Page Preview Editor
          </button>
          <p className="help-text" style={{ marginTop: 8 }}>
            编辑完成后点击 Save Draft，然后回到弹窗点击 Try Again 刷新。
          </p>
        </div>
      </div>

      {/* Schema Fields Preview */}
      {databaseSchema && databaseSchema.length > 0 && (
        <div className="schema-preview">
          <h4>Fields Mapping</h4>
          <ul>
            {databaseSchema.map((prop) => {
              const config = fieldMappings[prop.id];
              const hasMapping = !!(config?.isEnabled && config?.sourceField);
              return (
                <li
                  key={prop.id}
                  className={`field-item ${hasMapping ? 'mapped' : 'unmapped'} ${config?.propertyType}`}
                >
                  <div className="field-header">
                    <span className="field-name">{prop.name}</span>
                    <span className={`field-type ${config?.propertyType}`}>{config?.propertyType}</span>
                    {hasMapping && <span className="mapped-indicator">✓</span>}
                  </div>
                  <div className="field-mapping-row">
                    <span className="field-mapping-arrow">←</span>
                    <select
                      value={config?.sourceField || ''}
                      onChange={(e) => handleFieldSourceChange(prop.id, e.target.value)}
                      disabled={isSaving}
                    >
                      {SOURCE_FIELD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {config?.sourceField === 'custom' && (
                    <div className="field-custom-input">
                      <input
                        type="text"
                        placeholder="Custom value"
                        onChange={(e) => handleCustomValueChange(prop.id, e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="form-actions">
        <button
          type="submit"
          disabled={isSaving || !selectedDatabaseId}
          className="save-btn"
        >
          {isSaving ? 'Saving...' : 'Save to Notion'}
        </button>
      </div>
    </form>
  );
}


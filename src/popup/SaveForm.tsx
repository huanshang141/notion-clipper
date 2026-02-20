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

interface SaveFormProps {
  article: ExtractedArticle;
  databases: NotionDatabase[];
  selectedDatabaseId?: string;
  databaseSchema?: NotionProperty[];
  isSaving: boolean;
  onDatabaseChange: (databaseId: string) => void;
  onSave: (fieldMapping: Record<string, any>) => Promise<void>;
}

export default function SaveForm({
  article,
  databases,
  selectedDatabaseId,
  databaseSchema,
  isSaving,
  onDatabaseChange,
  onSave,
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

  const [fieldMapping, setFieldMapping] = useState<Record<string, any>>({});

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

      if (response.fieldMapping && typeof response.fieldMapping === 'object') {
        const newMappings: Record<string, FieldMappingConfig> = {};
        const newFieldMapping: Record<string, any> = {};

        for (const [propId, mapping] of Object.entries(response.fieldMapping)) {
          const m = mapping as any;
          newMappings[propId] = {
            propertyId: propId,
            propertyName: m.propertyName,
            propertyType: m.propertyType,
            sourceField: m.sourceField,
            isEnabled: m.isEnabled,
            config: m.config,
          };

          // Build property value if source field exists
          if (m.sourceField) {
            const value = buildPropertyValue(m.propertyType, m.sourceField);
            if (value !== null) {
              newMappings[propId].value = value;
              newFieldMapping[propId] = value;
            }
          }
        }

        setFieldMappings(newMappings);
        setFieldMapping(newFieldMapping);
      }
    } catch (error) {
      console.error('Failed to get auto field mapping:', error);
      // Fallback to simple mapping if auto-mapping fails
      fallbackFieldMapping();
    }
  };

  const fallbackFieldMapping = () => {
    const newMappings: Record<string, FieldMappingConfig> = {};
    const newFieldMapping: Record<string, any> = {};

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
            newFieldMapping[prop.id] = value;
          }
        }
      });

      setFieldMappings(newMappings);
      setFieldMapping(newFieldMapping);
    }
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

    // Build final field mapping with current values
    const finalMapping: Record<string, any> = {};

    for (const [propId, config] of Object.entries(fieldMappings)) {
      if (!config.isEnabled) continue;

      // Update value if title field
      if (config.propertyType === 'title' && config.sourceField === 'title') {
        finalMapping[propId] = {
          title: [
            {
              type: 'text',
              text: { content: title },
            },
          ],
        };
      } else if (config.value !== null) {
        finalMapping[propId] = config.value;
      }
    }

    await onSave(finalMapping);
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

      {/* Schema Fields Preview */}
      {databaseSchema && databaseSchema.length > 0 && (
        <div className="schema-preview">
          <h4>Fields to Save:</h4>
          <ul>
            {databaseSchema.map((prop) => {
              const config = fieldMappings[prop.id];
              const hasMapping = config?.isEnabled && config?.sourceField;
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
                  {config?.sourceField && (
                    <div className="field-source">
                      <small>← {config.sourceField}</small>
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

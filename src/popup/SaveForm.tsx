/**
 * Save Form Component
 * Handles field mapping and saving articles to Notion
 */

import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import TurndownService from 'turndown';
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
  onSave: (fieldMapping: Record<string, any>, article: ExtractedArticle) => Promise<void>;
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});
turndownService.remove(['script', 'style']);

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
  const [editedMarkdown, setEditedMarkdown] = useState(getInitialMarkdown(article));
  const [previewHtml, setPreviewHtml] = useState(sanitizeHtml(marked.parse(getInitialMarkdown(article)) as string));
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

  useEffect(() => {
    const initialMarkdown = getInitialMarkdown(article);
    setTitle(article.title);
    setEditedMarkdown(initialMarkdown);
    setPreviewHtml(sanitizeHtml(marked.parse(initialMarkdown) as string));
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

    const normalizedMarkdown = editedMarkdown.trim();
    const generatedPreviewHtml = sanitizeHtml(marked.parse(normalizedMarkdown || article.content || '') as string);
    const finalArticle: ExtractedArticle = {
      ...article,
      title,
      rawHtml: generatedPreviewHtml,
      content: normalizedMarkdown || article.content,
      contentFormat: 'markdown',
    };

    // Build final field mapping with current values
    const finalMapping: Record<string, any> = {};

    for (const [propId, config] of Object.entries(fieldMappings)) {
      if (!config.isEnabled) continue;

      if (config.sourceField) {
        const value = buildPropertyValueFromArticle(finalArticle, config.propertyType, config.sourceField);
        if (value !== null) {
          finalMapping[propId] = value;
        }
      } else if (config.value !== null) {
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

  const handleEditorInput = (nextHtml: string) => {
    const sanitized = sanitizeHtml(nextHtml);
    const markdown = turndownService.turndown(sanitized);
    setEditedMarkdown(markdown);
    setPreviewHtml(sanitized);
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
        <label htmlFor="content-editor">Content (WYSIWYG edit + markdown sync)</label>
        <div className="live-editor-grid">
          <div
            id="content-editor"
            className="live-editor-textarea"
            contentEditable={!isSaving}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            onInput={(e) => handleEditorInput((e.currentTarget as HTMLDivElement).innerHTML)}
          />
          <div className="live-editor-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
        <small className="help-text">最终保存使用编辑后的 Markdown 内容。</small>
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

function getInitialMarkdown(article: ExtractedArticle): string {
  if (article.content && article.content.trim()) {
    return article.content;
  }

  if (article.rawHtml && article.rawHtml.trim()) {
    return turndownService.turndown(article.rawHtml);
  }

  return '';
}

function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const blockedTags = ['script', 'style', 'iframe', 'object', 'embed', 'noscript'];

  blockedTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }

      if ((name === 'src' || name === 'href') && value.startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}


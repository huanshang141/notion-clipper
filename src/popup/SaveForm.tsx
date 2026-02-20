/**
 * Save Form Component
 */

import React, { useState, useEffect } from 'react';
import { ExtractedArticle, NotionDatabase, NotionProperty } from '../types';

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
  const [fieldMapping, setFieldMapping] = useState<Record<string, any>>({});
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Initialize field mapping from schema
  useEffect(() => {
    if (databaseSchema) {
      const mapping: Record<string, any> = {};

      databaseSchema.forEach((prop) => {
        // Simple auto-mapping based on field type
        let value: any = null;

        switch (prop.type) {
          case 'title':
            value = {
              title: [
                {
                  type: 'text',
                  text: { content: title },
                },
              ],
            };
            break;

          case 'url':
            value = { url: article.url };
            break;

          case 'files':
            if (article.mainImage) {
              value = {
                files: [
                  {
                    name: 'image',
                    type: 'file',
                    file: { url: article.mainImage },
                  },
                ],
              };
            }
            break;

          case 'rich_text':
            // For content or excerpt
            const fieldName = prop.name.toLowerCase();
            if (fieldName.includes('content') || fieldName.includes('body')) {
              value = {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: article.content.substring(0, 2000) },
                  },
                ],
              };
            } else if (fieldName.includes('excerpt')) {
              value = {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: article.excerpt || '' },
                  },
                ],
              };
            }
            break;
        }

        if (value !== null) {
          mapping[prop.id] = value;
        }
      });

      setFieldMapping(mapping);
    }
  }, [databaseSchema, title, article]);

  const handleDatabaseChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDatabaseId = e.target.value;
    setIsLoadingSchema(true);
    onDatabaseChange(newDatabaseId);
    // Schema loading is handled by parent, just reset loading state after a delay
    setTimeout(() => setIsLoadingSchema(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalMapping = {
      ...fieldMapping,
      // Ensure title is updated
      [Object.keys(fieldMapping).find(
        (key) => databaseSchema?.find((p) => p.id === key)?.type === 'title'
      ) || 'title']: {
        title: [
          {
            type: 'text',
            text: { content: title },
          },
        ],
      },
    };

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
              const hasMapping = fieldMapping[prop.id];
              return (
                <li key={prop.id} className={hasMapping ? 'mapped' : 'unmapped'}>
                  <span className="field-name">{prop.name}</span>
                  <span className={`field-type ${prop.type}`}>{prop.type}</span>
                  {hasMapping && <span className="mapped-indicator">✓</span>}
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

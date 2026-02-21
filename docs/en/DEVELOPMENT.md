# Notion Clipper Development Guide

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript + React
- Webpack
- Readability + Turndown (content extraction & Markdown conversion)

## Directory Responsibilities

- `src/background/`: background service worker, handles messaging and Notion API interaction
- `src/content/`: page content extraction and in-page preview editor
- `src/popup/`: extension popup (login, mapping, save)
- `src/options/`: settings page (theme, download images, debug toggles)
- `src/services/`: authentication, Notion, storage, image processing
- `src/types/`: type definitions

## Core Data Flow

1. The popup emits `EXTRACT_CONTENT`
2. Background forwards it to the content script to scrape page content
3. The popup shows databases and field mapping then sends `SAVE_TO_NOTION`
4. Background calls `NotionService.createPage` to persist to Notion

## In‑page Preview Editor

- The content script injects a preview layer into the original page (Shadow DOM)
- Supports theme syncing (light/dark)
- Selected text can be restored as Markdown via `Restore Selection` or `Ctrl/Cmd + Shift + M`

## Theme Mechanism

- Uses `chrome.storage.sync` key `notion_clipper_data.settings.theme`
- Value is `light` or `dark`
- Falls back to system `prefers-color-scheme` if unset

## Local Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Debugging

- Background: open extension details page → Service Worker inspect
- Popup: right-click the extension icon → Inspect popup
- Content script: use the page DevTools console

## API & Authentication

- Uses Notion Internal Integration Token (prefix `ntn_`)
- API version: `2025-09-03`

## Public Repository Notes

- Do not commit real tokens / cookies / local account info
- `.env`, `dist/`, and local logs should remain ignored

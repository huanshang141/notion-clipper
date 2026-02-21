# Notion Clipper - AI Agent Instructions

A Chrome extension (Manifest V3) for saving web content to Notion. Built with React, TypeScript, and Webpack.

## Quick Start

```bash
npm install
npm run dev     # Development build with watch
npm run build   # Production build
```

Load unpacked extension from `dist/` directory in Chrome.

## Code Style

### Component Patterns

- **Use functional components only** with React Hooks (no class components)
- State management: Single state object with `setState((prev) => ({ ...prev, ... }))`
- Example: [src/popup/App.tsx](../src/popup/App.tsx), [src/editor/EditorApp.tsx](../src/editor/EditorApp.tsx)

### Import Order

```typescript
import { useState } from "react"; // 1. React/external libs
import { sendToBackground } from "@/utils/ipc"; // 2. Local utilities (@/ alias)
import { ExtractedArticle } from "@/types"; // 3. Types
import "./App.css"; // 4. CSS last
```

### File Naming

- Components: PascalCase `.tsx` (App.tsx, LoginForm.tsx)
- Services: camelCase `.ts` (auth.ts, notion.ts)
- Entry points: `index.ts` or `index.tsx`

### CSS Organization

- Separate `.css` files per component (no CSS modules)
- Use CSS custom properties for theming: `--primary-color`, `--background`
- Theme switching via `data-theme` attribute
- Example: [src/popup/App.css](../src/popup/App.css)

## Architecture

### Five Extension Parts

1. **Background** ([src/background/index.ts](../src/background/index.ts))
   - Service worker (Manifest V3)
   - Central message router via `chrome.runtime.onMessage`
   - All API calls coordinated here

2. **Content Script** ([src/content/index.ts](../src/content/index.ts))
   - Injected into all pages
   - Extracts content using `@mozilla/readability`
   - Converts HTML → Markdown with `turndown`
   - Inline editor via Shadow DOM

3. **Popup** ([src/popup/](../src/popup/))
   - Main UI: [App.tsx](../src/popup/App.tsx) manages auth/save state
   - [LoginForm.tsx](../src/popup/LoginForm.tsx): API key authentication
   - [SaveForm.tsx](../src/popup/SaveForm.tsx): Database selection + field mapping

4. **Options** ([src/options/SettingsPage.tsx](../src/options/SettingsPage.tsx))
   - API key management, theme, debug settings

5. **Editor** ([src/editor/EditorApp.tsx](../src/editor/EditorApp.tsx))
   - Standalone editor page with bidirectional HTML ↔ Markdown conversion

### Communication Pattern

**Always use the IPC wrapper** ([src/utils/ipc.ts](../src/utils/ipc.ts)):

```typescript
// From popup/options → background
const response = await sendToBackground({
  action: "AUTHENTICATE",
  data: { apiKey },
});

// Background → content script
await sendToContentScript(tabId, {
  action: "EXTRACT_PAGE_CONTENT",
});
```

Message actions in [src/utils/constants.ts](../src/utils/constants.ts).

### Service Layer

**Use singleton services** ([src/services/](../src/services/)):

- **[auth.ts](../src/services/auth.ts)**: Notion API key authentication
- **[notion.ts](../src/services/notion.ts)**: Notion API wrapper (uses API v2025-09-03)
- **[storage.ts](../src/services/storage.ts)**: Chrome Storage abstraction
  - `chrome.storage.sync`: Persistent cross-device (auth, settings)
  - `chrome.storage.local`: Session data (editor drafts)
- **[image.ts](../src/services/image.ts)**: Image download/upload

**Always import services**, never call Chrome APIs directly from components:

```typescript
import StorageService from "@/services/storage";
const token = await StorageService.getAuthToken();
```

## Project Conventions

### Notion API Integration

- **API Version**: `2025-09-03` (set in [constants.ts](../src/utils/constants.ts))
- **Important**: Use `data_source` objects, not `database` objects
  - Search: `filter: { value: 'data_source' }`
  - Endpoint: `/data_sources/{id}` not `/databases/{id}`
- **Authentication**: Internal Integration tokens (prefix `ntn_`, not OAuth)
- Rate limit tracking in [notion.ts](../src/services/notion.ts)

Example from [src/services/notion.ts](../src/services/notion.ts#L46-L79):

```typescript
const response = await client.post("/search", {
  filter: { value: "data_source", property: "object" },
});
```

### Type Definitions

**All types in** [src/types/index.ts](../src/types/index.ts). Key interfaces:

```typescript
interface ExtractedArticle {
  title: string;
  content: string; // Markdown format
  rawHtml?: string; // For editor
  url: string;
  images: ExtractedImage[];
}

interface ChromeMessage<T = any> {
  action: string;
  data?: T;
}
```

### Security

- **API tokens**: Stored in `chrome.storage.sync` (encrypted), never logged
- **Token validation**: Must start with `ntn_` prefix
- **HTML sanitization**: [EditorApp.tsx](../src/editor/EditorApp.tsx#L8-L36) removes script/iframe/event handlers
- **No `.env` files**: API keys provided at runtime by users

## Build & Test

### Webpack Configuration

**Entry points** ([webpack.config.js](../webpack.config.js)):

- `background`, `content`, `popup`, `editor`, `options`, `popupThemeInit`

**Path alias**: `@/` → `src/` (configured in both tsconfig and webpack)

### Current Limitations

⚠️ **No test framework installed** - add Jest/Vitest when needed  
⚠️ **ESLint disabled** - `npm run lint` currently skipped  
⚠️ **Development mode hardcoded** - webpack config needs env variables

## Common Tasks

### Adding a New Message Action

1. Add constant to [src/utils/constants.ts](../src/utils/constants.ts)
2. Add handler in [src/background/index.ts](../src/background/index.ts)
3. Send from component via `sendToBackground()`

### Adding a Notion Database Field

1. Fetch schema with `NotionService.getDatabaseSchema()`
2. Map to Notion property type in [src/services/notion.ts](../src/services/notion.ts)
3. Update field mapping UI in [SaveForm.tsx](../src/popup/SaveForm.tsx)

### Theme Support

- Add CSS variables to component `.css` file
- Use `[data-theme='dark']` selectors for dark mode
- Theme persisted in chrome.storage.sync automatically

## Error Handling

**Always wrap async operations**:

```typescript
try {
  const result = await someAsyncOperation();
  setState({ success: true, data: result });
} catch (error) {
  setState({
    error: error instanceof Error ? error.message : "Unknown error",
  });
}
```

## Development Workflow

1. Make code changes
2. `npm run dev` watches and rebuilds
3. Click extension reload button in Chrome
4. Test in browser

**No hot reload** - manual extension reload required.

## Key Files Reference

- [manifest.json](../manifest.json): Extension manifest (Manifest V3)
- [src/background/index.ts](../src/background/index.ts): Central message router (500+ lines)
- [src/services/notion.ts](../src/services/notion.ts): Notion API client (1200+ lines)
- [src/types/index.ts](../src/types/index.ts): All TypeScript interfaces
- [docs/zh/DEVELOPMENT.md](../docs/zh/DEVELOPMENT.md): Chinese development guide

# Notion Clipper Test Plan

## Goal

Verify the core flows in the current release: authentication, extraction, mapping, preview editing, saving, and theme switching.

## Environment Setup

1. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
2. Load `dist/` into Chrome
3. Prepare a Notion integration (token with prefix `ntn_`) and a shared database

## Manual Test Checklist

### A. Authentication & Session

- Valid token allows login
- Invalid token shows an error
- Session persists after reopening the popup
- Logout returns to the login page

### B. Extraction & Mapping

- Opening an article page extracts title, body, URL, and domain
- Database list and schema load correctly
- Field mappings auto-populate and can be edited
- Custom field values may be saved

### C. In-Page Preview Editor

- Popup can open the in-page preview editor
- Only the `Close` button exits (prevent overlay clicks)
- Selection can be restored as Markdown via `Restore Selection` / `Ctrl/Cmd+Shift+M`
- `Save Draft` returns to popup and loads the latest draft

### D. Save to Notion

- Returns page URL on success
- Properties match the mapping
- Body blocks are created correctly
- Images upload/transfer when the source is accessible

### E. Theme

- Popup icon toggles light/dark theme
- In-page preview follows the same theme
- Theme persists across open/close cycles

## Scripted Tests

Two scripts remain:

1. Full API flow:
   ```bash
   NOTION_TEST_API_KEY=ntn_your_key_here node tests/verify-api-complete.js
   ```
2. Integration:
   ```bash
   NOTION_TEST_API_KEY=ntn_your_key_here node tests/integration.test.ts
   ```

## Pre-release Acceptance

- `npm run build` passes
- All critical paths A–E succeed
- No real tokens or sensitive data committed

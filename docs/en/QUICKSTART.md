# Notion Clipper Quickstart

## 1. Install and build

```bash
npm install
npm run build
```

## 2. Load the extension

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the project's `dist/` directory

## 3. Configure Notion

1. Visit <https://www.notion.so/my-integrations>
2. Create an integration and obtain an `ntn_` token
3. Create or choose a database and invite the integration

Recommended fields in the database:

- `Title` (title, required)
- `URL` (url)
- `Content` (rich_text)
- `Cover` (files, optional)

## 4. First save

1. Open any article page
2. Click the extension icon and enter the Notion token
3. Choose a database
4. Adjust field mappings as needed
5. Click `Save to Notion`

## 5. Optional: in-page preview editing

1. In the popup click `Open In-Page Preview Editor`
2. Edit content directly on the page
3. Select text and use `Restore Selection` (or `Ctrl/Cmd+Shift+M`) to convert back to Markdown
4. Click `Save Draft` and return to the popup to save

## FAQ

- Invalid token: make sure it starts with `ntn_`
- Database not visible: ensure the database is shared with the integration
- Some images not saved: typically due to source restrictions or unreachable URLs

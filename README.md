# Notion Clipper

[中文版本](README_zh.md)

A Chrome extension for saving web content to a Notion database with one click.
Built with Manifest V3, React, and TypeScript.

## Features

- Extract article body and convert it to Markdown
- In‑page preview editor (WYSIWYG + Markdown restore)
- Auto‑detect Notion database fields and support manual mapping
- Download/upload images to Notion
- Light/dark theme support (popup + in‑page preview)

## Quick Start

```bash
npm install
npm run build
```

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click **Load unpacked**
4. Select the project’s `dist/` directory

## Development commands

```bash
npm run dev
npm run build
npm run lint
```

## Authentication

- Uses a Notion Internal Integration Token (prefix `ntn_`)
- Enter the token in the popup; it’s not stored in any file

## Documentation

All docs now reside under the `docs/` folder. English is the default language, with 中文 versions available for convenience.

- **English (default)**
  - [Quickstart](docs/en/QUICKSTART.md)
  - [Development](docs/en/DEVELOPMENT.md)
  - [Test Plan](docs/en/TEST_PLAN.md)
- **中文**
  - [快速开始](docs/zh/QUICKSTART.md)
  - [开发指南](docs/zh/DEVELOPMENT.md)
  - [测试计划](docs/zh/TEST_PLAN.md)

## Security & Public Repository

- `.env` is ignored; never commit real keys
- Only a placeholder `.env.example` is included

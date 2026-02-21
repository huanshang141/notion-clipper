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

## Highlights

- **Automatic External Image Preservation**: Automatically downloads external images and uploads them to Notion, preventing link rot and ensuring content remains accessible
- **Simple API Key Configuration**: Easy-to-use token-based authentication with granular permission control via Notion's Internal Integration API
- **Lightweight & Focused**: A minimal, focused extension that does one thing well—save web content to Notion—without unnecessary features or complexity

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

## Reference Projects

This project is inspired by and references the following open-source projects:

- [web-clipper](https://github.com/webclipper/web-clipper) - An excellent open-source web clipper
- [Save to Notion Browser Extension](https://microsoftedge.microsoft.com/addons/detail/save-to-notion/mhbgebmjigmgkdmehblomgoappmeckfa) - A popular browser extension for saving to Notion

## Open Source Dependencies

This project is built with the following open-source libraries:

**Core Dependencies:**
- [React](https://react.dev/) - JavaScript library for building user interfaces
- [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript
- [@notionhq/client](https://github.com/makenotion/notion-sdk-js) - Official Notion JavaScript SDK
- [@mozilla/readability](https://github.com/mozilla/readability) - Content extraction library by Mozilla
- [turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown converter
- [marked](https://github.com/markedjs/marked) - Markdown parser and compiler
- [axios](https://github.com/axios/axios) - Promise-based HTTP client

**Build Tools:**
- [Webpack](https://webpack.js.org/) - Module bundler
- [Babel](https://babeljs.io/) - JavaScript compiler
- [ESLint](https://eslint.org/) - JavaScript linter
- [Copy Webpack Plugin](https://github.com/webpack-contrib/copy-webpack-plugin) - Copy files in webpack
- [HTML Webpack Plugin](https://github.com/jantimon/html-webpack-plugin) - Generate HTML files

## Security & Public Repository

- `.env` is ignored; never commit real keys
- Only a placeholder `.env.example` is included

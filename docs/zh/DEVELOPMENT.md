# Notion Clipper 开发指南

## 技术栈

- Chrome Extension Manifest V3
- TypeScript + React
- Webpack
- Readability + Turndown（提取与 Markdown 转换）

## 目录职责

- `src/background/`: 后台 Service Worker，统一处理消息、Notion API 交互
- `src/content/`: 页面内容提取与 In-page Preview Editor
- `src/popup/`: 插件弹窗（登录、映射、保存）
- `src/options/`: 设置页面（主题、下载图片、调试开关）
- `src/services/`: 认证、Notion、存储、图片处理
- `src/types/`: 类型定义

## 核心数据流

1. Popup 发起 `EXTRACT_CONTENT`
2. Background 转发给 Content Script 提取页面内容
3. Popup 显示数据库、字段映射并提交 `SAVE_TO_NOTION`
4. Background 调用 `NotionService.createPage` 保存到 Notion

## In-page Preview Editor

- 通过 Content Script 在原页面注入预览编辑层（Shadow DOM）
- 支持主题同步（light/dark）
- 支持选区恢复 Markdown：`Restore Selection` 或 `Ctrl/Cmd + Shift + M`

## 主题机制

- 统一使用 `chrome.storage.sync` 下 `notion_clipper_data.settings.theme`
- 值为 `light` / `dark`
- 若未设置，按系统 `prefers-color-scheme` 回退

## 本地开发

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 调试方式

- Background: 扩展详情页 -> Service Worker 检查
- Popup: 右键扩展图标 -> 检查弹出内容
- Content Script: 页面 DevTools 控制台

## API 与认证

- 使用 Notion Internal Integration Token（`ntn_` 前缀）
- 版本：`2025-09-03`

## 公开仓库注意事项

- 不要提交真实 Token / Cookie / 本地账号信息
- `.env`、`dist/`、本地日志等应保持忽略

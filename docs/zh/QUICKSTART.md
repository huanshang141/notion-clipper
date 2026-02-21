# Notion Clipper 快速开始

## 1. 安装与构建

```bash
npm install
npm run build
```

## 2. 加载扩展

1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择项目 `dist/` 目录

## 3. 配置 Notion

1. 打开 <https://www.notion.so/my-integrations>
2. 创建 Integration，拿到 `ntn_` 开头的 Token
3. 创建/选择一个数据库并把 Integration 邀请进去

建议数据库至少有这些字段：

- `Title`（title，必需）
- `URL`（url）
- `Content`（rich_text）
- `Cover`（files，可选）

## 4. 首次保存

1. 打开任意文章页面
2. 点击扩展图标，输入 Notion Token
3. 选择数据库
4. 按需调整字段映射
5. 点击 `Save to Notion`

## 5. 可选：页面内预览编辑

1. 在 Popup 点击 `Open In-Page Preview Editor`
2. 在页面中编辑预览内容
3. 选中内容后可用 `Restore Selection`（或 `Ctrl/Cmd+Shift+M`）还原为 Markdown 片段
4. 点击 `Save Draft` 后回到 Popup 保存

## 常见问题

- Token 无效：确认前缀为 `ntn_`
- 看不到数据库：确认数据库已共享给 Integration
- 某些图片未保存：通常是源站限制或链接不可访问

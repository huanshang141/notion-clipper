# Notion Clipper - 开发指南

## 架构概述

```
┌─────────────────────────────────────────────────────┐
│ Chrome 扩展                                         │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐   │
│ │ Popup UI (React)                             │   │
│ │ - LoginForm: API Key 输入                     │   │
│ │ - SaveForm: 数据库选择, 字段映射               │   │
│ └────────────┬─────────────────────────────────┘   │
│              │                                      │
│              ▼ IPC Messages                          │
│ ┌──────────────────────────────────────────────┐   │
│ │ Background Service Worker                     │   │
│ │ - AUTHENTICATE: API Key 验证                  │   │
│ │ - GET_AUTH_STATUS: 获取认证状态               │   │
│ │ - EXTRACT_CONTENT: 提取页面内容               │   │
│ │ - GET_DATABASES: 列出数据库                   │   │
│ │ - GET_DATABASE_SCHEMA: 获取数据库结构         │   │
│ │ - SAVE_TO_NOTION: 保存到 Notion              │   │
│ └────────────┬──────────────────────────────────┘   │
│              │                                      │
│              ▼ Content Script                        │
│ ┌──────────────────────────────────────────────┐   │
│ │ Content Script                               │   │
│ │ - 提取页面 HTML                              │   │
│ │ - 运行 Readability 提取文章                  │   │
│ │ - 提取图片链接                               │   │
│ └──────────────────────────────────────────────┘   │
│                                                     │
│ Services Layer:                                     │
│ - AuthService: OAuth2 & API Key authentication    │
│ - NotionService: Notion API 包装                  │
│ - ExtractService: 内容提取                        │
│ - ImageService: 图片处理                          │
│ - StorageService: Chrome 存储 API                │
├─────────────────────────────────────────────────────┤
│        ▼ HTTPS API Calls ▼                         │
│ Notion API (https://api.notion.com/v1)             │
└─────────────────────────────────────────────────────┘
```

## 认证流程

### API Key 认证 (MVP方式)

```
用户输入 API Key
    ▼
LoginForm.tsx 提交
    ▼
Popup → AUTHENTICATE message
    ▼
Background handleAuthenticate()
    ▼
AuthService.authenticateWithApiKey()
    ▼
Fetch /users/me 验证
    ▼
StorageService 保存 token
    ▼
✓ 认证成功
```

### OAuth 2.0 认证 (未来特性)

```
用户点击 "Connect with OAuth"
    ▼
AuthService.startOAuthFlow()
    ▼
chrome.identity.launchWebAuthFlow()
    ▼
Notion 授权页面
    ▼
授权码交换 (需要后端)
    ▼
保存 access_token + refresh_token
```

## 数据流

### 1. 启动时的初始化流程

```
1. Popup 打开
2. checkAuthStatus()
   → Background.GET_AUTH_STATUS
   → StorageService.getAuthToken()
3. 如果已认证:
   → loadDatabases()
   → Background.GET_DATABASES
   → NotionService.listDatabases()
   → GET /search with filter for databases
```

### 2. 内容提取流程

```
1. 用户点击 "提取当前页面"
2. Popup → Background.EXTRACT_CONTENT
3. Background 向 Content Script 发送消息
4. Content Script 运行:
   - 克隆 document
   - 运行 Readability
   - 提取 HTML → Markdown
   - 提取所有图片链接
   - 提取元数据 (标题, 作者, 发布日期)
5. 返回 ExtractedArticle 对象到 Popup
```

### 3. 保存到 Notion 流程

```
1. 用户选择数据库并点击 "保存"
2. Popup → Background.SAVE_TO_NOTION
   带上 article, dataSourceId (or databaseId for backwards compatibility), fieldMapping
3. Background handleSaveToNotion():
   a) 验证认证
   b) 如果启用: 下载所有图片
      - ImageService.processImagesForNotion()
      - 每个图片下载 → 验证 → 获取 Blob
   c) 调用 NotionService.createPage():
      - 构建 properties (title, url, etc)
      - 构建 children blocks (内容 + 图片)
      - POST /pages
   d) 返回页面 URL
```

## 类型定义

### ExtractedArticle

```typescript
{
  title: string;           // 页面标题
  excerpt?: string;        // 摘要
  content: string;         // 内容 (Markdown)
  url: string;            // 页面 URL
  domain?: string;        // 域名
  mainImage?: string;     // 主图片 URL
  images: ExtractedImage[]; // 所有图片
  author?: string;        // 作者
  publishedDate?: string; // 发布日期
  favicon?: string;       // 网站 favicon
}
```

### NotionProperty

```typescript
{
  id: string;           // 属性 ID
  name: string;         // 属性名
  type: string;         // 类型: title, rich_text, url, files, etc
  config?: any;         // 类型特定配置
}
```

## 环境配置

### 开发环境设置

1. **创建 `.env` 文件** (可选, 用于 OAuth):

```env
NOTION_CLIENT_ID=your_client_id_here
NOTION_CLIENT_SECRET=your_client_secret_here
```

2. **获取测试 API Key**:
   - 访问 https://www.notion.so/my-integrations
   - 创建新集成
   - 复制 Internal Integration Token (以 `secret_` 开头)

3. **配置测试环境变量**:

```bash
export NOTION_TEST_API_KEY=secret_your_test_key_here
```

## 构建和运行

### 开发构建

```bash
# 安装依赖
npm install

# 开发构建 (带源码映射)
npm run dev

# 生产构建
npm run build
```

### 加载到 Chrome

1. 打开 `chrome://extensions/`
2. 启用 "开发者模式"
3. 点击 "加载已解包的扩展程序"
4. 选择 `dist/` 目录

### 调试

1. **后台脚本调试**:
   - 在扩展详情页点击 "background service worker"
   - 或右击扩展图标 → 检查后台脚本

2. **Popup 调试**:
   - 右击扩展图标 → 检查弹出式窗口

3. **Content Script 调试**:
   - 任何网页上的开发者工具
   - Console 选项卡, 下拉菜单选择 Content Script

## API 测试

### 运行集成测试

```bash
# 使用 test API key 运行测试
NOTION_TEST_API_KEY=secret_your_key node tests/integration.test.ts
```

### 手动 API 测试

```bash
# 获取用户信息
curl -X GET https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer secret_your_api_key" \
  -H "Notion-Version: 2024-02-15"

# 搜索数据库
curl -X POST https://api.notion.com/v1/search \
  -H "Authorization: Bearer secret_your_api_key" \
  -H "Notion-Version: 2024-02-15" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "value": "database",
      "property": "object"
    }
  }'

# 创建页面
curl -X POST https://api.notion.com/v1/pages \
  -H "Authorization: Bearer secret_your_api_key" \
  -H "Notion-Version: 2024-02-15" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "type": "data_source_id", "data_source_id": "your-data-source-id" },
    "properties": {
      "title": {
        "title": [{"type": "text", "text": {"content": "Test Page"}}]
      }
    }
  }'
```

## 常见问题

### Q: 为什么 Content Script 无法添加？

A: 检查权限:

- manifest.json 必须有 `"content_scripts"`
- 必须指定 `matches` 模式 (当前: `<all_urls>`)
- 确保 content.js 被成功编译到 dist/

### Q: API Key 验证失败？

A: 检查:

1. API Key 是否正确复制 (应以 `secret_` 开头)
2. 集成是否有正确的权限
3. API Key 是否过期

### Q: 图片无法下载？

A: 检查:

1. 网络连接
2. 图片 URL 是否有效和可访问
3. 浏览器网络选项卡中是否有 CORS 错误

### Q: Notion API 调用返回 401？

A:

1. Token 已过期 (OAuth) - 需要刷新
2. API Key 无效或已撤销
3. 使用了错误的认证头格式

## 下一步优化

### 短期 (第2-3周)

- [ ] 改进错误处理和用户反馈
- [ ] 实现图片上传到 Notion
- [ ] 支持更多字段类型映射
- [ ] 增加内容提取选项

### 中期 (第4-5周)

- [ ] OAuth 2.0 完整实现
- [ ] 批量保存功能
- [ ] 定时任务支持
- [ ] 本地化多语言

### 长期 (第6+周)

- [ ] Firefox 支持
- [ ] Edge 支持
- [ ] 云同步
- [ ] 高级过滤和搜索

## 资源链接

- [Notion API 文档](https://developers.notion.com)
- [Chrome 扩展文档](https://developer.chrome.com/docs/extensions/)
- [Mozilla Readability](https://github.com/mozilla/readability)
- [Turndown (HTML to Markdown)](https://github.com/mixmark-io/turndown)

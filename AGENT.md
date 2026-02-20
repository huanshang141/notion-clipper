# AGENT - Notion Clipper 开发指南

本文档为 AI 代理和未来开发者提供全面的项目指导，包括架构、设计决策、关键代码模式和常见任务。

## 项目概览

**Notion Clipper** 是一个 Chrome 浏览器扩展，通过简单的单击操作将网页内容保存到 Notion 数据库。

### 核心特性
- 🚀 一键保存网页到 Notion
- 📄 自动提取文章正文和标题（使用 Readability）
- 🖼️ 自动处理和上传图片到 Notion
- 🔐 API Key 认证（使用 Internal Integration Token）
- 🎯 动态字段映射自动识别数据库结构

### 技术栈
- **语言**: TypeScript (strict mode)
- **框架**: React 18（UI 层）
- **构建**: Webpack 5
- **扩展标准**: Chrome Manifest V3
- **认证**: Notion Internal Integration Token (API Key)
- **测试**: Jest + Puppeteer（集成测试）

---

## 架构概览

### 文件结构组织

```
notion-clipper/
├── src/                          # 源代码
│   ├── background/              # Service Worker（后台脚本）
│   ├── content/                 # Content Script（页面注入脚本）
│   ├── popup/                   # Popup UI（浮窗配置）
│   ├── options/                 # Options Page（选项页面）
│   ├── services/                # 业务逻辑层
│   │   ├── auth.ts             # 认证管理（API Key）
│   │   ├── notion.ts           # Notion API 包装
│   │   ├── storage.ts          # Chrome 存储管理
│   │   ├── extract.ts          # 内容提取
│   │   └── image.ts            # 图片处理
│   ├── types/                   # TypeScript 类型定义
│   ├── utils/                   # 工具函数
│   │   └── constants.ts         # 应用配置常量
│   └── background/index.ts      # Service Worker 入口
├── tests/                        # 测试文件
├── docs/                         # 文档（重要内容存放处）
│   ├── DEVELOPMENT.md           # 开发指南
│   ├── AGENT.md                 # 本文件 - AI 代理指南
│   ├── API_UPGRADE_REPORT.md    # API 升级报告
│   └── *.md                     # 其他文档
├── prd.md                        # 产品需求文档
├── DEVELOPMENT.md               # 开发文档（根目录）
├── README.md                     # 项目说明
├── manifest.json                # Chrome 扩展配置
├── webpack.config.js            # Webpack 构建配置
└── package.json                 # 项目依赖配置
```

### 核心通信架构

```
Content Script (page context)
    ↓ (postMessage)
Service Worker (message listener)
    ↓ (background-content IPC)
Storage Service (chrome.storage)
    ↓
Notion API (HTTP)
Notion Database
```

---

## 认证模型 (Critical)

### 当前实现: Internal Integration Token

**为什么不用 OAuth？**
- Internal Integration Token 足以满足单人/工作空间级别的功能
- 无需后端支持，无需 OAuth 服务器
- 用户直接从 Notion 集成面板复制 API Key
- 简化架构，便于维护

**工作流程:**

1. **初始化** (`src/services/auth.ts`):
   ```typescript
   // 用户在 Options Page 输入 API Key
   // validateToken() 调用 GET /users/me 验证
   // token 存储在 chrome.storage.sync
   ```

2. **使用**:
   ```typescript
   // 每次 API 调用时从 storage 读取 token
   // 添加到 Authorization 头: "Bearer <API_KEY>"
   ```

3. **失败处理**:
   - 401 错误 → token 无效或已撤销 → 需要用户重新配置
   - 403 错误 → 权限不足 → 检查 Integration capabilities

**关键代码位置:**
- `src/services/auth.ts` → `authenticateWithApiKey()` 和 `isAuthenticated()`
- `src/services/storage.ts` → token 持久化
- `src/utils/constants.ts` → `AUTH_CONFIG` 配置

---

## 核心业务逻辑

### 1. 认证服务 (src/services/auth.ts)

**主要方法:**
```typescript
// 配置和验证 API Key
authenticateWithApiKey(apiKey: string): Promise<NotionAuthToken>

// 检查当前状态
isAuthenticated(): Promise<boolean>

// 获取存储的 token
getToken(): Promise<string | null>

// 退出登录（清除 token）
logout(): Promise<void>

// 获取完整认证状态
getAuthStatus(): Promise<AuthStatus>
```

**重点:**
- 严格验证 API Key 格式（必须以 `secret_` 开头）
- 使用 `/users/me` 端点验证 token 有效性
- token 存储在 `chrome.storage.sync` 实现跨设备同步

---

### 2. Notion 服务 (src/services/notion.ts)

**主要职责:**
- 包装 Notion REST API
- 处理 API 版本 (当前: 2025-09-03)
- 数据 filtering 和 transformation

**关键方法:**
```typescript
// 列表查询 - 使用数据源而非数据库
searchDatabases(): Promise<Database[]>  // 搜索: filter: { data_source: {} }

// 页面创建
createPage(dbId: string, props: Properties): Promise<Page>

// 块操作
appendBlocks(parentId: string, blocks: Block[]): Promise<void>
```

**重点:**
- API v2025-09-03: 搜索过滤改为 `data_source` 而非 `database`
- 父对象格式: `{ type: 'data_source_id', data_source_id }`
- 所有 API 调用必须包含 `Notion-Version` 头

---

### 3. 内容提取 (src/services/extract.ts)

**工作流程:**
1. 内容提取 → Readability.js
2. 图片识别 → 正则表达式匹配
3. 标题、描述、URL 提取

**输出格式:**
```typescript
type ExtractedContent = {
  title: string
  excerpt: string              // 文章摘要
  content: string             // 清洁后的 HTML
  images: ImageData[]         // 待上传的图片
  url: string                 // 源页面 URL
  favicon: string             // 网站 favicon
}
```

**重点:**
- Readability 生成 DOM，需要在 iframe 中安全执行
- 图片使用 blob URL 临时存储
- 内容清洁移除脚本和样式

---

### 4. 图片处理 (src/services/image.ts)

**流程:**
1. 下载图片 blob
2. 上传到 Notion （multipart/form-data）
3. 返回 Notion 文件 URL

**重点:**
- 并发上传控制（避免超载）
- 大文件分片处理
- CORS 代理处理

---

### 5. 存储管理 (src/services/storage.ts)

**职责:**
- 封装 chrome.storage API
- 自动同步 (chrome.storage.sync) / 本地存储 (chrome.storage.local)

**存储键:**
```typescript
STORAGE_KEYS = {
  AUTH_TOKEN: 'notion_auth_token',
  DATABASE_CONFIG: 'database_config',
  FIELD_MAPPING: 'field_mapping',
  DEBUG_ENABLED: 'debug_enabled'
}
```

---

## IPC 通信协议

所有跨上下文通信通过 message IPC 实现，定义在 `src/types/index.ts`:

```typescript
namespace Messages {
  interface GET_AUTH_STATUS {
    type: 'GET_AUTH_STATUS'
    // Response: { authenticated: boolean, workspace: string }
  }
  
  interface GET_DATABASES {
    type: 'GET_DATABASES'
    // Response: Database[]
  }
  
  interface SAVE_PAGE {
    type: 'SAVE_PAGE'
    payload: {
      dbId: string
      title: string
      content: string
      images: ImageData[]
    }
    // Response: { pageId: string }
  }
}
```

**通信流:**
1. Content Script 调用 `chrome.runtime.sendMessage()`
2. Service Worker 在 `message` 事件处理器中接收
3. 调用相应的 Service 并返回结果

---

## 常见开发任务

### 任务 1: 添加新的字段映射类型

**文件:** `src/utils/constants.ts` + `src/services/notion.ts`

```typescript
// 1. 在 NOTION_FIELD_TYPES 中添加类型
export const NOTION_FIELD_TYPES = {
  ...
  'custom_field': { handler: 'mapCustomField' }
}

// 2. 在 NotionService 中实现映射器
private mapCustomField(value: any): CustomFieldValue {
  // 处理逻辑
}

// 3. 在 createPage 中调用
```

### 任务 2: 修改 API 版本

**文件:** `src/utils/constants.ts`

```typescript
export const NOTION_API_VERSION = '2025-09-03'  // 修改这里
```

**检查列表:**
- [ ] API 端点是否改变（如 /databases → /data_sources）
- [ ] 请求/响应数据格式是否改变
- [ ] 需要运行 `npm test` 验证

### 任务 3: 添加新的 UI 组件

**位置:** `src/popup/` 或 `src/options/`

```typescript
// React 16.8+ hooks 风格
import React, { useState, useEffect } from 'react'

export const MyComponent: React.FC = () => {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    // initialization
  }, [])
  
  return <div>...</div>
}
```

**样式:** 使用 CSS modules 或 inline styles（无 Tailwind/Bootstrap）

### 任务 4: 调试 Service Worker

```typescript
// 在 Service Worker 中添加 console.log
// 然后在 Chrome DevTools 中查看:
// 1. chrome://extensions/
// 2. 找到 Notion Clipper
// 3. 点击 "Inspect views: service_worker"
```

---

## 测试策略

### 单元测试
```bash
npm test
```
- 位置: `tests/` 目录
- 框架: Jest
- 覆盖: 工具函数、验证逻辑

### 集成测试
- 框架: Puppeteer
- 场景: 完整的保存流程

### 手动测试检查清单
- [ ] 通过有效 API Key 认证
- [ ] 通过无效 API Key 认证失败
- [ ] 获取正确的数据库列表
- [ ] 成功保存网页内容到 Notion
- [ ] 图片正确上传和显示
- [ ] 页面字段正确映射

---

## 性能优化指南

### 已应用的优化

1. **并发控制**
   - 图片上传: 限制为 3 个并发
   - API 请求: 10ms delay between requests

2. **缓存策略**
   - 数据库列表: 缓存 5 分钟
   - 字段映射: 缓存直到用户更新

3. **大小优化**
   - Webpack tree-shaking 移除未使用代码
   - 产品构建: gzip 压缩

### 性能目标 (SLA)
- 内容提取: < 3 秒
- 图片上传 (单张): < 2 秒
- 保存到 Notion: < 5 秒

---

## 故障排除

### 问题: "process is not defined"
**原因:** 代码在浏览器环境中使用了 Node.js 的 `process` 对象
**解决:**
- 不使用 `process.env` 在浏览器代码中
- 使用 `chrome.runtime.getManifest()` 获取配置

### 问题: API 返回 401
**排查步骤:**
1. 验证 API Key 是否有效: `isAuthenticated()`
2. 检查 Authorization 头格式: `Bearer <KEY>`
3. 检查 API KEY 是否被撤销

### 问题: Service Worker 重新启动
**原因:** Service Worker 有 5 分钟闲置超时
**解决:** 使用 `chrome.alarms` 最小化状态损失

---

## 关键文件速查

| 文件 | 用途 | 修改频率 |
|-----|-----|--------|
| `src/services/auth.ts` | API Key 认证 | ⭐ 低 |
| `src/services/notion.ts` | Notion API 包装 | ⭐ 低 |
| `src/utils/constants.ts` | 全局配置 | ⭐ 低 |
| `src/types/index.ts` | IPC 消息定义 | ⭐ 低 |
| `src/popup/Popup.tsx` | 主 UI 组件 | ⭐⭐ 中 |
| `src/options/SettingsPage.tsx` | 设置 UI | ⭐⭐ 中 |
| `tests/` | 测试 | ⭐⭐⭐ 高 |

---

## 文档维护指南

### 文档位置原则
- **必要文档存放位置**: `docs/` 文件夹
  - DEVELOPMENT.md - 开发细节
  - AGENT.md - AI 代理指南
  - API_UPGRADE_REPORT.md - API 改动记录
  - 其他技术文档

- **精简化原则**
  - 版本更新记录放在 docs/
  - 不必要的笔记及时清理
  - README.md 保持简洁

### 更新时机
- API 版本更新时 → 更新 docs/API_UPGRADE_REPORT.md
- 架构改变时 → 更新本文件 (AGENT.md)
- 新功能添加时 → 更新 docs/DEVELOPMENT.md

---

## 开发流程 (标准工作流)

### 1. 新功能/修复

```bash
# Clone 项目
git clone <repo>
cd notion-clipper

# 安装依赖
npm install

# 启动开发
npm run dev  # 或 npm run build

# 修改代码
# ...编辑 src/ 文件...

# 测试
npm test

# 构建最终版本
npm run build

# 加载到 Chrome
# chrome://extensions → Load unpacked → dist/
```

### 2. API 版本升级流程

```bash
# 1. 更新常量
# src/utils/constants.ts → NOTION_API_VERSION

# 2. 检查 API 端点变化
# 参考 Notion 官方文档

# 3. 更新相应服务
# src/services/notion.ts → 更新端点和数据格式

# 4. 更新测试
# tests/ → 修正或新增测试

# 5. 构建和验证
npm test && npm run build

# 6. 文档记录
# docs/API_UPGRADE_REPORT.md → 记录改动
```

---

## 常见陷阱和最佳实践

### ❌ 避免
- 在 Content Script 中直接访问 DOM (不安全)
- 同步的 chrome.storage 操作 (使用 Promise)
- 硬编码 API URL (使用 constants)
- 不验证用户输入

### ✅ 推荐
- 使用 TypeScript strict 模式
- 定义清晰的 IPC 消息类型
- 集中管理 API 版本和配置
- 添加详细的错误日志和用户反馈

---

## 快速参考

### 常用命令
```bash
npm install                 # 安装依赖
npm run build              # 生产构建
npm run dev                # 开发模式
npm test                   # 运行测试
npm run lint               # 代码检查
npm run type-check         # TypeScript 类型检查
```

### Chrome 扩展开发快捷键
- F12 打开 DevTools
- chrome://extensions/ - 扩展管理
- chrome://extension-shortcut-commands/ - 快捷键管理

### Notion API 资源
- https://developers.notion.com
- https://developers.notion.com/reference/intro
- https://github.com/makenotion/notion-sdk-js

---

## 更新日志

| 版本 | 日期 | 主要改动 |
|-----|-----|--------|
| v2025-09-03 | 当前 | 采用 Internal Integration Token（API Key only），移除 OAuth 流程 |
| v2024-02-15 | 历史 | Notion API 官方版本 |

---

**最后更新: 当前日期**
**维护者**: Notion Clipper 开发团队
**联系**: [在此添加联系方式]


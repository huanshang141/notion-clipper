# Notion Clipper - 完整实现指南

## 📋 目录

1. [项目概述](#项目概述)
2. [已实现的功能](#已实现的功能)
3. [架构设计](#架构设计)
4. [关键实现细节](#关键实现细节)
5. [测试和验证](#测试和验证)
6. [部署和发布](#部署和发布)
7. [故障排除](#故障排除)

---

## 项目概述

### 名称

**Notion Clipper** - 一个Chrome扩展程序，用于将网络内容保存到Notion数据库。

### 版本

0.1.0 (MVP)

### 核心功能

- 🔐 使用Notion Internal Integration Token进行API密钥认证
- 📄 使用Readability进行智能内容提取
- 🏗️ 自动字段映射和检测
- 💾 一键保存到Notion
- 🖼️ 自动图片下载和处理
- 📱 响应式UI设计
- ⚡ 实时验证和错误处理

### 支持的Notion字段类型

- `title` - 标题字段
- `rich_text` / `text` - 富文本/文本字段
- `url` - URL字段
- `files` - 文件字段（主要用于图片）
- `select` - 单选字段
- `multi_select` - 多选字段
- `checkbox` - 复选框
- `date` - 日期字段
- `number` - 数字字段
- `email` - 电子邮件字段
- `phone_number` - 电话号码字段

---

## 已实现的功能

### ✅ 阶段1：认证（周1）

- [x] API密钥格式验证（ntn\_前缀）
- [x] /users/me端点验证
- [x] Chrome Storage中的Token持久化
- [x] 令牌刷新和过期处理
- [x] 登出清除Token
- [x] 工作区信息检索

**相关文件**：

- `src/services/auth.ts` - 认证逻辑
- `src/popup/LoginForm.tsx` - UI组件
- `src/utils/request.ts` - API请求

### ✅ 阶段2：数据库和字段（周2）

- [x] listDatabases()使用Notion 2025-09-03 API的data_source端点
- [x] getDatabaseSchema()获取字段定义
- [x] 自动字段类型检测（detectFieldType）
- [x] 字段名称模式匹配（支持中英文）
- [x] 字段映射配置

**相关文件**：

- `src/services/notion.ts` - Notion API服务
- `src/utils/constants.ts` - 字段名称定义

### ✅ 阶段3：内容提取（周3）

- [x] Readability集成获取主要内容
- [x] Turndown库进行HTML到Markdown转换
- [x] 元数据提取（标题、URL、域名等）
- [x] 图片检测和主图片识别
- [x] 发布日期和作者信息提取
- [x] 内容脚本通信

**相关文件**：

- `src/content/index.ts` - 内容脚本
- `src/services/extract.ts` - 提取逻辑
- `src/background/index.ts` - IPC处理

### ✅ 阶段4：字段值映射（周4）

- [x] SaveForm自动字段初始化
- [x] 通过buildPropertyValue进行类型转换
- [x] 所有字段类型的值验证
- [x] 长度和格式限制
- [x] 自动值预填充

**相关文件**：

- `src/popup/SaveForm.tsx` - 表单组件
- `src/services/notion.ts` - buildPropertyValue方法

### ✅ 阶段5：页面创建（周5）

- [x] createPage()使用data_source_id创建页面
- [x] 属性映射到Notion字段格式
- [x] 块内容（段落、列表、代码块）
- [x] 速率限制检查（3请求/秒）
- [x] 错误处理和重试逻辑
- [x] Notion页面URL返回

**相关文件**：

- `src/services/notion.ts` - createPage方法
- `src/background/index.ts` - handleSaveToNotion

### ✅ 阶段6：图片处理（周6）

- [x] 图片下载（15秒超时，5MB限制）
- [x] 并发下载控制（最多3个）
- [x] 图片验证和错误处理
- [x] Blob到data URI转换
- [x] 页面中的图片块添加
- [x] 优雅的降级（失败时使用原始URL）

**相关文件**：

- `src/services/image.ts` - 图片处理
- `src/background/index.ts` - processImagesForNotion

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │   Content Tab    │  │  Extension Popup             │ │
│  │  ──────────────  │  │  ──────────────────────────┐ │ │
│  │ • 内容脚本       │  │ • LoginForm 认证           │ │ │
│  │ • 提取 HTML      │  │ • SaveForm 字段映射        │ │ │
│  │ • 检测图片       │  │ • 状态管理                 │ │ │
│  │ • 发送消息       │  │ • UI 交互                  │ │ │
│  └────────┬─────────┘  └──────────┬──────────────────┘ │ │
│           │                       │                     │ │
│           └───────────┬───────────┘                     │ │
│                       │ chrome.runtime.sendMessage      │ │
│  ┌────────────────────┴───────────────────────────────┐ │ │
│  │         Background Service Worker                   │ │ │
│  │  ───────────────────────────────────────────────  │ │ │
│  │ • 消息路由和处理                                  │ │ │
│  │ • 认证管理                                        │ │ │
│  │ • API请求转发                                    │ │ │
│  │ • 内容脚本通信                                    │ │ │
│  │ • 速率限制                                        │ │ │
│  └────────────┬──────────────────────────────────────┘ │ │
│               │                                         │ │
└───────────────┼─────────────────────────────────────────┘ │
                │ HTTPS
    ┌───────────┴────────────────────────┐
    │     Notion API (v2025-09-03)       │
    │ https://api.notion.com/v1          │
    │  • /search (列出数据库)             │
    │  • /data_sources (获取架构)         │
    │  • /pages (创建页面)                │
    │  • /users/me (验证)                │
    └────────────────────────────────────┘
```

### 文件结构

```
notion-clipper/
├── src/
│   ├── background/
│   │   └── index.ts          # 后台脚本（Service Worker）
│   ├── content/
│   │   └── index.ts          # 内容脚本
│   ├── popup/
│   │   ├── App.tsx           # 主应用组件
│   │   ├── LoginForm.tsx      # 登录表单
│   │   ├── SaveForm.tsx       # 保存表单
│   │   ├── App.css           # 样式
│   │   └── index.tsx         # 入口
│   ├── services/
│   │   ├── auth.ts           # 认证服务
│   │   ├── notion.ts         # Notion API服务
│   │   ├── extract.ts        # 内容提取服务
│   │   ├── image.ts          # 图片处理服务
│   │   └── storage.ts        # 本地存储服务
│   ├── utils/
│   │   ├── constants.ts      # 常量定义
│   │   ├── request.ts        # HTTP请求工具
│   │   ├── ipc.ts            # IPC通信工具
│   │   └── errors.ts         # 错误处理
│   ├── types/
│   │   └── index.ts          # TypeScript类型定义
│   └── options/
│       └── index.tsx         # 选项页面（将来扩展）
├── public/
│   ├── manifest.json         # Chrome扩展清单
│   ├── popup.html            # 弹窗页面
│   ├── background.html       # 后台脚本HTML
│   └── icons/                # 图标文件
├── webpack.config.js         # Webpack配置
├── tsconfig.json            # TypeScript配置
├── package.json             # 依赖管理
├── TEST_PLAN.md            # 详细的测试计划
└── INTEGRATION_TESTS.js    # 集成测试脚本
```

### 数据流

#### 1. 认证流程

```
用户输入API Key
        ↓
LoginForm.tsx验证格式
        ↓
sendToBackground(AUTHENTICATE)
        ↓
background/index.ts -> AuthService.authenticateWithApiKey()
        ↓
调用 GET /users/me 验证
        ↓
保存token到chrome.storage.sync
        ↓
返回token和工作区信息
        ↓
setState({ isAuthenticated: true })
        ↓
加载数据库列表
```

#### 2. 内容保存流程

```
用户点击"Save to Notion"
        ↓
SaveForm验证和构建fieldMapping
        ↓
sendToBackground(SAVE_TO_NOTION)
        ↓
background处理：
  • 检查认证
  • downloadImages()处理图片（可选）
  • NotionService.createPage()创建页面
  • 返回page ID和URL
        ↓
显示成功消息和Notion链接
        ↓
自动重置表单，提取新内容
```

#### 3. 字段映射流程

```
用户选择数据库
        ↓
loadDatabaseSchema(databaseId)
        ↓
backend: GET /data_sources/{databaseId}
        ↓
SaveForm.initializeFieldMapping()
        ↓
sendToBackground(GET_AUTO_FIELD_MAPPING)
        ↓
NotionService.autoDetectFieldMapping()
  • 遍历每个属性
  • 通过detectFieldType()检测源字段
  • 调用buildPropertyValue()生成值
        ↓
返回映射配置
        ↓
展示在SaveForm中
```

---

## 关键实现细节

### 1. 字段检测逻辑

**位置**：`src/services/notion.ts` - `detectFieldType()`方法

字段检测基于两个因素：

1. **属性类型匹配** - 精确匹配（如`title`字段→`title`源）
2. **名称模式匹配** - 使用COMMON_FIELD_NAMES列表进行模糊匹配

**支持的语言**：

- English: title, content, url, cover, date, excerpt
- 中文: 标题, 内容, 链接, 封面, 日期, 摘要

**优先级**：

1. 精确类型匹配（如title类型）
2. 类型+名称组合匹配
3. 名称匹配

### 2. 值构建逻辑

**位置**：`src/services/notion.ts` - `buildPropertyValue()`方法

每个字段类型的处理规则：

```typescript
title:
  输入: 字符串
  输出: { title: [{ type: 'text', text: { content: '...' } }] }
  限制: 2000字符

rich_text/text:
  输入: 字符串
  输出: { rich_text: [{ type: 'text', text: { content: '...' } }] }
  限制: 2000字符

url:
  输入: 必须以http/https开头
  输出: { url: 'https://...' }
  验证: 格式检查

files:
  输入: 图片URL
  输出: { files: [{ name: 'image', type: 'external', external: { url: '...' } }] }

select/multi_select:
  输入: 字符串或数组
  输出: select: { select: { name: '...' } }
        multi_select: { multi_select: [{ name: '...' }] }
  限制: 名称100字符

checkbox:
  输入: 任何值
  输出: { checkbox: true/false }

date:
  输入: YYYY-MM-DD格式
  输出: { date: { start: 'YYYY-MM-DD' } }
  验证: 正则表达式

number:
  输入: 数字或可转换为数字的字符串
  输出: { number: 42 }

email:
  输入: 包含@的字符串
  输出: { email: 'test@example.com' }

phone_number:
  输入: 电话号码字符串
  输出: { phone_number: '+1-555-1234' }
```

### 3. 图片处理流程

**文件**：`src/services/image.ts`

**流程**：

1. **下载**
   - 并发限制：最多3个同时请求
   - 超时：15秒/图片
   - 大小限制：5MB最大

2. **验证**
   - MIME类型检查
   - 尺寸检查
   - URL格式验证

3. **处理**
   - 下载成功：转换为data URI或保留URL
   - 下载失败：使用原始URL（优雅降级）

4. **上传到Notion**
   - 当前MVP：使用data URI或原始URL
   - 未来：集成S3或CDN

### 4. 速率限制

**位置**：`src/services/notion.ts`

**实现**：

- 维持请求计数器
- 60秒时间窗口
- 最大请求数：可配置~30 req/min
- 超限响应：429状态码
- 用户反馈：显示"稍后重试"消息

**检查点**：

- 每个API调用前执行checkRateLimit()
- 检测到超限时抛出错误

### 5. 错误处理

**文件**：`src/utils/errors.ts`

**错误分类**：

- **认证错误** - ERR*AUTH*\*
- **网络错误** - ERR*NET*\*
- **API错误** - ERR*NOTION*\*
- **内容错误** - ERR*EXTRACT*\*
- **图片错误** - ERR*IMG*\*
- **验证错误** - ERR*VALIDATION*\*

**HTTP状态码处理**：

- 401: 认证失败
- 404: 资源未找到
- 429: API速率限制
- 5xx: 服务器错误

---

## 测试和验证

### 通过构建和运行集成测试

```bash
# 运行Node.js测试脚本
node INTEGRATION_TESTS.js

# 预期输出：
# ✅ 字段转换测试: XX/XX通过
# ✅ API密钥验证测试: XX/XX通过
# ✅ 字段名称检测测试: XX/XX通过
# ✅ 图片验证测试: XX/XX通过
# ✅ Markdown处理测试: XX/XX通过
```

### 手动测试步骤

**前置条件**：

1. Notion账户
2. Internal Integration Token（ntn\_前缀）
3. 包含测试字段的Notion数据库

**测试清单**（详见TEST_PLAN.md）：

- [ ] 认证测试
- [ ] 内容提取测试
- [ ] 字段映射测试
- [ ] Notion保存测试
- [ ] 图片处理测试
- [ ] 错误处理测试
- [ ] UI交互测试
- [ ] 性能测试

---

## 部署和发布

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式（watch模式）
npm run dev

# 生产构建
npm run build
```

### 在Chrome中加载扩展

1. 打开 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载未打包的扩展"
4. 选择 `dist/` 目录

### 测试检查清单

- [ ] 构建成功（无错误）
- [ ] 扩展在Chrome中加载成功
- [ ] 弹窗显示正确（UI完整）
- [ ] 可以输入API密钥
- [ ] 认证成功
- [ ] 数据库列表加载
- [ ] 保存功能完整
- [ ] 没有控制台错误

### 发布到Chrome Web Store

1. 准备资源
   - 32x32、128x128 PNG图标
   - 截图 (宽度 1280px)
   - 描述和说明文字

2. 更新manifest.json版本

3. 构建生产版本

   ```bash
   npm run build
   ```

4. 上传到Chrome开发者仪表板
   - https://developer.chrome.com/docs/webstore/publish/

---

## 故障排除

### 常见问题

#### 1. "API key format is invalid"

**原因**：API密钥不以`ntn_`开头或格式不正确
**解决方案**：

- 检查从https://notion.so/my-integrations复制的完整密钥
- 确保没有额外的空格

#### 2. "Authentication failed"

**原因**：API密钥无效或已过期
**解决方案**：

- 重新生成integration token
- 确保integration有访问工作区的权限
- 检查网络连接

#### 3. "Failed to extract content"

**原因**：Readability无法解析页面
**解决方案**：

- 在标准网站上测试（如Medium、Dev.to）
- 检查页面是否包含有效的内容
- 某些SPA可能需要加载时间

#### 4. "Database not found"

**原因**：Integration没有访问数据库的权限
**解决方案**：

- 在Notion中确认integration受邀请到工作区
- 确认database是共享的或是public的

#### 5. 保存失败，状态429

**原因**：API速率限制
**解决方案**：

- 等待1分钟后重试
- 减少快速连续保存的频率

#### 6. 图片未在Notion中显示

**原因**：图片URL无效或已过期
**解决方案**：

- 检查网络连接
- 某些图片可能受CORS限制
- 检查5MB限制

### 调试技巧

1. **启用开发者工具**

   ```
   右键 → 检查 → 控制台
   ```

2. **查看后台脚本日志**

   ```
   chrome://extensions/ → Notion Clipper → 检查视图
   ```

3. **检查存储的Token**

   ```javascript
   // 在控制台执行
   chrome.storage.sync.get(["auth_token"], (result) => {
     console.log("Stored token:", result);
   });
   ```

4. **测试API调用**
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        -H "Notion-Version: 2025-09-03" \
        https://api.notion.com/v1/users/me
   ```

### 性能优化

- 内容脚本最小化以减少页面加载时间
- 有限的块数量（20）防止过大的API请求
- 并发图片下载（3个最大）保持响应速度
- 使用chrome.storage.sync进行跨设备token同步

---

## 总结

Notion Clipper为用户提供了一个完整的工作流程，从发现Web内容到在Notion中保存，包括：

✅ **用户友好的认证**
✅ **智能内容提取**
✅ **自动字段映射**
✅ **一键保存**
✅ **全面的错误处理**
✅ **高性能操作**

所有核心功能已实现并准备好用于MVP发布！

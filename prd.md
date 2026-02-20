📋 Plan: Notion-Clipper 扩展开发计划
TL;DR：为单人开发者设计的 4-6 周 MVP 发布计划。采用 TypeScript + React + Webpack + Manifest V3 技术栈，参考 web-clipper 的成熟架构，但针对单人开发优化范围。核心是通过并行开发 3 个系统（认证、内容提取、Notion 数据同步）并使用动态字段映射来减少初期配置工作，确保 4 周内完成基础功能，第 5-6 周用于集成和优化。

📐 项目初始化（第 1 周）
1.1 创建项目骨架
在 notion-clipper 目录初始化项目结构
配置 Manifest V3 版本
设置 TypeScript + Webpack 构建流程
配置 React 18 编译环境
输出文件：

manifest.json - Chrome 扩展配置
webpack.config.js - 构建配置
tsconfig.json - TypeScript 配置
package.json - 依赖项和脚本
1.2 建立基础扩展框架
1.3 依赖项规划
核心依赖（参考 web-clipper + 优化）：

🔐 认证系统（第 2 周 - 上半部分）
2.1 双认证模式支持
设计理由：用户可根据偏好选择，降低入门难度

OAuth 2.0 流程（参考 Notion 官方文档）

在 src/services/auth.ts 实现
通过 popup 中的"Connect to Notion"按钮触发
使用 Chrome identity API 打开授权 URL
接收 authorization code 后交换 access token
API Key 方式（简化备选）

在 src/options/SettingsPage.tsx 提供手动输入
将 API Key 加密存储在 Chrome storage.sync
2.2 Token 管理
在 src/services/storage.ts 实现
存储位置：Chrome storage.sync（自动同步）
Token 刷新逻辑（如需要）
自动登出过期处理
状态持久化
2.3 权限配置
更新 manifest.json：

📄 Notion 数据同步系统（第 2 周 - 下半部分）
3.1 Notion API 封装
在 src/services/notion.ts 实现核心操作：

3.2 动态字段映射（MVP 的关键创新点）
策略：自动检测数据库字段，智能映射

在 src/services/notion.ts 中实现字段识别逻辑：

获取后的字段处理：

必需字段：title（自动映射到"Title"或自定义字段）
可选字段自动识别：
text/rich_text 类型 → 内容字段
url 类型 → URL 字段
files 类型 → 图片字段
select/multi_select → 标签字段
checkbox → 阅读状态字段
回退机制（如果 API 无法获取字段）：

预设 5-8 个常见字段的标准名称
让用户在设置页面手动映射
3.3 页面创建逻辑
在 src/services/notion.ts 中实现：

✂️ 内容提取系统（第 3 周）
4.1 内容提取服务
在 src/services/extract.ts 实现：

对象：

`HTMLArticle`：包含 title, content, images, url, mainImage 等字段
核心逻辑：

HTML 解析（使用 Readability）

在 content.js 中运行，获取文档 DOM
传递给 Readability 分析
提取主要内容和元数据
并行数据采集（关键性能优化）

内容格式化

HTML → Markdown（使用 turndown）
保留关键格式：标题层级、代码块、链接、列表
移除脚本、样式等
4.2 图片预处理
在 src/services/extract.ts 中标记图片：

提取时记录所有图片 URL，不立即下载（后续步骤处理）

🖼️ 图片处理和上传（第 4 周）
5.1 图片下载和缓存
在 src/services/image.ts 实现：

错误处理：

超时或失败的图片不阻塞保存流程
记录失败的图片 URL，保留源链接作备份
5.2 上传到 Notion
在 src/services/notion.ts 的 uploadImageToNotion() 方法：

流程：

调用 Notion getUploadUrl() 获取上传端点
上传图片文件到 AWS 或 Notion 服务器
构建图片块：{ type: "image", image: { file: { url } } }
包含在页面 children 中创建
MVP 简化：

仅支持常见格式（JPG、PNG）
图片大小限制 5MB
超过限制的图片保留外链
🎨 用户界面和交互（第 4 周并行）
6.1 Popup UI（核心交互）
src/popup/App.tsx：

状态：

❌ 未认证 → 显示"Connect to Notion"按钮
✅ 已认证 → 显示保存表单
表单字段：

数据库选择（下拉菜单）

动态加载当前工作空间的数据库
选择目标数据库后刷新字段映射
动态字段映射（根据数据库结构生成）

自动识别的字段显示为预填充（可修改）
用户可以选择是否保存某个字段
字段值从提取的内容自动填充
内容预览

显示即将保存的标题、URL、主图
可编辑标题
操作按钮

"Save to Notion" - 提交保存
"Settings" - 打开设置页面
样式：

简洁的卡片式设计
参考截图风格（使用 Ant Design 或 Tailwind 组件库）
加载态和错误提示
6.2 Options/Settings 页面
src/options/SettingsPage.tsx：

功能：

工作空间管理

当前连接的工作空间显示
登出按钮
API Key 备选认证

输入框和保存按钮
"连接测试"验证 API Key 有效性
字段映射配置（可选，如 auto-detect 失败）

手动配置备选字段映射
保存为预设模板
高级选项

是否自动下载图片（toggle）
调试日志启用（toggle）
🔗 IPC 通信架构（贯穿整个项目）
参考 web-clipper 的模式，但简化为 MVP 规模：

7.1 消息定义
在 src/types/index.ts：

7.2 通信流程
🏗️ 开发步骤（周度分解）
第 1 周：项目初始化和框架搭建
Day 1-2：项目结构、manifest.json、webpack 配置
Day 3-4：React 环境搭建、popup 和 options 基础页面
Day 5：background/content 脚本基础框架、IPC 通信模板
检验：能够成功打包和在 Chrome 中加载扩展（无报错）

第 2 周：认证和 Notion 集成
Day 1-2：OAuth 和 API Key 双认证实现、token 存储
Day 3-4：Notion API 封装（getWorkspace, listDatabases, getDatabaseSchema）
Day 5：动态字段映射 逻辑实现、设置页面完成
检验：能够连接 Notion 并显示工作空间和数据库列表

第 3 周：内容提取
Day 1-2：Readability 集成、content.js 中的内容提取
Day 3-4：turndown 转换、元数据（标题、URL）提取
Day 5：图片识别和链接收集、错误处理
检验：content script 能够提取文章内容并通过 IPC 传递给 background

第 4 周：图片处理和 Popup UI 完善
Day 1-2：图片下载服务（image.ts）
Day 3：Notion 图片上传集成
Day 4-5：Popup 表单完成、字段动态绑定、保存流程
检验：点击"Save"后能够将内容和图片保存到 Notion

第 5 周：集成测试和 Bug 修复
Day 1-3：端到端测试（多个网站、不同数据库结构）
Day 4-5：Bug 修复、性能优化（缓存、超时处理）
检验：MVP 功能完整，核心流程稳定

第 6 周：优化和发布准备
Day 1-2：UI 打磨、错误提示改进
Day 3：文档编写（用户指南）
Day 4-5：Chrome Web Store 提交准备或内部发布
✅ Verification（测试验收标准）
关键流程测试
流程 1：新用户注册和认证

流程 2：保存文章到 Notion

流程 3：多图片网页处理

流程 4：错误恢复

性能测试
内容提取：< 3 秒
图片上传（单张）：< 2 秒
保存到 Notion：< 5 秒
🎯 关键决策（在本规划中已确定）
决策 选择 理由
技术栈 TypeScript + React + Webpack 与 web-clipper 一致，社区验证，单人开发可参考示例
Manifest 版本 V3 Chrome 最新标准，符合未来方向
认证方式 OAuth + API Key（并行） 用户可选，降低初期配置复杂度
字段映射 动态自动识别 + 手动备选 减少配置工作，提升用户体验
图片处理 MVP 必须支持 符合用户需求，参考 notion-pic 方案
浏览器支持 Chrome + Edge 简化初期工作，未来可扩展
MVP 范围 3 个核心模块（认证、提取、保存） 4-6 周内完成，保证质量
📦 交付物清单
✅ 代码仓库的完整版本，包括：

源代码（TypeScript）
配置文件（manifest.json, webpack.config.js 等）
构建脚本（package.json）
✅ 用户文档：

安装指南（如何加载到 Chrome）
快速开始（连接 Notion 和保存第一个页面）
常见问题和故障排除
✅ 开发者文档：

架构说明
模块化设计文档
API 集成指南（便于未来扩展）
💡 未来扩展方向（Post-MVP）
字段类型支持扩展：select, multi_select, relations, rollup
批量操作：一次性保存多个标签页
快捷键：快速保存快捷方式
高级内容处理：代码块、表格、公式保留
Firefox 支持：兼容 WebExtensions API
同步功能：定期重新获取工作空间数据库列表
这个计划是否符合你的预期？有没有需要调整的部分？### 性能测试

内容提取：< 3 秒
图片上传（单张）：< 2 秒
保存到 Notion：< 5 秒
🎯 关键决策（在本规划中已确定）
决策 选择 理由
技术栈 TypeScript + React + Webpack 与 web-clipper 一致，社区验证，单人开发可参考示例
Manifest 版本 V3 Chrome 最新标准，符合未来方向
认证方式 OAuth + API Key（并行） 用户可选，降低初期配置复杂度
字段映射 动态自动识别 + 手动备选 减少配置工作，提升用户体验
图片处理 MVP 必须支持 符合用户需求，参考 notion-pic 方案
浏览器支持 Chrome + Edge 简化初期工作，未来可扩展
MVP 范围 3 个核心模块（认证、提取、保存） 4-6 周内完成，保证质量
📦 交付物清单
✅ 代码仓库的完整版本，包括：

源代码（TypeScript）
配置文件（manifest.json, webpack.config.js 等）
构建脚本（package.json）
✅ 用户文档：

安装指南（如何加载到 Chrome）
快速开始（连接 Notion 和保存第一个页面）
常见问题和故障排除
✅ 开发者文档：

架构说明
模块化设计文档
API 集成指南（便于未来扩展）
💡 未来扩展方向（Post-MVP）
字段类型支持扩展：select, multi_select, relations, rollup
批量操作：一次性保存多个标签页
快捷键：快速保存快捷方式
高级内容处理：代码块、表格、公式保留
Firefox 支持：兼容 WebExtensions API
同步功能：定期重新获取工作空间数据库列表
这个计划是否符合你的预期？有没有需要调整的部分？

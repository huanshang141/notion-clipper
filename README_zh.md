[English version](README.md)

# 中文说明

将网页内容一键保存到 Notion 数据库的 Chrome 扩展。

### 主要能力

- 提取网页正文并转换为 Markdown
- 在原页面内进行预览编辑（WYSIWYG + Markdown 还原）
- 自动识别 Notion 数据库字段并支持手动映射
- 支持图片下载/上传到 Notion
- 支持浅色 / 深色主题（Popup + In-page Preview）

### 项目亮点

- **自动保存外链图片到Notion**：自动下载外链图片并上传到Notion，避免链接失效，确保内容长期可访问
- **简单且权限可控的API密钥配置**：基于Notion的Internal Integration API，使用简单的令牌认证，权限粒度可控
- **小巧专注**：轻量级的扩展，专注于一件事——将网页内容保存到Notion，没有冗余功能

### 快速开始

```bash
npm install
npm run build
```

加载扩展：

1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择项目下的 `dist/`

### 开发命令

```bash
npm run dev
npm run build
npm run lint
```

### 认证说明

- 使用 Notion Internal Integration Token（前缀 `ntn_`）
- 在扩展弹窗中直接输入，不需要写入本地文件

### 文档

请参阅 `docs/en` 和 `docs/zh` 中的详细说明。

### 参考项目

本项目参考了以下优秀的开源项目：

- [web-clipper](https://github.com/webclipper/web-clipper) - 开源的通用网页剪裁工具
- [Save to Notion浏览器插件](https://microsoftedge.microsoft.com/addons/detail/save-to-notion/mhbgebmjigmgkdmehblomgoappmeckfa) - 流行的Notion保存浏览器插件

### 开源依赖

本项目使用了以下开源库和工具：

**核心依赖：**
- [React](https://react.dev/) - 用于构建用户界面的JavaScript库
- [TypeScript](https://www.typescriptlang.org/) - 为JavaScript添加静态类型的语言
- [@notionhq/client](https://github.com/makenotion/notion-sdk-js) - 官方Notion JavaScript SDK
- [@mozilla/readability](https://github.com/mozilla/readability) - Mozilla开发的内容提取库
- [turndown](https://github.com/mixmark-io/turndown) - HTML到Markdown转换器
- [marked](https://github.com/markedjs/marked) - Markdown解析器和编译器
- [axios](https://github.com/axios/axios) - 基于Promise的HTTP客户端

**构建工具：**
- [Webpack](https://webpack.js.org/) - 模块打包器
- [Babel](https://babeljs.io/) - JavaScript编译器
- [ESLint](https://eslint.org/) - JavaScript代码检查工具
- [Copy Webpack Plugin](https://github.com/webpack-contrib/copy-webpack-plugin) - Webpack文件复制插件
- [HTML Webpack Plugin](https://github.com/jantimon/html-webpack-plugin) - HTML生成插件

### 安全说明

- `.env` 已被忽略，不应提交真实密钥
- 仅保留占位符配置文件 `.env.example`

### 许可证

MIT

# Notion Clipper

一个 Chrome 浏览器扩展，用于快速将网页内容保存到 Notion。

## 功能

- 🚀 一键保存网页到 Notion
- 📄 自动提取文章正文和标题
- 🖼️ 自动处理和上传图片到 Notion
- 🔐 支持 API Key 认证（Internal Integration Token）
- 🎯 智能字段映射，自动识别数据库结构

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发

```bash
npm run dev
```

这将启动开发服务器，监视文件变化并自动重新编译。

### 构建

```bash
npm run build
```

构建生产版本到 `dist/` 目录。

### 加载到 Chrome

1. 打开 Chrome，进入 `chrome://extensions/`
2. 启用"开发者模式"（右上角开关）
3. 点击"加载已解压的扩展"
4. 选择项目的 `dist/` 目录
5. 扩展应该成功加载

## 项目结构

```
notion-clipper/
├── src/
│   ├── background/          # 后台脚本（Service Worker）
│   ├── content/             # 内容脚本
│   ├── popup/               # 弹出窗口 UI
│   ├── options/             # 设置页面
│   ├── services/            # 业务逻辑服务
│   ├── utils/               # 工具函数
│   └── types/               # TypeScript 类型定义
├── public/                  # 静态资源
├── dist/                    # 构建输出（生成）
├── manifest.json            # Chrome 扩展配置
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## 开发指南

### IPC 通信

扩展使用 Chrome 的 `runtime.sendMessage` 进行进程间通信。

### 存储

使用 Chrome `storage.sync` 存储用户配置和 token，支持跨设备同步。

## 许可证

MIT

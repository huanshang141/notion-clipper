# Notion Clipper

将网页内容一键保存到 Notion 数据库的 Chrome 扩展（Manifest V3 + React + TypeScript）。

## 主要能力

- 提取网页正文并转换为 Markdown
- 在原页面内进行预览编辑（WYSIWYG + Markdown 还原）
- 自动识别 Notion 数据库字段并支持手动映射
- 支持图片下载/上传到 Notion
- 支持浅色 / 深色主题（Popup + In-page Preview）

## 快速开始

```bash
npm install
npm run build
```

加载扩展：

1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 选择“加载已解压的扩展程序”
4. 选择项目下的 `dist/`

## 开发命令

```bash
npm run dev
npm run build
npm run lint
```

## 认证说明

- 使用 Notion Internal Integration Token（前缀 `ntn_`）
- 在扩展弹窗中直接输入，不需要写入本地文件

## 文档分工

- [QUICKSTART.md](QUICKSTART.md): 5 分钟上手
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): 架构、消息流、开发说明
- [TEST_PLAN.md](TEST_PLAN.md): 测试范围与执行清单

## 安全与公开仓库说明

- `.env` 已被忽略，不应提交真实密钥
- 仅保留占位符配置文件 `.env.example`

## 许可证

MIT

# Notion Clipper - 快速开始指南

## 🚀 5 分钟快速开始

### 1. 安装和构建

```bash
# 克隆或下载项目
cd notion-clipper

# 安装依赖
npm install

# 构建扩展
npm run build
```

### 2. 加载到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 启用右上角的 **"开发者模式"**
3. 点击 **"加载已解包的扩展程序"**
4. 选择项目的 `dist/` 目录

### 3. 获取 Notion API Key

1. 访问 https://www.notion.so/my-integrations
2. 点击 **"创建新集成"**
3. 选择您的工作区并给集成命名
4. 点击 **"提交"**
5. 在出现的页面上复制 **"Internal Integration Token"** (以 `secret_` 开头)

### 4. 在扩展中配置

1. 打开任何网页
2. 点击扩展图标（右上角的拼图图标）
3. 点击 **Notion Clipper**
4. 在登录表单中粘贴 API Key
5. 点击 **"连接"**

### 5. 保存你的第一篇文章

1. 访问任何文章或新闻页面
2. 点击扩展搹标，再点击 **"提取当前页面"**
3. 系统会自动提取页面内容
4. 选择要保存的 Notion 数据库
5. 点击 **"保存到 Notion"**

✅ 完成！文章已保存到您的 Notion 工作区。

## 📋 功能

- **自动提取**: 使用 Mozilla Readability 提取文章内容
- **智能映射**: 自动将网页字段映射到 Notion 数据库字段
- **图片支持**: 提取和保存文章中的图片
- **元数据**: 保存作者、发布日期等元信息
- **多格式**: 支持 Markdown 内容格式

## 🔧 配置选项

访问 Chrome 扩展管理页面 → Notion Clipper → **"选项"** 来配置：

- **自动下载图片**: 自动下载并保存文章中的图片
- **调试模式**: 在浏览器控制台显示详细日志

## 🐛 调试

### 查看日志

按 `F12` 打开开发者工具，查看在以下位置的日志：

- **后台脚本**: 在扩展详情页点击 "background service worker"
- **Popup**: 右击扩展图标 → "检查弹出式窗口"
- **Content Script**: 在任何网页按 `F12` 后，在 Console 下拉菜单选择内容脚本

### 常见问题

| 问题         | 解决方案                                     |
| ------------ | -------------------------------------------- |
| 扩展不显示   | 确保在 `chrome://extensions/` 启用了扩展     |
| API Key 错误 | 检查是否正确复制，应以 `secret_` 开头        |
| 无法提取内容 | 刷新页面重试，某些网站可能有 JavaScript 保护 |
| 保存失败     | 检查 API Key 是否过期，或数据库是否有权限    |

## 📱 支持的浏览器

- Chrome 90+
- Edge 90+ (使用相同的扩展)
- 其他基于 Chromium 的浏览器

## 💡 技巧

1. **批量保存**: 可以一次提取多个页面，并分别保存到不同的数据库
2. **自定义字段**: 在 Notion 中创建自定义字段，扩展会自动尝试映射
3. **标记化**: 在 Notion 中添加 "Tags" 字段，提取器会自动提取关键词
4. **定期同步**: 可以在同一页面重复保存以更新内容

## 🔗 有用的链接

- [Notion API 文档](https://developers.notion.com)
- [Mozilla Readability GitHub](https://github.com/mozilla/readability)
- [Chrome 扩展文档](https://developer.chrome.com/docs/extensions/)
- [提交问题](../../issues)

## 📝 许可证

MIT License - 随意使用和修改

---

需要帮助? 查看 [DEVELOPMENT.md](./DEVELOPMENT.md) 获取深入文档。

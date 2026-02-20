# Notion Clipper - 第 2 周测试验证清单

## ✅ 项目完成度

### 开发完成

- [x] 认证系统（API Key）
- [x] Notion API 集成
- [x] Popup UI
- [x] Settings 页面
- [x] 错误处理
- [x] 类型定义
- [x] 文档和指南

### 待验证

- [ ] 完整的端到端流程
- [ ] 各种网站兼容性
- [ ] 不同 Notion 资库配置

## 📋 测试清单

### Part 1: 环境设置

```
[ ] Node.js 已安装 (v14+)
[ ] npm dependencies 已安装 (npm install)
[ ] 项目构建成功 (npm run build)
[ ] dist/ 目录已生成
[ ] Chrome/Edge 已启用开发者模式
```

### Part 2: API 密钥配置

```
[ ] 访问 https://www.notion.so/my-integrations
[ ] 创建了新集成
[ ] 复制了 Internal Integration Token
[ ] Token 格式: secret_开头
[ ] 验证权限: workspace读取、数据库读取、页面创建
```

### Part 3: 扩展加载

```
[ ] 打开 chrome://extensions/
[ ] 启用开发者模式
[ ] 点击"加载已解包的扩展程序"
[ ] 选择了 dist/ 目录
[ ] 扩展图标出现在工具栏
[ ] 点击扩展图标能打开 Popup
```

### Part 4: 认证流程

```
[ ] 打开任何网页
[ ] 点击扩展图标
[ ] 输入 API Key
[ ] 点击"连接"按钮
[ ] 显示成功消息
[ ] 刷新后仍然已认证
```

### Part 5: 数据库操作

```
[ ] 点击"提取当前页面"
[ ] 系统提取了页面内容
[ ] 选择了目标 Notion 数据库
[ ] 看到了字段映射预览
[ ] 可以编辑文章标题
[ ] 字段映射正确显示 (✓ 标记)
```

### Part 6: 保存操作

```
[ ] 点击"保存到 Notion"
[ ] 显示"保存中..."
[ ] 收到成功消息
[ ] 访问 Notion 验证页面已创建
[ ] 页面包含正确的标题
[ ] 页面包含文章内容
[ ] 页面包含源 URL
```

### Part 7: 设置页面测试

```
[ ] 打开扩展选项页面
[ ] 显示已连接状态
[ ] 点击"测试连接"按钮
[ ] 收到测试成功消息
[ ] "自动下载图片"设置可切换
[ ] "调试模式"设置可切换
[ ] 点击"退出登录"后清除认证
```

### Part 8: 不同页面类型测试

```
[ ] 新闻文章页面 - 抢 ✓ 成功
[ ] 博客文章页面 - 测试 ✓ 成功
[ ] 维基页面 - 测试 ✓ 成功
[ ] PDF 查看器 - 测试 ✓ 成功
[ ] 单页 App - 测试 ✓ 成功
```

### Part 9: 错误处理测试

```
[ ] 输入无效 API Key - 显示错误
[ ] 网络断开 - 显示连接错误
[ ] 数据库删除后保存 - 显示数据库不存在错误
[ ] 无权限的数据库 - 显示权限错误
[ ] 超大文章 - 正确处理限制
```

### Part 10: 性能测试

```
[ ] 首次加载时间: < 3s
[ ] API Key 验证: < 2s
[ ] 列出数据库: < 3s
[ ] 提取页面内容: < 5s
[ ] 保存到 Notion: < 5s
[ ] 内存占用: < 50MB
```

## 🐛 已知问题

### 已解决

- ✅ TypeScript 编译错误
- ✅ React JSX 导入问题
- ✅ Webpack 构建配置
- ✅ IPC 消息处理

### 未解决 (后续版本)

- [ ] 大型图片优化加载
- [ ] 超时重试机制
- [ ] 批量保存功能
- [ ] Firefox 兼容性

## 📊 测试结果示例

### 成功场景

```
1. 简单文章保存
   输入: https://example.com/article
   API Key: secret_valid_key
   结果: ✅ 页面已保存到 Notion

2. 有图片的文章
   输入: https://news.site/story
   包含: 3 张图片
   结果: ✅ 图片链接已提取
```

### 失败场景

```
1. 无效 API Key
   输入: invalid_key
   结果: ❌ "无效 API Key 格式"

2. 无网络连接
   结果: ❌ "连接失败"
```

## 🔍 调试步骤

### 查看日志

```
// Popup 日志
右键 → 检查弹出式窗口 → Console

// 后台脚本日志
chrome://extensions/ → Notion Clipper → background service worker

// Content Script 日志
任何网页 → F12 → Console → 选择 Content Script
```

### 常见日志消息

```
✓ "Notion Clipper background script loaded"
✓ "Authentication successful"
✓ "Extracted article: {"title": "...", "content": "..."}"
✓ "Page created successfully"
```

## 📝 测试报告模板

```
日期: ___________
测试环境: Chrome ___  / Edge ___
网站: _________________

总体: [ ] 通过  [ ] 失败

功能测试:
[ ] 认证: _____
[ ] 提取: _____
[ ] 保存: _____

性能:
[ ] 响应时间: _____ ms
[ ] 内存占用: _____ MB

问题:
1. ___________________
2. ___________________

建议:
1. ___________________
```

## 🚀 下一步

当所有测试通过后:

1. [ ] 整理所有的 bug 报告
2. [ ] 优化性能加载
3. [ ] 准备 Week 3 工作 (图片处理)
4. [ ] 开始实施更多功能

## 🎓 学习资源

- [Notion API 文档](https://developers.notion.com)
- [Chrome 扩展开发](https://developer.chrome.com/docs/extensions)
- [React 官方文档](https://react.dev)
- [TypeScript 手册](https://www.typescriptlang.org/docs)

---

**最后更新**: Week 2 完成  
**下次审查**: Week 3 开始

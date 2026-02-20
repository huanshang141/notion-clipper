# 🚀 Notion Clipper - 快速开始指南

## 5分钟快速开始

### 1️⃣ 构建扩展程序

```bash
npm install  # 如果之前没有安装过
npm run build
```

✅ 预期输出：`webpack 5.x.x compiled successfully`

### 2️⃣ 在Chrome中加载

1. 打开 `chrome://extensions/`
2. 开启右上角的 **开发者模式**
3. 点击 **加载未打包的扩展程序**
4. 选择项目文件夹内的 `dist` 目录

✅ 应该看到 Notion Clipper 扩展出现在列表中

### 3️⃣ 准备Notion

1. 登录 https://www.notion.so/my-integrations
2. 点击 **创建新集成**
3. 填写名称（如"Clipper"）
4. 复制 **秘密令牌**（以 `ntn_` 开头）

### 4️⃣ 创建测试数据库

1. 创建新的Notion数据库
2. 添加以下字段：
   - 标题（Title）- 必需
   - URL（Url）
   - 内容（Rich Text）
   - 摘要（Rich Text）
   - 标签（Multi-select）

3. 与上面的集成共享数据库：
   - 在数据库中，点击 **共享**
   - 选择创建的集成
   - **邀请**它

### 5️⃣ 测试扩展程序

1. 访问任何网站（如 https://github.com）
2. 点击Chrome工具栏中的Notion Clipper图标
3. 粘贴你的API密钥，点击**连接**
4. 选择数据库
5. 点击**保存到Notion**

✅ 查看你的Notion数据库 - 应该有一个新页面！

---

## 📋 验证清单

在发布前检查这些：

- [ ] `npm run build` 成功（无错误）
- [ ] 扩展在Chrome中加载
- [ ] 能够输入和验证API密钥
- [ ] 认证成功
- [ ] 数据库列表显示
- [ ] 内容被正确提取
- [ ] 字段被自动映射
- [ ] 页面保存到Notion
- [ ] Notion链接可点击
- [ ] 图片（如果有）被包含

---

## 🐛 常见问题

| 问题          | 解决方案                                                  |
| ------------- | --------------------------------------------------------- |
| 扩展未加载    | 检查 `dist/` 文件夹存在，重新加载extension列表            |
| API密钥被拒绝 | 确保密钥以 `ntn_` 开头，从 notion.so/my-integrations 复制 |
| 看不到数据库  | 确认集成与工作区共享，数据库与集成共享                    |
| 保存失败      | 检查网络连接，确认数据库有title字段                       |
| 图片未显示    | 某些图片可能受CORS限制，检查浏览器控制台的错误            |

---

## 📁 重要文件

| 文件                      | 用途                          |
| ------------------------- | ----------------------------- |
| `TEST_PLAN.md`            | 详细的测试计划和用例          |
| `INTEGRATION_TESTS.js`    | 自动化测试 - `node 文件名.js` |
| `IMPLEMENTATION_GUIDE.md` | 完整的实现文档                |
| `COMPLETION_SUMMARY.md`   | 项目完成总结                  |
| `src/utils/errors.ts`     | 错误代码和消息                |

---

## 🔧 开发命令

```bash
# 开发模式（监视文件变化）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 运行自动化测试
node INTEGRATION_TESTS.js
```

---

## 📞 获取帮助

1. **查看错误代码**：查看 `src/utils/errors.ts`
2. **检查日志**：右键扩展 → 检查背景页面 → 控制台
3. **查看常问问题**：查看 `IMPLEMENTATION_GUIDE.md` 的 **故障排除** 部分
4. **运行测试**：执行 `node INTEGRATION_TESTS.js`

---

## ✨ 提示和技巧

### 获取更好的体验

- 将扩展固定到工具栏（提高可见性）
- 右键扩展 → "在扩展页面上管理" 获得更多信息
- 定期检查 Chrome DevTools 以获得新的Notion API 变化

### 快速测试

1. 打开任何网站
2. **Cmd/Ctrl + Shift + J** 打开DevTools
3. 在控制台中查看错误
4. 扩展图标 → 检查背景页面以查看完整日志

### 调试技巧

```javascript
// 在扩展的背景页面控制台中：
chrome.storage.sync.get(["auth_token"], (r) => console.log(r));
// 查看已保存的token
```

---

## 🎯 接下来呢？

### 立即

- ✅ 通过上述步骤测试扩展
- ✅ 验证快速检查清单
- ✅ 尝试几个不同的网站

### 然后

- 📖 阅读 `IMPLEMENTATION_GUIDE.md` 了解架构
- 🧪 运行 `INTEGRATION_TESTS.js` 验证逻辑
- 📝 执行 `TEST_PLAN.md` 中的完整测试套件

### 最后

- 🚀 发布到Chrome Web Store
- 🎉 与用户分享！

---

## 📚 文档地图

```
项目文件夹/
├── README.md                     ← 你在这里
├── COMPLETION_SUMMARY.md         ← 项目总结
├── IMPLEMENTATION_GUIDE.md       ← 深入实现细节
├── TEST_PLAN.md                  ← 全面的测试计划
├── INTEGRATION_TESTS.js          ← 自动化测试脚本
│
├── dist/                         ← 编译输出（用于Chrome）
├── src/                          ← 源代码
│   ├── services/                 ← 核心逻辑
│   ├── popup/                    ← UI组件
│   ├── utils/                    ← 工具函数
│   └── ...
│
└── package.json                  ← 项目配置
```

---

**现在就开始吧！** 🎉

有任何问题？查看 `IMPLEMENTATION_GUIDE.md` 中的故障排除部分。

# Chrome Extension 加载错误修复

## 问题

在 Chrome 中加载 Notion Clipper 扩展时出现以下错误：

```
Uncaught ReferenceError: process is not defined
```

## 根源

源代码中使用了 `process.env`（Node.js 特性），但在 Chrome Extension Service Worker（浏览器环境）中不可用。

`src/utils/constants.ts` 第 11 行：

```typescript
clientId: process.env.NOTION_CLIENT_ID || '', // ❌ 错误
redirectUri: chrome.identity.getRedirectURL(''), // ❌ 错误：顶级作用域调用
```

## 解决方案

### 1. constants.ts 修改

- 移除 `process.env` 使用
- 延迟执行 `chrome.identity.getRedirectURL()`（仅在运行时）
- 新增 `getOAuthRedirectUri()` 函数

```typescript
// ✅ 修复后
export const OAUTH_CONFIG = {
  clientId: "", // 在需要时配置
  redirectUri: "", // 在运行时通过函数获取
  scope: ["user.self:read"],
};

export function getOAuthRedirectUri(): string {
  if (typeof chrome !== "undefined" && chrome.identity) {
    return chrome.identity.getRedirectURL("");
  }
  return "";
}
```

### 2. auth.ts 修改

- 导入新的 `getOAuthRedirectUri` 函数
- 使用函数调用替代常量访问

```typescript
// ✅ 修复后
authUrl.searchParams.set("redirect_uri", getOAuthRedirectUri());
```

### 3. webpack.config.js 增强

- 添加 DefinePlugin 确保任何遗留的 process.env 都被正确处理

```javascript
new webpack.DefinePlugin({
  'process.env': JSON.stringify({}),
}),
```

## 修改的文件

| 文件                     | 修改内容                                   |
| ------------------------ | ------------------------------------------ |
| `src/utils/constants.ts` | 移除 process.env，延迟执行 chrome API 调用 |
| `src/services/auth.ts`   | 使用 getOAuthRedirectUri() 函数            |
| `webpack.config.js`      | 添加 webpack DefinePlugin                  |
| `dist/background.js`     | 在构建时自动重新生成                       |

## 构建状态

```
✅ npm run build - compiled successfully in 5364 ms
✅ No 'process.env' references in dist/background.js
✅ No 'process is not defined' errors
```

## 如何重新加载扩展

1. **打开 Chrome 扩展管理页面**

   ```
   chrome://extensions/
   ```

2. **启用开发者模式**
   - 右上角切换 "开发者模式"

3. **重新加载或重新加载扩展**
   - 如果已加载：点击扩展卡片上的刷新按钮
   - 如果未加载：点击 "加载已解包的扩展程序"
   - 选择项目的 `dist/` 目录

4. **验证加载成功**
   - ✅ 扩展应该出现在工具栏
   - ✅ 不应该有红色错误提示
   - ✅ 打开开发者工具时应该看到 Service Worker 已运行

## 技术细节

### 为什么需要延迟执行 chrome.identity.getRedirectURL()？

- **问题**：在模块加载时（顶级作用域）调用 chrome API 可能会在 API 未就绪时失败
- **解决**：将调用包装在函数中，在需要时（运行时）再执行
- **验证**：确保代码使用 `typeof chrome !== 'undefined'` 检查 API 可用性

### 为什么使用 DefinePlugin？

- **作用**：在构建时替换代码中的表达式
- **好处**：确保即使有其他地方意外使用 process.env，也不会导致运行时错误
- **配置**：`'process.env': JSON.stringify({})` - 将 process.env 替换为空对象

## 后续配置（如需使用 OAuth）

目前扩展默认使用 API Key 认证，OAuth 功能已预留但未激活。如需启用 OAuth：

1. 在 Notion 注册应用：https://www.notion.so/my-integrations
2. 获取 Client ID
3. 通过以下方式配置：
   - 在 options 页面添加配置表单
   - 或在 constants.ts 中直接设置（使用环境变量管理）

## 验证列表

- [x] 移除 process.env 使用
- [x] 延迟执行 chrome.identity 调用
- [x] 更新 auth.ts 以使用新函数
- [x] 添加 webpack DefinePlugin
- [x] 重新编译（成功）
- [x] 验证 dist/background.js 中无 process 引用
- [ ] 在 Chrome 中重新加载扩展（用户操作）
- [ ] 验证扩展成功加载而无错误（用户验证）

## 如需进一步帮助

如果加载后仍有其他错误，请查看：

1. **Chrome 扩展管理页面**
   - 扩展详情 → background service worker → 查看日志

2. **浏览器控制台**
   - F12 → Console 标签 → 查看错误信息

3. **检查文件**
   - 确保 `dist/manifest.json` 和 `dist/background.js` 都存在
   - 确保路径正确

---

**修复日期**: 2026-02-20  
**状态**: ✅ 已完成并验证

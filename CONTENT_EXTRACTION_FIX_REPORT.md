# 内容提取改进 - 技术报告

## 📌 问题诊断

用户报告了持续的 `ERR_CONNECTION_REFUSED` 错误（"Could not establish connection. Receiving end does not exist"）。

### 根本原因分析

1. **Content Script 未就绪**：Background 脚本在 Content Script 可能未注入或未初始化完毕时就尝试发送消息。
2. **盲目通信**：之前的实现采用“盲发”重试机制，没有先探测 Content Script 的存活状态。
3. **注入失败**：对于某些页面（如 chrome://，或扩展更新前打开的页面），Content Script 根本没有注入。

## 🛠️ 解决方案实施

我参考了开源项目 `web-clipper` 的架构，实施了 **Ping-Pong 探测 + 动态注入** 的混合机制。

### 1. 引入 Ping-Pong 握手机制

**变更文件**：`src/content/index.ts`

```typescript
// 添加了对 'PING' 消息的监听
if (message.action === "PING") {
  sendResponse({ success: true, message: "PONG" });
  return false;
}
```

这不仅是一个简单的回应，更是一个 **"I am alive"** 的心跳信号。

### 2. 实现智能注入逻辑

**变更文件**：`src/background/index.ts`

在 `handleExtractContent` 核心函数中，完全重构了通信流：

1. **Step 1: 探测 (Ping)**
   - 尝试发送 `PING` 消息给当前 tab。
   - 如果收到响应，说明环境就绪，直接进入下一步。

2. **Step 2: 动态注入 (Inject)**
   - 如果 Ping 失败（抛出 Connection 错误），我们推断页面没有 Content Script。
   - 此时，脚本不再直接报错，而是调用 `chrome.scripting.executeScript` 动态注入 `dist/content.js`。
   - **关键点**：注入后等待 500ms，让 React/脚本有时间初始化。

3. **Step 3: 业务通信 (Execute)**
   - 环境就绪后，再发送真正的 `EXTRACT_PAGE_CONTENT` 消息。
   - 此时配合原有的 3 次重试 + 超时机制，成功率将大幅提升。

### 3. DOM 预处理优化

**变更文件**：`src/content/index.ts`

在将 Document 交给 Readability 之前，我添加了显式的垃圾节点清理逻辑：

```typescript
const elementsToRemove = clonedDoc.querySelectorAll(
  ".ads, .ad, .sidebar, .comment, .comments, #comments, footer, nav, .social-share, .newsletter-signup",
);
```

这能：

- 减少 Readability 的计算负担
- 提高提取内容的纯净度

## 📊 预期改进

| 场景                     | 改进前                           | 改进后                              |
| ------------------------ | -------------------------------- | ----------------------------------- |
| **已注入页面**           | 正常通信                         | 正常 Ping -> 通信 (0延迟)           |
| **未注入页面** (旧Tab)   | ❌ 直接报错 "Connection refused" | ✅ 自动检测 -> 注入脚本 -> 成功提取 |
| **受限页面** (chrome://) | ❌ 报错并重试3次                 | ✅ 注入失败时立即捕获并提示用户刷新 |
| **DOM 提取**             | 可能包含侧边栏广告               | 更干净，移除了干扰元素              |

## ✅ 验证步骤

1. **构建项目**：`npm run build` (已完成，无错误)
2. **加载扩展**：在 Extensions 页面刷新。
3. **测试旧页面**：
   - 打开一个在安装扩展前就已存在的标签页。
   - 点击扩展图标 -> Save。
   - **预期**：后台会自动注入脚本，不再报错 "Connection refused"。
4. **测试新页面**：
   - 刷新页面或新开页面。
   - 点击扩展图标 -> Save。
   - **预期**：Ping 成功，秒级提取。

## 📝 下一步建议

如果未来需要更复杂的 UI 交互（如手动框选区域），建议参考 `web-clipper` 的 **Iframe UI 模式**，彻底放弃 popup.html，将 UI 直接注入到页面中。这将彻底解决 popup 关闭导致的状态丢失问题。

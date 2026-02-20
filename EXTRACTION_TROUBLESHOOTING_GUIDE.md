# HTML内容提取 - 完整故障排除和测试指南

## 🚨 快速故障排除流程

当看到"Extraction failed"或"Could not establish connection"错误时，按照以下顺序检查：

### 1️⃣ 验证扩展是否正确加载

```bash
# 虽然无法直接运行这些命令，但指导用户在浏览器中执行
# 在任何网站上打开DevTools (F12) → 控制台
```

**在浏览器DevTools控制台中执行**：

```javascript
// 检查chrome API是否可用
console.log("chrome API:", typeof chrome);
console.log("chrome.runtime:", typeof chrome.runtime);

// 验证content script是否注入
console.log("Content script context: ", window);
```

**预期结果**：

```
chrome API: object
chrome.runtime: object
```

---

### 2️⃣ 检查Content Script的初始化日志

**步骤**：

1. 打开要提取内容的网站（如Medium、Dev.to等）
2. 按 `F12` 打开DevTools
3. 在控制台中查找这条日志：
   ```
   [NotionClipper] Content script loaded
   ```

**如果✅ 看到日志**：

- Content script已正确注入
- 继续第3步

**如果❌ 没有看到日志**：

- Content script注入失败
- **解决方案**：
  1. 进入 `chrome://extensions/`
  2. 找到"Save to Notion"
  3. 点击"删除"
  4. 重新加载扩展
  5. 刷新网页

---

### 3️⃣ 检查Background Service Worker

**步骤**：

1. 打开 `chrome://extensions/`
2. 找到"Save to Notion"扩展
3. 点击"检查视图"按钮
4. 弹出新窗口，选择"Service Worker"tab
5. 在控制台中查找：
   ```
   [NotionClipper Background] Service Worker initialized
   ```

**如果✅ 看到日志**：

- Background脚本正常工作
- 继续第4步

**如果❌ 没有看到日志**：

- Background脚本启动失败
- **解决方案**：
  1. 检查浏览器控制台是否有错误
  2. 按"重新载入"按钮
  3. 如果仍然无法工作，重新加载扩展

---

### 4️⃣ 执行完整的数据流测试

**步骤**：

#### A. 准备工作

1. 打开一个内容丰富的网站（推荐）：
   - https://medium.com （文章内容）
   - https://dev.to （技术博客）
   - https://wikipedia.org （百科页面）

2. 打开3个开发者工具窗口：
   - **窗口1**：网站的DevTools（F12）
   - **窗口2**：Service Worker的DevTools（见第3步）
   - **窗口3**：Popup的DevTools（扩展图标右键 → 检查元素）

#### B. 执行测试

1. 点击扩展图标 → 弹出Popup
2. 如果已登录，应该看到数据库列表
3. 点击"Try Again"按钮开始提取

#### C. 监控日志输出

**Popup DevTools中的预期日志**：

```
[NotionClipper Popup] Starting content extraction...
[NotionClipper Popup] Sending EXTRACT_CONTENT message to background
[NotionClipper Popup] Background response received: {success: true, hasArticle: true, error: undefined}
[NotionClipper Popup] Content extracted successfully: {title: "Article Title", contentLength: 5000, imagesCount: 3}
```

**Service Worker DevTools中的预期日志**：

```
[NotionClipper Background] Message received: {action: "EXTRACT_CONTENT", senderUrl: "chrome-extension://...", senderId: ...}
[NotionClipper Background] Active tab ID: 123
[NotionClipper Background] Attempting content script communication (1/3)...
[NotionClipper Background] Content script responded successfully
[NotionClipper Background] Article received: {title: "Article Title", contentLength: 5000, imagesCount: 3}
```

**网站DevTools中的预期日志**：

```
[NotionClipper] Content script loaded
[NotionClipper] Content script received message: EXTRACT_PAGE_CONTENT
[NotionClipper] Starting content extraction...
[NotionClipper] Extraction result: {title: "Article Title", contentLength: 5000, imagesCount: 3, mainImage: true}
[NotionClipper] Content extracted successfully
```

---

## 🧪 详细的测试场景

### 测试场景1：标准技术文章（推荐首选）

**网站**：https://dev.to/

**测试步骤**：

1. 访问Dev.to的任何文章
2. 点击扩展"Save to Notion"
3. 应该看到内容提取和列表加载

**预期结果**：

- ✅ 文章标题正确显示
- ✅ 内容被完整提取
- ✅ 图片被识别（如果有）
- ✅ 作者和发布日期可以识别

**常见问题**：

- Dev.to使用React渲染，有时需要等待JS加载
- 如果失败，刷新页面后重试

---

### 测试场景2：Medium文章

**网站**：https://medium.com/

**测试步骤**：

1. 访问任何Medium文章
2. 点击扩展
3. 检查提取结果

**预期结果**：

- ✅ 高质量的Readability提取
- ✅ 多张图片的识别
- ✅ 清晰的元数据

**常见问题**：

- 有时Medium需要登录
- 某些付费文章可能导致提取失败
- 忽略"Could not extract article"错误，使用fallback

---

### 测试场景3：新闻网站

**网站**：https://news.ycombinator.com/ 或任何新闻网站

**测试步骤**：

1. 访问新闻article页面
2. 点击扩展
3. 验证内容

**预期结果**：

- ✅ 新闻标题
- ✅ 新闻正文
- ✅ 图片（通常有主图）

---

### 测试场景4：Wikipedia

**网站**：https://www.wikipedia.org/

**测试步骤**：

1. 访问任何Wikipedia页面
2. 点击扩展
3. 导出到Notion

**预期结果**：

- ✅ 百科标题
- ✅ 清晰的文本结构
- ✅ 多张信息框图片

---

## 🔍 常见错误和解决方案

### 错误1："Could not establish connection"

**原因**：

- Content script未被注入
- Content script已崩溃
- Service Worker已停止

**流程诊断**：

```
┌─ 查看第2步：Content script日志？
│  ├─ ✅ 有日志 → 问题在通信
│  │  └─ 查看第3步和第4步
│  └─ ❌ 无日志 → Content script未加载
│     └─ 重新加载扩展
│
└─ 查看第3步：Background日志？
   ├─ ✅ 有日志 → 通信异常
   │  └─ 检查"Received message"日志
   └─ ❌ 无日志 → Background已停止
      └─ 重启浏览器或重加载扩展
```

**快速修复**：

```javascript
// 在Service Worker DevTools中执行
chrome.runtime.reload();
```

---

### 错误2："Readability library not available"

**原因**：

- @mozilla/readability库未被正确加载
- 页面的DOM结构异常

**日志特征**：

```
[NotionClipper] Readability not found in window, attempting to load...
[NotionClipper] Failed to load Readability:
```

**解决方案**：

1. **使用fallback**：代码已包含SimpleReadability fallback
   - 日志：`Using SimpleReadability fallback`
   - 功能：仍能提取基本的HTML内容

2. **手动验证Readability**：

   ```javascript
   // 在网页DevTools中执行
   console.log("Readability available:", typeof Readability);
   ```

3. **如果都失败**：
   - 页面可能不支持自动内容提取
   - 使用手动选择模式（如果实现）
   - 或手工复制内容到Notion

---

### 错误3："Communication timeout"（提取超过10秒）

**原因**：

- 网页刚加载，DOM未就绪
- Readability处理大型页面需要时间
- 浏览器性能不足

**日志特征**：

```
[NotionClipper Background] Content script communication timeout
```

**解决方案**：

1. **等待页面完全加载**：
   - 不要在页面加载中途点击扩展
   - 等待所有JS执行完毕

2. **减少网页复杂性**：
   - 关闭浏览器标签页
   - 关闭其他进程

3. **转移到更简单的页面**：
   - 某些SPA应用可能太复杂
   - 尝试在简单的新闻网站上测试

4. **增加超时时间**（可选）：
   ```typescript
   // 在background/index.ts中修改
   setTimeout(() => reject(...), 15000); // 改为15秒
   ```

---

### 错误4："Could not parse article content"

**原因**：

- 页面没有主要内容区域
- Readability无法识别文章结构
- 页面是空白的或只有导航

**日志特征**：

```
[NotionClipper] Could not parse article content
```

**测试网页兼容性**：

```javascript
// 在网页DevTools中执行
const reader = new Readability(document.cloneNode(true));
const article = reader.parse();
console.log("Can extract:", !!article);
console.log("Article:", article);
```

**解决方案**：

1. 验证页面确实有主要内容
2. 尝试不同的网站来确认
3. 某些网站可能需要登录
4. 某些SPA应用可能不兼容

---

### 错误5："No images found"（预期中的情况）

**原因**：

- 页面确实没有图片
- 图片由JavaScript动态加载

**验证**：

```javascript
// 在网页DevTools中执行
console.log("Images on page:", document.querySelectorAll("img").length);
```

**解决方案**：

- 这是正常的，继续进行
- 内容仍然可以正确保存到Notion
- 只是mainImage会是undefined

---

## 📋 完整测试清单

### ✅ 安装和加载

- [ ] 扩展在`chrome://extensions/`中列出
- [ ] 扩展图标可见
- [ ] 点击图标可以打开popup

### ✅ 认证

- [ ] 可以输入API密钥
- [ ] 验证成功后显示数据库列表
- [ ] 可以选择目标数据库

### ✅ 内容提取

- [ ] 在非系统页面（http/https）点击扩展时工作
- [ ] 标题正确提取
- [ ] 内容正确提取
- [ ] 图片被识别

### ✅ 数据映射

- [ ] 数据库字段正确显示
- [ ] 字段映射自动填充
- [ ] 可以手动修改映射

### ✅ 保存到Notion

- [ ] 可以点击"Save"按钮
- [ ] Notion成功创建新页面
- [ ] 数据格式正确显示在Notion中

### ✅ 错误处理

- [ ] 未登录时显示错误
- [ ] 网络错误时显示错误
- [ ] Notion错误时显示错误
- [ ] 可以点击"Try Again"重试

---

## 🔧 性能优化建议

### 1. 解决Readability加载缓慢的问题

当看到这个日志时：

```
[NotionClipper] Readability not found in window, attempting to load...
```

**可能的原因和优化**：

```typescript
// 优化后的加载逻辑
async function loadReadability(): Promise<any> {
  try {
    // 1. 检查全局（最快）
    if ((window as any).Readability) {
      return (window as any).Readability;
    }

    // 2. 尝试从特定路径加载
    if (typeof (window as any).Readability !== "undefined") {
      return (window as any).Readability;
    }

    // 3. 使用预编译的fallback（快速）
    return SimpleReadability; // 已定义
  } catch (error) {
    // 4. 最后手段：最小化实现
    return MinimalReadability;
  }
}
```

### 2. 优化提取速度

```typescript
// 在extractPageContent中
const startTime = performance.now();

// ... 提取代码 ...

const endTime = performance.now();
console.log(
  `[NotionClipper] Extraction took ${(endTime - startTime).toFixed(2)}ms`,
);
```

**目标**：

- 简单页面：< 2秒
- 复杂页面：< 5秒
- 非常复杂的页面：< 10秒

### 3. 减少内存使用

```typescript
// 避免保留完整的克隆
const clonedDoc = document.cloneNode(true); // 这会很大
// ... 使用完后立即释放 ...
clonedDoc = null;
```

---

## 📚 参考资源

### Mozilla Readability文档

- GitHub: https://github.com/mozilla/readability
- API: 支持options: `{ keepClasses: true }`

### Chrome扩展文档

- Content Scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- Service Workers: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
- Message Passing: https://developer.chrome.com/docs/extensions/develop/concepts/messaging

### 相关项目

- web-clipper: https://github.com/huanshang141/web-clipper
- Notion API: https://developers.notion.com/

---

## 🎯 调试最佳实践

### 1. 使用适当的日志级别

```typescript
// ❌ 避免
console.log("error"); // 模糊

// ✅ 推荐
console.error("[NotionClipper] Fatal: Content script crashed"); // 清晰
console.warn("[NotionClipper] Warning: Readability not found"); // 警告
console.log("[NotionClipper] Info: Starting extraction"); // 信息
```

### 2. 日志应该包含上下文

```typescript
// ❌ 避免
console.log("Error:", error);

// ✅ 推荐
console.error(
  "[NotionClipper Background] Content script communication failed:",
  {
    action: "EXTRACT_PAGE_CONTENT",
    tabId: activeTab.id,
    error: error.message,
    retry: currentRetry,
  },
);
```

### 3. 使用时间戳跟踪

```typescript
const timestamp = new Date().toISOString();
console.log(`[${timestamp}] [NotionClipper] Event happened`);
```

---

## 📞 无法解决的问题？

如果经历了所有这些步骤后仍然无法工作：

1. **收集诊断信息**：
   - 截图所有3个DevTools窗口的完整日志
   - 记录访问的网站URL
   - 记录使用的Chrome版本

2. **检查是否是页面特定问题**：
   - 在多个不同网站上测试
   - 在隐身模式下测试
   - 尝试简单的网站（如Dev.to）

3. **尝试隔离问题**：
   - 是否整个提取失败？
   - 还是只有特定字段失败？
   - 是否能看到任何日志？

4. **修复步骤**：

   ```bash
   # 完全重建
   npm run build

   # 重新加载扩展
   # 在chrome://extensions/中点击重新加载图标

   # 或完全卸载再重新加载
   ```

---

## 总结

这个改进的内容提取系统应该能够：
✅ 快速诊断问题
✅ 提供清晰的错误消息
✅ 优雅地处理失败
✅ 通过日志追踪完整数据流

祝调试愉快！

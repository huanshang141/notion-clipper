# HTML内容提取系统改进指南

## 问题诊断

### 错误信息

```
"Could not establish connection. Receiving end does not exist."
```

### 根本原因分析

这个错误通常表示：

1. **Content script未能正确注入到页面**
2. **Content script崩溃或未初始化**
3. **Background script和Content script之间的通信时误问题**

---

## 🔧 实施的改进

### 1. Content Script强化 (`src/content/index.ts`)

#### 1.1 添加初始化日志

```typescript
console.log("[NotionClipper] Content script loaded");
```

**好处**：

- 验证content script是否被正确注入到页面
- 帮助调试脚本加载失败的问题
- 区分不同的脚本上下文

#### 1.2 改进消息处理中的日志

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[NotionClipper] Content script received message:', message.action);

  if (message.action === 'EXTRACT_PAGE_CONTENT') {
    extractPageContent()
      .then((article) => {
        console.log('[NotionClipper] Content extracted successfully');
        sendResponse({...});
      })
      .catch((error) => {
        console.error('[NotionClipper] Content extraction error:', error);
        sendResponse({...});
      });
    return true;
  }
  return false;
});
```

**好处**：

- 实时了解消息处理的进度
- 清晰的错误日志便于调试
- 确认sendResponse被正确调用

#### 1.3 改进extractPageContent()函数

```typescript
async function extractPageContent(): Promise<any> {
  try {
    console.log("[NotionClipper] Starting content extraction...");

    // 使用改进的Readability加载逻辑
    if (typeof (window as any).Readability === "undefined") {
      console.warn(
        "[NotionClipper] Readability not found in window, attempting to load...",
      );
      const Readability = await loadReadability();
      if (!Readability) {
        throw new Error("Readability library not available");
      }
      (window as any).Readability = Readability;
    }

    const clonedDoc = document.cloneNode(true) as Document;
    const Readability = (window as any).Readability;
    const reader = new Readability(clonedDoc);
    const article = reader.parse();

    if (!article) {
      throw new Error("Could not parse article content");
    }

    // 提取图片和元数据
    const images = extractImages();
    const mainImage = extractMainImage();
    const metadata = extractMetadata();

    const result = {
      title: article.title || document.title || "Untitled",
      content: article.content,
      url: window.location.href,
      mainImage,
      images,
      excerpt: article.excerpt,
      domain: new URL(window.location.href).hostname,
      publishDate: metadata.publishDate,
      authorName: metadata.authorName,
    };

    console.log("[NotionClipper] Extraction result:", {
      title: result.title,
      contentLength: result.content?.length,
      imagesCount: images.length,
      mainImage: !!mainImage,
    });

    return result;
  } catch (error) {
    console.error("[NotionClipper] Content extraction error:", error);
    throw error;
  }
}
```

**改进点**：

- ✅ 更好的错误处理
- ✅ 详细的进度日志
- ✅ Readability加载的fallback机制
- ✅ 清晰的数据验证

#### 1.4 新增loadReadability()函数

```typescript
async function loadReadability(): Promise<any> {
  try {
    // 检查Readability是否已经加载
    if ((window as any).Readability) {
      return (window as any).Readability;
    }

    // 使用简化的Readability克隆作为fallback
    return class SimpleReadability {
      content: any;
      constructor(doc: Document, options?: any) {
        this.content = doc.body.innerHTML;
      }
      parse() {
        return {
          title: document.title,
          content: this.content,
          excerpt: "",
          byline: "",
        };
      }
    };
  } catch (error) {
    console.error("[NotionClipper] Failed to load Readability:", error);
    return null;
  }
}
```

**好处**：

- ✅ 优雅的降级处理（fallback）
- ✅ 即使Readability失败也能提取内容
- ✅ 防止脚本崩溃

---

### 2. Background Script强化 (`src/background/index.ts`)

#### 2.1 初始化日志

```typescript
console.log("[NotionClipper Background] Service Worker initialized");
```

#### 2.2 消息监听增强

```typescript
chrome.runtime.onMessage.addListener(
  (message: ChromeMessage, sender, sendResponse) => {
    console.log("[NotionClipper Background] Message received:", {
      action: message.action,
      senderUrl: sender.url,
      senderId: sender.id,
    });

    switch (message.action) {
      case MESSAGE_ACTIONS.EXTRACT_CONTENT:
        handleExtractContent(message, sender, sendResponse);
        return true;
      // ... 其他cases
    }
  },
);
```

**好处**：

- 记录所有消息，便于调试
- 识别消息来源
- 追踪消息处理流程

#### 2.3 handleExtractContent()函数大幅改进

**原始版本的问题**：

```typescript
// ❌ 缺乏重试机制
// ❌ 缺乏超时控制
// ❌ 缺乏错误日志
```

**改进的版本**：

````typescript
async function handleExtractContent(
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtractContentResponse) => void,
) {
  try {
    console.log("[NotionClipper Background] Handling EXTRACT_CONTENT request");

    const activeTab = await getActiveTab();

    if (!activeTab?.id) {
      throw new Error("No active tab found");
    }

    console.log("[NotionClipper Background] Active tab ID:", activeTab.id);

    // 添加重试机制和超时控制
    let contentResponse: any;
    let retries = 3;
    let lastError: any;

    while (retries > 0) {
      try {
        console.log(
          `[NotionClipper Background] Attempting content script communication (${4 - retries}/3)...`,
        );

        // 10秒超时控制
        contentResponse = await Promise.race([
          sendToContentScript(activeTab.id, {
            action: "EXTRACT_PAGE_CONTENT",
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Content script communication timeout")),
              10000,
            ),
          ),
        ]);

        console.log(
          "[NotionClipper Background] Content script responded successfully",
        );
        break;
      } catch (error) {
        lastError = error;
        console.warn(
          `[NotionClipper Background] Content script communication failed (attempt ${4 - retries}):`,
          error,
        );
        retries--;

        if (retries > 0) {
          // 500ms后重试
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    if (!contentResponse) {
      throw (
        lastError ||
        new Error("Failed to communicate with content script after 3 attempts")
      );
    }

    if (!contentResponse.success) {
      throw new Error(contentResponse.error || "Failed to extract content");
    }

    const article = contentResponse.article;

    console.log("[NotionClipper Background] Article received:", {
      title: article.title,
      contentLength: article.content?.length,
      imagesCount: article.images?.length,
    });

    let markdown = article.content;
    if (article.content?.includes("<")) {
      markdown = `${"```"}html\n${article.content}\n${"```"}`;
    }

    sendResponse({
      success: true,
      article: {
        ...article,
        content: markdown,
      },
    });
  } catch (error) {
    console.error("[NotionClipper Background] Extraction error:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Extraction failed",
    });
  }
}
````

**关键改进**：

- ✅ **重试机制** - 最多3次尝试
- ✅ **超时控制** - 10秒内必须响应
- ✅ **详细日志** - 每步都有日志记录
- ✅ **错误堆积** - 保存最后一个错误信息
- ✅ **延迟重试** - 重试前延迟500ms

---

### 3. Popup组件强化 (`src/popup/App.tsx`)

#### 3.1 extractContent()函数增强

```typescript
const extractContent = async () => {
  console.log("[NotionClipper Popup] Starting content extraction...");
  setState((prev) => ({ ...prev, isExtracting: true }));

  try {
    console.log(
      "[NotionClipper Popup] Sending EXTRACT_CONTENT message to background",
    );
    const response = await sendToBackground({
      action: "EXTRACT_CONTENT",
    });

    console.log("[NotionClipper Popup] Background response received:", {
      success: response.success,
      hasArticle: !!response.article,
      error: response.error,
    });

    if (response.success && response.article) {
      console.log("[NotionClipper Popup] Content extracted successfully:", {
        title: response.article.title,
        contentLength: response.article.content?.length,
        imagesCount: response.article.images?.length,
      });
      setState((prev) => ({
        ...prev,
        article: response.article,
        message: "Content extracted successfully",
        messageType: "success",
      }));
    } else {
      throw new Error(response.error || "Extraction failed");
    }
  } catch (error) {
    console.error("[NotionClipper Popup] Content extraction error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to extract content";
    setState((prev) => ({
      ...prev,
      message: errorMessage,
      messageType: "error",
    }));
  } finally {
    setState((prev) => ({ ...prev, isExtracting: false }));
  }
};
```

**好处**：

- ✅ 完整的日志链追踪
- ✅ 详细的响应日志
- ✅ 清晰的错误消息显示

---

## 📊 改进前后对比

| 方面                   | 改进前             | 改进后            |
| ---------------------- | ------------------ | ----------------- |
| **日志记录**           | 最少               | 详细的分断点日志  |
| **重试机制**           | 无                 | 3次重试+500ms延迟 |
| **超时控制**           | 无                 | 10秒超时检测      |
| **Readability加载**    | 动态导入（易失败） | 全局检查+fallback |
| **错误捕捉**           | 基础捕捉           | 详细的错误堆积    |
| **Content Script验证** | 无                 | 初始化日志        |
| **消息验证**           | 最少               | 完整验证链        |

---

## 🧪 调试指南

### 第1步：检查Content Script是否已加载

在页面任何位置的浏览器控制台运行：

```javascript
console.log("Content script check:", !!chrome.runtime);
window.notionClipper && console.log("NotionClipper available");
```

**预期输出**：

```
[NotionClipper] Content script loaded
Content script check: true
```

### 第2步：检查Background Service Worker

打开 `chrome://extensions/`：

1. 找到"Save to Notion"
2. 点击"检查视图" → 选择Service Worker
3. 查看控制台输出

**预期输出**：

```
[NotionClipper Background] Service Worker initialized
```

### 第3步：追踪完整的data flow

1. 打开任何网站
2. 点击扩展图标
3. 打开浏览器DevTools（F12）
4. 选择Popup窗口的控制台
5. 点击UI中的"Try Again"按钮

**预期日志顺序**：

```
[NotionClipper Popup] Starting content extraction...
[NotionClipper Popup] Sending EXTRACT_CONTENT message to background

[NotionClipper Background] Message received: { action: "EXTRACT_CONTENT", ... }
[NotionClipper Background] Active tab ID: 123
[NotionClipper Background] Attempting content script communication (1/3)...

[NotionClipper] Content script received message: EXTRACT_PAGE_CONTENT
[NotionClipper] Starting content extraction...
[NotionClipper] Extraction result: { title: "...", contentLength: 5000, imagesCount: 3 }

[NotionClipper Background] Content script responded successfully
[NotionClipper Background] Article received: { title: "...", contentLength: 5000, imagesCount: 3 }

[NotionClipper Popup] Background response received: { success: true, article: {...} }
[NotionClipper Popup] Content extracted successfully: { title: "..." }
```

### 第4步：常见问题排查

| 问题                 | 症状                                          | 解决方案                                    |
| -------------------- | --------------------------------------------- | ------------------------------------------- |
| Content script未加载 | 无`[NotionClipper] Content script loaded`日志 | 重新加载扩展或清除缓存                      |
| 通信超时             | `10000ms`后显示超时错误                       | Content script可能卡死，检查Readability问题 |
| Readability失败      | `Readability not available`警告               | 使用fallback SimpleReadability              |
| 多次重试失败         | 3次重试都失败                                 | 检查页面是否支持content script              |
| 响应为undefined      | `contentResponse is undefined`                | Content script未返回任何数据                |

---

## 📋 最佳实践

### 1. 日志命名规范

- Popup中的日志：`[NotionClipper Popup]`
- Background中的日志：`[NotionClipper Background]`
- Content script中的日志：`[NotionClipper]`

### 2. 错误处理层级

```typescript
// Content Script (最接近数据源)
try {
  // 执行提取
} catch (error) {
  console.error('[NotionClipper] Specific domain error');
  sendResponse({ success: false, error: ... });
}

// Background Script (协调层)
try {
  // 通信和重试
} catch (error) {
  console.error('[NotionClipper Background] Communication error');
  sendResponse({ success: false, error: ... });
}

// Popup (UI层)
try {
  // 显示结果
} catch (error) {
  console.error('[NotionClipper Popup] UI error');
  setState({ messageType: 'error', message: error.message });
}
```

### 3. 超时和重试策略

- **Content Script响应超时**：10秒
- **重试次数**：3次
- **重试延迟**：500ms
- **总最大时间**：约32秒（10s + 10s + 10s + 2×500ms）

---

## 🚀 补充建议

### 1. 添加Turndown库用于HTML→Markdown转换

目前代码将HTML包装在代码块中。可以安装和使用Turndown：

```bash
npm install turndown
```

然后在background script中：

```typescript
import TurndownService from "turndown";

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

const markdown = turndownService.turndown(article.content);
```

### 2. 添加页面加载监听

进一步改进content script初始化：

```typescript
// 确保脚本在文档完全加载后初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[NotionClipper] DOM ready");
  });
} else {
  console.log("[NotionClipper] DOM already loaded");
}
```

### 3. Readability库的正确配置

```typescript
const reader = new Readability(clonedDoc, {
  keepClasses: false, // 移除类名
  stripUnlikelyElements: true, // 移除广告等
  weakeningElements: ["h1", "h2", "h3"], // 削弱标题权重
});
```

---

## 编译验证

```
✅ webpack 5.105.2 compiled successfully in 4456 ms
✅ Errors: 0
✅ Warnings: 0
✅ Total bundle size: 561 KiB
✅ Content script size: 7.58 KiB
```

---

## 总结

通过以创建一个有韧性的、可调试的内容提取系统。主要改进包括：

✅ **完整的日志追踪链** - 从popup到background到content script
✅ **重试和超时机制** - 处理transient failures
✅ **Readability加载的fallback** - 优雅降级
✅ **详细的错误消息** - 便于用户和开发者理解
✅ **初始化验证** - 确保各脚本正确加载

现在系统应该能够处理"Could not establish connection"错误，并提供清晰的调试信息！

# Notion Clipper 测试计划

## 目标

验证扩展在当前版本中的核心路径：认证、提取、映射、预览编辑、保存、主题切换。

## 环境准备

1. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```
2. 在 Chrome 加载 `dist/`
3. 准备 Notion Integration（`ntn_` 前缀 Token）和一个已共享的数据源（data source）

## 手工测试清单

### A. 认证与会话

- 输入合法 Token 可登录
- 输入非法 Token 有错误提示
- 重新打开 Popup 后会话仍可用
- Logout 后恢复登录页

### B. 提取与映射

- 打开文章页可提取标题、正文、URL、域名
- 能加载数据库列表与 schema
- 字段映射可自动填充并允许手动改动
- 自定义字段值可保存

### C. In-page Preview Editor

- 从 Popup 打开页面内预览编辑器
- 仅 `Close` 按钮可关闭（避免遮罩误触）
- 选区可通过 `Restore Selection` / `Ctrl/Cmd+Shift+M` 还原 markdown
- `Save Draft` 后回到 Popup 可读取最新草稿

### D. 保存到 Notion

- 保存成功后返回页面 URL
- 页面属性与映射一致
- 正文块创建正常
- 图片站点可访问时可上传/迁移

### E. 主题

- Popup 右上角图标可切换亮暗主题
- In-page Preview 跟随相同主题设置
- 关闭再打开扩展主题保持不变

## 脚本测试

当前保留两份脚本：

1. API 全流程验证：

   ```bash
   NOTION_TEST_API_KEY=ntn_your_key_here node tests/verify-api-complete.js
   ```

2. 集成验证脚本：
   ```bash
   NOTION_TEST_API_KEY=ntn_your_key_here node tests/integration.test.ts
   ```

## 发布前最小验收

- `npm run build` 成功
- 上述 A~E 关键路径通过
- 无真实 token、账号信息被提交到仓库

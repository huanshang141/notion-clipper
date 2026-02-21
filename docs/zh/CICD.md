# CI/CD 配置完整指南

本文档详细介绍 Notion Clipper 项目的 CI/CD 配置和使用方法。

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [约定式提交规范](#约定式提交规范)
- [配置文件说明](#配置文件说明)
- [首次使用配置](#首次使用配置)
- [发布流程](#发布流程)
- [本地测试](#本地测试)
- [故障排查](#故障排查)

## 功能特性

### 1. 自动构建和发布 (release.yml)

当推送 tag 时（格式为 `v*`，如 `v1.0.0`），会自动触发以下流程：

- **构建扩展**：使用 webpack 构建生产版本
- **生成 Changelog**：基于 git commit message 使用 git-cliff 自动生成更新日志
- **创建 Release**：将构建产物打包成 zip 文件，并发布到 GitHub Releases

#### 版本规范

- **正式版本**：`v1.0.0`, `v1.2.3` - 创建正式 Release
- **预发布版本**：包含 `alpha`, `beta`, `rc`, `dev` 关键字 - 标记为 Pre-release
  - 示例：`v1.0.0-alpha.1`, `v1.0.0-beta.2`, `v1.0.0-rc.1`

### 2. 持续集成检查 (ci.yml)

当推送代码到 `main` 或 `dev` 分支，或创建 Pull Request 时，会自动：

- 安装依赖
- 运行代码检查 (lint)
- 执行构建测试
- 验证构建产物

### 3. Changelog 自动生成

使用 [git-cliff](https://github.com/orhun/git-cliff) 基于约定式提交（Conventional Commits）自动生成更新日志。

### 4. Issue 模板

提供完善的 Issue 模板，包含：

**中文模板**：

- Bug 反馈
- 功能请求
- 其他问题

**英文模板**：

- Bug Report
- Feature Request
- Other Issues

## 快速开始

### 发布新版本的基本流程

```bash
# 1. 开发并提交代码
git add .
git commit -m "feat: 添加新功能"

# 2. 推送到远程
git push origin main

# 3. 创建并推送 tag
git tag v1.0.0
git push origin v1.0.0

# 4. 自动触发构建和发布
# 访问 https://github.com/YOUR_USERNAME/notion-clipper/actions 查看进度
```

## 约定式提交规范

### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: ✨ 新功能
- `fix`: 🐛 Bug修复
- `docs`: 📚 文档
- `perf`: 🚀 性能优化
- `refactor`: 🚜 代码重构
- `style`: 🎨 样式
- `test`: 🧪 测试
- `chore`: 🔧 日常维护
- `ci`: ⚙️ 持续集成

### 提交示例

```bash
# 新功能
git commit -m "feat: 添加暗色主题支持"
git commit -m "feat(editor): 支持 Markdown 语法高亮"

# Bug 修复
git commit -m "fix: 修复保存时的网络错误"
git commit -m "fix(auth): 修复登录状态丢失问题"

# 文档更新
git commit -m "docs: 更新安装说明"

# 性能优化
git commit -m "perf: 优化图片上传速度"

# 代码重构
git commit -m "refactor: 重构认证模块"

# 样式调整
git commit -m "style: 统一代码格式"

# 重大变更（Breaking Change）
git commit -m "feat!: 重构 API 接口

BREAKING CHANGE: API 接口已完全重构，不再兼容旧版本"
```

### Scope（作用域）示例

常用的 scope 包括：

- `auth`: 认证相关
- `editor`: 编辑器相关
- `popup`: 弹出窗口
- `options`: 设置页面
- `content`: 内容脚本
- `background`: 后台脚本
- `api`: API 相关
- `ui`: 用户界面

## 配置文件说明

### .github/workflows/release.yml

发布工作流，包含四个主要 job：

1. **meta**: 解析版本信息和 tag
   - 识别是否为正式发布
   - 判断是否为预发布版本
   - 设置版本号

2. **build**: 构建扩展并打包
   - 安装依赖
   - 执行生产构建
   - 打包成 zip 文件

3. **changelog**: 生成更新日志
   - 使用 git-cliff 分析 commit 历史
   - 生成格式化的 changelog

4. **release**: 创建 GitHub Release
   - 上传构建产物
   - 添加 changelog 作为 Release 说明
   - 标记是否为预发布版本

### .github/workflows/ci.yml

持续集成工作流，用于：

- 代码质量检查
- 构建测试
- 确保代码可以正常构建

### .github/cliff.toml

git-cliff 配置文件，定义：

- Changelog 的格式和样式
- Commit 类型的分组和排序
- 贡献者信息的显示方式

**重要**：需要修改配置中的仓库信息：

```toml
[remote.github]
owner = "YOUR_GITHUB_USERNAME"  # 替换为你的 GitHub 用户名
repo = "notion-clipper"
```

### .github/ISSUE_TEMPLATE/

Issue 模板目录，包含：

**中文模板**：

- `cn-bug-report.yaml`: Bug 反馈
- `cn-feature-request.yaml`: 功能请求
- `cn-others.yaml`: 其他问题

**英文模板**：

- `en-bug-report.yaml`: Bug Report
- `en-feature-request.yaml`: Feature Request
- `en-others.yaml`: Other Issues

**配置文件**：

- `config.yml`: Issue 模板配置，控制 Issue 创建页面的行为

## 首次使用配置

### 1. 修改 cliff.toml

编辑 `.github/cliff.toml` 文件：

```toml
[remote.github]
owner = "YOUR_GITHUB_USERNAME"  # 改为你的 GitHub 用户名或组织名
repo = "notion-clipper"
```

### 2. 修改 Issue 模板配置

编辑 `.github/ISSUE_TEMPLATE/config.yml`，将 `YOUR_USERNAME` 替换为你的 GitHub 用户名。

### 3. 配置 GitHub 仓库权限

**必须配置**，否则 Actions 无法创建 Release：

1. 打开 GitHub 仓库页面
2. 进入 **Settings** > **Actions** > **General**
3. 滚动到 **Workflow permissions** 部分
4. 选择 **"Read and write permissions"**
5. 勾选 **"Allow GitHub Actions to create and approve pull requests"**
6. 点击 **Save** 保存

## 发布流程

### 完整发布流程示例

```bash
# 1. 开发新功能并提交（使用约定式提交）
git add .
git commit -m "feat: 添加自动保存功能"
git commit -m "fix: 修复图片上传失败问题"
git commit -m "docs: 更新使用文档"

# 2. 推送到远程
git push origin main

# 3. 创建发布版本
git tag v1.0.0
git push origin v1.0.0

# 4. 等待 GitHub Actions 自动构建和发布
# 访问以下链接查看进度和结果：
# - Actions 执行情况: https://github.com/YOUR_USERNAME/notion-clipper/actions
# - 发布的 Release: https://github.com/YOUR_USERNAME/notion-clipper/releases
```

### 发布预发布版本

```bash
# 创建 alpha 版本
git tag v1.0.0-alpha.1
git push origin v1.0.0-alpha.1

# 创建 beta 版本
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1

# 创建 rc 版本
git tag v1.0.0-rc.1
git push origin v1.0.0-rc.1
```

这些版本会在 GitHub Releases 中标记为 "Pre-release"。

### 手动触发发布

也可以通过 GitHub 网页手动触发工作流：

1. 访问 Actions 页面
2. 选择 "Build and Release" 工作流
3. 点击 "Run workflow"
4. 选择分支并运行

## 本地测试

### 测试构建

在推送 tag 前，建议先在本地测试构建：

```bash
# 安装依赖
npm install

# 运行 lint 检查
npm run lint

# 执行构建
npm run build

# 检查构建产物
ls -la dist/
```

### 测试 Changelog 生成

如果想在本地测试 changelog 生成，可以安装 git-cliff：

#### 安装 git-cliff

**macOS**:

```bash
brew install git-cliff
```

**Linux**:

```bash
# 从 GitHub Releases 下载
wget https://github.com/orhun/git-cliff/releases/latest/download/git-cliff-linux-x86_64.tar.gz
tar -xzf git-cliff-linux-x86_64.tar.gz
sudo mv git-cliff /usr/local/bin/
```

**Windows**:
从 [git-cliff releases](https://github.com/orhun/git-cliff/releases) 下载对应的二进制文件。

#### 生成 Changelog

```bash
# 生成完整 changelog
git cliff --config .github/cliff.toml --output CHANGELOG.md

# 只查看最新版本的 changelog
git cliff --config .github/cliff.toml --latest --strip header

# 从特定 tag 生成 changelog
git cliff --config .github/cliff.toml v1.0.0..HEAD
```

## 故障排查

### 构建失败

**症状**：GitHub Actions 构建失败

**排查步骤**：

1. **查看 Actions 日志**
   - 访问 `https://github.com/YOUR_USERNAME/notion-clipper/actions`
   - 点击失败的 workflow
   - 查看红色的步骤，展开查看详细错误信息

2. **常见问题**
   - **依赖安装失败**：检查 `package.json` 中的依赖版本，确保没有不兼容的版本
   - **构建失败**：本地运行 `npm run build` 测试，确保本地可以正常构建
   - **TypeScript 错误**：运行 `npm run lint` 检查代码问题
   - **权限问题**：检查仓库 Actions 权限设置（见"首次使用配置"）

3. **本地复现**

   ```bash
   # 清理并重新安装依赖
   rm -rf node_modules package-lock.json
   npm install

   # 尝试构建
   npm run build
   ```

### Changelog 生成失败

**症状**：Release 中没有 changelog 或 changelog 为空

**可能原因**：

1. **Commit message 不符合约定式提交规范**
   - 确保使用 `feat:`, `fix:` 等前缀
   - 检查 commit message 格式是否正确

2. **cliff.toml 配置错误**
   - 确认 `owner` 和 `repo` 配置正确
   - 检查配置文件语法

3. **commit 历史不足**
   - 确保有足够的 commit 记录
   - 检查是否有符合规范的 commit

**解决方法**：

```bash
# 查看最近的 commit
git log --oneline -10

# 手动测试 changelog 生成
git cliff --config .github/cliff.toml --latest

# 如果本地测试成功但 Actions 失败，检查 Actions 日志中的详细错误
```

### Release 创建失败

**症状**：构建成功但没有创建 Release

**可能原因**：

1. **权限不足**
   - 检查 Workflow permissions 是否设置为 "Read and write permissions"
   - 确保 Actions 有权限创建 Release

2. **Tag 格式不正确**
   - 确保 tag 以 `v` 开头（如 `v1.0.0`）
   - 不要使用无效字符

3. **同名 tag 或 Release 已存在**
   - 检查是否已有相同的 tag
   - 删除重复的 tag：`git tag -d v1.0.0 && git push origin :refs/tags/v1.0.0`

**解决方法**：

```bash
# 检查现有 tags
git tag -l

# 检查远程 tags
git ls-remote --tags origin

# 删除本地和远程的 tag（如果需要重新发布）
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# 重新创建 tag
git tag v1.0.0
git push origin v1.0.0
```

### Actions 没有触发

**症状**：推送 tag 后 Actions 没有运行

**可能原因**：

1. **Actions 被禁用**
   - 检查仓库设置中 Actions 是否启用

2. **工作流文件有语法错误**
   - 检查 YAML 文件的缩进和语法

3. **分支保护规则**
   - 检查是否有分支保护规则阻止了 Actions

**解决方法**：

1. 检查 Actions 是否启用：Settings > Actions > General
2. 验证 YAML 语法：使用在线 YAML 验证器
3. 查看 Actions 页面是否有错误提示

## 高级用法

### 自定义构建流程

如果需要修改构建流程，编辑 `.github/workflows/release.yml`：

```yaml
- name: Build extension
  run: |
    npm run build
    # 添加自定义构建步骤
    # 例如：压缩图片、优化资源等
```

### 添加构建通知

可以添加构建完成的通知，例如发送到 Slack、Discord 等：

```yaml
- name: Notify on success
  if: success()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: "Release ${{ needs.meta.outputs.tag }} has been published!"
```

### 多平台构建

如果需要为不同浏览器构建不同版本，可以使用 matrix 策略：

```yaml
strategy:
  matrix:
    browser: [chrome, firefox, edge]
steps:
  - name: Build for ${{ matrix.browser }}
    run: npm run build:${{ matrix.browser }}
```

## 最佳实践

### Commit 提交建议

1. **保持 commit 原子性**：每个 commit 只做一件事
2. **使用清晰的描述**：让别人（和未来的自己）能理解做了什么
3. **遵循约定式提交**：这样才能自动生成有意义的 changelog
4. **及时提交**：不要积累太多改动在一个 commit 中

### 版本号规范

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **主版本号(Major)**：不兼容的 API 修改
- **次版本号(Minor)**：向下兼容的功能新增
- **修订号(Patch)**：向下兼容的问题修正

示例：

- `v1.0.0` → `v1.0.1`: 修复 bug
- `v1.0.0` → `v1.1.0`: 添加新功能
- `v1.0.0` → `v2.0.0`: 重大变更，不兼容旧版本

### 发布前检查清单

- [ ] 代码已在本地测试通过
- [ ] 所有 commit 使用约定式提交格式
- [ ] 更新了相关文档
- [ ] 版本号符合语义化版本规范
- [ ] 确认没有敏感信息（API 密钥、密码等）
- [ ] 本地运行 `npm run build` 成功
- [ ] 运行 `npm run lint` 无错误

## 参考资源

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [git-cliff 文档](https://git-cliff.org/)
- [约定式提交规范](https://www.conventionalcommits.org/zh-hans/)
- [语义化版本](https://semver.org/lang/zh-CN/)
- [GitHub Releases 指南](https://docs.github.com/en/repositories/releasing-projects-on-github)

## 更新日志

如需查看项目的更新历史，请访问 [GitHub Releases](https://github.com/YOUR_USERNAME/notion-clipper/releases) 页面。

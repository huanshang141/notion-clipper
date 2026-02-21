# CI/CD Configuration Guide

This document provides detailed information about the CI/CD configuration and usage for the Notion Clipper project.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Conventional Commits](#conventional-commits)
- [Configuration Files](#configuration-files)
- [Initial Setup](#initial-setup)
- [Release Process](#release-process)
- [Local Testing](#local-testing)
- [Troubleshooting](#troubleshooting)

## Features

### 1. Automated Build and Release (release.yml)

When you push a tag (format: `v*`, e.g., `v1.0.0`), the following workflow is automatically triggered:

- **Build Extension**: Build production version using webpack
- **Generate Changelog**: Automatically generate changelog based on git commit messages using git-cliff
- **Create Release**: Package build artifacts into a zip file and publish to GitHub Releases

#### Version Conventions

- **Stable Releases**: `v1.0.0`, `v1.2.3` - Creates a stable Release
- **Pre-releases**: Contains `alpha`, `beta`, `rc`, `dev` keywords - Marked as Pre-release
  - Examples: `v1.0.0-alpha.1`, `v1.0.0-beta.2`, `v1.0.0-rc.1`

### 2. Continuous Integration (ci.yml)

When pushing code to `main` or `dev` branches, or creating a Pull Request, automatically:

- Install dependencies
- Run code checks (lint)
- Execute build tests
- Verify build artifacts

### 3. Automatic Changelog Generation

Uses [git-cliff](https://github.com/orhun/git-cliff) to automatically generate changelogs based on Conventional Commits.

### 4. Issue Templates

Provides comprehensive Issue templates, including:

**Chinese Templates**:

- Bug Report
- Feature Request
- Other Issues

**English Templates**:

- Bug Report
- Feature Request
- Other Issues

## Quick Start

### Basic Release Process

```bash
# 1. Develop and commit code
git add .
git commit -m "feat: add new feature"

# 2. Push to remote
git push origin main

# 3. Create and push tag
git tag v1.0.0
git push origin v1.0.0

# 4. Automatic build and release triggered
# View progress and results at:
# - Actions: https://github.com/YOUR_USERNAME/notion-clipper/actions
# - Releases: https://github.com/YOUR_USERNAME/notion-clipper/releases
```

## Conventional Commits

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type Categories

- `feat`: ✨ New features
- `fix`: 🐛 Bug fixes
- `docs`: 📚 Documentation
- `perf`: 🚀 Performance improvements
- `refactor`: 🚜 Code refactoring
- `style`: 🎨 Styling
- `test`: 🧪 Testing
- `chore`: 🔧 Maintenance
- `ci`: ⚙️ CI/CD

### Commit Examples

```bash
# New features
git commit -m "feat: add dark theme support"
git commit -m "feat(editor): support Markdown syntax highlighting"

# Bug fixes
git commit -m "fix: resolve network error during save"
git commit -m "fix(auth): resolve login state loss issue"

# Documentation updates
git commit -m "docs: update installation guide"

# Performance improvements
git commit -m "perf: optimize image upload speed"

# Code refactoring
git commit -m "refactor: refactor authentication module"

# Style adjustments
git commit -m "style: unify code formatting"

# Breaking changes
git commit -m "feat!: refactor API interface

BREAKING CHANGE: API interface has been completely refactored and is no longer compatible with old versions"
```

### Scope Examples

Common scopes include:

- `auth`: Authentication related
- `editor`: Editor related
- `popup`: Popup window
- `options`: Settings page
- `content`: Content script
- `background`: Background script
- `api`: API related
- `ui`: User interface

## Configuration Files

### .github/workflows/release.yml

Release workflow with four main jobs:

1. **meta**: Parse version information and tag
   - Identify if it's a stable release
   - Determine if it's a pre-release
   - Set version number

2. **build**: Build extension and package
   - Install dependencies
   - Execute production build
   - Package into zip file

3. **changelog**: Generate changelog
   - Use git-cliff to analyze commit history
   - Generate formatted changelog

4. **release**: Create GitHub Release
   - Upload build artifacts
   - Add changelog as Release notes
   - Mark as pre-release if applicable

### .github/workflows/ci.yml

Continuous integration workflow for:

- Code quality checks
- Build testing
- Ensuring code builds successfully

### .github/cliff.toml

git-cliff configuration file defining:

- Changelog format and style
- Commit type grouping and sorting
- Contributor information display

**Important**: You need to modify repository information in the config:

```toml
[remote.github]
owner = "YOUR_GITHUB_USERNAME"  # Replace with your GitHub username
repo = "notion-clipper"
```

### .github/ISSUE_TEMPLATE/

Issue template directory containing:

**Chinese Templates**:

- `cn-bug-report.yaml`: Bug Report
- `cn-feature-request.yaml`: Feature Request
- `cn-others.yaml`: Other Issues

**English Templates**:

- `en-bug-report.yaml`: Bug Report
- `en-feature-request.yaml`: Feature Request
- `en-others.yaml`: Other Issues

**Configuration File**:

- `config.yml`: Issue template configuration controlling Issue creation page behavior

## Initial Setup

### 1. Modify cliff.toml

Edit `.github/cliff.toml` file:

```toml
[remote.github]
owner = "YOUR_GITHUB_USERNAME"  # Change to your GitHub username or organization
repo = "notion-clipper"
```

### 2. Modify Issue Template Configuration

Edit `.github/ISSUE_TEMPLATE/config.yml`, replace `YOUR_USERNAME` with your GitHub username.

### 3. Configure GitHub Repository Permissions

**Required configuration**, otherwise Actions cannot create Releases:

1. Open GitHub repository page
2. Go to **Settings** > **Actions** > **General**
3. Scroll to **Workflow permissions** section
4. Select **"Read and write permissions"**
5. Check **"Allow GitHub Actions to create and approve pull requests"**
6. Click **Save**

## Release Process

### Complete Release Process Example

```bash
# 1. Develop new features and commit (using Conventional Commits)
git add .
git commit -m "feat: add auto-save feature"
git commit -m "fix: resolve image upload failure"
git commit -m "docs: update usage documentation"

# 2. Push to remote
git push origin main

# 3. Create release version
git tag v1.0.0
git push origin v1.0.0

# 4. Wait for GitHub Actions to automatically build and release
# Visit the following links to view progress and results:
# - Actions execution: https://github.com/YOUR_USERNAME/notion-clipper/actions
# - Published Release: https://github.com/YOUR_USERNAME/notion-clipper/releases
```

### Release Pre-release Versions

```bash
# Create alpha version
git tag v1.0.0-alpha.1
git push origin v1.0.0-alpha.1

# Create beta version
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1

# Create rc version
git tag v1.0.0-rc.1
git push origin v1.0.0-rc.1
```

These versions will be marked as "Pre-release" in GitHub Releases.

### Manual Workflow Trigger

You can also manually trigger the workflow via GitHub web interface:

1. Visit Actions page
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Select branch and run

## Local Testing

### Test Build

Before pushing tags, it's recommended to test the build locally:

```bash
# Install dependencies
npm install

# Run lint checks
npm run lint

# Execute build
npm run build

# Check build artifacts
ls -la dist/
```

### Test Changelog Generation

To test changelog generation locally, install git-cliff:

#### Install git-cliff

**macOS**:

```bash
brew install git-cliff
```

**Linux**:

```bash
# Download from GitHub Releases
wget https://github.com/orhun/git-cliff/releases/latest/download/git-cliff-linux-x86_64.tar.gz
tar -xzf git-cliff-linux-x86_64.tar.gz
sudo mv git-cliff /usr/local/bin/
```

**Windows**:
Download the corresponding binary from [git-cliff releases](https://github.com/orhun/git-cliff/releases).

#### Generate Changelog

```bash
# Generate complete changelog
git cliff --config .github/cliff.toml --output CHANGELOG.md

# View only the latest version's changelog
git cliff --config .github/cliff.toml --latest --strip header

# Generate changelog from specific tag
git cliff --config .github/cliff.toml v1.0.0..HEAD
```

## Troubleshooting

### Build Failure

**Symptoms**: GitHub Actions build fails

**Troubleshooting Steps**:

1. **Check Actions Logs**
   - Visit `https://github.com/YOUR_USERNAME/notion-clipper/actions`
   - Click the failed workflow
   - View the red steps and expand for detailed error messages

2. **Common Issues**
   - **Dependency installation failure**: Check dependency versions in `package.json` for incompatibilities
   - **Build failure**: Run `npm run build` locally to ensure it builds successfully
   - **TypeScript errors**: Run `npm run lint` to check code issues
   - **Permission issues**: Check repository Actions permission settings (see "Initial Setup")

3. **Local Reproduction**

   ```bash
   # Clean and reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install

   # Try building
   npm run build
   ```

### Changelog Generation Failure

**Symptoms**: Release has no changelog or empty changelog

**Possible Causes**:

1. **Commit messages don't follow Conventional Commits**
   - Ensure using prefixes like `feat:`, `fix:`
   - Check commit message format

2. **cliff.toml configuration error**
   - Confirm `owner` and `repo` are configured correctly
   - Check configuration file syntax

3. **Insufficient commit history**
   - Ensure there are enough commit records
   - Check if there are commits following the convention

**Solutions**:

```bash
# View recent commits
git log --oneline -10

# Manually test changelog generation
git cliff --config .github/cliff.toml --latest

# If local test succeeds but Actions fails, check detailed errors in Actions logs
```

### Release Creation Failure

**Symptoms**: Build succeeds but no Release created

**Possible Causes**:

1. **Insufficient permissions**
   - Check if Workflow permissions are set to "Read and write permissions"
   - Ensure Actions has permission to create Releases

2. **Incorrect tag format**
   - Ensure tag starts with `v` (e.g., `v1.0.0`)
   - Don't use invalid characters

3. **Duplicate tag or Release exists**
   - Check if the same tag already exists
   - Delete duplicate tag: `git tag -d v1.0.0 && git push origin :refs/tags/v1.0.0`

**Solutions**:

```bash
# Check existing tags
git tag -l

# Check remote tags
git ls-remote --tags origin

# Delete local and remote tag (if need to re-release)
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Recreate tag
git tag v1.0.0
git push origin v1.0.0
```

### Actions Not Triggered

**Symptoms**: Actions doesn't run after pushing tag

**Possible Causes**:

1. **Actions disabled**
   - Check if Actions is enabled in repository settings

2. **Workflow file has syntax errors**
   - Check YAML file indentation and syntax

3. **Branch protection rules**
   - Check if branch protection rules block Actions

**Solutions**:

1. Check if Actions is enabled: Settings > Actions > General
2. Validate YAML syntax: Use an online YAML validator
3. Check Actions page for error messages

## Advanced Usage

### Customize Build Process

To modify the build process, edit `.github/workflows/release.yml`:

```yaml
- name: Build extension
  run: |
    npm run build
    # Add custom build steps
    # e.g., compress images, optimize resources, etc.
```

### Add Build Notifications

You can add build completion notifications, such as sending to Slack, Discord, etc.:

```yaml
- name: Notify on success
  if: success()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: "Release ${{ needs.meta.outputs.tag }} has been published!"
```

### Multi-platform Build

If you need to build different versions for different browsers, use matrix strategy:

```yaml
strategy:
  matrix:
    browser: [chrome, firefox, edge]
steps:
  - name: Build for ${{ matrix.browser }}
    run: npm run build:${{ matrix.browser }}
```

## Best Practices

### Commit Guidelines

1. **Keep commits atomic**: Each commit should do one thing
2. **Use clear descriptions**: Let others (and your future self) understand what was done
3. **Follow Conventional Commits**: This enables automatic generation of meaningful changelogs
4. **Commit timely**: Don't accumulate too many changes in one commit

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **Major**: Incompatible API changes
- **Minor**: Backward-compatible new features
- **Patch**: Backward-compatible bug fixes

Examples:

- `v1.0.0` → `v1.0.1`: Bug fix
- `v1.0.0` → `v1.1.0`: Add new feature
- `v1.0.0` → `v2.0.0`: Breaking changes, incompatible with old versions

### Pre-release Checklist

- [ ] Code tested locally and passes
- [ ] All commits use Conventional Commits format
- [ ] Related documentation updated
- [ ] Version number follows semantic versioning
- [ ] Confirm no sensitive information (API keys, passwords, etc.)
- [ ] Local `npm run build` succeeds
- [ ] Run `npm run lint` without errors

## Reference Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [git-cliff Documentation](https://git-cliff.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Releases Guide](https://docs.github.com/en/repositories/releasing-projects-on-github)

## Changelog

To view the project's update history, visit the [GitHub Releases](https://github.com/YOUR_USERNAME/notion-clipper/releases) page.

# Releasing HOSEA

This document describes how to release new versions of the HOSEA desktop application.

## Prerequisites

1. **Node.js 18+** installed
2. **Clean git state** - no uncommitted changes
3. For distribution builds:
   - **macOS**: Xcode Command Line Tools
   - **Windows**: Visual Studio Build Tools
   - **Linux**: Required build packages

## Release Process

### 1. Update CHANGELOG.md

Before releasing, document changes in `CHANGELOG.md`:

```markdown
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Added
- New feature description

### Changed
- Modified behavior description

### Fixed
- Bug fix description
```

### 2. Choose Version Type

Follow [Semantic Versioning](https://semver.org/):

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fixes, patches | `patch` | 0.1.0 → 0.1.1 |
| New features (backward compatible) | `minor` | 0.1.0 → 0.2.0 |
| Breaking changes | `major` | 0.1.0 → 1.0.0 |

### 3. Run Release Script

```bash
# From apps/hosea directory

# Patch release (bug fixes)
npm run release:patch

# Minor release (new features)
npm run release:minor

# Major release (breaking changes)
npm run release:major
```

This will:
- Build the application
- Run typecheck
- Bump version in `package.json`
- Create git commit with message "hosea: Release vX.Y.Z"
- Create git tag `hosea-vX.Y.Z`
- Push commit and tag to GitHub

### 4. Build Distribution Packages

After versioning, build the distributable packages:

```bash
# Build for current platform
npm run package

# Output will be in release/ directory
```

**Platform-specific builds:**
- **macOS**: `release/HOSEA-X.Y.Z.dmg`
- **Windows**: `release/HOSEA Setup X.Y.Z.exe`
- **Linux**: `release/HOSEA-X.Y.Z.AppImage`

### 5. Create GitHub Release

1. Go to https://github.com/Integrail/oneringai/releases
2. Click "Draft a new release"
3. Select tag `hosea-vX.Y.Z`
4. Title: "HOSEA vX.Y.Z"
5. Copy changelog entries to description
6. Upload built packages (dmg, exe, AppImage)
7. Publish release

## Quick Reference

```bash
# Full release flow (example: patch)
cd apps/hosea

# 1. Edit CHANGELOG.md
# 2. Run:
npm run release:patch

# 3. Build packages
npm run package

# 4. Create GitHub release and upload packages
```

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Core library | `file:../..` (local) | `file:../..` (local) |
| Build command | `npm run dev` | `npm run build && npm run package` |
| Output | Hot-reload dev server | `release/*.dmg/exe/AppImage` |

**Note:** HOSEA always uses the local `@everworker/oneringai` library, not the npm-published version.

## App Info

| Field | Value |
|-------|-------|
| **Package** | `@everworker/hosea` |
| **App ID** | `ai.everworker.hosea` |
| **Product Name** | HOSEA |
| **GitHub** | https://github.com/Integrail/oneringai/tree/main/apps/hosea |

## Troubleshooting

### Build fails on macOS

Ensure Xcode Command Line Tools are installed:
```bash
xcode-select --install
```

### Build fails on Windows

Install Visual Studio Build Tools with "Desktop development with C++" workload.

### electron-builder signing issues

For unsigned builds (development), this is normal. For production:
- macOS: Requires Apple Developer certificate
- Windows: Requires code signing certificate

## Tag Naming Convention

HOSEA uses prefixed tags to distinguish from core library releases:

- Core library: `v0.1.0`, `v0.2.0`, etc.
- HOSEA: `hosea-v0.1.0`, `hosea-v0.2.0`, etc.

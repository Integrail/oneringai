# Package Hosea App for Mac and Windows Distribution

## Overview

Package the Hosea Electron app so users can install it via native installers on macOS (.dmg) and Windows (.exe).

**Current State:** electron-builder is already configured in `package.json`. The main gap is missing icon assets.

---

## What's Already in Place

| Component | Status | Details |
|-----------|--------|---------|
| electron-builder | Installed | v24.9.1 in devDependencies |
| Build scripts | Configured | `npm run build` and `npm run package` |
| App metadata | Set | appId: `ai.onering.hosea`, productName: `HOSEA` |
| Mac target | Configured | DMG format |
| Windows target | Configured | NSIS installer |
| Linux target | Configured | AppImage format |
| Icon files | Missing | `assets/icon.icns`, `icon.ico`, `icon.png` |

---

## Implementation Plan

### Phase 1: Create Icon Assets

**Create directory and icon files:**

```
apps/hosea/assets/
├── icon.icns     # macOS (1024x1024, Apple icon format)
├── icon.ico      # Windows (multi-resolution: 16, 32, 48, 64, 128, 256)
├── icon.png      # Linux/generic (512x512 or 1024x1024)
└── icon.svg      # Source file (optional, for regeneration)
```

**Option A: Use existing SVG logos**
- Source: `apps/hosea/hosea-full.svg` or `apps/hosea/hosea-short.svg`
- Convert to required formats using tools like:
  - macOS: `iconutil` or online converters
  - Windows: ImageMagick or online converters
  - PNG: Any image editor

**Option B: Create new icon**
- Design a square icon (1024x1024 PNG master)
- Export to all required formats

### Phase 2: Verify/Update package.json Build Config

**File:** `apps/hosea/package.json`

The existing config (lines 55-77) is mostly correct. Verify these settings:

```json
{
  "build": {
    "appId": "ai.onering.hosea",
    "productName": "HOSEA",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "package.json"
    ],
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns",
      "category": "public.app-category.developer-tools"
    },
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png",
      "category": "Development"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico"
    },
    "dmg": {
      "contents": [
        { "x": 130, "y": 220 },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ]
    }
  }
}
```

**Additions to consider:**
- `mac.category` - App Store category
- `nsis` block - Windows installer customization (allow custom install path)
- `dmg.contents` - DMG window layout with Applications shortcut

### Phase 3: Build and Package

**Commands:**

```bash
cd apps/hosea

# 1. Build the app (TypeScript + React)
npm run build

# 2. Package for current platform
npm run package

# 3. Package for specific platform (cross-compile)
# Note: Building for macOS requires macOS, Windows NSIS can be built on any platform
npx electron-builder --mac    # macOS DMG
npx electron-builder --win    # Windows NSIS
npx electron-builder --linux  # Linux AppImage
```

**Output location:** `apps/hosea/release/`
- `HOSEA-0.1.0.dmg` (macOS)
- `HOSEA Setup 0.1.0.exe` (Windows)
- `HOSEA-0.1.0.AppImage` (Linux)

---

## File Changes Summary

| File | Action |
|------|--------|
| `apps/hosea/assets/icon.icns` | **New** - macOS icon |
| `apps/hosea/assets/icon.ico` | **New** - Windows icon |
| `apps/hosea/assets/icon.png` | **New** - Linux/generic icon |
| `apps/hosea/package.json` | Update build config (add nsis, dmg options) |

---

## Optional: Code Signing (for Production)

### macOS Signing & Notarization

For distribution outside the Mac App Store, Apple requires notarization:

1. **Get Apple Developer Certificate** ($99/year Apple Developer Program)
2. **Add to package.json:**
```json
{
  "build": {
    "mac": {
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "afterSign": "scripts/notarize.js"
  }
}
```
3. **Create notarize script** using `@electron/notarize`

### Windows Signing

Optional but recommended to avoid "Unknown publisher" warnings:

1. **Get code signing certificate** (from DigiCert, Sectigo, etc.)
2. **Add to package.json:**
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "env:WIN_CSC_KEY_PASSWORD"
    }
  }
}
```

---

## Verification

1. **Build test:**
   ```bash
   cd apps/hosea
   npm run build
   npm run package
   ```

2. **Check output:**
   - Verify `release/` directory contains installer files
   - Check file sizes are reasonable (50-150MB typical for Electron apps)

3. **macOS test:**
   - Mount the `.dmg` file
   - Drag HOSEA to Applications
   - Launch from Applications folder
   - Verify app opens and works correctly

4. **Windows test:**
   - Run the `.exe` installer
   - Choose installation directory
   - Complete installation
   - Launch from Start Menu or Desktop shortcut
   - Verify app opens and works correctly

5. **Functional test:**
   - Configure a connector
   - Test chat functionality
   - Test multimedia features

---

## Cross-Platform Build Notes

| Building on | Can produce |
|-------------|-------------|
| macOS | macOS (.dmg), Windows (.exe), Linux (.AppImage) |
| Windows | Windows (.exe), Linux (.AppImage) |
| Linux | Windows (.exe), Linux (.AppImage) |

**Note:** macOS DMG can only be built on macOS due to Apple tooling requirements.

For CI/CD, consider using GitHub Actions with matrix builds:
- `macos-latest` runner for DMG
- `windows-latest` runner for NSIS
- `ubuntu-latest` runner for AppImage

---

## Auto-Update Functionality

Enable in-app updates so users can update without re-downloading manually.

### How It Works

```
User launches app
       ↓
App checks update server (GitHub Releases / S3 / custom)
       ↓
If new version available → Show notification in UI
       ↓
User clicks "Update" → Download in background
       ↓
Download complete → Prompt to restart
       ↓
App quits and installs update → Relaunches
```

### Phase 4: Install electron-updater

```bash
cd apps/hosea
npm install electron-updater
```

This is the official auto-update module from electron-builder.

### Phase 5: Configure Update Source

**Option A: GitHub Releases (Recommended for open-source)**

Add to `apps/hosea/package.json`:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "oneringai",
      "repo": "hosea"
    }
  }
}
```

**Option B: S3/Generic Server**

```json
{
  "build": {
    "publish": {
      "provider": "s3",
      "bucket": "hosea-updates",
      "region": "us-east-1"
    }
  }
}
```

**Option C: Custom Server**

```json
{
  "build": {
    "publish": {
      "provider": "generic",
      "url": "https://updates.onering.ai/hosea"
    }
  }
}
```

### Phase 6: Main Process - AutoUpdater Service

**File:** `apps/hosea/src/main/AutoUpdaterService.ts` (New)

```typescript
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

export class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    // Configure logging
    autoUpdater.logger = console;

    // Don't auto-download - let user decide
    autoUpdater.autoDownload = false;

    // Allow pre-release updates (optional)
    autoUpdater.allowPrerelease = false;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  initialize(): void {
    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      this.sendStatus('checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.sendStatus('available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.sendStatus('not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
      this.sendStatus('downloading', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.sendStatus('downloaded', {
        version: info.version,
      });
    });

    autoUpdater.on('error', (error) => {
      this.sendStatus('error', { message: error.message });
    });

    // IPC handlers
    ipcMain.handle('updater:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result?.updateInfo };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('updater:download', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('updater:install', () => {
      // Quit and install (will restart the app)
      autoUpdater.quitAndInstall(false, true);
    });

    ipcMain.handle('updater:get-version', () => {
      return app.getVersion();
    });
  }

  // Check for updates on app start (after delay)
  checkOnStartup(delayMs = 5000): void {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(console.error);
    }, delayMs);
  }

  private sendStatus(status: string, data?: Record<string, unknown>): void {
    this.mainWindow?.webContents.send('updater:status', { status, ...data });
  }
}
```

### Phase 7: Update main/index.ts

**File:** `apps/hosea/src/main/index.ts`

Add to imports and initialization:

```typescript
import { AutoUpdaterService } from './AutoUpdaterService.js';

let autoUpdaterService: AutoUpdaterService | null = null;

// In setupIPC():
autoUpdaterService = new AutoUpdaterService();
autoUpdaterService.initialize();

// After createWindow():
if (mainWindow) {
  autoUpdaterService?.setMainWindow(mainWindow);
  // Check for updates 5 seconds after launch
  autoUpdaterService?.checkOnStartup(5000);
}
```

### Phase 8: Preload Bridge

**File:** `apps/hosea/src/preload/index.ts`

Add to HoseaAPI interface:

```typescript
updater: {
  check: () => Promise<{ success: boolean; updateInfo?: UpdateInfo; error?: string }>;
  download: () => Promise<{ success: boolean; error?: string }>;
  install: () => void;
  getVersion: () => Promise<string>;
  onStatus: (callback: (status: UpdateStatus) => void) => void;
  removeStatusListener: () => void;
};
```

Add to api object:

```typescript
updater: {
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  install: () => ipcRenderer.invoke('updater:install'),
  getVersion: () => ipcRenderer.invoke('updater:get-version'),
  onStatus: (callback) => {
    ipcRenderer.removeAllListeners('updater:status');
    ipcRenderer.on('updater:status', (_event, status) => callback(status));
  },
  removeStatusListener: () => {
    ipcRenderer.removeAllListeners('updater:status');
  },
},
```

### Phase 9: UI Component - UpdateNotification

**File:** `apps/hosea/src/renderer/components/UpdateNotification.tsx` (New)

```tsx
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

type UpdateStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string };

export function UpdateNotification(): React.ReactElement | null {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.hosea.updater.onStatus(setUpdateStatus);
    return () => window.hosea.updater.removeStatusListener();
  }, []);

  if (dismissed || !updateStatus) return null;
  if (updateStatus.status === 'not-available') return null;
  if (updateStatus.status === 'checking') return null;

  return (
    <div className="update-notification">
      {updateStatus.status === 'available' && (
        <>
          <Download size={16} />
          <span>Version {updateStatus.version} available</span>
          <button onClick={() => window.hosea.updater.download()}>
            Download
          </button>
          <button onClick={() => setDismissed(true)}>Later</button>
        </>
      )}

      {updateStatus.status === 'downloading' && (
        <>
          <RefreshCw size={16} className="spinning" />
          <span>Downloading... {Math.round(updateStatus.percent)}%</span>
        </>
      )}

      {updateStatus.status === 'downloaded' && (
        <>
          <CheckCircle size={16} />
          <span>Update ready</span>
          <button onClick={() => window.hosea.updater.install()}>
            Restart Now
          </button>
          <button onClick={() => setDismissed(true)}>Later</button>
        </>
      )}

      {updateStatus.status === 'error' && (
        <>
          <AlertTriangle size={16} />
          <span>Update failed: {updateStatus.message}</span>
          <button onClick={() => setDismissed(true)}>Dismiss</button>
        </>
      )}
    </div>
  );
}
```

### Phase 10: Publishing Updates

When releasing a new version:

1. **Update version** in `package.json`:
   ```json
   { "version": "0.2.0" }
   ```

2. **Build and publish**:
   ```bash
   npm run build
   npx electron-builder --publish always
   ```

   This uploads to the configured publish target (GitHub Releases, S3, etc.)

3. **For GitHub Releases**, this creates:
   - `HOSEA-0.2.0.dmg`
   - `HOSEA Setup 0.2.0.exe`
   - `latest.yml` (macOS)
   - `latest-mac.yml`
   - `latest-linux.yml`

The `latest*.yml` files tell electron-updater where to find the latest version.

---

## Auto-Update File Changes Summary

| File | Action |
|------|--------|
| `apps/hosea/package.json` | Add `publish` config, add electron-updater dependency |
| `apps/hosea/src/main/AutoUpdaterService.ts` | **New** - Auto-update logic |
| `apps/hosea/src/main/index.ts` | Import and initialize AutoUpdaterService |
| `apps/hosea/src/preload/index.ts` | Add updater IPC bridge |
| `apps/hosea/src/renderer/components/UpdateNotification.tsx` | **New** - UI component |
| `apps/hosea/src/renderer/App.tsx` | Include UpdateNotification component |

---

## Auto-Update Verification

1. **Local testing** (without actual server):
   ```bash
   # Build version 0.1.0, install it
   # Change package.json to 0.2.0
   # Build again
   # Manually place latest.yml and installer in a local server
   # Configure generic provider pointing to localhost
   # Launch old version - should detect update
   ```

2. **GitHub Releases testing**:
   - Create a GitHub Release with v0.1.0
   - Install the app
   - Create another release with v0.2.0
   - App should detect and offer update

3. **Verify update flow**:
   - Update notification appears
   - Download progress shows
   - "Restart Now" button works
   - App restarts with new version

import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseDate?: string;
  releaseNotes?: string | null;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  message?: string;
}

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
      this.sendStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.sendStatus({
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.sendStatus({ status: 'not-available' });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.sendStatus({
        status: 'downloading',
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.sendStatus({
        status: 'downloaded',
        version: info.version,
      });
    });

    autoUpdater.on('error', (error) => {
      this.sendStatus({ status: 'error', message: error.message });
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
      autoUpdater.checkForUpdates().catch((err) => {
        console.log('Auto-update check failed:', err.message);
      });
    }, delayMs);
  }

  private sendStatus(status: UpdateStatus): void {
    this.mainWindow?.webContents.send('updater:status', status);
  }
}

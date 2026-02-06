/**
 * HOSEA - Human-Oriented System for Engaging Agents
 *
 * Electron main process - handles window management and IPC with the agent.
 */

import { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { AgentService } from './AgentService.js';
import { BrowserService } from './BrowserService.js';
import { AutoUpdaterService } from './AutoUpdaterService.js';
import type { Rectangle } from './browser/types.js';

/**
 * Get the data directory for HOSEA
 * - macOS/Linux: ~/.everworker/hosea
 * - Windows: %USERPROFILE%\.everworker\hosea (e.g., C:\Users\name\.everworker\hosea)
 */
function getDataDir(): string {
  const home = homedir();
  return join(home, '.everworker', 'hosea');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine if in development mode
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let agentService: AgentService | null = null;
let browserService: BrowserService | null = null;
let autoUpdaterService: AutoUpdaterService | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'HOSEA',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.cjs'),
    },
    // macOS specific
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Wrap an async IPC handler with error protection
 */
function safeHandler<T>(
  handler: (...args: unknown[]) => Promise<T>,
  defaultValue: T
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('[HOSEA] IPC handler error:', error);
      return defaultValue;
    }
  };
}

async function setupIPC(): Promise<void> {
  // Initialize agent service with proper data directory
  const dataDir = getDataDir();
  console.log('HOSEA data directory:', dataDir);
  agentService = await AgentService.create(dataDir, isDev);

  // Initialize browser service (pass null window for now, set later when window is created)
  browserService = new BrowserService(null);

  // Connect AgentService to BrowserService for tool registration
  agentService.setBrowserService(browserService);

  // Set up stream emitter for HoseaUIPlugin to emit Dynamic UI content
  // This is called when browser tools execute and need to show the browser view
  agentService.setStreamEmitter((instanceId, chunk) => {
    mainWindow?.webContents.send('agent:stream-chunk', instanceId, chunk);
  });

  // ============ Proactive Overlay Detection ============
  // When the browser detects a popup/modal/overlay, proactively notify the agent
  // so it can decide how to handle it (dismiss, interact, etc.)
  browserService.on('browser:overlay-detected', (instanceId: string, overlayData: unknown) => {
    console.log(`[HOSEA] Overlay detected for ${instanceId}:`, overlayData);

    // Send as a special stream chunk that the agent will see
    mainWindow?.webContents.send('agent:stream-chunk', instanceId, {
      type: 'overlay_detected',
      overlay: overlayData,
      hint: 'An overlay/popup appeared on the page. You can use browser_dismiss_overlay to close it, or browser_click to interact with specific buttons.',
    });

    // Also send a browser state update so UI knows about the overlay
    mainWindow?.webContents.send('browser:state-change', instanceId, {
      hasOverlay: true,
      overlay: overlayData,
    });
  });

  // Agent operations
  ipcMain.handle('agent:initialize', async (_event, connectorName: string, model: string) => {
    return agentService!.initialize(connectorName, model);
  });

  ipcMain.handle('agent:send', async (_event, message: string) => {
    return agentService!.send(message);
  });

  ipcMain.handle('agent:stream', async (_event, message: string) => {
    // For streaming, we send chunks via the main window
    try {
      const stream = agentService!.stream(message);
      for await (const chunk of stream) {
        mainWindow?.webContents.send('agent:stream-chunk', chunk);
      }
      mainWindow?.webContents.send('agent:stream-end');
      return { success: true };
    } catch (error) {
      console.error('[HOSEA] Stream error:', error);
      mainWindow?.webContents.send('agent:stream-end');
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('agent:cancel', async () => {
    return agentService!.cancel();
  });

  ipcMain.handle('agent:status', async () => {
    return agentService!.getStatus();
  });

  ipcMain.handle('agent:approve-plan', async (_event, planId: string) => {
    return agentService!.approvePlan(planId);
  });

  ipcMain.handle('agent:reject-plan', async (_event, planId: string, reason?: string) => {
    return agentService!.rejectPlan(planId, reason);
  });

  // Multi-tab instance operations
  ipcMain.handle('agent:create-instance', async (_event, agentConfigId: string) => {
    return agentService!.createInstance(agentConfigId);
  });

  ipcMain.handle('agent:destroy-instance', async (_event, instanceId: string) => {
    return agentService!.destroyInstance(instanceId);
  });

  ipcMain.handle('agent:stream-instance', async (_event, instanceId: string, message: string) => {
    // For streaming, we send chunks via the main window with instanceId
    try {
      const stream = agentService!.streamInstance(instanceId, message);
      for await (const chunk of stream) {
        mainWindow?.webContents.send('agent:stream-chunk', instanceId, chunk);
      }
      mainWindow?.webContents.send('agent:stream-end', instanceId);
      return { success: true };
    } catch (error) {
      console.error('[HOSEA] Stream instance error:', error);
      // Send error chunk BEFORE stream-end so UI knows what happened
      const errorMessage = error instanceof Error ? error.message : String(error);
      mainWindow?.webContents.send('agent:stream-chunk', instanceId, {
        type: 'error',
        content: errorMessage,
      });
      mainWindow?.webContents.send('agent:stream-end', instanceId);
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('agent:cancel-instance', async (_event, instanceId: string) => {
    return agentService!.cancelInstance(instanceId);
  });

  ipcMain.handle('agent:status-instance', async (_event, instanceId: string) => {
    return agentService!.getInstanceStatus(instanceId);
  });

  ipcMain.handle('agent:list-instances', async () => {
    return agentService!.listInstances();
  });

  // Connector operations
  ipcMain.handle('connector:list', async () => {
    return agentService!.listConnectors();
  });

  ipcMain.handle('connector:add', async (_event, config: unknown) => {
    return agentService!.addConnector(config);
  });

  ipcMain.handle('connector:delete', async (_event, name: string) => {
    return agentService!.deleteConnector(name);
  });

  // Model operations
  ipcMain.handle('model:list', async () => {
    return agentService!.listModels();
  });

  ipcMain.handle('model:details', async (_event, modelId: string) => {
    return agentService!.getModelDetails(modelId);
  });

  ipcMain.handle('model:vendors', async () => {
    return agentService!.listVendors();
  });

  // Strategy operations
  ipcMain.handle('strategy:list', async () => {
    return agentService!.getStrategies();
  });

  // Session operations
  ipcMain.handle('session:save', async () => {
    return agentService!.saveSession();
  });

  ipcMain.handle('session:load', async (_event, sessionId: string) => {
    return agentService!.loadSession(sessionId);
  });

  ipcMain.handle('session:list', async () => {
    return agentService!.listSessions();
  });

  ipcMain.handle('session:new', async () => {
    return agentService!.newSession();
  });

  // Tool operations
  ipcMain.handle('tool:list', async () => {
    return agentService!.listTools();
  });

  ipcMain.handle('tool:toggle', async (_event, toolName: string, enabled: boolean) => {
    return agentService!.toggleTool(toolName, enabled);
  });

  ipcMain.handle('tool:registry', async () => {
    return agentService!.getAvailableTools();
  });

  ipcMain.handle('tool:categories', async () => {
    return agentService!.getToolCategories();
  });

  // Agent configuration operations
  ipcMain.handle('agent-config:list', async () => {
    return agentService!.listAgents();
  });

  ipcMain.handle('agent-config:get', async (_event, id: string) => {
    return agentService!.getAgent(id);
  });

  ipcMain.handle('agent-config:create', async (_event, config: unknown) => {
    return agentService!.createAgent(config as any);
  });

  ipcMain.handle('agent-config:update', async (_event, id: string, updates: unknown) => {
    return agentService!.updateAgent(id, updates as any);
  });

  ipcMain.handle('agent-config:delete', async (_event, id: string) => {
    return agentService!.deleteAgent(id);
  });

  ipcMain.handle('agent-config:set-active', async (_event, id: string) => {
    return agentService!.setActiveAgent(id);
  });

  ipcMain.handle('agent-config:get-active', async () => {
    return agentService!.getActiveAgent();
  });

  ipcMain.handle('agent-config:create-default', async (_event, connectorName: string, model: string) => {
    return agentService!.createDefaultAgent(connectorName, model);
  });

  // API Connector operations (for tools like web_search, web_scrape)
  ipcMain.handle('api-connector:list', async () => {
    return agentService!.listAPIConnectors();
  });

  ipcMain.handle('api-connector:list-by-service', async (_event, serviceType: string) => {
    return agentService!.getAPIConnectorsByServiceType(serviceType);
  });

  ipcMain.handle('api-connector:add', async (_event, config: unknown) => {
    return agentService!.addAPIConnector(config);
  });

  ipcMain.handle('api-connector:update', async (_event, name: string, updates: unknown) => {
    return agentService!.updateAPIConnector(name, updates as any);
  });

  ipcMain.handle('api-connector:delete', async (_event, name: string) => {
    return agentService!.deleteAPIConnector(name);
  });

  // Universal Connector operations (vendor templates)
  ipcMain.handle('universal-connector:list-vendors', async () => {
    return agentService!.listVendorTemplates();
  });

  ipcMain.handle('universal-connector:get-vendor', async (_event, vendorId: string) => {
    return agentService!.getVendorTemplateById(vendorId) || null;
  });

  ipcMain.handle('universal-connector:get-vendor-template', async (_event, vendorId: string) => {
    return agentService!.getFullVendorTemplate(vendorId) || null;
  });

  ipcMain.handle('universal-connector:get-vendor-logo', async (_event, vendorId: string) => {
    return agentService!.getVendorLogoById(vendorId) || null;
  });

  ipcMain.handle('universal-connector:get-categories', async () => {
    return agentService!.getVendorCategories();
  });

  ipcMain.handle('universal-connector:list-vendors-by-category', async (_event, category: string) => {
    return agentService!.getVendorsByCategory(category);
  });

  ipcMain.handle('universal-connector:list', async () => {
    return agentService!.listUniversalConnectors();
  });

  ipcMain.handle('universal-connector:get', async (_event, name: string) => {
    return agentService!.getUniversalConnector(name);
  });

  ipcMain.handle('universal-connector:create', async (_event, config: unknown) => {
    return agentService!.createUniversalConnector(config as any);
  });

  ipcMain.handle('universal-connector:update', async (_event, name: string, updates: unknown) => {
    return agentService!.updateUniversalConnector(name, updates as any);
  });

  ipcMain.handle('universal-connector:delete', async (_event, name: string) => {
    return agentService!.deleteUniversalConnector(name);
  });

  ipcMain.handle('universal-connector:test-connection', async (_event, name: string) => {
    return agentService!.testUniversalConnection(name);
  });

  // MCP Server operations
  ipcMain.handle('mcp-server:list', async () => {
    return agentService!.listMCPServers();
  });

  ipcMain.handle('mcp-server:get', async (_event, name: string) => {
    return agentService!.getMCPServer(name);
  });

  ipcMain.handle('mcp-server:create', async (_event, config: unknown) => {
    return agentService!.createMCPServer(config as any);
  });

  ipcMain.handle('mcp-server:update', async (_event, name: string, updates: unknown) => {
    return agentService!.updateMCPServer(name, updates as any);
  });

  ipcMain.handle('mcp-server:delete', async (_event, name: string) => {
    return agentService!.deleteMCPServer(name);
  });

  ipcMain.handle('mcp-server:connect', async (_event, name: string) => {
    return agentService!.connectMCPServer(name);
  });

  ipcMain.handle('mcp-server:disconnect', async (_event, name: string) => {
    return agentService!.disconnectMCPServer(name);
  });

  ipcMain.handle('mcp-server:get-tools', async (_event, name: string) => {
    return agentService!.getMCPServerTools(name);
  });

  ipcMain.handle('mcp-server:refresh-tools', async (_event, name: string) => {
    return agentService!.refreshMCPServerTools(name);
  });

  // Config operations
  ipcMain.handle('config:get', async () => {
    return agentService!.getConfig();
  });

  ipcMain.handle('config:set', async (_event, key: string, value: unknown) => {
    return agentService!.setConfig(key, value);
  });

  // Log level operations
  ipcMain.handle('log:get-level', async () => {
    return agentService!.getLogLevel();
  });

  ipcMain.handle('log:set-level', async (_event, level: string) => {
    return agentService!.setLogLevel(level as any);
  });

  // Internals monitoring (Look Inside)
  // Legacy handlers (no instanceId) - for backwards compatibility
  ipcMain.handle('internals:get-all', async (_event, instanceId?: string) => {
    // Support optional instanceId parameter
    return agentService!.getInternalsForInstance(instanceId || null);
  });

  ipcMain.handle('internals:get-context-stats', async () => {
    return agentService!.getContextStats();
  });

  ipcMain.handle('internals:get-memory-entries', async () => {
    return agentService!.getMemoryEntries();
  });

  ipcMain.handle('internals:get-prepared-context', async (_event, instanceId?: string) => {
    if (instanceId) {
      return agentService!.getPreparedContextForInstance(instanceId);
    }
    return agentService!.getPreparedContext();
  });

  ipcMain.handle('internals:get-memory-value', async (_event, keyOrInstanceId: string, keyIfInstance?: string) => {
    // Support both old signature (key) and new signature (instanceId, key)
    if (keyIfInstance !== undefined) {
      return agentService!.getMemoryValueForInstance(keyOrInstanceId, keyIfInstance);
    }
    return agentService!.getMemoryValue(keyOrInstanceId);
  });

  ipcMain.handle('internals:force-compact', async (_event, instanceId?: string) => {
    if (instanceId) {
      return agentService!.forceCompactionForInstance(instanceId);
    }
    return agentService!.forceCompaction();
  });

  // Multimedia - Image Generation
  ipcMain.handle('multimedia:get-available-image-models', async () => {
    return agentService!.getAvailableImageModels();
  });

  ipcMain.handle('multimedia:get-image-model-capabilities', async (_event, modelName: string) => {
    return agentService!.getImageModelCapabilities(modelName);
  });

  ipcMain.handle('multimedia:calculate-image-cost', async (_event, modelName: string, imageCount: number, quality: string) => {
    return agentService!.calculateImageCost(modelName, imageCount, quality as 'standard' | 'hd');
  });

  ipcMain.handle('multimedia:generate-image', async (_event, options: unknown) => {
    return agentService!.generateImage(options as {
      model: string;
      prompt: string;
      size?: string;
      quality?: string;
      style?: string;
      n?: number;
      [key: string]: unknown;
    });
  });

  // Multimedia - Video Generation
  ipcMain.handle('multimedia:get-available-video-models', async () => {
    return agentService!.getAvailableVideoModels();
  });

  ipcMain.handle('multimedia:get-video-model-capabilities', async (_event, modelName: string) => {
    return agentService!.getVideoModelCapabilities(modelName);
  });

  ipcMain.handle('multimedia:calculate-video-cost', async (_event, modelName: string, durationSeconds: number) => {
    return agentService!.calculateVideoCost(modelName, durationSeconds);
  });

  ipcMain.handle('multimedia:generate-video', async (_event, options: unknown) => {
    return agentService!.generateVideo(options as {
      model: string;
      prompt: string;
      duration?: number;
      resolution?: string;
      aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
      image?: string;
      seed?: number;
      vendorOptions?: Record<string, unknown>;
    });
  });

  ipcMain.handle('multimedia:get-video-status', async (_event, jobId: string) => {
    return agentService!.getVideoStatus(jobId);
  });

  ipcMain.handle('multimedia:download-video', async (_event, jobId: string) => {
    return agentService!.downloadVideo(jobId);
  });

  ipcMain.handle('multimedia:cancel-video-job', async (_event, jobId: string) => {
    return agentService!.cancelVideoJob(jobId);
  });

  // Multimedia - TTS
  ipcMain.handle('multimedia:get-available-tts-models', async () => {
    return agentService!.getAvailableTTSModels();
  });

  ipcMain.handle('multimedia:get-tts-model-capabilities', async (_event, modelName: string) => {
    return agentService!.getTTSModelCapabilities(modelName);
  });

  ipcMain.handle('multimedia:calculate-tts-cost', async (_event, modelName: string, charCount: number) => {
    return agentService!.calculateTTSCost(modelName, charCount);
  });

  ipcMain.handle('multimedia:synthesize-speech', async (_event, options: unknown) => {
    return agentService!.synthesizeSpeech(options as {
      model: string;
      text: string;
      voice: string;
      format?: string;
      speed?: number;
      vendorOptions?: Record<string, unknown>;
    });
  });

  // Dialog operations
  ipcMain.handle('dialog:show-open-dialog', async (_event, options: {
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => {
    if (!mainWindow) {
      return { canceled: true, filePaths: [] };
    }
    return dialog.showOpenDialog(mainWindow, options);
  });

  // ============ Browser Automation IPC Handlers ============

  ipcMain.handle('browser:create', async (_event, instanceId: string) => {
    if (!browserService) {
      return { success: false, error: 'Browser service not initialized' };
    }
    return browserService.createBrowser(instanceId);
  });

  ipcMain.handle('browser:destroy', async (_event, instanceId: string) => {
    if (!browserService) {
      return { success: false, error: 'Browser service not initialized' };
    }
    return browserService.destroyBrowser(instanceId);
  });

  ipcMain.handle('browser:navigate', async (_event, instanceId: string, url: string, options?: { waitUntil?: string; timeout?: number }) => {
    if (!browserService) {
      return { success: false, url: '', title: '', loadTime: 0, error: 'Browser service not initialized' };
    }
    // Cast waitUntil to the correct union type
    const navigateOptions = options ? {
      ...options,
      waitUntil: options.waitUntil as 'load' | 'domcontentloaded' | 'networkidle' | undefined,
    } : undefined;
    return browserService.navigate(instanceId, url, navigateOptions);
  });

  ipcMain.handle('browser:get-state', async (_event, instanceId: string) => {
    if (!browserService) {
      return { success: false, url: '', title: '', isLoading: false, canGoBack: false, canGoForward: false, viewport: { width: 0, height: 0 }, error: 'Browser service not initialized' };
    }
    return browserService.getState(instanceId);
  });

  ipcMain.handle('browser:go-back', async (_event, instanceId: string) => {
    if (!browserService) {
      return { success: false, url: '', title: '', error: 'Browser service not initialized' };
    }
    return browserService.goBack(instanceId);
  });

  ipcMain.handle('browser:go-forward', async (_event, instanceId: string) => {
    if (!browserService) {
      return { success: false, url: '', title: '', error: 'Browser service not initialized' };
    }
    return browserService.goForward(instanceId);
  });

  ipcMain.handle('browser:reload', async (_event, instanceId: string) => {
    if (!browserService) {
      return { success: false, url: '', title: '', error: 'Browser service not initialized' };
    }
    return browserService.reload(instanceId);
  });

  ipcMain.handle('browser:attach', async (_event, instanceId: string, bounds: Rectangle) => {
    if (!browserService) {
      return { success: false, error: 'Browser service not initialized' };
    }
    return browserService.attachToWindow(instanceId, bounds);
  });

  ipcMain.handle('browser:detach', async (_event, instanceId: string) => {
    if (!browserService) {
      return { success: false, error: 'Browser service not initialized' };
    }
    return browserService.detachFromWindow(instanceId);
  });

  ipcMain.handle('browser:update-bounds', async (_event, instanceId: string, bounds: Rectangle) => {
    if (!browserService) {
      return { success: false, error: 'Browser service not initialized' };
    }
    return browserService.updateBounds(instanceId, bounds);
  });

  ipcMain.handle('browser:get-instance-info', async (_event, instanceId: string) => {
    if (!browserService) {
      return null;
    }
    return browserService.getInstanceInfo(instanceId);
  });

  ipcMain.handle('browser:list-instances', async () => {
    if (!browserService) {
      return [];
    }
    return browserService.getAllInstances();
  });

  ipcMain.handle('browser:has-browser', async (_event, instanceId: string) => {
    if (!browserService) {
      return false;
    }
    return browserService.hasBrowser(instanceId);
  });

  // Initialize auto-updater (only in production)
  if (!isDev) {
    autoUpdaterService = new AutoUpdaterService();
    autoUpdaterService.initialize();
  }
}

/**
 * Create application menu with Check for Updates option
 */
function createAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Check for Updates...',
          click: () => {
            if (autoUpdaterService) {
              autoUpdaterService.checkForUpdates();
            } else {
              dialog.showMessageBox({
                type: 'info',
                title: 'Updates',
                message: 'Auto-updates are only available in the production build.',
              });
            }
          },
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),

    // File menu
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const },
        ]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/Integrail/oneringai');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/Integrail/oneringai/issues');
          },
        },
        // Check for Updates on non-Mac platforms
        ...(!isMac ? [
          { type: 'separator' as const },
          {
            label: 'Check for Updates...',
            click: () => {
              if (autoUpdaterService) {
                autoUpdaterService.checkForUpdates();
              } else {
                dialog.showMessageBox({
                  type: 'info',
                  title: 'Updates',
                  message: 'Auto-updates are only available in the production build.',
                });
              }
            },
          },
        ] : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Register custom protocol for serving local media files (images, video, audio)
// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([{
  scheme: 'local-media',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

// App lifecycle
app.whenReady().then(async () => {
  // Handle local-media:// protocol - serves files from the media output directory
  const allowedMediaDir = join(tmpdir(), 'oneringai-media');
  protocol.handle('local-media', async (request) => {
    const url = new URL(request.url);
    // Standard URL parsing may capture the first path segment as hostname
    // e.g. local-media:///var/folders/... → hostname:"var", pathname:"/folders/..."
    // Reconstruct the full absolute path
    const filePath = url.hostname
      ? decodeURIComponent(`/${url.hostname}${url.pathname}`)
      : decodeURIComponent(url.pathname);
    // Security: only serve files from the media output directory
    if (!filePath.startsWith(allowedMediaDir)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(`file://${filePath}`);
  });

  await setupIPC();
  await createWindow();

  // Set main window reference on browser service after window is created
  if (browserService && mainWindow) {
    browserService.setMainWindow(mainWindow);
  }

  // Set main window on auto-updater and check for updates (5 second delay)
  if (autoUpdaterService && mainWindow) {
    autoUpdaterService.setMainWindow(mainWindow);
    autoUpdaterService.checkOnStartup(5000);
  }

  // Create application menu
  createAppMenu();

  app.on('activate', async () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
      // Update browser service with new window
      if (browserService && mainWindow) {
        browserService.setMainWindow(mainWindow);
      }
    }
  });
});

app.on('window-all-closed', () => {
  // Quit on all platforms except macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Cleanup
  if (browserService) {
    await browserService.destroyAll();
  }
  agentService?.destroy();
});

// ============ Global Error Handlers ============
// These prevent the app from crashing due to unhandled errors in IPC handlers or tools

process.on('uncaughtException', (error, origin) => {
  console.error('[HOSEA] Uncaught exception:', error);
  console.error('[HOSEA] Origin:', origin);
  // Don't crash - log and continue unless it's truly fatal
  // Send error to renderer if possible
  try {
    mainWindow?.webContents.send('error:uncaught', {
      type: 'uncaughtException',
      message: error.message,
      stack: error.stack,
    });
  } catch {
    // Ignore - window may not exist
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[HOSEA] Unhandled rejection:', reason);
  // Don't crash - log and continue
  // Send error to renderer if possible
  try {
    mainWindow?.webContents.send('error:uncaught', {
      type: 'unhandledRejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  } catch {
    // Ignore - window may not exist
  }
});

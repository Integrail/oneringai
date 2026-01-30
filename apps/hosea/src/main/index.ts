/**
 * HOSEA - Human-Oriented System for Engaging Agents
 *
 * Electron main process - handles window management and IPC with the agent.
 */

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { AgentService } from './AgentService.js';

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

function setupIPC(): void {
  // Initialize agent service with proper data directory
  const dataDir = getDataDir();
  console.log('HOSEA data directory:', dataDir);
  agentService = new AgentService(dataDir);

  // Agent operations
  ipcMain.handle('agent:initialize', async (_event, connectorName: string, model: string) => {
    return agentService!.initialize(connectorName, model);
  });

  ipcMain.handle('agent:send', async (_event, message: string) => {
    return agentService!.send(message);
  });

  ipcMain.handle('agent:stream', async (_event, message: string) => {
    // For streaming, we send chunks via the main window
    const stream = agentService!.stream(message);
    for await (const chunk of stream) {
      mainWindow?.webContents.send('agent:stream-chunk', chunk);
    }
    mainWindow?.webContents.send('agent:stream-end');
    return { success: true };
  });

  ipcMain.handle('agent:cancel', async () => {
    return agentService!.cancel();
  });

  ipcMain.handle('agent:status', async () => {
    return agentService!.getStatus();
  });

  // Connector operations
  ipcMain.handle('connector:list', async () => {
    return agentService!.listConnectors();
  });

  ipcMain.handle('connector:add', async (_event, config: unknown) => {
    return agentService!.addConnector(config);
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

  // Config operations
  ipcMain.handle('config:get', async () => {
    return agentService!.getConfig();
  });

  ipcMain.handle('config:set', async (_event, key: string, value: unknown) => {
    return agentService!.setConfig(key, value);
  });
}

// App lifecycle
app.whenReady().then(async () => {
  setupIPC();
  await createWindow();

  app.on('activate', async () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Quit on all platforms except macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup
  agentService?.destroy();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

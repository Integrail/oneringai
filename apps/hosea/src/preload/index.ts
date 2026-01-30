/**
 * Preload script - exposes safe IPC methods to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Types for the exposed API
export interface HoseaAPI {
  // Agent
  agent: {
    initialize: (connectorName: string, model: string) => Promise<{ success: boolean; error?: string }>;
    send: (message: string) => Promise<{ success: boolean; response?: string; error?: string }>;
    stream: (message: string) => Promise<{ success: boolean }>;
    cancel: () => Promise<{ success: boolean }>;
    status: () => Promise<{
      initialized: boolean;
      connector: string | null;
      model: string | null;
      mode: string | null;
    }>;
    onStreamChunk: (callback: (chunk: { type: string; content?: string; tool?: string }) => void) => void;
    onStreamEnd: (callback: () => void) => void;
    removeStreamListeners: () => void;
  };

  // Connectors
  connector: {
    list: () => Promise<Array<{
      name: string;
      vendor: string;
      createdAt: number;
    }>>;
    add: (config: unknown) => Promise<{ success: boolean; error?: string }>;
  };

  // Models
  model: {
    list: () => Promise<Array<{
      vendor: string;
      models: Array<{ id: string; name: string }>;
    }>>;
  };

  // Sessions
  session: {
    save: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
    load: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    list: () => Promise<Array<{ id: string; createdAt: number }>>;
    new: () => Promise<{ success: boolean }>;
  };

  // Tools
  tool: {
    list: () => Promise<Array<{ name: string; enabled: boolean; description: string }>>;
    toggle: (toolName: string, enabled: boolean) => Promise<{ success: boolean }>;
  };

  // Config
  config: {
    get: () => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<{ success: boolean }>;
  };
}

// Expose to renderer
const api: HoseaAPI = {
  agent: {
    initialize: (connectorName, model) => ipcRenderer.invoke('agent:initialize', connectorName, model),
    send: (message) => ipcRenderer.invoke('agent:send', message),
    stream: (message) => ipcRenderer.invoke('agent:stream', message),
    cancel: () => ipcRenderer.invoke('agent:cancel'),
    status: () => ipcRenderer.invoke('agent:status'),
    onStreamChunk: (callback) => {
      // Remove any existing listeners first to prevent duplicates
      ipcRenderer.removeAllListeners('agent:stream-chunk');
      ipcRenderer.on('agent:stream-chunk', (_event, chunk) => callback(chunk));
    },
    onStreamEnd: (callback) => {
      // Remove any existing listeners first to prevent duplicates
      ipcRenderer.removeAllListeners('agent:stream-end');
      ipcRenderer.on('agent:stream-end', () => callback());
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('agent:stream-chunk');
      ipcRenderer.removeAllListeners('agent:stream-end');
    },
  },

  connector: {
    list: () => ipcRenderer.invoke('connector:list'),
    add: (config) => ipcRenderer.invoke('connector:add', config),
  },

  model: {
    list: () => ipcRenderer.invoke('model:list'),
  },

  session: {
    save: () => ipcRenderer.invoke('session:save'),
    load: (sessionId) => ipcRenderer.invoke('session:load', sessionId),
    list: () => ipcRenderer.invoke('session:list'),
    new: () => ipcRenderer.invoke('session:new'),
  },

  tool: {
    list: () => ipcRenderer.invoke('tool:list'),
    toggle: (toolName, enabled) => ipcRenderer.invoke('tool:toggle', toolName, enabled),
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
  },
};

contextBridge.exposeInMainWorld('hosea', api);

// Type declaration for renderer
declare global {
  interface Window {
    hosea: HoseaAPI;
  }
}

/**
 * Preload script - exposes safe IPC methods to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Stream chunk types for IPC communication
 */
export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown>; description: string }
  | { type: 'tool_end'; tool: string; durationMs?: number }
  | { type: 'tool_error'; tool: string; error: string }
  | { type: 'done' }
  | { type: 'error'; content: string };

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
    onStreamChunk: (callback: (chunk: StreamChunk) => void) => void;
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
      models: Array<{ id: string; name: string; description?: string; contextWindow: number }>;
    }>>;
    details: (modelId: string) => Promise<{
      name: string;
      provider: string;
      description?: string;
      isActive: boolean;
      features: {
        input: { tokens: number };
        output: { tokens: number };
        reasoning?: boolean;
        streaming: boolean;
        functionCalling?: boolean;
        vision?: boolean;
      };
    } | null>;
    vendors: () => Promise<string[]>;
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
    registry: () => Promise<Array<{
      name: string;
      displayName: string;
      category: string;
      description: string;
      safeByDefault: boolean;
      requiresConnector: boolean;
      connectorServiceTypes?: string[];
    }>>;
  };

  // Config
  config: {
    get: () => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<{ success: boolean }>;
  };

  // Logging
  log: {
    getLevel: () => Promise<'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'>;
    setLevel: (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent') => Promise<{ success: boolean }>;
  };

  // Agent configurations (saved agent presets)
  agentConfig: {
    list: () => Promise<Array<{
      id: string;
      name: string;
      connector: string;
      model: string;
      agentType: 'basic' | 'task' | 'research' | 'universal';
      instructions: string;
      temperature: number;
      contextStrategy: string;
      maxContextTokens: number;
      responseReserve: number;
      memoryEnabled: boolean;
      maxMemorySizeBytes: number;
      memorySoftLimitPercent: number;
      contextAllocationPercent: number;
      inContextMemoryEnabled: boolean;
      maxInContextEntries: number;
      maxInContextTokens: number;
      historyEnabled: boolean;
      maxHistoryMessages: number;
      preserveRecent: number;
      cacheEnabled: boolean;
      cacheTtlMs: number;
      cacheMaxEntries: number;
      permissionsEnabled: boolean;
      tools: string[];
      createdAt: number;
      updatedAt: number;
      lastUsedAt?: number;
      isActive: boolean;
    }>>;
    get: (id: string) => Promise<{
      id: string;
      name: string;
      connector: string;
      model: string;
      agentType: 'basic' | 'task' | 'research' | 'universal';
      instructions: string;
      temperature: number;
      contextStrategy: string;
      maxContextTokens: number;
      responseReserve: number;
      memoryEnabled: boolean;
      maxMemorySizeBytes: number;
      memorySoftLimitPercent: number;
      contextAllocationPercent: number;
      inContextMemoryEnabled: boolean;
      maxInContextEntries: number;
      maxInContextTokens: number;
      historyEnabled: boolean;
      maxHistoryMessages: number;
      preserveRecent: number;
      cacheEnabled: boolean;
      cacheTtlMs: number;
      cacheMaxEntries: number;
      permissionsEnabled: boolean;
      tools: string[];
      createdAt: number;
      updatedAt: number;
      lastUsedAt?: number;
      isActive: boolean;
    } | null>;
    create: (config: unknown) => Promise<{ success: boolean; id?: string; error?: string }>;
    update: (id: string, updates: unknown) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    setActive: (id: string) => Promise<{ success: boolean; error?: string }>;
    getActive: () => Promise<{
      id: string;
      name: string;
      connector: string;
      model: string;
      agentType: 'basic' | 'task' | 'research' | 'universal';
      isActive: boolean;
    } | null>;
    createDefault: (connectorName: string, model: string) => Promise<{ success: boolean; id?: string; error?: string }>;
  };

  // Internals monitoring (Look Inside)
  internals: {
    getAll: () => Promise<{
      available: boolean;
      agentName: string | null;
      context: {
        totalTokens: number;
        maxTokens: number;
        utilizationPercent: number;
        messagesCount: number;
        toolCallsCount: number;
        strategy: string;
      } | null;
      cache: {
        entries: number;
        hits: number;
        misses: number;
        hitRate: number;
        ttlMs: number;
      } | null;
      memory: {
        totalEntries: number;
        totalSizeBytes: number;
        utilizationPercent: number;
        entries: Array<{
          key: string;
          description: string;
          scope: string;
          priority: string;
          sizeBytes: number;
          updatedAt: number;
        }>;
      } | null;
      inContextMemory: {
        entries: Array<{
          key: string;
          description: string;
          priority: string;
          updatedAt: number;
          value: unknown;
        }>;
        maxEntries: number;
        maxTokens: number;
      } | null;
      tools: Array<{
        name: string;
        description: string;
        enabled: boolean;
        callCount: number;
        namespace?: string;
      }>;
      toolCalls: Array<{
        id: string;
        name: string;
        args: unknown;
        result?: unknown;
        error?: string;
        durationMs: number;
        timestamp: number;
      }>;
    }>;
    getContextStats: () => Promise<{
      available: boolean;
      totalTokens: number;
      maxTokens: number;
      utilizationPercent: number;
      messagesCount: number;
      toolCallsCount: number;
      strategy: string;
    } | null>;
    getMemoryEntries: () => Promise<Array<{
      key: string;
      description: string;
      scope: string;
      priority: string;
      sizeBytes: number;
      updatedAt: number;
      value?: unknown;
    }>>;
  };

  // API Connectors (for tools like web_search, web_scrape)
  apiConnector: {
    list: () => Promise<Array<{
      name: string;
      serviceType: string;
      displayName?: string;
      auth: { type: 'api_key'; apiKey: string; headerName?: string; headerPrefix?: string };
      baseURL?: string;
      createdAt: number;
      updatedAt: number;
    }>>;
    listByService: (serviceType: string) => Promise<Array<{
      name: string;
      serviceType: string;
      displayName?: string;
      auth: { type: 'api_key'; apiKey: string; headerName?: string; headerPrefix?: string };
      baseURL?: string;
      createdAt: number;
      updatedAt: number;
    }>>;
    add: (config: unknown) => Promise<{ success: boolean; error?: string }>;
    update: (name: string, updates: unknown) => Promise<{ success: boolean; error?: string }>;
    delete: (name: string) => Promise<{ success: boolean; error?: string }>;
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
    details: (modelId) => ipcRenderer.invoke('model:details', modelId),
    vendors: () => ipcRenderer.invoke('model:vendors'),
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
    registry: () => ipcRenderer.invoke('tool:registry'),
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
  },

  agentConfig: {
    list: () => ipcRenderer.invoke('agent-config:list'),
    get: (id) => ipcRenderer.invoke('agent-config:get', id),
    create: (config) => ipcRenderer.invoke('agent-config:create', config),
    update: (id, updates) => ipcRenderer.invoke('agent-config:update', id, updates),
    delete: (id) => ipcRenderer.invoke('agent-config:delete', id),
    setActive: (id) => ipcRenderer.invoke('agent-config:set-active', id),
    getActive: () => ipcRenderer.invoke('agent-config:get-active'),
    createDefault: (connectorName, model) => ipcRenderer.invoke('agent-config:create-default', connectorName, model),
  },

  apiConnector: {
    list: () => ipcRenderer.invoke('api-connector:list'),
    listByService: (serviceType) => ipcRenderer.invoke('api-connector:list-by-service', serviceType),
    add: (config) => ipcRenderer.invoke('api-connector:add', config),
    update: (name, updates) => ipcRenderer.invoke('api-connector:update', name, updates),
    delete: (name) => ipcRenderer.invoke('api-connector:delete', name),
  },

  internals: {
    getAll: () => ipcRenderer.invoke('internals:get-all'),
    getContextStats: () => ipcRenderer.invoke('internals:get-context-stats'),
    getMemoryEntries: () => ipcRenderer.invoke('internals:get-memory-entries'),
  },

  log: {
    getLevel: () => ipcRenderer.invoke('log:get-level'),
    setLevel: (level) => ipcRenderer.invoke('log:set-level', level),
  },
};

contextBridge.exposeInMainWorld('hosea', api);

// Type declaration for renderer
declare global {
  interface Window {
    hosea: HoseaAPI;
  }
}

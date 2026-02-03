/**
 * Preload script - exposes safe IPC methods to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Task interface for plan display (matches core library Task interface)
 */
export interface PlanTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'blocked' | 'in_progress' | 'waiting_external' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  dependsOn: string[];
  validation?: {
    completionCriteria?: string[];
  };
  result?: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Plan interface for plan display (matches core library Plan interface)
 */
export interface Plan {
  id: string;
  goal: string;
  context?: string;
  tasks: PlanTask[];
  status: 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Stream chunk types for IPC communication
 */
export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown>; description: string }
  | { type: 'tool_end'; tool: string; durationMs?: number }
  | { type: 'tool_error'; tool: string; error: string }
  | { type: 'done' }
  | { type: 'error'; content: string }
  // Plan events
  | { type: 'plan:created'; plan: Plan }
  | { type: 'plan:awaiting_approval'; plan: Plan }
  | { type: 'plan:approved'; plan: Plan }
  | { type: 'plan:analyzing'; goal: string }
  | { type: 'mode:changed'; from: string; to: string; reason: string }
  // Task events
  | { type: 'task:started'; task: PlanTask }
  | { type: 'task:progress'; task: PlanTask; status: string }
  | { type: 'task:completed'; task: PlanTask; result: unknown }
  | { type: 'task:failed'; task: PlanTask; error: string }
  // Execution events
  | { type: 'execution:done'; result: { status: string; completedTasks: number; totalTasks: number; failedTasks: number; skippedTasks: number } }
  | { type: 'execution:paused'; reason: string }
  | { type: 'needs:approval'; plan: Plan };

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
    // Plan approval/rejection
    approvePlan: (planId: string) => Promise<{ success: boolean; error?: string }>;
    rejectPlan: (planId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  };

  // Connectors
  connector: {
    list: () => Promise<Array<{
      name: string;
      vendor: string;
      createdAt: number;
    }>>;
    add: (config: unknown) => Promise<{ success: boolean; error?: string }>;
    delete: (name: string) => Promise<{ success: boolean; error?: string }>;
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
      persistentInstructionsEnabled: boolean;
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
      persistentInstructionsEnabled: boolean;
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
        enabled: boolean;
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
      // New fields for prompt inspection
      systemPrompt: string | null;
      persistentInstructions: {
        content: string;
        path: string;
        length: number;
        enabled: boolean;
      } | null;
      // Token breakdown for detailed context inspection
      tokenBreakdown: {
        total: number;
        reserved: number;
        used: number;
        available: number;
        components: Array<{ name: string; tokens: number; percent: number }>;
      } | null;
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
    getPreparedContext: () => Promise<{
      available: boolean;
      components: Array<{
        name: string;
        content: string;
        tokenEstimate: number;
      }>;
      totalTokens: number;
      rawContext: string;
    }>;
    getMemoryValue: (key: string) => Promise<unknown>;
    forceCompact: () => Promise<{ success: boolean; tokensFreed: number; error?: string }>;
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

  // Universal Connectors (vendor templates)
  universalConnector: {
    // Vendor template access (read-only from library)
    listVendors: () => Promise<Array<{
      id: string;
      name: string;
      category: string;
      docsURL?: string;
      credentialsSetupURL?: string;
      authMethods: Array<{
        id: string;
        name: string;
        type: string;
        description: string;
        requiredFields: string[];
      }>;
    }>>;
    getVendor: (vendorId: string) => Promise<{
      id: string;
      name: string;
      category: string;
      docsURL?: string;
      credentialsSetupURL?: string;
      authMethods: Array<{
        id: string;
        name: string;
        type: string;
        description: string;
        requiredFields: string[];
      }>;
    } | null>;
    getVendorTemplate: (vendorId: string) => Promise<{
      id: string;
      name: string;
      serviceType: string;
      baseURL: string;
      docsURL?: string;
      credentialsSetupURL?: string;
      authTemplates: Array<{
        id: string;
        name: string;
        type: 'api_key' | 'oauth';
        flow?: 'authorization_code' | 'client_credentials' | 'jwt_bearer';
        description: string;
        requiredFields: string[];
        optionalFields?: string[];
        scopes?: string[];
      }>;
      category: string;
      notes?: string;
    } | null>;
    getVendorLogo: (vendorId: string) => Promise<{
      vendorId: string;
      svg: string;
      hex: string;
      isPlaceholder: boolean;
      simpleIconsSlug?: string;
    } | null>;
    getCategories: () => Promise<string[]>;
    listVendorsByCategory: (category: string) => Promise<Array<{
      id: string;
      name: string;
      category: string;
      docsURL?: string;
      credentialsSetupURL?: string;
      authMethods: Array<{
        id: string;
        name: string;
        type: string;
        description: string;
        requiredFields: string[];
      }>;
    }>>;

    // Connector CRUD operations
    list: () => Promise<Array<{
      name: string;
      vendorId: string;
      vendorName: string;
      authMethodId: string;
      authMethodName: string;
      credentials: Record<string, string>;
      displayName?: string;
      baseURL?: string;
      createdAt: number;
      updatedAt: number;
      lastTestedAt?: number;
      status: 'active' | 'error' | 'untested';
      legacyServiceType?: string;
    }>>;
    get: (name: string) => Promise<{
      name: string;
      vendorId: string;
      vendorName: string;
      authMethodId: string;
      authMethodName: string;
      credentials: Record<string, string>;
      displayName?: string;
      baseURL?: string;
      createdAt: number;
      updatedAt: number;
      lastTestedAt?: number;
      status: 'active' | 'error' | 'untested';
      legacyServiceType?: string;
    } | null>;
    create: (config: {
      name: string;
      vendorId: string;
      authMethodId: string;
      credentials: Record<string, string>;
      displayName?: string;
      baseURL?: string;
    }) => Promise<{ success: boolean; error?: string }>;
    update: (name: string, updates: {
      credentials?: Record<string, string>;
      displayName?: string;
      baseURL?: string;
      status?: 'active' | 'error' | 'untested';
    }) => Promise<{ success: boolean; error?: string }>;
    delete: (name: string) => Promise<{ success: boolean; error?: string }>;
    testConnection: (name: string) => Promise<{ success: boolean; error?: string }>;
  };

  // MCP Servers (Model Context Protocol)
  mcpServer: {
    /** List all configured MCP servers */
    list: () => Promise<Array<{
      name: string;
      displayName?: string;
      description?: string;
      transport: 'stdio' | 'http' | 'https';
      transportConfig: {
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        cwd?: string;
        url?: string;
        token?: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
      };
      toolNamespace?: string;
      status: 'connected' | 'disconnected' | 'error' | 'connecting';
      lastError?: string;
      toolCount?: number;
      availableTools?: string[];
      createdAt: number;
      updatedAt: number;
      lastConnectedAt?: number;
    }>>;
    /** Get a specific MCP server configuration */
    get: (name: string) => Promise<{
      name: string;
      displayName?: string;
      description?: string;
      transport: 'stdio' | 'http' | 'https';
      transportConfig: {
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        cwd?: string;
        url?: string;
        token?: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
      };
      toolNamespace?: string;
      status: 'connected' | 'disconnected' | 'error' | 'connecting';
      lastError?: string;
      toolCount?: number;
      availableTools?: string[];
      createdAt: number;
      updatedAt: number;
      lastConnectedAt?: number;
    } | null>;
    /** Create a new MCP server configuration */
    create: (config: {
      name: string;
      displayName?: string;
      description?: string;
      transport: 'stdio' | 'http' | 'https';
      transportConfig: {
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        cwd?: string;
        url?: string;
        token?: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
      };
      toolNamespace?: string;
    }) => Promise<{ success: boolean; error?: string }>;
    /** Update an existing MCP server configuration */
    update: (name: string, updates: {
      displayName?: string;
      description?: string;
      transport?: 'stdio' | 'http' | 'https';
      transportConfig?: {
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        cwd?: string;
        url?: string;
        token?: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
      };
      toolNamespace?: string;
    }) => Promise<{ success: boolean; error?: string }>;
    /** Delete an MCP server configuration */
    delete: (name: string) => Promise<{ success: boolean; error?: string }>;
    /** Connect to an MCP server */
    connect: (name: string) => Promise<{ success: boolean; tools?: string[]; error?: string }>;
    /** Disconnect from an MCP server */
    disconnect: (name: string) => Promise<{ success: boolean; error?: string }>;
    /** Get tools available from an MCP server */
    getTools: (name: string) => Promise<Array<{ name: string; description?: string }>>;
    /** Refresh tools list from a connected MCP server */
    refreshTools: (name: string) => Promise<{ success: boolean; tools?: string[]; error?: string }>;
  };

  // Multimedia - Image, Video, Audio generation
  multimedia: {
    // Image generation
    getAvailableImageModels: () => Promise<Array<{
      name: string;
      displayName: string;
      vendor: string;
      description?: string;
      deprecationDate?: string;
      maxPromptLength: number;
      maxImagesPerRequest: number;
      pricing?: {
        perImage?: number;
        perImageStandard?: number;
        perImageHD?: number;
      };
    }>>;
    getImageModelCapabilities: (modelName: string) => Promise<{
      sizes: readonly string[];
      aspectRatios?: readonly string[];
      maxImagesPerRequest: number;
      outputFormats: readonly string[];
      features: {
        generation: boolean;
        editing: boolean;
        variations: boolean;
        styleControl: boolean;
        qualityControl: boolean;
        transparency: boolean;
        promptRevision: boolean;
      };
      limits: {
        maxPromptLength: number;
        maxRequestsPerMinute?: number;
      };
      vendorOptions?: Record<string, unknown>;
    } | null>;
    calculateImageCost: (modelName: string, imageCount: number, quality: string) => Promise<number | null>;
    generateImage: (options: {
      model: string;
      prompt: string;
      size?: string;
      quality?: string;
      style?: string;
      n?: number;
      [key: string]: unknown;
    }) => Promise<{
      success: boolean;
      data?: {
        images: Array<{
          b64_json?: string;
          url?: string;
          revisedPrompt?: string;
        }>;
      };
      error?: string;
    }>;
    // Video generation
    getAvailableVideoModels: () => Promise<Array<{
      name: string;
      displayName: string;
      vendor: string;
      description?: string;
      durations: number[];
      resolutions: string[];
      maxFps: number;
      audio: boolean;
      imageToVideo: boolean;
      pricing?: {
        perSecond: number;
        currency: string;
      };
    }>>;
    getVideoModelCapabilities: (modelName: string) => Promise<{
      durations: number[];
      resolutions: string[];
      aspectRatios?: string[];
      maxFps: number;
      audio: boolean;
      imageToVideo: boolean;
      videoExtension: boolean;
      frameControl: boolean;
      features: {
        upscaling: boolean;
        styleControl: boolean;
        negativePrompt: boolean;
        seed: boolean;
      };
      pricing?: {
        perSecond: number;
        currency: string;
      };
    } | null>;
    calculateVideoCost: (modelName: string, durationSeconds: number) => Promise<number | null>;
    generateVideo: (options: {
      model: string;
      prompt: string;
      duration?: number;
      resolution?: string;
      aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
      image?: string;
      seed?: number;
      vendorOptions?: Record<string, unknown>;
    }) => Promise<{
      success: boolean;
      jobId?: string;
      error?: string;
    }>;
    getVideoStatus: (jobId: string) => Promise<{
      success: boolean;
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      progress?: number;
      video?: {
        url?: string;
        duration?: number;
      };
      error?: string;
    }>;
    downloadVideo: (jobId: string) => Promise<{
      success: boolean;
      data?: string;
      mimeType?: string;
      error?: string;
    }>;
    cancelVideoJob: (jobId: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    // TTS
    getAvailableTTSModels: () => Promise<Array<{
      name: string;
      displayName: string;
      vendor: string;
      description?: string;
      maxInputLength: number;
      voiceCount: number;
      pricing?: {
        per1kCharacters: number;
        currency: string;
      };
    }>>;
    getTTSModelCapabilities: (modelName: string) => Promise<{
      voices: Array<{
        id: string;
        name: string;
        language: string;
        gender: 'male' | 'female' | 'neutral';
        style?: string;
        previewUrl?: string;
        isDefault?: boolean;
        accent?: string;
        age?: 'child' | 'young' | 'adult' | 'senior';
      }>;
      formats: string[];
      languages: string[];
      speed: {
        supported: boolean;
        min?: number;
        max?: number;
        default?: number;
      };
      features: {
        streaming: boolean;
        ssml: boolean;
        emotions: boolean;
        voiceCloning: boolean;
        wordTimestamps: boolean;
        instructionSteering?: boolean;
      };
      limits: {
        maxInputLength: number;
        maxRequestsPerMinute?: number;
      };
      vendorOptions?: Record<string, unknown>;
    } | null>;
    calculateTTSCost: (modelName: string, charCount: number) => Promise<number | null>;
    synthesizeSpeech: (options: {
      model: string;
      text: string;
      voice: string;
      format?: string;
      speed?: number;
      vendorOptions?: Record<string, unknown>;
    }) => Promise<{
      success: boolean;
      data?: {
        audio: string;
        format: string;
      };
      error?: string;
    }>;
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
    approvePlan: (planId) => ipcRenderer.invoke('agent:approve-plan', planId),
    rejectPlan: (planId, reason) => ipcRenderer.invoke('agent:reject-plan', planId, reason),
  },

  connector: {
    list: () => ipcRenderer.invoke('connector:list'),
    add: (config) => ipcRenderer.invoke('connector:add', config),
    delete: (name) => ipcRenderer.invoke('connector:delete', name),
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

  universalConnector: {
    // Vendor template access
    listVendors: () => ipcRenderer.invoke('universal-connector:list-vendors'),
    getVendor: (vendorId) => ipcRenderer.invoke('universal-connector:get-vendor', vendorId),
    getVendorTemplate: (vendorId) => ipcRenderer.invoke('universal-connector:get-vendor-template', vendorId),
    getVendorLogo: (vendorId) => ipcRenderer.invoke('universal-connector:get-vendor-logo', vendorId),
    getCategories: () => ipcRenderer.invoke('universal-connector:get-categories'),
    listVendorsByCategory: (category) => ipcRenderer.invoke('universal-connector:list-vendors-by-category', category),
    // Connector CRUD
    list: () => ipcRenderer.invoke('universal-connector:list'),
    get: (name) => ipcRenderer.invoke('universal-connector:get', name),
    create: (config) => ipcRenderer.invoke('universal-connector:create', config),
    update: (name, updates) => ipcRenderer.invoke('universal-connector:update', name, updates),
    delete: (name) => ipcRenderer.invoke('universal-connector:delete', name),
    testConnection: (name) => ipcRenderer.invoke('universal-connector:test-connection', name),
  },

  mcpServer: {
    list: () => ipcRenderer.invoke('mcp-server:list'),
    get: (name) => ipcRenderer.invoke('mcp-server:get', name),
    create: (config) => ipcRenderer.invoke('mcp-server:create', config),
    update: (name, updates) => ipcRenderer.invoke('mcp-server:update', name, updates),
    delete: (name) => ipcRenderer.invoke('mcp-server:delete', name),
    connect: (name) => ipcRenderer.invoke('mcp-server:connect', name),
    disconnect: (name) => ipcRenderer.invoke('mcp-server:disconnect', name),
    getTools: (name) => ipcRenderer.invoke('mcp-server:get-tools', name),
    refreshTools: (name) => ipcRenderer.invoke('mcp-server:refresh-tools', name),
  },

  multimedia: {
    // Image generation
    getAvailableImageModels: () => ipcRenderer.invoke('multimedia:get-available-image-models'),
    getImageModelCapabilities: (modelName) => ipcRenderer.invoke('multimedia:get-image-model-capabilities', modelName),
    calculateImageCost: (modelName, imageCount, quality) => ipcRenderer.invoke('multimedia:calculate-image-cost', modelName, imageCount, quality),
    generateImage: (options) => ipcRenderer.invoke('multimedia:generate-image', options),
    // Video generation
    getAvailableVideoModels: () => ipcRenderer.invoke('multimedia:get-available-video-models'),
    getVideoModelCapabilities: (modelName) => ipcRenderer.invoke('multimedia:get-video-model-capabilities', modelName),
    calculateVideoCost: (modelName, durationSeconds) => ipcRenderer.invoke('multimedia:calculate-video-cost', modelName, durationSeconds),
    generateVideo: (options) => ipcRenderer.invoke('multimedia:generate-video', options),
    getVideoStatus: (jobId) => ipcRenderer.invoke('multimedia:get-video-status', jobId),
    downloadVideo: (jobId) => ipcRenderer.invoke('multimedia:download-video', jobId),
    cancelVideoJob: (jobId) => ipcRenderer.invoke('multimedia:cancel-video-job', jobId),
    // TTS
    getAvailableTTSModels: () => ipcRenderer.invoke('multimedia:get-available-tts-models'),
    getTTSModelCapabilities: (modelName) => ipcRenderer.invoke('multimedia:get-tts-model-capabilities', modelName),
    calculateTTSCost: (modelName, charCount) => ipcRenderer.invoke('multimedia:calculate-tts-cost', modelName, charCount),
    synthesizeSpeech: (options) => ipcRenderer.invoke('multimedia:synthesize-speech', options),
  },

  internals: {
    getAll: () => ipcRenderer.invoke('internals:get-all'),
    getContextStats: () => ipcRenderer.invoke('internals:get-context-stats'),
    getMemoryEntries: () => ipcRenderer.invoke('internals:get-memory-entries'),
    getPreparedContext: () => ipcRenderer.invoke('internals:get-prepared-context'),
    getMemoryValue: (key: string) => ipcRenderer.invoke('internals:get-memory-value', key),
    forceCompact: () => ipcRenderer.invoke('internals:force-compact'),
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

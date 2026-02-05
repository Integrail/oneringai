/**
 * AgentService - Manages the @everworker/oneringai integration
 *
 * This service bridges Electron IPC with the agent library.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import {
  Connector,
  Vendor,
  Agent,
  // NextGen context (replaces old AgentContext)
  AgentContextNextGen,
  // NextGen plugins for inspector
  InContextMemoryPluginNextGen,
  PersistentInstructionsPluginNextGen,
  ImageGeneration,
  VideoGeneration,
  getModelsByVendor,
  getModelInfo,
  FileContextStorage,
  FileAgentDefinitionStorage,
  logger,
  defaultDescribeCall,
  getImageModelInfo,
  getActiveImageModels,
  calculateImageCost,
  getVideoModelInfo,
  getActiveVideoModels,
  calculateVideoCost,
  TextToSpeech,
  getTTSModelInfo,
  getActiveTTSModels,
  calculateTTSCost,
  // Vendor templates
  listVendors as listVendorTemplates,
  listVendorsByCategory,
  getVendorTemplate,
  getVendorInfo,
  getVendorLogo,
  getVendorAuthTemplate,
  createConnectorFromTemplate,
  // MCP
  MCPRegistry,
  // Strategy Registry
  StrategyRegistry,
  type MCPServerConfig,
  type IMCPClient,
  type VendorInfo,
  type VendorTemplate,
  type VendorLogo,
  type AuthTemplate,
  type ITTSModelDescription,
  type IVoiceInfo,
  type ToolFunction,
  type IContextStorage,
  type IAgentDefinitionStorage,
  type StoredAgentDefinition,
  type ILLMDescription,
  type LogLevel,
  type IImageModelDescription,
  type IVideoModelDescription,
  type AgentConfig,
  type ContextFeatures,
  type ContextBudget,
  type AgentContextNextGenConfig,
  type StrategyInfo,
} from '@everworker/oneringai';
import type { BrowserService } from './BrowserService.js';
import {
  UnifiedToolCatalog,
  OneRingToolProvider,
  BrowserToolProvider,
  type UnifiedToolEntry,
} from './tools/index.js';
import { HoseaUIPlugin, type DynamicUIContent } from './plugins/index.js';

interface StoredConnectorConfig {
  name: string;
  vendor: string;
  auth: {
    type: 'api_key';
    apiKey: string;
  };
  baseURL?: string;
  models?: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Validate strategy exists in StrategyRegistry.
 * Returns the strategy name if valid, or 'default' if not found.
 */
function validateStrategy(strategyName: string): { strategy: string; isValid: boolean } {
  if (StrategyRegistry.has(strategyName)) {
    return { strategy: strategyName, isValid: true };
  }
  return { strategy: 'default', isValid: false };
}

/**
 * Stored Agent Configuration
 *
 * Note: As of NextGen migration, only 'basic' agent type is supported.
 * TaskAgent, UniversalAgent, ResearchAgent are deprecated.
 */
export interface StoredAgentConfig {
  id: string;
  name: string;
  connector: string;
  model: string;
  agentType: 'basic'; // Only 'basic' supported in NextGen
  instructions: string;
  temperature: number;
  // Execution settings
  maxIterations: number;
  // Context settings
  contextStrategy: string;
  maxContextTokens: number;
  responseReserve: number;
  // Working Memory settings (renamed from 'memory' for NextGen clarity)
  workingMemoryEnabled: boolean;
  maxMemorySizeBytes: number;
  maxMemoryIndexEntries: number;
  memorySoftLimitPercent: number;
  contextAllocationPercent: number;
  // In-context memory
  inContextMemoryEnabled: boolean;
  maxInContextEntries: number;
  maxInContextTokens: number;
  // Persistent instructions
  persistentInstructionsEnabled: boolean;
  // Tool permissions
  permissionsEnabled: boolean;
  // Selected tools
  tools: string[];
  // MCP servers (optional)
  mcpServers?: AgentMCPServerRef[];
  // Metadata
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  isActive: boolean;

  // DEPRECATED - kept for backward compatibility with old stored configs
  /** @deprecated Not used in NextGen */
  historyEnabled?: boolean;
  /** @deprecated Not used in NextGen */
  maxHistoryMessages?: number;
  /** @deprecated Not used in NextGen */
  preserveRecent?: number;
  /** @deprecated Not used in NextGen - use ToolManager cache instead */
  cacheEnabled?: boolean;
  /** @deprecated Not used in NextGen */
  cacheTtlMs?: number;
  /** @deprecated Not used in NextGen */
  cacheMaxEntries?: number;
}

/**
 * API Service Connector (for tools like web_search, web_scrape)
 */
export interface StoredAPIConnectorConfig {
  name: string;
  serviceType: string; // e.g., 'serper', 'brave-search', 'zenrows'
  displayName?: string;
  auth: {
    type: 'api_key';
    apiKey: string;
    headerName?: string;
    headerPrefix?: string;
  };
  baseURL?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Universal Connector - connector created from vendor template
 */
export interface StoredUniversalConnector {
  /** User-chosen connector name (e.g., 'my-github') */
  name: string;
  /** Vendor template ID (e.g., 'github') */
  vendorId: string;
  /** Vendor display name (e.g., 'GitHub') */
  vendorName: string;
  /** Auth method ID from template (e.g., 'pat') */
  authMethodId: string;
  /** Auth method display name (e.g., 'Personal Access Token') */
  authMethodName: string;
  /** Stored credentials (keys match AuthTemplate.requiredFields) */
  credentials: Record<string, string>;
  /** User's custom display name */
  displayName?: string;
  /** Override base URL if needed */
  baseURL?: string;
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  lastTestedAt?: number;
  /** Connection status */
  status: 'active' | 'error' | 'untested';
  /** For migrated connectors - original serviceType for tool compatibility */
  legacyServiceType?: string;
}

/**
 * Input for creating a universal connector
 */
export interface CreateUniversalConnectorInput {
  name: string;
  vendorId: string;
  authMethodId: string;
  credentials: Record<string, string>;
  displayName?: string;
  baseURL?: string;
}

// ============ MCP Server Types ============

/**
 * Stored MCP Server Configuration
 */
export interface StoredMCPServerConfig {
  /** Unique server name (used as registry key) */
  name: string;
  /** User-friendly display name */
  displayName?: string;
  /** Server description */
  description?: string;
  /** Transport type */
  transport: 'stdio' | 'http' | 'https';
  /** Transport-specific configuration */
  transportConfig: {
    // Stdio transport
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    // HTTP transport
    url?: string;
    token?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  };
  /** Tool namespace prefix (default: 'mcp:{name}') */
  toolNamespace?: string;
  /**
   * Map environment variable keys to connector names for runtime auth resolution.
   * When connecting, the connector's token will be injected into the env var.
   * Example: { 'GITHUB_PERSONAL_ACCESS_TOKEN': 'my-github-connector' }
   */
  connectorBindings?: Record<string, string>;
  /** Connection status */
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  /** Last error message if status is 'error' */
  lastError?: string;
  /** Number of tools available (when connected) */
  toolCount?: number;
  /** List of available tools (when connected) */
  availableTools?: string[];
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  lastConnectedAt?: number;
}

/**
 * MCP server reference for agent configuration
 */
export interface AgentMCPServerRef {
  /** Server name (references StoredMCPServerConfig.name) */
  serverName: string;
  /** Optional: only use these tools from the server (if not specified, all tools are used) */
  selectedTools?: string[];
}

/**
 * Input for creating an MCP server configuration
 */
export interface CreateMCPServerInput {
  name: string;
  displayName?: string;
  description?: string;
  transport: 'stdio' | 'http' | 'https';
  transportConfig: StoredMCPServerConfig['transportConfig'];
  toolNamespace?: string;
  /** Map environment variable keys to connector names for runtime auth resolution */
  connectorBindings?: Record<string, string>;
}

interface HoseaConfig {
  activeConnector: string | null;
  activeModel: string | null;
  logLevel: LogLevel;
  ui: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    streamResponses: boolean;
  };
}

/**
 * Task interface for plan display
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
 * Plan interface for plan display
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
  | { type: 'needs:approval'; plan: Plan }
  // Dynamic UI events (from tool execution plugins)
  | { type: 'ui:set_dynamic_content'; content: DynamicUIContent };

/**
 * HOSEA UI Capabilities System Prompt
 *
 * This is automatically prepended to all agent instructions to inform them
 * about the rich markdown rendering capabilities available in the UI.
 */
const HOSEA_UI_CAPABILITIES_PROMPT = `
## HOSEA UI Rendering Capabilities

You are running inside HOSEA, a desktop chat interface with advanced markdown rendering. Your responses will be displayed with rich formatting. Use these capabilities to provide better, more visual responses:

### Basic Markdown
- **Bold**, *italic*, ~~strikethrough~~, \`inline code\`
- Headers (# ## ###), lists, blockquotes, links, images
- Tables (GitHub Flavored Markdown)

### Code Blocks
Use fenced code blocks with language identifiers for syntax highlighting:
\`\`\`python
def hello():
    print("Hello!")
\`\`\`

### Mathematical Formulas (LaTeX/KaTeX)
- Inline math: $E = mc^2$
- Block math:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

### Mermaid Diagrams
Create flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, and more:
\`\`\`mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`

### Vega-Lite Charts
Create interactive data visualizations (bar charts, line charts, scatter plots, etc.):
\`\`\`vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple bar chart",
  "data": {
    "values": [
      {"category": "A", "value": 28},
      {"category": "B", "value": 55},
      {"category": "C", "value": 43}
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": {"field": "category", "type": "nominal"},
    "y": {"field": "value", "type": "quantitative"}
  }
}
\`\`\`

### Mindmaps (Markmap)
Create interactive mindmaps from markdown hierarchies:
\`\`\`markmap
# Central Topic
## Branch 1
### Sub-item 1.1
### Sub-item 1.2
## Branch 2
### Sub-item 2.1
## Branch 3
\`\`\`

### Best Practices
1. Use diagrams and charts when explaining complex concepts, processes, or data
2. Use tables for comparing options or presenting structured data
3. Use code blocks with proper language tags for any code
4. Use math notation for formulas and equations
5. Use mindmaps for brainstorming or showing hierarchical relationships
6. Keep visualizations simple and focused on the key message

---
`;

const DEFAULT_CONFIG: HoseaConfig = {
  activeConnector: null,
  activeModel: null,
  logLevel: 'info',
  ui: {
    theme: 'system',
    fontSize: 14,
    streamResponses: true,
  },
};

/**
 * Agent instance for multi-tab support
 * Each tab has its own agent instance with independent state
 */
export interface AgentInstance {
  instanceId: string;
  agentConfigId: string;
  agent: Agent; // Only Agent type in NextGen
  sessionStorage: IContextStorage;
  createdAt: number;
}

/** Maximum concurrent agent instances (memory limit) */
const MAX_INSTANCES = 10;

export class AgentService {
  private dataDir: string;
  private isDev: boolean;
  private agent: Agent | null = null;
  private config: HoseaConfig = DEFAULT_CONFIG;
  private connectors: Map<string, StoredConnectorConfig> = new Map();
  private apiConnectors: Map<string, StoredAPIConnectorConfig> = new Map();
  private universalConnectors: Map<string, StoredUniversalConnector> = new Map();
  private agents: Map<string, StoredAgentConfig> = new Map();
  private sessionStorage: IContextStorage | null = null;
  private agentDefinitionStorage: IAgentDefinitionStorage;
  // Active video generation jobs (jobId -> { connectorName, videoGen })
  private activeVideoJobs: Map<string, { connectorName: string; videoGen: VideoGeneration }> = new Map();
  // MCP servers storage
  private mcpServers: Map<string, StoredMCPServerConfig> = new Map();
  // Multi-tab agent instances (instanceId -> AgentInstance)
  private instances: Map<string, AgentInstance> = new Map();
  // Browser service reference (set by main process)
  private browserService: BrowserService | null = null;
  // Unified tool catalog (combines oneringai + hosea tools)
  private toolCatalog: UnifiedToolCatalog;
  private browserToolProvider: BrowserToolProvider;
  // Stream emitter for sending chunks to renderer (set by main process)
  private streamEmitter: ((instanceId: string, chunk: StreamChunk) => void) | null = null;
  // Compaction event log (last N events for each instance/agent)
  private compactionLogs: Map<string, Array<{ timestamp: number; tokensToFree: number; message: string }>> = new Map();
  private readonly MAX_COMPACTION_LOG_ENTRIES = 20;

  // ============ Conversion Helpers ============

  /**
   * Convert Hosea's StoredAgentConfig to library's StoredAgentDefinition
   */
  private toStoredDefinition(config: StoredAgentConfig): StoredAgentDefinition {
    return {
      version: 1,
      agentId: config.id,
      name: config.name,
      agentType: 'agent', // Always 'agent' in NextGen (no other types)
      createdAt: new Date(config.createdAt).toISOString(),
      updatedAt: new Date(config.updatedAt).toISOString(),
      connector: {
        name: config.connector,
        model: config.model,
      },
      instructions: config.instructions,
      features: {
        workingMemory: config.workingMemoryEnabled,
        inContextMemory: config.inContextMemoryEnabled,
        persistentInstructions: config.persistentInstructionsEnabled,
        // Note: history and permissions are Hosea-specific, not part of NextGen ContextFeatures
        // They are stored in typeConfig instead
      },
      // Store all Hosea-specific settings in typeConfig
      typeConfig: {
        temperature: config.temperature,
        contextStrategy: config.contextStrategy,
        maxContextTokens: config.maxContextTokens,
        responseReserve: config.responseReserve,
        maxMemorySizeBytes: config.maxMemorySizeBytes,
        maxMemoryIndexEntries: config.maxMemoryIndexEntries,
        memorySoftLimitPercent: config.memorySoftLimitPercent,
        contextAllocationPercent: config.contextAllocationPercent,
        maxInContextEntries: config.maxInContextEntries,
        maxInContextTokens: config.maxInContextTokens,
        // History and permissions are Hosea-specific features (not in NextGen)
        historyEnabled: config.historyEnabled,
        permissionsEnabled: config.permissionsEnabled,
        maxHistoryMessages: config.maxHistoryMessages,
        preserveRecent: config.preserveRecent,
        cacheTtlMs: config.cacheTtlMs,
        cacheMaxEntries: config.cacheMaxEntries,
        cacheEnabled: config.cacheEnabled,
        tools: config.tools,
        lastUsedAt: config.lastUsedAt,
        isActive: config.isActive,
      },
    };
  }

  /**
   * Convert library's StoredAgentDefinition to Hosea's StoredAgentConfig
   */
  private fromStoredDefinition(definition: StoredAgentDefinition): StoredAgentConfig {
    const typeConfig = definition.typeConfig ?? {};
    const features = definition.features ?? {};

    // Always convert to 'basic' type - all other agent types are deprecated in NextGen
    const agentType: StoredAgentConfig['agentType'] = 'basic';

    // Use stored strategy directly - validation happens at initialization time
    const contextStrategy = (typeConfig.contextStrategy as string) ?? 'default';

    // Handle backward compatibility for feature names:
    // Old stored definitions use 'memory', new ones use 'workingMemory'
    const workingMemoryEnabled = Boolean(features.workingMemory ?? (features as Record<string, unknown>).memory ?? true);

    return {
      id: definition.agentId,
      name: definition.name,
      connector: definition.connector.name,
      model: definition.connector.model,
      agentType,
      instructions: definition.instructions ?? '',
      temperature: (typeConfig.temperature as number) ?? 0.7,
      maxIterations: (typeConfig.maxIterations as number) ?? 50,
      contextStrategy,
      maxContextTokens: (typeConfig.maxContextTokens as number) ?? 128000,
      responseReserve: (typeConfig.responseReserve as number) ?? 4096,
      workingMemoryEnabled,
      maxMemorySizeBytes: (typeConfig.maxMemorySizeBytes as number) ?? 25 * 1024 * 1024,
      maxMemoryIndexEntries: (typeConfig.maxMemoryIndexEntries as number) ?? 30,
      memorySoftLimitPercent: (typeConfig.memorySoftLimitPercent as number) ?? 80,
      contextAllocationPercent: (typeConfig.contextAllocationPercent as number) ?? 10,
      inContextMemoryEnabled: features.inContextMemory ?? false,
      maxInContextEntries: (typeConfig.maxInContextEntries as number) ?? 20,
      maxInContextTokens: (typeConfig.maxInContextTokens as number) ?? 4000,
      persistentInstructionsEnabled: features.persistentInstructions ?? false,
      permissionsEnabled: (typeConfig.permissionsEnabled as boolean) ?? true,
      tools: (typeConfig.tools as string[]) ?? [],
      createdAt: new Date(definition.createdAt).getTime(),
      updatedAt: new Date(definition.updatedAt).getTime(),
      lastUsedAt: typeConfig.lastUsedAt as number | undefined,
      isActive: (typeConfig.isActive as boolean) ?? false,
    };
  }

  /**
   * Private constructor - use AgentService.create() instead
   */
  private constructor(dataDir: string, isDev: boolean = false) {
    this.dataDir = dataDir;
    this.isDev = isDev;

    // Initialize agent definition storage using library's FileAgentDefinitionStorage
    // This stores agents at ~/.everworker/hosea/ (using dataDir's parent as base)
    this.agentDefinitionStorage = new FileAgentDefinitionStorage({
      baseDirectory: this.dataDir,
    });

    // Initialize UnifiedToolCatalog with providers
    this.toolCatalog = new UnifiedToolCatalog();

    // Register OneRing tools (from @everworker/oneringai library)
    const oneRingProvider = new OneRingToolProvider();
    this.toolCatalog.registerProvider(oneRingProvider);

    // Register Browser tools provider (tools will be available once BrowserService is set)
    this.browserToolProvider = new BrowserToolProvider();
    this.toolCatalog.registerProvider(this.browserToolProvider);
  }

  /**
   * Factory method to create and initialize AgentService
   * This ensures all async initialization completes before the service is used
   */
  static async create(dataDir: string, isDev: boolean = false): Promise<AgentService> {
    const service = new AgentService(dataDir, isDev);
    await service.initializeService();
    return service;
  }

  /**
   * Async initialization - loads all config, connectors, and agents
   */
  private async initializeService(): Promise<void> {
    await this.ensureDirectories();
    await this.loadConfig();
    await this.loadConnectors();
    await this.loadAPIConnectors();
    await this.loadUniversalConnectors();
    await this.migrateAPIConnectorsToUniversal();
    await this.loadAgents();
    await this.migrateAgentsToNextGen(); // Migrate existing agents to NextGen format
    await this.loadMCPServers();
    this.initializeLogLevel();
  }

  /**
   * Initialize log level based on config or dev mode
   */
  private initializeLogLevel(): void {
    // In dev mode, default to debug unless explicitly set otherwise
    const effectiveLevel = this.isDev && this.config.logLevel === 'info'
      ? 'debug'
      : this.config.logLevel;

    logger.updateConfig({ level: effectiveLevel });
    console.log(`Log level set to: ${effectiveLevel}${this.isDev ? ' (dev mode)' : ''}`);
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = ['connectors', 'api-connectors', 'universal-connectors', 'agents', 'sessions', 'logs', 'mcp-servers'];
    for (const dir of dirs) {
      const path = join(this.dataDir, dir);
      if (!existsSync(path)) {
        await mkdir(path, { recursive: true });
      }
    }
  }

  private async loadConfig(): Promise<void> {
    const configPath = join(this.dataDir, 'config.json');
    if (existsSync(configPath)) {
      try {
        const content = await readFile(configPath, 'utf-8');
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
      } catch {
        // Use defaults
      }
    }
  }

  private async saveConfigFile(): Promise<void> {
    const configPath = join(this.dataDir, 'config.json');
    await writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  private async loadConnectors(): Promise<void> {
    const connectorsDir = join(this.dataDir, 'connectors');
    if (!existsSync(connectorsDir)) return;

    try {
      const files = await readdir(connectorsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(connectorsDir, file), 'utf-8');
          const config = JSON.parse(content) as StoredConnectorConfig;
          this.connectors.set(config.name, config);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private async loadAPIConnectors(): Promise<void> {
    const apiConnectorsDir = join(this.dataDir, 'api-connectors');
    if (!existsSync(apiConnectorsDir)) return;

    try {
      const files = await readdir(apiConnectorsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(apiConnectorsDir, file), 'utf-8');
          const config = JSON.parse(content) as StoredAPIConnectorConfig;
          this.apiConnectors.set(config.name, config);

          // Register with the library if not already registered
          if (!Connector.has(config.name)) {
            Connector.create({
              name: config.name,
              serviceType: config.serviceType,
              auth: config.auth,
              baseURL: config.baseURL,
            });
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private async loadAgents(): Promise<void> {
    try {
      // First, check for legacy agents in old format and migrate them
      await this.migrateLegacyAgents();

      // Load agents from the library's storage
      const summaries = await this.agentDefinitionStorage.list();
      for (const summary of summaries) {
        const definition = await this.agentDefinitionStorage.load(summary.agentId);
        if (definition) {
          const config = this.fromStoredDefinition(definition);
          this.agents.set(config.id, config);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Migrate legacy agents from old format (direct JSON files) to new storage
   */
  private async migrateLegacyAgents(): Promise<void> {
    const legacyAgentsDir = join(this.dataDir, 'agents');
    if (!existsSync(legacyAgentsDir)) return;

    try {
      const files = await readdir(legacyAgentsDir);
      for (const file of files) {
        // Skip non-JSON files and index files
        if (!file.endsWith('.json') || file.startsWith('_')) continue;

        const filePath = join(legacyAgentsDir, file);
        const content = await readFile(filePath, 'utf-8');
        const legacyConfig = JSON.parse(content) as StoredAgentConfig;

        // Check if this agent already exists in new storage
        const exists = await this.agentDefinitionStorage.exists(legacyConfig.id);
        if (!exists) {
          // Migrate to new storage
          const definition = this.toStoredDefinition(legacyConfig);
          await this.agentDefinitionStorage.save(definition);
          console.log(`Migrated legacy agent: ${legacyConfig.name} (${legacyConfig.id})`);
        }

        // Delete the legacy file after successful migration
        const { unlink } = await import('node:fs/promises');
        await unlink(filePath);
        console.log(`Deleted legacy agent file: ${file}`);
      }
    } catch (error) {
      console.warn('Error migrating legacy agents:', error);
    }
  }

  /**
   * Migrate existing agents to NextGen format:
   * - Convert all agent types to 'basic'
   * - Migrate legacy strategies not in StrategyRegistry (aggressive→proactive, rolling-window→lazy, adaptive→balanced)
   * - Rename memoryEnabled to workingMemoryEnabled (if needed)
   *
   * Note: Valid strategies from StrategyRegistry are preserved as-is. Only truly legacy
   * strategies that don't exist in the registry are migrated.
   */
  private async migrateAgentsToNextGen(): Promise<void> {
    try {
      for (const [id, config] of this.agents.entries()) {
        let needsSave = false;
        const updates: Partial<StoredAgentConfig> = {};

        // Convert agent type to 'basic' if it was something else
        if (config.agentType !== 'basic') {
          updates.agentType = 'basic';
          needsSave = true;
          console.log(`NextGen migration: Converted agent "${config.name}" from "${config.agentType}" to "basic"`);
        }

        // Validate strategy exists in registry - only migrate if truly invalid
        const { strategy: validatedStrategy, isValid } = validateStrategy(config.contextStrategy);
        if (!isValid) {
          // Map legacy strategies to reasonable NextGen equivalents
          const legacyMapping: Record<string, string> = {
            'aggressive': 'proactive',
            'rolling-window': 'lazy',
            'adaptive': 'balanced',
          };
          const mappedStrategy = legacyMapping[config.contextStrategy] ?? 'default';
          updates.contextStrategy = mappedStrategy;
          needsSave = true;
          console.log(`NextGen migration: Converted agent "${config.name}" strategy from "${config.contextStrategy}" to "${mappedStrategy}" (original strategy not found in registry)`);
        }

        // Handle legacy memoryEnabled field if present (backwards compatibility)
        const legacyConfig = config as unknown as Record<string, unknown>;
        if ('memoryEnabled' in legacyConfig && !('workingMemoryEnabled' in legacyConfig)) {
          updates.workingMemoryEnabled = legacyConfig.memoryEnabled as boolean;
          needsSave = true;
          console.log(`NextGen migration: Renamed memoryEnabled to workingMemoryEnabled for agent "${config.name}"`);
        }

        // Save if any changes were made
        if (needsSave) {
          const updatedConfig = { ...config, ...updates, updatedAt: Date.now() };
          this.agents.set(id, updatedConfig);
          // Persist to storage
          const definition = this.toStoredDefinition(updatedConfig);
          await this.agentDefinitionStorage.save(definition);
        }
      }
    } catch (error) {
      console.warn('Error during NextGen agent migration:', error);
    }
  }

  /**
   * Subscribe to context events for monitoring (compaction, budget updates)
   */
  private subscribeToContextEvents(agent: Agent, instanceId: string): void {
    const ctx = agent.context;
    if (!ctx) return;

    // Initialize compaction log for this instance
    if (!this.compactionLogs.has(instanceId)) {
      this.compactionLogs.set(instanceId, []);
    }
    const log = this.compactionLogs.get(instanceId)!;

    // Subscribe to compaction:starting event
    ctx.on('compaction:starting', ({ timestamp, targetTokensToFree }) => {
      log.push({
        timestamp,
        tokensToFree: targetTokensToFree,
        message: `Compaction starting: need to free ~${targetTokensToFree} tokens`,
      });
      // Keep only last N entries
      while (log.length > this.MAX_COMPACTION_LOG_ENTRIES) {
        log.shift();
      }
    });

    // Subscribe to context:compacted event
    ctx.on('context:compacted', ({ tokensFreed, log: compactionLog }) => {
      log.push({
        timestamp: Date.now(),
        tokensToFree: tokensFreed,
        message: `Compaction complete: freed ${tokensFreed} tokens`,
      });
      // Keep only last N entries
      while (log.length > this.MAX_COMPACTION_LOG_ENTRIES) {
        log.shift();
      }
    });
  }

  async initialize(connectorName: string, model: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get connector config
      const connectorConfig = this.connectors.get(connectorName);
      if (!connectorConfig) {
        return { success: false, error: `Connector "${connectorName}" not found` };
      }

      // Register with library if not already
      if (!Connector.has(connectorName)) {
        Connector.create({
          name: connectorName,
          vendor: connectorConfig.vendor as Vendor,
          auth: connectorConfig.auth,
          baseURL: connectorConfig.baseURL,
        });
      }

      // Destroy existing agent
      this.agent?.destroy();

      // Initialize session storage using new FileContextStorage
      // This stores sessions at ~/.everworker/hosea/sessions/
      this.sessionStorage = new FileContextStorage({
        agentId: 'hosea',
        baseDirectory: join(this.dataDir, '..'),
      });

      // Create agent with UI capabilities prompt (NextGen)
      const agentConfig: AgentConfig = {
        connector: connectorName,
        model,
        instructions: HOSEA_UI_CAPABILITIES_PROMPT,
        context: {
          model,
          storage: this.sessionStorage,
        },
      };

      this.agent = Agent.create(agentConfig);

      // Subscribe to context events for monitoring
      this.subscribeToContextEvents(this.agent, 'default');

      // Update config
      this.config.activeConnector = connectorName;
      this.config.activeModel = model;
      await this.saveConfigFile();

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async send(message: string): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!this.agent) {
      return { success: false, error: 'Agent not initialized' };
    }

    try {
      // NextGen uses run() instead of chat()
      const response = await this.agent.run(message);
      return { success: true, response: response.output_text || '' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async *stream(message: string): AsyncGenerator<StreamChunk> {
    if (!this.agent) {
      yield { type: 'error', content: 'Agent not initialized' };
      return;
    }

    // Track when we're in plan creation mode to suppress text output
    // (since we show structured PlanDisplay instead of plain text)
    let suppressText = false;

    try {
      for await (const event of this.agent.stream(message)) {
        // Cast through unknown to any for flexible event handling
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = event as any;

        // Detect plan mode transitions to control text suppression
        if (e.type === 'plan:analyzing' || e.type === 'plan:created') {
          suppressText = true;
        } else if (e.type === 'plan:approved' || e.type === 'mode:changed') {
          // Resume text when plan is approved or mode changes
          if (e.type === 'mode:changed' && e.to === 'executing') {
            // Keep suppressing during execution - task events will show progress
          } else if (e.type === 'mode:changed' && e.to === 'interactive') {
            suppressText = false;
          } else if (e.type === 'plan:approved') {
            // Suppress during execution, resume when we get results
          }
        } else if (e.type === 'execution:done') {
          // Resume text after execution completes
          suppressText = false;
        }

        if (e.type === 'text:delta') {
          // Only forward text if we're not in plan mode
          if (!suppressText) {
            yield { type: 'text', content: String(e.delta || '') };
          }
        } else if (e.type === 'tool:start') {
          // Get tool description using describeCall or defaultDescribeCall
          const args = (e.args || {}) as Record<string, unknown>;
          const toolName = String(e.name || 'unknown');
          const tool = this.agent?.tools?.get(toolName);
          let description = '';
          if (tool?.describeCall) {
            try {
              description = tool.describeCall(args);
            } catch {
              description = defaultDescribeCall(args);
            }
          } else {
            description = defaultDescribeCall(args);
          }

          yield {
            type: 'tool_start',
            tool: toolName,
            args,
            description,
          };
        } else if (e.type === 'tool:complete') {
          yield {
            type: 'tool_end',
            tool: String(e.name || 'unknown'),
            durationMs: typeof e.durationMs === 'number' ? e.durationMs : undefined,
          };
        } else if (e.type === 'tool:error') {
          yield {
            type: 'tool_error',
            tool: String(e.name || 'unknown'),
            error: String(e.error || 'Unknown error'),
          };
        } else if (e.type === 'text:done') {
          yield { type: 'done' };
        } else if (e.type === 'error') {
          yield { type: 'error', content: String(e.error || e.message || 'Unknown error') };
        }
        // Plan events (legacy - may not be emitted in NextGen)
        else if (e.type === 'plan:created') {
          yield { type: 'plan:created', plan: this.serializePlan((e as any).plan) };
        } else if (e.type === 'plan:awaiting_approval') {
          yield { type: 'plan:awaiting_approval', plan: this.serializePlan((e as any).plan) };
        } else if (e.type === 'plan:approved') {
          yield { type: 'plan:approved', plan: this.serializePlan((e as any).plan) };
        } else if (e.type === 'plan:analyzing') {
          yield { type: 'plan:analyzing', goal: (e as any).goal };
        } else if (e.type === 'mode:changed') {
          yield { type: 'mode:changed', from: (e as any).from, to: (e as any).to, reason: (e as any).reason };
        } else if (e.type === 'needs:approval') {
          yield { type: 'needs:approval', plan: this.serializePlan((e as any).plan) };
        }
        // Task events
        else if (e.type === 'task:started') {
          yield { type: 'task:started', task: this.serializeTask((e as any).task) };
        } else if (e.type === 'task:progress') {
          yield { type: 'task:progress', task: this.serializeTask((e as any).task), status: (e as any).status };
        } else if (e.type === 'task:completed') {
          yield { type: 'task:completed', task: this.serializeTask((e as any).task), result: (e as any).result };
        } else if (e.type === 'task:failed') {
          yield { type: 'task:failed', task: this.serializeTask((e as any).task), error: (e as any).error };
        }
        // Execution events
        else if (e.type === 'execution:done') {
          yield { type: 'execution:done', result: (e as any).result };
        } else if (e.type === 'execution:paused') {
          yield { type: 'execution:paused', reason: (e as any).reason };
        }
      }
    } catch (error) {
      yield { type: 'error', content: String(error) };
    }
  }

  /**
   * Serialize a Plan for IPC transfer
   */
  private serializePlan(plan: any): Plan {
    return {
      id: plan.id,
      goal: plan.goal,
      context: plan.context,
      tasks: plan.tasks?.map((t: any) => this.serializeTask(t)) || [],
      status: plan.status,
      createdAt: plan.createdAt,
      startedAt: plan.startedAt,
      completedAt: plan.completedAt,
    };
  }

  /**
   * Serialize a Task for IPC transfer
   */
  private serializeTask(task: any): PlanTask {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      dependsOn: task.dependsOn || [],
      validation: task.validation ? {
        completionCriteria: task.validation.completionCriteria,
      } : undefined,
      result: task.result,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    };
  }

  /**
   * Approve the current pending plan
   */
  async approvePlan(_planId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.agent) {
      return { success: false, error: 'Agent not initialized' };
    }
    // Agent accepts approval via stream - send approval message
    // This will be picked up by the agent's intent analysis as an approval
    try {
      // Return success - the actual approval happens via stream when user sends approval message
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Reject the current pending plan
   */
  async rejectPlan(_planId: string, _reason?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.agent) {
      return { success: false, error: 'Agent not initialized' };
    }
    try {
      // Return success - the actual rejection happens via stream when user sends rejection message
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  cancel(): { success: boolean } {
    if (this.agent) {
      this.agent.cancel();
    }
    return { success: true };
  }

  getStatus(): {
    initialized: boolean;
    connector: string | null;
    model: string | null;
    mode: string | null;
  } {
    return {
      initialized: this.agent !== null,
      connector: this.config.activeConnector,
      model: this.config.activeModel,
      // Mode concept removed in NextGen (was UniversalAgent-specific)
      mode: null,
    };
  }

  listConnectors(): StoredConnectorConfig[] {
    return Array.from(this.connectors.values());
  }

  async addConnector(config: unknown): Promise<{ success: boolean; error?: string }> {
    try {
      const connectorConfig = config as StoredConnectorConfig;
      connectorConfig.createdAt = Date.now();
      connectorConfig.updatedAt = Date.now();

      this.connectors.set(connectorConfig.name, connectorConfig);

      // Save to file
      const filePath = join(this.dataDir, 'connectors', `${connectorConfig.name}.json`);
      await writeFile(filePath, JSON.stringify(connectorConfig, null, 2));

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteConnector(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connectors.has(name)) {
        return { success: false, error: `Connector "${name}" not found` };
      }

      this.connectors.delete(name);

      // Remove from library
      if (Connector.has(name)) {
        Connector.remove(name);
      }

      // Delete file
      const filePath = join(this.dataDir, 'connectors', `${name}.json`);
      if (existsSync(filePath)) {
        const { unlink } = await import('node:fs/promises');
        await unlink(filePath);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============ API Connectors (for tools like web_search, web_scrape) ============

  listAPIConnectors(): StoredAPIConnectorConfig[] {
    return Array.from(this.apiConnectors.values());
  }

  getAPIConnectorsByServiceType(serviceType: string): StoredAPIConnectorConfig[] {
    return Array.from(this.apiConnectors.values()).filter(
      (c) => c.serviceType === serviceType
    );
  }

  async addAPIConnector(config: unknown): Promise<{ success: boolean; error?: string }> {
    try {
      const apiConfig = config as StoredAPIConnectorConfig;
      apiConfig.createdAt = Date.now();
      apiConfig.updatedAt = Date.now();

      // Store in memory
      this.apiConnectors.set(apiConfig.name, apiConfig);

      // Register with the library
      if (Connector.has(apiConfig.name)) {
        Connector.remove(apiConfig.name);
      }
      Connector.create({
        name: apiConfig.name,
        serviceType: apiConfig.serviceType,
        auth: apiConfig.auth,
        baseURL: apiConfig.baseURL,
      });

      // Save to file
      const filePath = join(this.dataDir, 'api-connectors', `${apiConfig.name}.json`);
      await writeFile(filePath, JSON.stringify(apiConfig, null, 2));

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateAPIConnector(name: string, updates: Partial<StoredAPIConnectorConfig>): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = this.apiConnectors.get(name);
      if (!existing) {
        return { success: false, error: `API connector "${name}" not found` };
      }

      const updated = { ...existing, ...updates, updatedAt: Date.now() };
      this.apiConnectors.set(name, updated);

      // Re-register with the library
      if (Connector.has(name)) {
        Connector.remove(name);
      }
      Connector.create({
        name: updated.name,
        serviceType: updated.serviceType,
        auth: updated.auth,
        baseURL: updated.baseURL,
      });

      // Save to file
      const filePath = join(this.dataDir, 'api-connectors', `${name}.json`);
      await writeFile(filePath, JSON.stringify(updated, null, 2));

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteAPIConnector(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.apiConnectors.has(name)) {
        return { success: false, error: `API connector "${name}" not found` };
      }

      this.apiConnectors.delete(name);

      // Remove from library
      if (Connector.has(name)) {
        Connector.remove(name);
      }

      // Delete file
      const filePath = join(this.dataDir, 'api-connectors', `${name}.json`);
      if (existsSync(filePath)) {
        const { unlink } = await import('node:fs/promises');
        await unlink(filePath);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============ Universal Connectors (Vendor Templates) ============

  /**
   * Load universal connectors from storage
   */
  private async loadUniversalConnectors(): Promise<void> {
    const universalConnectorsDir = join(this.dataDir, 'universal-connectors');
    if (!existsSync(universalConnectorsDir)) return;

    try {
      const files = await readdir(universalConnectorsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(universalConnectorsDir, file), 'utf-8');
          const config = JSON.parse(content) as StoredUniversalConnector;
          this.universalConnectors.set(config.name, config);

          // Register with the library using createConnectorFromTemplate
          if (!Connector.has(config.name)) {
            try {
              createConnectorFromTemplate(
                config.name,
                config.vendorId,
                config.authMethodId,
                config.credentials,
                { baseURL: config.baseURL, displayName: config.displayName }
              );
            } catch (error) {
              console.warn(`Failed to register universal connector ${config.name}:`, error);
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Migrate existing API connectors to universal connectors format
   */
  private async migrateAPIConnectorsToUniversal(): Promise<void> {
    // Map old serviceType to vendor template IDs
    const LEGACY_SERVICE_MAP: Record<string, { vendorId: string; authMethodId: string }> = {
      'serper': { vendorId: 'serper', authMethodId: 'api-key' },
      'brave-search': { vendorId: 'brave-search', authMethodId: 'api-key' },
      'tavily': { vendorId: 'tavily', authMethodId: 'api-key' },
      'rapidapi-websearch': { vendorId: 'rapidapi', authMethodId: 'api-key' },
      'zenrows': { vendorId: 'zenrows', authMethodId: 'api-key' },
    };

    const apiConnectorsDir = join(this.dataDir, 'api-connectors');
    if (!existsSync(apiConnectorsDir)) return;

    try {
      const files = await readdir(apiConnectorsDir);
      for (const file of files) {
        // Skip already-migrated files
        if (!file.endsWith('.json') || file.endsWith('.migrated.json')) continue;

        const filePath = join(apiConnectorsDir, file);
        const content = await readFile(filePath, 'utf-8');
        const apiConfig = JSON.parse(content) as StoredAPIConnectorConfig;

        const mapping = LEGACY_SERVICE_MAP[apiConfig.serviceType];
        if (!mapping) {
          console.warn(`No migration mapping for service type: ${apiConfig.serviceType}`);
          continue;
        }

        // Check if already migrated (universal connector exists)
        if (this.universalConnectors.has(apiConfig.name)) {
          continue;
        }

        // Get vendor info
        const vendorInfo = getVendorInfo(mapping.vendorId);
        const authMethod = getVendorAuthTemplate(mapping.vendorId, mapping.authMethodId);

        if (!vendorInfo || !authMethod) {
          console.warn(`Vendor template not found for: ${mapping.vendorId}/${mapping.authMethodId}`);
          continue;
        }

        // Create universal connector
        const universalConfig: StoredUniversalConnector = {
          name: apiConfig.name,
          vendorId: mapping.vendorId,
          vendorName: vendorInfo.name,
          authMethodId: mapping.authMethodId,
          authMethodName: authMethod.name,
          credentials: { apiKey: apiConfig.auth.apiKey },
          displayName: apiConfig.displayName,
          baseURL: apiConfig.baseURL,
          createdAt: apiConfig.createdAt,
          updatedAt: Date.now(),
          status: 'active',
          legacyServiceType: apiConfig.serviceType,
        };

        // Save universal connector
        this.universalConnectors.set(universalConfig.name, universalConfig);
        const universalPath = join(this.dataDir, 'universal-connectors', `${universalConfig.name}.json`);
        await writeFile(universalPath, JSON.stringify(universalConfig, null, 2));

        // Register with library
        try {
          createConnectorFromTemplate(
            universalConfig.name,
            universalConfig.vendorId,
            universalConfig.authMethodId,
            universalConfig.credentials,
            { baseURL: universalConfig.baseURL, displayName: universalConfig.displayName }
          );
        } catch (error) {
          console.warn(`Failed to register migrated connector ${universalConfig.name}:`, error);
        }

        // Rename old file to .migrated.json
        const { rename } = await import('node:fs/promises');
        await rename(filePath, filePath.replace('.json', '.migrated.json'));
        console.log(`Migrated API connector: ${apiConfig.name}`);
      }
    } catch (error) {
      console.warn('Error migrating API connectors:', error);
    }
  }

  // ============ Vendor Template Access (read-only from library) ============

  /**
   * List all vendor templates
   */
  listVendorTemplates(): VendorInfo[] {
    return listVendorTemplates();
  }

  /**
   * Get vendor template by ID
   */
  getVendorTemplateById(vendorId: string): VendorInfo | undefined {
    return getVendorInfo(vendorId);
  }

  /**
   * Get full vendor template (with auth templates)
   */
  getFullVendorTemplate(vendorId: string): VendorTemplate | undefined {
    return getVendorTemplate(vendorId);
  }

  /**
   * Get vendor logo
   */
  getVendorLogoById(vendorId: string): VendorLogo | undefined {
    return getVendorLogo(vendorId);
  }

  /**
   * Get all unique vendor categories
   */
  getVendorCategories(): string[] {
    const templates = listVendorTemplates();
    return [...new Set(templates.map(t => t.category))].sort();
  }

  /**
   * Get vendors by category
   */
  getVendorsByCategory(category: string): VendorInfo[] {
    return listVendorsByCategory(category);
  }

  // ============ Universal Connector CRUD ============

  /**
   * List all universal connectors
   */
  listUniversalConnectors(): StoredUniversalConnector[] {
    return Array.from(this.universalConnectors.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get universal connector by name
   */
  getUniversalConnector(name: string): StoredUniversalConnector | null {
    return this.universalConnectors.get(name) || null;
  }

  /**
   * Create a universal connector from vendor template
   */
  async createUniversalConnector(input: CreateUniversalConnectorInput): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate vendor template exists
      const vendorInfo = getVendorInfo(input.vendorId);
      if (!vendorInfo) {
        return { success: false, error: `Unknown vendor: ${input.vendorId}` };
      }

      const authMethod = getVendorAuthTemplate(input.vendorId, input.authMethodId);
      if (!authMethod) {
        return { success: false, error: `Unknown auth method: ${input.authMethodId} for vendor ${input.vendorId}` };
      }

      // Check for duplicate name
      if (this.universalConnectors.has(input.name) || Connector.has(input.name)) {
        return { success: false, error: `Connector "${input.name}" already exists` };
      }

      // Create connector with library
      try {
        createConnectorFromTemplate(
          input.name,
          input.vendorId,
          input.authMethodId,
          input.credentials,
          { baseURL: input.baseURL, displayName: input.displayName }
        );
      } catch (error) {
        return { success: false, error: `Failed to create connector: ${error}` };
      }

      // Build stored config
      const config: StoredUniversalConnector = {
        name: input.name,
        vendorId: input.vendorId,
        vendorName: vendorInfo.name,
        authMethodId: input.authMethodId,
        authMethodName: authMethod.name,
        credentials: input.credentials,
        displayName: input.displayName,
        baseURL: input.baseURL,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'untested',
      };

      // Store in memory
      this.universalConnectors.set(input.name, config);

      // Save to file
      const filePath = join(this.dataDir, 'universal-connectors', `${input.name}.json`);
      await writeFile(filePath, JSON.stringify(config, null, 2));

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update a universal connector
   */
  async updateUniversalConnector(name: string, updates: Partial<Omit<StoredUniversalConnector, 'name' | 'vendorId' | 'vendorName' | 'authMethodId' | 'authMethodName' | 'createdAt'>>): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = this.universalConnectors.get(name);
      if (!existing) {
        return { success: false, error: `Universal connector "${name}" not found` };
      }

      const updated: StoredUniversalConnector = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
      };

      // If credentials changed, re-register with library
      if (updates.credentials || updates.baseURL) {
        if (Connector.has(name)) {
          Connector.remove(name);
        }
        try {
          createConnectorFromTemplate(
            name,
            existing.vendorId,
            existing.authMethodId,
            updated.credentials,
            { baseURL: updated.baseURL, displayName: updated.displayName }
          );
        } catch (error) {
          return { success: false, error: `Failed to update connector: ${error}` };
        }
      }

      // Store in memory
      this.universalConnectors.set(name, updated);

      // Save to file
      const filePath = join(this.dataDir, 'universal-connectors', `${name}.json`);
      await writeFile(filePath, JSON.stringify(updated, null, 2));

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Delete a universal connector
   */
  async deleteUniversalConnector(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.universalConnectors.has(name)) {
        return { success: false, error: `Universal connector "${name}" not found` };
      }

      this.universalConnectors.delete(name);

      // Remove from library
      if (Connector.has(name)) {
        Connector.remove(name);
      }

      // Delete file
      const filePath = join(this.dataDir, 'universal-connectors', `${name}.json`);
      if (existsSync(filePath)) {
        const { unlink } = await import('node:fs/promises');
        await unlink(filePath);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Test a universal connector connection
   */
  async testUniversalConnection(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const config = this.universalConnectors.get(name);
      if (!config) {
        return { success: false, error: `Universal connector "${name}" not found` };
      }

      // Get connector from library
      const connector = Connector.get(name);
      if (!connector) {
        return { success: false, error: 'Connector not registered with library' };
      }

      // TODO: Implement actual connection testing per vendor
      // For now, just update status to indicate we tried
      config.lastTestedAt = Date.now();
      config.status = 'active';
      this.universalConnectors.set(name, config);

      // Save to file
      const filePath = join(this.dataDir, 'universal-connectors', `${name}.json`);
      await writeFile(filePath, JSON.stringify(config, null, 2));

      return { success: true };
    } catch (error) {
      // Update status to error
      const config = this.universalConnectors.get(name);
      if (config) {
        config.status = 'error';
        config.lastTestedAt = Date.now();
        this.universalConnectors.set(name, config);
      }
      return { success: false, error: String(error) };
    }
  }

  // ============ MCP Server Management ============

  /**
   * Load MCP server configurations from storage
   */
  private async loadMCPServers(): Promise<void> {
    const mcpServersDir = join(this.dataDir, 'mcp-servers');
    if (!existsSync(mcpServersDir)) return;

    try {
      const files = await readdir(mcpServersDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(mcpServersDir, file), 'utf-8');
          const config = JSON.parse(content) as StoredMCPServerConfig;
          // Reset status to disconnected on load (will need to reconnect)
          config.status = 'disconnected';
          this.mcpServers.set(config.name, config);
        }
      }
    } catch (error) {
      console.warn('Error loading MCP servers:', error);
    }
  }

  /**
   * Save MCP server configuration to storage
   */
  private async saveMCPServer(config: StoredMCPServerConfig): Promise<void> {
    const filePath = join(this.dataDir, 'mcp-servers', `${config.name}.json`);
    await writeFile(filePath, JSON.stringify(config, null, 2));
  }

  /**
   * Delete MCP server configuration from storage
   */
  private async deleteMCPServerFile(name: string): Promise<void> {
    const filePath = join(this.dataDir, 'mcp-servers', `${name}.json`);
    if (existsSync(filePath)) {
      const { unlink } = await import('node:fs/promises');
      await unlink(filePath);
    }
  }

  /**
   * List all configured MCP servers
   */
  listMCPServers(): StoredMCPServerConfig[] {
    return Array.from(this.mcpServers.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get a specific MCP server configuration
   */
  getMCPServer(name: string): StoredMCPServerConfig | null {
    return this.mcpServers.get(name) || null;
  }

  /**
   * Create a new MCP server configuration
   */
  async createMCPServer(input: CreateMCPServerInput): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if name already exists
      if (this.mcpServers.has(input.name)) {
        return { success: false, error: `MCP server "${input.name}" already exists` };
      }

      const now = Date.now();
      const config: StoredMCPServerConfig = {
        name: input.name,
        displayName: input.displayName,
        description: input.description,
        transport: input.transport,
        transportConfig: input.transportConfig,
        toolNamespace: input.toolNamespace ?? `mcp:${input.name}`,
        connectorBindings: input.connectorBindings,
        status: 'disconnected',
        createdAt: now,
        updatedAt: now,
      };

      this.mcpServers.set(config.name, config);
      await this.saveMCPServer(config);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update an existing MCP server configuration
   */
  async updateMCPServer(name: string, updates: Partial<Omit<StoredMCPServerConfig, 'name' | 'createdAt'>>): Promise<{ success: boolean; error?: string }> {
    try {
      const config = this.mcpServers.get(name);
      if (!config) {
        return { success: false, error: `MCP server "${name}" not found` };
      }

      // If changing transport config, disconnect first
      if (updates.transport || updates.transportConfig) {
        await this.disconnectMCPServer(name);
      }

      // Apply updates
      const updatedConfig: StoredMCPServerConfig = {
        ...config,
        ...updates,
        name: config.name, // Prevent name change
        createdAt: config.createdAt, // Prevent createdAt change
        updatedAt: Date.now(),
      };

      this.mcpServers.set(name, updatedConfig);
      await this.saveMCPServer(updatedConfig);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Delete an MCP server configuration
   */
  async deleteMCPServer(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.mcpServers.has(name)) {
        return { success: false, error: `MCP server "${name}" not found` };
      }

      // Disconnect if connected
      await this.disconnectMCPServer(name);

      // Remove from registry if registered
      if (MCPRegistry.has(name)) {
        MCPRegistry.remove(name);
      }

      this.mcpServers.delete(name);
      await this.deleteMCPServerFile(name);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Connect to an MCP server
   */
  async connectMCPServer(name: string): Promise<{ success: boolean; tools?: string[]; error?: string }> {
    try {
      const config = this.mcpServers.get(name);
      if (!config) {
        return { success: false, error: `MCP server "${name}" not found` };
      }

      // Update status to connecting
      config.status = 'connecting';
      this.mcpServers.set(name, config);

      // Resolve connector bindings to actual tokens
      const resolvedEnv = { ...config.transportConfig.env };
      if (config.connectorBindings) {
        for (const [envKey, connectorName] of Object.entries(config.connectorBindings)) {
          if (Connector.has(connectorName)) {
            try {
              const connector = Connector.get(connectorName);
              const token = await connector.getToken();
              resolvedEnv[envKey] = token;
              logger.debug(`Resolved connector binding: ${envKey} <- ${connectorName}`);
            } catch (err) {
              logger.warn(`Failed to get token from connector "${connectorName}" for ${envKey}: ${err}`);
              // Continue with existing env value if present
            }
          } else {
            logger.warn(`Connector "${connectorName}" not found for binding ${envKey}`);
          }
        }
      }

      // Build MCPServerConfig for the library
      const mcpConfig: MCPServerConfig = {
        name: config.name,
        displayName: config.displayName,
        description: config.description,
        transport: config.transport,
        transportConfig: config.transport === 'stdio'
          ? {
              command: config.transportConfig.command!,
              args: config.transportConfig.args,
              env: resolvedEnv,
              cwd: config.transportConfig.cwd,
            }
          : {
              url: config.transportConfig.url!,
              token: config.transportConfig.token,
              headers: config.transportConfig.headers,
              timeoutMs: config.transportConfig.timeoutMs,
            },
        toolNamespace: config.toolNamespace,
      };

      // Create or get client from registry
      let client: IMCPClient;
      if (MCPRegistry.has(name)) {
        client = MCPRegistry.get(name);
        if (!client.isConnected()) {
          await client.connect();
        }
      } else {
        client = MCPRegistry.create(mcpConfig);
        await client.connect();
      }

      // Get available tools
      const tools = client.tools.map(t => t.name);

      // Update config with connection info
      config.status = 'connected';
      config.toolCount = tools.length;
      config.availableTools = tools;
      config.lastConnectedAt = Date.now();
      config.lastError = undefined;
      config.updatedAt = Date.now();
      this.mcpServers.set(name, config);
      await this.saveMCPServer(config);

      return { success: true, tools };
    } catch (error) {
      const config = this.mcpServers.get(name);
      if (config) {
        config.status = 'error';
        config.lastError = String(error);
        config.updatedAt = Date.now();
        this.mcpServers.set(name, config);
        await this.saveMCPServer(config);
      }
      return { success: false, error: String(error) };
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectMCPServer(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const config = this.mcpServers.get(name);
      if (!config) {
        return { success: false, error: `MCP server "${name}" not found` };
      }

      // Disconnect if in registry
      if (MCPRegistry.has(name)) {
        const client = MCPRegistry.get(name);
        if (client.isConnected()) {
          await client.disconnect();
        }
      }

      // Update status
      config.status = 'disconnected';
      config.toolCount = undefined;
      config.availableTools = undefined;
      config.updatedAt = Date.now();
      this.mcpServers.set(name, config);
      await this.saveMCPServer(config);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get tools available from an MCP server
   * Returns empty array if not connected
   */
  getMCPServerTools(name: string): Array<{ name: string; description?: string }> {
    if (!MCPRegistry.has(name)) {
      return [];
    }

    const client = MCPRegistry.get(name);
    if (!client.isConnected()) {
      return [];
    }

    return client.tools.map(t => ({
      name: t.name,
      description: t.description,
    }));
  }

  /**
   * Refresh tools list from a connected MCP server
   */
  async refreshMCPServerTools(name: string): Promise<{ success: boolean; tools?: string[]; error?: string }> {
    try {
      if (!MCPRegistry.has(name)) {
        return { success: false, error: `MCP server "${name}" not in registry` };
      }

      const client = MCPRegistry.get(name);
      if (!client.isConnected()) {
        return { success: false, error: `MCP server "${name}" not connected` };
      }

      // Refresh tools list
      await client.listTools();
      const tools = client.tools.map(t => t.name);

      // Update stored config
      const config = this.mcpServers.get(name);
      if (config) {
        config.toolCount = tools.length;
        config.availableTools = tools;
        config.updatedAt = Date.now();
        this.mcpServers.set(name, config);
        await this.saveMCPServer(config);
      }

      return { success: true, tools };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============ Agent Configuration CRUD ============

  listAgents(): StoredAgentConfig[] {
    return Array.from(this.agents.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getAgent(id: string): StoredAgentConfig | null {
    return this.agents.get(id) || null;
  }

  async createAgent(config: Omit<StoredAgentConfig, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();

      const agentConfig: StoredAgentConfig = {
        ...config,
        id,
        createdAt: now,
        updatedAt: now,
        isActive: false,
      };

      this.agents.set(id, agentConfig);

      // Save using library's agent definition storage
      const definition = this.toStoredDefinition(agentConfig);
      await this.agentDefinitionStorage.save(definition);

      return { success: true, id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateAgent(id: string, updates: Partial<StoredAgentConfig>): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = this.agents.get(id);
      if (!existing) {
        return { success: false, error: `Agent "${id}" not found` };
      }

      const updated: StoredAgentConfig = {
        ...existing,
        ...updates,
        id, // Ensure ID cannot be changed
        updatedAt: Date.now(),
      };
      this.agents.set(id, updated);

      // Save using library's agent definition storage
      const definition = this.toStoredDefinition(updated);
      await this.agentDefinitionStorage.save(definition);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteAgent(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.agents.has(id)) {
        return { success: false, error: `Agent "${id}" not found` };
      }

      this.agents.delete(id);

      // Delete from library's agent definition storage
      await this.agentDefinitionStorage.delete(id);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async setActiveAgent(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const agentConfig = this.agents.get(id);
      if (!agentConfig) {
        return { success: false, error: `Agent "${id}" not found` };
      }

      // Deactivate all other agents
      for (const [agentId, config] of this.agents) {
        if (config.isActive && agentId !== id) {
          config.isActive = false;
          // Save using library's agent definition storage
          const definition = this.toStoredDefinition(config);
          await this.agentDefinitionStorage.save(definition);
        }
      }

      // Activate the selected agent
      agentConfig.isActive = true;
      agentConfig.lastUsedAt = Date.now();
      // Save using library's agent definition storage
      const definition = this.toStoredDefinition(agentConfig);
      await this.agentDefinitionStorage.save(definition);

      // Initialize the agent with its full configuration (including tools)
      return this.initializeWithConfig(agentConfig);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Initialize agent with full configuration including tools
   */
  private async initializeWithConfig(agentConfig: StoredAgentConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Get connector config
      const connectorConfig = this.connectors.get(agentConfig.connector);
      if (!connectorConfig) {
        return { success: false, error: `Connector "${agentConfig.connector}" not found` };
      }

      // Register with library if not already
      if (!Connector.has(agentConfig.connector)) {
        Connector.create({
          name: agentConfig.connector,
          vendor: connectorConfig.vendor as Vendor,
          auth: connectorConfig.auth,
          baseURL: connectorConfig.baseURL,
        });
      }

      // Destroy existing agent
      this.agent?.destroy();

      // Initialize session storage using new FileContextStorage
      // This stores sessions at ~/.everworker/hosea/sessions/
      this.sessionStorage = new FileContextStorage({
        agentId: 'hosea',
        baseDirectory: join(this.dataDir, '..'),
      });

      // Resolve tool names to actual ToolFunction objects using UnifiedToolCatalog
      // Use agent config ID as instance ID for single-agent mode
      const toolCreationContext = { instanceId: agentConfig.id };
      const tools = this.toolCatalog.resolveToolsForAgent(
        agentConfig.tools,
        toolCreationContext
      );

      // Combine user instructions with UI capabilities prompt (user instructions first)
      const fullInstructions = (agentConfig.instructions || '') + '\n\n' + HOSEA_UI_CAPABILITIES_PROMPT;

      // Validate strategy exists in registry
      const { strategy: validStrategy, isValid: strategyIsValid } = validateStrategy(agentConfig.contextStrategy);
      if (!strategyIsValid) {
        const availableStrategies = StrategyRegistry.list().join(', ');
        console.warn(
          `Strategy "${agentConfig.contextStrategy}" not found in registry for agent "${agentConfig.name}". ` +
          `Using "${validStrategy}" instead. Available strategies: ${availableStrategies}. ` +
          `Please update the agent's strategy in settings.`
        );
      }

      // Create agent with NextGen context configuration
      // NOTE: NextGen simplifies context management - no history/permissions/cache options
      const config: AgentConfig = {
        connector: agentConfig.connector,
        model: agentConfig.model,
        name: agentConfig.name,
        tools,
        instructions: fullInstructions,
        temperature: agentConfig.temperature,
        maxIterations: agentConfig.maxIterations ?? 50,
        // NextGen context configuration
        context: {
          model: agentConfig.model,
          agentId: agentConfig.id,
          maxContextTokens: agentConfig.maxContextTokens,
          responseReserve: agentConfig.responseReserve,
          strategy: validStrategy, // Validated strategy from StrategyRegistry
          storage: this.sessionStorage,
          // Feature toggles (NextGen only has these 3)
          features: {
            workingMemory: agentConfig.workingMemoryEnabled,
            inContextMemory: agentConfig.inContextMemoryEnabled,
            persistentInstructions: agentConfig.persistentInstructionsEnabled ?? false,
          },
          // Plugin-specific configurations
          plugins: {
            workingMemory: agentConfig.workingMemoryEnabled
              ? {
                  maxSizeBytes: agentConfig.maxMemorySizeBytes,
                  maxIndexEntries: agentConfig.maxMemoryIndexEntries,
                  descriptionMaxLength: 150,
                  softLimitPercent: agentConfig.memorySoftLimitPercent,
                  contextAllocationPercent: agentConfig.contextAllocationPercent,
                }
              : undefined,
            inContextMemory: agentConfig.inContextMemoryEnabled
              ? {
                  maxEntries: agentConfig.maxInContextEntries,
                  maxTotalTokens: agentConfig.maxInContextTokens,
                }
              : undefined,
          },
        },
      };

      this.agent = Agent.create(config);

      // Update global config
      this.config.activeConnector = agentConfig.connector;
      this.config.activeModel = agentConfig.model;
      await this.saveConfigFile();

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get the currently active agent
   */
  getActiveAgent(): StoredAgentConfig | null {
    for (const config of this.agents.values()) {
      if (config.isActive) {
        return config;
      }
    }
    return null;
  }

  /**
   * Create a default agent for a connector
   */
  async createDefaultAgent(connectorName: string, model: string): Promise<{ success: boolean; id?: string; error?: string }> {
    const connector = this.connectors.get(connectorName);
    if (!connector) {
      return { success: false, error: `Connector "${connectorName}" not found` };
    }

    const defaultConfig = {
      name: 'Default Assistant',
      connector: connectorName,
      model,
      agentType: 'basic' as const,
      instructions: 'You are a helpful AI assistant. Use the rich formatting capabilities available to you (charts, diagrams, tables, code highlighting) to provide clear and visually informative responses when appropriate.',
      temperature: 0.7,
      maxIterations: 50,
      contextStrategy: 'default',
      maxContextTokens: 128000,
      responseReserve: 4096,
      workingMemoryEnabled: true,
      maxMemorySizeBytes: 25 * 1024 * 1024,
      maxMemoryIndexEntries: 30,
      memorySoftLimitPercent: 80,
      contextAllocationPercent: 10,
      inContextMemoryEnabled: false,
      maxInContextEntries: 20,
      maxInContextTokens: 4000,
      persistentInstructionsEnabled: false,
      permissionsEnabled: true,
      tools: [],
    };

    const result = await this.createAgent(defaultConfig);
    if (result.success && result.id) {
      // Also activate this agent
      await this.setActiveAgent(result.id);
    }
    return result;
  }

  listModels(): { vendor: string; models: { id: string; name: string; description?: string; contextWindow: number }[] }[] {
    const result: { vendor: string; models: { id: string; name: string; description?: string; contextWindow: number }[] }[] = [];

    for (const vendor of Object.values(Vendor)) {
      if (typeof vendor !== 'string') continue;
      const models = getModelsByVendor(vendor as Vendor);
      if (models.length > 0) {
        result.push({
          vendor,
          models: models
            .filter((m) => m.isActive)
            .map((m) => ({
              id: m.name,
              name: m.name,
              description: m.description,
              contextWindow: m.features.input.tokens,
            })),
        });
      }
    }

    return result;
  }

  /**
   * Get detailed information about a specific model
   */
  getModelDetails(modelId: string): ILLMDescription | null {
    return getModelInfo(modelId) || null;
  }

  /**
   * Get list of all supported vendors
   */
  listVendors(): string[] {
    return Object.values(Vendor).filter((v) => typeof v === 'string') as string[];
  }

  /**
   * Get list of available compaction strategies
   */
  getStrategies(): StrategyInfo[] {
    return StrategyRegistry.getInfo();
  }

  async saveSession(): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    if (!this.agent) {
      return { success: false, error: 'Agent not initialized' };
    }

    try {
      await this.agent.saveSession();
      return { success: true, sessionId: this.agent.getSessionId() || undefined };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async loadSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.sessionStorage) {
      return { success: false, error: 'Session storage not initialized' };
    }

    try {
      // Destroy current agent
      this.agent?.destroy();

      // Resume from session with UI capabilities (NextGen)
      this.agent = await Agent.resume(sessionId, {
        connector: this.config.activeConnector!,
        model: this.config.activeModel!,
        instructions: HOSEA_UI_CAPABILITIES_PROMPT,
        context: {
          model: this.config.activeModel!,
          storage: this.sessionStorage,
        },
        session: {
          storage: this.sessionStorage,
        },
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async listSessions(): Promise<{ id: string; createdAt: number }[]> {
    if (!this.sessionStorage) {
      return [];
    }

    try {
      const sessions = await this.sessionStorage.list();
      return sessions.map((s) => ({ id: s.sessionId, createdAt: s.createdAt.getTime() }));
    } catch {
      return [];
    }
  }

  newSession(): { success: boolean } {
    if (this.agent) {
      // Create a new agent instance (fresh session)
      this.initialize(this.config.activeConnector!, this.config.activeModel!);
    }
    return { success: true };
  }

  listTools(): { name: string; enabled: boolean; description: string }[] {
    if (!this.agent) {
      return [];
    }

    const tools = this.agent.tools?.getAll() || [];
    return tools.map((t: ToolFunction) => ({
      name: t.definition.function.name,
      enabled: true, // TODO: Track enabled state
      description: t.definition.function.description || '',
    }));
  }

  /**
   * Get all available tools from the registry (built-in + connector tools)
   */
  getAvailableTools(): {
    name: string;
    displayName: string;
    category: string;
    categoryDisplayName: string;
    description: string;
    safeByDefault: boolean;
    requiresConnector: boolean;
    connectorServiceTypes?: string[];
    source: 'oneringai' | 'hosea' | 'custom';
  }[] {
    // Use UnifiedToolCatalog which combines oneringai + hosea tools
    const allTools = this.toolCatalog.getAllTools();
    return allTools.map((entry: UnifiedToolEntry) => ({
      name: entry.name,
      displayName: entry.displayName,
      category: entry.category,
      categoryDisplayName: entry.categoryDisplayName,
      description: entry.description,
      safeByDefault: entry.safeByDefault,
      requiresConnector: entry.requiresConnector || false,
      connectorServiceTypes: entry.connectorServiceTypes,
      source: entry.source,
    }));
  }

  /**
   * Get tool categories with display names and counts
   */
  getToolCategories(): { id: string; displayName: string; count: number }[] {
    return this.toolCatalog.getCategories();
  }

  toggleTool(toolName: string, enabled: boolean): { success: boolean } {
    if (!this.agent) {
      return { success: false };
    }

    if (enabled) {
      this.agent.tools?.enable(toolName);
    } else {
      this.agent.tools?.disable(toolName);
    }

    return { success: true };
  }

  getConfig(): HoseaConfig {
    return this.config;
  }

  async setConfig(key: string, value: unknown): Promise<{ success: boolean }> {
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
    await this.saveConfigFile();

    // Handle special case for logLevel
    if (key === 'logLevel') {
      logger.updateConfig({ level: value as LogLevel });
    }

    return { success: true };
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return logger.getLevel();
  }

  /**
   * Set log level (updates both config and runtime)
   */
  async setLogLevel(level: LogLevel): Promise<{ success: boolean }> {
    this.config.logLevel = level;
    await this.saveConfigFile();
    logger.updateConfig({ level });
    console.log(`Log level changed to: ${level}`);
    return { success: true };
  }

  destroy(): void {
    // Destroy the legacy single agent
    this.agent?.destroy();
    this.agent = null;

    // Destroy all instances
    for (const instance of this.instances.values()) {
      try {
        instance.agent.destroy();
      } catch (error) {
        console.warn(`Error destroying instance ${instance.instanceId}:`, error);
      }
    }
    this.instances.clear();
  }

  /**
   * Set the BrowserService reference for browser automation tools
   */
  setBrowserService(browserService: BrowserService): void {
    this.browserService = browserService;
    // Update the browser tool provider so tools can be created
    this.browserToolProvider.setBrowserService(browserService);
    console.log('[AgentService] BrowserService connected');
  }

  /**
   * Get the BrowserService reference
   */
  getBrowserService(): BrowserService | null {
    return this.browserService;
  }

  /**
   * Set the stream emitter for sending chunks to renderer.
   * This enables the HoseaUIPlugin to emit Dynamic UI content for browser tools.
   * Must be called after mainWindow is created.
   */
  setStreamEmitter(emitter: (instanceId: string, chunk: StreamChunk) => void): void {
    this.streamEmitter = emitter;
    console.log('[AgentService] StreamEmitter connected - HoseaUIPlugin enabled for new instances');
  }

  // ============ Multi-Tab Instance Management ============

  /**
   * Create a new agent instance for a tab
   * @param agentConfigId - The ID of the agent configuration to use
   * @returns instanceId if successful
   */
  async createInstance(agentConfigId: string): Promise<{ success: boolean; instanceId?: string; error?: string }> {
    try {
      // Check instance limit
      if (this.instances.size >= MAX_INSTANCES) {
        return { success: false, error: `Maximum number of instances (${MAX_INSTANCES}) reached` };
      }

      // Get agent config
      const agentConfig = this.agents.get(agentConfigId);
      if (!agentConfig) {
        return { success: false, error: `Agent configuration "${agentConfigId}" not found` };
      }

      // Get connector config
      const connectorConfig = this.connectors.get(agentConfig.connector);
      if (!connectorConfig) {
        return { success: false, error: `Connector "${agentConfig.connector}" not found` };
      }

      // Register connector with library if not already
      if (!Connector.has(agentConfig.connector)) {
        Connector.create({
          name: agentConfig.connector,
          vendor: connectorConfig.vendor as Vendor,
          auth: connectorConfig.auth,
          baseURL: connectorConfig.baseURL,
        });
      }

      // Generate unique instance ID
      const instanceId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Create instance-specific session storage
      const sessionStorage = new FileContextStorage({
        agentId: instanceId, // Unique per instance
        baseDirectory: join(this.dataDir, '..'),
      });

      // Resolve tool names to actual ToolFunction objects using UnifiedToolCatalog
      // This handles both oneringai tools AND hosea-specific tools (like browser automation)
      const toolCreationContext = { instanceId };
      const tools = this.toolCatalog.resolveToolsForAgent(
        agentConfig.tools,
        toolCreationContext
      );
      logger.debug(`[createInstance] Resolved ${tools.length} tools from catalog for ${agentConfig.tools.length} configured tool names`);

      // Connect MCP servers and register their tools if configured
      if (agentConfig.mcpServers && agentConfig.mcpServers.length > 0) {
        for (const mcpRef of agentConfig.mcpServers) {
          const serverConfig = this.mcpServers.get(mcpRef.serverName);
          if (serverConfig && serverConfig.status !== 'connected') {
            await this.connectMCPServer(mcpRef.serverName);
          }
          // MCP tools are registered to the agent's tool manager below
        }
      }

      // Combine user instructions with UI capabilities prompt
      const fullInstructions = (agentConfig.instructions || '') + '\n\n' + HOSEA_UI_CAPABILITIES_PROMPT;

      // Build NextGen context configuration
      // Note: Use agentConfigId (not instanceId) for persistent instructions so they're
      // shared across all instances of the same agent. Instance ID is only for session storage.
      logger.debug(`[createInstance] Creating agent with features: workingMemory=${agentConfig.workingMemoryEnabled}, inContextMemory=${agentConfig.inContextMemoryEnabled}, persistentInstructions=${agentConfig.persistentInstructionsEnabled}`);
      logger.debug(`[createInstance] Agent ID for persistent instructions: ${agentConfigId}`);

      const contextConfig: AgentContextNextGenConfig = {
        model: agentConfig.model,
        agentId: agentConfigId, // Use agent config ID for persistent instructions path
        maxContextTokens: agentConfig.maxContextTokens,
        responseReserve: agentConfig.responseReserve,
        strategy: agentConfig.contextStrategy, // Already NextGen type
        storage: sessionStorage,
        features: {
          workingMemory: agentConfig.workingMemoryEnabled,
          inContextMemory: agentConfig.inContextMemoryEnabled,
          persistentInstructions: agentConfig.persistentInstructionsEnabled ?? false,
        },
        plugins: {
          workingMemory: agentConfig.workingMemoryEnabled
            ? {
                maxSizeBytes: agentConfig.maxMemorySizeBytes,
                maxIndexEntries: agentConfig.maxMemoryIndexEntries,
                descriptionMaxLength: 150,
                softLimitPercent: agentConfig.memorySoftLimitPercent,
                contextAllocationPercent: agentConfig.contextAllocationPercent,
              }
            : undefined,
          inContextMemory: agentConfig.inContextMemoryEnabled
            ? {
                maxEntries: agentConfig.maxInContextEntries,
                maxTotalTokens: agentConfig.maxInContextTokens,
              }
            : undefined,
        },
      };

      // Create agent (only basic Agent type in NextGen - other types deprecated)
      const agent = Agent.create({
        connector: agentConfig.connector,
        model: agentConfig.model,
        name: agentConfig.name,
        tools,
        instructions: fullInstructions,
        temperature: agentConfig.temperature,
        context: contextConfig,
      });

      // Register MCP tools with the agent if configured
      if (agentConfig.mcpServers && agentConfig.mcpServers.length > 0) {
        for (const mcpRef of agentConfig.mcpServers) {
          if (MCPRegistry.has(mcpRef.serverName)) {
            const client = MCPRegistry.get(mcpRef.serverName);
            if (client.isConnected()) {
              client.registerTools(agent.tools);
            }
          }
        }
      }

      // NOTE: Browser tools are now resolved through UnifiedToolCatalog when selected
      // No need for separate registration - they're part of agentConfig.tools

      // Register HoseaUIPlugin for browser tool UI integration
      // This plugin emits Dynamic UI content when browser tools execute
      if (this.streamEmitter) {
        const streamEmitter = this.streamEmitter;
        agent.tools.executionPipeline.use(
          new HoseaUIPlugin({
            emitDynamicUI: (instId: string, content: DynamicUIContent) => {
              // Send Dynamic UI content to renderer via the stream emitter
              console.log(`[HoseaUIPlugin.emitDynamicUI] Sending to renderer for ${instId}`);
              streamEmitter(instId, {
                type: 'ui:set_dynamic_content',
                content,
              });
            },
            getInstanceId: () => instanceId,
          })
        );
        logger.info(`[createInstance] HoseaUIPlugin registered for instance ${instanceId}`);
      } else {
        logger.warn(`[createInstance] streamEmitter not set - HoseaUIPlugin NOT registered for ${instanceId}`);
      }

      // Store the instance
      const agentInstance: AgentInstance = {
        instanceId,
        agentConfigId,
        agent,
        sessionStorage,
        createdAt: Date.now(),
      };
      this.instances.set(instanceId, agentInstance);

      // Subscribe to context events for monitoring
      this.subscribeToContextEvents(agent, instanceId);

      // Log plugin status for debugging
      const ctx = agent.context as AgentContextNextGen;
      const hasPI = ctx.hasPlugin('persistent_instructions');
      logger.debug(`[createInstance] Persistent instructions plugin registered: ${hasPI}`);

      logger.info(`Created agent instance ${instanceId} for config ${agentConfigId} (${agentConfig.name})`);
      return { success: true, instanceId };
    } catch (error) {
      logger.error(`Error creating instance: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Destroy an agent instance
   * @param instanceId - The instance ID to destroy
   */
  async destroyInstance(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return { success: false, error: `Instance "${instanceId}" not found` };
      }

      // Cancel any ongoing operations
      if ('cancel' in instance.agent && typeof instance.agent.cancel === 'function') {
        instance.agent.cancel();
      }

      // Destroy associated browser instance if exists
      if (this.browserService && this.browserService.hasBrowser(instanceId)) {
        await this.browserService.destroyBrowser(instanceId);
        logger.debug(`[destroyInstance] Destroyed browser for instance ${instanceId}`);
      }

      // Destroy the agent
      instance.agent.destroy();

      // Remove from instances map
      this.instances.delete(instanceId);

      console.log(`Destroyed agent instance ${instanceId}`);
      return { success: true };
    } catch (error) {
      console.error(`Error destroying instance ${instanceId}:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get an agent instance by ID
   */
  getInstance(instanceId: string): AgentInstance | null {
    return this.instances.get(instanceId) || null;
  }

  /**
   * List all active instances
   */
  listInstances(): Array<{ instanceId: string; agentConfigId: string; createdAt: number }> {
    return Array.from(this.instances.values()).map(inst => ({
      instanceId: inst.instanceId,
      agentConfigId: inst.agentConfigId,
      createdAt: inst.createdAt,
    }));
  }

  /**
   * Stream a message to a specific agent instance
   */
  async *streamInstance(instanceId: string, message: string): AsyncGenerator<StreamChunk> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      yield { type: 'error', content: `Instance "${instanceId}" not found` };
      return;
    }

    // Track when we're in plan mode to suppress text output
    let suppressText = false;

    try {
      // Check if the agent has a stream method
      if ('stream' in instance.agent && typeof instance.agent.stream === 'function') {
        for await (const event of instance.agent.stream(message)) {
          // Cast through unknown to support various event type formats
          const e = event as unknown as { type: string; [key: string]: unknown };

          // Detect plan mode transitions to control text suppression
          if (e.type === 'plan:analyzing' || e.type === 'plan:created') {
            suppressText = true;
          } else if (e.type === 'plan:approved' || e.type === 'mode:changed') {
            const modeEvent = e as { type: string; to?: string };
            if (e.type === 'mode:changed' && modeEvent.to === 'interactive') {
              suppressText = false;
            }
          } else if (e.type === 'execution:done') {
            suppressText = false;
          }

          // Handle StreamEventType format from Agent.stream()
          // StreamEventType: response.output_text.delta, response.tool_execution.start, etc.
          // Legacy: text:delta, tool:start, etc.

          // Text events
          if (e.type === 'text:delta' || e.type === 'response.output_text.delta') {
            if (!suppressText) {
              const delta = (e as any).delta || '';
              yield { type: 'text', content: delta };
            }
          }
          // Tool start events
          else if (e.type === 'tool:start' || e.type === 'response.tool_execution.start') {
            const toolName = (e as any).name || (e as any).tool_name || 'unknown';
            const args = ((e as any).args || (e as any).arguments || {}) as Record<string, unknown>;
            const tool = instance.agent.tools?.get(toolName);
            let description = '';
            if (tool?.describeCall) {
              try {
                description = tool.describeCall(args);
              } catch {
                description = defaultDescribeCall(args);
              }
            } else {
              description = defaultDescribeCall(args);
            }
            yield { type: 'tool_start', tool: toolName, args, description };
          }
          // Tool complete events
          else if (e.type === 'tool:complete' || e.type === 'response.tool_execution.done') {
            const toolName = (e as any).name || (e as any).tool_name || 'unknown';
            const durationMs = (e as any).durationMs || (e as any).execution_time_ms || 0;
            // Check for error in tool execution done
            if ((e as any).error) {
              yield { type: 'tool_error', tool: toolName, error: (e as any).error };
            } else {
              yield { type: 'tool_end', tool: toolName, durationMs };
            }
          }
          // Legacy tool error format
          else if (e.type === 'tool:error') {
            yield { type: 'tool_error', tool: (e as any).name, error: (e as any).error };
          }
          // Done events
          else if (e.type === 'text:done' || e.type === 'response.complete') {
            yield { type: 'done' };
          }
          // Error events
          else if (e.type === 'error' || e.type === 'response.error') {
            yield { type: 'error', content: (e as any).error || (e as any).message || 'Unknown error' };
          }
          // Plan events
          else if (e.type === 'plan:created') {
            yield { type: 'plan:created', plan: this.serializePlan((e as any).plan) };
          } else if (e.type === 'plan:awaiting_approval') {
            yield { type: 'plan:awaiting_approval', plan: this.serializePlan((e as any).plan) };
          } else if (e.type === 'plan:approved') {
            yield { type: 'plan:approved', plan: this.serializePlan((e as any).plan) };
          } else if (e.type === 'plan:analyzing') {
            yield { type: 'plan:analyzing', goal: (e as any).goal };
          } else if (e.type === 'mode:changed') {
            yield { type: 'mode:changed', from: (e as any).from, to: (e as any).to, reason: (e as any).reason };
          } else if (e.type === 'needs:approval') {
            yield { type: 'needs:approval', plan: this.serializePlan((e as any).plan) };
          }
          // Task events
          else if (e.type === 'task:started') {
            yield { type: 'task:started', task: this.serializeTask((e as any).task) };
          } else if (e.type === 'task:progress') {
            yield { type: 'task:progress', task: this.serializeTask((e as any).task), status: (e as any).status };
          } else if (e.type === 'task:completed') {
            yield { type: 'task:completed', task: this.serializeTask((e as any).task), result: (e as any).result };
          } else if (e.type === 'task:failed') {
            yield { type: 'task:failed', task: this.serializeTask((e as any).task), error: (e as any).error };
          }
          // Execution events
          else if (e.type === 'execution:done') {
            yield { type: 'execution:done', result: (e as any).result };
          } else if (e.type === 'execution:paused') {
            yield { type: 'execution:paused', reason: (e as any).reason };
          }
        }
      } else if ('run' in instance.agent && typeof instance.agent.run === 'function') {
        // Fallback for basic Agent that doesn't have stream - use run
        const response = await (instance.agent as Agent).run(message);
        yield { type: 'text', content: response.output_text || '' };
        yield { type: 'done' };
      } else {
        yield { type: 'error', content: 'Agent does not support streaming or run methods' };
      }
    } catch (error) {
      yield { type: 'error', content: String(error) };
    }
  }

  /**
   * Cancel an operation on a specific instance
   */
  cancelInstance(instanceId: string): { success: boolean; error?: string } {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return { success: false, error: `Instance "${instanceId}" not found` };
    }

    if ('cancel' in instance.agent && typeof instance.agent.cancel === 'function') {
      instance.agent.cancel();
    }
    return { success: true };
  }

  /**
   * Get status of a specific instance
   */
  getInstanceStatus(instanceId: string): {
    found: boolean;
    initialized: boolean;
    connector: string | null;
    model: string | null;
    mode: string | null;
    agentConfigId: string | null;
  } {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return {
        found: false,
        initialized: false,
        connector: null,
        model: null,
        mode: null,
        agentConfigId: null,
      };
    }

    const agentConfig = this.agents.get(instance.agentConfigId);
    return {
      found: true,
      initialized: true,
      connector: agentConfig?.connector || null,
      model: agentConfig?.model || null,
      mode: null, // Mode concept removed in NextGen (was UniversalAgent-specific)
      agentConfigId: instance.agentConfigId,
    };
  }

  /**
   * Get internals for a specific instance
   * If instanceId is null, falls back to legacy single agent behavior
   */
  async getInternalsForInstance(instanceId: string | null): Promise<{
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
    systemPrompt: string | null;
    persistentInstructions: {
      content: string;
      path: string;
      length: number;
      enabled: boolean;
    } | null;
    tokenBreakdown: {
      total: number;
      reserved: number;
      used: number;
      available: number;
      components: Array<{ name: string; tokens: number; percent: number }>;
    } | null;
    compactionLog: Array<{
      timestamp: number;
      tokensToFree: number;
      message: string;
    }>;
  }> {
    // Get the agent - either from instance or legacy single agent
    let agent: Agent | null = null;
    let agentConfigId: string | null = null;

    if (instanceId) {
      const instance = this.instances.get(instanceId);
      if (instance) {
        agent = instance.agent;
        agentConfigId = instance.agentConfigId;
      }
    } else {
      // Fallback to legacy single agent
      agent = this.agent;
      agentConfigId = this.getActiveAgent()?.id || null;
    }

    if (!agent) {
      return {
        available: false,
        agentName: null,
        context: null,
        cache: null,
        memory: null,
        inContextMemory: null,
        tools: [],
        toolCalls: [],
        systemPrompt: null,
        persistentInstructions: null,
        tokenBreakdown: null,
        compactionLog: [],
      };
    }

    // Delegate to the common helper (pass instanceId for compaction log lookup)
    return this.getInternalsForAgent(agent, agentConfigId, instanceId || 'default');
  }

  /**
   * Get memory value for a specific instance
   */
  async getMemoryValueForInstance(instanceId: string | null, key: string): Promise<unknown> {
    let agent: Agent | null = null;

    if (instanceId) {
      const instance = this.instances.get(instanceId);
      if (instance) {
        agent = instance.agent;
      }
    } else {
      agent = this.agent;
    }

    if (!agent?.context?.memory) {
      return null;
    }

    try {
      return await agent.context.memory.retrieve(key);
    } catch {
      return null;
    }
  }

  /**
   * Force compaction for a specific instance
   */
  async forceCompactionForInstance(instanceId: string | null): Promise<{ success: boolean; tokensFreed: number; error?: string }> {
    let agent: Agent | null = null;

    if (instanceId) {
      const instance = this.instances.get(instanceId);
      if (instance) {
        agent = instance.agent;
      }
    } else {
      agent = this.agent;
    }

    if (!agent) {
      return { success: false, tokensFreed: 0, error: 'No agent found' };
    }

    try {
      // NextGen uses calculateBudget() and prepare() for compaction
      const ctx = agent.context as AgentContextNextGen;
      const beforeBudget = await ctx.calculateBudget();
      const beforeUsed = beforeBudget.totalUsed;

      // prepare() triggers compaction if above threshold
      await ctx.prepare();

      const afterBudget = await ctx.calculateBudget();
      const afterUsed = afterBudget.totalUsed;
      const tokensFreed = Math.max(0, beforeUsed - afterUsed);

      return { success: true, tokensFreed };
    } catch (error) {
      return { success: false, tokensFreed: 0, error: String(error) };
    }
  }

  /**
   * Helper to get internals from an agent (NextGen)
   */
  private async getInternalsForAgent(
    agent: Agent,
    agentConfigId: string | null,
    instanceId: string = 'default'
  ): Promise<{
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
    systemPrompt: string | null;
    persistentInstructions: {
      content: string;
      path: string;
      length: number;
      enabled: boolean;
    } | null;
    tokenBreakdown: {
      total: number;
      reserved: number;
      used: number;
      available: number;
      components: Array<{ name: string; tokens: number; percent: number }>;
    } | null;
    compactionLog: Array<{
      timestamp: number;
      tokensToFree: number;
      message: string;
    }>;
  }> {
    try {
      // NextGen context uses AgentContextNextGen
      const ctx = agent.context as AgentContextNextGen;

      // Calculate budget using NextGen API
      const budget = await ctx.calculateBudget();

      // Get context stats
      const contextStats = {
        totalTokens: budget.totalUsed,
        maxTokens: budget.maxTokens,
        utilizationPercent: budget.utilizationPercent,
        messagesCount: ctx.getConversationLength(),
        toolCallsCount: 0, // NextGen doesn't track tool calls in context
        strategy: ctx.strategy,
      };

      // Cache is not available in NextGen - return null
      const cacheStats = null;

      // Get working memory via NextGen plugin API
      let memoryData = null;
      if (ctx.features.workingMemory && ctx.memory) {
        const memState = await ctx.memory.getStateAsync();
        const totalSizeBytes = memState.entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
        const maxSizeBytes = 25 * 1024 * 1024; // Default max
        memoryData = {
          totalEntries: memState.entries.length,
          totalSizeBytes,
          utilizationPercent: (totalSizeBytes / maxSizeBytes) * 100,
          entries: memState.entries.map((e) => ({
            key: e.key,
            description: e.description,
            scope: String(typeof e.scope === 'object' ? JSON.stringify(e.scope) : e.scope),
            priority: e.basePriority || 'normal',
            sizeBytes: e.sizeBytes || 0,
            updatedAt: Date.now(),
          })),
        };
      }

      // Get in-context memory via NextGen plugin API
      const inContextEnabled = ctx.features.inContextMemory;
      const inContextPlugin = ctx.getPlugin<InContextMemoryPluginNextGen>('in_context_memory');
      let inContextData: {
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
      } = {
        enabled: inContextEnabled,
        entries: [],
        maxEntries: 20,
        maxTokens: 4000,
      };

      if (inContextPlugin) {
        const entries = inContextPlugin.list();
        inContextData = {
          enabled: true,
          entries: entries.map((e) => ({
            key: e.key,
            description: e.description,
            priority: e.priority,
            updatedAt: e.updatedAt,
            value: inContextPlugin.get(e.key),
          })),
          maxEntries: 20, // Default
          maxTokens: 4000, // Default
        };
      }

      // Get tools with stats
      const toolStats = agent.tools.getStats();
      const allTools = agent.tools.getAll();
      const toolsWithStats = allTools.map((tool: ToolFunction) => {
        const name = tool.definition.function.name;
        const usageInfo = toolStats.mostUsed.find((u: { name: string; count: number }) => u.name === name);
        return {
          name,
          description: tool.definition.function.description || '',
          enabled: agent.tools.isEnabled(name),
          callCount: usageInfo?.count || 0,
          namespace: undefined,
        };
      });

      // Tool calls history is not tracked in NextGen context
      const toolCalls: Array<{
        id: string;
        name: string;
        args: unknown;
        result?: unknown;
        error?: string;
        durationMs: number;
        timestamp: number;
      }> = [];

      // Get agent config for name
      const agentConfig = agentConfigId ? this.agents.get(agentConfigId) : null;

      // Get system prompt
      const systemPrompt = ctx.systemPrompt || null;

      // Get persistent instructions via NextGen plugin API
      // Note: PersistentInstructionsPluginNextGen stores at ~/.oneringai/agents/<agentId>/custom_instructions.md
      const effectiveAgentId = agentConfigId || 'default';
      const persistentInstructionsPath = join(homedir(), '.oneringai', 'agents', effectiveAgentId, 'custom_instructions.md');
      let persistentInstructionsData: {
        content: string;
        path: string;
        length: number;
        enabled: boolean;
      };
      const persistentPlugin = ctx.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions');
      if (persistentPlugin) {
        const content = await persistentPlugin.getContent();
        const contentStr = content || '';
        persistentInstructionsData = {
          content: contentStr,
          path: persistentInstructionsPath,
          length: contentStr.length,
          enabled: true,
        };
      } else {
        persistentInstructionsData = {
          content: '',
          path: persistentInstructionsPath,
          length: 0,
          enabled: false,
        };
      }

      // Build token breakdown from NextGen budget
      // Note: pluginContents is a Record<string, number>, so we need to flatten it
      const flatBreakdown: Array<{ name: string; tokens: number }> = [];
      for (const [name, value] of Object.entries(budget.breakdown)) {
        if (name === 'pluginContents' && typeof value === 'object' && value !== null) {
          // Flatten plugin contents into individual entries
          for (const [pluginName, pluginTokens] of Object.entries(value as Record<string, number>)) {
            if (typeof pluginTokens === 'number' && pluginTokens > 0) {
              flatBreakdown.push({
                name: `Plugin: ${pluginName.split(/(?=[A-Z])|_/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}`,
                tokens: pluginTokens,
              });
            }
          }
        } else if (typeof value === 'number' && value > 0) {
          flatBreakdown.push({
            name: name.split(/(?=[A-Z])|_/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
            tokens: value,
          });
        }
      }
      const components = flatBreakdown
        .map((item) => ({
          ...item,
          percent: budget.totalUsed > 0 ? (item.tokens / budget.totalUsed) * 100 : 0,
        }))
        .sort((a, b) => b.tokens - a.tokens);

      const tokenBreakdown = {
        total: budget.maxTokens,
        reserved: budget.responseReserve,
        used: budget.totalUsed,
        available: budget.available,
        components,
      };

      return {
        available: true,
        agentName: agentConfig?.name || 'Default Assistant',
        context: contextStats,
        cache: cacheStats,
        memory: memoryData,
        inContextMemory: inContextData,
        tools: toolsWithStats,
        toolCalls,
        systemPrompt,
        persistentInstructions: persistentInstructionsData,
        tokenBreakdown,
        compactionLog: this.compactionLogs.get(instanceId) || [],
      };
    } catch (error) {
      console.error('Error getting internals:', error);
      return {
        available: false,
        agentName: null,
        context: null,
        cache: null,
        memory: null,
        inContextMemory: null,
        tools: [],
        toolCalls: [],
        systemPrompt: null,
        persistentInstructions: null,
        tokenBreakdown: null,
        compactionLog: [],
      };
    }
  }

  // ============ Internals Monitoring (Look Inside) ============

  /**
   * Internals data types for monitoring
   */

  /**
   * Get all agent internals in one call (for Look Inside panel)
   */
  async getInternals(): Promise<{
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
    compactionLog: Array<{
      timestamp: number;
      tokensToFree: number;
      message: string;
    }>;
  }> {
    // Delegate to the helper method (NextGen refactored to avoid duplication)
    if (!this.agent) {
      return {
        available: false,
        agentName: null,
        context: null,
        cache: null,
        memory: null,
        inContextMemory: null,
        tools: [],
        toolCalls: [],
        systemPrompt: null,
        persistentInstructions: null,
        tokenBreakdown: null,
        compactionLog: [],
      };
    }

    const activeAgent = this.getActiveAgent();
    return this.getInternalsForAgent(this.agent, activeAgent?.id || null, 'default');
  }

  /**
   * Get just the context stats (lighter weight for frequent polling)
   */
  async getContextStats(): Promise<{
    available: boolean;
    totalTokens: number;
    maxTokens: number;
    utilizationPercent: number;
    messagesCount: number;
    toolCallsCount: number;
    strategy: string;
  } | null> {
    if (!this.agent) {
      return null;
    }

    try {
      // NextGen uses calculateBudget() instead of getMetrics()
      const ctx = this.agent.context as AgentContextNextGen;
      const budget = await ctx.calculateBudget();

      return {
        available: true,
        totalTokens: budget.totalUsed,
        maxTokens: budget.maxTokens,
        utilizationPercent: budget.utilizationPercent,
        messagesCount: ctx.getConversationLength(),
        toolCallsCount: 0, // NextGen doesn't track tool calls in context
        strategy: ctx.strategy,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get memory entries only
   */
  async getMemoryEntries(): Promise<Array<{
    key: string;
    description: string;
    scope: string;
    priority: string;
    sizeBytes: number;
    updatedAt: number;
    value?: unknown;
  }>> {
    // NextGen uses memory.getStateAsync() instead of getIndex()
    const ctx = this.agent?.context as AgentContextNextGen | undefined;
    if (!ctx?.memory) {
      return [];
    }

    try {
      const memState = await ctx.memory.getStateAsync();
      const result = [];
      for (const entry of memState.entries) {
        result.push({
          key: entry.key,
          description: entry.description,
          scope: String(typeof entry.scope === 'object' ? JSON.stringify(entry.scope) : entry.scope),
          priority: entry.basePriority || 'normal',
          sizeBytes: entry.sizeBytes || 0,
          updatedAt: Date.now(),
          value: entry.value,
        });
      }
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Get a single memory entry value by key
   */
  async getMemoryValue(key: string): Promise<unknown> {
    if (!this.agent?.context?.memory) {
      return null;
    }

    try {
      return await this.agent.context.memory.retrieve(key);
    } catch {
      return null;
    }
  }

  /**
   * Get the full prepared context as it would be sent to the LLM
   * NextGen returns the actual InputItem[] array that goes to the LLM
   */
  async getPreparedContext(): Promise<{
    available: boolean;
    components: Array<{
      name: string;
      content: string;
      tokenEstimate: number;
    }>;
    totalTokens: number;
    rawContext: string;
  }> {
    if (!this.agent) {
      return {
        available: false,
        components: [],
        totalTokens: 0,
        rawContext: '',
      };
    }

    try {
      // NextGen context - prepare() returns { input: InputItem[], budget, ... }
      const ctx = this.agent.context as AgentContextNextGen;
      const prepared = await ctx.prepare();

      // Build components from the actual InputItem[] array
      const components: Array<{ name: string; content: string; tokenEstimate: number }> = [];

      for (let i = 0; i < prepared.input.length; i++) {
        const item = prepared.input[i];
        let name = `Item ${i + 1}`;
        let content = '';

        // InputItem can be Message or other types
        if ('role' in item) {
          const role = (item as { role: string }).role;
          name = role === 'developer' ? 'System Message' :
                 role === 'user' ? 'User Message' :
                 role === 'assistant' ? 'Assistant Message' :
                 `${role} Message`;

          // Get content from the item
          if ('content' in item) {
            const itemContent = (item as { content: unknown }).content;
            if (typeof itemContent === 'string') {
              content = itemContent;
            } else if (Array.isArray(itemContent)) {
              // Content blocks array (NextGen uses input_text, output_text, tool_use, tool_result)
              content = itemContent.map((block: unknown) => {
                if (typeof block === 'string') return block;
                if (typeof block === 'object' && block !== null) {
                  const b = block as Record<string, unknown>;
                  // Handle NextGen content types
                  if ((b.type === 'text' || b.type === 'input_text' || b.type === 'output_text') && typeof b.text === 'string') {
                    return b.text;
                  }
                  if (b.type === 'tool_use') {
                    const args = b.arguments || b.input || '{}';
                    return `[Tool Call: ${b.name}]\nArguments: ${typeof args === 'string' ? args : JSON.stringify(args, null, 2)}`;
                  }
                  if (b.type === 'tool_result') {
                    const resultContent = typeof b.content === 'string' ? b.content : JSON.stringify(b.content, null, 2);
                    const truncated = resultContent.length > 500 ? resultContent.substring(0, 500) + '... [truncated]' : resultContent;
                    return `[Tool Result: ${b.tool_use_id}]\n${truncated}`;
                  }
                  return JSON.stringify(b, null, 2);
                }
                return String(block);
              }).join('\n\n');
            } else if (itemContent && typeof itemContent === 'object') {
              content = JSON.stringify(itemContent, null, 2);
            }
          }
        } else {
          // Other input item types
          content = JSON.stringify(item, null, 2);
        }

        if (content) {
          components.push({
            name,
            content,
            tokenEstimate: Math.ceil(content.length / 4),
          });
        }
      }

      // Build raw context representation
      const rawContext = components.map(c => {
        const separator = '='.repeat(60);
        return `${separator}\n## ${c.name} (~${c.tokenEstimate} tokens)\n${separator}\n\n${c.content}`;
      }).join('\n\n');

      const totalTokens = prepared.budget.totalUsed;

      return {
        available: true,
        components,
        totalTokens,
        rawContext,
      };
    } catch (error) {
      console.error('Error getting prepared context:', error);
      return {
        available: false,
        components: [],
        totalTokens: 0,
        rawContext: `Error: ${error}`,
      };
    }
  }

  /**
   * Get prepared context for a specific instance (multi-tab support)
   */
  async getPreparedContextForInstance(instanceId: string): Promise<{
    available: boolean;
    components: Array<{
      name: string;
      content: string;
      tokenEstimate: number;
    }>;
    totalTokens: number;
    rawContext: string;
  }> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return {
        available: false,
        components: [],
        totalTokens: 0,
        rawContext: `Instance "${instanceId}" not found`,
      };
    }

    try {
      // NextGen context - prepare() returns { input: InputItem[], budget, ... }
      const ctx = instance.agent.context as AgentContextNextGen;
      const prepared = await ctx.prepare();

      // Build components from the actual InputItem[] array
      const components: Array<{ name: string; content: string; tokenEstimate: number }> = [];

      for (let i = 0; i < prepared.input.length; i++) {
        const item = prepared.input[i];
        let name = `Item ${i + 1}`;
        let content = '';

        // InputItem can be Message or other types
        if ('role' in item) {
          const role = (item as { role: string }).role;
          name = role === 'developer' ? 'System Message' :
                 role === 'user' ? 'User Message' :
                 role === 'assistant' ? 'Assistant Message' :
                 `${role} Message`;

          // Get content from the item
          if ('content' in item) {
            const itemContent = (item as { content: unknown }).content;
            if (typeof itemContent === 'string') {
              content = itemContent;
            } else if (Array.isArray(itemContent)) {
              // Content blocks array (NextGen uses input_text, output_text, tool_use, tool_result)
              content = itemContent.map((block: unknown) => {
                if (typeof block === 'string') return block;
                if (typeof block === 'object' && block !== null) {
                  const b = block as Record<string, unknown>;
                  // Handle NextGen content types
                  if ((b.type === 'text' || b.type === 'input_text' || b.type === 'output_text') && typeof b.text === 'string') {
                    return b.text;
                  }
                  if (b.type === 'tool_use') {
                    const args = b.arguments || b.input || '{}';
                    return `[Tool Call: ${b.name}]\nArguments: ${typeof args === 'string' ? args : JSON.stringify(args, null, 2)}`;
                  }
                  if (b.type === 'tool_result') {
                    const resultContent = typeof b.content === 'string' ? b.content : JSON.stringify(b.content, null, 2);
                    const truncated = resultContent.length > 500 ? resultContent.substring(0, 500) + '... [truncated]' : resultContent;
                    return `[Tool Result: ${b.tool_use_id}]\n${truncated}`;
                  }
                  return JSON.stringify(b, null, 2);
                }
                return String(block);
              }).join('\n\n');
            } else if (itemContent && typeof itemContent === 'object') {
              content = JSON.stringify(itemContent, null, 2);
            }
          }
        } else {
          // Other input item types
          content = JSON.stringify(item, null, 2);
        }

        if (content) {
          components.push({
            name,
            content,
            tokenEstimate: Math.ceil(content.length / 4),
          });
        }
      }

      // Build raw context representation
      const rawContext = components.map(c => {
        const separator = '='.repeat(60);
        return `${separator}\n## ${c.name} (~${c.tokenEstimate} tokens)\n${separator}\n\n${c.content}`;
      }).join('\n\n');

      const totalTokens = prepared.budget.totalUsed;

      return {
        available: true,
        components,
        totalTokens,
        rawContext,
      };
    } catch (error) {
      console.error('Error getting prepared context for instance:', error);
      return {
        available: false,
        components: [],
        totalTokens: 0,
        rawContext: `Error: ${error}`,
      };
    }
  }

  /**
   * Force compaction of the context
   * Useful when auto-compaction hasn't triggered but context is high
   */
  async forceCompaction(): Promise<{ success: boolean; tokensFreed: number; error?: string }> {
    if (!this.agent) {
      return { success: false, tokensFreed: 0, error: 'No agent initialized' };
    }

    try {
      // NextGen uses calculateBudget() instead of getLastBudget()
      const ctx = this.agent.context as AgentContextNextGen;
      const beforeBudget = await ctx.calculateBudget();
      const beforeUsed = beforeBudget.totalUsed;

      // prepare() triggers compaction if above threshold
      await ctx.prepare();

      const afterBudget = await ctx.calculateBudget();
      const afterUsed = afterBudget.totalUsed;
      const tokensFreed = Math.max(0, beforeUsed - afterUsed);

      return {
        success: true,
        tokensFreed,
      };
    } catch (error) {
      console.error('Error forcing compaction:', error);
      return {
        success: false,
        tokensFreed: 0,
        error: String(error),
      };
    }
  }

  // ============ Multimedia - Image Generation ============

  /**
   * Get available image models based on configured connectors
   */
  getAvailableImageModels(): Array<{
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
  }> {
    // Get vendors from configured connectors
    const configuredVendors = new Set(
      Array.from(this.connectors.values()).map((c) => c.vendor)
    );

    // Get all active image models
    const allModels = getActiveImageModels();

    // Filter to only show models for configured vendors
    // Map vendor names to match what's stored in connectors
    const vendorMapping: Record<string, string[]> = {
      openai: ['openai'],
      google: ['google', 'google-vertex'],
      grok: ['grok'],
    };

    return allModels
      .filter((model) => {
        const modelVendor = model.provider.toLowerCase();
        // Check if any configured vendor matches this model's vendor
        return Array.from(configuredVendors).some((configuredVendor) => {
          const mapped = vendorMapping[configuredVendor] || [configuredVendor];
          return mapped.includes(modelVendor);
        });
      })
      .map((model) => ({
        name: model.name,
        displayName: model.displayName,
        vendor: model.provider.toLowerCase(),
        description: model.description,
        deprecationDate: model.deprecationDate,
        maxPromptLength: model.capabilities.limits.maxPromptLength,
        maxImagesPerRequest: model.capabilities.maxImagesPerRequest,
        pricing: model.pricing,
      }));
  }

  /**
   * Get capabilities for a specific image model
   */
  getImageModelCapabilities(modelName: string): {
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
  } | null {
    const model = getImageModelInfo(modelName);
    if (!model) return null;

    return model.capabilities;
  }

  /**
   * Calculate estimated cost for image generation
   */
  calculateImageCost(
    modelName: string,
    imageCount: number,
    quality: 'standard' | 'hd' = 'standard'
  ): number | null {
    return calculateImageCost(modelName, imageCount, quality);
  }

  /**
   * Generate an image using the specified model
   */
  async generateImage(options: {
    model: string;
    prompt: string;
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
    [key: string]: unknown;
  }): Promise<{
    success: boolean;
    data?: {
      images: Array<{
        b64_json?: string;
        url?: string;
        revisedPrompt?: string;
      }>;
    };
    error?: string;
  }> {
    try {
      // Get the model info to determine the vendor
      const modelInfo = getImageModelInfo(options.model);
      if (!modelInfo) {
        return { success: false, error: `Unknown model: ${options.model}` };
      }

      const vendor = modelInfo.provider.toLowerCase();

      // Find a connector for this vendor
      const connector = Array.from(this.connectors.values()).find(
        (c) => c.vendor.toLowerCase() === vendor
      );

      if (!connector) {
        return {
          success: false,
          error: `No connector configured for vendor: ${vendor}`,
        };
      }

      // Ensure connector is registered with the library
      if (!Connector.has(connector.name)) {
        Connector.create({
          name: connector.name,
          vendor: connector.vendor as Vendor,
          auth: connector.auth,
          baseURL: connector.baseURL,
        });
      }

      // Create ImageGeneration instance
      const imageGen = ImageGeneration.create({ connector: connector.name });

      // Extract standard options
      const { model, prompt, size, quality, style, n, ...vendorOptions } = options;

      // Generate image
      const response = await imageGen.generate({
        model,
        prompt,
        size,
        quality: quality as 'standard' | 'hd' | undefined,
        style: style as 'vivid' | 'natural' | undefined,
        n,
        response_format: 'b64_json',
        // Pass vendor-specific options
        ...vendorOptions,
      });

      // Map response to our format
      return {
        success: true,
        data: {
          images: response.data.map((img) => ({
            b64_json: img.b64_json,
            url: img.url,
            revisedPrompt: img.revised_prompt,
          })),
        },
      };
    } catch (error) {
      console.error('Error generating image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============ Multimedia - Video Generation ============

  /**
   * Get available video models based on configured connectors
   */
  getAvailableVideoModels(): Array<{
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
  }> {
    // Get vendors from configured connectors
    const configuredVendors = new Set(
      Array.from(this.connectors.values()).map((c) => c.vendor)
    );

    // Get all active video models
    const allModels = getActiveVideoModels();

    // Map vendor names to match what's stored in connectors
    const vendorMapping: Record<string, string[]> = {
      openai: ['openai'],
      google: ['google', 'google-vertex'],
      grok: ['grok'],
    };

    return allModels
      .filter((model) => {
        const modelVendor = model.provider.toLowerCase();
        // Check if any configured vendor matches this model's vendor
        return Array.from(configuredVendors).some((configuredVendor) => {
          const mapped = vendorMapping[configuredVendor] || [configuredVendor];
          return mapped.includes(modelVendor);
        });
      })
      .map((model) => ({
        name: model.name,
        displayName: model.displayName,
        vendor: model.provider.toLowerCase(),
        description: model.description,
        durations: model.capabilities.durations,
        resolutions: model.capabilities.resolutions,
        maxFps: model.capabilities.maxFps,
        audio: model.capabilities.audio,
        imageToVideo: model.capabilities.imageToVideo,
        pricing: model.pricing,
      }));
  }

  /**
   * Get capabilities for a specific video model
   */
  getVideoModelCapabilities(modelName: string): {
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
  } | null {
    const model = getVideoModelInfo(modelName);
    if (!model) return null;

    return {
      durations: model.capabilities.durations,
      resolutions: model.capabilities.resolutions,
      aspectRatios: model.capabilities.aspectRatios,
      maxFps: model.capabilities.maxFps,
      audio: model.capabilities.audio,
      imageToVideo: model.capabilities.imageToVideo,
      videoExtension: model.capabilities.videoExtension,
      frameControl: model.capabilities.frameControl,
      features: model.capabilities.features,
      pricing: model.pricing,
    };
  }

  /**
   * Calculate estimated cost for video generation
   */
  calculateVideoCost(modelName: string, durationSeconds: number): number | null {
    return calculateVideoCost(modelName, durationSeconds);
  }

  /**
   * Start video generation - returns a job ID for polling
   */
  async generateVideo(options: {
    model: string;
    prompt: string;
    duration?: number;
    resolution?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
    image?: string; // base64 image data
    seed?: number;
    vendorOptions?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    jobId?: string;
    error?: string;
  }> {
    try {
      // Get the model info to determine the vendor
      const modelInfo = getVideoModelInfo(options.model);
      if (!modelInfo) {
        return { success: false, error: `Unknown model: ${options.model}` };
      }

      const vendor = modelInfo.provider.toLowerCase();

      // Find a connector for this vendor
      const connector = Array.from(this.connectors.values()).find(
        (c) => c.vendor.toLowerCase() === vendor
      );

      if (!connector) {
        return {
          success: false,
          error: `No connector configured for vendor: ${vendor}`,
        };
      }

      // Ensure connector is registered with the library
      if (!Connector.has(connector.name)) {
        Connector.create({
          name: connector.name,
          vendor: connector.vendor as Vendor,
          auth: connector.auth,
          baseURL: connector.baseURL,
        });
      }

      // Create VideoGeneration instance
      const videoGen = VideoGeneration.create({ connector: connector.name });

      // Convert base64 image to Buffer if provided
      let imageBuffer: Buffer | undefined;
      if (options.image) {
        // Remove data URL prefix if present
        const base64Data = options.image.startsWith('data:')
          ? options.image.split(',')[1]
          : options.image;
        imageBuffer = Buffer.from(base64Data, 'base64');
      }

      // Start video generation
      const response = await videoGen.generate({
        model: options.model,
        prompt: options.prompt,
        duration: options.duration,
        resolution: options.resolution,
        aspectRatio: options.aspectRatio,
        image: imageBuffer,
        seed: options.seed,
        vendorOptions: options.vendorOptions,
      });

      // Store the job for later status checks
      this.activeVideoJobs.set(response.jobId, {
        connectorName: connector.name,
        videoGen,
      });

      return {
        success: true,
        jobId: response.jobId,
      };
    } catch (error) {
      console.error('Error starting video generation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get the status of a video generation job
   */
  async getVideoStatus(jobId: string): Promise<{
    success: boolean;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    video?: {
      url?: string;
      duration?: number;
    };
    error?: string;
  }> {
    try {
      const job = this.activeVideoJobs.get(jobId);
      if (!job) {
        return { success: false, error: `Job not found: ${jobId}` };
      }

      const status = await job.videoGen.getStatus(jobId);

      return {
        success: true,
        status: status.status,
        progress: status.progress,
        video: status.video ? {
          url: status.video.url,
          duration: status.video.duration,
        } : undefined,
        error: status.error,
      };
    } catch (error) {
      console.error('Error getting video status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Download a completed video as base64
   */
  async downloadVideo(jobId: string): Promise<{
    success: boolean;
    data?: string; // base64 encoded video
    mimeType?: string;
    error?: string;
  }> {
    try {
      const job = this.activeVideoJobs.get(jobId);
      if (!job) {
        return { success: false, error: `Job not found: ${jobId}` };
      }

      const videoBuffer = await job.videoGen.download(jobId);

      // Clean up the job after download
      this.activeVideoJobs.delete(jobId);

      return {
        success: true,
        data: videoBuffer.toString('base64'),
        mimeType: 'video/mp4',
      };
    } catch (error) {
      console.error('Error downloading video:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Cancel a video generation job
   */
  async cancelVideoJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const job = this.activeVideoJobs.get(jobId);
      if (!job) {
        return { success: false, error: `Job not found: ${jobId}` };
      }

      await job.videoGen.cancel(jobId);
      this.activeVideoJobs.delete(jobId);

      return { success: true };
    } catch (error) {
      console.error('Error canceling video job:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============ Multimedia - Text-to-Speech ============

  /**
   * Get available TTS models based on configured connectors
   */
  getAvailableTTSModels(): Array<{
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
  }> {
    // Get vendors from configured connectors
    const configuredVendors = new Set(
      Array.from(this.connectors.values()).map((c) => c.vendor)
    );

    // Get all active TTS models
    const allModels = getActiveTTSModels();

    // Map vendor names to match what's stored in connectors
    const vendorMapping: Record<string, string[]> = {
      openai: ['openai'],
      google: ['google', 'google-vertex'],
    };

    return allModels
      .filter((model) => {
        const modelVendor = model.provider.toLowerCase();
        // Check if any configured vendor matches this model's vendor
        return Array.from(configuredVendors).some((configuredVendor) => {
          const mapped = vendorMapping[configuredVendor] || [configuredVendor];
          return mapped.includes(modelVendor);
        });
      })
      .map((model) => ({
        name: model.name,
        displayName: model.displayName,
        vendor: model.provider.toLowerCase(),
        description: model.description,
        maxInputLength: model.capabilities.limits.maxInputLength,
        voiceCount: model.capabilities.voices.length,
        pricing: model.pricing,
      }));
  }

  /**
   * Get capabilities for a specific TTS model
   */
  getTTSModelCapabilities(modelName: string): {
    voices: IVoiceInfo[];
    formats: readonly string[] | string[];
    languages: readonly string[] | string[];
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
  } | null {
    const model = getTTSModelInfo(modelName);
    if (!model) return null;

    return model.capabilities;
  }

  /**
   * Calculate estimated cost for TTS
   */
  calculateTTSCost(modelName: string, characterCount: number): number | null {
    return calculateTTSCost(modelName, characterCount);
  }

  /**
   * Synthesize speech from text
   */
  async synthesizeSpeech(options: {
    model: string;
    text: string;
    voice: string;
    format?: string;
    speed?: number;
    vendorOptions?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    data?: {
      audio: string; // base64 encoded
      format: string;
    };
    error?: string;
  }> {
    try {
      // Get the model info to determine the vendor
      const modelInfo = getTTSModelInfo(options.model);
      if (!modelInfo) {
        return { success: false, error: `Unknown TTS model: ${options.model}` };
      }

      const vendor = modelInfo.provider.toLowerCase();

      // Find a connector for this vendor
      const connector = Array.from(this.connectors.values()).find(
        (c) => c.vendor.toLowerCase() === vendor
      );

      if (!connector) {
        return {
          success: false,
          error: `No connector configured for vendor: ${vendor}`,
        };
      }

      // Ensure connector is registered with the library
      if (!Connector.has(connector.name)) {
        Connector.create({
          name: connector.name,
          vendor: connector.vendor as Vendor,
          auth: connector.auth,
          baseURL: connector.baseURL,
        });
      }

      // Create TextToSpeech instance
      const tts = TextToSpeech.create({
        connector: connector.name,
        model: options.model,
      });

      // Synthesize speech
      const response = await tts.synthesize(options.text, {
        voice: options.voice,
        format: options.format as any,
        speed: options.speed,
        vendorOptions: options.vendorOptions,
      });

      return {
        success: true,
        data: {
          audio: response.audio.toString('base64'),
          format: response.format,
        },
      };
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

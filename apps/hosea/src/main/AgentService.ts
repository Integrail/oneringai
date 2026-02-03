/**
 * AgentService - Manages the @oneringai/agents integration
 *
 * This service bridges Electron IPC with the agent library.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  Connector,
  Vendor,
  UniversalAgent,
  ImageGeneration,
  VideoGeneration,
  getModelsByVendor,
  getModelInfo,
  getToolByName,
  FileContextStorage,
  FileAgentDefinitionStorage,
  ToolRegistry,
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
  type MCPServerConfig,
  type IMCPClient,
  type VendorInfo,
  type VendorTemplate,
  type VendorLogo,
  type AuthTemplate,
  type ITTSModelDescription,
  type IVoiceInfo,
  type ToolFunction,
  type UniversalAgentConfig,
  type UniversalEvent,
  type IContextStorage,
  type IAgentDefinitionStorage,
  type StoredAgentDefinition,
  type ToolRegistryEntry,
  type ConnectorToolEntry,
  type ILLMDescription,
  type LogLevel,
  type IImageModelDescription,
  type IVideoModelDescription,
} from '@oneringai/agents';

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
 * Stored Agent Configuration
 */
export interface StoredAgentConfig {
  id: string;
  name: string;
  connector: string;
  model: string;
  agentType: 'basic' | 'task' | 'research' | 'universal';
  instructions: string;
  temperature: number;
  // Context settings
  contextStrategy: string;
  maxContextTokens: number;
  responseReserve: number;
  // Memory settings
  memoryEnabled: boolean;
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
  // History settings
  historyEnabled: boolean;
  maxHistoryMessages: number;
  preserveRecent: number;
  // Cache settings
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheMaxEntries: number;
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
  | { type: 'needs:approval'; plan: Plan };

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

export class AgentService {
  private dataDir: string;
  private isDev: boolean;
  private agent: UniversalAgent | null = null;
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

  // ============ Conversion Helpers ============

  /**
   * Convert Hosea's StoredAgentConfig to library's StoredAgentDefinition
   */
  private toStoredDefinition(config: StoredAgentConfig): StoredAgentDefinition {
    return {
      version: 1,
      agentId: config.id,
      name: config.name,
      agentType: config.agentType === 'basic' ? 'agent' : `${config.agentType}-agent`,
      createdAt: new Date(config.createdAt).toISOString(),
      updatedAt: new Date(config.updatedAt).toISOString(),
      connector: {
        name: config.connector,
        model: config.model,
      },
      instructions: config.instructions,
      features: {
        memory: config.memoryEnabled,
        inContextMemory: config.inContextMemoryEnabled,
        persistentInstructions: config.persistentInstructionsEnabled,
        history: config.historyEnabled,
        permissions: config.permissionsEnabled,
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

    // Map agent type back to Hosea's format
    let agentType: StoredAgentConfig['agentType'] = 'universal';
    if (definition.agentType === 'agent') {
      agentType = 'basic';
    } else if (definition.agentType === 'task-agent') {
      agentType = 'task';
    } else if (definition.agentType === 'research-agent') {
      agentType = 'research';
    } else if (definition.agentType === 'universal-agent') {
      agentType = 'universal';
    }

    return {
      id: definition.agentId,
      name: definition.name,
      connector: definition.connector.name,
      model: definition.connector.model,
      agentType,
      instructions: definition.instructions ?? '',
      temperature: (typeConfig.temperature as number) ?? 0.7,
      contextStrategy: (typeConfig.contextStrategy as string) ?? 'proactive',
      maxContextTokens: (typeConfig.maxContextTokens as number) ?? 128000,
      responseReserve: (typeConfig.responseReserve as number) ?? 4096,
      memoryEnabled: features.memory ?? true,
      maxMemorySizeBytes: (typeConfig.maxMemorySizeBytes as number) ?? 25 * 1024 * 1024,
      maxMemoryIndexEntries: (typeConfig.maxMemoryIndexEntries as number) ?? 30,
      memorySoftLimitPercent: (typeConfig.memorySoftLimitPercent as number) ?? 80,
      contextAllocationPercent: (typeConfig.contextAllocationPercent as number) ?? 10,
      inContextMemoryEnabled: features.inContextMemory ?? false,
      maxInContextEntries: (typeConfig.maxInContextEntries as number) ?? 20,
      maxInContextTokens: (typeConfig.maxInContextTokens as number) ?? 4000,
      persistentInstructionsEnabled: features.persistentInstructions ?? false,
      historyEnabled: features.history ?? true,
      maxHistoryMessages: (typeConfig.maxHistoryMessages as number) ?? 100,
      preserveRecent: (typeConfig.preserveRecent as number) ?? 10,
      cacheEnabled: (typeConfig.cacheEnabled as boolean) ?? true,
      cacheTtlMs: (typeConfig.cacheTtlMs as number) ?? 300000,
      cacheMaxEntries: (typeConfig.cacheMaxEntries as number) ?? 1000,
      permissionsEnabled: features.permissions ?? true,
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

      // Create agent with UI capabilities prompt
      const agentConfig: UniversalAgentConfig = {
        connector: connectorName,
        model,
        instructions: HOSEA_UI_CAPABILITIES_PROMPT,
        session: {
          storage: this.sessionStorage,
        },
      };

      this.agent = UniversalAgent.create(agentConfig);

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
      const response = await this.agent.chat(message);
      return { success: true, response: response.text };
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
        const e = event as UniversalEvent;

        // Detect plan mode transitions to control text suppression
        if (e.type === 'plan:analyzing' || e.type === 'plan:created') {
          suppressText = true;
        } else if (e.type === 'plan:approved' || e.type === 'mode:changed') {
          // Resume text when plan is approved or mode changes
          const modeEvent = e as any;
          if (e.type === 'mode:changed' && modeEvent.to === 'executing') {
            // Keep suppressing during execution - task events will show progress
          } else if (e.type === 'mode:changed' && modeEvent.to === 'interactive') {
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
            yield { type: 'text', content: e.delta };
          }
        } else if (e.type === 'tool:start') {
          // Get tool description using describeCall or defaultDescribeCall
          const args = (e.args || {}) as Record<string, unknown>;
          const tool = this.agent?.tools?.get(e.name);
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
            tool: e.name,
            args,
            description,
          };
        } else if (e.type === 'tool:complete') {
          yield {
            type: 'tool_end',
            tool: e.name,
            durationMs: e.durationMs,
          };
        } else if (e.type === 'tool:error') {
          yield {
            type: 'tool_error',
            tool: e.name,
            error: e.error,
          };
        } else if (e.type === 'text:done') {
          yield { type: 'done' };
        } else if (e.type === 'error') {
          yield { type: 'error', content: e.error };
        }
        // Plan events from UniversalAgent
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
    // UniversalAgent accepts approval via stream - send approval message
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
      mode: this.agent?.getMode() || null,
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

      // Resolve tool names to actual ToolFunction objects
      const tools: ToolFunction[] = [];
      for (const toolName of agentConfig.tools) {
        const toolEntry = getToolByName(toolName);
        if (toolEntry) {
          tools.push(toolEntry.tool);
        } else {
          console.warn(`Tool "${toolName}" not found in registry`);
        }
      }

      // Combine user instructions with UI capabilities prompt (user instructions first)
      const fullInstructions = (agentConfig.instructions || '') + '\n\n' + HOSEA_UI_CAPABILITIES_PROMPT;

      // Create agent with full configuration including context features
      // NOTE: All context settings (features, memory, cache, etc.) are passed through
      // the `context` property, which is passed to AgentContext.create()
      const config: UniversalAgentConfig = {
        connector: agentConfig.connector,
        model: agentConfig.model,
        name: agentConfig.name,
        tools,
        instructions: fullInstructions,
        temperature: agentConfig.temperature,
        session: {
          storage: this.sessionStorage,
        },
        // Context configuration - this is the SINGLE source of truth for all context settings
        context: {
          // Agent ID - CRITICAL for persistent instructions to work across restarts
          agentId: agentConfig.id,
          // Feature toggles - controls which components are created and which tools are registered
          features: {
            memory: agentConfig.memoryEnabled,
            inContextMemory: agentConfig.inContextMemoryEnabled,
            persistentInstructions: agentConfig.persistentInstructionsEnabled ?? false,
            history: agentConfig.historyEnabled,
            permissions: agentConfig.permissionsEnabled,
          },
          // Context management
          strategy: agentConfig.contextStrategy as 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive',
          maxContextTokens: agentConfig.maxContextTokens,
          // Working memory config (only used if features.memory is true)
          memory: agentConfig.memoryEnabled
            ? {
                maxSizeBytes: agentConfig.maxMemorySizeBytes,
                maxIndexEntries: agentConfig.maxMemoryIndexEntries,
                descriptionMaxLength: 150, // Default value
                softLimitPercent: agentConfig.memorySoftLimitPercent,
                contextAllocationPercent: agentConfig.contextAllocationPercent,
              }
            : undefined,
          // In-context memory config (only used if features.inContextMemory is true)
          inContextMemory: agentConfig.inContextMemoryEnabled
            ? {
                maxEntries: agentConfig.maxInContextEntries,
                maxTotalTokens: agentConfig.maxInContextTokens,
              }
            : undefined,
          // History config (only used if features.history is true)
          history: agentConfig.historyEnabled
            ? {
                maxMessages: agentConfig.maxHistoryMessages,
                preserveRecent: agentConfig.preserveRecent,
              }
            : undefined,
          // Cache config
          cache: {
            enabled: agentConfig.cacheEnabled,
            defaultTtlMs: agentConfig.cacheTtlMs,
            maxEntries: agentConfig.cacheMaxEntries,
          },
        },
      };

      this.agent = UniversalAgent.create(config);

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
      agentType: 'universal' as const,
      instructions: 'You are a helpful AI assistant. Use the rich formatting capabilities available to you (charts, diagrams, tables, code highlighting) to provide clear and visually informative responses when appropriate.',
      temperature: 0.7,
      contextStrategy: 'proactive',
      maxContextTokens: 128000,
      responseReserve: 4096,
      memoryEnabled: true,
      maxMemorySizeBytes: 25 * 1024 * 1024,
      maxMemoryIndexEntries: 30,
      memorySoftLimitPercent: 80,
      contextAllocationPercent: 10,
      inContextMemoryEnabled: false,
      maxInContextEntries: 20,
      maxInContextTokens: 4000,
      persistentInstructionsEnabled: false,
      historyEnabled: true,
      maxHistoryMessages: 100,
      preserveRecent: 10,
      cacheEnabled: true,
      cacheTtlMs: 300000,
      cacheMaxEntries: 1000,
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

      // Resume from session with UI capabilities
      this.agent = await UniversalAgent.resume(sessionId, {
        connector: this.config.activeConnector!,
        model: this.config.activeModel!,
        instructions: HOSEA_UI_CAPABILITIES_PROMPT,
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
    description: string;
    safeByDefault: boolean;
    requiresConnector: boolean;
    connectorServiceTypes?: string[];
    connectorName?: string;
    serviceType?: string;
  }[] {
    const allTools = ToolRegistry.getAllTools();
    return allTools.map((entry: ToolRegistryEntry | ConnectorToolEntry) => ({
      name: entry.name,
      displayName: entry.displayName,
      category: entry.category,
      description: entry.description,
      safeByDefault: entry.safeByDefault,
      requiresConnector: entry.requiresConnector || false,
      connectorServiceTypes: entry.connectorServiceTypes,
      connectorName: (entry as ConnectorToolEntry).connectorName,
      serviceType: (entry as ConnectorToolEntry).serviceType,
    }));
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
    this.agent?.destroy();
    this.agent = null;
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
  }> {
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
      };
    }

    try {
      const ctx = this.agent.context;
      const metrics = await ctx.getMetrics();
      const state = await ctx.getState();

      // Get context stats - use actual budget from context
      const lastBudget = ctx.getLastBudget();
      const contextStats = {
        totalTokens: lastBudget?.used ?? Math.round((metrics.utilizationPercent / 100) * (state.config?.maxContextTokens || 128000)),
        maxTokens: state.config?.maxContextTokens || 128000,
        utilizationPercent: metrics.utilizationPercent,
        messagesCount: metrics.historyMessageCount,
        toolCallsCount: metrics.toolCallCount,
        strategy: state.config?.strategy || 'proactive',
      };

      // Get cache stats
      const cacheStats = metrics.cacheStats ? {
        entries: metrics.cacheStats.entries,
        hits: metrics.cacheStats.hits,
        misses: metrics.cacheStats.misses,
        hitRate: metrics.cacheStats.hitRate,
        ttlMs: 300000, // Default TTL from CACHE_DEFAULTS
      } : null;

      // Get memory stats and entries
      let memoryData = null;
      if (ctx.memory) {
        const memStats = await ctx.memory.getStats();
        const memIndex = await ctx.memory.getIndex();
        memoryData = {
          totalEntries: memStats.totalEntries,
          totalSizeBytes: memStats.totalSizeBytes,
          utilizationPercent: memStats.utilizationPercent,
          entries: memIndex.entries.map((e) => ({
            key: e.key,
            description: e.description,
            scope: String(typeof e.scope === 'object' ? JSON.stringify(e.scope) : e.scope),
            priority: e.effectivePriority,
            sizeBytes: 0, // Size is in human format in index, we don't have bytes
            updatedAt: Date.now(), // Index doesn't have updatedAt
          })),
        };
      }

      // Get in-context memory - always return data so UI can show status
      // Check if feature is enabled via context
      const inContextEnabled = ctx.isFeatureEnabled('inContextMemory');
      const inContextPlugin = ctx.inContextMemory;

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
        // Try to get config from plugin if available
        const pluginConfig = (inContextPlugin as unknown as { config?: { maxEntries?: number; maxTotalTokens?: number } }).config;
        inContextData = {
          enabled: true,
          entries: entries.map((e) => ({
            key: e.key,
            description: e.description,
            priority: e.priority,
            updatedAt: e.updatedAt,
            value: inContextPlugin.get(e.key),
          })),
          maxEntries: pluginConfig?.maxEntries ?? 20,
          maxTokens: pluginConfig?.maxTotalTokens ?? 4000,
        };
      }

      // Get tools with stats
      const toolStats = this.agent.tools.getStats();
      const allTools = this.agent.tools.getAll();
      const toolsWithStats = allTools.map((tool: ToolFunction) => {
        const name = tool.definition.function.name;
        const usageInfo = toolStats.mostUsed.find((u: { name: string; count: number }) => u.name === name);
        return {
          name,
          description: tool.definition.function.description || '',
          enabled: this.agent!.tools.isEnabled(name),
          callCount: usageInfo?.count || 0,
          namespace: undefined, // Could be extracted from registry if needed
        };
      });

      // Get tool call history from context state
      const toolCalls = state.core.toolCalls.map((tc: { id: string; name: string; args: unknown; result?: unknown; error?: string; durationMs?: number; timestamp?: number }, index: number) => ({
        id: tc.id || `tc_${index}`,
        name: tc.name,
        args: tc.args,
        result: tc.result,
        error: tc.error,
        durationMs: tc.durationMs || 0,
        timestamp: tc.timestamp || Date.now(),
      }));

      // Get active agent config for name
      const activeAgent = this.getActiveAgent();

      // Get system prompt from context
      const systemPrompt = ctx.systemPrompt || null;

      // Get persistent instructions - always return data for the UI to show status
      const agentId = activeAgent?.id || 'default';
      let persistentInstructionsData: {
        content: string;
        path: string;
        length: number;
        enabled: boolean;
      };
      if (ctx.persistentInstructions) {
        const component = await ctx.persistentInstructions.getComponent();
        // Component content can be string or unknown, ensure we get a string
        const contentStr = typeof component?.content === 'string' ? component.content : '';
        persistentInstructionsData = {
          content: contentStr,
          path: join(this.dataDir, 'agents', `${agentId}-instructions.md`),
          length: contentStr.length,
          enabled: true,
        };
      } else {
        // Feature is disabled - still return data so UI can show "disabled" status
        persistentInstructionsData = {
          content: '',
          path: join(this.dataDir, 'agents', `${agentId}-instructions.md`),
          length: 0,
          enabled: false,
        };
      }

      // Build token breakdown from budget
      let tokenBreakdown: {
        total: number;
        reserved: number;
        used: number;
        available: number;
        components: Array<{ name: string; tokens: number; percent: number }>;
      } | null = null;

      if (lastBudget && lastBudget.breakdown) {
        const components = Object.entries(lastBudget.breakdown)
          .map(([name, tokens]) => ({
            name: name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            tokens,
            percent: lastBudget.used > 0 ? (tokens / lastBudget.used) * 100 : 0,
          }))
          .sort((a, b) => b.tokens - a.tokens);

        tokenBreakdown = {
          total: lastBudget.total,
          reserved: lastBudget.reserved,
          used: lastBudget.used,
          available: lastBudget.available,
          components,
        };
      }

      return {
        available: true,
        agentName: activeAgent?.name || 'Default Assistant',
        context: contextStats,
        cache: cacheStats,
        memory: memoryData,
        inContextMemory: inContextData,
        tools: toolsWithStats,
        toolCalls: toolCalls.slice(-50), // Last 50 tool calls
        systemPrompt,
        persistentInstructions: persistentInstructionsData,
        tokenBreakdown,
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
      };
    }
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
      const ctx = this.agent.context;
      const metrics = await ctx.getMetrics();
      const state = await ctx.getState();

      return {
        available: true,
        totalTokens: Math.round((metrics.utilizationPercent / 100) * (state.config?.maxContextTokens || 128000)),
        maxTokens: state.config?.maxContextTokens || 128000,
        utilizationPercent: metrics.utilizationPercent,
        messagesCount: metrics.historyMessageCount,
        toolCallsCount: metrics.toolCallCount,
        strategy: state.config?.strategy || 'proactive',
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
    if (!this.agent?.context.memory) {
      return [];
    }

    try {
      const memIndex = await this.agent.context.memory.getIndex();
      const result = [];
      for (const entry of memIndex.entries) {
        // Optionally get the value (may be expensive for large entries)
        const value = await this.agent.context.memory.retrieve(entry.key);
        result.push({
          key: entry.key,
          description: entry.description,
          scope: String(typeof entry.scope === 'object' ? JSON.stringify(entry.scope) : entry.scope),
          priority: entry.effectivePriority,
          sizeBytes: 0, // Not available from index
          updatedAt: Date.now(),
          value,
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
   * This shows all components assembled: system prompt, plugins, memory index, history, etc.
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
      const ctx = this.agent.context;

      // Prepare context (this assembles all components exactly as sent to LLM)
      const prepared = await ctx.prepare({ returnFormat: 'components' });

      // Get individual components for detailed view
      // NOTE: prepared.components already contains everything in the correct order:
      // system_prompt, instructions, feature_instructions, conversation_history, memory_index, plugins, etc.
      const components: Array<{ name: string; content: string; tokenEstimate: number }> = [];

      // Map component names to more user-friendly display names
      const displayNames: Record<string, string> = {
        'system_prompt': 'System Prompt',
        'instructions': 'Instructions',
        'feature_instructions': 'Feature Instructions',
        'conversation_history': 'Conversation History',
        'memory_index': 'Memory Index',
        'in_context_memory': 'In-Context Memory',
        'persistent_instructions': 'Persistent Instructions',
        'plan': 'Current Plan',
        'current_input': 'Current Input',
      };

      for (const component of prepared.components || []) {
        // Component content can be string or unknown
        const contentStr = typeof component.content === 'string'
          ? component.content
          : JSON.stringify(component.content, null, 2);
        if (contentStr) {
          components.push({
            name: displayNames[component.name] || component.name || 'Component',
            content: contentStr,
            tokenEstimate: Math.ceil(contentStr.length / 4),
          });
        }
      }

      // Build raw context representation
      const rawContext = components.map(c => {
        const separator = '='.repeat(60);
        return `${separator}\n## ${c.name} (~${c.tokenEstimate} tokens)\n${separator}\n\n${c.content}`;
      }).join('\n\n');

      const totalTokens = components.reduce((sum, c) => sum + c.tokenEstimate, 0);

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
   * Force compaction of the context
   * Useful when auto-compaction hasn't triggered but context is high
   */
  async forceCompaction(): Promise<{ success: boolean; tokensFreed: number; error?: string }> {
    if (!this.agent) {
      return { success: false, tokensFreed: 0, error: 'No agent initialized' };
    }

    try {
      const ctx = this.agent.context;
      // Get current budget before compaction
      const beforeBudget = ctx.getLastBudget();
      const beforeUsed = beforeBudget?.used ?? 0;

      // Force prepare which will trigger compaction if needed
      // We use prepare() with autoCompact enabled - but let's manually call compactConversation
      // Actually, we need to access the internal compact method. Let's use prepare()
      // and check if compaction happened
      const result = await ctx.prepare();

      // Get budget after
      const afterBudget = ctx.getLastBudget();
      const afterUsed = afterBudget?.used ?? 0;
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

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
  getModelsByVendor,
  getModelInfo,
  getToolByName,
  FileContextStorage,
  FileAgentDefinitionStorage,
  getToolRegistry,
  logger,
  defaultDescribeCall,
  type ToolFunction,
  type UniversalAgentConfig,
  type UniversalEvent,
  type IContextStorage,
  type IAgentDefinitionStorage,
  type StoredAgentDefinition,
  type ToolRegistryEntry,
  type ILLMDescription,
  type LogLevel,
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
 * Stream chunk types for IPC communication
 */
export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown>; description: string }
  | { type: 'tool_end'; tool: string; durationMs?: number }
  | { type: 'tool_error'; tool: string; error: string }
  | { type: 'done' }
  | { type: 'error'; content: string };

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
  private agents: Map<string, StoredAgentConfig> = new Map();
  private sessionStorage: IContextStorage | null = null;
  private agentDefinitionStorage: IAgentDefinitionStorage;

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
    await this.loadAgents();
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
    const dirs = ['connectors', 'api-connectors', 'agents', 'sessions', 'logs'];
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

    try {
      for await (const event of this.agent.stream(message)) {
        const e = event as UniversalEvent;

        if (e.type === 'text:delta') {
          yield { type: 'text', content: e.delta };
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
      }
    } catch (error) {
      yield { type: 'error', content: String(error) };
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

      // Combine UI capabilities prompt with agent instructions
      const fullInstructions = HOSEA_UI_CAPABILITIES_PROMPT + (agentConfig.instructions || '');

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
   * Get all available tools from the registry (not just agent tools)
   */
  getAvailableTools(): {
    name: string;
    displayName: string;
    category: string;
    description: string;
    safeByDefault: boolean;
    requiresConnector: boolean;
    connectorServiceTypes?: string[];
  }[] {
    const registry = getToolRegistry();
    return registry.map((entry: ToolRegistryEntry) => ({
      name: entry.name,
      displayName: entry.displayName,
      category: entry.category,
      description: entry.description,
      safeByDefault: entry.safeByDefault,
      requiresConnector: entry.requiresConnector || false,
      connectorServiceTypes: entry.connectorServiceTypes,
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
      };
    }

    try {
      const ctx = this.agent.context;
      const metrics = await ctx.getMetrics();
      const state = await ctx.getState();

      // Get context stats
      const contextStats = {
        totalTokens: Math.round((metrics.utilizationPercent / 100) * (state.config?.maxContextTokens || 128000)),
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

      // Get in-context memory if available (use direct accessor on ctx)
      let inContextData = null;
      const inContextPlugin = ctx.inContextMemory;
      if (inContextPlugin) {
        const entries = inContextPlugin.list();
        inContextData = {
          entries: entries.map((e) => ({
            key: e.key,
            description: e.description,
            priority: e.priority,
            updatedAt: e.updatedAt,
            value: inContextPlugin.get(e.key),
          })),
          maxEntries: 20, // Default from InContextMemoryPlugin
          maxTokens: 4000, // Default from InContextMemoryPlugin
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

      // Prepare context (this assembles all components)
      const prepared = await ctx.prepare();

      // Get individual components for detailed view
      const components: Array<{ name: string; content: string; tokenEstimate: number }> = [];

      // 1. System Prompt
      if (ctx.systemPrompt) {
        components.push({
          name: 'System Prompt',
          content: ctx.systemPrompt,
          tokenEstimate: Math.ceil(ctx.systemPrompt.length / 4), // Rough estimate
        });
      }

      // 2. Plugin components (persistent instructions, memory index, etc.)
      for (const component of prepared.components) {
        // Component content can be string or unknown
        const contentStr = typeof component.content === 'string'
          ? component.content
          : JSON.stringify(component.content, null, 2);
        if (contentStr) {
          components.push({
            name: component.name || 'Plugin',
            content: contentStr,
            tokenEstimate: Math.ceil(contentStr.length / 4),
          });
        }
      }

      // 3. Messages (conversation history) - get from context state
      // Use v2 format (InputItem[]) with fallback to v1 (HistoryMessage[]) for backward compat
      const state = await ctx.getState();
      const messages = state.core.conversation || state.core.history || [];
      if (messages.length > 0) {
        const messagesContent = messages.map((m: { type?: string; role?: string; content?: unknown }, i: number) => {
          const role = m.role || 'unknown';
          // Handle both v2 (InputItem - content is array) and v1 (HistoryMessage - content is string)
          let content: string;
          if (m.type === 'message' && Array.isArray(m.content)) {
            // v2 InputItem format: content is Content[]
            content = (m.content as Array<{ type?: string; text?: string }>)
              .map(c => c.text || JSON.stringify(c))
              .join('');
          } else {
            // v1 HistoryMessage format or fallback
            content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          }
          return `[${i + 1}] ${role.toUpperCase()}:\n${content}`;
        }).join('\n\n---\n\n');

        components.push({
          name: `Conversation History (${messages.length} messages)`,
          content: messagesContent,
          tokenEstimate: Math.ceil(messagesContent.length / 4),
        });
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
}

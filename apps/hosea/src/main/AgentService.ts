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
  FileSessionStorage,
  getToolRegistry,
  logger,
  defaultDescribeCall,
  type ToolFunction,
  type UniversalAgentConfig,
  type UniversalEvent,
  type ISessionStorage,
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
  private sessionStorage: ISessionStorage | null = null;

  /**
   * Private constructor - use AgentService.create() instead
   */
  private constructor(dataDir: string, isDev: boolean = false) {
    this.dataDir = dataDir;
    this.isDev = isDev;
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
    const agentsDir = join(this.dataDir, 'agents');
    if (!existsSync(agentsDir)) return;

    try {
      const files = await readdir(agentsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(agentsDir, file), 'utf-8');
          const config = JSON.parse(content) as StoredAgentConfig;
          this.agents.set(config.id, config);
        }
      }
    } catch {
      // Ignore errors
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

      // Initialize session storage
      this.sessionStorage = new FileSessionStorage({
        directory: join(this.dataDir, 'sessions'),
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

      // Save to file
      const filePath = join(this.dataDir, 'agents', `${id}.json`);
      await writeFile(filePath, JSON.stringify(agentConfig, null, 2));

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

      // Save to file
      const filePath = join(this.dataDir, 'agents', `${id}.json`);
      await writeFile(filePath, JSON.stringify(updated, null, 2));

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

      // Delete file
      const filePath = join(this.dataDir, 'agents', `${id}.json`);
      if (existsSync(filePath)) {
        const { unlink } = await import('node:fs/promises');
        await unlink(filePath);
      }

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
          const filePath = join(this.dataDir, 'agents', `${agentId}.json`);
          await writeFile(filePath, JSON.stringify(config, null, 2));
        }
      }

      // Activate the selected agent
      agentConfig.isActive = true;
      agentConfig.lastUsedAt = Date.now();
      const filePath = join(this.dataDir, 'agents', `${id}.json`);
      await writeFile(filePath, JSON.stringify(agentConfig, null, 2));

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

      // Initialize session storage
      this.sessionStorage = new FileSessionStorage({
        directory: join(this.dataDir, 'sessions'),
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

      // Create agent with full configuration
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
        memoryConfig: agentConfig.memoryEnabled
          ? {
              maxSizeBytes: agentConfig.maxMemorySizeBytes,
              descriptionMaxLength: 150, // Default value
              softLimitPercent: agentConfig.memorySoftLimitPercent,
              contextAllocationPercent: agentConfig.contextAllocationPercent,
            }
          : undefined,
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
      return sessions.map((s) => ({ id: s.id, createdAt: s.createdAt.getTime() }));
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

      // Get in-context memory if available
      let inContextData = null;
      const inContextPlugin = ctx.getPlugin?.('inContextMemory');
      if (inContextPlugin && 'list' in inContextPlugin && 'get' in inContextPlugin) {
        // Cast to any first to avoid strict type checking issues with plugin interface
        const icmPlugin = inContextPlugin as unknown as {
          list: () => Array<{ key: string; description: string; priority: string; updatedAt: number }>;
          get: (key: string) => unknown;
          config?: { maxEntries: number; maxTotalTokens: number }
        };
        const entries = icmPlugin.list();
        inContextData = {
          entries: entries.map((e) => ({
            key: e.key,
            description: e.description,
            priority: e.priority,
            updatedAt: e.updatedAt,
            value: icmPlugin.get(e.key),
          })),
          maxEntries: icmPlugin.config?.maxEntries || 20,
          maxTokens: icmPlugin.config?.maxTotalTokens || 4000,
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

      return {
        available: true,
        agentName: activeAgent?.name || 'Default Assistant',
        context: contextStats,
        cache: cacheStats,
        memory: memoryData,
        inContextMemory: inContextData,
        tools: toolsWithStats,
        toolCalls: toolCalls.slice(-50), // Last 50 tool calls
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
}

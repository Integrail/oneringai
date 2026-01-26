/**
 * AMOS Configuration Types
 * Type definitions for the app configuration and state
 */

import type { Vendor, ToolFunction, PermissionScope, RiskLevel } from '@oneringai/agents';

// ─────────────────────────────────────────────────────────────────────────────
// App Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface AmosConfig {
  // Current active settings
  activeConnector: string | null;
  activeModel: string | null;
  activeVendor: string | null;

  // Default settings
  defaults: {
    vendor: string;
    model: string;
    temperature: number;
    maxOutputTokens: number;
  };

  // Planning settings
  planning: {
    enabled: boolean;
    autoDetect: boolean;
    requireApproval: boolean;
  };

  // Session settings
  session: {
    autoSave: boolean;
    autoSaveIntervalMs: number;
    activeSessionId: string | null;
  };

  // UI settings
  ui: {
    showTokenUsage: boolean;
    showTiming: boolean;
    streamResponses: boolean;
    colorOutput: boolean;
  };

  // Tool settings
  tools: {
    enabledTools: string[];
    disabledTools: string[];
    customToolsDir: string;
  };

  // Tool permission settings
  permissions: {
    defaultScope: PermissionScope;
    defaultRiskLevel: RiskLevel;
    allowlist: string[];
    blocklist: string[];
    toolOverrides: Record<string, { scope?: PermissionScope; riskLevel?: RiskLevel }>;
    promptForApproval: boolean; // Interactive approval prompts
  };

  // Prompt template settings
  prompts: {
    promptsDir: string;
    activePrompt: string | null;
  };

  // Developer tools settings
  developerTools: {
    enabled: boolean;
    workingDirectory: string;
    allowedDirectories: string[];
    blockedDirectories: string[];
    blockedCommands: string[];
    commandTimeout: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Connector Configuration (stored in data/connectors/)
// ─────────────────────────────────────────────────────────────────────────────

export interface StoredConnectorConfig {
  name: string;
  vendor: string;
  auth: ConnectorAuth;
  baseURL?: string;
  options?: Record<string, unknown>;
  models?: string[]; // Available models for this connector
  createdAt: number;
  updatedAt: number;
}

export interface ConnectorAuth {
  type: 'api_key' | 'oauth' | 'jwt';
  apiKey?: string;
  // OAuth fields
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  authorizationUrl?: string;
  redirectUri?: string;
  scope?: string;
  // JWT fields
  privateKey?: string;
  issuer?: string;
  subject?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command System Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandContext {
  app: IAmosApp;
  args: string[];
  rawInput: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  shouldExit?: boolean;
  clearScreen?: boolean;
}

export interface ICommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  execute(context: CommandContext): Promise<CommandResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// App Interface (for dependency injection)
// ─────────────────────────────────────────────────────────────────────────────

export interface IAmosApp {
  // Configuration
  getConfig(): AmosConfig;
  updateConfig(partial: Partial<AmosConfig>): void;
  saveConfig(): Promise<void>;

  // Connectors
  getConnectorManager(): IConnectorManager;

  // Prompts
  getPromptManager(): IPromptManager;

  // Tools
  getToolLoader(): IToolLoader;
  getActiveTools(): ToolFunction[];

  // Agent
  getAgent(): IAgentRunner | null;
  createAgent(): Promise<void>;
  destroyAgent(): void;

  // UI
  print(message: string): void;
  printError(message: string): void;
  printSuccess(message: string): void;
  printInfo(message: string): void;
  printDim(message: string): void;
  prompt(question: string): Promise<string>;
  confirm(question: string): Promise<boolean>;
  select<T extends string>(question: string, options: T[]): Promise<T>;
}

export interface IConnectorManager {
  // CRUD
  list(): StoredConnectorConfig[];
  get(name: string): StoredConnectorConfig | null;
  add(config: StoredConnectorConfig): Promise<void>;
  update(name: string, config: Partial<StoredConnectorConfig>): Promise<void>;
  delete(name: string): Promise<void>;

  // Registration
  registerConnector(name: string): void;
  unregisterConnector(name: string): void;
  isRegistered(name: string): boolean;

  // Helpers
  getVendorConnectors(vendor: string): StoredConnectorConfig[];
  getModelsForConnector(name: string): string[];
}

export interface IToolLoader {
  // Loading
  loadBuiltinTools(): ToolFunction[];
  loadCustomTools(directory: string): Promise<ToolFunction[]>;
  reloadTools(): Promise<void>;

  // Management
  getAllTools(): ToolFunction[];
  getTool(name: string): ToolFunction | null;
  enableTool(name: string): void;
  disableTool(name: string): void;
  isEnabled(name: string): boolean;
  getEnabledTools(): ToolFunction[];
}

export interface IPromptManager {
  // Loading
  initialize(): Promise<void>;
  reload(): Promise<void>;

  // CRUD
  list(): PromptTemplate[];
  get(name: string): PromptTemplate | null;
  getContent(name: string): string | null;
  create(name: string, content: string, description?: string): Promise<void>;
  update(name: string, content: string, description?: string): Promise<void>;
  delete(name: string): Promise<void>;

  // Selection
  setActive(name: string | null): void;
  getActive(): PromptTemplate | null;
  getActiveContent(): string | null;
}

export interface PromptTemplate {
  name: string;
  description: string;
  content: string;
  filePath: string;
  createdAt: number;
  updatedAt: number;
}

export interface IAgentRunner {
  // State
  isReady(): boolean;
  isRunning(): boolean;
  isPaused(): boolean;

  // Execution
  run(input: string): Promise<AgentResponse>;
  stream(input: string): AsyncGenerator<StreamEvent>;

  // Control
  pause(): void;
  resume(): void;
  cancel(): void;

  // Configuration
  setModel(model: string): void;
  getModel(): string;
  setTemperature(temp: number): void;
  getTemperature(): number;

  // Session
  saveSession(): Promise<string>;
  loadSession(sessionId: string): Promise<void>;
  getSessionId(): string | null;

  // Permission Management
  approveToolForSession(toolName: string): void;
  revokeToolApproval(toolName: string): void;
  allowlistTool(toolName: string): void;
  blocklistTool(toolName: string): void;
  removeFromAllowlist(toolName: string): void;
  removeFromBlocklist(toolName: string): void;
  getApprovedTools(): string[];
  getAllowlist(): string[];
  getBlocklist(): string[];
  toolNeedsApproval(toolName: string): boolean;
  toolIsBlocked(toolName: string): boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentResponse {
  text: string;
  mode: 'interactive' | 'planning' | 'executing';
  plan?: PlanInfo;
  taskProgress?: TaskProgress;
  usage?: TokenUsage;
  duration?: number;
  needsUserAction?: boolean;
}

export interface PlanInfo {
  goal: string;
  tasks: TaskInfo[];
  approved: boolean;
}

export interface TaskInfo {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: string;
}

export interface TaskProgress {
  current: number;
  total: number;
  currentTask?: TaskInfo;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StreamEvent {
  type: 'text:delta' | 'text:done' | 'mode:changed' | 'plan:created' |
        'plan:approved' | 'task:started' | 'task:completed' | 'task:failed' |
        'tool:start' | 'tool:complete' | 'tool:approval_required' |
        'tool:blocked' | 'tool:approved' | 'error' | 'done';
  delta?: string;
  text?: string;
  mode?: string;
  fromMode?: string;
  toMode?: string;
  plan?: PlanInfo;
  task?: TaskInfo;
  tool?: { name: string; args?: unknown; result?: unknown };
  error?: Error;
  usage?: TokenUsage;
  // Permission-related fields
  permissionContext?: ToolApprovalContext;
}

export interface ToolApprovalContext {
  toolName: string;
  args?: unknown;
  riskLevel?: RiskLevel;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor Info
// ─────────────────────────────────────────────────────────────────────────────

export interface VendorInfo {
  id: string;
  name: string;
  models: ModelInfo[];
  requiresApiKey: boolean;
  supportsOAuth: boolean;
  baseURL?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: AmosConfig = {
  activeConnector: null,
  activeModel: null,
  activeVendor: null,

  defaults: {
    vendor: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxOutputTokens: 4096,
  },

  planning: {
    enabled: true,
    autoDetect: true,
    requireApproval: true,
  },

  session: {
    autoSave: true,
    autoSaveIntervalMs: 60000,
    activeSessionId: null,
  },

  ui: {
    showTokenUsage: true,
    showTiming: true,
    streamResponses: true,
    colorOutput: true,
  },

  tools: {
    enabledTools: [],
    disabledTools: [],
    customToolsDir: './data/tools',
  },

  permissions: {
    defaultScope: 'session',
    defaultRiskLevel: 'low',
    allowlist: [],
    blocklist: [],
    toolOverrides: {},
    promptForApproval: true,
  },

  prompts: {
    promptsDir: './data/prompts',
    activePrompt: null,
  },

  developerTools: {
    enabled: true,
    workingDirectory: process.cwd(),
    allowedDirectories: [],
    blockedDirectories: ['node_modules', '.git', 'dist', 'build'],
    blockedCommands: ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'],
    commandTimeout: 30000,
  },
};

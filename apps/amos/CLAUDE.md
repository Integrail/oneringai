# AMOS Development Guide

This document provides context for AI assistants to continue development of the AMOS application.

## Project Overview

**Name**: AMOS (Advanced Multimodal Orchestration System)
**Purpose**: Terminal-based agentic chat application with runtime configuration
**Built on**: `@oneringai/agents` library (UniversalAgent)
**Language**: TypeScript (strict mode)
**Runtime**: Node.js 18+
**Package Type**: ESM

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AmosApp                                  │
│  Main application class - ties all components together          │
└────────────────┬────────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬────────────┬────────────┐
    │            │            │            │            │
    ▼            ▼            ▼            ▼            ▼
┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Terminal│ │Command   │ │Connector │ │Tool      │ │Agent     │
│   UI   │ │Processor │ │Manager   │ │Loader    │ │Runner    │
└────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
    │            │            │            │            │
    │            │            │            │            ▼
    │            │            │            │     ┌──────────────┐
    │            │            │            │     │Universal     │
    │            │            │            │     │Agent         │
    │            │            │            │     │(@oneringai)  │
    │            │            │            │     └──────────────┘
    ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      data/ (filesystem)                          │
│  config.json | connectors/*.json | sessions/ | tools/*.js       │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
apps/amos/
├── src/
│   ├── index.ts                    # Entry point, signal handlers
│   ├── app.ts                      # AmosApp - main orchestrator
│   │
│   ├── config/
│   │   ├── types.ts                # All type definitions + DEFAULT_CONFIG
│   │   ├── ConfigManager.ts        # Load/save config to JSON
│   │   └── index.ts
│   │
│   ├── commands/
│   │   ├── CommandProcessor.ts     # Command routing, parsing, execution
│   │   ├── BaseCommand.ts          # Abstract base class for commands
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── HelpCommand.ts      # /help
│   │       ├── ModelCommand.ts     # /model - uses MODEL_REGISTRY
│   │       ├── VendorCommand.ts    # /vendor - uses Vendor enum
│   │       ├── ConnectorCommand.ts # /connector add|edit|delete|generate|use
│   │       ├── ToolCommand.ts      # /tool list|enable|disable|reload
│   │       ├── SessionCommand.ts   # /session save|load|list|new
│   │       ├── ConfigCommand.ts    # /config get|set|reset
│   │       ├── UtilCommands.ts     # /clear, /exit, /status, /history
│   │       └── index.ts
│   │
│   ├── connectors/
│   │   ├── ConnectorManager.ts     # CRUD + Connector.create() registration
│   │   └── index.ts
│   │
│   ├── tools/
│   │   ├── ToolLoader.ts           # Built-in + custom tool loading
│   │   └── index.ts
│   │
│   ├── agent/
│   │   ├── AgentRunner.ts          # UniversalAgent wrapper
│   │   └── index.ts
│   │
│   └── ui/
│       ├── Terminal.ts             # readline, chalk, prompts, spinners
│       └── index.ts
│
├── data/
│   ├── config.json                 # App configuration (created on first run)
│   ├── connectors/                 # Connector JSON files
│   ├── sessions/                   # Session persistence
│   ├── tools/                      # Custom tools (.js files)
│   │   └── example-tool.js
│   └── logs/                       # Log files (dev mode)
│
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
└── CLAUDE.md                       # This file
```

## Key Components

### 1. AmosApp (`src/app.ts`)

Main orchestrator implementing `IAmosApp` interface:

```typescript
interface IAmosApp {
  // Configuration
  getConfig(): AmosConfig;
  updateConfig(partial: Partial<AmosConfig>): void;
  saveConfig(): Promise<void>;

  // Component access
  getConnectorManager(): IConnectorManager;
  getToolLoader(): IToolLoader;
  getActiveTools(): ToolFunction[];
  getAgent(): IAgentRunner | null;

  // Agent lifecycle
  createAgent(): Promise<void>;
  destroyAgent(): void;

  // UI helpers (used by commands)
  print(message: string): void;
  printError(message: string): void;
  printSuccess(message: string): void;
  printInfo(message: string): void;
  prompt(question: string): Promise<string>;
  confirm(question: string): Promise<boolean>;
  select<T extends string>(question: string, options: T[]): Promise<T>;
}
```

**Key methods:**
- `initialize()` - Load config, init components, register active connector
- `run()` - Main REPL loop
- `processInput(input)` - Route to command or agent
- `runAgent(input)` - Execute with streaming or non-streaming

### 2. CommandProcessor (`src/commands/CommandProcessor.ts`)

Extensible command system:

```typescript
// Register commands
commandProcessor.register(new MyCommand());
commandProcessor.registerAll([cmd1, cmd2]);

// Check and execute
if (commandProcessor.isCommand(input)) {
  const result = await commandProcessor.execute(input);
}

// Result structure
interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  shouldExit?: boolean;
  clearScreen?: boolean;
}
```

**Features:**
- Quote-aware tokenization (`/cmd "arg with spaces"`)
- Alias support (e.g., `/m` for `/model`)
- Subcommand parsing via `BaseCommand.parseSubcommand()`

### 3. ConnectorManager (`src/connectors/ConnectorManager.ts`)

Runtime connector management with persistence:

```typescript
// CRUD operations
connectorManager.list(): StoredConnectorConfig[]
connectorManager.get(name): StoredConnectorConfig | null
connectorManager.add(config): Promise<void>
connectorManager.update(name, partial): Promise<void>
connectorManager.delete(name): Promise<void>

// Registration with @oneringai/agents Connector
connectorManager.registerConnector(name): void  // Calls Connector.create()
connectorManager.unregisterConnector(name): void
connectorManager.isRegistered(name): boolean
```

**Storage:** Each connector saved as `data/connectors/{name}.json`

### 4. ToolLoader (`src/tools/ToolLoader.ts`)

Dynamic tool loading:

```typescript
// Loading
toolLoader.loadBuiltinTools(): ToolFunction[]    // calculate, get_current_time, etc.
toolLoader.loadCustomTools(dir): Promise<ToolFunction[]>

// Management
toolLoader.enableTool(name): void
toolLoader.disableTool(name): void
toolLoader.isEnabled(name): boolean
toolLoader.getEnabledTools(): ToolFunction[]

// Reload at runtime
toolLoader.reloadTools(): Promise<void>
```

**Custom tools:** Export default `ToolFunction` from `.js` files in `data/tools/`

### 5. AgentRunner (`src/agent/AgentRunner.ts`)

Wrapper around `UniversalAgent`:

```typescript
// Lifecycle
agentRunner.initialize(connectorName, model): Promise<void>
agentRunner.destroy(): void

// Execution
agentRunner.run(input): Promise<AgentResponse>
agentRunner.stream(input): AsyncGenerator<StreamEvent>

// State
agentRunner.isReady(): boolean
agentRunner.isRunning(): boolean
agentRunner.isPaused(): boolean
agentRunner.getMode(): 'interactive' | 'planning' | 'executing'

// Configuration (requires agent recreation for some)
agentRunner.setModel(model): void
agentRunner.setTemperature(temp): void
agentRunner.setPlanningEnabled(enabled): void
agentRunner.setAutoApproval(enabled): void

// Sessions
agentRunner.saveSession(): Promise<string>
agentRunner.loadSession(id): Promise<void>
```

**Note:** Model/temperature changes require agent recreation via `app.createAgent()`.

### 6. Terminal (`src/ui/Terminal.ts`)

Terminal UI utilities:

```typescript
// Output
terminal.print(msg): void
terminal.printError(msg): void      // Red
terminal.printSuccess(msg): void    // Green
terminal.printInfo(msg): void       // Blue
terminal.printWarning(msg): void    // Yellow
terminal.printDim(msg): void        // Dim
terminal.write(text): void          // No newline

// Input
terminal.prompt(question): Promise<string>
terminal.confirm(question): Promise<boolean>
terminal.select(question, options): Promise<T>
terminal.readline(prompt): Promise<string | null>

// Utilities
terminal.clear(): void
terminal.showSpinner(msg): SpinnerHandle
terminal.showProgress(current, total, msg): void
terminal.box(content, title?): string
terminal.table(headers, rows): string
```

## Configuration

### AmosConfig (`src/config/types.ts`)

```typescript
interface AmosConfig {
  // Active settings (runtime state)
  activeConnector: string | null;
  activeModel: string | null;
  activeVendor: string | null;

  // Defaults
  defaults: {
    vendor: string;          // 'openai'
    model: string;           // 'gpt-4o'
    temperature: number;     // 0.7
    maxOutputTokens: number; // 4096
  };

  // Planning
  planning: {
    enabled: boolean;        // true
    autoDetect: boolean;     // true
    requireApproval: boolean; // true
  };

  // Sessions
  session: {
    autoSave: boolean;       // true
    autoSaveIntervalMs: number; // 60000
    activeSessionId: string | null;
  };

  // UI
  ui: {
    showTokenUsage: boolean; // true
    showTiming: boolean;     // true
    streamResponses: boolean; // true
    colorOutput: boolean;    // true
  };

  // Tools
  tools: {
    enabledTools: string[];
    disabledTools: string[];
    customToolsDir: string;  // './data/tools'
  };
}
```

### StoredConnectorConfig

```typescript
interface StoredConnectorConfig {
  name: string;
  vendor: string;
  auth: ConnectorAuth;
  baseURL?: string;
  options?: Record<string, unknown>;
  models?: string[];
  createdAt: number;
  updatedAt: number;
}

interface ConnectorAuth {
  type: 'api_key' | 'oauth' | 'jwt';
  apiKey?: string;
  // OAuth fields...
}
```

## Adding New Features

### Adding a New Command

1. Create `src/commands/commands/MyCommand.ts`:

```typescript
import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';

export class MyCommand extends BaseCommand {
  readonly name = 'mycommand';
  readonly aliases = ['mc'];
  readonly description = 'Description here';
  readonly usage = '/mycommand [args]';

  async execute(context: CommandContext): Promise<CommandResult> {
    const { app, args } = context;
    // Implementation
    return this.success('Done!');
  }
}
```

2. Export from `src/commands/commands/index.ts`
3. Register in `AmosApp.registerCommands()`

### Adding a Built-in Tool

Add to `ToolLoader.loadBuiltinTools()`:

```typescript
tools.push({
  definition: {
    type: 'function',
    function: {
      name: 'my_tool',
      description: 'What it does',
      parameters: {
        type: 'object',
        properties: {
          arg1: { type: 'string', description: 'Arg description' },
        },
        required: ['arg1'],
      },
    },
  },
  execute: async (args: { arg1: string }) => {
    return { result: 'computed value' };
  },
});
```

### Adding a New Config Section

1. Update `AmosConfig` interface in `src/config/types.ts`
2. Update `DEFAULT_CONFIG` in same file
3. Add validation in `ConfigCommand.setConfig()` if needed

## Library Integration

### Key imports from @oneringai/agents

```typescript
import {
  // Core
  Connector,
  Vendor,
  Agent,
  UniversalAgent,

  // Storage
  FileSessionStorage,

  // Types
  type ToolFunction,
  type UniversalAgentConfig,

  // Model info
  MODEL_REGISTRY,
  getModelInfo,
  getModelsByVendor,
} from '@oneringai/agents';
```

### UniversalAgent API

```typescript
// Create
const agent = UniversalAgent.create(config);
const agent = await UniversalAgent.resume(sessionId, config);

// Chat
const response = await agent.chat(input);
for await (const event of agent.stream(input)) { ... }

// State
agent.getMode(): 'interactive' | 'planning' | 'executing'
agent.getPlan(): Plan | null
agent.getProgress(): TaskProgress | null
agent.isRunning(): boolean
agent.isPaused(): boolean

// Control
agent.pause(): void
agent.resume(): void
agent.cancel(): void
agent.destroy(): void

// Config
agent.setPlanningEnabled(boolean): void
agent.setAutoApproval(boolean): void

// Session
agent.saveSession(): Promise<void>
agent.getSessionId(): string | null
agent.hasSession(): boolean
```

### Model Registry

```typescript
// Get model info
const info = getModelInfo('gpt-4o');
// info.name, info.provider, info.features.vision, etc.

// Get models by vendor
const models = getModelsByVendor(Vendor.OpenAI);
// Returns ILLMDescription[]

// All models
const all = Object.values(MODEL_REGISTRY);
```

## Development

### Scripts

```bash
npm run dev          # LOG_FILE=./data/logs/amos.log LOG_LEVEL=debug
npm run dev:verbose  # LOG_LEVEL=trace
npm run dev:console  # Logs to console
npm run build        # tsup build
npm run typecheck    # tsc --noEmit
```

### Debugging

- Logs go to `data/logs/amos.log` in dev mode
- Use `tail -f data/logs/amos.log` in another terminal
- Set `LOG_LEVEL=trace` for detailed logging

### Testing Locally

```bash
# Run dev mode
npm run dev

# First run will prompt for connector setup
# Or manually: /connector add

# Test commands
/status
/model list
/vendor list
/tool list
```

## Common Tasks

### Change model at runtime
User runs `/model gpt-4-turbo` → `ModelCommand` updates config and calls `app.createAgent()`

### Add new connector
User runs `/connector add` → `ConnectorCommand` prompts for details → saves to `data/connectors/` → optionally registers with `Connector.create()`

### Switch vendor
User runs `/vendor anthropic` → `VendorCommand` finds connectors for vendor → updates config → calls `app.createAgent()`

### AI-assisted connector generation
User runs `/connector generate` → Uses current agent to generate config JSON → prompts for API key → saves connector

## Future Improvements

- [ ] MCP (Model Context Protocol) server integration
- [ ] File system tools (read, write, search)
- [ ] Web browsing tools
- [ ] Image input support (vision models)
- [ ] Plugin system for command extensions
- [ ] Remote session support
- [ ] Multi-agent orchestration
- [ ] Conversation history search
- [ ] Export conversations to markdown

---

**Version**: 0.1.0
**Last Updated**: 2026-01-24

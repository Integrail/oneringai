# AMOS Development Guide

This document provides context for AI assistants to continue development of the AMOS application.

## Project Overview

**Name**: AMOS (Advanced Multimodal Orchestration System)
**Purpose**: Terminal-based agentic chat application with runtime configuration
**Built on**: `@everworker/oneringai` library (UniversalAgent)
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
    ┌────────────┼────────────┬────────────┬────────────┬────────────┐
    │            │            │            │            │            │
    ▼            ▼            ▼            ▼            ▼            ▼
┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Terminal│ │Command   │ │Connector │ │Tool      │ │Prompt    │ │Agent     │
│   UI   │ │Processor │ │Manager   │ │Loader    │ │Manager   │ │Runner    │
└────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
    │            │            │            │            │            │
    │            │            │            │            │            ▼
    │            │            │            │            │     ┌──────────────┐
    │            │            │            │            │     │Universal     │
    │            │            │            │            │     │Agent         │
    │            │            │            │            │     │(@everworker)  │
    │            │            │            │            │     └──────────────┘
    ▼            ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      data/ (filesystem)                          │
│  config.json | connectors/*.json | sessions/ | tools/*.js       │
│  prompts/*.md                                                    │
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
│   │       ├── PromptCommand.ts    # /prompt list|show|use|clear|create|edit|delete
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
│   ├── prompts/
│   │   ├── PromptManager.ts        # Prompt template management
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
│   ├── prompts/                    # System prompt templates (.md files)
│   │   ├── default.md              # Default helpful assistant
│   │   ├── coding-assistant.md     # Expert coding assistant (basic)
│   │   ├── coding-agent.md         # Autonomous coding agent with full tools
│   │   ├── research-analyst.md     # Research and analysis
│   │   └── writing-editor.md       # Writing and editing
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
  getPromptManager(): IPromptManager;
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
  printDim(message: string): void;
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

// Registration with @everworker/oneringai Connector
connectorManager.registerConnector(name): void  // Calls Connector.create()
connectorManager.unregisterConnector(name): void
connectorManager.isRegistered(name): boolean
```

**Storage:** Each connector saved as `data/connectors/{name}.json`

### 4. ToolLoader (`src/tools/ToolLoader.ts`)

Dynamic tool loading with built-in developer tools:

```typescript
// Loading
toolLoader.loadBuiltinTools(): ToolFunction[]    // Basic tools + developer tools
toolLoader.loadCustomTools(dir): Promise<ToolFunction[]>

// Configuration
toolLoader.setConfig(config): void              // Set config for developer tools

// Management
toolLoader.enableTool(name): void
toolLoader.disableTool(name): void
toolLoader.isEnabled(name): boolean
toolLoader.getEnabledTools(): ToolFunction[]

// Reload at runtime
toolLoader.reloadTools(): Promise<void>
```

**Built-in Tools:**
- **Basic:** `calculate`, `get_current_time`, `random_number`, `echo`
- **Developer (Filesystem):** `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `list_directory`
- **Developer (Shell):** `bash`

**Tool Call Descriptions:**

All developer tools implement `describeCall()` for human-readable logging:
```
🔧 read_file: /path/to/file.ts
🔧 bash: npm install
🔧 grep: "pattern" in *.ts
```

The app uses `tool.describeCall(args)` if available, falling back to `defaultDescribeCall(args)` from the library.

**Custom tools:** Export default `ToolFunction` from `.js` files in `data/tools/`

Custom tools can implement `describeCall` for better logging:
```javascript
export default {
  definition: { ... },
  execute: async (args) => { ... },
  describeCall: (args) => args.query || args.input,
};
```

### 5. PromptManager (`src/prompts/PromptManager.ts`)

System prompt template management:

```typescript
// Loading
promptManager.initialize(): Promise<void>    // Load prompts from disk
promptManager.reload(): Promise<void>         // Reload prompts

// CRUD
promptManager.list(): PromptTemplate[]        // Get all prompts
promptManager.get(name): PromptTemplate | null
promptManager.getContent(name): string | null
promptManager.create(name, content, description?): Promise<void>
promptManager.update(name, content, description?): Promise<void>
promptManager.delete(name): Promise<void>

// Selection
promptManager.setActive(name | null): void
promptManager.getActive(): PromptTemplate | null
promptManager.getActiveContent(): string | null
```

**PromptTemplate structure:**
```typescript
interface PromptTemplate {
  name: string;        // Derived from filename (without .md)
  description: string; // From YAML frontmatter
  content: string;     // Main content (after frontmatter)
  filePath: string;    // Full path to .md file
  createdAt: number;   // File creation time
  updatedAt: number;   // File modification time
}
```

**Storage format:** Markdown files with optional YAML frontmatter:
```markdown
---
description: Expert coding assistant for software development
---

You are an expert software developer...
```

**Integration with agent:** Active prompt content is passed to `UniversalAgent.create()` via the `instructions` config field.

### 6. AgentRunner (`src/agent/AgentRunner.ts`)

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

### 7. Terminal (`src/ui/Terminal.ts`)

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

  // Prompts
  prompts: {
    promptsDir: string;           // './data/prompts'
    activePrompt: string | null;  // Currently selected prompt name
  };

  // Developer Tools (filesystem + shell)
  developerTools: {
    enabled: boolean;             // true - enable coding agent tools
    workingDirectory: string;     // process.cwd()
    allowedDirectories: string[]; // [] - if set, restricts access
    blockedDirectories: string[]; // ['node_modules', '.git', 'dist', 'build']
    blockedCommands: string[];    // dangerous shell commands
    commandTimeout: number;       // 30000ms
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

  // Human-readable description for logging/UI (optional but recommended)
  describeCall: (args: { arg1: string }) => {
    return args.arg1;  // e.g., "🔧 my_tool: value"
  },

  execute: async (args: { arg1: string }) => {
    return { result: 'computed value' };
  },
});
```

### Adding a New Prompt Template

1. Create `data/prompts/my-prompt.md`:

```markdown
---
description: Short description for listing
---

Your system prompt content here.
Instruct the AI on personality, capabilities, constraints, etc.
```

2. Use via command: `/prompt use my-prompt`

Or programmatically:
```typescript
await promptManager.create('my-prompt', content, description);
promptManager.setActive('my-prompt');
await app.createAgent();  // Recreates agent with new instructions
```

### Adding a New Config Section

1. Update `AmosConfig` interface in `src/config/types.ts`
2. Update `DEFAULT_CONFIG` in same file
3. Add validation in `ConfigCommand.setConfig()` if needed

## Library Integration

### Key imports from @everworker/oneringai

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
} from '@everworker/oneringai';
```

### UniversalAgent API

```typescript
// Create (with optional instructions from prompt template)
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4o',
  instructions: promptManager.getActiveContent() || undefined,
  // ... other config
});
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
/prompt list
/prompt use coding-assistant
/prompt current
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

### Switch prompt template
User runs `/prompt use coding-assistant` → `PromptCommand` calls `promptManager.setActive()` → updates config → calls `app.createAgent()` to recreate agent with new instructions

### Create new prompt template
User runs `/prompt create research` → Prompted for content (type END to finish) → `promptManager.create()` saves to `data/prompts/research.md`

### Enable coding agent mode
User runs `/prompt use coding-agent` → AMOS becomes an autonomous coding agent with:
- Full filesystem access (read, write, edit, glob, grep, list)
- Shell command execution (bash)
- Intelligent code analysis and modification
- Git-aware workflow

## Future Improvements

- [ ] MCP (Model Context Protocol) server integration
- [x] File system tools (read, write, search) ✓ Implemented
- [ ] Web browsing tools
- [ ] Image input support (vision models)
- [ ] Plugin system for command extensions
- [ ] Remote session support
- [ ] Multi-agent orchestration
- [ ] Conversation history search
- [ ] Export conversations to markdown

---

**Version**: 0.1.0
**Last Updated**: 2026-01-26

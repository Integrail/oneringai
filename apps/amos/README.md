# AMOS - Advanced Multimodal Orchestration System

A powerful terminal-based AI assistant powered by `@oneringai/agents`. Features multi-vendor support, runtime model switching, tool permissions, session management, and comprehensive context inspection.

## Features

- **Multi-Vendor Support** - OpenAI, Anthropic, Google, Groq, Mistral, and more
- **Runtime Configuration** - Switch models, vendors, and prompts without restart
- **Tool System** - Built-in developer tools + custom tool support
- **Permission System** - Granular control over tool execution
- **Session Management** - Save and resume conversations
- **Context Inspection** - Monitor token usage and context budget
- **Coding Agent Mode** - Autonomous coding with filesystem and shell access
- **Extensible Commands** - Easy-to-add custom commands

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Or production mode
npm run start
```

On first run, you'll be prompted to configure an API key.

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `/help` | | Show all commands |
| `/model [name]` | `/m` | List or switch models |
| `/vendor [name]` | | List or switch vendors |
| `/connector <sub>` | | Manage API keys (add, edit, delete) |
| `/prompt <sub>` | | Manage system prompts |
| `/tool <sub>` | | Manage tools (list, enable, disable) |
| `/external [sub]` | `/ext` | Manage external tools (search, scrape, fetch) |
| `/context [sub]` | `/ctx` | Context inspection (budget, breakdown, memory) |
| `/session <sub>` | | Session management (save, load, list) |
| `/config [sub]` | | View/edit configuration |
| `/status` | `/st` | Show current status |
| `/history [n]` | `/hist` | Show conversation history |
| `/clear` | `/cls` | Clear screen |
| `/exit` | `/q` | Exit AMOS |

## Context Inspection

Monitor your context usage in real-time:

```
/context                 # Overview with utilization bar
/context budget          # Detailed token budget
/context breakdown       # Per-component token usage
/context memory          # Working memory entries
```

Example output:
```
Context Overview
────────────────────────────────────
Utilization: ████████░░ 78% (warning)
Tokens: 45,600 / 108,800 available

Status: ⚠️  Warning - approaching limit
Mode: 💬 interactive
```

## Coding Agent Mode

Enable autonomous coding with full tool access:

```
/prompt use coding-agent
```

Features:
- File system tools (read, write, edit, glob, grep)
- Shell command execution
- Git-aware workflow
- Plan approval workflow

## Prompt Templates

Built-in prompts for different use cases:

| Prompt | Description |
|--------|-------------|
| `default` | General helpful assistant |
| `coding-assistant` | Expert coding assistant |
| `coding-agent` | Autonomous coding agent |
| `research-analyst` | Research and analysis |
| `writing-editor` | Writing and editing |

Use: `/prompt use coding-agent`

## Custom Tools

Add tools to `data/tools/`:

```javascript
// data/tools/my-tool.js
export default {
  definition: {
    type: 'function',
    function: {
      name: 'my_tool',
      description: 'What it does',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  execute: async (args) => ({ result: 'done' }),
  describeCall: (args) => 'description for logging',
};
```

Then run `/tool reload`.

## Data Directory

```
data/
├── config.json       # App configuration
├── connectors/       # API key configurations
├── sessions/         # Saved sessions
├── tools/            # Custom tools
├── prompts/          # System prompt templates
└── logs/             # Log files (dev mode)
```

## Scripts

```bash
npm run dev          # Development (logs to file)
npm run dev:verbose  # Development with trace logging
npm run dev:console  # Development with console logging
npm run build        # Build for production
npm run start        # Run production build
npm run typecheck    # Type checking
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AMOS_DATA_DIR` | Data directory | `./data` |
| `LOG_FILE` | Log file path | `./data/logs/amos.log` |
| `LOG_LEVEL` | `trace`, `debug`, `info`, `warn`, `error`, `silent` | `info` |

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** - Comprehensive usage documentation
- **[CLAUDE.md](CLAUDE.md)** - Developer documentation for AI assistants

## License

MIT

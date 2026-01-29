# AMOS User Guide

**Advanced Multimodal Orchestration System**

A powerful terminal-based AI assistant powered by `@oneringai/agents`. AMOS provides runtime configuration, multi-vendor support, tool permissions, session management, and an extensible command system.

---

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Quick Start](#quick-start)
3. [Commands Reference](#commands-reference)
4. [Working with Models & Vendors](#working-with-models--vendors)
5. [Connectors (API Keys)](#connectors-api-keys)
6. [Prompt Templates](#prompt-templates)
7. [Tool System](#tool-system)
8. [Tool Permissions](#tool-permissions)
9. [Context Inspection](#context-inspection)
10. [Sessions](#sessions)
11. [Configuration](#configuration)
12. [Coding Agent Mode](#coding-agent-mode)
13. [Custom Tools](#custom-tools)
14. [Tips & Best Practices](#tips--best-practices)
15. [Troubleshooting](#troubleshooting)

---

## Installation & Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/oneringai/agents.git
cd agents/apps/amos

# Install dependencies
npm install

# Build
npm run build
```

### First Run

```bash
# Start in development mode
npm run dev

# Or in production mode
npm run start
```

On first run, AMOS will prompt you to configure a connector (API key). Follow the interactive wizard to set up your preferred AI provider.

---

## Quick Start

### Basic Conversation

After setup, simply type your message and press Enter:

```
[openai] > Hello! What can you help me with?

I'm an AI assistant that can help you with a wide variety of tasks...
```

### Key Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Show current agent status |
| `/model list` | List available models |
| `/model gpt-4o` | Switch to a specific model |
| `/prompt list` | List available prompts |
| `/context` | Show context usage overview |
| `/exit` | Exit AMOS |

### Command Shortcuts

Most commands have short aliases:

| Full Command | Alias |
|--------------|-------|
| `/model` | `/m` |
| `/status` | `/st` |
| `/history` | `/hist` |
| `/context` | `/ctx` |
| `/clear` | `/cls` |
| `/exit` | `/q`, `/quit` |

---

## Commands Reference

### Help Commands

```
/help                   Show all commands with descriptions
/help <command>         Show detailed help for a specific command
```

### Model Management

```
/model                  Show current model
/model list             List all available models
/model <name>           Switch to specified model

Examples:
  /model gpt-4o
  /model claude-opus-4-5-20251101
  /model gemini-3-flash-preview
```

### Vendor Management

```
/vendor                 Show current vendor
/vendor list            List all supported vendors
/vendor <name>          Switch to specified vendor

Supported vendors:
  openai, anthropic, google, groq, together, mistral, etc.
```

### Connector Management

```
/connector list         List configured connectors
/connector add          Add a new connector (interactive)
/connector edit <name>  Edit existing connector
/connector delete <name> Delete a connector
/connector use <name>   Switch to a connector
/connector generate     AI-assisted connector generation
```

### Prompt Management

```
/prompt list            List available prompts
/prompt show <name>     Show prompt content
/prompt use <name>      Activate a prompt
/prompt clear           Deactivate current prompt
/prompt create <name>   Create new prompt (interactive)
/prompt edit <name>     Edit existing prompt
/prompt delete <name>   Delete a prompt
/prompt current         Show currently active prompt
```

### Tool Management

```
/tool list              List all tools with status
/tool enable <name>     Enable a tool
/tool disable <name>    Disable a tool
/tool reload            Reload custom tools
```

### Session Management

```
/session list           List saved sessions
/session save [name]    Save current session
/session load <id>      Load a saved session
/session new            Start a new session
```

### Context Inspection

```
/context                Show context overview
/context budget         Detailed token budget
/context breakdown      Per-component token breakdown
/context memory         Memory entries
/context history [n]    Show conversation history
```

### Configuration

```
/config                 Show current configuration
/config get <key>       Get specific config value
/config set <key> <val> Set config value
/config reset           Reset to defaults
```

### Utility Commands

```
/status                 Show agent status and metrics
/history [count]        Show conversation history
/clear                  Clear the screen
/exit                   Exit AMOS (also: /quit, /q)
```

---

## Working with Models & Vendors

### Listing Available Models

```
/model list
```

This shows all models available for your current vendor, including:
- Model name
- Context window size
- Features (vision, streaming, tools, etc.)
- Pricing information

### Switching Models

```
/model gpt-4o
```

The model switch takes effect immediately. AMOS will recreate the agent with the new model.

### Multi-Vendor Support

AMOS supports multiple AI providers:

| Vendor | Example Models |
|--------|---------------|
| OpenAI | gpt-4o, gpt-4-turbo, o1-preview |
| Anthropic | claude-opus-4-5, claude-sonnet-4, claude-haiku-3-5 |
| Google | gemini-3-flash-preview, gemini-2.5-pro |
| Groq | llama-3.3-70b-versatile |
| Together | mixtral-8x7b-instruct |
| Mistral | mistral-large |

To switch vendors:
```
/vendor anthropic
```

---

## Connectors (API Keys)

Connectors store your API credentials securely and allow you to switch between different API keys or providers.

### Adding a Connector

```
/connector add
```

Follow the interactive wizard:
1. Choose a vendor (OpenAI, Anthropic, etc.)
2. Enter a name for the connector
3. Enter your API key
4. Optionally configure custom base URL

### Using Multiple Keys

You can have multiple connectors for the same vendor:

```
/connector add          # Add "openai-personal" with personal key
/connector add          # Add "openai-work" with work key

/connector use openai-personal
/connector use openai-work
```

### AI-Assisted Connector Generation

```
/connector generate
```

AMOS can help you generate connector configurations by describing what you need.

---

## Prompt Templates

Prompt templates define the AI's personality, capabilities, and behavior.

### Built-in Prompts

| Prompt | Description |
|--------|-------------|
| `default` | Helpful general assistant |
| `coding-assistant` | Expert coding assistant |
| `coding-agent` | Autonomous coding agent with full tool access |
| `research-analyst` | Research and analysis specialist |
| `writing-editor` | Writing and editing assistant |

### Using a Prompt

```
/prompt use coding-assistant
```

The prompt is applied immediately. AMOS recreates the agent with the new instructions.

### Creating Custom Prompts

```
/prompt create my-assistant
```

Enter your prompt content (type `END` on a new line when done):

```
You are a helpful assistant specialized in...

Your key capabilities:
- ...
- ...

END
```

### Prompt File Format

Prompts are stored as Markdown files in `data/prompts/`:

```markdown
---
description: Short description shown in prompt list
---

Your system prompt content here.

You can use **markdown** formatting in prompts.
```

---

## Tool System

AMOS includes built-in tools that the AI can use to accomplish tasks.

### Built-in Tools

**Basic Tools:**
- `calculate` - Mathematical calculations
- `get_current_time` - Get current date/time
- `random_number` - Generate random numbers
- `echo` - Echo back input

**Developer Tools (Filesystem):**
- `read_file` - Read file contents
- `write_file` - Create/overwrite files
- `edit_file` - Surgical find/replace edits
- `glob` - Find files by pattern
- `grep` - Search file contents
- `list_directory` - List directory contents

**Developer Tools (Shell):**
- `bash` - Execute shell commands

### Viewing Tools

```
/tool list
```

Shows all tools with their enable/disable status.

### Enabling/Disabling Tools

```
/tool disable bash        # Disable shell execution
/tool enable bash         # Re-enable shell execution
```

---

## Tool Permissions

AMOS includes a comprehensive permission system to control tool execution.

### Permission Scopes

| Scope | Description |
|-------|-------------|
| `once` | Require approval for each call |
| `session` | Approve once per session |
| `always` | Always allow (allowlist) |
| `never` | Always block (blocklist) |

### Safe Tools (Auto-Allowed)

These tools never require approval:
- Read-only tools: `read_file`, `glob`, `grep`, `list_directory`
- Memory tools: `memory_store`, `memory_retrieve`, `memory_delete`
- Context tools: `context_inspect`, `context_breakdown`

### Approval Workflow

When the AI wants to use a tool that requires approval:

```
⚠️ Tool "write_file: /path/to/file.ts" requires approval

Options:
  yes         - Allow this call only
  yes-session - Allow for this session
  yes-always  - Always allow (add to allowlist)
  no          - Deny this call
  no-block    - Always block (add to blocklist)

Allow tool execution? [yes/no/yes-session/yes-always/no-block]
```

### Configuring Permissions

In `data/config.json`:

```json
{
  "permissions": {
    "defaultScope": "session",
    "allowlist": ["read_file", "glob"],
    "blocklist": ["dangerous_tool"],
    "promptForApproval": true
  }
}
```

---

## Context Inspection

AMOS provides detailed visibility into context usage and token budgets.

### Overview

```
/context
```

Shows:
- Utilization percentage with visual bar
- Token usage (used / available)
- Current status (OK, Warning, Critical)
- Current mode (interactive, planning, executing)

Example output:
```
Context Overview
────────────────────────────────────
Utilization: ████████░░ 78% (warning)
Tokens: 45,600 / 108,800 available

Status: ⚠️  Warning - approaching limit
Mode: 💬 interactive
```

### Detailed Budget

```
/context budget
```

Shows:
- Total tokens available
- Reserved tokens (for response)
- Used tokens
- Available tokens
- Utilization percentage
- Status indicator

Example output:
```
Context Budget
────────────────────────────────────
Total:        128,000 tokens
Reserved:      19,200 tokens (15% for response)
Used:          45,600 tokens
Available:     63,200 tokens
Utilization:    41.8%
Status:        ✅ OK
```

### Token Breakdown

```
/context breakdown
```

Shows tokens used by each component:
- System prompt
- Conversation history
- Memory index
- Current input

Example output:
```
Token Breakdown by Component
────────────────────────────────────
conversation_history   30,000   (65.8%)  ████████████████████
memory_index            5,000   (11.0%)  ███
system_prompt           500     ( 1.1%)  ░
input                  10,100   (22.1%)  ██████
────────────────────────────────────
Total:                 45,600 tokens
```

### Memory Entries

```
/context memory
```

Shows working memory contents:
- Entry keys
- Descriptions
- Size in bytes
- Scope and priority

### Conversation History

```
/context history 20
```

Shows the last 20 messages with timestamps and role icons.

---

## Sessions

Sessions allow you to save and resume conversations.

### Saving a Session

```
/session save my-project
```

Saves:
- Conversation history
- Memory contents
- Current mode
- Tool approval states

### Loading a Session

```
/session load abc123
```

Restores the full conversation state.

### Auto-Save

By default, AMOS auto-saves every 60 seconds. Configure in settings:

```
/config set session.autoSave true
/config set session.autoSaveIntervalMs 30000
```

### Starting Fresh

```
/session new
```

Clears the current session and starts fresh.

---

## Configuration

### Viewing Configuration

```
/config
```

Shows all current settings organized by category.

### Getting Specific Values

```
/config get defaults.model
/config get ui.streamResponses
```

### Setting Values

```
/config set defaults.model gpt-4-turbo
/config set ui.showTokenUsage false
/config set planning.enabled true
```

### Key Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `defaults.model` | Default model | `gpt-4o` |
| `defaults.temperature` | Temperature | `0.7` |
| `ui.streamResponses` | Stream output | `true` |
| `ui.showTokenUsage` | Show token counts | `true` |
| `ui.showTiming` | Show response time | `true` |
| `planning.enabled` | Enable planning mode | `true` |
| `planning.autoDetect` | Auto-detect complex tasks | `true` |
| `planning.requireApproval` | Require plan approval | `true` |
| `session.autoSave` | Auto-save sessions | `true` |

### Reset to Defaults

```
/config reset
```

---

## Coding Agent Mode

AMOS can function as an autonomous coding agent with full filesystem and shell access.

### Enabling Coding Agent

```
/prompt use coding-agent
```

This activates:
- Full filesystem tools (read, write, edit, glob, grep)
- Shell command execution
- Git-aware workflow
- Code analysis capabilities

### Example Workflow

```
[openai] > Refactor the authentication module to use JWT tokens

📋 Plan created:
  Goal: Refactor authentication to use JWT
  1. Analyze current auth implementation
  2. Install jsonwebtoken package
  3. Update auth middleware
  4. Update login endpoint
  5. Add token refresh endpoint

Type "approve" to proceed or "reject" to cancel.
```

### Safety Features

- Tool permissions require approval for writes
- Dangerous shell commands are blocked
- Directory restrictions can be configured
- Timeout protection for long-running commands

### Configuration

```json
{
  "developerTools": {
    "enabled": true,
    "workingDirectory": "/path/to/project",
    "blockedDirectories": ["node_modules", ".git"],
    "blockedCommands": ["rm -rf /"],
    "commandTimeout": 30000
  }
}
```

---

## Custom Tools

You can extend AMOS with custom tools.

### Creating a Custom Tool

Create a `.js` file in `data/tools/`:

```javascript
// data/tools/my-api-tool.js
export default {
  definition: {
    type: 'function',
    function: {
      name: 'my_api_tool',
      description: 'Fetches data from my API',
      parameters: {
        type: 'object',
        properties: {
          endpoint: {
            type: 'string',
            description: 'API endpoint to call',
          },
        },
        required: ['endpoint'],
      },
    },
  },

  // Optional: Human-readable description for logging
  describeCall: (args) => args.endpoint,

  execute: async (args) => {
    const response = await fetch(`https://api.example.com${args.endpoint}`);
    return response.json();
  },
};
```

### Loading Custom Tools

```
/tool reload
```

### Tool Structure

```typescript
interface ToolFunction {
  definition: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: JSONSchema;
    };
  };
  execute: (args: any) => Promise<any>;
  describeCall?: (args: any) => string;  // For logging
}
```

---

## Tips & Best Practices

### Efficient Context Usage

1. Use `/context breakdown` to identify what's consuming tokens
2. Start new sessions for unrelated tasks (`/session new`)
3. Keep prompts concise but specific

### Model Selection

- Use `gpt-4o` for general tasks (fast, capable)
- Use `claude-opus` for complex reasoning
- Use `gpt-4o-mini` or `claude-haiku` for simple tasks (cheaper)

### Tool Permissions

- Approve tools for "session" scope for repeated operations
- Add trusted tools to allowlist for uninterrupted workflows
- Keep dangerous tools (bash, write_file) on per-call approval

### Session Management

- Save sessions before switching contexts
- Use descriptive session names
- Periodically clean up old sessions

### Coding Agent Mode

- Start with a clear task description
- Review plans before approving
- Use git to track changes made by the agent

---

## Troubleshooting

### "No connector configured"

Run `/connector add` to set up an API key.

### "Model not found"

Check available models with `/model list`. The model may not be available for your current vendor.

### "Tool not found"

Check tool status with `/tool list`. The tool may be disabled or not loaded.

### "Context limit exceeded"

Your conversation is too long. Options:
1. Start a new session: `/session new`
2. Use a model with larger context window
3. Review context usage: `/context breakdown`

### "Permission denied"

A tool was blocked. Options:
1. Approve when prompted
2. Add to allowlist: In config, add to `permissions.allowlist`
3. Remove from blocklist: In config, remove from `permissions.blocklist`

### API Errors

1. Check your API key is valid
2. Verify you have API credits/quota
3. Check the vendor's status page

### Logs

In development mode, logs are written to `data/logs/amos.log`:

```bash
# Watch logs in real-time
tail -f data/logs/amos.log
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AMOS_DATA_DIR` | Data directory | `./data` |
| `LOG_FILE` | Log file path | `./data/logs/amos.log` |
| `LOG_LEVEL` | Logging level | `info` |

Log levels: `trace`, `debug`, `info`, `warn`, `error`, `silent`

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Cancel current operation |
| `Ctrl+D` | Exit AMOS |
| `Up/Down` | Navigate command history |
| `Tab` | (Future) Auto-complete commands |

---

## Version Information

**AMOS Version**: 0.1.0
**Built on**: @oneringai/agents
**Last Updated**: 2026-01-29

---

## Getting Help

- Type `/help` for command reference
- Type `/help <command>` for specific command help
- Check logs at `data/logs/amos.log`
- Report issues at: https://github.com/oneringai/agents/issues

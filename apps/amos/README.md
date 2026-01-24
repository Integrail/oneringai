# AMOS - Advanced Multimodal Orchestration System

A terminal-based agentic application powered by `@oneringai/agents`. Features runtime vendor/model switching, dynamic connector management, and extensible tools.

## Quick Start

```bash
# Install dependencies
npm install

# Run in dev mode (logs to file)
npm run dev

# Or with console logging
npm run dev:console
```

On first run, you'll be prompted to configure a connector (API key).

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/model [name]` | List or switch models |
| `/vendor [name]` | List or switch vendors |
| `/connector <sub>` | Manage connectors (add, edit, delete, generate) |
| `/tool <sub>` | Manage tools (list, enable, disable) |
| `/session <sub>` | Manage sessions (save, load, list) |
| `/config` | View/edit configuration |
| `/status` | Show current status |
| `/clear` | Clear screen |
| `/exit` | Exit |

## Scripts

```bash
npm run dev          # Dev mode, logs to data/logs/amos.log
npm run dev:verbose  # Dev mode with trace logging
npm run dev:console  # Dev mode with console logging
npm run build        # Build for production
npm run start        # Run production build
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AMOS_DATA_DIR` | Data directory (default: `./data`) |
| `LOG_FILE` | Log file path |
| `LOG_LEVEL` | `trace`, `debug`, `info`, `warn`, `error`, `silent` |

## Custom Tools

Add `.js` files to `data/tools/`:

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
};
```

Then run `/tool reload`.

## Data Directory

```
data/
├── config.json      # App configuration
├── connectors/      # Connector configs (API keys)
├── sessions/        # Saved sessions
├── tools/           # Custom tools
└── logs/            # Log files (dev mode)
```

## License

MIT

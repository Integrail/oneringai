# HOSEA

**Human-Oriented System for Engaging Agents**

A desktop application for interacting with AI agents powered by the `@oneringai/agents` library.

## Features

- **Multi-vendor support** - Connect to OpenAI, Anthropic, Google, and more
- **Real-time streaming** - See responses as they're generated
- **Session management** - Save and resume conversations
- **Tool integration** - Enable/disable agent tools
- **Native experience** - Electron-based desktop app for macOS, Windows, Linux

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
cd apps/hosea
npm install
```

### Running in Development

```bash
# Start both Vite dev server and Electron
npm run dev

# Then in another terminal, start Electron
npm run electron:dev
```

### Building

```bash
# Build for production
npm run build

# Package as distributable
npm run package
```

## Architecture

```
src/
├── main/               # Electron main process
│   ├── index.ts        # Window management, IPC setup
│   └── AgentService.ts # @oneringai/agents integration
├── preload/
│   └── index.ts        # Context bridge for secure IPC
└── renderer/           # React frontend
    ├── App.tsx         # Main app component
    └── components/     # UI components
        ├── Chat.tsx
        ├── Message.tsx
        ├── Sidebar.tsx
        ├── SetupModal.tsx
        └── SettingsModal.tsx
```

## IPC API

The renderer communicates with the main process through the `window.hosea` API:

- `hosea.agent.*` - Agent initialization, messaging, streaming
- `hosea.connector.*` - Connector management
- `hosea.model.*` - Model listing
- `hosea.session.*` - Session save/load
- `hosea.tool.*` - Tool management
- `hosea.config.*` - Configuration

## Data Storage

User data is stored in `data/`:

- `config.json` - App configuration
- `connectors/` - Connector configurations (API keys)
- `sessions/` - Saved conversation sessions

## License

MIT

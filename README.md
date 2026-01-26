# @oneringai/agents

> **A unified AI agent library with multi-provider support for text generation, image/video generation, audio (TTS/STT), and agentic workflows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Features

- ✨ **Unified API** - One interface for 10+ AI providers (OpenAI, Anthropic, Google, Groq, DeepSeek, and more)
- 🔑 **Connector-First Architecture** - Single auth system with support for multiple keys per vendor
- 📊 **Model Registry** - Complete metadata for 23+ latest (2026) models with pricing and features
- 🎤 **Audio Capabilities** - Text-to-Speech (TTS) and Speech-to-Text (STT) with OpenAI and Groq
- 🖼️ **Image Generation** - DALL-E 3, gpt-image-1, Google Imagen 4 with editing and variations
- 🎬 **Video Generation** - NEW: OpenAI Sora 2 and Google Veo 3 for AI video creation
- 🤖 **Universal Agent** - Unified agent combining chat, planning, and execution in one interface
- 🎛️ **Dynamic Tool Management** - Enable/disable tools at runtime, namespaces, priority-based selection
- 💾 **Session Persistence** - Save and resume conversations for all agent types
- 🤖 **Task Agents** - Autonomous agents with working memory, context management, and state persistence
- 🎯 **Context Management** - Smart strategies (proactive, aggressive, lazy, rolling-window, adaptive)
- 🛠️ **Agentic Workflows** - Built-in tool calling and multi-turn conversations
- 🔧 **Developer Tools** - NEW: Filesystem and shell tools for coding assistants (read, write, edit, grep, glob, bash)
- 🔌 **MCP Integration** - NEW: Model Context Protocol client for seamless tool discovery from local and remote servers
- 👁️ **Vision Support** - Analyze images with AI across all providers
- 📋 **Clipboard Integration** - Paste screenshots directly (like Claude Code!)
- 🔐 **OAuth 2.0** - Full OAuth support for external APIs with encrypted token storage
- 🔄 **Streaming** - Real-time responses with event streams
- 📝 **TypeScript** - Full type safety and IntelliSense support

## Quick Start

### Installation

```bash
npm install @oneringai/agents
```

### Basic Usage

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

// 1. Create a connector (authentication)
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// 2. Create an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// 3. Run
const response = await agent.run('What is the capital of France?');
console.log(response.output_text);
// Output: "The capital of France is Paris."
```

### With Tools

```typescript
import { ToolFunction } from '@oneringai/agents';

const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args) => {
    return { temp: 72, location: args.location };
  },
};

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
});

await agent.run('What is the weather in Paris?');
```

### Vision

```typescript
import { createMessageWithImages } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4o',
});

const response = await agent.run(
  createMessageWithImages('What is in this image?', ['./photo.jpg'])
);
```

### Audio (NEW)

```typescript
import { TextToSpeech, SpeechToText } from '@oneringai/agents';

// Text-to-Speech
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',
  voice: 'nova',
});

await tts.toFile('Hello, world!', './output.mp3');

// Speech-to-Text
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',
});

const result = await stt.transcribeFile('./audio.mp3');
console.log(result.text);
```

### Image Generation (NEW)

```typescript
import { ImageGeneration } from '@oneringai/agents';

// OpenAI DALL-E
const imageGen = ImageGeneration.create({ connector: 'openai' });

const result = await imageGen.generate({
  prompt: 'A futuristic city at sunset',
  model: 'dall-e-3',
  size: '1024x1024',
  quality: 'hd',
});

// Save to file
const buffer = Buffer.from(result.data[0].b64_json!, 'base64');
await fs.writeFile('./output.png', buffer);

// Google Imagen
const googleGen = ImageGeneration.create({ connector: 'google' });

const googleResult = await googleGen.generate({
  prompt: 'A colorful butterfly in a garden',
  model: 'imagen-4.0-generate-001',
});
```

### Video Generation (NEW)

```typescript
import { VideoGeneration } from '@oneringai/agents';

// OpenAI Sora
const videoGen = VideoGeneration.create({ connector: 'openai' });

// Start video generation (async - returns a job)
const job = await videoGen.generate({
  prompt: 'A cinematic shot of a sunrise over mountains',
  model: 'sora-2',
  duration: 8,
  resolution: '1280x720',
});

// Wait for completion
const result = await videoGen.waitForCompletion(job.jobId);

// Download the video
const videoBuffer = await videoGen.download(job.jobId);
await fs.writeFile('./output.mp4', videoBuffer);

// Google Veo
const googleVideo = VideoGeneration.create({ connector: 'google' });

const veoJob = await googleVideo.generate({
  prompt: 'A butterfly flying through a garden',
  model: 'veo-3.0-generate-001',
  duration: 8,
});
```

## Supported Providers

| Provider | Text | Vision | TTS | STT | Image | Video | Tools | Context |
|----------|------|--------|-----|-----|-------|-------|-------|---------|
| **OpenAI** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 128K |
| **Anthropic (Claude)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 200K |
| **Google (Gemini)** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | 1M |
| **Google Vertex AI** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 1M |
| **Grok (xAI)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 128K |
| **Groq** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | 128K |
| **Together AI** | ✅ | Some | ❌ | ❌ | ❌ | ❌ | ✅ | 128K |
| **DeepSeek** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 64K |
| **Mistral** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 32K |
| **Ollama** | ✅ | Varies | ❌ | ❌ | ❌ | ❌ | ✅ | Varies |
| **Custom** | ✅ | Varies | ❌ | ❌ | ❌ | ❌ | ✅ | Varies |

## Key Features

### 1. Universal Agent (NEW)

Combines interactive chat, planning, and task execution in one powerful agent:

```typescript
import { UniversalAgent, FileSessionStorage } from '@oneringai/agents';

const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
  planning: {
    enabled: true,
    autoDetect: true,        // Auto-detect complex tasks
    requireApproval: true,   // Require approval before execution
  },
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
  },
});

// Chat - handles mode transitions automatically
const response = await agent.chat('Check weather and email me the report');
console.log(response.text);
console.log('Mode:', response.mode);  // 'interactive' | 'planning' | 'executing'

// Get current state
const mode = agent.getMode();
const plan = agent.getPlan();
const progress = agent.getProgress();
```

**Features:**
- 🔄 **Auto-mode switching** - Seamlessly transitions between interactive, planning, and executing
- 🧠 **Complexity detection** - LLM detects when tasks need planning
- ✏️ **Dynamic plans** - Users can modify plans mid-execution
- 💾 **Session persistence** - Resume conversations across restarts
- ⚙️ **Runtime configuration** - Change approval requirements on the fly

### 2. Dynamic Tool Management (NEW)

Control tools at runtime for all agent types:

```typescript
import { Agent } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool, databaseTool],
});

// Disable tool temporarily
agent.tools.disable('database_tool');

// Enable later
agent.tools.enable('database_tool');

// Context-aware selection
const selected = agent.tools.selectForContext({
  mode: 'interactive',
  priority: 'high',
});

// Backward compatible
agent.addTool(newTool);        // Still works!
agent.removeTool('old_tool');  // Still works!
```

### 3. Session Persistence (NEW)

Save and resume conversations for any agent type:

```typescript
import { Agent, FileSessionStorage } from '@oneringai/agents';

// Create agent with session support
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
    autoSaveIntervalMs: 30000,  // Auto-save every 30s
  },
});

await agent.run('Remember: my favorite color is blue');
const sessionId = agent.getSessionId();

// Later... resume from session
const resumed = await Agent.resume(sessionId, {
  storage: new FileSessionStorage({ directory: './sessions' }),
});

await resumed.run('What is my favorite color?');
// Output: "Your favorite color is blue."
```

### 4. Task Agents

Autonomous agents for complex workflows:

```typescript
import { TaskAgent } from '@oneringai/agents';

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
});

await agent.start({
  goal: 'Check weather and notify user',
  tasks: [
    { name: 'fetch_weather', description: 'Get weather for SF' },
    { name: 'send_email', description: 'Email user', dependsOn: ['fetch_weather'] },
  ],
});
```

**Features:**
- 📝 **Working Memory** - Store and retrieve data across tasks
- 🧠 **Context Management** - Automatic handling of context limits
- ⏸️ **State Persistence** - Resume after crashes or long waits
- 🔗 **External Dependencies** - Wait for webhooks, polling, manual input
- 🔄 **Tool Idempotency** - Prevent duplicate side effects

### 5. Context Management

Five strategies for different use cases:

```typescript
import { ContextManager } from '@oneringai/agents';

const contextManager = new ContextManager(provider, {
  strategy: 'adaptive',  // or 'proactive', 'aggressive', 'lazy', 'rolling-window'
}, compactors, estimator);

// Automatically manages context window
// - Tracks token usage
// - Compacts when approaching limits
// - Adapts based on usage patterns
```

### 6. Audio Capabilities (NEW)

Text-to-Speech and Speech-to-Text with multiple providers:

```typescript
import { TextToSpeech, SpeechToText } from '@oneringai/agents';

// === Text-to-Speech ===
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',       // or 'gpt-4o-mini-tts' for instruction steering
  voice: 'nova',
});

// Synthesize to file
await tts.toFile('Hello, world!', './output.mp3');

// Synthesize with options
const audio = await tts.synthesize('Speak slowly', {
  format: 'wav',
  speed: 0.75,
});

// Introspection
const voices = await tts.listVoices();
const models = tts.listAvailableModels();

// === Speech-to-Text ===
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',      // or 'gpt-4o-transcribe'
});

// Transcribe
const result = await stt.transcribeFile('./audio.mp3');
console.log(result.text);

// With timestamps
const detailed = await stt.transcribeWithTimestamps(audioBuffer, 'word');
console.log(detailed.words);  // [{ word, start, end }, ...]

// Translation
const english = await stt.translate(frenchAudio);
```

**Available Models:**
- **TTS**: OpenAI (`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`), Google (`gemini-tts`)
- **STT**: OpenAI (`whisper-1`, `gpt-4o-transcribe`), Groq (`whisper-large-v3` - 12x cheaper!)

### 7. Model Registry

Complete metadata for 23+ models:

```typescript
import { getModelInfo, calculateCost, LLM_MODELS, Vendor } from '@oneringai/agents';

// Get model information
const model = getModelInfo('gpt-5.2-thinking');
console.log(model.features.input.tokens);  // 400000
console.log(model.features.input.cpm);     // 1.75 (cost per million)

// Calculate costs
const cost = calculateCost('gpt-5.2-thinking', 50_000, 2_000);
console.log(`Cost: $${cost}`);  // $0.1155

// With caching
const cachedCost = calculateCost('gpt-5.2-thinking', 50_000, 2_000, {
  useCachedInput: true
});
console.log(`Cached: $${cachedCost}`);  // $0.0293 (90% discount)
```

**Available Models:**
- **OpenAI (11)**: GPT-5.2 series, GPT-5 family, GPT-4.1, o3-mini
- **Anthropic (5)**: Claude 4.5 series, Claude 4.x
- **Google (7)**: Gemini 3, Gemini 2.5

### 8. Streaming

Real-time responses:

```typescript
import { StreamHelpers } from '@oneringai/agents';

for await (const text of StreamHelpers.textOnly(agent.stream('Hello'))) {
  process.stdout.write(text);
}
```

### 9. OAuth for External APIs

```typescript
import { OAuthManager, FileStorage } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  storage: new FileStorage({ directory: './tokens' }),
});

const authUrl = await oauth.startAuthFlow('user123');
```

### 10. Developer Tools (NEW)

File system and shell tools for building coding assistants:

```typescript
import { developerTools } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: developerTools, // Includes all 7 tools
});

// Agent can now:
// - Read files (read_file)
// - Write files (write_file)
// - Edit files with surgical precision (edit_file)
// - Search files by pattern (glob)
// - Search content with regex (grep)
// - List directories (list_directory)
// - Execute shell commands (bash)

await agent.run('Read package.json and tell me the dependencies');
await agent.run('Find all TODO comments in the src directory');
await agent.run('Run npm test and report any failures');
```

**Available Tools:**
- **read_file** - Read file contents with line numbers
- **write_file** - Create/overwrite files
- **edit_file** - Surgical find/replace edits
- **glob** - Find files by pattern (`**/*.ts`)
- **grep** - Search content with regex
- **list_directory** - List directory contents
- **bash** - Execute shell commands with safety guards

**Safety Features:**
- Blocked dangerous commands (`rm -rf /`, fork bombs)
- Configurable blocked directories (`node_modules`, `.git`)
- Timeout protection (default 2 min)
- Output truncation for large outputs

## MCP (Model Context Protocol) Integration

Connect to MCP servers for automatic tool discovery and seamless integration:

```typescript
import { MCPRegistry, Agent, Connector, Vendor } from '@oneringai/agents';

// Setup authentication
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Connect to local MCP server (stdio)
const fsClient = MCPRegistry.create({
  name: 'filesystem',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
});

// Connect to remote MCP server (HTTP/HTTPS)
const remoteClient = MCPRegistry.create({
  name: 'remote-api',
  transport: 'https',
  transportConfig: {
    url: 'https://mcp.example.com/api',
    token: process.env.MCP_TOKEN,
  },
});

// Connect and discover tools
await fsClient.connect();
await remoteClient.connect();

// Create agent and register MCP tools
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
fsClient.registerTools(agent.tools);
remoteClient.registerTools(agent.tools);

// Agent can now use tools from both MCP servers!
await agent.run('List files and analyze them');
```

**Features:**
- 🔌 **Stdio & HTTP/HTTPS transports** - Local and remote server support
- 🔍 **Automatic tool discovery** - Tools are discovered and registered automatically
- 🏷️ **Namespaced tools** - `mcp:{server}:{tool}` prevents conflicts
- 🔄 **Auto-reconnect** - Exponential backoff with configurable retry
- 📊 **Session management** - Persistent connections with session IDs
- 🔐 **Permission integration** - All MCP tools require user approval
- ⚙️ **Configuration file** - Declare servers in `oneringai.config.json`

**Available MCP Servers:**
- [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers) - File system access
- [@modelcontextprotocol/server-github](https://github.com/modelcontextprotocol/servers) - GitHub API
- [@modelcontextprotocol/server-google-drive](https://github.com/modelcontextprotocol/servers) - Google Drive
- [@modelcontextprotocol/server-slack](https://github.com/modelcontextprotocol/servers) - Slack integration
- [@modelcontextprotocol/server-postgres](https://github.com/modelcontextprotocol/servers) - PostgreSQL database
- [And many more...](https://github.com/modelcontextprotocol/servers)

See [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) for complete documentation.

## Documentation

📖 **[Complete User Guide](./USER_GUIDE.md)** - Comprehensive guide covering all features

### Additional Resources

- **[MCP_INTEGRATION.md](./MCP_INTEGRATION.md)** - Model Context Protocol integration guide
- **[CLAUDE.md](./CLAUDE.md)** - Architecture guide for AI assistants
- **[MULTIMODAL_ARCHITECTURE.md](./MULTIMODAL_ARCHITECTURE.md)** - Multimodal implementation details
- **[MICROSOFT_GRAPH_SETUP.md](./MICROSOFT_GRAPH_SETUP.md)** - Microsoft Graph OAuth setup
- **[TESTING.md](./TESTING.md)** - Testing guide for contributors

## Examples

```bash
# Basic examples
npm run example:basic              # Simple text generation
npm run example:streaming          # Streaming responses
npm run example:vision             # Image analysis
npm run example:tools              # Tool calling

# Audio examples
npm run example:audio              # TTS and STT demo

# Task Agent examples
npm run example:task-agent         # Basic task agent
npm run example:task-agent-demo    # Full demo with memory
npm run example:planning-agent     # AI-driven planning

# Context management
npm run example:context-management # All strategies demo
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## Architecture

The library uses **Connector-First Architecture**:

```
User Code → Connector Registry → Agent → Provider → LLM
```

**Benefits:**
- ✅ Single source of truth for authentication
- ✅ Multiple keys per vendor
- ✅ Named connectors for easy reference
- ✅ No API key management in agent code
- ✅ Same pattern for AI providers AND external APIs

## Troubleshooting

### "Connector not found"
Make sure you created the connector with `Connector.create()` before using it.

### "Invalid API key"
Check your `.env` file and ensure the key is correct for that vendor.

### "Model not found"
Each vendor has different model names. Check the [User Guide](./USER_GUIDE.md) for supported models.

### Vision not working
Use a vision-capable model: `gpt-4o`, `claude-opus-4-5-20251101`, `gemini-3-flash-preview`.

## Contributing

Contributions are welcome! Please see our [Contributing Guide](./CONTRIBUTING.md) (coming soon).

## License

MIT License - See [LICENSE](./LICENSE) file.

---

**Version:** 0.2.0
**Last Updated:** 2026-01-25

For detailed documentation on all features, see the **[Complete User Guide](./USER_GUIDE.md)**.

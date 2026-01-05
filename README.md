# @oneringai/agents

A unified AI agent library with multi-vendor support for text generation, image generation, and agentic workflows.

> **🚀 Quick Start**: Want to try it now? See [QUICKSTART.md](./QUICKSTART.md) to chat with an AI in under 2 minutes!

## Features

- **🎯 Unified API**: Single client for multiple AI providers (OpenAI, Anthropic, Google, etc.)
- **🤖 Agentic Workflows**: Built-in support for tool calling and multi-turn conversations
- **🖼️ Multi-Modal**: Text generation, image generation, and more
- **🔧 Extensible**: Easy to add new providers and capabilities
- **📦 Type-Safe**: Full TypeScript support with comprehensive types
- **🏗️ Clean Architecture**: Domain-driven design with separation of concerns

## Installation

```bash
npm install @oneringai/agents
```

## Quick Start

### Basic Usage

```typescript
import { OneRingAI } from '@oneringai/agents';

// Create a client with your API keys
const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY }
  }
});

// Generate text
const response = await client.text.generate('What is the capital of France?', {
  provider: 'openai',
  model: 'gpt-4'
});

console.log(response); // "The capital of France is Paris."
```

### Agent with Tools

```typescript
import { OneRingAI } from '@oneringai/agents';

const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY }
  }
});

// Define a tool
const weatherTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name'
          }
        },
        required: ['location']
      }
    },
    blocking: true  // Wait for result before continuing (default)
  },
  execute: async (args: { location: string }) => {
    // Your implementation
    return {
      temperature: 72,
      conditions: 'sunny',
      location: args.location
    };
  }
};

// Create an agent with tools
const agent = client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
  instructions: 'You are a helpful assistant that can check the weather.'
});

// Run the agent
const result = await agent.run('What is the weather in Paris?');
console.log(result.output_text);
```

### Multi-Provider Setup

```typescript
const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_API_KEY }
  }
});

// Use different providers for different tasks
const gptAgent = client.agents.create({
  provider: 'openai',
  model: 'gpt-4'
});

const claudeAgent = client.agents.create({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022'
});
```

### Image Generation

```typescript
const image = await client.images.generate({
  provider: 'openai',
  model: 'dall-e-3',
  prompt: 'A serene mountain landscape at sunset',
  size: '1024x1024',
  quality: 'hd'
});

console.log(image.data[0].url);
```

## API Reference

### OneRingAI Client

The main entry point for the library.

```typescript
const client = new OneRingAI({
  providers: {
    openai?: { apiKey: string, organization?: string },
    anthropic?: { apiKey: string },
    google?: { apiKey: string },
    // ... more providers
  },
  defaultProvider?: string,
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
});
```

### Capabilities

#### `client.agents` - Agentic Text Generation

Create agents with tool calling capabilities.

```typescript
const agent = client.agents.create({
  provider: string,
  model: string,
  instructions?: string,
  tools?: ToolFunction[],
  temperature?: number,
  maxIterations?: number
});

const response = await agent.run(input: string | InputItem[]);
```

#### `client.text` - Simple Text Generation

Generate text without tools.

```typescript
const text = await client.text.generate(input, {
  provider: string,
  model: string,
  instructions?: string,
  temperature?: number,
  max_output_tokens?: number
});
```

#### `client.images` - Image Generation

Generate images from text prompts.

```typescript
const image = await client.images.generate({
  provider: string,
  model: string,
  prompt: string,
  size?: string,
  quality?: 'standard' | 'hd'
});
```

### Tool System

Tools are functions that agents can call during execution.

```typescript
interface ToolFunction {
  definition: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: JSONSchema;
    };
    blocking?: boolean;  // Default: true
    timeout?: number;    // Default: 30000ms
  };
  execute: (args: any) => Promise<any>;
}
```

## Architecture

The library follows clean architecture principles:

- **Domain Layer**: Core entities, interfaces, and business logic
- **Application Layer**: Use cases and services (AgentManager, TextManager, etc.)
- **Infrastructure Layer**: Provider implementations (OpenAI, Anthropic, etc.)

## Supported Providers

### Text Generation
- ✅ OpenAI (GPT-4, GPT-3.5, o1)
- 🚧 Anthropic (Claude) - Coming soon
- 🚧 Google (Gemini) - Coming soon

### Image Generation
- 🚧 OpenAI (DALL-E) - Coming soon
- 🚧 Google (Imagen) - Coming soon

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Watch mode for development
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## License

MIT

## Examples

Check out the `/examples` directory for more usage examples:

- `basic-agent.ts` - Simple agent with tool calling
- `simple-text.ts` - Text generation and JSON output
- `multi-turn-conversation.ts` - Complex multi-turn dialogues
- `interactive-chat.ts` - **Interactive chat session** (try it: `npm run example:chat`)

## Support

For issues and questions, please use the GitHub issue tracker.

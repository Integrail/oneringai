# Provider Guide

Complete guide to all supported AI providers in `@oneringai/agents`.

## Supported Providers

| Provider | Status | Text | Vision | Tools | JSON Schema | Context |
|----------|--------|------|--------|-------|-------------|---------|
| **OpenAI** | ✅ | ✅ | ✅ | ✅ | ✅ Native | 128K |
| **Anthropic** | ✅ | ✅ | ✅ | ✅ | ⚠️ Prompt | 200K |
| **Google** | ✅ | ✅ | ✅ | ✅ | ⚠️ Prompt | 1M |
| **Grok** (xAI) | ✅ | ✅ | ✅ | ✅ | ❌ | 128K |
| **Groq** | ✅ | ✅ | ❌ | ✅ | ❌ | 128K |
| **Together AI** | ✅ | ✅ | ⚠️ Some | ✅ | ❌ | 128K |
| **Custom** | ✅ | ✅ | Varies | ✅ | Varies | Varies |

## OpenAI

### Configuration

```typescript
const client = new OneRingAI({
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      organization: 'org-...', // Optional
      project: 'proj_...', // Optional
    }
  }
});
```

### Popular Models

| Model | Context | Output | Best For |
|-------|---------|--------|----------|
| `gpt-4o` | 128K | 16K | Vision, speed, cost |
| `gpt-4o-mini` | 128K | 16K | Cheapest, fast |
| `gpt-4-turbo` | 128K | 4K | Complex tasks |
| `gpt-3.5-turbo` | 16K | 4K | Simple tasks, speed |
| `o1-preview` | 128K | 32K | Reasoning (no tools) |

### Features
- ✅ Native Responses API (no conversion)
- ✅ Tool calling
- ✅ Vision (URLs and base64)
- ✅ JSON schema validation
- ✅ Streaming (future)

### Get API Key
https://platform.openai.com/api-keys

---

## Anthropic (Claude)

### Configuration

```typescript
const client = new OneRingAI({
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      anthropicVersion: '2023-06-01', // Optional
    }
  }
});
```

### Popular Models

| Model | Context | Output | Best For |
|-------|---------|--------|----------|
| `claude-sonnet-4-20250514` | 200K | 8K | Latest Sonnet (best overall, vision) |
| `claude-3-5-sonnet-20240620` | 200K | 8K | Claude 3.5 Sonnet |
| `claude-3-opus-20240229` | 200K | 4K | Most capable |
| `claude-3-sonnet-20240229` | 200K | 4K | Balanced |
| `claude-3-haiku-20240307` | 200K | 4K | Fastest, cheapest |

### Features
- ✅ Tool calling
- ✅ Vision (URLs and base64)
- ⚠️ JSON via prompt engineering (no native schema)
- ✅ Very large context (200K)
- ✅ Extended thinking in Claude 3.7

### Notes
- Uses Messages API (converted from Responses API)
- Vision requires Claude 3+ models
- Tool format slightly different (object vs JSON string)

### Get API Key
https://console.anthropic.com/

---

## Google (Gemini)

### Configuration

```typescript
const client = new OneRingAI({
  providers: {
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
    }
  }
});
```

### Popular Models

| Model | Context | Output | Best For |
|-------|---------|--------|----------|
| `gemini-2.0-flash-exp` | 1M | 8K | Latest, fast, experimental |
| `gemini-1.5-pro-latest` | 1M | 8K | Most capable |
| `gemini-1.5-flash-latest` | 1M | 8K | Fast, cost-effective |

### Features
- ✅ Tool calling (functionCall/functionResponse)
- ✅ Vision (inline data - base64)
- ⚠️ JSON mode (no full schema support)
- ✅ Massive context window (1M tokens)

### Notes
- Uses Gemini API (very different format)
- **Images converted to base64 automatically** (URLs fetched)
- Tool results need function name (tracked internally)

### Get API Key
https://makersuite.google.com/app/apikey

---

## Grok (xAI)

### Configuration

```typescript
const client = new OneRingAI({
  providers: {
    grok: {
      apiKey: process.env.GROK_API_KEY,
      baseURL: 'https://api.x.ai/v1', // Auto-configured
    }
  }
});
```

### Models

| Model | Context | Output | Best For |
|-------|---------|--------|----------|
| `grok-2` | 128K | 4K | Latest model |
| `grok-2-vision` | 128K | 4K | Vision support |

### Features
- ✅ OpenAI-compatible API
- ✅ Tool calling
- ✅ Vision (grok-2-vision)
- ❌ No JSON schema

### Notes
- Uses Generic OpenAI Provider
- Same interface as OpenAI
- Developed by xAI (Elon Musk's company)

### Get API Key
https://x.ai/api

---

## Groq (Fast Inference)

### Configuration

```typescript
const client = new OneRingAI({
  providers: {
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1', // Auto-configured
    }
  }
});
```

### Popular Models

| Model | Context | Output | Best For |
|-------|---------|--------|----------|
| `llama-3.1-70b-versatile` | 128K | 8K | Best Llama model |
| `llama-3.1-8b-instant` | 128K | 8K | Fastest |
| `mixtral-8x7b-32768` | 32K | 32K | Good quality |

### Features
- ✅ OpenAI-compatible API
- ✅ Tool calling
- ❌ No vision
- ✅ Extremely fast inference (LPU hardware)

### Notes
- Uses Generic OpenAI Provider
- Focus on speed (sub-second latency)
- Free tier available
- May have capacity limits

### Get API Key
https://console.groq.com/

---

## Together AI (Llama & More)

### Configuration

```typescript
const client = new OneRingAI({
  providers: {
    'together-ai': {
      apiKey: process.env.TOGETHER_API_KEY,
      baseURL: 'https://api.together.xyz/v1', // Auto-configured
    }
  }
});
```

### Popular Models

| Model | Context | Output | Best For |
|-------|---------|--------|----------|
| `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` | 128K | 4K | Best Llama |
| `meta-llama/Llama-3.2-90B-Vision-Instruct` | 128K | 4K | Vision support |
| `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | 128K | 4K | Fast, cheap |
| `mistralai/Mixtral-8x7B-Instruct-v0.1` | 32K | 4K | Good quality |

### Features
- ✅ OpenAI-compatible API
- ✅ Tool calling
- ⚠️ Vision (some models)
- ✅ Many open-source models

### Notes
- Uses Generic OpenAI Provider
- Hosts many popular open-source models
- Good for Llama models
- Cost-effective

### Get API Key
https://api.together.xyz/settings/api-keys

---

## Custom OpenAI-Compatible Providers

### Configuration

Any provider with an OpenAI-compatible API:

```typescript
const client = new OneRingAI({
  providers: {
    'my-custom-provider': {
      apiKey: 'your-api-key',
      baseURL: 'https://api.custom-provider.com/v1',
    }
  }
});
```

Then use it:
```typescript
const response = await client.text.generate('Hello', {
  provider: 'my-custom-provider',
  model: 'their-model-name',
});
```

### Supported Custom Providers
- **Perplexity**: `https://api.perplexity.ai`
- **Fireworks AI**: `https://api.fireworks.ai/inference/v1`
- **Anyscale**: `https://api.endpoints.anyscale.com/v1`
- **OpenRouter**: `https://openrouter.ai/api/v1`
- **Local models** (LM Studio, Ollama with OpenAI compat)

---

## Usage Examples

### Simple Text Generation

```typescript
import { OneRingAI } from '@oneringai/agents';

const client = new OneRingAI({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
  }
});

const response = await client.text.generate('What is AI?', {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514'
});
```

### Agent with Tools

```typescript
const agent = client.agents.create({
  provider: 'google',
  model: 'gemini-1.5-pro-latest',
  tools: [weatherTool, calculatorTool],
});

const result = await agent.run('What is the weather in Tokyo?');
```

### Vision / Image Analysis

```typescript
import { createMessageWithImages } from '@oneringai/agents';

const input = createMessageWithImages(
  'What is in this image?',
  ['https://example.com/photo.jpg']
);

const response = await client.text.generateRaw([input], {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514'
});
```

### Multi-Provider Setup

```typescript
const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_API_KEY },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1'
    }
  }
});

// Use different providers for different tasks
const gptAgent = client.agents.create({ provider: 'openai', model: 'gpt-4' });
const claudeAgent = client.agents.create({ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' });
const geminiAgent = client.agents.create({ provider: 'google', model: 'gemini-1.5-pro-latest' });
```

## Provider Comparison

### Pricing (Approximate, as of Jan 2025)

| Provider | Model | Input (per 1M tokens) | Output (per 1M tokens) |
|----------|-------|----------------------|------------------------|
| OpenAI | gpt-4o | $2.50 | $10.00 |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 |
| Anthropic | claude-3-5-sonnet | $3.00 | $15.00 |
| Anthropic | claude-3-haiku | $0.25 | $1.25 |
| Google | gemini-1.5-pro-latest | $1.25 | $5.00 |
| Google | gemini-1.5-flash-latest | $0.075 | $0.30 |
| Groq | llama-3.1-70b | Free tier | Free tier |
| Together AI | llama-3.1-70b | $0.88 | $0.88 |

### Speed (Approximate)

| Provider | Typical Latency | Notes |
|----------|----------------|-------|
| **Groq** | ⚡⚡⚡⚡⚡ Ultra-fast | 100-300ms, LPU hardware |
| **Together AI** | ⚡⚡⚡⚡ Very fast | 500-1000ms |
| **OpenAI** | ⚡⚡⚡ Fast | 1-3s |
| **Anthropic** | ⚡⚡⚡ Fast | 1-3s |
| **Google** | ⚡⚡ Moderate | 2-5s |

### Quality (Subjective)

| Provider | Model | Quality | Best Use Cases |
|----------|-------|---------|----------------|
| **Anthropic** | Claude 3.5 Sonnet | ⭐⭐⭐⭐⭐ | Coding, analysis, long context |
| **OpenAI** | GPT-4o | ⭐⭐⭐⭐⭐ | General purpose, vision |
| **Google** | Gemini 1.5 Pro | ⭐⭐⭐⭐ | Massive context, multimodal |
| **Groq** | Llama 3.1 70B | ⭐⭐⭐⭐ | Speed-critical apps |
| **Together AI** | Llama 3.1 70B | ⭐⭐⭐⭐ | Cost-effective, open source |

## Configuration Examples

### All Providers at Once

```typescript
const client = new OneRingAI({
  providers: {
    // OpenAI
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },

    // Anthropic (Claude)
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },

    // Google (Gemini)
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
    },

    // Grok (xAI)
    grok: {
      apiKey: process.env.GROK_API_KEY,
    },

    // Groq (fast Llama)
    groq: {
      apiKey: process.env.GROQ_API_KEY,
    },

    // Together AI (Llama & more)
    'together-ai': {
      apiKey: process.env.TOGETHER_API_KEY,
    },
  }
});
```

### Environment Variables

Add to `.env`:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
GROK_API_KEY=xai-...
GROQ_API_KEY=gsk_...
TOGETHER_API_KEY=...
```

## Feature Support Matrix

### Text Generation

All providers support basic text generation:

```typescript
const response = await client.text.generate('Hello, world!', {
  provider: 'anthropic', // or 'openai', 'google', etc.
  model: 'claude-sonnet-4-20250514',
});
```

### Tool Calling

| Provider | Support | Notes |
|----------|---------|-------|
| OpenAI | ✅ Full | Native support |
| Anthropic | ✅ Full | Native support |
| Google | ✅ Full | FunctionCall format |
| Grok | ✅ Full | OpenAI-compatible |
| Groq | ✅ Full | OpenAI-compatible |
| Together AI | ✅ Full | OpenAI-compatible |

```typescript
const agent = client.agents.create({
  provider: 'google', // Works with any provider!
  model: 'gemini-1.5-pro-latest',
  tools: [myTool],
});
```

### Vision / Image Analysis

| Provider | Support | Image Format | Notes |
|----------|---------|--------------|-------|
| OpenAI | ✅ | URLs, base64 | gpt-4o, gpt-4-turbo |
| Anthropic | ✅ | URLs, base64 | Claude 3+ models |
| Google | ✅ | Base64 only | **URLs auto-converted** |
| Grok | ✅ | URLs, base64 | grok-2-vision model |
| Groq | ❌ | N/A | No vision models |
| Together AI | ⚠️ | Varies | Some Llama 3.2 models |

```typescript
import { createMessageWithImages } from '@oneringai/agents';

const input = createMessageWithImages(
  'Describe this image',
  ['https://example.com/photo.jpg']
);

const response = await client.text.generateRaw([input], {
  provider: 'google', // Works! Auto-converts URL to base64
  model: 'gemini-1.5-pro-latest',
});
```

### JSON Output

| Provider | Schema Support | How It Works |
|----------|---------------|--------------|
| OpenAI | ✅ Native | `json_schema` parameter |
| Anthropic | ⚠️ Prompt | Schema added to system prompt |
| Google | ⚠️ Prompt | `responseMimeType: application/json` |
| Others | ❌ | Use `json_object` mode |

```typescript
const result = await client.text.generateJSON(
  'List 3 colors',
  {
    provider: 'openai', // Best JSON schema support
    model: 'gpt-4',
    schema: {
      type: 'object',
      properties: {
        colors: { type: 'array', items: { type: 'string' } }
      }
    }
  }
);
```

## Provider-Specific Tips

### OpenAI
- Use `gpt-4o-mini` for cost savings (80% cheaper than GPT-4)
- Use `gpt-4o` for vision (faster than gpt-4-vision)
- Set `organization` for team accounts

### Anthropic
- Claude 3.5 Sonnet is excellent for coding
- Use `max_tokens` not `max_output_tokens` internally (handled by library)
- Vision works best with Claude 3+
- Massive 200K context window

### Google
- Gemini has the largest context (1M tokens)
- Image URLs are automatically fetched and converted to base64
- Very cost-effective ($1.25/M input tokens)
- Use `gemini-1.5-flash-latest` for speed

### Groq
- **Fastest inference** (100-300ms typical)
- Free tier available
- Limited to Llama and Mixtral models
- No vision support yet
- May hit capacity limits during high usage

### Together AI
- Great for open-source models
- Supports Llama 3.2 90B Vision
- More models than Groq
- Pay per use, no free tier

## Switching Providers

All examples work with any provider by just changing configuration:

```typescript
// Same code, different provider
const agents = [
  client.agents.create({ provider: 'openai', model: 'gpt-4' }),
  client.agents.create({ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' }),
  client.agents.create({ provider: 'google', model: 'gemini-1.5-pro-latest' }),
  client.agents.create({ provider: 'groq', model: 'llama-3.1-70b-versatile' }),
];

// All work exactly the same
for (const agent of agents) {
  const result = await agent.run('What is 2+2?');
  console.log(result.output_text);
}
```

## Troubleshooting

### "Provider not found"
Make sure you configured the provider in the OneRingAI constructor.

### "Invalid API key"
Check your .env file and ensure the key is correct for that provider.

### "Model not found" or "Model not supported"
- OpenAI: Check https://platform.openai.com/docs/models
- Anthropic: Check https://docs.anthropic.com/en/docs/models-overview
- Google: Check https://ai.google.dev/models/gemini
- Groq: Check https://console.groq.com/docs/models
- Together AI: Check https://docs.together.ai/docs/inference-models

### Vision not working
- Make sure you're using a vision-capable model
- OpenAI: Use `gpt-4o` or `gpt-4-turbo`
- Anthropic: Use Claude 3+ models
- Google: Use `gemini-1.5-pro-latest` or `gemini-1.5-flash-latest`
- Together AI: Use `Llama-3.2-90B-Vision-Instruct`

### Tool calling not working
- Most modern models support tools
- Check provider documentation for supported models
- Legacy models (GPT-3.5, Claude 2) may not support tools

## Best Practices

### 1. **Start with One Provider**
Begin with OpenAI (easiest to get started), then add others as needed.

### 2. **Use Environment Variables**
Never hardcode API keys in your code.

### 3. **Handle Provider-Specific Errors**
Different providers may have different rate limits and error codes.

### 4. **Choose Based on Task**
- **Coding**: Anthropic Claude 3.5 Sonnet
- **Speed**: Groq Llama 3.1
- **Cost**: Google Gemini Flash or OpenAI GPT-4o-mini
- **Long context**: Google Gemini (1M) or Anthropic Claude (200K)
- **Vision**: OpenAI GPT-4o or Anthropic Claude 3.5

### 5. **Test with Multiple Providers**
Run `npm run example:providers` to compare responses.

## Rate Limits

| Provider | Free Tier | Paid Tier (Typical) |
|----------|-----------|---------------------|
| OpenAI | None | 10K RPM, 2M TPM |
| Anthropic | None | Varies by plan |
| Google | 15 RPM free | 360+ RPM paid |
| Groq | 30 RPM free | Higher with paid |
| Together AI | None | Pay per use |

**RPM** = Requests per minute
**TPM** = Tokens per minute

## Migration Guide

### From OpenAI SDK

```typescript
// Before (OpenAI SDK)
import OpenAI from 'openai';
const openai = new OpenAI();
const response = await openai.chat.completions.create({...});

// After (@oneringai/agents)
import { OneRingAI } from '@oneringai/agents';
const client = new OneRingAI({ providers: { openai: {...} } });
const response = await client.text.generate('...', { provider: 'openai', ... });
```

### From Anthropic SDK

```typescript
// Before (Anthropic SDK)
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();
const response = await anthropic.messages.create({...});

// After (@oneringai/agents)
import { OneRingAI } from '@oneringai/agents';
const client = new OneRingAI({ providers: { anthropic: {...} } });
const response = await client.text.generate('...', { provider: 'anthropic', ... });
```

### Benefits of Using This Library
- ✅ Unified API across all providers
- ✅ Switch providers without code changes
- ✅ Agentic workflows built-in
- ✅ Vision support normalized
- ✅ Tool calling standardized
- ✅ Better TypeScript types

## Running Examples

```bash
# Compare all providers side-by-side
npm run example:providers

# Use in interactive chat (try different providers)
npm run example:chat

# Vision with any provider
npm run example:vision
```

## Support & Resources

- **OpenAI**: https://platform.openai.com/docs
- **Anthropic**: https://docs.anthropic.com
- **Google**: https://ai.google.dev/docs
- **Groq**: https://console.groq.com/docs
- **Together AI**: https://docs.together.ai
- **Grok**: https://x.ai/api

---

**Last Updated**: 2025-01-06
**Library Version**: 0.1.0
**Providers Supported**: 6+ (OpenAI, Anthropic, Google, Grok, Groq, Together AI, Custom)

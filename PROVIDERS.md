# AI Provider Guide

Complete guide to configuring and using AI providers with `@oneringai/agents`.

## Table of Contents

- [Supported Providers](#supported-providers)
- [Connector-First Architecture](#connector-first-architecture)
- [Provider Configuration](#provider-configuration)
- [Provider-Specific Notes](#provider-specific-notes)
- [Model Recommendations](#model-recommendations)
- [Troubleshooting](#troubleshooting)

---

## Supported Providers

| Provider | Vendor Enum | Text | Vision | Tools | Streaming | JSON Mode |
|----------|-------------|------|--------|-------|-----------|-----------|
| OpenAI | `Vendor.OpenAI` | Yes | Yes | Yes | Yes | Yes |
| Anthropic | `Vendor.Anthropic` | Yes | Yes | Yes | Yes | Yes |
| Google Gemini | `Vendor.Google` | Yes | Yes | Yes | Yes | Yes |
| Google Vertex AI | `Vendor.VertexAI` | Yes | Yes | Yes | Yes | Yes |
| Groq | `Vendor.Groq` | Yes | Limited | Yes | Yes | Yes |
| Together AI | `Vendor.Together` | Yes | Limited | Yes | Yes | Limited |
| Grok (xAI) | `Vendor.Grok` | Yes | Yes | Yes | Yes | Yes |
| OpenAI Compatible | `Vendor.OpenAI` | Varies | Varies | Varies | Varies | Varies |

---

## Connector-First Architecture

### Overview

`@oneringai/agents` uses a **Connector-First** architecture. You create connectors first, then create agents that use those connectors.

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

// 1. Create connectors
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
});

// 2. Create agents using connectors
const gptAgent = Agent.create({ connector: 'openai', model: 'gpt-4' });
const claudeAgent = Agent.create({ connector: 'anthropic', model: 'claude-sonnet-4-5-20250929' });

// 3. Use agents
const response = await gptAgent.run('Hello!');
```

### Named Connectors

You can create multiple connectors per vendor:

```typescript
// Different API keys for different purposes
Connector.create({
  name: 'openai-main',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

Connector.create({
  name: 'openai-backup',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_BACKUP_KEY! },
});

// Use specific connector
const agent = Agent.create({ connector: 'openai-main', model: 'gpt-4' });
```

---

## Provider Configuration

### OpenAI

```typescript
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
  // Optional
  baseURL: 'https://api.openai.com/v1',
  organization: 'org-xxx',
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4o',  // or 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'
  tools: [myTool],
  instructions: 'You are a helpful assistant.',
});
```

**Get API Key**: https://platform.openai.com/api-keys

### Anthropic (Claude)

```typescript
Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
});

const agent = Agent.create({
  connector: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',  // or 'claude-3-opus-20240229', 'claude-3-haiku-20240307'
  tools: [myTool],
  instructions: 'You are Claude, a helpful AI assistant.',
});
```

**Get API Key**: https://console.anthropic.com/

### Google Gemini

```typescript
Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
});

const agent = Agent.create({
  connector: 'google',
  model: 'gemini-2.0-flash',  // or 'gemini-1.5-pro', 'gemini-1.5-flash'
  tools: [myTool],
});
```

**Get API Key**: https://makersuite.google.com/app/apikey

### Google Vertex AI

```typescript
Connector.create({
  name: 'vertex',
  vendor: Vendor.VertexAI,
  auth: {
    type: 'adc',  // Application Default Credentials
    projectId: process.env.GOOGLE_PROJECT_ID!,
    location: 'us-central1',  // or your region
  },
});

const agent = Agent.create({
  connector: 'vertex',
  model: 'gemini-1.5-pro',  // Same models as Gemini API
  tools: [myTool],
});
```

**Setup**:
```bash
# One-time setup
gcloud auth application-default login

# Or use service account
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Groq

```typescript
Connector.create({
  name: 'groq',
  vendor: Vendor.Groq,
  auth: { type: 'api_key', apiKey: process.env.GROQ_API_KEY! },
});

const agent = Agent.create({
  connector: 'groq',
  model: 'llama-3.1-70b-versatile',  // or 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'
  tools: [myTool],
});
```

**Get API Key**: https://console.groq.com/

### Together AI

```typescript
Connector.create({
  name: 'together',
  vendor: Vendor.Together,
  auth: { type: 'api_key', apiKey: process.env.TOGETHER_API_KEY! },
});

const agent = Agent.create({
  connector: 'together',
  model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  tools: [myTool],
});
```

**Get API Key**: https://together.ai/

### Grok (xAI)

```typescript
Connector.create({
  name: 'grok',
  vendor: Vendor.Grok,
  auth: { type: 'api_key', apiKey: process.env.XAI_API_KEY! },
});

const agent = Agent.create({
  connector: 'grok',
  model: 'grok-2',  // or 'grok-2-vision'
  tools: [myTool],
});
```

**Get API Key**: https://console.x.ai/

### OpenAI-Compatible APIs

Use any OpenAI-compatible API:

```typescript
// Ollama (local)
Connector.create({
  name: 'ollama',
  vendor: Vendor.OpenAI,
  auth: { type: 'none' },
  baseURL: 'http://localhost:11434/v1',
});

const agent = Agent.create({
  connector: 'ollama',
  model: 'llama2',
});

// Perplexity
Connector.create({
  name: 'perplexity',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.PERPLEXITY_API_KEY! },
  baseURL: 'https://api.perplexity.ai',
});

// LM Studio
Connector.create({
  name: 'lmstudio',
  vendor: Vendor.OpenAI,
  auth: { type: 'none' },
  baseURL: 'http://localhost:1234/v1',
});
```

---

## Provider-Specific Notes

### OpenAI

**Best for**: General purpose, JSON mode, structured output
**Models**: GPT-4o (vision), GPT-4 Turbo, GPT-3.5 Turbo
**Token Limits**: 128K (GPT-4o), 128K (GPT-4 Turbo), 16K (GPT-3.5)
**Special**: Native Responses API support (no conversion needed)

### Anthropic (Claude)

**Best for**: Long context, coding, analysis, safety
**Models**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
**Token Limits**: 200K context
**Special**: Best at following complex instructions

### Google Gemini

**Best for**: Long context, multimodal (images, PDF, video)
**Models**: Gemini 1.5 Pro (best), Gemini 1.5 Flash (fast), Gemini 2.0
**Token Limits**: 1M context (Gemini 1.5 Pro!)
**Special**: Native video and PDF understanding

### Google Vertex AI

**Same as Gemini** with enterprise features:
- SLA guarantees
- Enterprise security
- Custom model tuning
- Usage analytics

### Groq

**Best for**: Speed! Fastest inference available
**Models**: Llama 3.1 (70B, 8B), Mixtral
**Token Limits**: 32K-128K depending on model
**Special**: Sub-second response times

### Together AI

**Best for**: Open-source models, cost-effectiveness
**Models**: Llama 3.1, Mistral, CodeLlama, and many more
**Special**: Widest selection of open-source models

### Grok (xAI)

**Best for**: Real-time information, humor, unfiltered
**Models**: Grok-2, Grok-2-Vision
**Special**: Access to X/Twitter data

---

## Model Recommendations

### By Use Case

| Use Case | Recommended | Why |
|----------|-------------|-----|
| **General Chat** | GPT-4o, Claude 3.5 Sonnet | Best overall quality |
| **Code Generation** | Claude 3.5 Sonnet, GPT-4o | Excellent code understanding |
| **Long Documents** | Gemini 1.5 Pro | 1M token context |
| **Speed Priority** | Groq Llama 3.1, GPT-4o mini | Sub-second responses |
| **Cost Sensitive** | Groq, Together AI, GPT-3.5 | Much cheaper |
| **Vision/Images** | GPT-4o, Claude 3.5, Gemini 1.5 | Native vision support |
| **Enterprise** | Vertex AI, Azure OpenAI | SLA, compliance |
| **Local/Offline** | Ollama + Llama 3.1 | No cloud dependency |

### By Budget

| Budget | Models |
|--------|--------|
| **Premium** | GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro |
| **Mid-range** | GPT-4o mini, Claude 3 Haiku, Gemini 1.5 Flash |
| **Budget** | Groq (free tier), Together AI, GPT-3.5 |
| **Free** | Ollama (local), LM Studio (local) |

---

## Feature Support Matrix

### Tool Calling

| Provider | Support | Notes |
|----------|---------|-------|
| OpenAI | Yes | Native support |
| Anthropic | Yes | Native support |
| Google | Yes | FunctionCall format |
| Grok | Yes | OpenAI-compatible |
| Groq | Yes | OpenAI-compatible |
| Together AI | Yes | OpenAI-compatible |

### Vision / Image Analysis

| Provider | Support | Image Format | Notes |
|----------|---------|--------------|-------|
| OpenAI | Yes | URLs, base64 | gpt-4o, gpt-4-turbo |
| Anthropic | Yes | URLs, base64 | Claude 3+ models |
| Google | Yes | Base64 only | **URLs auto-converted** |
| Grok | Yes | URLs, base64 | grok-2-vision model |
| Groq | No | N/A | No vision models |
| Together AI | Limited | Varies | Some Llama 3.2 models |

### JSON Output

| Provider | Schema Support | How It Works |
|----------|---------------|--------------|
| OpenAI | Native | `json_schema` parameter |
| Anthropic | Prompt | Schema added to system prompt |
| Google | Prompt | `responseMimeType: application/json` |
| Others | No | Use `json_object` mode |

---

## Troubleshooting

### Authentication Errors

**Error**: `401 Unauthorized`

**Solutions**:
1. Check API key is correct
2. Check API key is not expired
3. Check you have billing set up
4. Check you have access to the model

```typescript
// Debug: Print masked key
console.log('Key:', process.env.OPENAI_API_KEY?.slice(0, 10) + '...');
```

### Model Not Found

**Error**: `Model not found` or `Invalid model`

**Solutions**:
1. Check model name spelling
2. Check you have access to the model
3. Some models require special access (GPT-4, Claude Opus)

```typescript
// Check available models
// OpenAI: https://platform.openai.com/docs/models
// Anthropic: https://docs.anthropic.com/claude/docs/models-overview
// Google: https://ai.google.dev/models/gemini
```

### Rate Limits

**Error**: `429 Too Many Requests`

**Solutions**:
1. Add retry logic with exponential backoff
2. Reduce request frequency
3. Upgrade to higher tier

```typescript
// Rate limit handling is automatic in the library
// For custom handling, use hooks:
hooks: {
  'before:llm': async () => {
    await new Promise(r => setTimeout(r, 1000));  // 1 second delay
    return {};
  }
}
```

### Context Length Exceeded

**Error**: `Context length exceeded` or `Max tokens exceeded`

**Solutions**:
1. Use a model with longer context (Gemini 1.5 Pro = 1M)
2. Summarize or truncate input
3. Split into multiple calls

### Vision Not Working

**Error**: Images not being processed

**Solutions**:
1. Check model supports vision (GPT-4o, Claude 3, Gemini)
2. Check image format (base64 or URL)
3. Check image size (most providers limit ~4MB)

---

## Examples

### Multi-Provider Comparison

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

// Create connectors for all providers
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
});

Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
});

// Compare responses
const prompt = 'What is the meaning of life?';

const configs = [
  { connector: 'openai', model: 'gpt-4o' },
  { connector: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  { connector: 'google', model: 'gemini-1.5-pro' },
];

for (const config of configs) {
  const agent = Agent.create(config);
  const response = await agent.run(prompt);

  console.log(`\n${config.connector} (${config.model}):`);
  console.log(response.output_text);
}
```

### Run Example

```bash
npm run example:multi-provider
```

---

## Environment Variables

Create a `.env` file with your API keys:

```bash
# Required (pick at least one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# Optional
GROQ_API_KEY=gsk_...
TOGETHER_API_KEY=...
XAI_API_KEY=xai-...

# Google Vertex AI (instead of API key)
GOOGLE_PROJECT_ID=your-project
GOOGLE_LOCATION=us-central1
```

---

**Last Updated**: 2026-01-15
**Supported Providers**: 7+ with unified API

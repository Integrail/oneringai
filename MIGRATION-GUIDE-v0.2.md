# Migration Guide: v0.1 → v0.2

**Major Architectural Redesign**: Providers vs Connectors

## 🎯 What Changed

### Clear Terminology

| Old | New | Purpose |
|-----|-----|---------|
| Provider (ambiguous) | **Provider** | AI capabilities (OpenAI, Anthropic) |
| OAuth Provider (confusing) | **Connector** | External system auth (GitHub, Microsoft) |
| `oauthRegistry` | **`connectorRegistry`** | Registry for connectors |
| `RegisteredProvider` | **`RegisteredConnector`** | Type for registered connectors |

---

## 🚀 Breaking Changes

### 1. Registry Name (Backward Compatible)

```typescript
// ❌ OLD (deprecated but still works)
import { oauthRegistry } from '@oneringai/agents';
oauthRegistry.register('github', { ... });

// ✅ NEW (recommended)
import { connectorRegistry } from '@oneringai/agents';
connectorRegistry.register('github', { ... });
```

### 2. Type Names

```typescript
// ❌ OLD
import { RegisteredProvider } from '@oneringai/agents';

// ✅ NEW
import { RegisteredConnector } from '@oneringai/agents';
```

### 3. Config Structure (New Type)

```typescript
// ❌ OLD (still works via legacy compatibility)
connectorRegistry.register('github', {
  displayName: 'GitHub API',
  baseURL: 'https://api.github.com',
  oauth: {
    flow: 'authorization_code',
    clientId: '...',
    ...
  }
});

// ✅ NEW (recommended - typed ConnectorConfig)
connectorRegistry.register('github', {
  displayName: 'GitHub API',
  description: 'Access GitHub repos and user data',
  baseURL: 'https://api.github.com',
  auth: {
    type: 'oauth',  // NEW: explicit type
    flow: 'authorization_code',
    clientId: '...',
    ...
  }
});
```

### 4. ProviderConfigAgent Return Type

```typescript
// ❌ OLD
interface ProviderConfigResult {
  providerName: string;
  config: { oauth: { ... } };
}

// ✅ NEW
interface ConnectorConfigResult {
  name: string;  // Was: providerName
  config: ConnectorConfig;  // Typed!
  setupInstructions: string;
  envVariables: string[];
  setupUrl?: string;
}
```

---

## 🆕 New Features

### 1. Auto-Connector Creation

**Configure an LLM provider → Get a connector for FREE!**

```typescript
const client = new OneRingAI({
  providers: {
    openai: { apiKey: 'sk-...' },
    anthropic: { apiKey: 'sk-ant-...' },
    google: { apiKey: 'AIza...' }
  }
});

// Connectors automatically created! 🎉
console.log(connectorRegistry.listConnectorNames());
// Output: ['openai-api', 'anthropic-api', 'google-ai-api']

// Use them immediately
const models = await authenticatedFetch(
  'https://api.openai.com/v1/models',
  { method: 'GET' },
  'openai-api'  // Auto-created!
);
```

**Console Output**:
```
[AutoConnector] Created connector: openai-api
[AutoConnector] Created connector: anthropic-api
[AutoConnector] Created connector: google-ai-api
```

**Supported**:
- ✅ OpenAI → `openai-api`
- ✅ Anthropic → `anthropic-api`
- ✅ Google → `google-ai-api`
- ✅ Groq → `groq-api`
- ✅ Grok → `grok-api`
- ✅ Together AI → `together-ai-api`
- ✅ Any OpenAI-compatible provider → `{name}-api`

### 2. Formal Type System

```typescript
// All connector types are now formally defined
import {
  ConnectorConfig,
  ConnectorAuth,
  OAuthConnectorAuth,
  APIKeyConnectorAuth,
  JWTConnectorAuth,
  ConnectorConfigResult,
  IConnector,
} from '@oneringai/agents';
```

### 3. Improved Agent

```typescript
import { ProviderConfigAgent, ConnectorConfigResult } from '@oneringai/agents';

const agent = new ProviderConfigAgent(client);
const result: ConnectorConfigResult = await agent.run('Connect to Slack');

// Typed result!
result.name              // string
result.config            // ConnectorConfig (typed!)
result.setupUrl          // string | undefined (NEW!)
```

---

## 📝 Migration Steps

### Minimal (Recommended)

**Just update imports** - everything else still works:

```typescript
// Change this
import { oauthRegistry } from '@oneringai/agents';

// To this
import { connectorRegistry } from '@oneringai/agents';
```

**That's it!** All your existing code continues to work.

### Complete (For New Code)

Use the new `ConnectorConfig` type:

```typescript
import { connectorRegistry, ConnectorConfig } from '@oneringai/agents';

const githubConnector: ConnectorConfig = {
  displayName: 'GitHub API',
  description: 'Access GitHub repositories and user data',
  baseURL: 'https://api.github.com',
  auth: {
    type: 'oauth',
    flow: 'authorization_code',
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    tokenUrl: 'https://github.com/login/oauth/access_token',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    scope: 'user:email repo'
  }
};

connectorRegistry.register('github', githubConnector);
```

---

## 🎁 Benefits

### 1. Clear Naming
```typescript
// Providers = AI
const agent = await client.agents.create({
  provider: 'openai',  // AI provider
  model: 'gpt-4'
});

// Connectors = API auth
const data = await authenticatedFetch(url, {}, 'github');  // API connector
```

### 2. DRY (Don't Repeat Yourself)
```typescript
// Configure once
const client = new OneRingAI({
  providers: {
    openai: { apiKey: 'sk-...' }
  }
});

// Use for AI
const response = await client.text.generate('Hello', { provider: 'openai' });

// AND use for API access (auto-connector!)
const models = await authenticatedFetch(url, {}, 'openai-api');
```

### 3. Type Safety
```typescript
// Before: ad-hoc objects
oauthRegistry.register('github', { displayName: string, oauth: any });

// After: typed configs
connectorRegistry.register('github', config: ConnectorConfig);
```

### 4. Better Architecture
```
Clean separation:
- Providers (ProviderRegistry) → AI capabilities
- Connectors (ConnectorRegistry) → External APIs
```

---

## 🐛 Fixed Bugs

### Critical: Instructions Not Passed to OpenAI

**Bug**: `options.instructions` was completely ignored by OpenAITextProvider
**Impact**: Agents with specialized instructions didn't work
**Fix**: Now correctly adds instructions as "developer" role message

```typescript
// Before (BROKEN)
messages: [
  { role: 'user', content: 'message' }  // Instructions missing!
]

// After (FIXED)
messages: [
  { role: 'developer', content: instructions },  // ✅ Instructions included
  { role: 'user', content: 'message' }
]
```

---

## 📋 What Was Updated

### Code (11 files)
- ✅ `src/domain/entities/Connector.ts` - NEW types
- ✅ `src/domain/interfaces/IConnector.ts` - NEW interface
- ✅ `src/plugins/oauth/ConnectorRegistry.ts` - NEW registry
- ✅ `src/plugins/oauth/index.ts` - Updated exports
- ✅ `src/client/ProviderRegistry.ts` - Auto-connector creation
- ✅ `src/agents/ProviderConfigAgent.ts` - Returns ConnectorConfigResult
- ✅ `src/tools/code/executeJavaScript.ts` - Uses connectorRegistry
- ✅ `src/infrastructure/providers/openai/OpenAITextProvider.ts` - FIXED instructions bug
- ✅ `src/index.ts` - Updated exports

### Examples (6 files)
- ✅ `examples/interactive-chat.ts`
- ✅ `examples/provider-config-generator.ts`
- ✅ `examples/provider-config-programmatic.ts`
- ✅ `examples/oauth-static-tokens.ts`
- ✅ `examples/oauth-registry-demo.ts`
- ✅ `examples/oauth-multi-user-fetch.ts`

### Documentation (3 files)
- ✅ `README.md` - Updated to connectorRegistry
- ✅ `OAUTH.md` - Updated to connectorRegistry
- ✅ `CLAUDE.md` - Updated to connectorRegistry
- ✅ `ARCHITECTURE-REDESIGN.md` - NEW comprehensive guide

---

## 🧪 Testing

### Test Build
```bash
npm run build
# Should succeed ✅
```

### Test Auto-Connectors
```bash
npm run example:chat
```

Expected console output:
```
[AutoConnector] Created connector: openai-api
```

Then check connectors:
```
👤 You: what connectors are available?
🤖 Assistant: The registered connectors are:
  - openai-api: OpenAI API - Access OpenAI models and APIs
```

### Test ProviderConfigAgent
```bash
npm run example:provider-config
```

Should return `ConnectorConfigResult` with proper types.

---

## 🔮 Future (v0.3.0)

Potential improvements:
1. Rename `OAUTH.md` → `CONNECTORS.md`
2. Remove `oauthRegistry` alias (fully breaking)
3. Full IConnector implementation (wrap OAuthManager)
4. Pre-built connector marketplace

---

**Migration Difficulty**: ⭐ Easy (backward compatible)
**Recommended Action**: Update to `connectorRegistry` in new code
**Timeline**: Deprecation warnings in v0.2.0, removal in v0.3.0

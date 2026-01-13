# Architecture Redesign: Providers vs Connectors

**Date**: 2026-01-12
**Version**: 0.1.0 → 0.2.0 (BREAKING CHANGES)

## The Problem

**Naming confusion**: Two completely different concepts both called "Providers"

1. **LLM Providers** - AI capabilities (OpenAI, Anthropic, Google)
2. **OAuth Providers** - API authentication (GitHub, Microsoft, Salesforce)

**Result**: Developers confused about what "provider" means in different contexts!

---

## The Solution

### Clear Terminology

| Concept | Old Name | New Name | Purpose | Examples |
|---------|----------|----------|---------|----------|
| AI Capabilities | Provider | **Provider** | Text, images, reasoning | OpenAI, Anthropic, Google |
| API Authentication | OAuth Provider | **Connector** | External system auth | GitHub, Microsoft, Salesforce |

### New Architecture

```
OneRingAI Client
│
├── Providers (AI Capabilities)
│   ├── OpenAI, Anthropic, Google
│   ├── Purpose: AI text generation, vision, etc.
│   ├── Registry: ProviderRegistry
│   └── Types: ITextProvider, IImageProvider
│
└── Connectors (External System Auth)
    ├── GitHub, Microsoft, Salesforce, OpenAI API
    ├── Purpose: Authenticated API access
    ├── Registry: ConnectorRegistry (was OAuthRegistry)
    └── Types: IConnector, ConnectorConfig
```

---

## Breaking Changes

### 1. Registry Renamed

```typescript
// ❌ OLD
import { oauthRegistry } from '@oneringai/agents';
oauthRegistry.register('github', { ... });

// ✅ NEW
import { connectorRegistry } from '@oneringai/agents';
connectorRegistry.register('github', { ... });
```

**Backward Compatibility**: `oauthRegistry` still works (aliased) but is deprecated.

### 2. Type Renamed

```typescript
// ❌ OLD
RegisteredProvider

// ✅ NEW
RegisteredConnector
```

### 3. Standardized Config Type

```typescript
// ❌ OLD (ad-hoc object)
oauthRegistry.register('github', {
  displayName: string;
  baseURL: string;
  oauth: { ... };  // No formal type
});

// ✅ NEW (typed)
connectorRegistry.register('github', {
  displayName: string;
  description: string;
  baseURL: string;
  auth: ConnectorAuth;  // Typed union: OAuthConnectorAuth | APIKeyConnectorAuth | JWTConnectorAuth
});
```

### 4. Auth Config Structure

```typescript
// ❌ OLD
oauth: {
  flow: 'authorization_code',
  clientId: '...',
  ...
}

// ✅ NEW
auth: {
  type: 'oauth',  // or 'api_key', 'jwt'
  flow: 'authorization_code',
  clientId: '...',
  ...
}
```

---

## New Features

### 1. Formal Type System

```typescript
// Domain types (exported)
export interface ConnectorConfig {
  displayName: string;
  description: string;
  baseURL: string;
  auth: ConnectorAuth;
  apiVersion?: string;
  rateLimit?: { requestsPerMinute: number };
}

export type ConnectorAuth =
  | OAuthConnectorAuth   // OAuth 2.0 flows
  | APIKeyConnectorAuth  // Static API keys
  | JWTConnectorAuth;    // JWT bearer tokens

// Interface (exported)
export interface IConnector {
  getToken(userId?: string): Promise<string>;
  isTokenValid(userId?: string): Promise<boolean>;
  startAuthFlow?(userId?: string): Promise<string>;
  handleCallback?(url: string, userId?: string): Promise<void>;
  // ... full interface for extension
}
```

### 2. Auto-Connector Creation ⭐ NEW

**When you configure an LLM provider, we auto-create a connector for API access!**

```typescript
const client = new OneRingAI({
  providers: {
    openai: { apiKey: 'sk-...' },       // LLM provider
    anthropic: { apiKey: 'sk-ant-...' }, // LLM provider
    google: { apiKey: 'AIza...' }        // LLM provider
  }
});

// Connectors auto-created! 🎉
console.log(connectorRegistry.listConnectorNames());
// → ['openai-api', 'anthropic-api', 'google-ai-api']

// Use them immediately for API access
const models = await authenticatedFetch(
  'https://api.openai.com/v1/models',
  { method: 'GET' },
  'openai-api'  // Auto-created connector!
);
```

**How it works**:
- `ProviderRegistry` detects LLM provider registration
- Auto-creates corresponding connector with same credentials
- Naming: `{provider}-api` (e.g., `openai-api`, `anthropic-api`)
- Logged to console: `[AutoConnector] Created connector: openai-api`

**Supported**:
- ✅ OpenAI → `openai-api`
- ✅ Anthropic → `anthropic-api`
- ✅ Google → `google-ai-api`
- ✅ Groq, Grok, Together AI → `{provider}-api`
- ⏸️ Vertex AI (requires more complex auth)

### 3. Agent Returns Proper Types

```typescript
const configAgent = new ProviderConfigAgent(client);
const result: ConnectorConfigResult = await configAgent.run('Connect to GitHub');

// Typed result!
result.name              // string
result.config            // ConnectorConfig
result.setupInstructions // string
result.envVariables      // string[]
result.setupUrl          // string | undefined
```

---

## Migration Guide

### For Library Users

1. **Update imports** (optional, backward compatible):
   ```typescript
   // Old still works
   import { oauthRegistry } from '@oneringai/agents';

   // New (recommended)
   import { connectorRegistry } from '@oneringai/agents';
   ```

2. **Update registration** (breaking if using new ConnectorConfig type):
   ```typescript
   // Old format still works (legacy compatibility)
   connectorRegistry.register('github', {
     displayName: 'GitHub API',
     baseURL: 'https://api.github.com',
     oauth: { flow: 'authorization_code', ... }  // Still works
   });

   // New format (recommended)
   connectorRegistry.register('github', {
     displayName: 'GitHub API',
     description: 'Access GitHub repos',
     baseURL: 'https://api.github.com',
     auth: { type: 'oauth', flow: 'authorization_code', ... }
   });
   ```

3. **Use auto-connectors** (new feature):
   ```typescript
   // Just configure LLM providers
   const client = new OneRingAI({
     providers: {
       openai: { apiKey: process.env.OPENAI_API_KEY }
     }
   });

   // Connector auto-created!
   await authenticatedFetch(url, {}, 'openai-api');
   ```

---

## Benefits

### 1. Clear Naming
✅ **Provider** = AI capabilities
✅ **Connector** = API authentication
✅ No more confusion!

### 2. Type Safety
✅ Formal `ConnectorConfig` type
✅ `ConnectorAuth` union type
✅ Full TypeScript support

### 3. DRY (Don't Repeat Yourself)
✅ Configure OpenAI once → Use for both AI and API access
✅ Auto-connectors eliminate duplicate config

### 4. Clean Architecture
✅ `IConnector` interface for extensions
✅ Proper domain types
✅ Separation of concerns

### 5. Better Developer Experience
✅ Less configuration
✅ Clearer API surface
✅ Better error messages

---

## Implementation Details

### Files Changed

**Domain Layer** (NEW):
- `src/domain/entities/Connector.ts` - Types
- `src/domain/interfaces/IConnector.ts` - Interface

**Infrastructure Layer** (RENAMED):
- `src/plugins/oauth/ConnectorRegistry.ts` - Main registry (was OAuthRegistry)
- `src/plugins/oauth/index.ts` - Updated exports

**Application Layer** (UPDATED):
- `src/client/ProviderRegistry.ts` - Auto-connector creation
- `src/agents/ProviderConfigAgent.ts` - Returns ConnectorConfigResult
- `src/tools/code/executeJavaScript.ts` - Uses connectorRegistry

**Examples** (ALL UPDATED):
- 6 examples updated to use `connectorRegistry`
- All `result.providerName` → `result.name`

**Exports** (UPDATED):
- `src/index.ts` - New exports, deprecated aliases

---

## Testing

```bash
# Build (should succeed)
npm run build

# Test auto-connector creation
npm run example:chat
# Should see: [AutoConnector] Created connector: openai-api

# Test ProviderConfigAgent
npm run example:provider-config
# Should return ConnectorConfigResult type
```

---

## Future Improvements

1. **Full IConnector Implementation**:
   - Wrap OAuthManager in IConnector adapter
   - Hide OAuthManager implementation details

2. **Connector Marketplace**:
   - Pre-built connector configs
   - `connectorRegistry.registerPrebuilt('github')`

3. **Smart Credential Sharing**:
   - Detect when LLM provider can also be used as connector
   - Auto-map scopes for different use cases

---

**Status**: ✅ Complete
**Build**: ✅ Passing
**Backward Compat**: ✅ Yes (oauthRegistry aliased)
**Next**: Update all documentation

# Authentication Architecture

This document clarifies how authentication works across different parts of the library.

## Two Systems (Now Unified!)

### 1. AI Provider Authentication (Via Connectors)

**Purpose**: Use AI providers with your agents

**Method**: API keys or ADC passed to Connector.create()

**Why**: Clean architecture with unified provider abstraction

**Examples**:
```typescript
import { Connector, Vendor } from '@oneringai/agents';

// API Key authentication
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

// ADC authentication (Google)
Connector.create({
  name: 'vertex',
  vendor: Vendor.VertexAI,
  auth: {
    type: 'adc',
    projectId: 'your-project',
    location: 'us-central1'
  }
});
```

### 2. OAuth Plugin with Registry (For External APIs)

**Purpose**: Call external APIs (OAuth + static tokens) via tools

**Method**:
- OAuth 2.0 flows (Authorization Code, Client Credentials, JWT Bearer)
- **Static Token flow** - For API keys

**Why**:
- OAuth for business APIs that require it
- Static tokens for simpler APIs
- **Unified interface for ALL external API access**

**Examples**:
```typescript
import { OAuthManager } from '@oneringai/agents';

// For Microsoft Graph
const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-app-id',
  clientSecret: 'your-secret',
  authorizationUrl: 'https://login.microsoftonline.com/...',
  tokenUrl: 'https://login.microsoftonline.com/...',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'User.Read Mail.Read'
});

const token = await oauth.getToken();

// Use the token with Microsoft Graph API
const response = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## AI Provider Authentication Details

### OpenAI, Anthropic, Groq, etc.

**Method**: Static API keys
**Configuration**:
```typescript
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: 'your-api-key' }
});
```

**How it works**: API key is sent in Authorization header with each request

### Google Gemini API

**Method**: Static API key
**Configuration**:
```typescript
Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: 'AIza...' }
});
```

**Get key**: https://makersuite.google.com/app/apikey

### Google Vertex AI (Special Case)

**Method**: Application Default Credentials (ADC) via gcloud

**Configuration**:
```typescript
Connector.create({
  name: 'vertex',
  vendor: Vendor.VertexAI,
  auth: {
    type: 'adc',
    projectId: 'your-gcp-project',
    location: 'us-central1'
  }
});
```

**Setup**:
```bash
# One-time setup
gcloud auth application-default login

# Or use service account
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**Why ADC (not OAuth plugin)?**:
- ADC is Google's recommended method for Vertex AI
- Handles token refresh automatically
- Works seamlessly with GCP ecosystem
- Simpler than managing OAuth ourselves

---

## OAuth Plugin Use Cases

### Use OAuth Plugin (with Registry) For:

**OAuth Flows**:
- Microsoft Graph API - Access user's Office 365 data
- GitHub API - Access repositories, issues, PRs
- Salesforce - CRM data access
- HubSpot - Marketing/CRM data
- ClickUp - Project management data
- Dropbox - File storage access

**Static Token Flow**:
- OpenAI API - Via tools and authenticatedFetch
- Anthropic API - Via tools and authenticatedFetch
- Any API with static keys - Unified interface

**When to use OAuth Plugin**:
- Calling external APIs via **tools**
- Need unified `authenticatedFetch()` interface
- Want dynamic provider selection in tools
- Building multi-API integrations

### Use Built-in Connector System For:

- OpenAI - When using as **AI provider** in agents
- Anthropic - When using as **AI provider** in agents
- Google Gemini - When using as **AI provider** in agents

**When to use Connectors**:
- Using AI for agent reasoning/generation
- Leveraging unified provider abstraction
- Don't need external API access

---

## Combining Both Systems

You can use both authentication systems together in the same application:

```typescript
import { Connector, Agent, Vendor, OAuthManager } from '@oneringai/agents';

// 1. Set up AI provider (API key via Connector)
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
});

// 2. Set up OAuth for Microsoft Graph
const microsoftOAuth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'User.Read Mail.Read'
});

// 3. Create custom tool that uses OAuth
const readEmailTool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_user_email',
      description: 'Read emails from user\'s Microsoft inbox',
      parameters: {
        type: 'object',
        properties: {
          maxEmails: { type: 'number', description: 'Max emails to retrieve' }
        }
      }
    }
  },
  execute: async (args: { maxEmails: number }) => {
    // Use OAuth token to access Microsoft Graph
    const token = await microsoftOAuth.getToken();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=${args.maxEmails}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const data = await response.json();
    return data.value; // Return emails
  }
};

// 4. Create agent with both AI (via Connector) and OAuth (via custom tool)
const agent = Agent.create({
  connector: 'openai',  // AI provider
  model: 'gpt-4',
  tools: [readEmailTool],  // Tool uses OAuth internally
  instructions: 'You are an email assistant with access to the user\'s Microsoft inbox.'
});

// Agent can now:
// - Use AI (OpenAI with API key)
// - Access user's emails (Microsoft Graph with OAuth token)
const response = await agent.run('Summarize my unread emails from today');
```

---

## When to Use Which

### Use Connector (API Keys) When:

- Accessing AI providers (OpenAI, Anthropic, Google Gemini, etc.)
- Simple authentication is sufficient
- Provider uses API key authentication
- No user-specific data needed

### Use OAuth Plugin When:

- Need user authorization (access user's data)
- Integrating with business APIs (CRM, email, files, etc.)
- Provider requires OAuth
- Building tools that access external services

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              @oneringai/agents Library                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │   AI Connectors         │   │   OAuth Plugin          │  │
│  │   (Built-in Auth)       │   │   (External APIs)       │  │
│  ├─────────────────────────┤   ├─────────────────────────┤  │
│  │ • OpenAI (API Key)      │   │ • Microsoft             │  │
│  │ • Anthropic (API Key)   │   │ • Google OAuth          │  │
│  │ • Google Gemini (API)   │   │ • GitHub                │  │
│  │ • Vertex AI (ADC)       │   │ • Salesforce            │  │
│  │ • Groq (API Key)        │   │ • HubSpot               │  │
│  │ • Together (API Key)    │   │ • Dropbox               │  │
│  │ • Grok (API Key)        │   │ • ClickUp               │  │
│  │                         │   │ • Custom APIs           │  │
│  ├─────────────────────────┤   ├─────────────────────────┤  │
│  │ Auth: Connector.create  │   │ Auth: OAuth 2.0         │  │
│  └─────────────────────────┘   └─────────────────────────┘  │
│                                                              │
│          Both can be used together via Tools!                │
└─────────────────────────────────────────────────────────────┘
```

---

## Unified Approach (Best of Both Worlds)

You can use Connector for **both** OAuth and static tokens:

```typescript
import {
  Connector,
  Agent,
  Vendor,
  authenticatedFetch,
  generateWebAPITool
} from '@oneringai/agents';

// Register ALL external APIs in one place using Connector
Connector.create({
  name: 'openai-api',
  displayName: 'OpenAI API',
  baseURL: 'https://api.openai.com/v1',
  auth: {
    type: 'oauth',
    flow: 'static_token',
    staticToken: process.env.OPENAI_API_KEY!,
    clientId: 'openai',
    tokenUrl: ''
  }
});

Connector.create({
  name: 'microsoft',
  displayName: 'Microsoft Graph',
  baseURL: 'https://graph.microsoft.com',
  auth: {
    type: 'oauth',
    flow: 'authorization_code',
    clientId: '...',
    clientSecret: '...',
    authorizationUrl: '...',
    tokenUrl: '...',
    redirectUri: '...',
    scope: '...'
  }
});

// One tool for ALL APIs
const apiTool = generateWebAPITool();

// Create AI connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [apiTool]
});

// AI picks correct provider
await agent.run('Call OpenAI API to list models');  // Uses openai-api
await agent.run('Read my Outlook emails');  // Uses microsoft
```

---

## Conclusion

- **No conflicts** - Systems serve different purposes
- **Vertex AI** - ADC approach is correct (Google's recommendation)
- **OAuth Plugin** - Supports OAuth AND static tokens
- **Integration** - Use tools to combine AI + any external API
- **Unified** - One registry, one fetch, one tool for all APIs

**Architecture is sound and flexible!**

---

**Last Updated**: 2026-01-15

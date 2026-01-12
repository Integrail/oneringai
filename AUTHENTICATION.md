# Authentication Architecture

This document clarifies how authentication works across different parts of the library.

## Two Separate Systems

### 1. AI Provider Authentication (Built-in)

**Purpose**: Authenticate with AI providers (OpenAI, Anthropic, Google, etc.)

**Method**: Simple API keys (static credentials)

**Why**: AI providers use simple API key authentication - no OAuth needed

**Examples**:
```typescript
const client = new OneRingAI({
  providers: {
    openai: { apiKey: 'sk-...' },              // OpenAI API key
    anthropic: { apiKey: 'sk-ant-...' },       // Anthropic API key
    google: { apiKey: 'AIza...' }              // Google API key
  }
});
```

### 2. OAuth Plugin (New)

**Purpose**: Authenticate with OAuth-protected APIs (Microsoft, Salesforce, GitHub, etc.)

**Method**: OAuth 2.0 flows (Authorization Code, Client Credentials, JWT Bearer)

**Why**: Many business APIs require OAuth for security and user authorization

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

// Use the token with Microsoft Graph API (not AI provider)
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
{
  apiKey: 'your-api-key'
}
```

**How it works**: API key is sent in Authorization header with each request

### Google Gemini API

**Method**: Static API key
**Configuration**:
```typescript
{
  apiKey: 'AIza...'
}
```

**Get key**: https://makersuite.google.com/app/apikey

### Google Vertex AI (Special Case)

**Method**: Application Default Credentials (ADC) via gcloud

**Configuration**:
```typescript
{
  projectId: 'your-gcp-project',
  location: 'us-central1'
  // No apiKey - uses ADC
}
```

**Setup**:
```bash
# One-time setup
gcloud auth application-default login

# Or use service account
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**Why not OAuth plugin?**:
- ADC is Google's recommended method for Vertex AI
- Handles token refresh automatically
- Works seamlessly with GCP ecosystem
- Simpler than managing OAuth ourselves

**Could you use OAuth?** Yes, technically:
```typescript
// Optional: Use OAuth plugin to get Vertex AI token
import { OAuthManager } from '@oneringai/agents';

const vertexOAuth = new OAuthManager({
  flow: 'jwt_bearer',
  clientId: 'service-account@project.iam.gserviceaccount.com',
  privateKeyPath: './service-account-key.json',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  audience: 'https://oauth2.googleapis.com/token'
});

const token = await vertexOAuth.getToken();

// Then manually set as environment
process.env.GOOGLE_APPLICATION_CREDENTIALS = './service-account-key.json';
```

**Recommendation**: Stick with ADC (simpler, Google-recommended)

---

## OAuth Plugin Use Cases

### Use OAuth Plugin For:

✅ **Microsoft Graph API** - Access user's Office 365 data
✅ **GitHub API** - Access repositories, issues, PRs
✅ **Salesforce** - CRM data access
✅ **HubSpot** - Marketing/CRM data
✅ **ClickUp** - Project management data
✅ **Dropbox** - File storage access
✅ **Custom OAuth APIs** - Any API requiring OAuth

### Don't Use OAuth Plugin For:

❌ **OpenAI** - Use API key directly
❌ **Anthropic** - Use API key directly
❌ **Google Gemini** - Use API key directly
❌ **Groq, Together AI, etc.** - Use API key directly

**Why?** AI providers use simple API keys, not OAuth. The OAuth plugin is for business APIs.

---

## Combining Both Systems

You can use both authentication systems together in the same application:

```typescript
import { OneRingAI, OAuthManager, tools } from '@oneringai/agents';

// 1. Set up AI provider (API key)
const aiClient = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY! }
  }
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

// 4. Create agent with both AI (via OneRingAI) and OAuth (via custom tool)
const agent = aiClient.agents.create({
  provider: 'openai',  // AI provider (API key auth)
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

### Use Provider API Keys (Current System) When:

- ✅ Accessing AI providers (OpenAI, Anthropic, Google Gemini, etc.)
- ✅ Simple authentication is sufficient
- ✅ Provider uses API key authentication
- ✅ No user-specific data needed

### Use OAuth Plugin When:

- ✅ Need user authorization (access user's data)
- ✅ Integrating with business APIs (CRM, email, files, etc.)
- ✅ Provider requires OAuth
- ✅ Building tools that access external services

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│           @oneringai/agents Library             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────┐   ┌──────────────────┐  │
│  │  AI Providers     │   │  OAuth Plugin    │  │
│  │  (Built-in Auth)  │   │  (Separate)      │  │
│  ├───────────────────┤   ├──────────────────┤  │
│  │ • OpenAI          │   │ • Microsoft      │  │
│  │ • Anthropic       │   │ • Google OAuth   │  │
│  │ • Google Gemini   │   │ • GitHub         │  │
│  │ • Vertex AI (ADC) │   │ • Salesforce     │  │
│  │ • Groq, etc.      │   │ • HubSpot        │  │
│  ├───────────────────┤   │ • Dropbox        │  │
│  │ Auth: API Keys    │   │ • ClickUp        │  │
│  └───────────────────┘   │ • Custom APIs    │  │
│                          ├──────────────────┤  │
│                          │ Auth: OAuth 2.0  │  │
│                          └──────────────────┘  │
│                                                 │
│  Both can be used together via Tools!          │
└─────────────────────────────────────────────────┘
```

---

## Vertex AI Authentication (Current Approach is Correct)

### Current Implementation ✅

```typescript
const client = new OneRingAI({
  providers: {
    'vertex-ai': {
      projectId: 'your-project',
      location: 'us-central1'
      // Uses Application Default Credentials (ADC)
    }
  }
});
```

**Setup**:
```bash
gcloud auth application-default login
```

**Why this is correct**:
- Google's recommended method for Vertex AI
- Automatic token refresh (handled by gcloud SDK)
- Works with all GCP services
- Simpler than OAuth

### Alternative: OAuth Plugin (More Complex)

If you wanted to use OAuth plugin for Vertex AI:

```typescript
// Step 1: Get token via OAuth
const vertexOAuth = new OAuthManager({
  flow: 'jwt_bearer',
  clientId: 'service-account@project.iam.gserviceaccount.com',
  privateKeyPath: './service-account-key.json',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  audience: 'https://oauth2.googleapis.com/token'
});

const token = await vertexOAuth.getToken();

// Step 2: Would need to modify VertexAITextProvider to accept token
// (Not currently supported - ADC is simpler)
```

**Recommendation**: Keep current ADC approach for Vertex AI

---

## Future Enhancement: OAuth-Enabled Providers

Could add optional OAuth support to providers:

```typescript
// Future enhancement (not currently implemented)
const client = new OneRingAI({
  providers: {
    'custom-llm': {
      baseURL: 'https://api.custom.com/v1',

      // Option A: Static API key (current)
      apiKey: 'static-key',

      // Option B: OAuth manager (future enhancement)
      oauth: new OAuthManager({
        flow: 'client_credentials',
        clientId: '...',
        clientSecret: '...',
        tokenUrl: '...'
      })
    }
  }
});

// Provider would automatically use oauth.getToken() for each request
```

**Status**: Not implemented (use tools + hooks for now)

---

## Recommendation

### Current Architecture is Correct ✅

1. **AI Providers** → Use built-in API key authentication
2. **Vertex AI** → Use ADC (Google's recommended method)
3. **OAuth Plugin** → Use for non-AI business APIs

### No Changes Needed

The systems are **intentionally separate**:
- AI authentication is simple (API keys work great)
- OAuth is complex (needed for business APIs with user data)
- Mixing them would add unnecessary complexity

### How to Use Both Together

Use **custom tools** to bridge them:

```typescript
// AI provider with API key
const aiClient = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY! }
  }
});

// OAuth for business API
const salesforceOAuth = new OAuthManager({
  flow: 'client_credentials',
  clientId: '...',
  clientSecret: '...',
  tokenUrl: 'https://login.salesforce.com/services/oauth2/token'
});

// Custom tool using OAuth
const salesforceTool = {
  definition: { ... },
  execute: async (args) => {
    const token = await salesforceOAuth.getToken();
    // Use token to call Salesforce API
    const response = await fetch('https://...', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  }
};

// Agent combines both
const agent = aiClient.agents.create({
  provider: 'openai',  // AI provider (simple auth)
  model: 'gpt-4',
  tools: [salesforceTool]  // Tool uses OAuth internally
});
```

---

## Conclusion

✅ **No conflicts** - Systems serve different purposes
✅ **Vertex AI** - ADC approach is correct (Google's recommendation)
✅ **OAuth Plugin** - For business APIs, not AI providers
✅ **Integration** - Use tools to combine AI + OAuth-protected APIs

**No changes needed** - Architecture is sound!

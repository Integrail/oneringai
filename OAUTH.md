# OAuth 2.0 Plugin Guide

Complete guide to using OAuth 2.0 authentication with `@oneringai/agents`.

## Table of Contents

- [Quick Start](#quick-start)
- [Security Setup](#security-setup)
- [OAuth Flows Explained](#oauth-flows-explained)
- [Storage Backends](#storage-backends)
- [API Configurations](#api-configurations)
  - [Microsoft Graph](#microsoft-graph-api)
  - [Google APIs](#google-apis)
  - [Google Vertex AI](#google-vertex-ai)
  - [GitHub](#github)
  - [ClickUp](#clickup)
  - [HubSpot](#hubspot)
  - [Salesforce](#salesforce)
  - [Dropbox](#dropbox)
- [Advanced Usage](#advanced-usage)

---

## Quick Start

### 1. Install

```bash
npm install @oneringai/agents
```

### 2. Generate Encryption Key

```bash
# Generate a secure encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Add to .env

```bash
OAUTH_ENCRYPTION_KEY=your-generated-key-here
```

### 4. Use OAuth

```typescript
import { OAuthManager } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  tokenUrl: 'https://api.example.com/oauth/token'
});

const token = await oauth.getToken();
```

---

## Security Setup

### Encryption Key (REQUIRED for Production)

All OAuth tokens are encrypted at rest using **AES-256-GCM**. You MUST set an encryption key:

```bash
# Generate secure key (64 hex characters = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
OAUTH_ENCRYPTION_KEY=997db3aa6f28973c4e5d8b2a1f3c6e9d8a7b4c3e2d1f0a9b8c7d6e5f4a3b2c1d
```

**Security Features**:
- ✅ AES-256-GCM (military-grade encryption)
- ✅ PBKDF2 key derivation (100,000 iterations)
- ✅ Authenticated encryption (integrity verification)
- ✅ Random IV and salt per encryption
- ✅ File permissions: 0o600 (owner only)

---

## OAuth Flows Explained

### Flow 1: Authorization Code (User OAuth)

**Use for**: Web apps, desktop apps where users log in

**How it works**:
1. User clicks "Login with [Provider]"
2. User redirects to provider's login page
3. User authorizes your app
4. Provider redirects back with code
5. Exchange code for token

**Security**: Uses PKCE (Proof Key for Code Exchange) by default

### Flow 2: Client Credentials (App Token)

**Use for**: Server-to-server, backend services, scheduled jobs

**How it works**:
1. App sends client ID + secret to provider
2. Provider returns access token
3. No user involved

**Security**: Keep client secret secure!

### Flow 3: JWT Bearer (Service Account)

**Use for**: Google service accounts, Salesforce connected apps

**How it works**:
1. App signs JWT with private key
2. Exchange JWT for access token
3. No user involved

**Security**: Private key must be kept secure!

### Flow 4: Static Token (API Keys) ⭐ NEW

**Use for**: APIs with static API keys (OpenAI, Anthropic, many SaaS APIs)

**How it works**:
1. Provider gives you a static API key
2. You register it in the OAuth registry
3. Use `authenticatedFetch()` with provider name
4. Token automatically injected

**Benefits**: Unified interface for all APIs (OAuth + static tokens)

**Example**:
```typescript
connectorRegistry.register('openai-api', {
  displayName: 'OpenAI API',
  description: 'Access OpenAI models and completions',
  baseURL: 'https://api.openai.com/v1',
  oauth: {
    flow: 'static_token',
    staticToken: process.env.OPENAI_API_KEY!,
    clientId: 'openai',  // For identification
    tokenUrl: ''  // Not used
  }
});

// Use unified fetch
const models = await authenticatedFetch(
  'https://api.openai.com/v1/models',
  { method: 'GET' },
  'openai-api'
);
```

---

## Storage Backends

### Memory Storage (Default)

```typescript
const oauth = new OAuthManager({
  flow: 'client_credentials',
  // ... other config
  // No storage specified = MemoryStorage (encrypted in memory)
});
```

**Pros**: Fast, no I/O
**Cons**: Lost on process restart
**Use for**: Development, testing, short-lived processes

### File Storage

```typescript
import { OAuthFileStorage } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'client_credentials',
  // ... other config
  storage: new OAuthFileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY!
  })
});
```

**Pros**: Persists across restarts
**Cons**: Requires file system access
**Use for**: Desktop apps, CLI tools, single-server apps

### Custom Storage (Implement Interface)

```typescript
import { IOAuthTokenStorage } from '@oneringai/agents';

class RedisStorage implements IOAuthTokenStorage {
  async storeToken(key, token) { /* encrypt + store in Redis */ }
  async getToken(key) { /* retrieve + decrypt from Redis */ }
  async deleteToken(key) { /* delete from Redis */ }
  async hasToken(key) { /* check Redis */ }
}

const oauth = new OAuthManager({
  flow: 'client_credentials',
  // ... other config
  storage: new RedisStorage()
});
```

---

## Static Token Examples (NEW)

### OpenAI

```typescript
connectorRegistry.register('openai-api', {
  displayName: 'OpenAI API',
  description: 'Access OpenAI: models, completions, embeddings, fine-tuning',
  baseURL: 'https://api.openai.com/v1',
  oauth: {
    flow: 'static_token',
    staticToken: process.env.OPENAI_API_KEY!,
    clientId: 'openai',
    tokenUrl: ''
  }
});

// Use it
const models = await authenticatedFetch(
  'https://api.openai.com/v1/models',
  { method: 'GET' },
  'openai-api'
);
```

### Anthropic

```typescript
connectorRegistry.register('anthropic-api', {
  displayName: 'Anthropic API',
  description: 'Access Anthropic Claude models',
  baseURL: 'https://api.anthropic.com/v1',
  oauth: {
    flow: 'static_token',
    staticToken: process.env.ANTHROPIC_API_KEY!,
    clientId: 'anthropic',
    tokenUrl: ''
  }
});

const response = await authenticatedFetch(
  'https://api.anthropic.com/v1/messages',
  {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Hello!' }],
      max_tokens: 1024
    })
  },
  'anthropic-api'
);
```

### Any API with Static Keys

```typescript
// Works with any API that uses Bearer tokens or API keys
connectorRegistry.register('custom-api', {
  displayName: 'Custom SaaS API',
  description: 'Your custom API endpoints',
  baseURL: 'https://api.custom.com/v1',
  oauth: {
    flow: 'static_token',
    staticToken: process.env.CUSTOM_API_KEY!,
    clientId: 'custom',
    tokenUrl: ''
  }
});

const data = await authenticatedFetch(
  'https://api.custom.com/v1/users',
  { method: 'GET' },
  'custom-api'
);
```

---

## Multi-User OAuth Support 🆕

### Overview

**Problem**: Your app has multiple users, each needs their own OAuth tokens.

**Solution**: Pass `userId` parameter to OAuth methods - tokens are automatically isolated per user!

### Key Features

✅ **ONE OAuthManager** handles unlimited users
✅ **Automatic token isolation** - Each user gets separate, encrypted tokens
✅ **User-scoped storage keys** - `provider:clientId:userId`
✅ **Auto-refresh per user** - Tokens refresh independently
✅ **Backward compatible** - `userId` is optional (defaults to single-user mode)
✅ **Clean Architecture** - Works with any storage backend (Memory, File, MongoDB, Redis)

### Architecture

```
Storage Key Pattern:
┌────────────────────────────────────────────┐
│ Single-user:  "auth_code:github"           │
│                                             │
│ Multi-user:   "auth_code:github:alice_123" │
│               "auth_code:github:bob_456"   │
│               "auth_code:github:charlie"   │
└────────────────────────────────────────────┘

All stored separately, all encrypted!
```

### Basic Multi-User Pattern

```typescript
import { OAuthManager, OAuthFileStorage } from '@oneringai/agents';

// Create ONE OAuthManager for the provider
const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'user:email repo',

  // Persistent storage (all users share backend, tokens isolated by key)
  storage: new OAuthFileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY!
  })
});

// ===== Authenticate User 1: Alice =====
const authUrlAlice = await oauth.startAuthFlow('alice_123');
// Send Alice to authUrlAlice...
await oauth.handleCallback(callbackUrl, 'alice_123');
const aliceToken = await oauth.getToken('alice_123');

// ===== Authenticate User 2: Bob =====
const authUrlBob = await oauth.startAuthFlow('bob_456');
// Send Bob to authUrlBob...
await oauth.handleCallback(callbackUrl, 'bob_456');
const bobToken = await oauth.getToken('bob_456');

// Tokens are completely isolated!
console.log(aliceToken === bobToken); // false
```

### Web Application Pattern (Express.js)

```typescript
import express from 'express';
import session from 'express-session';
import { OAuthManager, OAuthFileStorage, authenticatedFetch } from '@oneringai/agents';

const app = express();

// Session middleware (or use JWT)
app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: false }));

// Create OAuth manager
const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  redirectUri: 'http://localhost:3000/auth/callback',
  scope: 'user:email repo',
  storage: new OAuthFileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY!
  })
});

// ===== Step 1: Login Route =====
app.get('/auth/github', async (req, res) => {
  const userId = req.session.userId; // From your user system

  // Start OAuth flow for THIS user
  const authUrl = await oauth.startAuthFlow(userId);
  res.redirect(authUrl);
});

// ===== Step 2: Callback Route =====
app.get('/auth/callback', async (req, res) => {
  try {
    // Handle callback (userId is embedded in state parameter!)
    await oauth.handleCallback(req.url);
    res.redirect('/dashboard');
  } catch (error) {
    res.status(400).send('Authorization failed: ' + error.message);
  }
});

// ===== Step 3: Use Tokens in API Endpoints =====
app.get('/api/repos', async (req, res) => {
  const userId = req.session.userId;

  try {
    // Fetch using user-specific token (auto-refreshes if expired!)
    const response = await authenticatedFetch(
      'https://api.github.com/user/repos',
      { method: 'GET' },
      'github',
      userId  // THIS user's token!
    );

    const repos = await response.json();
    res.json(repos);
  } catch (error) {
    if (error.message.includes('No token')) {
      // User needs to reconnect GitHub
      res.status(401).json({ error: 'GitHub not connected', reauth: true });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.listen(3000);
```

### Background Jobs Pattern

```typescript
// Cron job that processes data for all users
async function dailyGitHubSync() {
  // Get all users who connected GitHub
  const users = await db.users.find({ githubConnected: true });

  console.log(`Syncing ${users.length} users...`);

  for (const user of users) {
    try {
      // Get user-specific token
      const response = await authenticatedFetch(
        'https://api.github.com/user/repos',
        { method: 'GET' },
        'github',
        user.id  // Each user's token
      );

      const repos = await response.json();

      // Store in database
      await db.repos.updateMany(
        { userId: user.id },
        { $set: { repos, syncedAt: new Date() } }
      );

      console.log(`✅ Synced ${repos.length} repos for ${user.name}`);
    } catch (error) {
      if (error.message.includes('No token')) {
        // Token expired/revoked - notify user
        await sendEmail(user.email, {
          subject: 'Reconnect your GitHub account',
          body: 'Your GitHub token expired. Please reconnect.'
        });
      } else {
        console.error(`Failed to sync ${user.name}:`, error);
      }
    }
  }
}

// Run daily
cron.schedule('0 0 * * *', dailyGitHubSync);
```

### Per-User Fetch Functions

```typescript
import { createAuthenticatedFetch } from '@oneringai/agents';

// Create fetch functions bound to specific users
const aliceFetch = createAuthenticatedFetch('github', 'alice_123');
const bobFetch = createAuthenticatedFetch('github', 'bob_456');

// Use like normal fetch (userId implicit!)
const aliceRepos = await aliceFetch('https://api.github.com/user/repos');
const aliceIssues = await aliceFetch('https://api.github.com/user/issues');

const bobRepos = await bobFetch('https://api.github.com/user/repos');
const bobIssues = await bobFetch('https://api.github.com/user/issues');

// Tokens are completely isolated - no mixing!
```

### AI Agent with Multi-User OAuth

```typescript
import {
  OneRingAI,
  connectorRegistry,
  createExecuteJavaScriptTool
} from '@oneringai/agents';

// Register OAuth provider
connectorRegistry.register('github', { /* ... */ });

// Create agent with JavaScript execution tool
const jsTool = createExecuteJavaScriptTool(connectorRegistry);

const agent = await client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  tools: [jsTool],
  instructions: `You can access GitHub API using authenticatedFetch.
    For multi-user apps, pass userId as 4th parameter:
    authenticatedFetch(url, options, "github", userId)`
});

// Agent can make user-specific API calls!
const response = await agent.run(`
  Fetch GitHub repos for user alice_123.
  Use: authenticatedFetch(url, options, "github", "alice_123")
`);

// The agent executes JavaScript with Alice's token:
// const response = await authenticatedFetch(
//   "https://api.github.com/user/repos",
//   { method: "GET" },
//   "github",
//   "alice_123"  // Uses Alice's token!
// );
// output = await response.json();
```

### Multi-User API Methods

All OAuth methods now accept optional `userId` parameter:

```typescript
// OAuthManager methods
await oauth.startAuthFlow(userId?)          // Generate auth URL for user
await oauth.handleCallback(url, userId?)    // Exchange code for user's token
await oauth.getToken(userId?)               // Get user's token (auto-refresh)
await oauth.refreshToken(userId?)           // Force refresh user's token
await oauth.isTokenValid(userId?)           // Check if user's token valid
await oauth.revokeToken(url?, userId?)      // Revoke user's token

// authenticatedFetch
await authenticatedFetch(url, options, provider, userId?)

// createAuthenticatedFetch (bind to user)
const userFetch = createAuthenticatedFetch(provider, userId?)
```

### Storage Backend Options for Multi-User

#### Option 1: FileStorage
```typescript
new OAuthFileStorage({
  directory: './tokens',
  encryptionKey: process.env.OAUTH_ENCRYPTION_KEY!
})
```
✅ Simple, persists across restarts
⚠️ Not suitable for multi-server deployments

#### Option 2: MongoDB (Future)
```typescript
class MongoTokenStorage implements IOAuthTokenStorage {
  async storeToken(key: string, token: StoredToken) {
    // key is already user-scoped: "provider:clientId:userId"
    await tokens.updateOne(
      { _id: key },
      { $set: { ...encrypt(token), updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async getToken(key: string) {
    const doc = await tokens.findOne({ _id: key });
    return doc ? decrypt(doc) : null;
  }

  async deleteToken(key: string) {
    await tokens.deleteOne({ _id: key });
  }

  async hasToken(key: string) {
    return await tokens.countDocuments({ _id: key }) > 0;
  }
}

// Use with OAuth
const oauth = new OAuthManager({
  flow: 'authorization_code',
  // ...
  storage: new MongoTokenStorage()
});
```
✅ Best for multi-server web apps
✅ Centralized, scales horizontally
✅ Built-in querying and indexing

#### Option 3: Redis (Future)
```typescript
class RedisTokenStorage implements IOAuthTokenStorage {
  async storeToken(key: string, token: StoredToken) {
    const encrypted = encrypt(token);
    await redis.setex(key, token.expires_in, JSON.stringify(encrypted));
  }

  async getToken(key: string) {
    const data = await redis.get(key);
    return data ? decrypt(JSON.parse(data)) : null;
  }

  async deleteToken(key: string) {
    await redis.del(key);
  }

  async hasToken(key: string) {
    return await redis.exists(key) > 0;
  }
}
```
✅ Best for high-performance caching
✅ Built-in TTL (auto-expires old tokens)
✅ Fast access

### Multi-User Security Considerations

1. **User ID Validation**: Always validate userId comes from authenticated session
   ```typescript
   // ❌ INSECURE - userId from user input
   const userId = req.query.userId;

   // ✅ SECURE - userId from authenticated session
   const userId = req.session.userId;
   ```

2. **State Parameter Embedding**: userId is embedded in OAuth state for automatic routing
   - State format: `{random_state}::{userId}`
   - Automatic extraction in `handleCallback()`
   - CSRF protection maintained

3. **Token Isolation**: Each user's tokens stored with unique keys
   - No way to access another user's tokens
   - Encryption applied per-token
   - Storage backend handles isolation via keys

4. **Error Handling**: Check for user-specific errors
   ```typescript
   try {
     await oauth.getToken(userId);
   } catch (error) {
     if (error.message.includes('No token')) {
       // This specific user needs to reconnect
       await notifyUserReauth(userId);
     }
   }
   ```

### Migration from Single-User

Existing code continues to work unchanged:

```typescript
// Old code (single-user) - still works!
const token = await oauth.getToken();
const response = await authenticatedFetch(url, options, 'github');

// New code (multi-user) - just add userId!
const token = await oauth.getToken('user123');
const response = await authenticatedFetch(url, options, 'github', 'user123');
```

### Examples

See these examples for complete implementations:
- `examples/oauth-multi-user.ts` - Multi-user architecture patterns
- `examples/oauth-multi-user-fetch.ts` - authenticatedFetch with multiple users

---

## API Configurations

### Microsoft Graph API

#### User OAuth (Authorization Code)

```typescript
import { OAuthManager } from '@oneringai/agents';

const microsoftUserOAuth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-application-id',
  clientSecret: 'your-client-secret', // From Azure Portal
  authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'User.Read Mail.Read Files.ReadWrite',
  usePKCE: true
});

// Start OAuth flow
const authUrl = await microsoftUserOAuth.startAuthFlow();
console.log('Visit:', authUrl);

// After user authorizes and returns to your callback
await microsoftUserOAuth.handleCallback(callbackUrl);

// Get token
const token = await microsoftUserOAuth.getToken();

// Use with Microsoft Graph
const response = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Setup**:
1. Go to https://portal.azure.com → App Registrations
2. Create new registration
3. Add redirect URI: `http://localhost:3000/callback`
4. Create client secret under "Certificates & secrets"
5. Grant API permissions under "API permissions"

#### App Token (Client Credentials)

```typescript
const microsoftAppOAuth = new OAuthManager({
  flow: 'client_credentials',
  clientId: 'your-application-id',
  clientSecret: 'your-client-secret',
  tokenUrl: 'https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token',
  scope: 'https://graph.microsoft.com/.default'
});

const token = await microsoftAppOAuth.getToken();

// Use for app-level operations (no specific user)
const users = await fetch('https://graph.microsoft.com/v1.0/users', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

### Google APIs

#### User OAuth (Authorization Code)

```typescript
const googleUserOAuth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-client-id.apps.googleusercontent.com',
  clientSecret: 'your-client-secret',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly',
  usePKCE: true
});

// Start flow
const authUrl = await googleUserOAuth.startAuthFlow();
// Redirect user to authUrl

// Handle callback
await googleUserOAuth.handleCallback(callbackUrl);

// Get token
const token = await googleUserOAuth.getToken();

// Access Google Drive
const files = await fetch('https://www.googleapis.com/drive/v3/files', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Setup**:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI
4. Download client secret JSON

#### Service Account (JWT Bearer)

```typescript
import { OAuthManager } from '@oneringai/agents';
import serviceAccount from './service-account-key.json';

const googleServiceAccount = new OAuthManager({
  flow: 'jwt_bearer',
  clientId: serviceAccount.client_email,
  privateKey: serviceAccount.private_key,
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: 'https://www.googleapis.com/auth/drive.readonly',
  audience: 'https://oauth2.googleapis.com/token'
});

const token = await googleServiceAccount.getToken();
```

**Setup**:
1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Create service account
3. Create key → Download JSON
4. Enable APIs you need
5. Grant service account permissions

---

### Google Vertex AI

Google Vertex AI uses the same authentication as Google APIs, but with different scopes.

#### Service Account (JWT Bearer - Recommended)

```typescript
const vertexAIOAuth = new OAuthManager({
  flow: 'jwt_bearer',
  clientId: 'service-account@project-id.iam.gserviceaccount.com',
  privateKeyPath: './service-account-key.json',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  audience: 'https://oauth2.googleapis.com/token',
  tokenSigningAlg: 'RS256'
});

const token = await vertexAIOAuth.getToken();

// Use with Vertex AI
const response = await fetch(
  'https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT/locations/us-central1/endpoints',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
```

**Or use with OneRingAI + OAuth**:
```typescript
const token = await vertexAIOAuth.getToken();

const client = new OneRingAI({
  providers: {
    'vertex-ai': {
      projectId: 'your-project-id',
      location: 'us-central1',
      // credentials: can be set via OAuth token
    }
  }
});
```

---

### GitHub

#### User OAuth (Authorization Code)

```typescript
const githubOAuth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-github-client-id',
  clientSecret: 'your-github-client-secret',
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'repo user',
  usePKCE: false  // GitHub doesn't support PKCE yet
});

// Start OAuth flow
const authUrl = await githubOAuth.startAuthFlow();

// After callback
await githubOAuth.handleCallback(callbackUrl);

// Get token
const token = await githubOAuth.getToken();

// Use GitHub API
const repos = await fetch('https://api.github.com/user/repos', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json'
  }
});
```

**Setup**:
1. Go to https://github.com/settings/developers
2. New OAuth App
3. Set Authorization callback URL
4. Get Client ID and generate Client Secret

#### GitHub App (JWT Bearer)

```typescript
import * as fs from 'fs';

const githubAppOAuth = new OAuthManager({
  flow: 'jwt_bearer',
  clientId: 'your-app-id',
  privateKeyPath: './github-app-private-key.pem',
  tokenUrl: 'https://api.github.com/app/installations/{installation_id}/access_tokens',
  tokenSigningAlg: 'RS256',
  audience: 'https://api.github.com'
});

const token = await githubAppOAuth.getToken();
```

**Setup**:
1. Create GitHub App at https://github.com/settings/apps
2. Generate private key
3. Install app to repositories
4. Use installation ID

---

### ClickUp

#### User OAuth (Authorization Code)

```typescript
const clickupOAuth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-clickup-client-id',
  clientSecret: 'your-clickup-client-secret',
  authorizationUrl: 'https://app.clickup.com/api',
  tokenUrl: 'https://api.clickup.com/api/v2/oauth/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: '', // ClickUp doesn't use scopes
  usePKCE: false
});

// Start flow
const authUrl = await clickupOAuth.startAuthFlow();

// After callback
await clickupOAuth.handleCallback(callbackUrl);

// Get token
const token = await clickupOAuth.getToken();

// Use ClickUp API
const workspaces = await fetch('https://api.clickup.com/api/v2/team', {
  headers: { 'Authorization': token }  // ClickUp doesn't use "Bearer"
});
```

**Setup**:
1. Go to https://app.clickup.com/settings/apps
2. Create new app
3. Add redirect URL
4. Get Client ID and Client Secret

---

### HubSpot

#### User OAuth (Authorization Code)

```typescript
const hubspotOAuth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-hubspot-client-id',
  clientSecret: 'your-hubspot-client-secret',
  authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
  tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'contacts crm.objects.contacts.read',
  usePKCE: true
});

// Start flow
const authUrl = await hubspotOAuth.startAuthFlow();

// After callback
await hubspotOAuth.handleCallback(callbackUrl);

// Get token
const token = await hubspotOAuth.getToken();

// Use HubSpot API
const contacts = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Setup**:
1. Go to https://app.hubspot.com/developer
2. Create app
3. Add scopes
4. Set redirect URI
5. Get Client ID and Secret

#### Private App (API Key)

HubSpot also supports private apps with API keys (simpler than OAuth):

```typescript
// For private apps, use direct API key (no OAuth needed)
const hubspotKey = process.env.HUBSPOT_PRIVATE_APP_KEY;

const contacts = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
  headers: { 'Authorization': `Bearer ${hubspotKey}` }
});
```

---

### Salesforce

#### User OAuth (Authorization Code)

```typescript
const salesforceOAuth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-connected-app-consumer-key',
  clientSecret: 'your-connected-app-consumer-secret',
  authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
  tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'api refresh_token',
  usePKCE: true
});

// Start flow
const authUrl = await salesforceOAuth.startAuthFlow();

// After callback
await salesforceOAuth.handleCallback(callbackUrl);

// Get token
const token = await salesforceOAuth.getToken();

// Get instance URL from token response
const tokenInfo = await salesforceOAuth.getTokenInfo();
const instanceUrl = tokenInfo.instance_url; // e.g., https://yourinstance.salesforce.com

// Use Salesforce API
const accounts = await fetch(`${instanceUrl}/services/data/v57.0/sobjects/Account`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Setup**:
1. Salesforce Setup → App Manager → New Connected App
2. Enable OAuth Settings
3. Add callback URL
4. Select OAuth scopes
5. Get Consumer Key and Secret

#### JWT Bearer (Server-to-Server)

```typescript
const salesforceJWT = new OAuthManager({
  flow: 'jwt_bearer',
  clientId: 'your-consumer-key',
  privateKeyPath: './salesforce-private-key.pem',
  tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
  audience: 'https://login.salesforce.com',
  tokenSigningAlg: 'RS256',

  // Additional claims for Salesforce
  // (Note: would need to extend JWT generation to support custom claims)
});

const token = await salesforceJWT.getToken();
```

**Setup**:
1. Create Connected App
2. Enable "Use Digital Signatures"
3. Upload certificate (generated from private key)
4. Enable "Perform requests at any time"
5. Assign users to pre-authorize

---

### Dropbox

#### User OAuth (Authorization Code)

```typescript
const dropboxOAuth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-dropbox-app-key',
  clientSecret: 'your-dropbox-app-secret',
  authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
  tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'account_info.read files.content.read',
  usePKCE: true
});

// Start flow
const authUrl = await dropboxOAuth.startAuthFlow();

// After callback
await dropboxOAuth.handleCallback(callbackUrl);

// Get token
const token = await dropboxOAuth.getToken();

// Use Dropbox API
const account = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Setup**:
1. Go to https://www.dropbox.com/developers/apps
2. Create app
3. Choose API (Scoped access recommended)
4. Set permissions (scopes)
5. Add redirect URI
6. Get App key and App secret

---

## Advanced Usage

### With File Storage (Production)

```typescript
import { OAuthManager, OAuthFileStorage } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  tokenUrl: 'https://api.example.com/oauth/token',

  // Persistent encrypted storage
  storage: new OAuthFileStorage({
    directory: '/var/lib/myapp/tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY!
  }),

  // Auto-refresh 5 minutes before expiry
  refreshBeforeExpiry: 300
});

// Token automatically refreshed when needed
const token = await oauth.getToken();
```

### Auto-Refresh with Agents

```typescript
import { OneRingAI, OAuthManager } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  tokenUrl: 'https://api.example.com/oauth/token'
});

// Get initial token
const initialToken = await oauth.getToken();

const client = new OneRingAI({
  providers: {
    'custom-llm': {
      apiKey: initialToken,
      baseURL: 'https://api.example.com/v1'
    }
  }
});

const agent = await client.agents.create({
  provider: 'custom-llm',
  model: 'their-model',

  // Refresh token before each LLM call
  hooks: {
    'before:llm': async (ctx) => {
      if (!await oauth.isTokenValid()) {
        const newToken = await oauth.refreshToken();
        console.log('Token refreshed');
        // Note: Updating provider token at runtime would require
        // additional API in ProviderRegistry (future enhancement)
      }
      return {};
    }
  }
});
```

### Complete Web App Example (Express)

```typescript
import express from 'express';
import { OAuthManager, OAuthFileStorage } from '@oneringai/agents';

const app = express();

// Initialize OAuth
const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'https://www.googleapis.com/auth/userinfo.email',

  storage: new OAuthFileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY!
  })
});

// Login route
app.get('/login', async (req, res) => {
  const authUrl = await oauth.startAuthFlow();
  res.redirect(authUrl);
});

// Callback route
app.get('/callback', async (req, res) => {
  try {
    await oauth.handleCallback(req.url);
    res.send('✅ Authorized! You can close this window.');
  } catch (error) {
    res.status(400).send('❌ Authorization failed: ' + (error as Error).message);
  }
});

// Protected route
app.get('/api/data', async (req, res) => {
  try {
    const token = await oauth.getToken();

    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(401).json({ error: 'Not authorized' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Visit http://localhost:3000/login to start OAuth flow');
});
```

---

## Configuration Reference

### Complete OAuthConfig

```typescript
interface OAuthConfig {
  // ===== REQUIRED =====
  flow: 'authorization_code' | 'client_credentials' | 'jwt_bearer';
  tokenUrl: string;
  clientId: string;

  // ===== Authorization Code =====
  authorizationUrl?: string;     // Required for authorization_code
  redirectUri?: string;          // Required for authorization_code
  scope?: string;                // Space-separated scopes
  usePKCE?: boolean;            // Default: true (recommended)

  // ===== Client Credentials =====
  clientSecret?: string;         // Required for client_credentials

  // ===== JWT Bearer =====
  privateKey?: string;           // PEM format string
  privateKeyPath?: string;       // Or path to PEM file
  tokenSigningAlg?: string;      // Default: RS256
  audience?: string;             // Token audience (usually tokenUrl)

  // ===== Token Management =====
  autoRefresh?: boolean;         // Default: true
  refreshBeforeExpiry?: number;  // Seconds before expiry (default: 300)

  // ===== Storage =====
  storage?: ITokenStorage;       // Custom storage backend
  storageKey?: string;           // Key for this token (default: auto-generated)
}
```

---

## Environment Variables

```bash
# OAuth Encryption (REQUIRED for production)
OAUTH_ENCRYPTION_KEY=your-64-char-hex-key-here

# Microsoft Graph
MICROSOFT_CLIENT_ID=your-app-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id

# Google
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# GitHub
GITHUB_CLIENT_ID=your-github-app-id
GITHUB_CLIENT_SECRET=your-github-secret

# ClickUp
CLICKUP_CLIENT_ID=your-clickup-client-id
CLICKUP_CLIENT_SECRET=your-clickup-secret

# HubSpot
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-secret

# Salesforce
SALESFORCE_CONSUMER_KEY=your-connected-app-key
SALESFORCE_CONSUMER_SECRET=your-connected-app-secret

# Dropbox
DROPBOX_APP_KEY=your-dropbox-app-key
DROPBOX_APP_SECRET=your-dropbox-app-secret
```

---

## Troubleshooting

### "No token stored"
- **Cause**: No token in storage
- **Fix**: For authorization_code, call `startAuthFlow()` first

### "Token request failed: 400"
- **Cause**: Invalid credentials or configuration
- **Fix**: Check clientId, clientSecret, tokenUrl are correct

### "State mismatch"
- **Cause**: CSRF protection triggered
- **Fix**: Don't modify state parameter, complete flow in same session

### "Failed to decrypt token"
- **Cause**: Wrong encryption key or corrupted token
- **Fix**: Regenerate encryption key and re-authorize

### "OAUTH_ENCRYPTION_KEY not set" warning
- **Cause**: Using FileStorage without encryption key
- **Fix**: Set `OAUTH_ENCRYPTION_KEY` in environment variables

---

## Best Practices

### 1. Always Set Encryption Key in Production

```bash
# Generate
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env (never commit!)
OAUTH_ENCRYPTION_KEY=your-key-here
```

### 2. Use Appropriate Storage

- **Development**: MemoryStorage (default)
- **Desktop App**: FileStorage
- **Web Service**: FileStorage or MongoStorage
- **Multi-Instance**: MongoStorage or Redis (custom)

### 3. Store Credentials Securely

```typescript
// ❌ Bad: Hardcoded secrets
const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: 'abc123',  // Don't hardcode!
  clientSecret: 'secret',  // Don't hardcode!
  tokenUrl: 'https://...'
});

// ✅ Good: Environment variables
const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  tokenUrl: 'https://...'
});
```

### 4. Handle Token Refresh

```typescript
try {
  const token = await oauth.getToken();
  // Use token
} catch (error) {
  if (error.message.includes('No valid token')) {
    // User needs to re-authorize
    const authUrl = await oauth.startAuthFlow();
    // Redirect user to authUrl
  }
}
```

### 5. Implement Token Rotation

```typescript
// For long-running services
setInterval(async () => {
  if (!await oauth.isTokenValid()) {
    await oauth.refreshToken();
    console.log('Token refreshed automatically');
  }
}, 60000); // Check every minute
```

---

## API Support Matrix

| Provider | User OAuth | App Token | JWT Bearer | Static Token | PKCE Support |
|----------|-----------|-----------|------------|--------------|--------------|
| **Microsoft Graph** | ✅ Auth Code | ✅ Client Creds | ❌ | ❌ | ✅ |
| **Google APIs** | ✅ Auth Code | ❌ | ✅ Service Account | ✅ API Key | ✅ |
| **Google Vertex AI** | ❌ | ❌ | ✅ Service Account | ❌ | N/A |
| **GitHub** | ✅ Auth Code | ❌ | ✅ GitHub App | ✅ Personal Token | ❌ |
| **ClickUp** | ✅ Auth Code | ❌ | ❌ | ✅ API Key | ❌ |
| **HubSpot** | ✅ Auth Code | ❌ | ❌ | ✅ Private App | ✅ |
| **Salesforce** | ✅ Auth Code | ✅ Client Creds | ✅ JWT Bearer | ❌ | ✅ |
| **Dropbox** | ✅ Auth Code | ❌ | ❌ | ✅ App Token | ✅ |
| **OpenAI** | ❌ | ❌ | ❌ | ✅ API Key | N/A |
| **Anthropic** | ❌ | ❌ | ❌ | ✅ API Key | N/A |

---

## Custom Storage Example

Implement `ITokenStorage` for your own backend:

```typescript
import { IOAuthTokenStorage, StoredToken } from '@oneringai/agents';
import Redis from 'ioredis';
import { encrypt, decrypt } from './encryption';

class RedisStorage implements IOAuthTokenStorage {
  private redis: Redis;
  private encryptionKey: string;

  constructor(redisUrl: string, encryptionKey: string) {
    this.redis = new Redis(redisUrl);
    this.encryptionKey = encryptionKey;
  }

  async storeToken(key: string, token: StoredToken): Promise<void> {
    const encrypted = encrypt(JSON.stringify(token), this.encryptionKey);
    const ttl = token.expires_in; // Redis TTL in seconds
    await this.redis.setex(key, ttl, encrypted);
  }

  async getToken(key: string): Promise<StoredToken | null> {
    const encrypted = await this.redis.get(key);
    if (!encrypted) return null;

    const decrypted = decrypt(encrypted, this.encryptionKey);
    return JSON.parse(decrypted);
  }

  async deleteToken(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async hasToken(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }
}

// Use it
const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: '...',
  clientSecret: '...',
  tokenUrl: '...',
  storage: new RedisStorage(
    process.env.REDIS_URL!,
    process.env.OAUTH_ENCRYPTION_KEY!
  )
});
```

---

## Complete Configuration Examples

### Microsoft Graph (Production)

```typescript
import { OAuthManager, OAuthFileStorage } from '@oneringai/agents';

const config = {
  flow: 'authorization_code' as const,
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  authorizationUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/callback',
  scope: 'User.Read Mail.Read Calendars.ReadWrite Files.ReadWrite.All',
  usePKCE: true,
  storage: new OAuthFileStorage({
    directory: './secure-tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY!
  }),
  refreshBeforeExpiry: 600 // Refresh 10 minutes before expiry
};

const microsoftOAuth = new OAuthManager(config);
```

### Google Service Account (Production)

```typescript
import { OAuthManager } from '@oneringai/agents';
import serviceAccountKey from './google-service-account.json';

const config = {
  flow: 'jwt_bearer' as const,
  clientId: serviceAccountKey.client_email,
  privateKey: serviceAccountKey.private_key,
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/cloud-platform'
  ].join(' '),
  audience: 'https://oauth2.googleapis.com/token',
  tokenSigningAlg: 'RS256',
  refreshBeforeExpiry: 300
};

const googleOAuth = new OAuthManager(config);

// Use with multiple Google APIs
const token = await googleOAuth.getToken();

// Drive API
const files = await fetch('https://www.googleapis.com/drive/v3/files', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Gmail API
const messages = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Testing

### Test OAuth Manager

```typescript
import { OAuthManager } from '@oneringai/agents';

// Test with mock server or real credentials
const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: 'test-id',
  clientSecret: 'test-secret',
  tokenUrl: 'http://localhost:8080/oauth/token'
});

// Should get token
const token = await oauth.getToken();
console.assert(typeof token === 'string');

// Should use cache
const token2 = await oauth.getToken();
console.assert(token === token2);

// Should detect validity
const isValid = await oauth.isTokenValid();
console.assert(isValid === true);
```

---

## Examples

Run the OAuth demo:

```bash
npm run example:oauth
```

This demonstrates:
- Client Credentials flow
- In-memory storage (encrypted)
- File storage (encrypted)
- Storage backend comparison
- Security features
- Usage examples

---

**Version**: 0.2.0
**Security**: Production-grade (AES-256-GCM encryption)
**Architecture**: Clean Architecture (domain/infrastructure separation)
**Extensibility**: Easy to add custom storage backends

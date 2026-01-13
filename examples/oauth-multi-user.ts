/**
 * Multi-User OAuth Example
 *
 * Demonstrates OAuth with multiple users using the same provider
 * Each user's tokens are stored separately and automatically refreshed
 */

import 'dotenv/config';
import {
  OAuthManager,
  OAuthFileStorage,
  generateEncryptionKey,
} from '../src/index.js';
import * as http from 'http';

// Simulated user database (in real app, this would be your user system)
interface User {
  id: string;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 'user123', name: 'Alice', email: 'alice@example.com' },
  { id: 'user456', name: 'Bob', email: 'bob@example.com' },
  { id: 'user789', name: 'Charlie', email: 'charlie@example.com' },
];

// Create ONE OAuth manager for the provider
// All users share the same OAuth configuration
const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GITHUB_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'user:email repo',

  // Use file storage so tokens persist across restarts
  storage: new OAuthFileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY || generateEncryptionKey(),
  }),
});

async function main() {
  console.log('🔐 Multi-User OAuth Example\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ==================== Example 1: Authenticate Multiple Users ====================
  console.log('Example 1: Authenticate Multiple Users');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('Users to authenticate:');
  for (const user of users) {
    console.log(`  • ${user.name} (${user.id}) - ${user.email}`);
  }
  console.log('');

  // Authenticate each user (in a real app, users would do this themselves)
  for (const user of users) {
    console.log(`\n📝 Authenticating ${user.name} (${user.id})...`);

    try {
      // Check if user already has a valid token
      if (await oauth.isTokenValid(user.id)) {
        console.log(`   ✅ ${user.name} already authenticated`);
        const token = await oauth.getToken(user.id);
        console.log(`   Token: ${token.substring(0, 20)}...`);
        continue;
      }
    } catch (error) {
      // No token yet, need to authorize
      console.log(`   ℹ️  No token found for ${user.name}`);
    }

    // Start authorization flow for this user
    const authUrl = await oauth.startAuthFlow(user.id);
    console.log(`   🔗 Authorization URL: ${authUrl.substring(0, 80)}...`);
    console.log(`   💡 In a real app, user ${user.name} would visit this URL`);
    console.log(`   💡 After authorization, callback would receive: code + state`);
    console.log(`   💡 State parameter includes userId for user routing`);

    // In a real app, the user would authorize and you'd receive a callback
    // For demo purposes, we'll skip actual authorization
    console.log(`   ⏸️  Skipping actual authorization (demo mode)`);
  }

  // ==================== Example 2: Token Storage Isolation ====================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 2: Token Storage Isolation');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('Each user\'s tokens are stored separately:');
  console.log('  Storage keys:');
  console.log('    • auth_code:your-client-id:user123  (Alice\'s tokens)');
  console.log('    • auth_code:your-client-id:user456  (Bob\'s tokens)');
  console.log('    • auth_code:your-client-id:user789  (Charlie\'s tokens)');
  console.log('');
  console.log('  All tokens are:');
  console.log('    ✅ Encrypted with AES-256-GCM');
  console.log('    ✅ Isolated per user');
  console.log('    ✅ Auto-refreshed when expired');
  console.log('    ✅ Persisted to disk (survive restarts)');

  // ==================== Example 3: Using Tokens (Simulated) ====================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 3: Using Tokens for API Calls');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('How you would use tokens in a real application:\n');

  console.log('```typescript');
  console.log('// In your API endpoint handler');
  console.log('app.get("/api/user-repos", async (req, res) => {');
  console.log('  const userId = req.user.id; // From session/JWT');
  console.log('');
  console.log('  // Get user-specific token (auto-refreshes if expired)');
  console.log('  const token = await oauth.getToken(userId);');
  console.log('');
  console.log('  // Make API call as the user');
  console.log('  const response = await fetch("https://api.github.com/user/repos", {');
  console.log('    headers: { Authorization: `Bearer ${token}` }');
  console.log('  });');
  console.log('');
  console.log('  const repos = await response.json();');
  console.log('  res.json(repos);');
  console.log('});');
  console.log('```');

  // ==================== Example 4: Multi-Tenant Patterns ====================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 4: Multi-Tenant Architecture Patterns');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('Pattern 1: Web Application (Session-Based)');
  console.log('──────────────────────────────────────────────\n');
  console.log('```typescript');
  console.log('// Login route: initiate OAuth for user');
  console.log('app.get("/auth/github", async (req, res) => {');
  console.log('  const userId = req.session.userId;');
  console.log('  const authUrl = await oauth.startAuthFlow(userId);');
  console.log('  res.redirect(authUrl);');
  console.log('});\n');
  console.log('// Callback route: exchange code for token');
  console.log('app.get("/auth/callback", async (req, res) => {');
  console.log('  await oauth.handleCallback(req.url);');
  console.log('  // userId is extracted from state parameter automatically!');
  console.log('  res.redirect("/dashboard");');
  console.log('});');
  console.log('```\n');

  console.log('Pattern 2: API Service (JWT-Based)');
  console.log('──────────────────────────────────────────────\n');
  console.log('```typescript');
  console.log('// Middleware: verify JWT and extract userId');
  console.log('app.use(async (req, res, next) => {');
  console.log('  const jwt = req.headers.authorization?.split(" ")[1];');
  console.log('  const payload = verifyJWT(jwt);');
  console.log('  req.userId = payload.sub;');
  console.log('  next();');
  console.log('});\n');
  console.log('// API endpoint: use user-specific token');
  console.log('app.get("/api/data", async (req, res) => {');
  console.log('  const token = await oauth.getToken(req.userId);');
  console.log('  const data = await fetch(API_URL, {');
  console.log('    headers: { Authorization: `Bearer ${token}` }');
  console.log('  });');
  console.log('  res.json(data);');
  console.log('});');
  console.log('```\n');

  console.log('Pattern 3: Background Jobs');
  console.log('──────────────────────────────────────────────\n');
  console.log('```typescript');
  console.log('// Cron job that processes data for all users');
  console.log('async function dailySync() {');
  console.log('  const users = await db.users.find({ githubConnected: true });');
  console.log('');
  console.log('  for (const user of users) {');
  console.log('    try {');
  console.log('      // Get user-specific token');
  console.log('      const token = await oauth.getToken(user.id);');
  console.log('');
  console.log('      // Sync user\'s data');
  console.log('      await syncUserData(user.id, token);');
  console.log('    } catch (error) {');
  console.log('      // Handle token expiry/revocation');
  console.log('      if (error.message.includes("No token")) {');
  console.log('        await notifyUserReauth(user);');
  console.log('      }');
  console.log('    }');
  console.log('  }');
  console.log('}');
  console.log('```');

  // ==================== Example 5: Storage Backends ====================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 5: Storage Backend Options');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('1️⃣  FileStorage (current example):');
  console.log('   ✅ Best for: Desktop apps, CLI tools, single-server apps');
  console.log('   ✅ Pros: Simple, persists across restarts');
  console.log('   ❌ Cons: Not suitable for multi-server deployments\n');

  console.log('2️⃣  MongoDB/Database Storage:');
  console.log('   ✅ Best for: Multi-server web apps, microservices');
  console.log('   ✅ Pros: Centralized, scales horizontally');
  console.log('   ℹ️  Implementation: Implement ITokenStorage interface');
  console.log('   ```typescript');
  console.log('   class MongoTokenStorage implements ITokenStorage {');
  console.log('     async storeToken(key: string, token: StoredToken) {');
  console.log('       await tokens.updateOne(');
  console.log('         { _id: key },');
  console.log('         { $set: { ...encrypt(token), updatedAt: new Date() } },');
  console.log('         { upsert: true }');
  console.log('       );');
  console.log('     }');
  console.log('     // ... implement other methods');
  console.log('   }');
  console.log('   ```\n');

  console.log('3️⃣  Redis Storage:');
  console.log('   ✅ Best for: High-performance caching, short-lived tokens');
  console.log('   ✅ Pros: Fast, built-in TTL/expiry');
  console.log('   ```typescript');
  console.log('   class RedisTokenStorage implements ITokenStorage {');
  console.log('     async storeToken(key: string, token: StoredToken) {');
  console.log('       await redis.setex(key, token.expires_in, encrypt(token));');
  console.log('     }');
  console.log('   }');
  console.log('   ```');

  // ==================== Summary ====================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📚 Key Takeaways');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✅ ONE OAuthManager instance handles MULTIPLE users');
  console.log('✅ Each user gets isolated, encrypted token storage');
  console.log('✅ userId is embedded in state parameter (automatic routing)');
  console.log('✅ Tokens auto-refresh when expired');
  console.log('✅ Clean Architecture: pluggable storage backends');
  console.log('✅ Backward compatible: userId is optional (defaults to single-user)');
  console.log('✅ Storage keys: `provider:clientId:userId` for isolation');
  console.log('');

  console.log('🚀 Production Checklist:');
  console.log('  [ ] Generate encryption key: process.env.OAUTH_ENCRYPTION_KEY');
  console.log('  [ ] Choose storage backend (File, MongoDB, Redis)');
  console.log('  [ ] Implement token refresh error handling');
  console.log('  [ ] Add user notification for reauth when tokens expire');
  console.log('  [ ] Monitor token storage for cleanup/pruning');
  console.log('  [ ] Set up callback URL whitelist in OAuth provider');
  console.log('');

  console.log('💡 Next Steps:');
  console.log('  1. Set up environment variables in .env');
  console.log('  2. Register OAuth app with provider (GitHub, Google, etc.)');
  console.log('  3. Implement callback handler in your web framework');
  console.log('  4. Test with multiple users');
  console.log('  5. Deploy with database storage backend');
  console.log('');

  console.log('✨ Your OAuth system now supports unlimited users!');
}

main().catch(console.error);

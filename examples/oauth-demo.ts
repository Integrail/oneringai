/**
 * OAuth Plugin Demo
 *
 * Demonstrates the OAuth plugin with different flows and storage backends
 */

import 'dotenv/config';
import {
  OAuthManager,
  OAuthFileStorage,
  generateEncryptionKey,
} from '../src/index.js';

async function main() {
  console.log('🔐 OAuth Plugin Demo\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ==================== Example 1: Client Credentials (In-Memory) ====================
  console.log('Example 1: Client Credentials Flow (In-Memory Storage)');
  console.log('─────────────────────────────────────────────────────\n');

  // Simulated API credentials (replace with real ones)
  const clientCredsOAuth = new OAuthManager({
    flow: 'client_credentials',
    clientId: 'demo-client-id',
    clientSecret: 'demo-client-secret',
    tokenUrl: 'https://oauth2.googleapis.com/token', // Example endpoint
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    // storage: defaults to MemoryStorage (encrypted)
  });

  try {
    console.log('Getting token...');
    const token = await clientCredsOAuth.getToken();
    console.log('✅ Token obtained:',token.substring(0, 20) + '...');

    // Check if valid
    const isValid = await clientCredsOAuth.isTokenValid();
    console.log('Token valid:', isValid);

    // Try getting again (should use cache)
    console.log('\nGetting token again (should use cache)...');
    const token2 = await clientCredsOAuth.getToken();
    console.log('✅ Token from cache:', token2.substring(0, 20) + '...');
    console.log('Same token:', token === token2);
  } catch (error) {
    console.log('❌ Error:', (error as Error).message);
    console.log('Note: This example uses dummy credentials. Replace with real ones to test.\n');
  }

  // ==================== Example 2: File Storage ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 2: Client Credentials with File Storage');
  console.log('─────────────────────────────────────────────────────\n');

  // Generate encryption key (in production, store this in environment)
  if (!process.env.OAUTH_ENCRYPTION_KEY) {
    console.log('💡 Generating encryption key...');
    const key = generateEncryptionKey();
    console.log('Generated key:', key.substring(0, 16) + '...');
    console.log('In production, set this as OAUTH_ENCRYPTION_KEY in .env\n');
  }

  const fileOAuth = new OAuthManager({
    flow: 'client_credentials',
    clientId: 'file-demo-client',
    clientSecret: 'file-demo-secret',
    tokenUrl: 'https://example.com/oauth/token',

    // Use file storage
    storage: new OAuthFileStorage({
      directory: './temp-tokens',
      encryptionKey: process.env.OAUTH_ENCRYPTION_KEY || generateEncryptionKey(),
    }),
  });

  console.log('Using FileStorage in ./temp-tokens directory');
  console.log('Tokens will be encrypted with AES-256-GCM before saving\n');

  try {
    const token = await fileOAuth.getToken();
    console.log('✅ Token stored to encrypted file');
  } catch (error) {
    console.log('ℹ️  Demo only - no real endpoint configured\n');
  }

  // ==================== Example 3: Storage Comparison ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 3: Storage Backend Comparison');
  console.log('─────────────────────────────────────────────────────\n');

  console.log('Available Storage Backends:\n');

  console.log('1. MemoryStorage (default)');
  console.log('   • Encrypted in memory');
  console.log('   • Fast (no I/O)');
  console.log('   • Lost on process restart');
  console.log('   • Good for: Development, short-lived processes');
  console.log('');

  console.log('2. FileStorage');
  console.log('   • Encrypted files on disk');
  console.log('   • Persists across restarts');
  console.log('   • File permissions: 0o600 (owner only)');
  console.log('   • Good for: Desktop apps, CLI tools');
  console.log('');

  console.log('3. MongoStorage (optional)');
  console.log('   • Encrypted in MongoDB');
  console.log('   • Centralized storage');
  console.log('   • Requires: npm install mongodb');
  console.log('   • Good for: Multi-instance services');
  console.log('');

  console.log('4. Custom (implement ITokenStorage)');
  console.log('   • Redis, PostgreSQL, AWS Secrets Manager, etc.');
  console.log('   • Just implement 4 methods');
  console.log('   • Encryption handled by you');
  console.log('');

  // ==================== Security Info ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔒 Security Features');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✅ AES-256-GCM encryption (military-grade)');
  console.log('✅ PBKDF2 key derivation (100,000 iterations)');
  console.log('✅ Authenticated encryption (integrity verification)');
  console.log('✅ Random IV and salt per encryption');
  console.log('✅ File permissions: 0o600 (owner read/write only)');
  console.log('✅ Hashed filenames (don\'t expose key names)');
  console.log('✅ Clean Architecture (easy to add custom storage)');
  console.log('');

  console.log('📝 To Use in Production:');
  console.log('  1. Generate encryption key:');
  console.log('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.log('  2. Add to .env:');
  console.log('     OAUTH_ENCRYPTION_KEY=your-generated-key');
  console.log('  3. Use FileStorage or MongoStorage for persistence');
  console.log('');

  // ==================== Usage Examples ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 Usage Examples');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Client Credentials (simplest):');
  console.log(`
const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: 'your-id',
  clientSecret: 'your-secret',
  tokenUrl: 'https://api.com/oauth/token'
});

const token = await oauth.getToken();
  `);

  console.log('JWT Bearer (service accounts):');
  console.log(`
const oauth = new OAuthManager({
  flow: 'jwt_bearer',
  clientId: 'service@project.iam',
  privateKeyPath: './key.pem',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: 'https://www.googleapis.com/auth/cloud-platform'
});

const token = await oauth.getToken();
  `);

  console.log('Authorization Code with PKCE (user OAuth):');
  console.log(`
const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-client-id',
  authorizationUrl: 'https://provider.com/oauth/authorize',
  tokenUrl: 'https://provider.com/oauth/token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'read write'
});

// In your web app:
const authUrl = await oauth.startAuthFlow();
// Redirect user to authUrl

// In callback handler:
await oauth.handleCallback(req.url);
const token = await oauth.getToken();
  `);

  console.log('\n✅ OAuth plugin ready to use!');
  console.log('   See examples/oauth-demo.ts for more details\n');
}

main().catch(console.error);

/**
 * OAuth Registry & Authenticated Fetch Demo
 *
 * Demonstrates:
 * - Registering multiple OAuth providers
 * - Using authenticatedFetch with provider names
 * - Auto-generated API tool with dynamic provider list
 * - AI agent choosing correct provider
 */

import 'dotenv/config';
import {
  OneRingAI,
  oauthRegistry,
  authenticatedFetch,
  generateWebAPITool,
} from '../src/index.js';

async function main() {
  console.log('🌐 OAuth Registry & Authenticated Fetch Demo\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ==================== Step 1: Register OAuth Providers ====================
  console.log('Step 1: Registering OAuth Providers');
  console.log('─────────────────────────────────\n');

  // Register Microsoft Graph
  oauthRegistry.register('microsoft', {
    displayName: 'Microsoft Graph API',
    description: 'Access Microsoft 365: Outlook, OneDrive, Teams, Calendar',
    baseURL: 'https://graph.microsoft.com',
    oauth: {
      flow: 'authorization_code',
      clientId: process.env.MICROSOFT_CLIENT_ID || 'demo-client-id',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'demo-secret',
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      redirectUri: 'http://localhost:3000/callback',
      scope: 'User.Read Mail.Read Files.ReadWrite',
    },
  });

  console.log('✅ Registered: Microsoft Graph API');

  // Register Google
  oauthRegistry.register('google', {
    displayName: 'Google APIs',
    description: 'Access Google Drive, Gmail, Calendar, Contacts',
    baseURL: 'https://www.googleapis.com',
    oauth: {
      flow: 'authorization_code',
      clientId: process.env.GOOGLE_CLIENT_ID || 'demo-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'demo-secret',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      redirectUri: 'http://localhost:3000/callback',
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly',
    },
  });

  console.log('✅ Registered: Google APIs');

  // Register GitHub
  oauthRegistry.register('github', {
    displayName: 'GitHub API',
    description: 'Access GitHub repositories, issues, pull requests, gists',
    baseURL: 'https://api.github.com',
    oauth: {
      flow: 'authorization_code',
      clientId: process.env.GITHUB_CLIENT_ID || 'demo-client-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'demo-secret',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      redirectUri: 'http://localhost:3000/callback',
      scope: 'repo user',
    },
  });

  console.log('✅ Registered: GitHub API');

  // Register Salesforce (Client Credentials example)
  oauthRegistry.register('salesforce', {
    displayName: 'Salesforce API',
    description: 'Access Salesforce CRM: accounts, contacts, opportunities, leads',
    baseURL: 'https://yourinstance.salesforce.com',
    oauth: {
      flow: 'client_credentials',
      clientId: process.env.SALESFORCE_CONSUMER_KEY || 'demo-key',
      clientSecret: process.env.SALESFORCE_CONSUMER_SECRET || 'demo-secret',
      tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    },
  });

  console.log('✅ Registered: Salesforce API\n');

  // ==================== Step 2: List Registered Providers ====================
  console.log('Step 2: Listing Registered Providers');
  console.log('─────────────────────────────────\n');

  console.log('Provider Names:', oauthRegistry.listProviderNames());
  console.log('\nProvider Info:');
  console.log(JSON.stringify(oauthRegistry.getProviderInfo(), null, 2));
  console.log('');

  // ==================== Step 3: Show Tool Description ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Step 3: Dynamic Tool Description');
  console.log('─────────────────────────────────\n');

  console.log('Provider descriptions for tools:\n');
  console.log(oauthRegistry.getProviderDescriptionsForTools());
  console.log('');

  // ==================== Step 4: Generate API Tool ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Step 4: Auto-Generated API Tool');
  console.log('─────────────────────────────────\n');

  const apiTool = generateWebAPITool();

  console.log('Tool name:', apiTool.definition.function.name);
  console.log('Supported auth providers:', apiTool.definition.function.parameters.properties.authProvider.enum);
  console.log('\nThe AI agent can now call ANY registered OAuth API!\n');

  // ==================== Step 5: Example with AI Agent ====================
  if (process.env.OPENAI_API_KEY) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Step 5: AI Agent with OAuth Registry');
    console.log('─────────────────────────────────\n');

    const client = new OneRingAI({
      providers: {
        openai: { apiKey: process.env.OPENAI_API_KEY },
      },
    });

    const agent = await client.agents.create({
      provider: 'openai',
      model: 'gpt-4',
      tools: [apiTool],
      instructions:
        'You have access to multiple OAuth-authenticated APIs. When the user asks to access data from a service, choose the appropriate authProvider and make the request.',
    });

    console.log('Agent created with api_request tool');
    console.log('Available providers:', oauthRegistry.listProviderNames());
    console.log('\nThe agent can intelligently choose which OAuth provider to use based on the user request!');
    console.log('');
    console.log('Examples:');
    console.log('  "Get my GitHub repos" → Uses github provider');
    console.log('  "Read my emails" → Uses microsoft provider');
    console.log('  "List my Google Drive files" → Uses google provider');
    console.log('');
  }

  // ==================== Step 6: Direct Authenticated Fetch ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Step 6: Using authenticatedFetch Directly');
  console.log('─────────────────────────────────\n');

  console.log('Example code:\n');
  console.log(`
// Automatically authenticated!
const response = await authenticatedFetch(
  'https://graph.microsoft.com/v1.0/me',
  { method: 'GET' },
  'microsoft'  // Provider name
);

const userData = await response.json();
  `);

  console.log('\nOr with bound fetch:\n');
  console.log(`
const msftFetch = createAuthenticatedFetch('microsoft');

// Use like normal fetch (auth automatic)
const me = await msftFetch('https://graph.microsoft.com/v1.0/me');
const emails = await msftFetch('https://graph.microsoft.com/v1.0/me/messages');
  `);

  // ==================== Summary ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Demo Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Key Features:');
  console.log('  ✅ Global OAuth registry (register once, use everywhere)');
  console.log('  ✅ Authenticated fetch (same API as fetch + auth)');
  console.log('  ✅ Auto-generated tools (dynamic provider lists)');
  console.log('  ✅ AI chooses correct provider');
  console.log('  ✅ Encrypted token storage');
  console.log('');

  console.log('Next Steps:');
  console.log('  1. Set up OAuth apps with Microsoft, Google, GitHub, etc.');
  console.log('  2. Add credentials to .env');
  console.log('  3. Complete OAuth flows (authorization, callbacks)');
  console.log('  4. Use authenticatedFetch or api_request tool');
  console.log('');

  // Cleanup
  oauthRegistry.clear();
}

main().catch(console.error);

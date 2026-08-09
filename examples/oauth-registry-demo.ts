/**
 * Connector Registry & Authenticated Fetch Demo
 *
 * Demonstrates:
 * - Registering multiple OAuth connectors
 * - Using authenticatedFetch with connector names
 * - Auto-generated API tool with dynamic connector list
 * - AI agent choosing correct connector
 */

import 'dotenv/config';
import {
  Connector,
  Agent,
  Vendor,
  ConnectorTools,
} from '../src/index.js';

async function main() {
  console.log('🌐 Connector Registry & Authenticated Fetch Demo\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ==================== Step 1: Register OAuth Connectors ====================
  console.log('Step 1: Registering OAuth Connectors');
  console.log('─────────────────────────────────\n');

  // Register Microsoft Graph
  Connector.create({
    name: 'microsoft',
    displayName: 'Microsoft Graph API',
    description: 'Access Microsoft 365: Outlook, OneDrive, Teams, Calendar',
    baseURL: 'https://graph.microsoft.com',
    auth: {
      type: 'oauth',
      flow: 'authorization_code',
      clientId: process.env.MICROSOFT_CLIENT_ID || 'demo-client-id',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'demo-secret',
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      redirectUri: 'http://localhost:3000/callback',
      scope: 'User.Read Mail.Read Files.ReadWrite offline_access',
    },
  });

  console.log('✅ Registered: Microsoft Graph API');

  // Register Google
  Connector.create({
    name: 'google',
    displayName: 'Google APIs',
    description: 'Access Google Drive, Gmail, Calendar, Contacts',
    baseURL: 'https://www.googleapis.com',
    auth: {
      type: 'oauth',
      flow: 'authorization_code',
      clientId: process.env.GOOGLE_CLIENT_ID || 'demo-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'demo-secret',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      redirectUri: 'http://localhost:3000/callback',
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly',
      authorizationParams: { access_type: 'offline' },
    },
  });

  console.log('✅ Registered: Google APIs');

  // Register GitHub
  Connector.create({
    name: 'github',
    displayName: 'GitHub API',
    description: 'Access GitHub repositories, issues, pull requests, gists',
    baseURL: 'https://api.github.com',
    auth: {
      type: 'oauth',
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
  Connector.create({
    name: 'salesforce',
    displayName: 'Salesforce API',
    description: 'Access Salesforce CRM: accounts, contacts, opportunities, leads',
    baseURL: 'https://yourinstance.salesforce.com',
    auth: {
      type: 'oauth',
      flow: 'client_credentials',
      clientId: process.env.SALESFORCE_CONSUMER_KEY || 'demo-key',
      clientSecret: process.env.SALESFORCE_CONSUMER_SECRET || 'demo-secret',
      tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    },
  });

  console.log('✅ Registered: Salesforce API\n');

  // ==================== Step 2: List Registered Connectors ====================
  console.log('Step 2: Listing Registered Connectors');
  console.log('─────────────────────────────────\n');

  console.log('Connector Names:', Connector.list());
  console.log('\nConnector Info:');
  console.log(JSON.stringify(Connector.getInfo(), null, 2));
  console.log('');

  // ==================== Step 3: Show Tool Description ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Step 3: Dynamic Tool Description');
  console.log('─────────────────────────────────\n');

  console.log('Connector descriptions for tools:\n');
  console.log(Connector.getDescriptionsForTools());
  console.log('');

  // ==================== Step 4: Generate Connector Tools ====================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Step 4: Auto-Generated Connector Tools');
  console.log('─────────────────────────────────\n');

  const apiTools = [...ConnectorTools.discoverAll().values()].flat();

  console.log('Tool names:', apiTools.map((tool) => tool.definition.function.name).join(', '));
  console.log('\nEach tool is bound to one connector and its authentication context.\n');

  // ==================== Step 5: Example with AI Agent ====================
  if (process.env.OPENAI_API_KEY) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Step 5: AI Agent with Connector Registry');
    console.log('─────────────────────────────────\n');

    Connector.create({
      name: 'openai',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY },
    });

    const agent = Agent.create({
      connector: 'openai',
      model: 'gpt-4.1-mini',
      tools: apiTools,
      instructions:
        'You have access to multiple OAuth-authenticated APIs. When the user asks to access data from a service, choose the appropriate connector and make the request.',
    });

    console.log(`Agent created with ${agent.listTools().length} connector tools`);
    console.log('Available connectors:', Connector.list());
    console.log('\nThe agent can intelligently choose which connector to use based on the user request!');
    console.log('');
    agent.destroy();
    console.log('Examples:');
    console.log('  "Get my GitHub repos" → Uses github connector');
    console.log('  "Read my emails" → Uses microsoft connector');
    console.log('  "List my Google Drive files" → Uses google connector');
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
  'microsoft'  // Connector name
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
  console.log('  ✅ Global connector registry (register once, use everywhere)');
  console.log('  ✅ Authenticated fetch (same API as fetch + auth)');
  console.log('  ✅ Auto-generated tools (dynamic connector lists)');
  console.log('  ✅ AI chooses correct connector');
  console.log('  ✅ Encrypted token storage');
  console.log('');

  console.log('Next Steps:');
  console.log('  1. Set up OAuth apps with Microsoft, Google, GitHub, etc.');
  console.log('  2. Add credentials to .env');
  console.log('  3. Complete OAuth flows (authorization, callbacks)');
  console.log('  4. Use authenticatedFetch or connector-bound tools');
  console.log('');

  // Cleanup
  Connector.clear();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

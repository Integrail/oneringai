/**
 * Connector Registry with Static Tokens
 *
 * Demonstrates registering static API key connectors (OpenAI, Anthropic, etc.)
 * alongside OAuth connectors for unified authenticated fetch interface
 */

import 'dotenv/config';
import {
  Connector,
  Agent,
  Vendor,
  authenticatedFetch,
  generateWebAPITool,
} from '../src/index.js';

async function main() {
  console.log('🔑 Connector Registry with Static Tokens Demo\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ==================== Register Static Token Connectors ====================
  console.log('Registering Static Token Connectors');
  console.log('─────────────────────────────────\n');

  // Register OpenAI API connector
  Connector.create({
    name: 'openai-api',
    displayName: 'OpenAI API',
    description: 'Access OpenAI: models, completions, embeddings, fine-tuning',
    baseURL: 'https://api.openai.com/v1',
    auth: {
      type: 'api_key',
      apiKey: process.env.OPENAI_API_KEY || 'sk-demo-key',
    },
  });

  console.log('✅ Registered: OpenAI API (API key)');

  // Register Anthropic API connector
  Connector.create({
    name: 'anthropic-api',
    displayName: 'Anthropic API',
    description: 'Access Anthropic Claude: messages, completions',
    baseURL: 'https://api.anthropic.com/v1',
    auth: {
      type: 'api_key',
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-demo-key',
    },
  });

  console.log('✅ Registered: Anthropic API (API key)');

  // Register a custom API with API key
  Connector.create({
    name: 'custom-api',
    displayName: 'Custom API',
    description: 'Your custom API with API key',
    baseURL: 'https://api.custom.com/v1',
    auth: {
      type: 'api_key',
      apiKey: process.env.CUSTOM_API_KEY || 'custom-api-key',
    },
  });

  console.log('✅ Registered: Custom API (API key)\n');

  // ==================== Mix with OAuth Connectors ====================
  console.log('Registering OAuth Connectors');
  console.log('─────────────────────────────────\n');

  // Register Microsoft (OAuth)
  Connector.create({
    name: 'microsoft',
    displayName: 'Microsoft Graph',
    description: 'Access Microsoft 365: mail, calendar, files',
    baseURL: 'https://graph.microsoft.com',
    auth: {
      type: 'oauth',
      flow: 'authorization_code',
      clientId: process.env.MICROSOFT_CLIENT_ID || 'demo-id',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'demo-secret',
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      redirectUri: 'http://localhost:3000/callback',
      scope: 'User.Read Mail.Read',
    },
  });

  console.log('✅ Registered: Microsoft Graph (OAuth)\n');

  // ==================== List All Connectors ====================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('All Registered Connectors (Mixed):');
  console.log('─────────────────────────────────\n');

  const connectors = Connector.listAll();
  connectors.forEach((c) => {
    console.log(`• ${c.name}`);
    console.log(`  Name: ${c.displayName}`);
    console.log(`  Base URL: ${c.baseURL}`);
    console.log(`  Description: ${c.config.description || 'No description'}`);
    console.log('');
  });

  // ==================== Use Authenticated Fetch ====================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Using Authenticated Fetch');
  console.log('─────────────────────────────────\n');

  // Example: Call OpenAI API with API key
  console.log('Example: Calling OpenAI API');
  console.log('const response = await authenticatedFetch(');
  console.log('  \'https://api.openai.com/v1/models\',');
  console.log('  { method: \'GET\' },');
  console.log('  \'openai-api\'  // Uses API key automatically!');
  console.log(');\n');

  try {
    const response = await authenticatedFetch(
      'https://api.openai.com/v1/models',
      { method: 'GET' },
      'openai-api'
    );

    if (response.ok) {
      const data: any = await response.json();
      console.log('✅ OpenAI API call successful!');
      console.log(`Models available: ${data.data?.length || 0}\n`);
    } else {
      console.log('⚠️  API call failed (expected with demo key)');
      console.log(`Status: ${response.status} ${response.statusText}\n`);
    }
  } catch (error) {
    console.log('ℹ️  Demo mode - set OPENAI_API_KEY to test real calls\n');
  }

  // ==================== Generate Universal API Tool ====================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Universal API Tool');
  console.log('─────────────────────────────────\n');

  const apiTool = generateWebAPITool();

  console.log('Generated tool:', apiTool.definition.function.name);
  console.log('Supports connectors:', apiTool.definition.function.parameters.properties.authProvider.enum);
  console.log('\nTool description includes:\n');
  console.log(Connector.getDescriptionsForTools());
  console.log('');

  // ==================== Use with AI Agent ====================
  if (process.env.OPENAI_API_KEY) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Using with AI Agent');
    console.log('─────────────────────────────────\n');

    // Create AI provider connector
    Connector.create({
      name: 'openai',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY },
    });

    const agent = Agent.create({
      connector: 'openai',
      model: 'gpt-4',
      tools: [apiTool],
      instructions: `You have access to multiple APIs through the api_request tool.

Available connectors: ${Connector.list().join(', ')}

Choose the appropriate connector based on what the user asks for.`,
    });

    console.log('Agent created with universal API tool');
    console.log('The agent can call:');
    console.log('  • OpenAI API (via openai-api connector)');
    console.log('  • Anthropic API (via anthropic-api connector)');
    console.log('  • Microsoft Graph (via microsoft connector)');
    console.log('  • Any other registered connector!');
    console.log('');
  }

  // ==================== Summary ====================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Demo Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Key Benefits:');
  console.log('  ✅ Unified interface for OAuth AND API keys');
  console.log('  ✅ Register once, use everywhere');
  console.log('  ✅ One tool can call multiple APIs');
  console.log('  ✅ AI chooses correct connector automatically');
  console.log('');

  console.log('Usage:');
  console.log('  // Register any connector (OAuth or API key)');
  console.log('  Connector.create({ name, auth, ... })');
  console.log('');
  console.log('  // Use unified fetch');
  console.log('  authenticatedFetch(url, options, connectorName)');
  console.log('');
  console.log('  // Or generate universal tool');
  console.log('  const tool = generateWebAPITool()');
  console.log('');

  // Cleanup
  Connector.clear();
}

main().catch(console.error);

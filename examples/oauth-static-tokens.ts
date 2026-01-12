/**
 * OAuth Registry with Static Tokens
 *
 * Demonstrates registering static API key providers (OpenAI, Anthropic, etc.)
 * alongside OAuth providers for unified authenticated fetch interface
 */

import 'dotenv/config';
import {
  oauthRegistry,
  authenticatedFetch,
  generateWebAPITool,
  OneRingAI,
} from '../src/index.js';

async function main() {
  console.log('🔑 OAuth Registry with Static Tokens Demo\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ==================== Register Static Token Providers ====================
  console.log('Registering Static Token Providers');
  console.log('─────────────────────────────────\n');

  // Register OpenAI
  oauthRegistry.register('openai-api', {
    displayName: 'OpenAI API',
    description: 'Access OpenAI: models, completions, embeddings, fine-tuning',
    baseURL: 'https://api.openai.com/v1',
    oauth: {
      flow: 'static_token',
      staticToken: process.env.OPENAI_API_KEY || 'sk-demo-key',
      clientId: 'openai',  // Just for identification
      tokenUrl: ''  // Not used for static tokens
    },
  });

  console.log('✅ Registered: OpenAI API (static token)');

  // Register Anthropic
  oauthRegistry.register('anthropic-api', {
    displayName: 'Anthropic API',
    description: 'Access Anthropic Claude: messages, completions',
    baseURL: 'https://api.anthropic.com/v1',
    oauth: {
      flow: 'static_token',
      staticToken: process.env.ANTHROPIC_API_KEY || 'sk-ant-demo-key',
      clientId: 'anthropic',
      tokenUrl: ''
    },
  });

  console.log('✅ Registered: Anthropic API (static token)');

  // Register a custom API with static token
  oauthRegistry.register('custom-api', {
    displayName: 'Custom API',
    description: 'Your custom API with static token',
    baseURL: 'https://api.custom.com/v1',
    oauth: {
      flow: 'static_token',
      staticToken: process.env.CUSTOM_API_KEY || 'custom-api-key',
      clientId: 'custom',
      tokenUrl: ''
    },
  });

  console.log('✅ Registered: Custom API (static token)\n');

  // ==================== Mix with OAuth Providers ====================
  console.log('Registering OAuth Providers');
  console.log('─────────────────────────────────\n');

  // Register Microsoft (OAuth)
  oauthRegistry.register('microsoft', {
    displayName: 'Microsoft Graph',
    description: 'Access Microsoft 365: mail, calendar, files',
    baseURL: 'https://graph.microsoft.com',
    oauth: {
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

  // ==================== List All Providers ====================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('All Registered Providers (Mixed):');
  console.log('─────────────────────────────────\n');

  const providers = oauthRegistry.listProviders();
  providers.forEach((p) => {
    console.log(`• ${p.name}`);
    console.log(`  Name: ${p.displayName}`);
    console.log(`  Base URL: ${p.baseURL}`);
    console.log(`  Description: ${p.description}`);
    console.log('');
  });

  // ==================== Use Authenticated Fetch ====================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Using Authenticated Fetch');
  console.log('─────────────────────────────────\n');

  // Example: Call OpenAI API with static token
  console.log('Example: Calling OpenAI API');
  console.log('const response = await authenticatedFetch(');
  console.log('  \'https://api.openai.com/v1/models\',');
  console.log('  { method: \'GET\' },');
  console.log('  \'openai-api\'  // Uses static token automatically!');
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
  console.log('Supports providers:', apiTool.definition.function.parameters.properties.authProvider.enum);
  console.log('\nTool description includes:\n');
  console.log(oauthRegistry.getProviderDescriptionsForTools());
  console.log('');

  // ==================== Use with AI Agent ====================
  if (process.env.OPENAI_API_KEY) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Using with AI Agent');
    console.log('─────────────────────────────────\n');

    const client = new OneRingAI({
      providers: {
        openai: { apiKey: process.env.OPENAI_API_KEY },
      },
    });

    const agent = client.agents.create({
      provider: 'openai',
      model: 'gpt-4',
      tools: [apiTool],
      instructions: `You have access to multiple APIs through the api_request tool.

Available providers: ${oauthRegistry.listProviderNames().join(', ')}

Choose the appropriate provider based on what the user asks for.`,
    });

    console.log('Agent created with universal API tool');
    console.log('The agent can call:');
    console.log('  • OpenAI API (via openai-api provider)');
    console.log('  • Anthropic API (via anthropic-api provider)');
    console.log('  • Microsoft Graph (via microsoft provider)');
    console.log('  • Any other registered provider!');
    console.log('');
  }

  // ==================== Summary ====================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Demo Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Key Benefits:');
  console.log('  ✅ Unified interface for OAuth AND static tokens');
  console.log('  ✅ Register once, use everywhere');
  console.log('  ✅ One tool can call multiple APIs');
  console.log('  ✅ AI chooses correct provider automatically');
  console.log('');

  console.log('Usage:');
  console.log('  // Register any API (OAuth or static)');
  console.log('  oauthRegistry.register(name, config)');
  console.log('');
  console.log('  // Use unified fetch');
  console.log('  authenticatedFetch(url, options, providerName)');
  console.log('');
  console.log('  // Or generate universal tool');
  console.log('  const tool = generateWebAPITool()');
  console.log('');

  // Cleanup
  oauthRegistry.clear();
}

main().catch(console.error);

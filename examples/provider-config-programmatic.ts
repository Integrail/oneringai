/**
 * Programmatic Provider Config Generation
 *
 * Shows how to use ProviderConfigAgent programmatically (non-interactive)
 */

import 'dotenv/config';
import { Connector, Vendor, ProviderConfigAgent } from '../src/index.js';

async function main() {
  console.log('🔌 Programmatic OAuth Provider Configuration\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
  });

  // Create config agent
  const configAgent = new ProviderConfigAgent('openai');

  // Example 1: Generate GitHub user OAuth config
  console.log('Example 1: GitHub User OAuth (Authorization Code)\n');

  try {
    const result = await configAgent.run(
      'Configure GitHub with user OAuth for a web app at http://localhost:3000/callback'
    );

    console.log('✅ Generated configuration:\n');
    console.log('Provider Name:', result.name);
    console.log('Flow Type:', result.config.oauth.flow);
    console.log('');
    console.log('Setup Instructions:');
    console.log(result.setupInstructions);
    console.log('');
    console.log('Environment Variables:');
    result.envVariables.forEach((v) => console.log(`  ${v}`));
    console.log('');
    console.log('Full Config:');
    console.log(JSON.stringify(result.config, null, 2));
    console.log('');

    // Register it immediately!
    console.log('📝 Registering connector...');
    Connector.create({ name: result.name, ...result.config });
    console.log(`✅ Connector '${result.name}' registered!`);
    console.log(`   Available connectors: ${Connector.list().join(', ')}`);
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Example 2: Different provider
  console.log('Example 2: Generate another provider config\n');

  configAgent.reset(); // Reset for new conversation

  try {
    const result2 = await configAgent.run(
      'Configure Microsoft Graph API with client credentials for a backend service'
    );

    console.log('✅ Generated configuration:\n');
    console.log('Provider Name:', result2.providerName);
    console.log('Flow Type:', result2.config.oauth.flow);
    console.log('');
    console.log('Full Config:');
    console.log(JSON.stringify(result2.config, null, 2));
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
  }

  console.log('\n✨ Done! The AI generated everything - no templates needed!');
}

main().catch(console.error);

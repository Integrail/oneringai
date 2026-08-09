/**
 * Programmatic Provider Config Generation
 *
 * Shows how to use ProviderConfigAgent programmatically (non-interactive)
 */

import 'dotenv/config';
import { Connector, Vendor, ProviderConfigAgent } from '../src/index.js';
import type { ConnectorConfigResult } from '../src/index.js';

// Type guard to check if result is a ConnectorConfigResult (not a string question)
function isConfigResult(result: string | ConnectorConfigResult): result is ConnectorConfigResult {
  return typeof result !== 'string' && 'name' in result && 'config' in result;
}

async function finishConfiguration(
  agent: ProviderConfigAgent,
  request: string,
  followUps: string[],
): Promise<ConnectorConfigResult> {
  let result = await agent.run(request);
  for (const answer of followUps) {
    if (isConfigResult(result)) return result;
    console.log(`AI asked: ${result}`);
    result = await agent.continue(answer);
  }
  if (!isConfigResult(result)) {
    throw new Error(`Configuration is incomplete; last question was: ${result}`);
  }
  return result;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env before running this example.');
  }

  console.log('🔌 Programmatic OAuth Provider Configuration\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  // Create config agent
  const configAgent = new ProviderConfigAgent('openai');
  let failures = 0;

  // Example 1: Generate GitHub user OAuth config
  console.log('Example 1: GitHub User OAuth (Authorization Code)\n');

  try {
    const result = await finishConfiguration(
      configAgent,
      'Configure GitHub for a web app. Users will sign in with GitHub; the app needs their email and repository access. Use http://localhost:3000/callback.',
      ['Users sign in with GitHub.', 'Read email addresses and repositories.', 'Yes, generate the configuration now.'],
    );

    console.log('✅ Generated configuration:\n');
    console.log('Provider Name:', result.name);
    if (result.config.auth.type === 'oauth') {
      console.log('Flow Type:', result.config.auth.flow);
    }
    console.log('');
    console.log('Setup Instructions:');
    console.log(result.setupInstructions);
    console.log('');
    console.log('Environment Variables:');
    result.envVariables.forEach((v: string) => console.log(`  ${v}`));
    console.log('');
    console.log('Full Config:');
    console.log(JSON.stringify(result.config, null, 2));
    console.log('');

    console.log('Use this object with Connector.create() after replacing ENV:... placeholders.');
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    failures += 1;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Example 2: Different provider
  console.log('Example 2: Generate another provider config\n');

  configAgent.reset(); // Reset for new conversation

  try {
    const result2 = await finishConfiguration(
      configAgent,
      'Configure Microsoft Graph for a backend service with no user login. It needs application access to read user profiles and mail.',
      ['No users sign in; this is a backend service.', 'Read user profiles and mail.', 'Yes, generate the configuration now.'],
    );

    console.log('✅ Generated configuration:\n');
    console.log('Provider Name:', result2.name);
    if (result2.config.auth.type === 'oauth') {
      console.log('Flow Type:', result2.config.auth.flow);
    }
    console.log('');
    console.log('Full Config:');
    console.log(JSON.stringify(result2.config, null, 2));
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    failures += 1;
  }

  configAgent.destroy();
  if (failures > 0) throw new Error(`${failures} provider configuration example(s) failed.`);
  console.log('\n✨ Done! The AI generated everything - no templates needed!');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

/**
 * Debug: Test Google tool calling
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, tools } from '../src/index.js';

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is required. Add it to .env.');

  Connector.create({
    name: 'google',
    vendor: Vendor.Google,
    auth: { type: 'api_key', apiKey },
  });

  console.log('Testing Google tool calling...\n');

  const agent = Agent.create({
    connector: 'google',
    model: 'gemini-2.5-flash',
    instructions: 'You are a helpful assistant. You MUST use execute_javascript for calculations.',
    tools: [tools.executeJavaScript],
    permissions: { autoApproveAll: true }, // Demo-only: do not auto-approve arbitrary code in production.
  });
  let toolCalls = 0;
  agent.on('tool:start', () => {
    toolCalls += 1;
  });

  try {
    console.log('User: Calculate 5 + 3 using execute_javascript\n');
    const response = await agent.run('Calculate 5 + 3 using execute_javascript');

    console.log('Response:', response.output_text);
    console.log('\nUsage:', response.usage);
    console.log('\nOutput items:', JSON.stringify(response.output, null, 2));
    console.log('\nTool calls executed:', toolCalls);
    if (toolCalls === 0) throw new Error('The model did not call execute_javascript.');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }

  agent.destroy();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

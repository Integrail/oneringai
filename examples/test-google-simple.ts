/**
 * Simple Google tool calling test
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

  console.log('=== Testing Google Tool Calling ===\n');

  const agent = Agent.create({
    connector: 'google',
    model: 'gemini-2.5-flash',
    instructions: 'Use the execute_javascript tool when asked to run code.',
    tools: [tools.executeJavaScript],
    maxIterations: 5,
    permissions: { autoApproveAll: true }, // Demo-only.
  });

  // Add event listeners
  let toolCalls = 0;
  agent.on('tool:start', (data) => {
    toolCalls += 1;
    console.log(`\n[EVENT] Tool starting: ${data.toolCall.function.name}`);
    console.log(`[EVENT] Args:`, data.toolCall.function.arguments);
  });

  agent.on('tool:complete', (data) => {
    console.log(`[EVENT] Tool result:`, JSON.stringify(data.result.content));
  });

  agent.on('iteration:complete', (data) => {
    console.log(`[EVENT] Iteration ${data.iteration} done\n`);
  });

  try {
    console.log('User: Calculate 2 + 2 using execute_javascript tool\n');
    const response = await agent.run('Calculate 2 + 2 using execute_javascript tool');

    console.log('\n=== RESULT ===');
    console.log('Response:', response.output_text);
    console.log('Usage:', response.usage);
    console.log('Iterations:', response.output.length);
    if (toolCalls === 0) throw new Error('The model did not call execute_javascript.');
  } catch (error: unknown) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }

  agent.destroy();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

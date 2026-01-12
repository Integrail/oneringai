/**
 * Simple Google tool calling test
 */

import { OneRingAI, tools } from '../src/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = new OneRingAI({
    providers: {
      google: { apiKey: process.env.GOOGLE_API_KEY! },
    },
  });

  console.log('=== Testing Google Tool Calling ===\n');

  const agent = client.agents.create({
    provider: 'google',
    model: 'gemini-2.0-flash-exp',
    instructions: 'Use the execute_javascript tool when asked to run code.',
    tools: [tools.executeJavaScript],
    maxIterations: 5,
  });

  // Add event listeners
  agent.on('tool:start', (data) => {
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
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

main();

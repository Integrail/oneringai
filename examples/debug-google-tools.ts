/**
 * Debug: Test Google tool calling
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

  console.log('Testing Google tool calling...\n');

  const agent = await client.agents.create({
    provider: 'google',
    model: 'gemini-2.0-flash',
    instructions: 'You are a helpful assistant. When asked to run code or execute JavaScript, you MUST use the execute_javascript tool. Do not write example code - actually execute it using the tool.',
    tools: [tools.executeJavaScript],
  });

  try {
    console.log('User: Execute JavaScript code: console.log(5 + 3)\n');
    const response = await agent.run('Execute JavaScript code: console.log(5 + 3)');

    console.log('Response:', response.output_text);
    console.log('\nUsage:', response.usage);
    console.log('\nOutput items:', JSON.stringify(response.output, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

/**
 * Debug: Test Google tool calling
 */

import { Connector, Agent, Vendor, tools } from '../src/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  Connector.create({
    name: 'google',
    vendor: Vendor.Google,
    auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
  });

  console.log('Testing Google tool calling...\n');

  const agent = Agent.create({
    connector: 'google',
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

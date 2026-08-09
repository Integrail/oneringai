/**
 * Test Google with weather tool
 */

import 'dotenv/config';
import { Connector, Agent, Vendor } from '../src/index.js';
import type { ToolFunction } from '../src/index.js';

// Weather tool
const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name',
          },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args: { location: string }) => {
    return {
      location: args.location,
      temperature: 72,
      condition: 'sunny',
      humidity: 65,
    };
  },
};

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is required. Add it to .env.');

  Connector.create({
    name: 'google',
    vendor: Vendor.Google,
    auth: { type: 'api_key', apiKey },
  });

  const agent = Agent.create({
    connector: 'google',
    model: 'gemini-2.5-flash',
    instructions: 'You are a helpful weather assistant. Use the get_weather tool to fetch weather information.',
    tools: [weatherTool],
    permissions: { autoApproveAll: true },
  });
  let automaticToolCalls = 0;
  agent.on('tool:start', () => {
    automaticToolCalls += 1;
  });

  console.log('Testing Google with weather tool (no tool_choice)...\n');

  try {
    const response = await agent.run('What is the weather in San Francisco?');
    console.log('Response:', response.output_text);
    console.log('\nUsage:', response.usage);
    console.log('\nTool calls executed:', automaticToolCalls);
    if (automaticToolCalls === 0) throw new Error('The automatic tool-choice example did not call get_weather.');
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }

  // Now test an explicit tool-use prompt.
  console.log('\n\n=== Testing with an explicit tool-use prompt ===\n');

  const agent2 = Agent.create({
    connector: 'google',
    model: 'gemini-2.5-flash',
    instructions: 'You MUST use tools when available. Use the get_weather tool for weather queries.',
    tools: [weatherTool],
    permissions: { autoApproveAll: true },
  });
  let toolCallCount = 0;
  agent2.on('tool:start', () => {
    toolCallCount += 1;
  });

  try {
    // Try with more explicit prompt
    const response2 = await agent2.run('Use the get_weather tool to check weather in Tokyo');
    console.log('Response:', response2.output_text);
    console.log('\nUsage:', response2.usage);
    console.log('\nTool calls executed:', toolCallCount);
    if (toolCallCount === 0) throw new Error('The explicit tool-use example did not call get_weather.');
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }

  agent.destroy();
  agent2.destroy();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

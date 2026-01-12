/**
 * Test Google with weather tool
 */

import { OneRingAI, ToolFunction } from '../src/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

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
  const client = new OneRingAI({
    providers: {
      google: { apiKey: process.env.GOOGLE_API_KEY! },
    },
  });

  const agent = client.agents.create({
    provider: 'google',
    model: 'gemini-1.5-pro', // Use 1.5 Pro which has better function calling
    instructions: 'You are a helpful weather assistant. Use the get_weather tool to fetch weather information.',
    tools: [weatherTool],
  });

  console.log('Testing Google with weather tool (no tool_choice)...\n');

  try {
    const response = await agent.run('What is the weather in San Francisco?');
    console.log('Response:', response.output_text);
    console.log('\nUsage:', response.usage);
  } catch (error: any) {
    console.error('Error:', error.message);
  }

  // Now test with specific tool choice
  console.log('\n\n=== Testing with specific tool choice ===\n');

  const agent2 = client.agents.create({
    provider: 'google',
    model: 'gemini-2.0-flash',
    instructions: 'You MUST use tools when available. Use the get_weather tool for weather queries.',
    tools: [weatherTool],
  });

  try {
    // Try with more explicit prompt
    const response2 = await agent2.run('Use the get_weather tool to check weather in Tokyo');
    console.log('Response:', response2.output_text);
    console.log('\nUsage:', response2.usage);
    console.log('\nHas tool calls:', response2.output.some(o =>
      o.type === 'message' && o.content.some(c => c.type === 'tool_use')
    ));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();

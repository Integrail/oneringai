/**
 * Basic agent example with tool calling
 *
 * Demonstrates the new Connector-First API:
 * 1. Create a Connector with credentials
 * 2. Create an Agent from the connector
 * 3. Run the agent with tools
 */

import 'dotenv/config';
import { Connector, Agent, Vendor } from '../src/index.js';
import type { ToolFunction } from '../src/index.js';

// Create a weather tool
const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name (e.g., "Paris", "New York")',
          },
          units: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature units',
          },
        },
        required: ['location'],
      },
    },
    blocking: true,
  },
  execute: async (args: { location: string; units?: string }) => {
    console.log(`\n🌤️  Fetching weather for ${args.location}...`);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock weather data
    const weatherData = {
      location: args.location,
      temperature: args.units === 'fahrenheit' ? 72 : 22,
      units: args.units || 'celsius',
      conditions: 'Partly cloudy',
      humidity: 65,
      wind_speed: 12,
    };

    console.log(`✅ Weather data retrieved`);
    return weatherData;
  },
};

// Create a calculator tool
const calculatorTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")',
          },
        },
        required: ['expression'],
      },
    },
    blocking: true,
  },
  execute: async (args: { expression: string }) => {
    console.log(`\n🔢 Calculating: ${args.expression}`);

    const match = args.expression.match(/^\s*(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) throw new Error('Use a two-number expression such as "123 * 456".');
    const left = Number(match[1]);
    const operator = match[2]!;
    const right = Number(match[3]);
    if (operator === '/' && right === 0) throw new Error('Division by zero is not allowed.');

    const result = operator === '+' ? left + right
      : operator === '-' ? left - right
      : operator === '*' ? left * right
      : left / right;
    console.log(`✅ Result: ${result}`);
    return { expression: args.expression, result };
  },
};

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env before running this example.');
  }

  // Create connector with credentials
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  console.log('🤖 Creating agent with tools...\n');

  // Create agent from connector
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
    tools: [weatherTool, calculatorTool],
    instructions: 'You are a helpful assistant that can check weather and perform calculations. Be concise.',
    temperature: 0.7,
    maxIterations: 10,
  });

  // Example 1: Weather query
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Example 1: Weather Query');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response1 = await agent.run('What is the weather like in Tokyo?');
  console.log('\n📝 Agent Response:');
  console.log(response1.output_text);

  // Example 2: Calculation
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Example 2: Calculation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response2 = await agent.run('Calculate 123 * 456 and tell me the result');
  console.log('\n📝 Agent Response:');
  console.log(response2.output_text);

  // Example 3: Multiple tools in one query
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Example 3: Multiple Tools');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response3 = await agent.run(
    'What is the temperature in Paris in Fahrenheit, and what is 32 + 15?'
  );
  console.log('\n📝 Agent Response:');
  console.log(response3.output_text);

  agent.destroy();
  console.log('\n\n✅ All examples completed!');
}

// Run examples
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

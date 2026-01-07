/**
 * JSON Manipulation Tool Example
 *
 * Demonstrates the json_manipulate tool that allows AI agents to:
 * - Delete fields from JSON objects
 * - Add new fields at any depth
 * - Replace values of existing fields
 *
 * The tool uses dot notation for paths (e.g., "user.address.city")
 */

import 'dotenv/config';
import { OneRingAI, tools } from '../src/index.js';

async function main() {
  const client = new OneRingAI({
    providers: {
      openai: { apiKey: process.env.OPENAI_API_KEY || '' },
    },
  });

  console.log('🔧 JSON Manipulation Tool Demo\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create agent with JSON manipulation tool
  const agent = client.agents.create({
    provider: 'openai',
    model: 'gpt-4',
    tools: [tools.jsonManipulator],
    instructions: 'You are a JSON manipulation assistant. When asked to modify JSON, use the json_manipulate tool.',
  });

  // Example 1: Delete a field
  console.log('Example 1: Delete a Field');
  console.log('─────────────────────────\n');

  const userObject = {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    temporary: true,
  };

  console.log('Original object:');
  console.log(JSON.stringify(userObject, null, 2));
  console.log('');

  const response1 = await agent.run(`
Delete the "temporary" field from this object:
${JSON.stringify(userObject)}
`);

  console.log('🤖 Agent response:');
  console.log(response1.output_text);
  console.log('');

  // Example 2: Add nested field
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 2: Add Nested Field');
  console.log('─────────────────────────\n');

  const profileObject = {
    user: {
      name: 'Jane Smith',
    },
  };

  console.log('Original object:');
  console.log(JSON.stringify(profileObject, null, 2));
  console.log('');

  const response2 = await agent.run(`
Add a new nested structure to this object. Add user.contact.phone with value "+1234567890":
${JSON.stringify(profileObject)}
`);

  console.log('🤖 Agent response:');
  console.log(response2.output_text);
  console.log('');

  // Example 3: Replace value in array
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 3: Replace Array Element Value');
  console.log('─────────────────────────\n');

  const teamObject = {
    team: {
      name: 'Engineering',
      members: [
        { name: 'Bob', role: 'Developer', active: true },
        { name: 'Alice', role: 'Designer', active: true },
      ],
    },
  };

  console.log('Original object:');
  console.log(JSON.stringify(teamObject, null, 2));
  console.log('');

  const response3 = await agent.run(`
In this team object, change the role of the first member (Bob) from "Developer" to "Senior Developer":
${JSON.stringify(teamObject)}
`);

  console.log('🤖 Agent response:');
  console.log(response3.output_text);
  console.log('');

  // Example 4: Complex multi-step transformation
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 4: Multi-Step Transformation');
  console.log('─────────────────────────\n');

  const configObject = {
    app: {
      name: 'My App',
      version: '1.0.0',
      settings: {
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          sms: false,
        },
      },
    },
  };

  console.log('Original configuration:');
  console.log(JSON.stringify(configObject, null, 2));
  console.log('');

  const response4 = await agent.run(`
Transform this configuration object:
${JSON.stringify(configObject)}

Please:
1. Delete the sms notification setting
2. Change the theme to "dark"
3. Add a new field app.settings.features with value {"beta": true}
`);

  console.log('🤖 Agent response:');
  console.log(response4.output_text);
  console.log('');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All JSON manipulation examples completed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 Key Features:');
  console.log('  • Dot notation paths: "user.address.city"');
  console.log('  • Array support: "users.0.name"');
  console.log('  • Auto-creates intermediate objects for "add"');
  console.log('  • Safe: original object not mutated');
  console.log('  • Clear error messages for invalid operations');
}

main().catch(console.error);

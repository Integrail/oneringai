/**
 * Basic MCP Client Example
 *
 * Demonstrates connecting to an MCP server and using tools with Agent.
 */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { Connector, Agent, Vendor, MCPRegistry } from '../../src/index.js';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env before running this example.');
  }

  // Create connector for LLM
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  // Create MCP client
  const demoServerPath = fileURLToPath(new URL('./demo-server.ts', import.meta.url));
  const client = MCPRegistry.create({
    name: 'demo',
    transport: 'stdio',
    transportConfig: {
      command: process.execPath,
      args: ['--import', 'tsx', demoServerPath, '--label', 'basic-client'],
    },
    autoReconnect: false,
  });

  // Connect to MCP server
  console.log('Connecting to MCP server...');
  await client.connect();

  console.log(`Connected! Server capabilities:`, client.capabilities);
  console.log(`Available tools (${client.tools.length}):`);
  client.tools.forEach((tool) => console.log(`  - ${tool.name}: ${tool.description}`));

  // Create agent
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
  });

  // Register MCP tools with agent
  client.registerTools(agent.tools);

  console.log(`\nAgent has ${agent.listTools().length} tools available`);

  // Use the agent with MCP tools
  const response = await agent.run('Use the MCP tools to list the demo files and read README.md.');
  console.log('\nAgent response:', response.output_text);

  // Cleanup
  agent.destroy();
  await client.disconnect();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

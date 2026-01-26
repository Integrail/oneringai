/**
 * Basic MCP Client Example
 *
 * Demonstrates connecting to an MCP server and using tools with Agent.
 */

import { Connector, Agent, Vendor, MCPRegistry } from '../../src/index.js';

async function main() {
  // Create connector for LLM
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
  });

  // Create MCP client
  const client = MCPRegistry.create({
    name: 'filesystem',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    },
    autoConnect: true,
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
    model: 'gpt-4',
  });

  // Register MCP tools with agent
  client.registerTools(agent.tools);

  console.log(`\nAgent has ${agent.listTools().length} tools available`);

  // Use the agent with MCP tools
  const response = await agent.run('List the files in the current directory');
  console.log('\nAgent response:', response.output_text);

  // Cleanup
  await client.disconnect();
}

main().catch(console.error);

/**
 * Multi-Server MCP Example
 *
 * Demonstrates using multiple MCP servers with configuration file.
 */

import { Connector, Agent, Vendor, MCPRegistry, Config } from '../../src/index.js';

async function main() {
  // Create connector for LLM
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
  });

  // Load configuration from file
  console.log('Loading configuration...');
  const config = await Config.load('./oneringai.config.json');
  console.log(`Loaded configuration with ${config.mcp?.servers.length} MCP servers`);

  // Create all MCP clients from config
  const clients = MCPRegistry.createFromConfig(config.mcp!);
  console.log(`Created ${clients.length} MCP clients`);

  // Connect all clients with autoConnect enabled
  await MCPRegistry.connectAll();

  // Show status
  const allInfo = MCPRegistry.getAllInfo();
  console.log('\nMCP Server Status:');
  allInfo.forEach((info) => {
    console.log(`  ${info.name}: ${info.state} (${info.toolCount} tools)`);
  });

  // Create agent
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
  });

  // Register tools from all connected servers
  for (const client of clients) {
    if (client.isConnected()) {
      client.registerTools(agent.tools);
      console.log(`Registered ${client.tools.length} tools from '${client.name}'`);
    }
  }

  console.log(`\nTotal tools available: ${agent.listTools().length}`);

  // Use the agent
  const response = await agent.run(
    'Read the README.md file and tell me what this project does'
  );
  console.log('\nAgent response:', response.output_text);

  // Cleanup
  await MCPRegistry.disconnectAll();
}

main().catch(console.error);

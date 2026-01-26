/**
 * HTTP/HTTPS MCP Client Example
 *
 * Demonstrates connecting to a remote MCP server over HTTP/HTTPS.
 */

import { Connector, Agent, Vendor, MCPRegistry } from '../../src/index.js';

async function main() {
  // Create connector for LLM
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
  });

  // Create HTTP MCP client
  const client = MCPRegistry.create({
    name: 'remote-server',
    transport: 'http',
    transportConfig: {
      url: 'http://localhost:3000/mcp',
      // Optional: Add authentication token
      token: process.env.MCP_SERVER_TOKEN,
      // Optional: Custom headers
      headers: {
        'X-Client-Version': '1.0.0',
      },
      // Optional: Request timeout (default: 30000ms)
      timeoutMs: 30000,
      // Optional: Reconnection settings
      reconnection: {
        maxReconnectionDelay: 30000,      // Max 30s between retries
        initialReconnectionDelay: 1000,   // Start with 1s delay
        reconnectionDelayGrowFactor: 1.5, // Increase by 1.5x each retry
        maxRetries: 5,                    // Max 5 retry attempts
      },
    },
    autoConnect: true,
    autoReconnect: true,
  });

  // Listen to connection events
  client.on('connected', () => {
    console.log('✓ Connected to remote MCP server');
  });

  client.on('disconnected', () => {
    console.log('✗ Disconnected from MCP server');
  });

  client.on('reconnecting', (attempt) => {
    console.log(`↻ Reconnecting... (attempt ${attempt})`);
  });

  client.on('error', (error) => {
    console.error('Error:', error.message);
  });

  // Connect to MCP server
  console.log('Connecting to remote MCP server...');
  await client.connect();

  console.log(`\nServer capabilities:`, client.capabilities);
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

  // Use the agent with remote MCP tools
  const response = await agent.run('Use the remote server tools to accomplish a task');
  console.log('\nAgent response:', response.output_text);

  // Cleanup
  await client.disconnect();
}

main().catch(console.error);

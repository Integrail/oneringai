/**
 * Multi-Server MCP Example
 *
 * Demonstrates creating multiple MCP clients from one typed configuration.
 */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { Connector, Agent, Vendor, MCPRegistry } from '../../src/index.js';
import type { MCPConfiguration } from '../../src/index.js';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env before running this example.');
  }

  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  const demoServerPath = fileURLToPath(new URL('./demo-server.ts', import.meta.url));

  const config: MCPConfiguration = {
    defaults: { autoReconnect: false },
    servers: [
      {
        name: 'project-demo',
        transport: 'stdio',
        transportConfig: {
          command: process.execPath,
          args: ['--import', 'tsx', demoServerPath, '--label', 'project'],
        },
      },
      {
        name: 'examples-demo',
        transport: 'stdio',
        transportConfig: {
          command: process.execPath,
          args: ['--import', 'tsx', demoServerPath, '--label', 'examples'],
        },
      },
    ],
  };

  const clients = MCPRegistry.createFromConfig(config);
  console.log(`Created ${clients.length} MCP clients`);
  await MCPRegistry.connectAll();

  for (const info of MCPRegistry.getAllInfo()) {
    console.log(`${info.name}: ${info.state} (${info.toolCount} tools)`);
  }

  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
  });

  for (const client of clients) {
    client.registerTools(agent.tools);
    console.log(`Registered ${client.tools.length} tools from '${client.name}'`);
  }

  const response = await agent.run(
    'Read README.md from the project-demo server and summarize its synthetic content in one sentence.',
  );
  console.log('\nAgent response:', response.output_text);

  agent.destroy();
  await MCPRegistry.disconnectAll();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

/**
 * MCP Resources Example
 *
 * Demonstrates using MCP resources and subscriptions.
 */

import { MCPRegistry } from '../../src/index.js';

async function main() {
  // Create MCP client
  const client = MCPRegistry.create({
    name: 'filesystem',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    },
  });

  // Connect
  console.log('Connecting to MCP server...');
  await client.connect();

  // List available resources
  console.log('\nListing resources...');
  const resources = await client.listResources();
  console.log(`Found ${resources.length} resources:`);
  resources.forEach((resource) => {
    console.log(`  - ${resource.name} (${resource.uri})`);
    if (resource.description) {
      console.log(`    ${resource.description}`);
    }
  });

  // Read a resource
  if (resources.length > 0) {
    const resource = resources[0];
    console.log(`\nReading resource: ${resource.name}`);
    const content = await client.readResource(resource.uri);
    console.log(`Content type: ${content.mimeType}`);
    if (content.text) {
      console.log(`Text (first 200 chars):\n${content.text.substring(0, 200)}...`);
    }
  }

  // Subscribe to resource updates (if supported)
  if (client.capabilities?.resources?.subscribe) {
    console.log('\nServer supports resource subscriptions');

    client.on('resource:updated', (uri) => {
      console.log(`Resource updated: ${uri}`);
    });

    if (resources.length > 0) {
      const resource = resources[0];
      console.log(`Subscribing to: ${resource.uri}`);
      await client.subscribeResource(resource.uri);
      console.log('Subscribed! Waiting for updates...');

      // Wait for updates (in a real app, this would be event-driven)
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Unsubscribe
      await client.unsubscribeResource(resource.uri);
      console.log('Unsubscribed');
    }
  }

  // Get prompts
  console.log('\nListing prompts...');
  const prompts = await client.listPrompts();
  console.log(`Found ${prompts.length} prompts:`);
  prompts.forEach((prompt) => {
    console.log(`  - ${prompt.name}: ${prompt.description || 'No description'}`);
    if (prompt.arguments && prompt.arguments.length > 0) {
      console.log(`    Arguments: ${prompt.arguments.map((a) => a.name).join(', ')}`);
    }
  });

  // Get a prompt
  if (prompts.length > 0) {
    const prompt = prompts[0];
    console.log(`\nGetting prompt: ${prompt.name}`);
    const promptResult = await client.getPrompt(prompt.name);
    console.log(`Description: ${promptResult.description}`);
    console.log(`Messages: ${promptResult.messages.length}`);
    promptResult.messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.role}: ${msg.content.type}`);
    });
  }

  // Cleanup
  await client.disconnect();
  console.log('\nDisconnected');
}

main().catch(console.error);

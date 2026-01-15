/**
 * Test Google streaming with tools
 */

import { Connector, Agent, Vendor, tools, isOutputTextDelta, StreamEventType } from '../src/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  Connector.create({
    name: 'google',
    vendor: Vendor.Google,
    auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
  });

  console.log('=== Testing Google Streaming with Tools ===\n');

  const agent = Agent.create({
    connector: 'google',
    model: 'gemini-2.0-flash-exp',
    instructions: 'Use the execute_javascript tool when asked to run code.',
    tools: [tools.executeJavaScript],
  });

  try {
    console.log('User: Calculate 3 + 5 using execute_javascript\n');
    console.log('Assistant: ');

    let eventCount = 0;
    let hasToolCall = false;
    let hasToolExecution = false;
    let finalUsage = null;

    for await (const event of agent.stream('Calculate 3 + 5 using execute_javascript')) {
      eventCount++;

      if (isOutputTextDelta(event)) {
        process.stdout.write(event.delta);
      }

      if (event.type === StreamEventType.TOOL_CALL_START) {
        console.log(`\n\n[Tool detected: ${event.tool_name}]`);
        hasToolCall = true;
      }

      if (event.type === StreamEventType.TOOL_EXECUTION_START) {
        console.log(`[Executing tool: ${event.tool_name}]`);
        hasToolExecution = true;
      }

      if (event.type === StreamEventType.TOOL_EXECUTION_DONE) {
        console.log(`[Tool result: ${JSON.stringify(event.result)}]`);
      }

      if (event.type === StreamEventType.RESPONSE_COMPLETE) {
        finalUsage = event.usage;
        console.log(`\n[Stream complete - Usage: ${event.usage.total_tokens} tokens]`);
      }
    }

    console.log('\n\n=== SUMMARY ===');
    console.log('Total events:', eventCount);
    console.log('Tool call detected:', hasToolCall);
    console.log('Tool executed:', hasToolExecution);
    console.log('Final usage:', finalUsage);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

main();

/**
 * Multi-turn conversation example
 *
 * Demonstrates conversation history management with the new Connector-First API.
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, MessageRole, ContentType } from '../src/index.js';
import type { InputItem } from '../src/index.js';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env before running this example.');
  }

  // Create connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  console.log('🤖 Multi-Turn Conversation Example\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create agent with instructions
  const instructions = 'You are a knowledgeable tour guide. Be informative but concise.';
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
  });

  // Build conversation history
  const conversationHistory: InputItem[] = [];
  let totalTokens = 0;

  // Turn 1: User asks a question
  console.log('👤 User: Tell me about the Eiffel Tower\n');

  conversationHistory.push({
    type: 'message',
    role: MessageRole.USER,
    content: [
      {
        type: ContentType.INPUT_TEXT,
        text: 'Tell me about the Eiffel Tower',
      },
    ],
  });

  const response1 = await agent.runDirect(conversationHistory, { instructions });
  console.log('🤖 Assistant:', response1.output_text);
  console.log('\n─────────────────────────\n');

  // Add assistant response to history
  conversationHistory.push(
    ...response1.output.filter((item): item is InputItem => item.type === 'message' || item.type === 'compaction')
  );
  totalTokens += response1.usage?.total_tokens || 0;

  // Turn 2: User asks a follow-up
  console.log('👤 User: When was it built?\n');

  conversationHistory.push({
    type: 'message',
    role: MessageRole.USER,
    content: [
      {
        type: ContentType.INPUT_TEXT,
        text: 'When was it built?',
      },
    ],
  });

  const response2 = await agent.runDirect(conversationHistory, { instructions });
  console.log('🤖 Assistant:', response2.output_text);
  console.log('\n─────────────────────────\n');

  // Add assistant response to history
  conversationHistory.push(
    ...response2.output.filter((item): item is InputItem => item.type === 'message' || item.type === 'compaction')
  );
  totalTokens += response2.usage?.total_tokens || 0;

  // Turn 3: User asks another follow-up
  console.log('👤 User: How tall is it?\n');

  conversationHistory.push({
    type: 'message',
    role: MessageRole.USER,
    content: [
      {
        type: ContentType.INPUT_TEXT,
        text: 'How tall is it?',
      },
    ],
  });

  const response3 = await agent.runDirect(conversationHistory, { instructions });
  console.log('🤖 Assistant:', response3.output_text);
  totalTokens += response3.usage?.total_tokens || 0;
  conversationHistory.push(
    ...response3.output.filter((item): item is InputItem => item.type === 'message' || item.type === 'compaction')
  );

  console.log('\n\n📊 Conversation Summary');
  console.log('─────────────────────────');
  console.log(`Total user turns: ${conversationHistory.filter((item) => item.type === 'message' && item.role === MessageRole.USER).length}`);
  console.log(`Total tokens used: ${totalTokens}`);

  agent.destroy();
  console.log('\n\n✅ Conversation completed!');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

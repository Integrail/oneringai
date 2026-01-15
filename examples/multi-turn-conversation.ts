/**
 * Multi-turn conversation example
 *
 * Demonstrates conversation history management with the new Connector-First API.
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, InputItem, MessageRole, ContentType } from '../src/index.js';

async function main() {
  // Create connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY || '' },
  });

  console.log('🤖 Multi-Turn Conversation Example\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create agent with instructions
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
    instructions: 'You are a knowledgeable tour guide. Be informative but concise.',
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

  const response1 = await agent.run(conversationHistory);
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

  const response2 = await agent.run(conversationHistory);
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

  const response3 = await agent.run(conversationHistory);
  console.log('🤖 Assistant:', response3.output_text);
  totalTokens += response3.usage?.total_tokens || 0;

  console.log('\n\n📊 Conversation Summary');
  console.log('─────────────────────────');
  console.log(`Total turns: ${conversationHistory.length}`);
  console.log(`Total tokens used: ${totalTokens}`);

  console.log('\n\n✅ Conversation completed!');
}

main().catch(console.error);

/**
 * Multi-turn conversation example
 */

import 'dotenv/config';
import { OneRingAI, InputItem, MessageRole, ContentType } from '../src/index.js';

async function main() {
  const client = new OneRingAI({
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
    },
  });

  console.log('🤖 Multi-Turn Conversation Example\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Build conversation history
  const conversationHistory: InputItem[] = [];

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

  const response1 = await client.text.generateRaw(conversationHistory, {
    provider: 'openai',
    model: 'gpt-4',
    instructions: 'You are a knowledgeable tour guide. Be informative but concise.',
    max_output_tokens: 200,
  });

  console.log('🤖 Assistant:', response1.output_text);
  console.log('\n─────────────────────────\n');

  // Add assistant response to history (filter to only Message types)
  conversationHistory.push(
    ...response1.output.filter((item): item is InputItem => item.type === 'message' || item.type === 'compaction')
  );

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

  const response2 = await client.text.generateRaw(conversationHistory, {
    provider: 'openai',
    model: 'gpt-4',
    instructions: 'You are a knowledgeable tour guide. Be informative but concise.',
  });

  console.log('🤖 Assistant:', response2.output_text);
  console.log('\n─────────────────────────\n');

  // Add assistant response to history (filter to only Message types)
  conversationHistory.push(
    ...response2.output.filter((item): item is InputItem => item.type === 'message' || item.type === 'compaction')
  );

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

  const response3 = await client.text.generateRaw(conversationHistory, {
    provider: 'openai',
    model: 'gpt-4',
    instructions: 'You are a knowledgeable tour guide. Be informative but concise.',
  });

  console.log('🤖 Assistant:', response3.output_text);

  console.log('\n\n📊 Conversation Summary');
  console.log('─────────────────────────');
  console.log(`Total turns: ${conversationHistory.length}`);
  console.log(`Total tokens used: ${response1.usage.total_tokens + response2.usage.total_tokens + response3.usage.total_tokens}`);

  console.log('\n\n✅ Conversation completed!');
}

main().catch(console.error);

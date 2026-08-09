/**
 * Vision / Image Input Example
 *
 * This example demonstrates how to send images to the AI for analysis.
 * Works with GPT-4 Vision models.
 */

import 'dotenv/config';
import {
  Connector,
  Agent,
  Vendor,
  MessageBuilder,
  createMessageWithImages,
  MessageRole,
  ContentType,
} from '../src/index.js';
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

  console.log('🖼️  Vision / Image Input Examples\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ========================================
  // Example 1: Analyze a single image
  // ========================================
  console.log('Example 1: Analyze a Single Image');
  console.log('──────────────────────────────────\n');

  // Public image URL (can also use data URIs)
  // Note: Using a reliable image hosting service that OpenAI can access
  const imageUrl1 = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400';

  const input1 = createMessageWithImages(
    'What do you see in this image? Describe it in detail.',
    [imageUrl1]
  );

  const agent1 = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
  });

  const response1 = await agent1.run([input1]);

  console.log('📸 Image:', imageUrl1);
  console.log('\n🤖 AI Response:');
  console.log(response1.output_text);
  console.log('\n✅ Tokens used:', response1.usage.total_tokens);

  // ========================================
  // Example 2: Compare multiple images
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 2: Compare Multiple Images');
  console.log('──────────────────────────────────\n');

  const imageUrl2 = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400';
  const imageUrl3 = 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400';

  const input2 = createMessageWithImages(
    'What are the similarities and differences between these two images?',
    [imageUrl2, imageUrl3]
  );

  const agent2 = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
  });

  const response2 = await agent2.run([input2]);

  console.log('📸 Image 1:', imageUrl2);
  console.log('📸 Image 2:', imageUrl3);
  console.log('\n🤖 AI Response:');
  console.log(response2.output_text);
  console.log('\n✅ Tokens used:', response2.usage.total_tokens);

  // ========================================
  // Example 3: Using MessageBuilder
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 3: Multi-turn with MessageBuilder');
  console.log('──────────────────────────────────\n');

  const builder = new MessageBuilder();

  // First turn: Ask about an image
  builder.addUserMessageWithImages(
    'What landscape features are visible in this image?',
    [imageUrl1]
  );

  const agent3 = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
  });

  const response3 = await agent3.runDirect(builder.build());

  console.log('📸 Image: [mountain landscape]');
  console.log('👤 User: What landscape features are visible in this image?');
  console.log('\n🤖 Assistant:', response3.output_text);

  // Add assistant response to history
  builder.addAssistantMessage(response3.output_text || '');

  // Second turn: Follow-up question (no image needed)
  builder.addUserMessage('What visual clues suggest the time of day?');

  const response4 = await agent3.runDirect(builder.build());

  console.log('\n👤 User: What visual clues suggest the time of day?');
  console.log('\n🤖 Assistant:', response4.output_text);
  console.log('\n✅ Total tokens used:', response4.usage.total_tokens);

  // ========================================
  // Example 4: Image detail levels
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 4: Image Detail Levels');
  console.log('──────────────────────────────────\n');
  console.log('Note: You can control image detail for token usage:');
  console.log('  - "low": faster and cheaper for broad visual understanding');
  console.log('  - "high": more detail for dense or small visual elements');
  console.log('  - "auto": Model chooses based on image size (default)');

  // Using the raw InputItem structure for fine control
  const inputWithDetailControl: InputItem[] = [
    {
      type: 'message',
      role: MessageRole.USER,
      content: [
        {
          type: ContentType.INPUT_TEXT,
          text: 'Describe this image briefly.',
        },
        {
          type: ContentType.INPUT_IMAGE_URL,
          image_url: {
            url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
            detail: 'low', // Force low detail for faster processing
          },
        },
      ],
    },
  ];

  const agent4 = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
  });

  const response5 = await agent4.run(inputWithDetailControl);

  console.log('\n🤖 AI Response (low detail):');
  console.log(response5.output_text);
  console.log('\n✅ Tokens used:', response5.usage.total_tokens);

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All vision examples completed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 Tips:');
  console.log('  • Use public URLs or base64 data URIs');
  console.log('  • Choose a current model with vision support, such as GPT-4.1 mini');
  console.log('  • Use "low" detail for simple tasks to save tokens');
  console.log('  • Images can be combined with text in any order');
  console.log('  • Works great with the MessageBuilder for conversations');
  agent1.destroy();
  agent2.destroy();
  agent3.destroy();
  agent4.destroy();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

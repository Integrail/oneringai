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
  InputItem,
  MessageRole,
  ContentType,
} from '../src/index.js';

async function main() {
  // Create connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY || '' },
  });

  console.log('🖼️  Vision / Image Input Examples\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ========================================
  // Example 1: Analyze a single image
  // ========================================
  console.log('Example 1: Analyze a Single Image');
  console.log('──────────────────────────────────\n');

  // Public image URL (can also use data URIs)
  const imageUrl1 = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/320px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg';

  const input1 = createMessageWithImages(
    'What do you see in this image? Describe it in detail.',
    [imageUrl1]
  );

  const agent1 = Agent.create({
    connector: 'openai',
    model: 'gpt-4o', // GPT-4 Vision model
    maxOutputTokens: 300,
  });

  const response1 = await agent1.run(input1);

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

  const imageUrl2 = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/320px-Cat03.jpg';
  const imageUrl3 = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/320px-Cat_November_2010-1a.jpg';

  const input2 = createMessageWithImages(
    'What are the similarities and differences between these two images?',
    [imageUrl2, imageUrl3]
  );

  const agent2 = Agent.create({
    connector: 'openai',
    model: 'gpt-4o',
    maxOutputTokens: 300,
  });

  const response2 = await agent2.run(input2);

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
    'What architectural style is this building?',
    ['https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Eiffel_Tower_2022_11_9.jpg/320px-Eiffel_Tower_2022_11_9.jpg']
  );

  const agent3 = Agent.create({
    connector: 'openai',
    model: 'gpt-4o',
    maxOutputTokens: 200,
  });

  const response3 = await agent3.run(builder.build());

  console.log('📸 Image: [Eiffel Tower]');
  console.log('👤 User: What architectural style is this building?');
  console.log('\n🤖 Assistant:', response3.output_text);

  // Add assistant response to history
  builder.addAssistantMessage(response3.output_text || '');

  // Second turn: Follow-up question (no image needed)
  builder.addUserMessage('When was it built?');

  const response4 = await agent3.run(builder.build());

  console.log('\n👤 User: When was it built?');
  console.log('\n🤖 Assistant:', response4.output_text);
  console.log('\n✅ Total tokens used:', response4.usage.total_tokens);

  // ========================================
  // Example 4: Image detail levels
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Example 4: Image Detail Levels');
  console.log('──────────────────────────────────\n');
  console.log('Note: You can control image detail for token usage:');
  console.log('  - "low": ~85 tokens per image (faster, cheaper)');
  console.log('  - "high": ~170-340 tokens per image (more detail)');
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
            url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/320px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg',
            detail: 'low', // Force low detail for faster processing
          },
        },
      ],
    },
  ];

  const agent4 = Agent.create({
    connector: 'openai',
    model: 'gpt-4o',
    maxOutputTokens: 150,
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
  console.log('  • GPT-4o is faster and cheaper than GPT-4 Vision');
  console.log('  • Use "low" detail for simple tasks to save tokens');
  console.log('  • Images can be combined with text in any order');
  console.log('  • Works great with the MessageBuilder for conversations');
}

main().catch(console.error);

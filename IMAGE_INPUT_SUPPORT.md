# Image Input Support

## Summary

✅ **Image input (vision) is fully supported!**

The library now has complete support for sending images to vision-capable AI models (like GPT-4 Vision/GPT-4o) for analysis.

## What Was Added

### 1. **Helper Utilities** (`src/utils/messageBuilder.ts`)

Two convenient ways to work with images:

#### **MessageBuilder Class**
Fluent API for building complex messages:

```typescript
import { MessageBuilder } from '@oneringai/agents';

const builder = new MessageBuilder();

// Add message with images
builder.addUserMessageWithImages(
  'What do you see in these images?',
  ['https://example.com/img1.jpg', 'https://example.com/img2.jpg']
);

// Add follow-up without images
builder.addUserMessage('Can you compare them?');

const messages = builder.build();
```

#### **Helper Functions**
Quick one-liners:

```typescript
import { createMessageWithImages } from '@oneringai/agents';

const input = createMessageWithImages(
  'Describe this image',
  ['https://example.com/image.jpg']
);
```

### 2. **Complete Vision Example** (`examples/vision-image-input.ts`)

Demonstrates:
- ✅ Single image analysis
- ✅ Multi-image comparison
- ✅ Multi-turn conversations with images
- ✅ Image detail control (low/high/auto)
- ✅ Using MessageBuilder
- ✅ Using helper functions
- ✅ Raw InputItem construction

**Run it:**
```bash
npm run example:vision
```

### 3. **Updated Documentation**
- README.md - Vision examples added
- EXAMPLES.md - Full vision example documentation
- Exports from main index.ts

## How It Works (Technical)

### Infrastructure Level
Image support was **already implemented** in:
- `InputImageContent` type definition (Content.ts)
- OpenAI provider converter (OpenAITextProvider.ts)
- Proper type conversions

### What We Added
User-friendly **API layer** on top:
1. **MessageBuilder** - High-level API for complex inputs
2. **Helper functions** - Quick utilities for common cases
3. **Examples** - Show best practices
4. **Documentation** - Make it discoverable

## Usage Examples

### Basic Image Analysis

```typescript
import { OneRingAI, createMessageWithImages } from '@oneringai/agents';

const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY }
  }
});

const input = createMessageWithImages(
  'What is in this image?',
  ['https://example.com/photo.jpg']
);

const response = await client.text.generateRaw([input], {
  provider: 'openai',
  model: 'gpt-4o'  // or 'gpt-4-vision-preview'
});

console.log(response.output_text);
```

### Multi-Turn Conversation with Images

```typescript
import { MessageBuilder } from '@oneringai/agents';

const builder = new MessageBuilder();

// Turn 1: Ask about image
builder.addUserMessageWithImages(
  'What style is this building?',
  ['https://example.com/building.jpg']
);

let response = await client.text.generateRaw(builder.build(), {
  provider: 'openai',
  model: 'gpt-4o'
});

// Add response to history
builder.addAssistantMessage(response.output_text || '');

// Turn 2: Follow-up (no image needed)
builder.addUserMessage('When was it built?');

response = await client.text.generateRaw(builder.build(), {
  provider: 'openai',
  model: 'gpt-4o'
});
```

### Control Image Detail for Token Optimization

```typescript
import { InputItem, MessageRole, ContentType } from '@oneringai/agents';

// Fine-grained control
const input: InputItem[] = [{
  type: 'message',
  role: MessageRole.USER,
  content: [
    { type: ContentType.INPUT_TEXT, text: 'Describe this' },
    {
      type: ContentType.INPUT_IMAGE_URL,
      image_url: {
        url: 'https://example.com/image.jpg',
        detail: 'low'  // 'low', 'high', or 'auto'
      }
    }
  ]
}];
```

**Detail levels:**
- `low`: ~85 tokens per image (faster, cheaper)
- `high`: ~170-340 tokens per image (more detailed analysis)
- `auto`: Model chooses based on image size (default)

### Compare Multiple Images

```typescript
const input = createMessageWithImages(
  'What are the differences between these?',
  [
    'https://example.com/before.jpg',
    'https://example.com/after.jpg'
  ]
);
```

## Supported Models

### OpenAI
- ✅ `gpt-4o` (recommended - faster, cheaper)
- ✅ `gpt-4o-mini`
- ✅ `gpt-4-turbo`
- ✅ `gpt-4-vision-preview` (legacy)

### Other Providers
- 🚧 Anthropic Claude (Claude 3+ supports vision - converter needed)
- 🚧 Google Gemini (supports vision - converter needed)

## Image Format Support

### URLs
```typescript
'https://example.com/image.jpg'
'https://example.com/image.png'
'https://example.com/image.gif'
'https://example.com/image.webp'
```

### Data URIs (Base64)
```typescript
'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
'data:image/png;base64,iVBORw0KGgo...'
```

### File Uploads
For local files, convert to base64:
```typescript
import fs from 'fs';

const imageBuffer = fs.readFileSync('path/to/image.jpg');
const base64Image = imageBuffer.toString('base64');
const dataUri = `data:image/jpeg;base64,${base64Image}`;

const input = createMessageWithImages('Analyze this', [dataUri]);
```

## Best Practices

### 1. **Use Appropriate Detail Level**
```typescript
// For simple tasks (object detection, text extraction)
detail: 'low'  // Saves ~50% tokens

// For detailed analysis (fine details, complex scenes)
detail: 'high'

// Let model decide
detail: 'auto'  // Default
```

### 2. **Optimize Image Size**
- Max size: 20MB per image
- Recommended: < 2MB for faster processing
- Resize large images before uploading

### 3. **Choose the Right Model**
```typescript
// Best value (recommended)
model: 'gpt-4o'  // Fast, cheap, great quality

// Cheaper option
model: 'gpt-4o-mini'  // Even cheaper, slightly lower quality

// Legacy
model: 'gpt-4-vision-preview'  // Slower, more expensive
```

### 4. **Batch Multiple Images**
```typescript
// ✅ Good - Single request for multiple images
createMessageWithImages('Compare these', [img1, img2, img3])

// ❌ Less efficient - Multiple requests
// Don't split into separate requests
```

## Token Usage

Image tokens depend on:
- Image dimensions
- Detail level setting
- Number of images

**Approximate costs per image:**
- Low detail: ~85 tokens
- High detail: ~170-340 tokens (depends on size)
- Auto: Varies based on image

**Example:**
- Text: "Describe this image" = ~4 tokens
- Image (low detail): ~85 tokens
- Response: ~100 tokens
- **Total: ~189 tokens**

## Limitations

### Current Limitations
- ❌ Video analysis (not yet supported by providers)
- ❌ Audio files as image alternative (use transcription instead)
- ❌ Direct file upload (must use URLs or data URIs)

### Provider Limitations
- Max images per request varies by provider
- OpenAI: Up to ~10 images recommended
- Token limits still apply (images count toward context)

## Troubleshooting

### "Model does not support vision"
Use a vision-capable model:
```typescript
model: 'gpt-4o'  // ✅
model: 'gpt-3.5-turbo'  // ❌ No vision
```

### "Image URL not accessible"
Ensure:
- URL is publicly accessible
- HTTPS (not HTTP for some providers)
- Image format is supported
- File size is under limit

### "Token limit exceeded"
- Reduce image size
- Use `detail: 'low'`
- Reduce number of images
- Use shorter text prompts

### High costs
- Switch to `gpt-4o` or `gpt-4o-mini`
- Use `detail: 'low'` setting
- Resize images before sending
- Cache results for repeated queries

## Next Steps

Try the vision example:
```bash
npm run example:vision
```

Integrate into your app:
```typescript
import { OneRingAI, createMessageWithImages } from '@oneringai/agents';
// Start building!
```

---

**Added in version**: 0.1.0
**Last updated**: 2025-01-05

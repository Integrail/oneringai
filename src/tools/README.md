# Tool Library

Pre-built tools for use with AI agents in `@oneringai/agents`.

## Overview

This library provides production-ready tools that agents can use to perform common tasks. Tools are designed with clear, LLM-friendly descriptions to help agents understand how to use them effectively.

## Usage

```typescript
import { OneRingAI, tools } from '@oneringai/agents';

const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY }
  }
});

const agent = client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  tools: [tools.jsonManipulator],  // Use pre-built tools
  instructions: 'You are a helpful assistant with JSON manipulation capabilities.'
});

const response = await agent.run('Delete the email field from this object: {"name": "John", "email": "j@ex.com"}');
```

## Available Tools

### JSON Manipulator

**Name**: `tools.jsonManipulator`

**Purpose**: Manipulate JSON objects using dot notation paths

**Operations**:
1. **delete** - Remove a field
2. **add** - Add a new field (creates intermediate objects if needed)
3. **replace** - Change value of existing field

**Path Format** (Dot Notation):
- `name` - Top-level field
- `user.email` - Nested field
- `users.0.name` - Array element (0 is index)
- `settings.theme.colors.primary` - Deep nesting

**Examples**:

```typescript
// Delete a field
const agent = client.agents.create({
  tools: [tools.jsonManipulator]
});

await agent.run(`
Remove the email from this user:
${JSON.stringify({ name: 'John', email: 'john@example.com', age: 30 })}
`);
// Agent calls: json_manipulate({ operation: 'delete', path: 'email', object: {...} })
// Result: { name: 'John', age: 30 }


// Add nested field
await agent.run(`
Add a city field to user.address with value "Paris":
${JSON.stringify({ user: { name: 'John' } })}
`);
// Agent calls: json_manipulate({ operation: 'add', path: 'user.address.city', value: 'Paris', object: {...} })
// Result: { user: { name: 'John', address: { city: 'Paris' } } }


// Replace array element
await agent.run(`
Change the first user's name to "Alice":
${JSON.stringify({ users: [{ name: 'Bob' }, { name: 'Charlie' }] })}
`);
// Agent calls: json_manipulate({ operation: 'replace', path: 'users.0.name', value: 'Alice', object: {...} })
// Result: { users: [{ name: 'Alice' }, { name: 'Charlie' }] }
```

**Result Format**:
```typescript
{
  success: boolean,
  result: any | null,        // Modified object if success=true
  message?: string,          // Success message
  error?: string             // Error description if success=false
}
```

## Adding New Tools

### Step 1: Create the Tool

Create a new file in an appropriate directory:

```typescript
// src/tools/web/webScraper.ts

import { ToolFunction } from '../../domain/entities/Tool.js';

export const webScraper: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'web_scrape',
      description: 'Scrape content from a web page...',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to scrape' }
        },
        required: ['url']
      }
    }
  },
  execute: async (args) => {
    // Implementation
    return { content: '...' };
  }
};
```

### Step 2: Export from `src/tools/index.ts`

```typescript
export { jsonManipulator } from './json/jsonManipulator.js';
export { webScraper } from './web/webScraper.js';  // Add your tool
```

### Step 3: Document and Test

- Add usage examples
- Write unit tests
- Update this README

## Best Practices for Tool Design

### 1. Clear Descriptions

Write descriptions that explain:
- What the tool does
- How to use it (with examples)
- Parameter formats and requirements
- Return value format

### 2. Error Handling

Always return structured results:
```typescript
{
  success: boolean,
  result: any,
  message?: string,
  error?: string
}
```

### 3. Validation

Validate inputs and provide helpful error messages:
```typescript
if (!args.url) {
  return { success: false, error: 'URL is required' };
}

if (!args.url.startsWith('http')) {
  return { success: false, error: 'URL must start with http:// or https://' };
}
```

### 4. Examples in Description

Include concrete examples in the tool description to help the LLM understand usage.

## Tool Categories

Potential tool categories to organize:

- **json/** - JSON manipulation
- **web/** - Web scraping, HTTP requests
- **file/** - File operations
- **code/** - Code execution, analysis
- **data/** - Data transformation, validation
- **text/** - Text processing, parsing
- **image/** - Image processing (resize, convert)

## See Also

- **Main README**: Usage guide for the library
- **Examples**: `examples/json-manipulation-tool.ts`
- **API Reference**: Tool types in `src/domain/entities/Tool.ts`

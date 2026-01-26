# MCP Integration Tests

This directory contains integration tests for the MCP (Model Context Protocol) client implementation.

## Running the Tests

### Prerequisites

1. Install the required MCP servers:
```bash
npm install -D @modelcontextprotocol/server-filesystem
```

2. For HTTP tests, set up a test server (optional):
```bash
# Set the environment variable to your test server URL
export MCP_TEST_SERVER_URL=http://localhost:3000/mcp
```

### Running All Tests

```bash
npm test
```

### Running Only MCP Tests

```bash
# Unit tests only
npm test tests/unit/mcp

# Integration tests only
npm test tests/integration/mcp

# Specific test file
npm test tests/integration/mcp/MCPStdio.integration.test.ts
```

## Test Files

### Unit Tests (`tests/unit/mcp/`)

- **MCPRegistry.test.ts** - Tests for the MCPRegistry static registry
- **MCPToolAdapter.test.ts** - Tests for MCP tool to ToolFunction adapter

### Integration Tests (`tests/integration/mcp/`)

- **MCPStdio.integration.test.ts** - Tests stdio transport with filesystem server
- **MCPHTTP.integration.test.ts** - Tests HTTP/HTTPS transport (requires test server)

## Setting Up a Test MCP Server

### Option 1: Using the Filesystem Server (Stdio)

The stdio integration tests use the official filesystem server:

```bash
npx -y @modelcontextprotocol/server-filesystem /path/to/test/directory
```

### Option 2: Setting Up an HTTP Test Server

You can create a simple HTTP MCP server for testing:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

const app = express();
const server = new Server({
  name: 'test-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Add a test tool
server.setRequestHandler({ method: 'tools/list' }, async () => ({
  tools: [{
    name: 'echo',
    description: 'Echo back the input',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  }],
}));

server.setRequestHandler({ method: 'tools/call' }, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === 'echo') {
    return {
      content: [{ type: 'text', text: args.message }],
    };
  }
  throw new Error('Tool not found');
});

const transport = new StreamableHTTPServerTransport('/mcp', server);
app.use('/mcp', transport.handler);

app.listen(3000, () => {
  console.log('Test MCP server running on http://localhost:3000/mcp');
});
```

Then run the HTTP integration tests:

```bash
MCP_TEST_SERVER_URL=http://localhost:3000/mcp npm test tests/integration/mcp/MCPHTTP.integration.test.ts
```

## Test Coverage

The tests cover:

- ✅ Client creation and registration
- ✅ Connection lifecycle (connect, disconnect, reconnect)
- ✅ Tool discovery and execution
- ✅ Tool registration with agents
- ✅ Event emission
- ✅ Error handling
- ✅ Configuration validation
- ✅ Stdio transport
- ✅ HTTP/HTTPS transport
- ✅ Session management
- ✅ Auto-reconnection

## CI/CD Considerations

For CI environments:

1. **Stdio tests** will run automatically (uses npx to install server on-demand)
2. **HTTP tests** will be skipped unless `MCP_TEST_SERVER_URL` is set
3. Tests have generous timeouts to account for npm package installation

To enable HTTP tests in CI, either:
- Set up a test MCP server in a docker container
- Use a mock HTTP server
- Skip HTTP tests in CI (they're optional)

## Troubleshooting

### "npx: command not found"

Install npm/npx:
```bash
npm install -g npm
```

### Timeout Errors

The stdio tests may take longer on first run (npm installs packages). Subsequent runs will be faster.

### HTTP Tests Always Skip

Set the environment variable:
```bash
export MCP_TEST_SERVER_URL=http://localhost:3000/mcp
```

Or check that your test server is running and accessible.

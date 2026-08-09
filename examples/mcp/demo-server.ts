/**
 * Small local MCP stdio server used by the MCP client examples.
 *
 * It exposes synthetic files, one resource, and one prompt, so the examples
 * never grant an external process access to the repository filesystem.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const labelFlagIndex = process.argv.indexOf('--label');
const label = labelFlagIndex >= 0 ? process.argv[labelFlagIndex + 1] || 'demo' : 'demo';
const files: Record<string, string> = {
  'README.md': `# ${label}\n\nThis is synthetic content served by the local OneRingAI MCP demo server.`,
  'notes.txt': `Notes from the ${label} demo server.`,
};

const server = new McpServer({ name: `oneringai-${label}-demo`, version: '1.0.0' });

server.registerTool(
  'list_demo_files',
  { description: 'List the synthetic files available on this demo server.' },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(Object.keys(files)) }],
  }),
);

server.registerTool(
  'read_demo_file',
  {
    description: 'Read a synthetic demo file by name.',
    inputSchema: { name: z.string().describe('File name returned by list_demo_files') },
  },
  async ({ name }) => ({
    content: files[name]
      ? [{ type: 'text', text: files[name] }]
      : [{ type: 'text', text: `Unknown demo file: ${name}` }],
    isError: !files[name],
  }),
);

server.registerResource(
  'demo-readme',
  `demo://${label}/readme`,
  { description: 'Synthetic README resource', mimeType: 'text/markdown' },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: files['README.md']! }],
  }),
);

server.registerPrompt(
  'summarize-demo',
  { description: 'Ask an assistant to summarize the synthetic demo README.' },
  async () => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Summarize this text in one sentence:\n\n${files['README.md']}` },
    }],
  }),
);

await server.connect(new StdioServerTransport());

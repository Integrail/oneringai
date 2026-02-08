import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'shared/index': 'src/shared/index.ts',
    'capabilities/agents/index': 'src/capabilities/agents/index.ts',
    'capabilities/images/index': 'src/capabilities/images/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'node18',
  outDir: 'dist',
  external: [
    'puppeteer', // Optional dependency - don't bundle
  ],
  // Bundle MCP SDK to avoid subpath import resolution issues in Meteor
  noExternal: [
    '@modelcontextprotocol/sdk',
  ],
});

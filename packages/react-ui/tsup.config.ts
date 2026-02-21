import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@everworker/oneringai'],
  // Use esbuild for JSX (not SWC) to avoid @swc/helpers runtime dependency
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  noExternal: ['@swc/helpers'],
  async onSuccess() {
    // Copy CSS to dist
    const fs = await import('fs');
    const path = await import('path');
    const src = path.resolve('src/look-inside/look-inside.css');
    const dest = path.resolve('dist/look-inside.css');
    fs.copyFileSync(src, dest);
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      // Optional peer deps from @everworker/react-ui — loaded via dynamic import()
      // and may not be installed. Externalize so Rollup doesn't fail on them.
      external: ['mermaid', 'markmap-lib', 'markmap-view', 'react-vega', 'vega-lite'],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  // Pre-bundle optional peer deps from @everworker/react-ui so Vite can
  // resolve their dynamic imports (import("mermaid") etc.) in dev mode.
  optimizeDeps: {
    include: ['mermaid', 'markmap-lib', 'markmap-view', 'react-vega', 'vega-lite'],
  },
});

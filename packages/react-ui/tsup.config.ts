import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'react', 'react-dom', '@everworker/oneringai',
    // Peer dependencies — externalize so consumers provide them
    'react-markdown', 'remark-gfm', 'remark-math', 'rehype-katex', 'katex',
    'react-syntax-highlighter', 'react-syntax-highlighter/dist/esm/styles/prism',
    'lucide-react',
    // Optional peer dependencies
    'mermaid', 'react-vega', 'vega-lite', 'markmap-lib', 'markmap-view',
    'react-bootstrap', 'react-bootstrap-icons',
  ],
  // Use esbuild for JSX (not SWC) to avoid @swc/helpers runtime dependency
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  noExternal: ['@swc/helpers'],
  async onSuccess() {
    // Copy CSS files to dist
    const fs = await import('fs');
    const path = await import('path');

    const cssFiles = [
      { src: 'src/look-inside/look-inside.css', dest: 'dist/look-inside.css' },
      { src: 'src/markdown/markdown.css', dest: 'dist/markdown.css' },
      { src: 'src/chat/chat.css', dest: 'dist/chat.css' },
      { src: 'src/chat/thinking.css', dest: 'dist/thinking.css' },
    ];

    for (const { src, dest } of cssFiles) {
      const srcPath = path.resolve(src);
      const destPath = path.resolve(dest);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Core's preview page: the real renderer, served by Core at /preview/ (copied by scripts/copy-to-core.mjs).
export default defineConfig({
  base: '/preview/',
  plugins: [react()],
  build: {
    outDir: 'dist-preview',
    emptyOutDir: true,
    rollupOptions: { input: 'preview.html' },
  },
});

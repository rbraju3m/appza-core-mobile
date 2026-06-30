import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for @appza/mobile.
 *
 * Build output goes to dist/. Capacitor's `webDir` in capacitor.config.ts
 * points at this folder so `cap sync` copies the bundle into the native
 * Android / iOS shell. During development, `pnpm dev` runs a local server
 * that the native app can hot-load via Capacitor's livereload.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5175,
    host: '127.0.0.1',
  },
});

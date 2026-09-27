import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for @appza/mobile.
 *
 * Build output goes to dist/. Capacitor's `webDir` in capacitor.config.ts
 * points at this folder so `cap sync` copies the bundle into the native
 * Android / iOS shell. During development, `pnpm dev` runs a local server
 * that the native app can hot-load via Capacitor's livereload.
 */
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const url = loadEnv(mode, process.cwd(), 'VITE_').VITE_APPZA_SITE_URL ?? '';
    if (!url.startsWith('https://') && !(url.startsWith('http://') && process.env.APPZA_ALLOW_HTTP === '1')) {
      throw new Error(`VITE_APPZA_SITE_URL must be an https URL for a build (got "${url}"); APPZA_ALLOW_HTTP=1 allows http for local testing.`);
    }
  }
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 5175,
      host: '127.0.0.1',
    },
  };
});

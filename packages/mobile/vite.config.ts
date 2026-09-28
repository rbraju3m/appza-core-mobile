import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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

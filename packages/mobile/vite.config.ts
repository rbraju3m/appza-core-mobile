import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const url = env.VITE_APPZA_SITE_URL ?? '';
    // The demo build has no site: it is connected at run time.
    if (env.VITE_APPZA_DEMO !== '1' && !url.startsWith('https://') && !(url.startsWith('http://') && process.env.APPZA_ALLOW_HTTP === '1')) {
      throw new Error(`VITE_APPZA_SITE_URL must be an https URL for a build (got "${url}"); APPZA_ALLOW_HTTP=1 allows http for local testing.`);
    }
  }
  // APPZA_RELEASE=1 (scripts/android-release.sh): maps kept out of the bundle, log noise stripped.
  const release = process.env.APPZA_RELEASE === '1';
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: release ? 'hidden' : true,
    },
    esbuild: release ? { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'] } : {},
    server: {
      port: 5175,
      host: '127.0.0.1',
    },
  };
});

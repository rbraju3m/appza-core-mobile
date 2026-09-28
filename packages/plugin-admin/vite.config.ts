import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxies /wp-json/* to ?rest_route= (Apache here doesn't route /wp-json); the plug-in build's manifest.json is read by PHP to find hashed entries.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/wp-content/plugins/appza-core-2.0/assets/admin/' : '/',
  plugins: [react()],
  build: {
    manifest: true,
    assetsDir: '',
  },
  server: {
    port: 5174,
    host: '127.0.0.1',
    proxy: {
      '/wp-json': {
        target: 'http://localhost/wordpress-project/tutor-lms-mobile',
        changeOrigin: true,
        rewrite: (path) => {
          const queryIdx = path.indexOf('?');
          const pathname = queryIdx === -1 ? path : path.slice(0, queryIdx);
          const query = queryIdx === -1 ? '' : path.slice(queryIdx + 1);
          const restRoute = pathname.replace(/^\/wp-json/, '');
          const params = new URLSearchParams(query);
          params.set('rest_route', restRoute);
          return `/index.php?${params.toString()}`;
        },
      },
    },
  },
}));

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite proxy targets the local WP install that hosts the appza-core-2.0
 * plug-in. The proxy lets the React dev server at localhost:5174 call
 * /wp-json/appza/v1/bootstrap without CORS friction.
 *
 * Apache on this dev box doesn't rewrite /wp-json/* through WP's
 * front-controller (no .htaccess / AllowOverride). To keep app code
 * using the canonical /wp-json/* shape, the proxy rewrites to the
 * query-form REST URL (?rest_route=/...) that works on a plain install.
 * Production targets (real WP with pretty permalinks) won't need this
 * rewrite — it's dev-environment-specific.
 */
export default defineConfig({
  plugins: [react()],
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
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Two run modes:
 *
 * 1. Dev (`vite` / `pnpm dev`)
 *    - Served standalone at http://127.0.0.1:5174
 *    - /wp-json/* proxied to the local WP install. Apache on this box
 *      doesn't pass /wp-json/* through to WP's front-controller, so the
 *      proxy rewrites to the query-form REST URL (?rest_route=/...) that
 *      works on plain-permalink installs.
 *
 * 2. Plug-in build (`vite build` — driven by `pnpm build:plugin`)
 *    - Output goes to packages/plugin-admin/dist, then the copy script
 *      drops it into the appza-core-2.0 plug-in's assets/admin/.
 *    - `base` set to the plug-in URL so hashed asset references inside
 *      the bundle resolve under WordPress.
 *    - `manifest: true` emits dist/manifest.json — the plug-in PHP reads
 *      this to discover the hashed entry filenames at enqueue time.
 */
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

import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for @appza/mobile.
 *
 * The `webDir` is the Vite build output. `cap sync` copies it into
 * android/app/src/main/assets/public so the native shell loads the
 * same SPA the WP-admin simulator runs.
 *
 * Production builds: serve from the bundled assets (default).
 * Dev livereload: set `server.url` to the host's IP + Vite port
 * (5175) so the device picks up changes without a rebuild.
 */
const config: CapacitorConfig = {
  appId: 'net.appza.app',
  appName: 'APPZA',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    // WebView origin is https://localhost. Feed items reference images
    // over http:// (WP's siteurl is http). Without this, Android's
    // WebView treats every http:// image as blocked mixed content and
    // silently drops it. Combined with AndroidManifest's
    // usesCleartextTraffic="true" this lets media load.
    // Release builds are https-only; set APPZA_ALLOW_MIXED_CONTENT=1 at `cap sync` for LAN dev.
    allowMixedContent: process.env.APPZA_ALLOW_MIXED_CONTENT === '1',
  },
};

export default config;

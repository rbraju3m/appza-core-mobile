import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.appza.app',
  appName: 'APPZA',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    // Media is served over http while the WebView origin is https://localhost; release builds stay https-only.
    allowMixedContent: process.env.APPZA_ALLOW_MIXED_CONTENT === '1',
  },
};

export default config;

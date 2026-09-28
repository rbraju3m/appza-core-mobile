#!/usr/bin/env node
// Destination overridable via APPZA_PLUGIN_DIR.
import { existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_PLUGIN_DIR =
  '/var/www/html/wordpress-project/tutor-lms-mobile/wp-content/plugins/appza-core-2.0';

const pluginDir = process.env.APPZA_PLUGIN_DIR ?? DEFAULT_PLUGIN_DIR;
const src = resolve(process.cwd(), 'dist');
const dest = resolve(pluginDir, 'assets/admin');

if (!existsSync(src)) {
  console.error(`[copy-to-plugin] No build output at ${src}. Run vite build first.`);
  process.exit(1);
}
if (!existsSync(pluginDir)) {
  console.error(`[copy-to-plugin] Plug-in dir not found: ${pluginDir}`);
  console.error('  Set APPZA_PLUGIN_DIR if your plug-in lives elsewhere.');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log(`[copy-to-plugin] Synced ${src} -> ${dest}`);

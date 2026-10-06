#!/usr/bin/env node
// Destination overridable via APPZA_CORE_DIR.
import { existsSync, mkdirSync, rmSync, cpSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

const coreDir = process.env.APPZA_CORE_DIR ?? '/var/www/html/appza-core-2.0';
const src = resolve(process.cwd(), 'dist-preview');
const dest = resolve(coreDir, 'public/preview');

if (!existsSync(resolve(src, 'preview.html'))) {
  console.error(`[copy-to-core] No build output at ${src}. Run the preview build first.`);
  process.exit(1);
}
if (!existsSync(resolve(coreDir, 'public'))) {
  console.error(`[copy-to-core] Core not found: ${coreDir} (set APPZA_CORE_DIR).`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
renameSync(resolve(dest, 'preview.html'), resolve(dest, 'index.html'));

console.log(`[copy-to-core] Synced ${src} -> ${dest}`);

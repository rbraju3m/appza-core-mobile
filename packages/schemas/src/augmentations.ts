import type { AppzaCoreConfig } from './coreConfig';

/**
 * Global `Window['appzaCoreConfig']` augmentation. Any package that
 * imports from `@appza/schemas` picks this up automatically — no need
 * for per-file `declare global` blocks that drift out of sync.
 *
 * This file has side-effect-only imports; keep it re-exported from the
 * package index so consumers pull it in for free.
 */
declare global {
  interface Window {
    appzaCoreConfig?: AppzaCoreConfig;
  }
}

export {};

import type { AppzaCoreConfig } from './coreConfig';

declare global {
  interface Window {
    appzaCoreConfig?: AppzaCoreConfig;
  }
}

export {};

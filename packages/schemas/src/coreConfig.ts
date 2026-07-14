/**
 * Shape of `window.appzaCoreConfig` — the runtime handshake between the
 * WP plug-in bootloader and the JS surfaces that consume it (renderer,
 * plugin-admin simulator, Capacitor mobile shell).
 *
 * WP admin localizes the object via `wp_add_inline_script`; the mobile
 * shell writes it directly in-code. Every field is optional because the
 * plug-in sends only the endpoints/nonce it decides to expose, and the
 * mobile shell writes a narrower subset.
 *
 * All consumers use the same declared shape via a shared `declare global`
 * augmentation (see `augmentations.ts`) — no per-file re-declaration.
 */
export type PreviewMode = 'auto' | 'demo' | 'real';

export type AppzaCoreConfig = {
  endpoints?: {
    bootstrap?: string;
    customizations?: string;
    previewProxy?: string;
    syncFromCore?: string;
    sourceIntegrations?: string;
    activeSourceIntegrations?: string;
    templates?: string;
  };
  restNonce?: string;
  defaultTemplate?: string;
  assetsBase?: string;
  previewMode?: PreviewMode;
};

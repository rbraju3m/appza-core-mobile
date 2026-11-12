export type PreviewMode = 'auto' | 'demo' | 'real';

export type AppzaCoreConfig = {
  endpoints?: {
    bootstrap?: string;
    customizations?: string;
    designIndex?: string;
    previewProxy?: string;
    syncFromCore?: string;
    sourceIntegrations?: string;
    activeSourceIntegrations?: string;
    templates?: string;
    buildRequests?: string;
    /** Friendly v2 P2: the site's remembered template, the builder tour, the wizard's connect step. */
    siteTemplate?: string;
    tourSeen?: string;
    introHidden?: string;
    coreConnection?: string;
    /** v1 parity P1c: the app's name, icon and splash. */
    appIdentity?: string;
    syncPage?: string;
    /** Friendly v2 P5: the "Viewing as" switch, and core's route that revokes Me's application password. */
    previewViewer?: string;
    previewViewerMe?: string;
    appPasswords?: string;
  };
  restNonce?: string;
  defaultTemplate?: string;
  /** wp_localize_script sends booleans as "1" / "". */
  templateSaved?: boolean | string;
  tourSeen?: boolean | string;
  /** P1e: this user ticked "Don't show this again" on the builder's opening modal. */
  introHidden?: boolean | string;
  /** P1b: the builder's tutorial video (an embed address), or "" when Core has none. */
  tutorialVideoUrl?: string | null;
  /** P1e: the demo app's store pages, "" when Core has none. */
  demoApp?: { playStoreUrl?: string | null; appStoreUrl?: string | null };
  /** P1c: the app's name, icon and splash as saved (ids are media-library attachments; 0 = none). */
  appIdentity?: {
    name?: string;
    icon_id?: number;
    icon_url?: string;
    splash_id?: number;
    splash_url?: string;
    splash_background?: string;
    saved?: boolean | string;
  };
  assetsBase?: string;
  previewMode?: PreviewMode;
  siteUrl?: string;
};

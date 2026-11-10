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
    coreConnection?: string;
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
  assetsBase?: string;
  previewMode?: PreviewMode;
  siteUrl?: string;
};

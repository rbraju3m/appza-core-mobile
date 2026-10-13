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
  };
  restNonce?: string;
  defaultTemplate?: string;
  assetsBase?: string;
  previewMode?: PreviewMode;
  siteUrl?: string;
};

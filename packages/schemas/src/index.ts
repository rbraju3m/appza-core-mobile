export { BootstrapEnvelopeSchema, type BootstrapEnvelope } from './bootstrap';
export {
  CatalogSchema,
  AppSurfaceSchema,
  type Catalog,
  type Template,
  type TemplateScreen,
  type AppSurface,
  type AppZet,
  type Superstructure,
  type SourceIntegration,
  type AppMap,
  type PropertiesSchemaEntry,
  type GridLayout,
} from './catalog';
export { LayoutStyleSchema, type LayoutStyle } from './layoutStyle';
export { type AppzaCoreConfig, type PreviewMode } from './coreConfig';
export { DEMO_CONNECT_SCHEME, demoConnectLink, parseSiteAddress } from './demoConnect';
// Side-effect import: the global `Window.appzaCoreConfig` augmentation.
import './augmentations';

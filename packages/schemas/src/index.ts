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
} from './catalog';
export { LayoutStyleSchema, type LayoutStyle } from './layoutStyle';
export { type AppzaCoreConfig, type PreviewMode } from './coreConfig';
// Side-effect import — augments the global `Window` type with
// `appzaCoreConfig?: AppzaCoreConfig`. Consumers get it for free.
import './augmentations';

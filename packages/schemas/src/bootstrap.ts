import { z } from 'zod';

import { CatalogSchema } from './catalog';

/**
 * Bootstrap envelope — what GET /wp-json/appza/v1/bootstrap returns.
 *
 * Wire format produced by the appza-core-2.0 WP plug-in's bootstrap
 * controller. The `catalog` payload is the inner snapshot the plug-in
 * pulled from the Core via /api/v1/catalog/snapshot. Versioning per
 * DC#13 Q5 + DC#15 Q1.
 *
 * `catalog` is typed against CatalogSchema (typed row shapes for the
 * tables the simulator + renderer read). `customizations` and
 * `runtime_config` stay permissive — they'll get their own typed
 * schemas alongside the JWT slice (1B.6) and customizations admin
 * slice (1B.5).
 */
export const BootstrapEnvelopeSchema = z.object({
  schema_version: z.string(),
  catalog_snapshot_version: z.number().int().nonnegative(),
  customizations_version: z.number().int().nonnegative(),
  catalog: CatalogSchema,
  customizations: z.record(z.unknown()),
  runtime_config: z.record(z.unknown()),
});

export type BootstrapEnvelope = z.infer<typeof BootstrapEnvelopeSchema>;

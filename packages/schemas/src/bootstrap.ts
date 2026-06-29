import { z } from 'zod';

/**
 * Bootstrap envelope — what GET /wp-json/appza/v1/bootstrap returns.
 *
 * Wire format produced by the appza-core-2.0 WP plug-in's bootstrap
 * controller. The `catalog` payload is the inner snapshot the plug-in
 * pulled from the Core via /api/v1/catalog/snapshot. Versioning per
 * DC#13 Q5 + DC#15 Q1.
 *
 * v1 keeps `catalog` permissive (z.record). Stricter per-table schemas
 * land alongside the renderer (Phase 1C.3) when the renderer actually
 * needs to depend on specific column shapes.
 */
export const BootstrapEnvelopeSchema = z.object({
  schema_version: z.string(),
  catalog_snapshot_version: z.number().int().nonnegative(),
  customizations_version: z.number().int().nonnegative(),
  catalog: z.record(z.unknown()),
  customizations: z.record(z.unknown()),
  runtime_config: z.record(z.unknown()),
});

export type BootstrapEnvelope = z.infer<typeof BootstrapEnvelopeSchema>;

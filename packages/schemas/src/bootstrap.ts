import { z } from 'zod';

import { CatalogSchema } from './catalog';

export const BootstrapEnvelopeSchema = z.object({
  schema_version: z.string(),
  catalog_snapshot_version: z.number().int().nonnegative(),
  customizations_version: z.number().int().nonnegative(),
  catalog: CatalogSchema,
  customizations: z.record(z.unknown()),
  runtime_config: z.record(z.unknown()),
});

export type BootstrapEnvelope = z.infer<typeof BootstrapEnvelopeSchema>;

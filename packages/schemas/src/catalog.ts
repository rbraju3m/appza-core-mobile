import { z } from 'zod';

/**
 * Typed shapes for the inner `catalog` object of the bootstrap envelope.
 *
 * Each row schema declares only the columns the renderer + simulator
 * actually read at v1, with `.passthrough()` letting Core add columns
 * without breaking older clients (DC#15 Q3 A1 — additive MINOR contracts
 * bumps are forward-compatible by construction).
 *
 * The empty-catalog branch (returned by the WP plug-in when no snapshot
 * has been pulled yet) is structurally a subset of the populated branch,
 * so every list field is optional and defaults to [].
 */

const TemplateRowSchema = z
  .object({
    id: z.number().int().optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    source_integration_id: z.number().int().optional(),
    app_map_id: z.number().int().optional(),
    tokens: z.record(z.unknown()).optional(),
    preview_image_url: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    catalog_version: z.number().int().optional(),
  })
  .passthrough();

const TemplateScreenRowSchema = z
  .object({
    id: z.number().int(),
    template_id: z.number().int().optional(),
    app_map_screen_slug: z.string(),
    placements: z.array(z.record(z.unknown())).default([]),
    screen_tokens: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

const AppZetRowSchema = z
  .object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    source_integration_id: z.number().int().optional(),
    superstructure_id: z.number().int().nullable().optional(),
    default_data_source_id: z.number().int().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .passthrough();

const SuperstructureRowSchema = z
  .object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    parent_superstructure_id: z.number().int().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .passthrough();

const SourceIntegrationRowSchema = z
  .object({
    id: z.number().int().optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const AppMapRowSchema = z
  .object({
    id: z.number().int().optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
    screens: z.array(z.record(z.unknown())).optional().default([]),
  })
  .passthrough();

export const CatalogSchema = z
  .object({
    template_slug: z.string().optional(),
    generated_at: z.string().optional(),
    source_integration: SourceIntegrationRowSchema.nullable().optional(),
    template: TemplateRowSchema.optional(),
    app_map: AppMapRowSchema.nullable().optional(),
    template_screens: z.array(TemplateScreenRowSchema).optional().default([]),
    appzets: z.array(AppZetRowSchema).optional().default([]),
    superstructures: z.array(SuperstructureRowSchema).optional().default([]),
    primitives: z.array(z.record(z.unknown())).optional().default([]),
    primitive_props: z.array(z.record(z.unknown())).optional().default([]),
    data_sources: z.array(z.record(z.unknown())).optional().default([]),
    actions: z.array(z.record(z.unknown())).optional().default([]),
  })
  .passthrough();

export type Catalog = z.infer<typeof CatalogSchema>;
export type Template = z.infer<typeof TemplateRowSchema>;
export type TemplateScreen = z.infer<typeof TemplateScreenRowSchema>;
export type AppZet = z.infer<typeof AppZetRowSchema>;
export type Superstructure = z.infer<typeof SuperstructureRowSchema>;
export type SourceIntegration = z.infer<typeof SourceIntegrationRowSchema>;
export type AppMap = z.infer<typeof AppMapRowSchema>;

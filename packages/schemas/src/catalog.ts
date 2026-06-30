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

/**
 * Defensive shape for "object-shaped JSON leaf bags" (DC#09 / DC#10 tokens
 * + screen_tokens + similar). The wire contract says these are objects,
 * but PHP empty-array-vs-JSON-object semantics mean older snapshots in
 * the wild may carry `[]` for "empty". Accepting either form keeps the
 * renderer working across mixed snapshot generations; source-side
 * normalization (in Core's BootstrapSnapshotService + the plug-in's
 * BootstrapController) heals the data going forward.
 */
const TokenBagSchema = z.union([z.record(z.unknown()), z.array(z.unknown())]);

/**
 * One placement on the chrome lists (Template.appbar_placements etc.).
 * Same shape as TemplateScreen.placements[] entries; kept loose so future
 * fields (icon, badge_count, sort_order) don't require a schema bump.
 */
const ChromePlacementSchema = z
  .object({
    appzet_slug: z.string(),
    slot: z.string().optional(),
    position: z.number().int().optional(),
  })
  .passthrough();

const TemplateRowSchema = z
  .object({
    id: z.number().int().optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    source_integration_id: z.number().int().optional(),
    app_map_id: z.number().int().optional(),
    tokens: TokenBagSchema.optional(),
    // DC#19 chrome placements — render in IonHeader / IonFooter / IonMenu.
    // Null/missing = the renderer falls back to its empty-shell defaults.
    appbar_placements: z.array(ChromePlacementSchema).nullable().optional(),
    nav_placements: z.array(ChromePlacementSchema).nullable().optional(),
    drawer_placements: z.array(ChromePlacementSchema).nullable().optional(),
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
    screen_tokens: TokenBagSchema.nullable().optional(),
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
    default_props_override: z.record(z.unknown()).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .passthrough();

/**
 * One `properties_schema` entry on a Superstructure.
 *
 * - `binds_to` (DC#16, provisional): routes the matching AppZet
 *   `default_props_override` value to a specific child primitive's prop.
 *   Grammar v1: `children[<index>].<propName>`.
 * - `controls_visibility_of` (DC#17, provisional): when the bool value
 *   resolves true → the named child renders; false → the child is skipped
 *   without renumbering surviving siblings. Grammar v1:
 *   `children[<index>]`.
 * - `controls_branch` (DC#18, provisional): bool selects which subset of
 *   children render. Children listed only in the OPPOSITE branch from
 *   the current value are hidden; children listed in both branches or
 *   neither are always shown. Mutually exclusive with
 *   `controls_visibility_of` on a single entry.
 */
const PropertiesSchemaEntrySchema = z
  .object({
    name: z.string(),
    type: z.string().optional(),
    default: z.unknown().optional(),
    exposed_to_builder: z.boolean().optional(),
    binds_to: z.string().optional(),
    controls_visibility_of: z.string().optional(),
    controls_branch: z
      .object({
        true: z.array(z.string()).optional(),
        false: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .passthrough();

const SuperstructureRowSchema = z
  .object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    parent_superstructure_id: z.number().int().nullable().optional(),
    properties_schema: z.array(PropertiesSchemaEntrySchema).nullable().optional(),
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
export type PropertiesSchemaEntry = z.infer<typeof PropertiesSchemaEntrySchema>;

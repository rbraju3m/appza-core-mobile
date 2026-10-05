import { z } from 'zod';

// Older snapshots may carry `[]` for an empty object (PHP empty-array semantics).
const TokenBagSchema = z.union([z.record(z.unknown()), z.array(z.unknown())]);

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
    appbar_placements: z.array(ChromePlacementSchema).nullable().optional(),
    nav_placements: z.array(ChromePlacementSchema).nullable().optional(),
    drawer_placements: z.array(ChromePlacementSchema).nullable().optional(),
    preview_image_url: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    catalog_version: z.number().int().optional(),
  })
  .passthrough();

export const AppSurfaceSchema = z.enum(['plugin', 'mobile', 'both', 'none']);
export type AppSurface = z.infer<typeof AppSurfaceSchema>;

const TemplateScreenRowSchema = z
  .object({
    id: z.number().int(),
    template_id: z.number().int().optional(),
    app_map_screen_slug: z.string(),
    position: z.number().int().optional(),
    surface: AppSurfaceSchema.default('both'),
    placements: z.array(z.record(z.unknown())).default([]),
    screen_tokens: TokenBagSchema.nullable().optional(),
    appbar_placements: z.array(ChromePlacementSchema).nullable().optional(),
    // Not `surface`: a screen hidden from the menu stays reachable by nav.push.
    show_in_drawer: z.boolean().default(true),
    drawer_label: z.string().nullable().optional(),
    // One unresolvable icon drops the whole menu's icons (all-or-none).
    drawer_icon: z.string().nullable().optional(),
    drawer_position: z.number().int().nullable().optional(),
    // D110: what the builder may add here, from Core's tags.
    palette: z.array(z.string()).optional(),
    appbar_palette: z.array(z.string()).optional(),
  })
  .passthrough();

const AppZetRowSchema = z
  .object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    image_url: z.string().nullable().optional(),
    source_integration_id: z.number().int().optional(),
    superstructure_id: z.number().int().nullable().optional(),
    default_data_source_id: z.number().int().nullable().optional(),
    default_props_override: z.record(z.unknown()).nullable().optional(),
    option_data_sources: z.record(z.string()).nullable().optional(),
    data_source_by_state: z
      .object({
        state_binding: z.string(),
        ds_by_value: z.record(z.string()),
      })
      .nullable()
      .optional(),
    // Only when there is a choice: the AppZet's own Superstructure first.
    layouts: z
      .array(z.object({ slug: z.string(), name: z.string(), is_default: z.boolean() }).passthrough())
      .optional(),
    tags: z.array(z.unknown()).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .passthrough();

// `controls_branch`: children listed only in the opposite branch are hidden; exclusive with `controls_visibility_of`.
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
    group: z.string().optional(),
    options: z
      .array(z.union([z.string(), z.object({ label: z.string(), value: z.string() })]))
      .optional(),
    presets: z.array(z.number()).optional(),
    unit: z.string().optional(),
    hint: z.string().optional(),
  })
  .passthrough();

const GridLayoutSchema = z
  .object({
    areas: z.array(z.object({ name: z.string(), label: z.string().nullable().optional() }).passthrough()).nullable().optional(),
    columns: z.array(z.string()).nullable().optional(),
    rows: z.array(z.array(z.string())).nullable().optional(),
    row_sizes: z.array(z.string()).nullable().optional(),
    child_areas: z.array(z.object({ child: z.number().int(), area: z.string() }).passthrough()).nullable().optional(),
    apply: z.boolean().nullable().optional(),
  })
  .passthrough();

export type GridLayout = z.infer<typeof GridLayoutSchema>;

const SuperstructureRowSchema = z
  .object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    parent_superstructure_id: z.number().int().nullable().optional(),
    children_from_prop: z.string().nullable().optional(),
    properties_schema: z.array(PropertiesSchemaEntrySchema).nullable().optional(),
    is_active: z.boolean().optional(),
    // Entered in the Core admin; a variant ships it already merged with its root's. A bad one is dropped, not fatal.
    grid_layout: GridLayoutSchema.nullable().optional().catch(null),
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
    chrome_palette: z
      .object({ appbar: z.array(z.string()), nav: z.array(z.string()), drawer: z.array(z.string()) })
      .partial()
      .optional(),
    builder_groups: z
      .array(z.object({ slug: z.string(), label: z.string(), icon: z.string() }).passthrough())
      .optional(),
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

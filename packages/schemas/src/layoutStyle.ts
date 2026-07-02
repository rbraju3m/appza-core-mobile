import { z } from 'zod';

/**
 * DC#20 provisional — per-primitive LayoutStyle.
 *
 * The `layout` column value stored in wp_appza_customizations under
 * scope=appzet_primitive. Deep-optional across the board: every knob
 * is opt-in, and undefined branches fall back to catalog / renderer
 * defaults through leaf-level merge (P26 Part 4).
 *
 * Numeric values are treated as pixels by the renderer's
 * layoutStyleToCss helper; strings pass through untouched (so callers
 * can express `%`, `rem`, `auto`, etc.). Colors are CSS color strings.
 *
 * Shape mirrors web devtools' box-model + typography + flex sections so
 * the plug-in-admin Layout editor can render one control per field with
 * no extra translation layer.
 */

const SpacingSchema = z
  .object({
    top: z.number().optional(),
    right: z.number().optional(),
    bottom: z.number().optional(),
    left: z.number().optional(),
  })
  .partial();

const RadiusSchema = z
  .object({
    tl: z.number().optional(),
    tr: z.number().optional(),
    br: z.number().optional(),
    bl: z.number().optional(),
  })
  .partial();

const BorderSideSchema = z
  .object({
    width: z.number().optional(),
    style: z.enum(['solid', 'dashed', 'dotted', 'double']).optional(),
    color: z.string().optional(),
  })
  .partial();

const BorderSchema = z
  .object({
    top: BorderSideSchema.optional(),
    right: BorderSideSchema.optional(),
    bottom: BorderSideSchema.optional(),
    left: BorderSideSchema.optional(),
  })
  .partial();

const FontSchema = z
  .object({
    family: z.string().optional(),
    size: z.number().optional(),
    weight: z
      .union([z.number(), z.enum(['normal', 'bold', 'lighter', 'bolder'])])
      .optional(),
    lineHeight: z.number().optional(),
    letterSpacing: z.number().optional(),
  })
  .partial();

const FlexSchema = z
  .object({
    direction: z.enum(['row', 'row-reverse', 'column', 'column-reverse']).optional(),
    wrap: z.enum(['nowrap', 'wrap', 'wrap-reverse']).optional(),
    grow: z.number().optional(),
    shrink: z.number().optional(),
    basis: z.union([z.number(), z.string()]).optional(),
    gap: z.number().optional(),
    justifyContent: z
      .enum([
        'flex-start',
        'flex-end',
        'center',
        'space-between',
        'space-around',
        'space-evenly',
      ])
      .optional(),
    alignItems: z
      .enum(['flex-start', 'flex-end', 'center', 'stretch', 'baseline'])
      .optional(),
  })
  .partial();

const DimensionSchema = z.union([z.number(), z.string()]);

export const LayoutStyleSchema = z
  .object({
    padding: SpacingSchema.optional(),
    margin: SpacingSchema.optional(),
    border: BorderSchema.optional(),
    borderRadius: RadiusSchema.optional(),
    width: DimensionSchema.optional(),
    height: DimensionSchema.optional(),
    minWidth: DimensionSchema.optional(),
    minHeight: DimensionSchema.optional(),
    maxWidth: DimensionSchema.optional(),
    maxHeight: DimensionSchema.optional(),
    backgroundColor: z.string().optional(),
    color: z.string().optional(),
    font: FontSchema.optional(),
    textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
    flex: FlexSchema.optional(),
    alignSelf: z
      .enum(['auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline'])
      .optional(),
    opacity: z.number().optional(),
    boxShadow: z.string().optional(),
  })
  .partial();

export type LayoutStyle = z.infer<typeof LayoutStyleSchema>;

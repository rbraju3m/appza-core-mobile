import type { AppZet, LayoutStyle, PropertiesSchemaEntry, Superstructure } from '@appza/schemas';
import type { CatalogIndex } from './catalogIndex';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { readDataPath, useDataSource } from './dataFetch';
import { isRecord, readOverride, resolveOverridableColumn } from './resolveOverride';
import { layoutStyleToCss } from './layoutStyle';

type PlacementRendererProps = {
  appzetSlug: string;
  catalogIndex: CatalogIndex;
  customizations?: unknown;
  selectedAppzetSlug?: string | null;
  onSelectAppzet?: (slug: string | null) => void;
};

type SpacingOverride = {
  margin_h?: number;
  margin_v?: number;
  padding_h?: number;
  padding_v?: number;
  border_radius?: number;
  border_width?: number;
  border_color?: string;
};

function spacingStyle(spacing: SpacingOverride | undefined): React.CSSProperties {
  if (!spacing) return {};
  const style: React.CSSProperties = {};
  if (typeof spacing.margin_h === 'number') style.marginInline = `${spacing.margin_h}px`;
  if (typeof spacing.margin_v === 'number') style.marginBlock = `${spacing.margin_v}px`;
  if (typeof spacing.padding_h === 'number') style.paddingInline = `${spacing.padding_h}px`;
  if (typeof spacing.padding_v === 'number') style.paddingBlock = `${spacing.padding_v}px`;
  if (typeof spacing.border_radius === 'number') style.borderRadius = `${spacing.border_radius}px`;
  if (typeof spacing.border_width === 'number') style.borderWidth = `${spacing.border_width}px`;
  if (typeof spacing.border_width === 'number' && spacing.border_width > 0) style.borderStyle = 'solid';
  if (typeof spacing.border_color === 'string') style.borderColor = spacing.border_color;
  return style;
}

type ChildOverrides = Record<number, Record<string, unknown>>;
type HiddenIndices = ReadonlySet<number>;

/**
 * Walks one placement: AppZet -> Superstructure -> children. Children
 * resolve as either Primitives (rendered as Ionic React widgets) or
 * nested Superstructures (recursed). Depth cap = 4 to keep us safe
 * against catalog cycles; DC#10 Q6's 3-level cap is enforced upstream
 * at admin POST, this is defense-in-depth.
 *
 * DC#16 prop binding: AppZet `default_props_override` values flow to the
 * top-level SS's children via `properties_schema[*].binds_to` (positional
 * grammar — `children[<index>].<propName>`). Nested Superstructures
 * receive no overrides at v1 (scope deferred).
 */
export function PlacementRenderer({
  appzetSlug,
  catalogIndex,
  customizations,
  selectedAppzetSlug,
  onSelectAppzet,
}: PlacementRendererProps) {
  const baseAppzet = catalogIndex.appzetBySlug.get(appzetSlug);

  // Apply customizations.appzet.<slug>.default_props_override on top of the
  // catalog's default_props_override (leaf-level merge). The customization
  // is where the right-side properties panel persists user edits — same
  // cascade as DC#13 Q2 customer overrides.
  const appzet = baseAppzet
    ? {
        ...baseAppzet,
        default_props_override: resolveOverridableColumn(
          customizations,
          'appzet',
          baseAppzet.slug,
          'default_props_override',
          baseAppzet.default_props_override ?? {},
        ) as Record<string, unknown> | null,
      }
    : baseAppzet;

  const ss = appzet?.superstructure_id
    ? catalogIndex.superstructureById.get(appzet.superstructure_id)
    : undefined;
  const dataSource = appzet?.default_data_source_id
    ? catalogIndex.dataSourceById.get(appzet.default_data_source_id)
    : undefined;

  // Always call the hook to keep hook order stable, even when there's
  // no data source (returns an empty state immediately).
  const dataState = useDataSource(dataSource?.slug);

  if (!appzet) return <MissingNode label={`unknown appzet: ${appzetSlug}`} />;
  if (!ss) return <MissingNode label={`appzet ${appzet.slug} has no superstructure`} />;

  const baseChildOverrides = computeChildOverrides(ss, appzet);
  const hiddenIndices = computeHiddenIndices(ss, appzet);
  const childLayoutStyles = computeChildLayoutStyles(appzet, ss, customizations);

  // Pull spacing override (Properties-panel-edited values) and apply
  // as inline style on the AppZet wrapper.
  const overrides = (appzet.default_props_override ?? null) as Record<string, unknown> | null;
  const spacing = overrides && typeof overrides['spacing'] === 'object'
    ? (overrides['spacing'] as SpacingOverride)
    : undefined;

  const isSelected = selectedAppzetSlug === appzet.slug;

  const handleClick = onSelectAppzet
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectAppzet(appzet.slug);
      }
    : undefined;

  const wrapperClass = [
    'appza-renderer-appzet',
    onSelectAppzet ? 'appza-renderer-appzet-clickable' : '',
    isSelected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // No data source: render once with static overrides.
  if (!dataSource) {
    return (
      <div
        className={wrapperClass}
        data-slug={appzet.slug}
        style={spacingStyle(spacing)}
        onClick={handleClick}
      >
        <SuperstructureRenderer
          ss={ss}
          catalogIndex={catalogIndex}
          depth={0}
          childOverrides={baseChildOverrides}
          hiddenIndices={hiddenIndices}
          childLayoutStyles={childLayoutStyles}
          appzetSlugForPath={appzet.slug}
        />
      </div>
    );
  }

  if (dataState.loading) {
    return <div className="appza-renderer-loading" data-slug={appzet.slug}>Loading…</div>;
  }

  const items = dataState.items.length > 0 ? dataState.items : [{}];

  return (
    <div className="appza-renderer-appzet-list" data-slug={appzet.slug}>
      {items.map((item, idx) => {
        const itemOverrides = mergeFieldMappingsOntoOverrides(baseChildOverrides, appzet, item);
        return (
          <div
            className={wrapperClass}
            data-slug={appzet.slug}
            style={spacingStyle(spacing)}
            onClick={handleClick}
            key={idx}
          >
            <SuperstructureRenderer
              ss={ss}
              catalogIndex={catalogIndex}
              depth={0}
              childOverrides={itemOverrides}
              hiddenIndices={hiddenIndices}
              childLayoutStyles={childLayoutStyles}
              appzetSlugForPath={appzet.slug}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Merges per-item data values into the child-override map using the
 * AppZet's `field_mappings`. Mapping shape: `{ "children[<i>].<prop>": "data.<path>" }`.
 * Values resolved from `item` override anything in `base` (data wins over
 * static defaults — the live value is the truer one).
 */
function mergeFieldMappingsOntoOverrides(
  base: ChildOverrides,
  appzet: AppZet,
  item: unknown,
): ChildOverrides {
  const mappings = (appzet.field_mappings ?? null) as Record<string, unknown> | null;
  if (!mappings || typeof mappings !== 'object') return base;

  const result: ChildOverrides = {};
  for (const [idx, props] of Object.entries(base)) {
    result[Number(idx)] = { ...props };
  }

  for (const [target, source] of Object.entries(mappings)) {
    if (typeof source !== 'string') continue;
    const parsed = parseBindsTo(target);
    if (!parsed) continue;
    const value = readDataPath(item, source);
    if (value === undefined || value === null) continue;
    const bucket = result[parsed.index] ?? {};
    bucket[parsed.propName] = value;
    result[parsed.index] = bucket;
  }
  return result;
}

type SuperstructureRendererProps = {
  ss: Superstructure;
  catalogIndex: CatalogIndex;
  depth: number;
  childOverrides?: ChildOverrides;
  hiddenIndices?: HiddenIndices;
  /**
   * Per-child LayoutStyle overrides. Applied only at depth 0 (v1
   * flat-only lock — nested SS primitives inherit their parent AppZet's
   * wrapper and cannot be addressed individually yet).
   */
  childLayoutStyles?: Record<number, LayoutStyle>;
  /**
   * AppZet slug used to compose the DOM `data-appza-primitive-path`
   * attribute at depth 0. The plug-in-admin's click-capture composes
   * `<appzet.slug>#<data-appza-primitive-path>` into the customization
   * composite key. Undefined at depth > 0.
   */
  appzetSlugForPath?: string;
};

const MAX_DEPTH = 4;

function SuperstructureRenderer({
  ss,
  catalogIndex,
  depth,
  childOverrides,
  hiddenIndices,
  childLayoutStyles,
  appzetSlugForPath,
}: SuperstructureRendererProps) {
  if (depth > MAX_DEPTH) {
    return <MissingNode label={`depth>${MAX_DEPTH} at ${ss.slug}`} />;
  }

  const children = readChildren(ss);
  if (children.length === 0) {
    return <MissingNode label={`${ss.slug} has no children`} />;
  }

  return (
    <div className="appza-renderer-ss" data-slug={ss.slug}>
      {children.map((child, idx) => {
        if (hiddenIndices?.has(idx)) return null;
        const isTopLevel = depth === 0;
        const childLayoutStyle = isTopLevel ? childLayoutStyles?.[idx] : undefined;
        return (
          <div
            key={`${child.slug}:${idx}`}
            className="appza-renderer-ss-child"
            data-child-index={idx}
            data-child-slug={child.slug}
            data-appza-primitive-path={isTopLevel ? `children[${idx}]` : undefined}
            data-appza-appzet-slug={isTopLevel ? appzetSlugForPath : undefined}
            style={childLayoutStyle ? layoutStyleToCss(childLayoutStyle) : undefined}
          >
            {renderChild(child.slug, catalogIndex, depth + 1, childOverrides?.[idx])}
          </div>
        );
      })}
    </div>
  );
}

function renderChild(
  slug: string,
  catalogIndex: CatalogIndex,
  depth: number,
  overrides?: Record<string, unknown>,
) {
  const primitive = catalogIndex.primitiveBySlug.get(slug);
  if (primitive) {
    return <PrimitiveRenderer primitive={primitive} overrides={overrides} />;
  }
  const ss = catalogIndex.superstructureBySlug.get(slug);
  if (ss) {
    return <SuperstructureRenderer ss={ss} catalogIndex={catalogIndex} depth={depth} />;
  }
  return <MissingNode label={`unresolved slug: ${slug}`} />;
}

function readChildren(ss: Superstructure): Array<{ slug: string }> {
  const raw = (ss as unknown as { children?: unknown }).children;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (c && typeof c === 'object' && 'slug' in c && typeof (c as { slug: unknown }).slug === 'string') {
        return { slug: (c as { slug: string }).slug };
      }
      return null;
    })
    .filter((c): c is { slug: string } => c !== null);
}

/**
 * Builds the per-child-index override map for an AppZet's top-level SS.
 *
 * For each `properties_schema[*]` entry with a `binds_to` of the form
 * `children[<index>].<propName>`, resolves the effective value via DC#16
 * precedence (AppZet `default_props_override[<name>]` → SS schema
 * `default` → skip) and places it at `result[index][propName]`. Out-of-
 * range indices and unparseable paths are silently skipped — catalog
 * edits shouldn't break the renderer.
 */
function computeChildOverrides(ss: Superstructure, appzet: AppZet): ChildOverrides {
  const schema = (ss.properties_schema ?? null) as PropertiesSchemaEntry[] | null;
  if (!Array.isArray(schema) || schema.length === 0) return {};

  const overrides = (appzet.default_props_override ?? null) as Record<string, unknown> | null;

  const result: ChildOverrides = {};
  for (const entry of schema) {
    const bind = typeof entry.binds_to === 'string' ? entry.binds_to : null;
    if (!bind) continue;
    const parsed = parseBindsTo(bind);
    if (!parsed) continue;

    const value =
      overrides && entry.name in overrides
        ? overrides[entry.name]
        : entry.default;
    if (value === undefined || value === null) continue;

    const bucket = result[parsed.index] ?? {};
    bucket[parsed.propName] = value;
    result[parsed.index] = bucket;
  }
  return result;
}

/**
 * Reads per-primitive LayoutStyle overrides for the AppZet's top-level
 * SS children. Composite key is `<appzet.slug>#children[<idx>]` under
 * scope `appzet_primitive`, column `layout` (DC#20 provisional).
 *
 * v1 is flat-only: only direct children of the top SS get a keyed slot.
 * Any override targeting a nested primitive is silently ignored here
 * and lands as a no-op until nested addressing lands post-v1.
 */
function computeChildLayoutStyles(
  appzet: AppZet,
  ss: Superstructure,
  customizations: unknown,
): Record<number, LayoutStyle> {
  const children = readChildren(ss);
  const result: Record<number, LayoutStyle> = {};
  for (let idx = 0; idx < children.length; idx++) {
    const key = `${appzet.slug}#children[${idx}]`;
    const override = readOverride(customizations, 'appzet_primitive', key, 'layout');
    if (isRecord(override)) {
      result[idx] = override as LayoutStyle;
    }
  }
  return result;
}

/** Parses `children[<index>].<propName>` → `{index, propName}`. */
function parseBindsTo(spec: string): { index: number; propName: string } | null {
  const match = /^children\[(\d+)\]\.([a-zA-Z_][\w-]*)$/.exec(spec);
  if (!match || !match[1] || !match[2]) return null;
  const index = Number.parseInt(match[1], 10);
  if (!Number.isInteger(index) || index < 0) return null;
  return { index, propName: match[2] };
}

/** Parses `children[<index>]` → `{index}`. */
function parseChildIndex(spec: string): { index: number } | null {
  const match = /^children\[(\d+)\]$/.exec(spec);
  if (!match || !match[1]) return null;
  const index = Number.parseInt(match[1], 10);
  if (!Number.isInteger(index) || index < 0) return null;
  return { index };
}

/**
 * Builds the set of child indices to hide for an AppZet's top-level SS,
 * combining DC#17 (`controls_visibility_of`) + DC#18 (`controls_branch`).
 * Effective bool per entry: AppZet `default_props_override[<name>]` →
 * schema `default` → fallback false (hide / use false-branch).
 *
 * `controls_branch` and `controls_visibility_of` are mutually exclusive
 * on a single entry; if both are set, `controls_branch` wins (no warning
 * — same silent-no-op posture as the rest of the renderer).
 *
 * Hidden indices are SKIPPED during the children walk without
 * renumbering — DC#16 `binds_to` paths still resolve to the original
 * positions on the surviving children.
 */
function computeHiddenIndices(ss: Superstructure, appzet: AppZet): HiddenIndices {
  const schema = (ss.properties_schema ?? null) as PropertiesSchemaEntry[] | null;
  if (!Array.isArray(schema) || schema.length === 0) return new Set();

  const overrides = (appzet.default_props_override ?? null) as Record<string, unknown> | null;
  const hidden = new Set<number>();

  for (const entry of schema) {
    const rawValue =
      overrides && entry.name in overrides
        ? overrides[entry.name]
        : entry.default;
    const boolValue = rawValue === true;

    if (entry.controls_branch) {
      const showIndices = parseChildIndexList(
        boolValue ? entry.controls_branch.true : entry.controls_branch.false,
      );
      const hideIndices = parseChildIndexList(
        boolValue ? entry.controls_branch.false : entry.controls_branch.true,
      );
      for (const idx of hideIndices) {
        if (!showIndices.has(idx)) hidden.add(idx);
      }
      continue;
    }

    const spec = typeof entry.controls_visibility_of === 'string' ? entry.controls_visibility_of : null;
    if (!spec) continue;
    const parsed = parseChildIndex(spec);
    if (!parsed) continue;

    if (!boolValue) hidden.add(parsed.index);
  }
  return hidden;
}

/** Parses an array of `children[<index>]` specs into a Set of indices. */
function parseChildIndexList(specs: string[] | undefined): Set<number> {
  const out = new Set<number>();
  if (!Array.isArray(specs)) return out;
  for (const spec of specs) {
    if (typeof spec !== 'string') continue;
    const parsed = parseChildIndex(spec);
    if (parsed) out.add(parsed.index);
  }
  return out;
}

function MissingNode({ label }: { label: string }) {
  return <div className="appza-renderer-missing">{label}</div>;
}

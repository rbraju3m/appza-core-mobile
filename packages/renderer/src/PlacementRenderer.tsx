import { Fragment } from 'react';
import type { AppZet, PropertiesSchemaEntry, Superstructure } from '@appza/schemas';
import type { CatalogIndex } from './catalogIndex';
import { PrimitiveRenderer } from './PrimitiveRenderer';

type PlacementRendererProps = {
  appzetSlug: string;
  catalogIndex: CatalogIndex;
};

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
export function PlacementRenderer({ appzetSlug, catalogIndex }: PlacementRendererProps) {
  const appzet = catalogIndex.appzetBySlug.get(appzetSlug);
  if (!appzet) {
    return <MissingNode label={`unknown appzet: ${appzetSlug}`} />;
  }

  const ss = appzet.superstructure_id
    ? catalogIndex.superstructureById.get(appzet.superstructure_id)
    : undefined;
  if (!ss) {
    return <MissingNode label={`appzet ${appzet.slug} has no superstructure`} />;
  }

  const childOverrides = computeChildOverrides(ss, appzet);
  const hiddenIndices = computeHiddenIndices(ss, appzet);

  return (
    <div className="appza-renderer-appzet" data-slug={appzet.slug}>
      <SuperstructureRenderer
        ss={ss}
        catalogIndex={catalogIndex}
        depth={0}
        childOverrides={childOverrides}
        hiddenIndices={hiddenIndices}
      />
    </div>
  );
}

type SuperstructureRendererProps = {
  ss: Superstructure;
  catalogIndex: CatalogIndex;
  depth: number;
  childOverrides?: ChildOverrides;
  hiddenIndices?: HiddenIndices;
};

const MAX_DEPTH = 4;

function SuperstructureRenderer({
  ss,
  catalogIndex,
  depth,
  childOverrides,
  hiddenIndices,
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
        return (
          <Fragment key={`${child.slug}:${idx}`}>
            {renderChild(child.slug, catalogIndex, depth + 1, childOverrides?.[idx])}
          </Fragment>
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
 * per DC#17 v1 (`controls_visibility_of: 'children[<index>]'`). Effective
 * bool per entry: AppZet `default_props_override[<name>]` → schema
 * `default` → fallback false (hide). Hidden indices are SKIPPED during
 * the children walk without renumbering — DC#16 `binds_to` paths still
 * resolve to the original positions on the surviving children.
 */
function computeHiddenIndices(ss: Superstructure, appzet: AppZet): HiddenIndices {
  const schema = (ss.properties_schema ?? null) as PropertiesSchemaEntry[] | null;
  if (!Array.isArray(schema) || schema.length === 0) return new Set();

  const overrides = (appzet.default_props_override ?? null) as Record<string, unknown> | null;
  const hidden = new Set<number>();

  for (const entry of schema) {
    const spec = typeof entry.controls_visibility_of === 'string' ? entry.controls_visibility_of : null;
    if (!spec) continue;
    const parsed = parseChildIndex(spec);
    if (!parsed) continue;

    const rawValue =
      overrides && entry.name in overrides
        ? overrides[entry.name]
        : entry.default;
    const shouldShow = rawValue === true;
    if (!shouldShow) hidden.add(parsed.index);
  }
  return hidden;
}

function MissingNode({ label }: { label: string }) {
  return <div className="appza-renderer-missing">{label}</div>;
}

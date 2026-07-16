import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/react';
import type { AppZet, LayoutStyle, PropertiesSchemaEntry, Superstructure } from '@appza/schemas';
import type { CatalogIndex } from './catalogIndex';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { readDataPath, useDataSource, useDataSourcePaged } from './dataFetch';
import { isRecord, readOverride, resolveOverridableColumn } from './resolveOverride';
import { layoutStyleToCss } from './layoutStyle';
import { useActionDispatch, type ActionInvocation } from './actionContext';

/**
 * Data source slugs whose AppzetPlacements render an infinite-scroll
 * list instead of a single-fetch list. Add a slug here and the renderer
 * automatically switches to `useDataSourcePaged` (page/per_page params
 * to the upstream) and appends an IonInfiniteScroll trigger under the
 * items. Upstream must accept WP-style `page` + `per_page` query args.
 *
 * Kept as a small allowlist rather than a schema flag because the set
 * changes rarely; when a new paginated data source lands, add its slug
 * here + wire a matching per_page default in PAGE_SIZE_BY_SLUG.
 */
const PAGINATED_DATA_SOURCES = new Set<string>(['fc-feed']);
const PAGE_SIZE_BY_SLUG: Record<string, number> = {
  'fc-feed': 10,
};

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

  // === Option data sources ===
  // AppZets can declare `option_data_sources: { <prop_name>: <ds_slug> }`
  // to populate option-list children (e.g. fc-post-information's space
  // picker). Fetch each and inject the mapped {value,label} items into
  // default_props_override under prop_name — the SS properties_schema
  // binding then routes it to whichever child prop needs it.
  //
  // The fetches are delegated to <OptionDataSourceFetcher /> child
  // components so hook order stays stable regardless of how many entries
  // are configured. Each reports its items upward via handleOptionLoaded.
  const optionDsEntries = useMemo(() => {
    const map = baseAppzet?.option_data_sources ?? null;
    if (!map || typeof map !== 'object') return [] as Array<[string, string]>;
    return Object.entries(map as Record<string, unknown>).filter(
      (pair): pair is [string, string] =>
        typeof pair[0] === 'string' && typeof pair[1] === 'string' && pair[1].length > 0,
    );
  }, [baseAppzet?.option_data_sources]);
  const [optionData, setOptionData] = useState<Record<string, Array<{ value: string; label: string }>>>({});
  const handleOptionLoaded = useCallback(
    (propName: string, items: Array<{ value: string; label: string }>) => {
      setOptionData((prev) => {
        const existing = prev[propName];
        if (
          existing &&
          existing.length === items.length &&
          existing.every((o, i) => o.value === items[i]!.value && o.label === items[i]!.label)
        ) {
          return prev;
        }
        return { ...prev, [propName]: items };
      });
    },
    [],
  );

  // Apply customizations.appzet.<slug>.default_props_override on top of the
  // catalog's default_props_override (leaf-level merge). The customization
  // is where the right-side properties panel persists user edits — same
  // cascade as DC#13 Q2 customer overrides.
  const appzet = baseAppzet
    ? {
        ...baseAppzet,
        default_props_override: {
          ...(resolveOverridableColumn(
            customizations,
            'appzet',
            baseAppzet.slug,
            'default_props_override',
            baseAppzet.default_props_override ?? {},
          ) as Record<string, unknown>),
          // Fetched option lists override any static default for the same
          // prop — the live catalog value is the truer one.
          ...optionData,
        } as Record<string, unknown>,
      }
    : baseAppzet;

  const ss = appzet?.superstructure_id
    ? catalogIndex.superstructureById.get(appzet.superstructure_id)
    : undefined;
  const dataSource = appzet?.default_data_source_id
    ? catalogIndex.dataSourceById.get(appzet.default_data_source_id)
    : undefined;

  // Always call BOTH hooks to keep hook order stable across renders
  // regardless of whether the data source is paginated. Only one is
  // "active" per render: the paginated hook receives the slug only when
  // this data source is in PAGINATED_DATA_SOURCES, otherwise it's
  // passed undefined and returns an inert empty state. Same trick for
  // the non-paginated hook. Never gate a hook behind an `if`.
  const isPaginated = !!dataSource && PAGINATED_DATA_SOURCES.has(dataSource.slug);
  const pagedSlug = isPaginated ? dataSource!.slug : undefined;
  const pagedState = useDataSourcePaged(pagedSlug, {
    perPage: pagedSlug ? PAGE_SIZE_BY_SLUG[pagedSlug] ?? 10 : 10,
  });
  const staticSlug = isPaginated ? undefined : dataSource?.slug;
  const staticState = useDataSource(staticSlug);
  const dataState = isPaginated
    ? { items: pagedState.items, loading: pagedState.loading, error: pagedState.error }
    : staticState;

  // IonInfiniteScroll requires the parent to call `complete()` on the
  // element ref once the load-more fetch has actually landed — otherwise
  // its spinner disappears before the new items render (jank) OR stays
  // stuck if we forget entirely. Track a "loadMore in flight" flag and
  // fire complete() when the paged hook's `loading` transitions back to
  // false. `wasLoadingMore` prevents firing on the very first page load
  // (there's no infinite scroll to complete at that point).
  const infiniteScrollRef = useRef<HTMLIonInfiniteScrollElement | null>(null);
  const wasLoadingMore = useRef(false);
  useEffect(() => {
    if (!isPaginated) return;
    if (pagedState.loading) {
      wasLoadingMore.current = true;
      return;
    }
    if (wasLoadingMore.current && infiniteScrollRef.current) {
      wasLoadingMore.current = false;
      void infiniteScrollRef.current.complete();
    }
  }, [isPaginated, pagedState.loading]);

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

  // Sub-mount used by both render branches below. Each entry mounts once
  // per (propName, dsSlug) pair and fires a useDataSource fetch; results
  // flow back into `optionData` via handleOptionLoaded and land in
  // appzet.default_props_override on the next render.
  const optionFetchers =
    optionDsEntries.length > 0 ? (
      <>
        {optionDsEntries.map(([propName, dsSlug]) => (
          <OptionDataSourceFetcher
            key={propName + ':' + dsSlug}
            propName={propName}
            dsSlug={dsSlug}
            onLoaded={handleOptionLoaded}
          />
        ))}
      </>
    ) : null;

  // No data source: render once with static overrides. Child actions still
  // apply (login button, create-post button, etc. — anything that doesn't
  // need per-item data context) so we compute them with a null item.
  if (!dataSource) {
    const staticChildren = readChildren(ss);
    const staticActions = computeChildActions(staticChildren, appzet, undefined);
    return (
      <>
        {optionFetchers}
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
            childActions={staticActions}
            appzetSlugForPath={appzet.slug}
          />
        </div>
      </>
    );
  }

  // Only show the loading placeholder on the very first fetch. Once we
  // have items, keep rendering them during background refetches — otherwise
  // any refresh (window focus, explicit refresh event) unmounts the whole
  // subtree, resetting local component state like the video-embed's
  // `playing` flag, which reads as "video hides when clicked".
  if (dataState.loading && dataState.items.length === 0) {
    return (
      <>
        {optionFetchers}
        <div className="appza-renderer-loading" data-slug={appzet.slug}>Loading…</div>
      </>
    );
  }

  const items = dataState.items.length > 0 ? dataState.items : [{}];
  const ssChildren = readChildren(ss);

  return (
    <>
      {optionFetchers}
      <div className="appza-renderer-appzet-list" data-slug={appzet.slug}>
      {items.map((item, idx) => {
        const itemOverrides = mergeFieldMappingsOntoOverrides(baseChildOverrides, appzet, item);
        const dataHidden = computeDataHiddenIndices(ssChildren, item);
        const effectiveHidden =
          dataHidden.size === 0
            ? hiddenIndices
            : new Set<number>([...hiddenIndices, ...dataHidden]);
        const childOpenUrls = computeChildOpenUrls(ssChildren, item);
        const childActions = computeChildActions(ssChildren, appzet, item);
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
              hiddenIndices={effectiveHidden}
              childLayoutStyles={childLayoutStyles}
              childOpenUrls={childOpenUrls}
              childActions={childActions}
              appzetSlugForPath={appzet.slug}
            />
          </div>
        );
      })}
      {isPaginated && pagedState.hasMore && (
        <IonInfiniteScroll
          ref={infiniteScrollRef}
          threshold="200px"
          disabled={!pagedState.hasMore}
          onIonInfinite={() => pagedState.loadMore()}
        >
          <IonInfiniteScrollContent
            loadingSpinner="bubbles"
            loadingText="Loading more posts…"
          />
        </IonInfiniteScroll>
      )}
      </div>
    </>
  );
}

/**
 * Fires a useDataSource fetch for one entry of an AppZet's
 * option_data_sources map and reports the mapped {value,label} items
 * back to the parent via onLoaded. Renders null — presence is purely
 * to keep hook order stable per (propName, dsSlug) pair.
 *
 * Mapping heuristic: `slug` (fallback `id`) → value; `title` (fallback
 * `name`, then `slug`/`id`) → label. If a Source's DS returns a
 * different shape, add `value_path`/`label_path` on the DataSource row
 * and read them here — deferred until a second use case surfaces.
 */
function OptionDataSourceFetcher({
  propName,
  dsSlug,
  onLoaded,
}: {
  propName: string;
  dsSlug: string;
  onLoaded: (propName: string, items: Array<{ value: string; label: string }>) => void;
}) {
  const { items, loading, error } = useDataSource(dsSlug);
  useEffect(() => {
    if (loading || error) return;
    const mapped = items
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const rec = raw as Record<string, unknown>;
        const value = String(rec.slug ?? rec.id ?? '');
        const label = String(rec.title ?? rec.name ?? rec.slug ?? rec.id ?? '');
        return value && label ? { value, label } : null;
      })
      .filter((o): o is { value: string; label: string } => o !== null);
    onLoaded(propName, mapped);
  }, [propName, items, loading, error, onLoaded]);
  return null;
}

/**
 * Resolves each child's `on_click_action` (event name in the AppZet's
 * `actions` map) into a ready-to-dispatch ActionInvocation. The AppZet's
 * per-event wiring supplies the action_slug + any static args; the current
 * data item rides along so the shell can resolve `data.<path>` params.
 */
function computeChildActions(
  children: SSChild[],
  appzet: AppZet,
  item: unknown,
): Record<number, ActionInvocation> {
  const out: Record<number, ActionInvocation> = {};
  const wirings = (appzet.actions ?? null) as Record<string, unknown> | null;
  if (!wirings || typeof wirings !== 'object') return out;

  for (let i = 0; i < children.length; i++) {
    const eventName = children[i]?.on_click_action;
    if (!eventName) continue;
    const wiring = wirings[eventName];
    if (!wiring || typeof wiring !== 'object' || Array.isArray(wiring)) continue;
    const rec = wiring as Record<string, unknown>;
    const action_slug = typeof rec.action_slug === 'string' ? rec.action_slug : null;
    if (!action_slug) continue;
    const args = rec.args && typeof rec.args === 'object' && !Array.isArray(rec.args)
      ? (rec.args as Record<string, unknown>)
      : undefined;
    const binding_root = typeof rec.binding_root === 'string' ? rec.binding_root : undefined;
    out[i] = { action_slug, args, binding_root, item };
  }
  return out;
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
   * Per-child URLs resolved from `on_click_open_url` bindings against the
   * current data item. When set, the child wrapper is rendered as an
   * `<a target="_blank">` so a tap opens the URL externally. Applied at
   * depth 0 (per-item resolution requires the data context).
   */
  childOpenUrls?: Record<number, string>;
  /**
   * Per-child resolved ActionInvocations from `on_click_action` bindings.
   * When set for index N, the child wrapper handles onClick by calling the
   * ActionContext dispatcher.
   */
  childActions?: Record<number, ActionInvocation>;
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
  childOpenUrls,
  childActions,
  appzetSlugForPath,
}: SuperstructureRendererProps) {
  const dispatch = useActionDispatch();

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
        const openUrl = isTopLevel ? childOpenUrls?.[idx] : undefined;
        const action = isTopLevel ? childActions?.[idx] : undefined;
        const rendered = renderChild(child.slug, catalogIndex, depth + 1, childOverrides?.[idx]);
        const wrapperClass = [
          'appza-renderer-ss-child',
          openUrl ? 'appza-renderer-ss-child-linked' : '',
          action ? 'appza-renderer-ss-child-actionable' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={`${child.slug}:${idx}`}
            className={wrapperClass}
            data-child-index={idx}
            data-child-slug={child.slug}
            data-appza-primitive-path={isTopLevel ? `children[${idx}]` : undefined}
            data-appza-appzet-slug={isTopLevel ? appzetSlugForPath : undefined}
            data-appza-inline-click={action ? 'true' : undefined}
            style={childLayoutStyle ? layoutStyleToCss(childLayoutStyle) : undefined}
            onClick={action
              ? (e) => {
                  e.stopPropagation();
                  dispatch(action);
                }
              : undefined}
            role={action ? 'button' : undefined}
          >
            {openUrl ? (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="appza-renderer-open-url"
              >
                {rendered}
              </a>
            ) : (
              rendered
            )}
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

type VisibleWhenOp = '==' | '!=' | 'exists' | 'not_exists' | 'in' | 'not_in';

type VisibleWhen = {
  binding: string;
  op: VisibleWhenOp;
  value?: unknown;
};

type SSChild = {
  slug: string;
  visible_when?: VisibleWhen;
  on_click_open_url?: string;
  /**
   * When set, clicking the child fires the named event from the AppZet's
   * `actions` map (e.g. `on_tap_composer`, `on_tap_back`). The renderer
   * looks up the action wiring, resolves data-bound args, and calls the
   * ActionContext's dispatch. The shell handles the actual side effect
   * (navigation, HTTP, etc.) — the renderer stays presentation-only.
   */
  on_click_action?: string;
};

function readChildren(ss: Superstructure): SSChild[] {
  const raw = (ss as unknown as { children?: unknown }).children;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (!c || typeof c !== 'object' || !('slug' in c)) return null;
      const rec = c as Record<string, unknown>;
      if (typeof rec.slug !== 'string') return null;
      const out: SSChild = { slug: rec.slug };
      const vw = rec.visible_when;
      if (vw && typeof vw === 'object' && !Array.isArray(vw)) {
        const vwRec = vw as Record<string, unknown>;
        if (typeof vwRec.binding === 'string' && typeof vwRec.op === 'string') {
          out.visible_when = {
            binding: vwRec.binding,
            op: vwRec.op as VisibleWhenOp,
            value: 'value' in vwRec ? vwRec.value : undefined,
          };
        }
      }
      if (typeof rec.on_click_open_url === 'string') {
        out.on_click_open_url = rec.on_click_open_url;
      }
      if (typeof rec.on_click_action === 'string') {
        out.on_click_action = rec.on_click_action;
      }
      return out;
    })
    .filter((c): c is SSChild => c !== null);
}

/**
 * Resolves `on_click_open_url` bindings per child against the current data
 * item. Values are `data.<path>` strings; returned map is keyed by child
 * index. Empty / non-string / missing values are skipped — SSRenderer only
 * wraps the child in an anchor when a resolved URL exists.
 */
function computeChildOpenUrls(children: SSChild[], item: unknown): Record<number, string> {
  const out: Record<number, string> = {};
  for (let i = 0; i < children.length; i++) {
    const spec = children[i]?.on_click_open_url;
    if (!spec) continue;
    const resolved = readDataPath(item, spec);
    if (typeof resolved === 'string' && resolved !== '') {
      out[i] = resolved;
    }
  }
  return out;
}

/**
 * Evaluates per-child `visible_when` clauses against the current data item
 * and returns the union of indices to hide. Runs on TOP of the static
 * `computeHiddenIndices` result (which is bool-prop-based, per DC#17/#18).
 *
 * Grammar v1 — single clause per child, no AND/OR nesting. Ops: `==`, `!=`,
 * `exists`, `not_exists`, `in`, `not_in`. Binding: `data.<path>` (same
 * grammar as `field_mappings`). Unparseable clauses fail-open (child shown)
 * — same silent-no-op posture as the rest of the renderer.
 */
function computeDataHiddenIndices(children: SSChild[], item: unknown): Set<number> {
  const hidden = new Set<number>();
  for (let i = 0; i < children.length; i++) {
    const vw = children[i]?.visible_when;
    if (!vw) continue;
    if (!evaluateVisibleWhen(vw, item)) hidden.add(i);
  }
  return hidden;
}

function evaluateVisibleWhen(vw: VisibleWhen, item: unknown): boolean {
  const resolved = readDataPath(item, vw.binding);
  switch (vw.op) {
    case 'exists':
      return resolved !== undefined && resolved !== null && resolved !== '';
    case 'not_exists':
      return resolved === undefined || resolved === null || resolved === '';
    case '==':
      return resolved === vw.value;
    case '!=':
      return resolved !== vw.value;
    case 'in':
      return Array.isArray(vw.value) && vw.value.includes(resolved as never);
    case 'not_in':
      return !(Array.isArray(vw.value) && vw.value.includes(resolved as never));
    default:
      return true;
  }
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

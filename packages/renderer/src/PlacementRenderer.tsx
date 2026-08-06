import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/react';
import type { AppZet, LayoutStyle, PropertiesSchemaEntry, Superstructure } from '@appza/schemas';
import type { CatalogIndex } from './catalogIndex';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { readDataPath, resolveQueryParams, useDataSource, useDataSourcePaged } from './dataFetch';
import { isRecord, readOverride, resolveOverridableColumn } from './resolveOverride';
import { layoutStyleToCss } from './layoutStyle';
import { useActionDispatch, type ActionInvocation } from './actionContext';
import { useFeedControls } from './feedControls';
import { useSpacesControls } from './spacesControls';
import { useSpaceDetailControls } from './spaceDetailControls';
import { SELF_ACTION_PRIMITIVES } from './PrimitiveRenderer';

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
  /**
   * Placement-level `props_override` from the TemplateScreen placement row.
   * Highest-priority source for a few knobs the placement wants to steer
   * without editing the shared AppZet:
   *   - `data_source_slug` — swap the resolved DataSource for this render
   *     only. Wins over both the AppZet's `default_data_source_id` AND its
   *     `data_source_by_state`. Used by the space-detail placement of
   *     fc-post-card to point it at fc-space-feeds without cloning the
   *     AppZet.
   */
  propsOverride?: Record<string, unknown> | null;
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
// Map from timeline appzet slug -> {card, list} variant slugs. When
// feedControls.viewMode !== 'timeline' and the current placement targets
// the timeline slug, PlacementRenderer substitutes the variant so its
// SS + field_mappings + default_props apply per item. Keeps the swap
// self-contained here; the catalog just needs to ship the variant
// appzets under these slugs.
const VIEW_MODE_VARIANTS: Record<string, { card?: string; list?: string }> = {
  'fc-post-card': { card: 'fc-post-grid-item', list: 'fc-post-list-item' },
};

export function PlacementRenderer({
  appzetSlug,
  catalogIndex,
  customizations,
  selectedAppzetSlug,
  onSelectAppzet,
  propsOverride,
}: PlacementRendererProps) {
  // Read view mode + sort up here so we can swap the appzet BEFORE
  // resolving baseAppzet's SS / data source / props overrides — otherwise
  // the swap would fight the memoized derivations below. feedSort is
  // consumed by useDataSourcePaged further down (fc-feed order_by_type).
  const { viewMode: feedViewMode, sort: feedSort } = useFeedControls();
  // spacesControls drives client-side search + sort on the space list
  // AppZets (fc-space-card / fc-space-card-my). Read unconditionally so
  // hook order stays stable; only applied below when the current AppZet's
  // data source is spaces-scoped.
  const { tab: spacesTab, search: spacesSearch, sort: spacesSort } = useSpacesControls();
  // spaceDetailControls drives the Space Detail screen (active sub-tab,
  // topic filter, sort). Read unconditionally to keep hook order stable —
  // fc-space-feeds' query_params bind against these values, and per-child
  // state.space_detail_controls.* visible_when clauses read them via
  // localStateBag below.
  const {
    active_subtab: spaceDetailActiveSubtab,
    topic_slug: spaceDetailTopicSlug,
    sort: spaceDetailSort,
    space_slug: spaceDetailSpaceSlug,
  } = useSpaceDetailControls();
  const requestedAppzet = catalogIndex.appzetBySlug.get(appzetSlug);
  // Placement-level data_source_slug override wins when deciding whether
  // the view-mode swap applies. The swap is governed by feedControls,
  // which fc-feed-toolbar writes on the home/feed screens against the
  // fc-feed DS. When a placement rebinds the AppZet to a different DS
  // (e.g. space-detail's fc-post-card → fc-space-feeds), feedControls
  // isn't the authoritative view-mode — skipping the swap keeps the
  // AppZet on its default (timeline) layout instead of picking up a
  // stale global card/list mode carried over from a prior /feed visit.
  const placementDsForVariant =
    propsOverride && typeof propsOverride['data_source_slug'] === 'string'
      ? (propsOverride['data_source_slug'] as string)
      : null;
  const feedGovernedDs =
    !placementDsForVariant ||
    placementDsForVariant === 'fc-feed' ||
    (requestedAppzet?.default_data_source_id != null &&
      catalogIndex.dataSourceById.get(requestedAppzet.default_data_source_id)?.slug === 'fc-feed' &&
      !placementDsForVariant);
  const variantSlug =
    requestedAppzet && VIEW_MODE_VARIANTS[requestedAppzet.slug] && feedGovernedDs
      ? feedViewMode === 'card'
        ? VIEW_MODE_VARIANTS[requestedAppzet.slug]!.card
        : feedViewMode === 'list'
          ? VIEW_MODE_VARIANTS[requestedAppzet.slug]!.list
          : undefined
      : undefined;
  const baseAppzet = variantSlug
    ? catalogIndex.appzetBySlug.get(variantSlug) ?? requestedAppzet
    : requestedAppzet;

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
          // fc-feed-toolbar reflects the persisted user preference in its
          // controls — the sort button's text becomes "Sort by: <label>"
          // where <label> is resolved by scanning the action wiring's
          // args.options for a matching value. If no match, we fall back
          // to the raw value key (better than showing "Sort by:" alone).
          ...(baseAppzet.slug === 'fc-feed-toolbar'
            ? (() => {
                const actions = (baseAppzet.actions ?? null) as Record<string, unknown> | null;
                const sortWiring = actions && actions.on_change_sort;
                const opts =
                  isRecord(sortWiring) && isRecord((sortWiring as Record<string, unknown>).args)
                    ? (((sortWiring as Record<string, unknown>).args as Record<string, unknown>).options)
                    : undefined;
                let label = feedSort;
                if (Array.isArray(opts)) {
                  const match = opts.find(
                    (o) => isRecord(o) && (o as Record<string, unknown>).value === feedSort,
                  );
                  if (match && typeof (match as Record<string, unknown>).label === 'string') {
                    label = (match as Record<string, unknown>).label as string;
                  }
                }
                // View-toggle icon reflects current view mode so the user
                // sees immediate feedback of their pick (grid for card,
                // rows for list, lines for timeline).
                const viewIcon =
                  feedViewMode === 'card'
                    ? 'grid-outline'
                    : feedViewMode === 'list'
                      ? 'reorder-four-outline'
                      : 'list-outline';
                return {
                  sort_button_text: `Sort by: ${label}`,
                  default_sort: feedSort,
                  default_view_mode: feedViewMode,
                  view_toggle_icon: viewIcon,
                };
              })()
            : {}),
        } as Record<string, unknown>,
      }
    : baseAppzet;

  const ss = appzet?.superstructure_id
    ? catalogIndex.superstructureById.get(appzet.superstructure_id)
    : undefined;
  // data_source_by_state resolution: when the AppZet declares one, read
  // the state binding (e.g. 'state.spaces_tab') out of the local
  // stateBag, look up the matching entry in ds_by_value, and resolve
  // that DS by slug. Falls back to default_data_source_id when the
  // state value is unmapped OR the AppZet has no state-scoped config.
  // Adding a state slice here is enough — grows the same way as
  // ScreenRenderer's stateBag.
  const localStateBag: Record<string, unknown> = {
    'state.spaces_tab': spacesTab,
    'state.spaces_search': spacesSearch,
    'state.spaces_sort': spacesSort,
    'state.feed_sort': feedSort,
    'state.feed_view_mode': feedViewMode,
    // Nested slice.key form — matches the seeder's bindings on
    // fc-space-feeds query_params + space-detail placement visible_when.
    'state.space_detail_controls.active_subtab': spaceDetailActiveSubtab,
    'state.space_detail_controls.topic_slug': spaceDetailTopicSlug,
    'state.space_detail_controls.sort': spaceDetailSort,
    'state.space_detail_controls.space_slug': spaceDetailSpaceSlug,
  };
  const dataSourceByState = (appzet as unknown as {
    data_source_by_state?: {
      state_binding?: unknown;
      ds_by_value?: unknown;
    } | null;
  } | undefined)?.data_source_by_state;
  let stateResolvedDs: ReturnType<typeof catalogIndex.dataSourceById.get> = undefined;
  if (
    appzet &&
    dataSourceByState &&
    typeof dataSourceByState.state_binding === 'string' &&
    isRecord(dataSourceByState.ds_by_value)
  ) {
    const stateValue = localStateBag[dataSourceByState.state_binding];
    const dsMap = dataSourceByState.ds_by_value as Record<string, unknown>;
    const dsSlug =
      typeof stateValue === 'string' && typeof dsMap[stateValue] === 'string'
        ? (dsMap[stateValue] as string)
        : null;
    if (dsSlug) {
      stateResolvedDs = catalogIndex.dataSourceBySlug.get(dsSlug);
    }
  }
  // Placement-level props_override.data_source_slug wins over EVERYTHING
  // else (state-scoped map + AppZet default). Lets a single placement
  // rebind the shared AppZet's DS without cloning the AppZet — e.g. the
  // space-detail screen places fc-post-card against fc-space-feeds while
  // the community-page placement keeps fc-feed.
  const placementDsSlug =
    propsOverride && typeof propsOverride['data_source_slug'] === 'string'
      ? (propsOverride['data_source_slug'] as string)
      : null;
  const placementResolvedDs = placementDsSlug
    ? catalogIndex.dataSourceBySlug.get(placementDsSlug)
    : undefined;
  const dataSource =
    placementResolvedDs ??
    stateResolvedDs ??
    (appzet?.default_data_source_id
      ? catalogIndex.dataSourceById.get(appzet.default_data_source_id)
      : undefined);

  // Always call BOTH hooks to keep hook order stable across renders
  // regardless of whether the data source is paginated. Only one is
  // "active" per render: the paginated hook receives the slug only when
  // this data source is in PAGINATED_DATA_SOURCES, otherwise it's
  // passed undefined and returns an inert empty state. Same trick for
  // the non-paginated hook. Never gate a hook behind an `if`.
  const isPaginated = !!dataSource && PAGINATED_DATA_SOURCES.has(dataSource.slug);
  const pagedSlug = isPaginated ? dataSource!.slug : undefined;
  // Resolve declarative DS.query_params (state / route_param sources) at
  // render time. State hooks read above already trigger re-render on
  // change → the resulting stringified params bumps the hooks' extraKey
  // → paged: reset to page 1 + refetch, static: refetch. No explicit
  // refresh-event round-trip needed for state-driven param changes.
  //
  // fc-feed retains the hardcoded order_by_type: feedSort fallback for
  // pre-space-detail callers that never registered query_params on the
  // fc-feed DS row. Explicit query_params on the DS wins if present.
  const resolvedParams = dataSource ? resolveQueryParams(dataSource.query_params) : {};
  const pagedExtraParams =
    pagedSlug === 'fc-feed' && !dataSource?.query_params
      ? { order_by_type: feedSort }
      : Object.keys(resolvedParams).length > 0
        ? resolvedParams
        : undefined;
  const pagedState = useDataSourcePaged(pagedSlug, {
    perPage: pagedSlug ? PAGE_SIZE_BY_SLUG[pagedSlug] ?? 10 : 10,
    params: pagedExtraParams,
  });
  const staticSlug = isPaginated ? undefined : dataSource?.slug;
  const staticParams = Object.keys(resolvedParams).length > 0 ? resolvedParams : undefined;
  const staticState = useDataSource(staticSlug, staticParams);
  const dataState = isPaginated
    ? { items: pagedState.items, loading: pagedState.loading, error: pagedState.error }
    : staticState;

  // Sibling DS for _config_apply — some AppZets (fc-space-switcher,
  // fc-space-subtabs) source their per-space overrides from a sibling DS
  // (fc-space-detail) that's not their primary data source. Hook is called
  // unconditionally to keep hook order stable across renders; slug is
  // undefined when the AppZet either has no _config_apply meta or points
  // at its own DS (in which case dataState above already has the payload).
  const configApplyRaw = (appzet?.default_props_override as Record<string, unknown> | undefined)?.[
    '_config_apply'
  ];
  const configApplySpec =
    configApplyRaw && typeof configApplyRaw === 'object' && !Array.isArray(configApplyRaw)
      ? (configApplyRaw as { data_source_slug?: unknown; data_path?: unknown; merge_into?: unknown })
      : null;
  const siblingConfigSlug =
    configApplySpec && typeof configApplySpec.data_source_slug === 'string'
      ? configApplySpec.data_source_slug
      : undefined;
  const siblingConfigParams = siblingConfigSlug
    ? resolveQueryParams(
        catalogIndex.dataSourceBySlug.get(siblingConfigSlug)?.query_params,
      )
    : undefined;
  const siblingConfigState = useDataSource(
    siblingConfigSlug,
    siblingConfigParams && Object.keys(siblingConfigParams).length > 0
      ? siblingConfigParams
      : undefined,
  );

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

  // === _data_prop_mirror ===
  // Generic bridge from a resolved DS response into a named AppZet prop.
  // Declared as a meta key inside default_props_override (piggybacked to
  // avoid an AppZet-column migration):
  //   default_props_override._data_prop_mirror:
  //     { data_path: 'data.topics', prop: 'topics' }
  //     - `data_path` starting with 'data.' reads FROM the first fetched
  //       item (single-object DS shape — e.g. fc-space-detail's topics
  //       array lives on the row itself).
  //     - `data_path: ''` (or missing) uses the entire items array
  //       verbatim — for list DSes like fc-spaces-discover whose whole
  //       return should populate a `spaces` prop.
  // Only mirrors when the target prop is empty/absent so authors can
  // hardcode a static list if they don't want the DS-driven behaviour.
  // Runs BEFORE readExpandedChildren so children_from_prop sees the
  // mirrored array on the same render pass — no second commit needed.
  const dpoBag = (appzet.default_props_override ?? null) as Record<string, unknown> | null;
  const mirrorSpecRaw = dpoBag ? dpoBag['_data_prop_mirror'] : undefined;
  const mirrorSpec =
    mirrorSpecRaw && typeof mirrorSpecRaw === 'object' && !Array.isArray(mirrorSpecRaw)
      ? (mirrorSpecRaw as { data_path?: unknown; prop?: unknown })
      : null;
  if (
    mirrorSpec &&
    typeof mirrorSpec.prop === 'string' &&
    mirrorSpec.prop.length > 0
  ) {
    const propName = mirrorSpec.prop;
    const dataPath = typeof mirrorSpec.data_path === 'string' ? mirrorSpec.data_path : '';
    const existing = dpoBag ? dpoBag[propName] : undefined;
    const isEmptyArray = Array.isArray(existing) && existing.length === 0;
    const missing = existing === undefined || existing === null;
    if (isEmptyArray || missing) {
      let mirrored: unknown = undefined;
      if (!dataPath) {
        // Whole items array (list DS → prop expects a list of records).
        mirrored = dataState.items;
      } else if (dataPath.startsWith('data.') && dataState.items.length > 0) {
        // Nested read from the first item (single-object DS shape).
        mirrored = readDataPath(dataState.items[0], dataPath);
      }
      if (Array.isArray(mirrored) && mirrored.length > 0) {
        // Mutating the freshly-cloned override bag from line 181 —
        // safe because that spread produced a new object owned by this
        // render. Cast keeps the schema-level `nullable` type quiet.
        (appzet as { default_props_override: Record<string, unknown> }).default_props_override = {
          ...(appzet.default_props_override ?? {}),
          [propName]: mirrored,
        };
      }
    }
  }

  // === _config_apply ===
  // Per-space (or per-context) runtime overrides mirrored from a DS field
  // onto this AppZet's default_props_override. Powers the per-space
  // config knobs on the Space Detail screen (fc-space-switcher /
  // fc-space-subtabs / fc-space-cover / fc-space-topics) without needing
  // a per-space AppZet clone.
  //
  //   default_props_override._config_apply:
  //     { data_source_slug?: 'fc-space-detail',   // optional; own DS if omitted
  //       data_path: 'data.appza_config.subtabs',
  //       merge_into: 'default_props' | 'prop:<name>' }
  //
  //   - merge_into='default_props': the config value at data_path must be
  //     an object; its keys are merged onto default_props_override
  //     (config wins). Use for scalar knobs like {section_header,
  //     all_label, hidden, height, ...}.
  //   - merge_into='prop:<name>': the config value at data_path replaces
  //     the named prop wholesale. Use for array-shaped configs like
  //     `subtabs` where the customer's list fully replaces the default.
  //
  // Runs after _data_prop_mirror so mirrored array is already in place
  // before overrides are applied.
  if (
    configApplySpec &&
    typeof configApplySpec.data_path === 'string' &&
    configApplySpec.data_path.length > 0
  ) {
    const dataPath = configApplySpec.data_path;
    const mergeIntoRaw =
      typeof configApplySpec.merge_into === 'string' ? configApplySpec.merge_into : 'default_props';
    // Pick the DS payload — sibling (fc-space-detail on switcher/subtabs)
    // or own DS (topics reads its own fc-space-detail; cover ditto).
    const sourceItems = siblingConfigSlug ? siblingConfigState.items : dataState.items;
    if (sourceItems.length > 0) {
      const configValue = readDataPath(sourceItems[0], dataPath);
      if (configValue !== undefined && configValue !== null) {
        if (mergeIntoRaw === 'default_props' && typeof configValue === 'object' && !Array.isArray(configValue)) {
          (appzet as { default_props_override: Record<string, unknown> }).default_props_override = {
            ...(appzet.default_props_override ?? {}),
            ...(configValue as Record<string, unknown>),
          };
        } else if (mergeIntoRaw.startsWith('prop:')) {
          const propName = mergeIntoRaw.slice('prop:'.length);
          if (propName.length > 0) {
            (appzet as { default_props_override: Record<string, unknown> }).default_props_override = {
              ...(appzet.default_props_override ?? {}),
              [propName]: configValue,
            };
          }
        }
      }
    }
  }

  // === Directive post-processing ===
  // After _config_apply has splattered scalar overrides onto
  // default_props_override, apply the well-known DIRECTIVE keys that
  // manipulate the mirrored data arrays rather than just replacing
  // props verbatim. These keys are handled here because they need to
  // read AND WRITE the same `spaces` / `topics` mirror; the plain
  // splat can't express filter+reorder semantics.
  //
  // Skip-render directives (hidden) short-circuit the whole AppZet by
  // returning early below — after we've built the wrapper skeleton so
  // the placement slot still occupies the same order in the DOM tree
  // (React key stability).
  {
    const dpo = (appzet.default_props_override ?? {}) as Record<string, unknown>;
    // hidden = true → the whole strip disappears; renderer returns a
    // zero-height sentinel so surrounding placements don't reflow around
    // an absent node in a way that shifts layout mid-transition.
    if (dpo['hidden'] === true) {
      return <span data-appza-hidden-appzet={appzet.slug} style={{ display: 'none' }} />;
    }
    // spaces_whitelist (fc-space-switcher) — filter mirrored entries by
    // slug, preserving whitelist order. Missing/empty whitelist = keep
    // full list. Applied only when the AppZet has a mirrored `spaces`
    // array; safe no-op otherwise.
    const readSlug = (v: unknown): string | undefined => {
      if (!isRecord(v)) return undefined;
      const s = (v as Record<string, unknown>).slug;
      return typeof s === 'string' ? s : undefined;
    };
    // Directive lists accept two shapes:
    //   - array of strings (runtime config JSON)
    //   - comma-separated string (right-panel string input)
    // Empty string / empty array are treated equivalently as "no filter".
    const parseSlugList = (raw: unknown): string[] => {
      if (Array.isArray(raw)) {
        return raw.filter((s): s is string => typeof s === 'string' && s.length > 0);
      }
      if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      return [];
    };
    const whitelist = parseSlugList(dpo['spaces_whitelist']);
    if (whitelist.length > 0) {
      const entries = Array.isArray(dpo['spaces']) ? (dpo['spaces'] as unknown[]) : null;
      if (entries) {
        const bySlug = new Map<string, unknown>();
        for (const e of entries) {
          const slug = readSlug(e);
          if (slug !== undefined) bySlug.set(slug, e);
        }
        const filtered = whitelist.map((s) => bySlug.get(s)).filter((e): e is unknown => e != null);
        (appzet as { default_props_override: Record<string, unknown> }).default_props_override = {
          ...dpo,
          spaces: filtered,
        };
      }
    }
    // topic_order + hidden_topics (fc-space-topics) — filter first, then
    // reorder. Unlisted topics keep their post-mirror order after any
    // explicitly-ordered entries.
    const hiddenTopics = parseSlugList(dpo['hidden_topics']);
    const topicOrder = parseSlugList(dpo['topic_order']);
    if ((hiddenTopics.length > 0 || topicOrder.length > 0) && Array.isArray(dpo['topics'])) {
      let topics = (dpo['topics'] as unknown[]).slice();
      if (hiddenTopics.length > 0) {
        topics = topics.filter((t) => {
          const slug = readSlug(t);
          return slug === undefined || !hiddenTopics.includes(slug);
        });
      }
      if (topicOrder.length > 0) {
        const bySlug = new Map<string, unknown>();
        for (const t of topics) {
          const slug = readSlug(t);
          if (slug !== undefined) bySlug.set(slug, t);
        }
        const ordered: unknown[] = [];
        for (const s of topicOrder) {
          const t = bySlug.get(s);
          if (t) {
            ordered.push(t);
            bySlug.delete(s);
          }
        }
        for (const t of topics) {
          const slug = readSlug(t);
          if (slug !== undefined && bySlug.has(slug)) ordered.push(t);
        }
        topics = ordered;
      }
      (appzet as { default_props_override: Record<string, unknown> }).default_props_override = {
        ...(appzet.default_props_override ?? {}),
        topics,
      };
    }
  }

  // Variadic children expansion: when the SS opts into children_from_prop
  // (e.g. 'tabs'), replicate ss.children[0] once per array entry. Falls
  // back to the static-children path when the prop is absent OR the
  // array is empty. Per-entry leaf values (label→text, value, icon, ...)
  // land in `entryOverrides` which we merge into baseChildOverrides so
  // the tab labels + values render off the AppZet default_props.
  const expanded = readExpandedChildren(ss, appzet);
  const baseChildOverrides = computeChildOverrides(ss, appzet);
  for (const idxStr of Object.keys(expanded.entryOverrides)) {
    const i = Number(idxStr);
    baseChildOverrides[i] = {
      ...(baseChildOverrides[i] ?? {}),
      ...expanded.entryOverrides[i],
    };
  }
  const hiddenIndices = computeHiddenIndices(ss, appzet);
  const childLayoutStyles = computeChildLayoutStyles(appzet, ss, customizations);

  // When `children_from_prop` is active AND actually expanded from a
  // resolved DS (via _data_prop_mirror), the DS's items array is
  // ALREADY being consumed as per-child data — replicated once per
  // entry inside `expanded.children`. In that case the outer
  // `items.map` loop below would render the whole strip once per DS
  // item, producing the "each chip appears N times" duplication seen
  // on fc-space-switcher. Detect this and force the static single-
  // wrapper branch below by treating the AppZet as data-source-less.
  const cfpProp = (ss as unknown as { children_from_prop?: unknown }).children_from_prop;
  const isVariadicFromDs =
    typeof cfpProp === 'string' &&
    cfpProp.length > 0 &&
    Object.keys(expanded.entryOverrides).length > 0;

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
        {optionDsEntries.map(([propName, dsSlug]) => {
          // Resolve the DS's own query_params for this fetch (route.slug
          // for fc-space-detail, etc.) — without this, OptionDataSourceFetcher
          // fetches with no params and returns [] for any route-param
          // bound DS (topic dropdown stayed empty on create/edit post).
          const optDs = catalogIndex.dataSourceBySlug.get(dsSlug);
          const optParams = optDs
            ? resolveQueryParams(optDs.query_params)
            : undefined;
          return (
            <OptionDataSourceFetcher
              key={propName + ':' + dsSlug}
              propName={propName}
              dsSlug={dsSlug}
              params={optParams}
              onLoaded={handleOptionLoaded}
            />
          );
        })}
      </>
    ) : null;

  // Style-variable stamping. Two sources feed into --appza-* CSS
  // custom props on the AppZet wrapper:
  //   1. `_style` bag (used by the per-space runtime config, where a
  //      nested object keeps knobs grouped)
  //   2. FLAT root keys on default_props_override whose name matches a
  //      known style knob — this is the shape the right-panel
  //      Properties editor writes (each schema entry is flat).
  // Flat keys win over _style bag when both present (right-panel edit
  // is the authoritative author intent).
  const STYLE_KNOBS = new Set<string>([
    'gap',
    'chip_radius',
    'chip_bg_color',
    'chip_text_color',
    'active_bg_color',
    'active_text_color',
    'active_border_color',
    'active_color',
    'font_weight',
    'height',
    'aspect_ratio',
    'overlay_gradient',
  ]);
  // Aliases: some knobs also drive Ionic's own CSS custom properties
  // directly. Custom props inherit through shadow DOM (unlike `background`
  // set via `::part(native)` which has cascade quirks), so stamping the
  // Ionic-native var name on the wrapper is the reliable path to live
  // Ionic-component updates.
  //   chip_bg_color   → --background          (ion-button surface)
  //   chip_text_color → --color               (ion-button label)
  //   chip_radius     → --border-radius       (ion-button + ion-chip)
  const IONIC_ALIASES: Record<string, string[]> = {
    chip_bg_color:   ['--background'],
    chip_text_color: ['--color'],
    chip_radius:     ['--border-radius'],
  };
  const dpoForStyle = (appzet.default_props_override ?? {}) as Record<string, unknown>;
  const styleBag = dpoForStyle['_style'];
  const styleVars: Record<string, string> = {};
  const stampVar = (k: string, v: unknown) => {
    if (typeof v !== 'string' && typeof v !== 'number') return;
    const s = String(v);
    if (s === '') return;
    styleVars['--appza-' + k.replace(/_/g, '-')] = s;
    const aliases = IONIC_ALIASES[k];
    if (aliases) {
      for (const alias of aliases) styleVars[alias] = s;
    }
  };
  if (styleBag && typeof styleBag === 'object' && !Array.isArray(styleBag)) {
    for (const [k, v] of Object.entries(styleBag as Record<string, unknown>)) stampVar(k, v);
  }
  for (const k of STYLE_KNOBS) {
    if (k in dpoForStyle) stampVar(k, dpoForStyle[k]);
  }

  // No data source: render once with static overrides. Child actions still
  // apply (login button, create-post button, etc. — anything that doesn't
  // need per-item data context) so we compute them with a null item.
  if (!dataSource) {
    const staticActions = computeChildActions(expanded.children, appzet, undefined);
    return (
      <>
        {optionFetchers}
        <div
          className={wrapperClass}
          data-slug={appzet.slug}
          data-spaces-active-tab={appzet.slug === 'fc-spaces-tabs' ? spacesTab : undefined}
          data-space-detail-active-subtab={appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab : undefined}
          data-space-detail-active-topic={appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug : undefined}
          data-space-detail-active-space={appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug : undefined}
          style={{ ...spacingStyle(spacing), ...styleVars } as React.CSSProperties}
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
            activeChildValue={
              appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab :
              appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug :
              appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug :
              appzet.slug === 'fc-spaces-tabs' ? spacesTab :
              undefined
            }
            expandedChildren={expanded.children}
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
    const skeletonCount = isPaginated ? 3 : 1;
    return (
      <>
        {optionFetchers}
        <div
          className="appza-renderer-skeleton-list"
          data-slug={appzet.slug}
          aria-busy="true"
          aria-live="polite"
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <AppzetSkeleton key={i} slug={appzet.slug} />
          ))}
        </div>
      </>
    );
  }

  // Empty state — a paginated data source that returned zero items (e.g.
  // 'unanswered' sort with no matching posts, or a fresh community with
  // an empty feed). Non-paginated single-fetch keeps the previous behavior
  // of rendering one empty card, which is useful for spot-fetched appzets
  // that always exist (e.g. current user avatar).
  if (isPaginated && !dataState.loading && dataState.items.length === 0) {
    return (
      <>
        {optionFetchers}
        <div
          className="appza-renderer-empty"
          data-slug={appzet.slug}
          data-view-mode={variantSlug ? feedViewMode : undefined}
        >
          <p>No posts to show</p>
          <small>Try a different sort or come back later.</small>
        </div>
      </>
    );
  }

  // Spaces list: apply client-side search + sort against spacesControls.
  // Scoped by data source slug (fc-spaces-all / fc-spaces-my) so other
  // AppZets sharing the list layout aren't affected. Search matches
  // title OR description (case-insensitive substring). Sort is now
  // catalog-driven: fc-space-card.default_props.sort_specs is an array
  // of { value, field, dir } entries. Renderer picks the entry whose
  // value === spacesSort and sorts generically by that field + dir.
  // Unmapped value / missing sort_specs → title-asc fallback.
  let filteredItems = dataState.items;
  const dsSlug = dataSource?.slug ?? '';
  if (dsSlug === 'fc-spaces-all' || dsSlug === 'fc-spaces-my') {
    if (spacesSearch && spacesSearch.trim().length > 0) {
      const needle = spacesSearch.toLowerCase();
      filteredItems = filteredItems.filter((it) => {
        if (!it || typeof it !== 'object') return false;
        const rec = it as Record<string, unknown>;
        const title = typeof rec.title === 'string' ? rec.title.toLowerCase() : '';
        const desc = typeof rec.description === 'string' ? rec.description.toLowerCase() : '';
        return title.includes(needle) || desc.includes(needle);
      });
    }
    const activeSortSpec = resolveSortSpec(appzet, spacesSort);
    filteredItems = [...filteredItems].sort((a, b) => {
      const ra = (a ?? {}) as Record<string, unknown>;
      const rb = (b ?? {}) as Record<string, unknown>;
      return compareByFieldDir(ra, rb, activeSortSpec.field, activeSortSpec.dir);
    });
  }

  // When children_from_prop consumed the DS items directly (via
  // _data_prop_mirror expanding one child per row), the SS template
  // has ALREADY been replicated once per space/topic/tab inside
  // `expanded.children`. If we ALSO map the items array here we'd
  // render the whole strip once per row (fc-space-switcher showed
  // each chip twice → NxN duplication). Collapse to a single virtual
  // item so the list wrapper stays (keeping the -list CSS selectors +
  // data-* attributes) but the strip renders exactly once.
  const items = isVariadicFromDs
    ? [{}]
    : filteredItems.length > 0
    ? filteredItems
    : [{}];
  const ssChildren = expanded.children;

  return (
    <>
      {optionFetchers}
      <div
        className="appza-renderer-appzet-list"
        data-slug={appzet.slug}
        data-view-mode={variantSlug ? feedViewMode : undefined}
        data-appza-swap-from={variantSlug ? appzetSlug : undefined}
        data-spaces-active-tab={appzet.slug === 'fc-spaces-tabs' ? spacesTab : undefined}
        data-space-detail-active-subtab={appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab : undefined}
        data-space-detail-active-topic={appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug : undefined}
        data-space-detail-active-space={appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug : undefined}
        style={Object.keys(styleVars).length > 0 ? (styleVars as React.CSSProperties) : undefined}
      >
      {items.map((item, idx) => {
        // Enrich the raw item with computed viewer-scoped fields (e.g.
        // whether the current user has liked / bookmarked this item)
        // so field_mappings can bind icon + color straight off the data
        // without renderer needing to know about reactions.
        const enrichedItem = enrichItemWithMyReactions(item);
        const itemOverrides = mergeFieldMappingsOntoOverrides(baseChildOverrides, appzet, enrichedItem);
        const dataHidden = computeDataHiddenIndices(ssChildren, enrichedItem);
        const effectiveHidden =
          dataHidden.size === 0
            ? hiddenIndices
            : new Set<number>([...hiddenIndices, ...dataHidden]);
        const childOpenUrls = computeChildOpenUrls(ssChildren, enrichedItem);
        const childActions = computeChildActions(ssChildren, appzet, enrichedItem);
        // Stamp the item's identifier on the wrapper so the shell can
        // target one specific card imperatively (e.g. flip a reaction
        // icon after like/bookmark without a full data refetch). We
        // accept either `id` or `_id` since Source Integrations vary,
        // and coerce to string for use in DOM selectors.
        const rawItemId = isRecord(item)
          ? ((item as Record<string, unknown>).id ?? (item as Record<string, unknown>)._id)
          : undefined;
        const itemIdAttr =
          typeof rawItemId === 'string' || typeof rawItemId === 'number'
            ? String(rawItemId)
            : undefined;
        return (
          <div
            className={wrapperClass}
            data-slug={appzet.slug}
            data-appza-item-id={itemIdAttr}
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
              activeChildValue={
                appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab :
                appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug :
                appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug :
                appzet.slug === 'fc-spaces-tabs' ? spacesTab :
                undefined
              }
              expandedChildren={expanded.children}
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
 * Skeleton placeholder for an AppZet whose data is loading. The wrapper
 * carries the AppZet's slug so per-slug CSS can shape the skeleton to
 * match the real content (post-card = header row + body + media block;
 * composer teaser = avatar + input pill; feed banner = wide block).
 * Everything animates via the shared `appza-shimmer` keyframe defined
 * in styles.css — no JS timing, purely CSS.
 */
function AppzetSkeleton({ slug }: { slug: string }) {
  return (
    <div className="appza-renderer-skeleton" data-slug={slug}>
      <span className="appza-skel-line appza-skel-w-40" />
      <span className="appza-skel-line appza-skel-w-70" />
      <span className="appza-skel-line appza-skel-w-90" />
      <span className="appza-skel-block" />
    </div>
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
  params,
  onLoaded,
}: {
  propName: string;
  dsSlug: string;
  params?: Record<string, unknown>;
  onLoaded: (propName: string, items: Array<{ value: string; label: string }>) => void;
}) {
  const { items, loading, error } = useDataSource(dsSlug, params);
  useEffect(() => {
    if (loading || error) return;
    // Some option props (e.g. `topic_options` on fc-post-information)
    // source from a DS whose payload is a single object with a nested
    // array — fc-space-detail returns `{topics: [{slug,title,...}, ...]}`
    // as its single item, and we want the topics list as the option
    // set, not the wrapping space object. Detect by prop name so we
    // don't reshape unrelated single-item responses. Extendable via a
    // catalog-side items_path if a third case surfaces.
    let source: unknown[] = items;
    if (propName === 'topic_options' && items.length === 1 && isRecord(items[0])) {
      const rec = items[0] as Record<string, unknown>;
      if (Array.isArray(rec.topics)) source = rec.topics as unknown[];
    }
    const mapped = source
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const rec = raw as Record<string, unknown>;
        // FC's /feeds/create + /feeds/update expect topic_ids (array of
        // ints), so for topic_options the option value must be the topic
        // id, not the slug. Other option DSes (space_options etc.) keep
        // the slug-first fallback since their endpoints key on slug.
        const value =
          propName === 'topic_options'
            ? String(rec.id ?? rec.slug ?? '')
            : String(rec.slug ?? rec.id ?? '');
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
/**
 * Enrich an item with computed viewer-scoped keys so field_mappings can
 * bind reaction icon + color directly off the data. Only fluent-community
 * shape today (item.reactions is an array of `{ user_id, type }`); a
 * missing reactions array or missing viewer id is a no-op (returns the
 * item unchanged). Handles both flat items and `{ data: {...} }` wrappers.
 *
 * The viewer id is read from `window.__appzaCurrentUserId`, populated by
 * the shell after auth.login. Reactions are matched exactly on numeric
 * user_id — anonymous viewers see the default outline icons.
 *
 * Emitted keys on the item:
 *   _like_icon / _like_color         — 'heart' + 'danger'  when reacted, else defaults
 *   _bookmark_icon / _bookmark_color — 'bookmark' + 'primary' when reacted, else defaults
 */
function enrichItemWithMyReactions(item: unknown): unknown {
  if (!isRecord(item)) return item;
  const viewerId =
    typeof (globalThis as { __appzaCurrentUserId?: unknown }).__appzaCurrentUserId === 'number'
      ? ((globalThis as { __appzaCurrentUserId?: number }).__appzaCurrentUserId as number)
      : null;
  const src = (item as Record<string, unknown>);
  const myTypes = new Set<string>();
  // Preferred: `my_reactions` array injected server-side by the plug-in
  // proxy (batch DB read of the viewer's rows in wp_fcom_post_reactions).
  // Falls back to walking `reactions[]` for Sources / envs that don't
  // enrich server-side — the feed's built-in reactions list only carries
  // `type='like'` in FC (bookmarks are filtered out there), so the
  // server-side path is the only way to detect bookmark state.
  const myServer = src.my_reactions
    ?? (isRecord(src.data) ? (src.data as Record<string, unknown>).my_reactions : undefined);
  if (Array.isArray(myServer)) {
    for (const t of myServer) {
      if (typeof t === 'string') myTypes.add(t);
    }
  } else if (viewerId != null) {
    const reactionsRaw =
      src.reactions ?? (isRecord(src.data) ? (src.data as Record<string, unknown>).reactions : undefined);
    const reactions = Array.isArray(reactionsRaw) ? (reactionsRaw as unknown[]) : [];
    for (const r of reactions) {
      if (!isRecord(r)) continue;
      const uid = (r as Record<string, unknown>).user_id;
      const type = (r as Record<string, unknown>).type;
      const uidNum = typeof uid === 'number' ? uid : typeof uid === 'string' ? Number(uid) : NaN;
      if (uidNum === viewerId && typeof type === 'string') {
        myTypes.add(type);
      }
    }
  }
  const enriched: Record<string, unknown> = { ...src };
  enriched._like_icon = myTypes.has('like') ? 'heart' : 'heart-outline';
  // `medium` is Ionic's neutral gray — used for the un-reacted resting
  // state so the icon looks quiet. Field mappings ignore null/undefined,
  // so we ALWAYS emit a real string here otherwise un-reacting would
  // leave the previous color stuck on the button.
  enriched._like_color = myTypes.has('like') ? 'danger' : 'medium';
  enriched._bookmark_icon = myTypes.has('bookmark') ? 'bookmark' : 'bookmark-outline';
  enriched._bookmark_color = myTypes.has('bookmark') ? 'primary' : 'medium';
  return enriched;
}

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
  /**
   * When set, stamps `data-active="true"` onto the child wrapper whose
   * `data-value` equals this string. Used by the space-detail topics chip
   * strip / subtabs / switcher so per-chip active-state CSS rules
   * (blue border on the active chip) can key off a plain attribute
   * selector instead of trying to correlate two ancestor attributes.
   * Passed only at depth 0; deeper children ignore it.
   */
  activeChildValue?: string;
  /**
   * Pre-expanded child list. Used at depth 0 when the SS opts into
   * `children_from_prop` — the caller reads the AppZet's tabs array
   * and expands `ss.children[0]` as a template. When undefined we fall
   * back to `readChildren(ss)`, which is the static-children path.
   */
  expandedChildren?: SSChild[];
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
  activeChildValue,
  expandedChildren,
}: SuperstructureRendererProps) {
  const dispatch = useActionDispatch();

  if (depth > MAX_DEPTH) {
    return <MissingNode label={`depth>${MAX_DEPTH} at ${ss.slug}`} />;
  }

  const children = expandedChildren ?? readChildren(ss);
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
        // Self-action primitives (ion-select) fire dispatch from their own
        // native event, not the wrapper's onClick — otherwise clicking to
        // open the dropdown would dispatch before the user picks a value.
        //
        // BUT: when the SS explicitly wires the child's `on_click_action`
        // (i.e. the tap semantics ARE the whole event source, as with
        // fc-post-composer-teaser's ion-input pill), the wrapper still
        // needs the onClick. Otherwise the placeholder-only input pill
        // swallows the tap and no navigation fires. `child.on_click_action`
        // is the SS-level authoritative signal for "the whole wrapper is
        // a tap target regardless of primitive class".
        const primitiveSelfHandles =
          SELF_ACTION_PRIMITIVES.has(child.slug) && !child.on_click_action;
        const wrapperAction = action && !primitiveSelfHandles ? action : undefined;
        const primitiveAction = action && primitiveSelfHandles ? action : undefined;
        const rendered = renderChild(
          child.slug,
          catalogIndex,
          depth + 1,
          childOverrides?.[idx],
          primitiveAction,
        );
        const wrapperClass = [
          'appza-renderer-ss-child',
          openUrl ? 'appza-renderer-ss-child-linked' : '',
          wrapperAction ? 'appza-renderer-ss-child-actionable' : '',
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
            data-appza-action={child.on_click_action}
            data-value={(() => {
              const v = childOverrides?.[idx]?.value;
              return typeof v === 'string' || typeof v === 'number' ? String(v) : undefined;
            })()}
            data-active={(() => {
              if (!isTopLevel || activeChildValue === undefined) return undefined;
              // Only mark active when the child has an EXPLICIT `value`
              // override — the empty-string "All" chip is fine, but the
              // static "Choose topic" section header (no value key) must
              // not falsely match activeChildValue=''.
              const bucket = childOverrides?.[idx];
              if (!bucket || !('value' in bucket)) return undefined;
              const v = bucket.value;
              const asStr = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
              return asStr === activeChildValue ? 'true' : undefined;
            })()}
            style={childLayoutStyle ? layoutStyleToCss(childLayoutStyle) : undefined}
            onClick={wrapperAction
              ? (e) => {
                  e.stopPropagation();
                  // Stamp the child's declared `value` onto action.item so
                  // tab/segmented dispatchers can read the picked value the
                  // same way ion-select does. Also carry the entry's
                  // identifying keys (slug, id, space, ...) — variadic
                  // children (fc-space-switcher, fc-space-topics) fire
                  // actions like nav.push{pass_item_as_context} which read
                  // ctx.slug, not ctx.value. `text` is presentation only
                  // and stays out of the item payload.
                  const bucket = (childOverrides?.[idx] ?? {}) as Record<string, unknown>;
                  const entryPayload: Record<string, unknown> = {};
                  for (const [k, v] of Object.entries(bucket)) {
                    if (k === 'text') continue;
                    entryPayload[k] = v;
                  }
                  const dispatched =
                    Object.keys(entryPayload).length > 0
                      ? {
                          ...wrapperAction,
                          item: {
                            ...((wrapperAction.item as
                              | Record<string, unknown>
                              | null
                              | undefined) ?? {}),
                            ...entryPayload,
                          },
                        }
                      : wrapperAction;
                  dispatch(dispatched);
                }
              : undefined}
            role={wrapperAction ? 'button' : undefined}
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
  action?: ActionInvocation,
) {
  const primitive = catalogIndex.primitiveBySlug.get(slug);
  if (primitive) {
    return <PrimitiveRenderer primitive={primitive} overrides={overrides} action={action} />;
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
  /**
   * Template-only. On the SS template child of a `children_from_prop` SS
   * (i.e. `ss.children[0]` unless `template_index` overrides), declares
   * explicit per-entry prop stamping. Shape: `{ <prop>: 'entry.<path>' }`.
   * For each expanded entry, the renderer looks up the entry path and
   * stamps the value into the expanded child's override bucket at the
   * mapped key. Applied AFTER the naive-stamp fallback so explicit
   * mappings win — this lets DS-shaped entries (`{title, slug, ...}`) map
   * `title -> text` without needing the entries to be pre-shaped.
   * Non-`entry.` values are ignored (reserved for future literals).
   */
  field_mapping?: Record<string, string>;
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
      if (rec.field_mapping && typeof rec.field_mapping === 'object' && !Array.isArray(rec.field_mapping)) {
        const fm: Record<string, string> = {};
        for (const [k, v] of Object.entries(rec.field_mapping as Record<string, unknown>)) {
          if (typeof v === 'string') fm[k] = v;
        }
        if (Object.keys(fm).length > 0) out.field_mapping = fm;
      }
      return out;
    })
    .filter((c): c is SSChild => c !== null);
}

/**
 * Reads the AppZet's default_props array named by `ss.children_from_prop`
 * (typically 'tabs') and, if present + non-empty, expands `ss.children[0]`
 * as a template into one synthetic child per array entry. When the prop
 * is absent or the array is empty, returns `readChildren(ss)` unchanged so
 * static SS definitions keep working.
 *
 * Additionally emits per-entry override buckets ({ text, value, ...rest })
 * so the caller can merge them into the child override map at each index.
 */
function readExpandedChildren(
  ss: Superstructure,
  appzet: AppZet,
): { children: SSChild[]; entryOverrides: Record<number, Record<string, unknown>> } {
  const propName = (ss as unknown as { children_from_prop?: unknown }).children_from_prop;
  const staticChildren = readChildren(ss);
  if (typeof propName !== 'string' || propName.length === 0) {
    return { children: staticChildren, entryOverrides: {} };
  }
  const overrides = appzet.default_props_override as Record<string, unknown> | null | undefined;
  const rawEntries = overrides ? overrides[propName] : undefined;
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return { children: staticChildren, entryOverrides: {} };
  }
  // The template child is the shape cloned per entry. Look for a child
  // with `template: true` first — this lets a variadic SS keep static
  // children BEFORE the template (used for section headers like "Choose
  // topic" prepended above the topic chip strip). No `template: true`
  // marker → children[0] is the template (back-compat).
  // Children before the template_index render as-is (no field_mapping,
  // no data stamping).
  const rawChildren = (ss as unknown as { children?: unknown[] }).children ?? [];
  let templateIndex = 0;
  for (let i = 0; i < rawChildren.length; i++) {
    const rc = rawChildren[i];
    if (rc && typeof rc === 'object' && (rc as Record<string, unknown>).template === true) {
      templateIndex = i;
      break;
    }
  }
  const template = staticChildren[templateIndex];
  if (!template) return { children: staticChildren, entryOverrides: {} };
  const staticPrefix = staticChildren.slice(0, templateIndex);
  // `prepend_all: true` + `all_label: '<label>'` synthesizes an entry at
  // index 0 representing the un-filtered choice — e.g. the "All" chip on
  // fc-space-topics that clears the topic filter. Uses value='' so the DS
  // query_params resolver (which omits empty-string params) drops the
  // filter cleanly instead of sending `?topic_slug=`.
  const prependAll = overrides && overrides['prepend_all'] === true;
  const allLabel =
    overrides && typeof overrides['all_label'] === 'string'
      ? (overrides['all_label'] as string)
      : 'All';
  // Synthesize the "All" entry using BOTH `label` (naive-stamp path) and
  // `title` (field_mapping path) so it works whichever convention the
  // template child uses. `slug` = '' for parity with DS-shaped entries.
  const workingEntries: unknown[] = prependAll
    ? [{ value: '', slug: '', label: allLabel, title: allLabel }, ...rawEntries]
    : rawEntries;
  const children: SSChild[] = [...staticPrefix];
  const entryOverrides: Record<number, Record<string, unknown>> = {};
  const fieldMapping = template.field_mapping;
  for (let i = 0; i < workingEntries.length; i++) {
    const entry = workingEntries[i];
    if (!isRecord(entry)) continue;
    // Skip explicit `hidden: true` entries — the customer can hide a tab
    // from the admin without removing it from the config.
    if (entry.hidden === true) continue;
    // Clone the template shape; per-entry `on_click_action` overrides win.
    const child: SSChild = {
      slug: template.slug,
      on_click_action:
        typeof entry.on_click_action === 'string'
          ? entry.on_click_action
          : template.on_click_action,
      on_click_open_url: template.on_click_open_url,
    };
    children.push(child);
    // Stamp the entry's leaf values as this child's overrides. `text`
    // + `value` are the two universal ones; anything else on the entry
    // (icon, badge_color, ...) rides along by name so future tab knobs
    // don't need a renderer change.
    const bucket: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'hidden' || k === 'on_click_action') continue;
      // Renderer convention: `label` in the tabs entry maps to the
      // primitive's `text` prop, matching how ion-button reads its label.
      if (k === 'label') {
        bucket.text = v;
      } else {
        bucket[k] = v;
      }
    }
    // Explicit field_mapping wins over the naive-stamp above. Values
    // must be of the form `entry.<path>` — anything else is ignored.
    // DS-shaped entries (`{title, slug, cover_photo, ...}`) can then map
    // `text -> entry.title`, `value -> entry.slug` without pre-shaping.
    if (fieldMapping) {
      for (const [k, spec] of Object.entries(fieldMapping)) {
        if (typeof spec !== 'string') continue;
        if (!spec.startsWith('entry.')) continue;
        // Simple dot-path walker on the entry object. Reuses the
        // readDataPath grammar for indexed segments (`entries[0].label`)
        // but scoped to the entry — hence the `data.` prefix trick to
        // reuse the shared parser: we prepend `data.` and pass `entry`
        // as the root so `data.title` resolves to `entry.title`.
        const resolved = readDataPath(entry, 'data.' + spec.slice('entry.'.length));
        if (resolved !== undefined && resolved !== null) {
          bucket[k] = resolved;
        }
      }
    }
    entryOverrides[children.length - 1] = bucket;
  }
  return { children, entryOverrides };
}

/**
 * Sort spec — { field, dir } — resolved for the current spacesSort
 * value against the AppZet's `default_props.sort_specs` array. Each
 * spec entry: `{ value, field, dir?: 'asc'|'desc' }`. Adding a sort
 * option is a JSON edit on the AppZet, not a code change.
 *
 * Fallback when the AppZet has no sort_specs, or when the picked
 * value doesn't match any entry: `{ field: 'title', dir: 'asc' }`.
 * Keeps the list stable rather than random-order when a stale
 * localStorage sort value survives a catalog edit that removed it.
 */
type SortSpec = { field: string; dir: 'asc' | 'desc' };

function resolveSortSpec(appzet: AppZet, pickedValue: string): SortSpec {
  const fallback: SortSpec = { field: 'title', dir: 'asc' };
  const overrides = appzet.default_props_override as Record<string, unknown> | null | undefined;
  const rawSpecs = overrides ? overrides['sort_specs'] : undefined;
  if (!Array.isArray(rawSpecs)) return fallback;
  for (const entry of rawSpecs) {
    if (!isRecord(entry)) continue;
    if (entry.value !== pickedValue) continue;
    const field = typeof entry.field === 'string' && entry.field.length > 0 ? entry.field : fallback.field;
    const dir = entry.dir === 'desc' ? 'desc' : 'asc';
    return { field, dir };
  }
  return fallback;
}

/**
 * Generic field comparator for sort_specs-driven ordering. Numeric
 * fields (members_count, id, ...) compare as numbers; strings use
 * locale-aware compare; nullish sorts to the end regardless of dir
 * so partial data doesn't create phantom top rows. `created_at` +
 * other ISO-8601 strings sort correctly under localeCompare.
 */
function compareByFieldDir(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  field: string,
  dir: 'asc' | 'desc',
): number {
  const av = a[field];
  const bv = b[field];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  const mul = dir === 'desc' ? -1 : 1;
  if (typeof av === 'number' && typeof bv === 'number') {
    return (av - bv) * mul;
  }
  const an = typeof av === 'number' ? av : Number(av);
  const bn = typeof bv === 'number' ? bv : Number(bv);
  if (Number.isFinite(an) && Number.isFinite(bn)) {
    return (an - bn) * mul;
  }
  const as = typeof av === 'string' ? av : String(av);
  const bs = typeof bv === 'string' ? bv : String(bv);
  return as.localeCompare(bs) * mul;
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

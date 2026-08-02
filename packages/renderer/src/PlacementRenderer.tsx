import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/react';
import type { AppZet, LayoutStyle, PropertiesSchemaEntry, Superstructure } from '@appza/schemas';
import type { CatalogIndex } from './catalogIndex';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { readDataPath, useDataSource, useDataSourcePaged } from './dataFetch';
import { isRecord, readOverride, resolveOverridableColumn } from './resolveOverride';
import { layoutStyleToCss } from './layoutStyle';
import { useActionDispatch, type ActionInvocation } from './actionContext';
import { useFeedControls } from './feedControls';
import { useSpacesControls } from './spacesControls';
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
  const requestedAppzet = catalogIndex.appzetBySlug.get(appzetSlug);
  const variantSlug =
    requestedAppzet && VIEW_MODE_VARIANTS[requestedAppzet.slug]
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
  const dataSource =
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
  // fc-feed reads sort from the shared feedControls store (see feedSort
  // above) — the fc-feed-toolbar's on_change dispatcher writes it, we
  // forward as order_by_type (FC's native query param, see FC's
  // Feed::scopeCustomOrderBy). Changing sort bumps useDataSourcePaged's
  // extraKey → reset to page 1 + refetch.
  const pagedExtraParams = pagedSlug === 'fc-feed' ? { order_by_type: feedSort } : undefined;
  const pagedState = useDataSourcePaged(pagedSlug, {
    perPage: pagedSlug ? PAGE_SIZE_BY_SLUG[pagedSlug] ?? 10 : 10,
    params: pagedExtraParams,
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
    const staticActions = computeChildActions(expanded.children, appzet, undefined);
    return (
      <>
        {optionFetchers}
        <div
          className={wrapperClass}
          data-slug={appzet.slug}
          data-spaces-active-tab={appzet.slug === 'fc-spaces-tabs' ? spacesTab : undefined}
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
  // title OR description (case-insensitive substring). Sort keys:
  // alphabetical (title A→Z), members (members_count desc), recent
  // (created_at desc; falls back to id desc when timestamp is missing).
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
    filteredItems = [...filteredItems].sort((a, b) => {
      const ra = (a ?? {}) as Record<string, unknown>;
      const rb = (b ?? {}) as Record<string, unknown>;
      switch (spacesSort) {
        case 'members': {
          const ma = typeof ra.members_count === 'number' ? ra.members_count : Number(ra.members_count ?? 0) || 0;
          const mb = typeof rb.members_count === 'number' ? rb.members_count : Number(rb.members_count ?? 0) || 0;
          return mb - ma;
        }
        case 'recent': {
          const ta = typeof ra.created_at === 'string' ? ra.created_at : '';
          const tb = typeof rb.created_at === 'string' ? rb.created_at : '';
          if (ta && tb) return tb.localeCompare(ta);
          const ia = typeof ra.id === 'number' ? ra.id : Number(ra.id ?? 0) || 0;
          const ib = typeof rb.id === 'number' ? rb.id : Number(rb.id ?? 0) || 0;
          return ib - ia;
        }
        case 'alphabetical':
        default: {
          const ta = typeof ra.title === 'string' ? ra.title : '';
          const tb = typeof rb.title === 'string' ? rb.title : '';
          return ta.localeCompare(tb);
        }
      }
    });
  }

  const items = filteredItems.length > 0 ? filteredItems : [{}];
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
        const primitiveSelfHandles = SELF_ACTION_PRIMITIVES.has(child.slug);
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
            style={childLayoutStyle ? layoutStyleToCss(childLayoutStyle) : undefined}
            onClick={wrapperAction
              ? (e) => {
                  e.stopPropagation();
                  // Stamp the child's declared `value` (from binds_to
                  // 'children[<i>].value' in the SS properties_schema)
                  // onto action.item so tab/segmented dispatchers can
                  // read the picked value the same way ion-select does.
                  // Segmented tabs (fc-spaces-tabs) declare per-child
                  // value = 'all' | 'my'; without this stamp the click
                  // dispatch lands with item=undefined.
                  const childValue = childOverrides?.[idx]?.value;
                  const dispatched =
                    childValue != null
                      ? {
                          ...wrapperAction,
                          item: {
                            ...((wrapperAction.item as
                              | Record<string, unknown>
                              | null
                              | undefined) ?? {}),
                            value: childValue,
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
  const template = staticChildren[0];
  if (!template) return { children: staticChildren, entryOverrides: {} };
  const children: SSChild[] = [];
  const entryOverrides: Record<number, Record<string, unknown>> = {};
  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
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
    entryOverrides[children.length - 1] = bucket;
  }
  return { children, entryOverrides };
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

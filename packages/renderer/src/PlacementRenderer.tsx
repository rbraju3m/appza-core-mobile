import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/react';
import type { AppZet, LayoutStyle, PropertiesSchemaEntry, Superstructure } from '@appza/schemas';
import type { CatalogIndex } from './catalogIndex';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import {
  readDataPath,
  readStateBinding,
  resolveQueryParams,
  useDataSource,
  useDataSourcePaged,
} from './dataFetch';
import { isRecord, readOverride, resolveOverridableColumn } from './resolveOverride';
import { layoutStyleToCss } from './layoutStyle';
import { useActionDispatch, type ActionInvocation } from './actionContext';
import { useFeedControls } from './feedControls';
import { useSpacesControls } from './spacesControls';
import { setSpaceDetailControls, useSpaceDetailControls } from './spaceDetailControls';
import { setChatControls, useChatControls } from './chatControls';
import { setLeaderboardControls, useLeaderboardControls } from './leaderboardControls';
import { setBookmarkControls, useBookmarkControls } from './bookmarkControls';
import { seedFeedControls, type FeedViewMode } from './feedControls';
import {
  setBannerControls,
  useBannerControls,
  getBannerControls,
  bannerStateEntries,
} from './bannerControls';
import { publishSearchFetchView, useSearchControls } from './searchControls';
import { useDocumentDraft } from './documentDraft';
import { getFcRuntimeSettings, useFcRuntimeSettings, resolveFeedSortRows } from './fcRuntimeSettings';
import { readPickerOptions } from './ViewModePopover';
import { useViewer, viewerStateEntries } from './viewer';
import { getPostDraft, postDraftStateEntries, usePostDraft } from './postDraft';
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
const PAGINATED_DATA_SOURCES = new Set<string>(['fc-feed', 'fc-space-members']);
const PAGE_SIZE_BY_SLUG: Record<string, number> = {
  'fc-feed': 10,
  // Members page size matches the FC portal's own paginate() default so
  // one "page" of the mobile list roughly matches what admins see on the
  // web. Larger spaces (100s of members) trigger IonInfiniteScroll to
  // fetch subsequent pages; the fcom-mobile /members endpoint accepts
  // `page` + `per_page` and short-page terminates the load.
  'fc-space-members': 20,
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
//
// `controls` names WHICH slice decides the mode, and `governingDs` the
// DataSource that slice is authoritative for. Saved Posts has a toolbar
// of its own writing a slice of its own, so without both fields picking
// Card there would swap in the FEED's tile — still fetching the feed —
// and picking Card on the feed would reshape the saved list behind it.
const VIEW_MODE_VARIANTS: Record<
  string,
  { card?: string; list?: string; controls: 'feed' | 'bookmarks'; governingDs: string }
> = {
  'fc-post-card': {
    card: 'fc-post-grid-item',
    list: 'fc-post-list-item',
    controls: 'feed',
    governingDs: 'fc-feed',
  },
  'fc-bookmark-card': {
    card: 'fc-bookmark-grid-item',
    list: 'fc-bookmark-list-item',
    controls: 'bookmarks',
    governingDs: 'fc-bookmarks',
  },
};

// Which control slice each sort/layout toolbar reflects. Both toolbars
// ride the same Superstructure (fc-feed-toolbar) — they are two AppZets,
// not two shapes — so the slug is what distinguishes them.
const TOOLBAR_CONTROL_SLICES: Record<string, 'feed' | 'bookmarks'> = {
  'fc-feed-toolbar': 'feed',
  'fc-bookmarks-toolbar': 'bookmarks',
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
    documents_search: spaceDetailDocumentsSearch,
    media_type: spaceDetailMediaType,
  } = useSpaceDetailControls();
  // FluentCommunity portal customization: mirrors Settings → Customization
  // → "Members List Layout". Read here so the fc-member-card wrapper can
  // stamp a data-fc-member-layout attribute for the CSS to swap between
  // the 2-column grid and the horizontal list layout. Read unconditionally
  // for stable hook order (subscribes to a small store; no cost when
  // unused by non-member AppZets).
  const fcSettings = useFcRuntimeSettings();
  const { member_list_layout: fcMemberListLayout } = fcSettings;
  // Add-document draft — read unconditionally for stable hook order. Only
  // the topic chips consume it, to mark several chips active at once.
  const documentDraft = useDocumentDraft();
  // The create-post draft, subscribed to for the same reason: child
  // `visible_when` clauses now read `state.post_draft.*`, and the attach
  // bar has to re-evaluate the moment a document is attached. The clause
  // evaluator reads the store directly; this hook is what makes the
  // component re-render so it is asked again.
  const composerDraft = usePostDraft();
  const chatControls = useChatControls();
  // Leaderboard screen controls. Read unconditionally for stable hook
  // order, same as every slice above — the ranking strip needs `range`
  // to mark its active tab, and the two verdicts are published from
  // here after the levels and ranks fetches land.
  const leaderboardControls = useLeaderboardControls();
  // The viewer. Read unconditionally for stable hook order, same as
  // every slice above — a child's visible_when can gate on
  // `state.viewer.is_logged_in`, which is how the composer teaser
  // disappears on a logged-out feed (design 17).
  const viewer = useViewer();
  // Feed banner. Read unconditionally for stable hook order, same as
  // every slice above — the View More row and CTA slots 2..4 are children
  // whose visible_when reads `state.feed_banner.*`, and the clause
  // evaluator consults the store directly, so this hook is what makes
  // the component re-render and ask again.
  const bannerControls = useBannerControls();
  // Saved Posts controls. Read unconditionally for stable hook order,
  // same as every slice above — the toolbar reflects sort and layout,
  // fc-bookmarks binds search and sort as query params, and the
  // three-way empty verdict is published from here after each fetch.
  const bookmarkControls = useBookmarkControls();
  // Search screen controls. Read unconditionally for stable hook order,
  // same as every slice above — both strips read it to mark their active
  // entry, three DataSources bind it as query params, and the fetch
  // verdict is published from here.
  const searchControls = useSearchControls();
  const draftTopicValues = useMemo(
    () => new Set(documentDraft.topic_ids.map((id) => String(id))),
    [documentDraft.topic_ids],
  );
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
  const variantSpec = requestedAppzet ? VIEW_MODE_VARIANTS[requestedAppzet.slug] : undefined;
  const variantGovernedDs =
    !!variantSpec &&
    (!placementDsForVariant ||
      placementDsForVariant === variantSpec.governingDs ||
      (requestedAppzet?.default_data_source_id != null &&
        catalogIndex.dataSourceById.get(requestedAppzet.default_data_source_id)?.slug ===
          variantSpec.governingDs &&
        !placementDsForVariant));
  const variantViewMode =
    variantSpec?.controls === 'bookmarks' ? bookmarkControls.viewMode : feedViewMode;
  const variantSlug =
    variantSpec && variantGovernedDs
      ? variantViewMode === 'card'
        ? variantSpec.card
        : variantViewMode === 'list'
          ? variantSpec.list
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
          // A sort/layout toolbar reflects the persisted preference in its
          // own controls — the sort button reads "<sort_label> <label>",
          // where <label> comes from scanning the action wiring's
          // args.options for the current value. No match falls back to the
          // raw key, which is better than showing the prefix alone.
          //
          // TWO toolbars now, against two different slices: the feed's
          // (feedControls) and Saved Posts' (bookmarkControls). Keyed off
          // the slug rather than branching, the way the leaderboard tabs
          // taught activeChildValue a second slug rather than forking the
          // Superstructure.
          //
          // `sort_label` is read here rather than hard-coded. It has been
          // authored on fc-feed-toolbar since that toolbar shipped and
          // nothing ever consumed it — a control in the right panel that
          // did nothing (P74).
          ...(TOOLBAR_CONTROL_SLICES[baseAppzet.slug]
            ? (() => {
                const slice = TOOLBAR_CONTROL_SLICES[baseAppzet.slug]!;
                const sortValue = slice === 'bookmarks' ? bookmarkControls.sort : feedSort;
                const viewValue =
                  slice === 'bookmarks' ? bookmarkControls.viewMode : feedViewMode;
                const authored = (baseAppzet.default_props_override ?? {}) as Record<
                  string,
                  unknown
                >;
                const prefix =
                  typeof authored.sort_label === 'string' && authored.sort_label
                    ? authored.sort_label
                    : 'Sort by:';
                const actions = (baseAppzet.actions ?? null) as Record<string, unknown> | null;
                const sortWiring = actions && actions.on_change_sort;
                const opts =
                  isRecord(sortWiring) && isRecord((sortWiring as Record<string, unknown>).args)
                    ? (((sortWiring as Record<string, unknown>).args as Record<string, unknown>).options)
                    : undefined;
                // The FEED's button names the row the SHEET will draw, so
                // it reads the same merged list the dispatcher opens with
                // — otherwise a sort the admin added in FluentCommunity
                // would open a sheet that has it and a button that shows
                // the raw key. Saved Posts keeps the catalog list; its
                // rows are not site-driven.
                const catalogRows = readPickerOptions(opts);
                const rows =
                  slice === 'feed'
                    ? resolveFeedSortRows(catalogRows, viewer.is_logged_in)
                    : catalogRows;
                let label = sortValue;
                const match = rows.find((o) => o.value === sortValue);
                if (match) label = match.label;
                // View-toggle icon reflects current view mode so the user
                // sees immediate feedback of their pick (grid for card,
                // rows for list, lines for timeline).
                const viewIcon =
                  viewValue === 'card'
                    ? 'grid-outline'
                    : viewValue === 'list'
                      ? 'reorder-four-outline'
                      : 'list-outline';
                // FluentCommunity's two "Disable ... Change" switches, as
                // a FORCED-OFF only. Writing `true` when the site allows
                // the picker would clobber a builder who turned it off in
                // the panel; writing `false` when the site forbids it is
                // the one direction where the site has to win. Applied
                // for the feed only — both switches are feed settings,
                // and Saved Posts rides the same Superstructure.
                const siteDisables =
                  slice === 'feed'
                    ? {
                        ...(fcSettings.feed.sort_change_disabled ? { show_sort: false } : {}),
                        ...(fcSettings.feed.layout_change_disabled
                          ? { show_view_toggle: false }
                          : {}),
                      }
                    : {};
                return {
                  sort_button_text: `${prefix} ${label}`,
                  default_sort: sortValue,
                  default_view_mode: viewValue,
                  view_toggle_icon: viewIcon,
                  ...siteDisables,
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
    // The viewer, keyed the same way ScreenRenderer keys it so a CHILD
    // gate and a PLACEMENT gate read one vocabulary (P104).
    ...Object.fromEntries(
      Object.entries(viewerStateEntries(viewer)).map(([k, v]) => [`state.${k}`, v]),
    ),
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
    'state.leaderboard_controls.range': leaderboardControls.range,
    'state.leaderboard_controls.levels_scope': leaderboardControls.levels_scope,
    // Saved Posts. `search` and `sort` are what fc-bookmarks binds as
    // query params, so writing either is a refetch; `view` is the
    // three-way verdict the search pill, the toolbar and the two empty
    // states all gate on.
    'state.bookmark_controls.search': bookmarkControls.search,
    'state.bookmark_controls.sort': bookmarkControls.sort,
    'state.bookmark_controls.view_mode': bookmarkControls.viewMode,
    'state.bookmark_controls.view': bookmarkControls.view,
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
  // A source declaring `client_state_binding` reads a renderer state slice
  // instead of fetching (the Search screen's recent-search list). The hook
  // never sees the catalog, so the binding has to travel with the slug.
  const clientStateBinding = dataSource?.client_state_binding || null;
  const staticState = useDataSource(staticSlug, staticParams, clientStateBinding);
  const dataState = isPaginated
    ? {
        items: pagedState.items,
        loading: pagedState.loading,
        error: pagedState.error,
        // The paged hook accumulates across pages, so there is no single
        // params key its items belong to. Nothing paginated publishes a
        // verdict today; if one ever does, this needs the same treatment.
        stale: false,
      }
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

  // DOCUMENTS sub-tab (2026-08-16). The tab has three designs — list,
  // "No documents yet", "No matches" — and the search bar is absent from
  // the first. None of that is decidable at placement level, which only
  // sees state, so the AppZet bound to the documents DS publishes which
  // design applies and the sibling placements gate on it.
  //
  // Scoped to this one DS deliberately: it's the same narrow special-case
  // shape as the fc-spaces-all / fc-spaces-my search-and-sort branch below,
  // and generalising it (every DS publishing a count into state) would put
  // a write in every list AppZet's render path for one consumer.
  const publishesDocumentsView = (dataSource?.slug ?? '') === 'fc-space-documents';
  useEffect(() => {
    if (!publishesDocumentsView) return;
    // Hold the last resolved view while a refetch is in flight. Publishing
    // 'loading' on every keystroke would unmount the search bar (which is
    // gated on this value) mid-typing and throw away the field's text.
    if (dataState.loading) return;
    const view =
      dataState.items.length > 0
        ? 'list'
        : spaceDetailDocumentsSearch.trim().length > 0
          ? 'no-match'
          : 'empty';
    setSpaceDetailControls({ documents_view: view });
  }, [
    publishesDocumentsView,
    dataState.loading,
    dataState.items.length,
    spaceDetailDocumentsSearch,
  ]);

  // MEDIA sub-tab (2026-08-17). Same P75 shape as documents above, one
  // design simpler: which of the two content shapes renders is decided by
  // media_type, which the tab strip authors, so only the empty state needs
  // a published verdict.
  //
  // BOTH content AppZets bind this DS, and only one of them is mounted at a
  // time (the placements gate on media_type), so whichever is on screen is
  // the one publishing. There is no "no-match" case — the media tabs have
  // no search.
  const publishesMediaView = (dataSource?.slug ?? '') === 'fc-space-media';
  useEffect(() => {
    if (!publishesMediaView) return;
    // Hold the previous verdict across a refetch. Publishing 'loading' on a
    // tab switch would flash the empty state between Photos and Videos.
    if (dataState.loading) return;
    setSpaceDetailControls({ media_view: dataState.items.length > 0 ? 'list' : 'empty' });
  }, [publishesMediaView, dataState.loading, dataState.items.length]);

  // Conversation screen (2026-08-18). Same P75 shape again, and the
  // simplest instance of it: one content AppZet, one empty state, no
  // search. The message list is NOT gated on this — it has to stay
  // mounted to run the fetch that decides the verdict in the first
  // place.
  const publishesMessagesView = (dataSource?.slug ?? '') === 'fc-chat-messages';
  useEffect(() => {
    if (!publishesMessagesView) return;
    // Hold the previous verdict across a refetch, so sending a message
    // does not flash "No messages yet" between the POST and the reload.
    if (dataState.loading) return;
    setChatControls({ messages_view: dataState.items.length > 0 ? 'list' : 'empty' });
  }, [publishesMessagesView, dataState.loading, dataState.items.length]);

  // Leaderboard (2026-08-19). Two more P75 verdicts, one per card.
  //
  // The levels card publishes THREE states rather than the usual two,
  // because VIEW ALL has three reasons not to be there and a placement
  // predicate is a single clause: a guest gets no card at all ('empty'),
  // an expanded card has nothing left to show ('complete'), and so does a
  // community configured with three levels or fewer. `has_more` is
  // decided server-side and stamped on every row, so this reads the
  // first row rather than counting anything.
  const publishesLevelsView = (dataSource?.slug ?? '') === 'fc-leaderboard-levels';
  useEffect(() => {
    if (!publishesLevelsView) return;
    // Hold the last verdict across a refetch. Publishing 'loading' when
    // VIEW ALL is tapped would unmount the button mid-press and the
    // expanded card would arrive with the tap looking like it missed.
    if (dataState.loading) return;
    const first = dataState.items[0];
    const view =
      dataState.items.length === 0
        ? 'empty'
        : isRecord(first) && first.has_more === true
          ? 'more'
          : 'complete';
    setLeaderboardControls({ levels_view: view });
  }, [publishesLevelsView, dataState.loading, dataState.items]);

  // The ranking card's empty state. Zero rows reads two ways — nobody has
  // scored in this range, and the viewer may not see who has — and both
  // land here deliberately: the plug-in answers a denial with an empty
  // list rather than an error, because an error would fall through the
  // proxy into fixture data.
  const publishesRanksView = (dataSource?.slug ?? '') === 'fc-leaderboard-ranks';
  useEffect(() => {
    if (!publishesRanksView) return;
    // Hold across the refetch a tab tap triggers, or the empty state
    // flashes between Last 7 days and All time.
    if (dataState.loading) return;
    setLeaderboardControls({ ranks_view: dataState.items.length > 0 ? 'list' : 'empty' });
  }, [publishesRanksView, dataState.loading, dataState.items.length]);

  // Saved Posts (2026-08-19). The same P75 shape as the documents tab,
  // and for the same reason: three designs — the list, "No saved posts
  // yet" and "No matches" — and the difference between the last two is
  // the SEARCH VALUE, which a placement cannot see any more than it can
  // see a row count.
  //
  // The card publishing this is deliberately ungated: it has to stay
  // mounted to run the fetch that decides the verdict in the first place.
  const publishesBookmarksView = (dataSource?.slug ?? '') === 'fc-bookmarks';
  useEffect(() => {
    if (!publishesBookmarksView) return;
    // Hold the last verdict while a refetch is in flight. Publishing
    // 'loading' on every keystroke would unmount the search pill — which
    // gates on this value — mid-typing and throw away the text in it.
    //
    // `loading` alone is not enough: it is set in an effect, so in the
    // commit where the search changes this still reads false next to the
    // PREVIOUS search's items. Clearing a search that had matched nothing
    // therefore published 'empty' — zero items, no search text — and the
    // search pill and sort strip vanished until the full list landed 1.7s
    // later. `stale` says the items belong to different params, which is
    // the question actually being asked.
    if (dataState.loading || dataState.stale) return;
    const view =
      dataState.items.length > 0
        ? 'list'
        : bookmarkControls.search.trim().length > 0
          ? 'no-match'
          : 'empty';
    setBookmarkControls({ view });
  }, [
    publishesBookmarksView,
    dataState.loading,
    dataState.stale,
    dataState.items.length,
    bookmarkControls.search,
  ]);

  // Admin defaults for the feed's sort and layout, applied ONCE and only
  // to a viewer who has never chosen. Nothing seeded this slice before:
  // it started at its own hard `latest` / `timeline`, and the block above
  // overwrites the toolbar's `default_sort` / `default_view_mode` props
  // with the CURRENT slice values before they could reach anything — so
  // the builder's control and the admin's setting were both dead.
  //
  // The two settings are asymmetric, and that is FluentCommunity's
  // asymmetry rather than ours. `default_feed_sort_by` genuinely stores
  // an empty string for "no preference", so an empty one falls through
  // to the builder's prop. `default_feed_layout` defaults to `timeline`
  // in FC's own $defaults array and is never empty, so the site always
  // has an answer and the site's answer wins — a community admin's
  // explicit choice outranks the app's, since it is their community.
  //
  // `sort_options` is the "bootstrap has landed" signal; it is `[]` until
  // the envelope arrives, and seeding off pre-envelope defaults would
  // apply FC's factory settings rather than this site's.
  const isFeedToolbar = baseAppzet?.slug === 'fc-feed-toolbar';
  const authoredToolbarProps = (baseAppzet?.default_props_override ?? null) as Record<
    string,
    unknown
  > | null;
  useEffect(() => {
    if (!isFeedToolbar) return;
    const feed = fcSettings.feed;
    if (feed.sort_options.length === 0) return;
    const authoredSort =
      typeof authoredToolbarProps?.default_sort === 'string'
        ? authoredToolbarProps.default_sort
        : '';
    const sort = feed.default_sort_by || authoredSort;
    // No fallback to the toolbar's `default_view_mode` prop, and not by
    // oversight: `default_layout` is never empty, so a fallback here
    // would be a branch that cannot run. The prop stays in the panel as
    // the pre-envelope default and is otherwise inert — worth saying out
    // loud rather than leaving as a control that quietly does nothing.
    const viewMode: FeedViewMode = feed.default_layout;
    seedFeedControls({ ...(sort ? { sort } : {}), viewMode });
  }, [isFeedToolbar, fcSettings.feed, authoredToolbarProps]);

  // The feed banner's CTA overflow — half of the `collapsible` verdict
  // the View More row gates on. The other half is the description's
  // measured height, published by AppzaRichText, and the OR is joined in
  // bannerStateEntries so neither writer has to know about the other.
  //
  // Counted here rather than expressed as a clause because "more than
  // two" is a comparison the grammar has no operator for; the same
  // question was answered for the post card's like count by sending an
  // empty string from the proxy and gating on `exists`, which works for
  // one boolean and not for a count the renderer also has to act on.
  const publishesBannerCtas = (dataSource?.slug ?? '') === 'fc-welcome-banner';
  useEffect(() => {
    if (!publishesBannerCtas) return;
    // Hold the last verdict across a refetch, like the verdicts above:
    // publishing `false` mid-fetch would retract the row under the
    // reader's finger.
    if (dataState.loading) return;
    const first = dataState.items[0];
    const ctas = isRecord(first) && Array.isArray(first.ctaButtons) ? first.ctaButtons : [];
    setBannerControls({ hasExtraCtas: ctas.length > 2 });
  }, [publishesBannerCtas, dataState.loading, dataState.items]);

  // Search (2026-08-23). Three DIFFERENT sources publish into ONE key,
  // and that only works because exactly one of them is ever mounted:
  // the three result cards gate on `active_scope`, which holds a single
  // tab value at a time and '' while the query is too short. Nothing here
  // arbitrates between them, because nothing has to.
  //
  // Narrower than the bookmarks verdict next door: this one only ever
  // says what the FETCH found. The three states that happen with no card
  // mounted — a history to show, no history, a query too short — are
  // derived inside the slice from the query and the recents, because no
  // fetch is running to publish them.
  const searchResultSlugs = ['fc-search-posts', 'fc-search-members', 'fc-search-spaces'];
  const publishesSearchView = searchResultSlugs.includes(dataSource?.slug ?? '');
  useEffect(() => {
    if (!publishesSearchView) return;
    // `stale`, not just `loading` — P99. In the commit where the query
    // changes, `loading` still reads false beside the PREVIOUS query's
    // items, so a verdict taken here would be taken about the wrong
    // answer. On this screen that would flash "No matching posts" over
    // results that are about to arrive, and tear the no-match state on
    // and off between every pair of keystrokes.
    if (dataState.loading || dataState.stale) {
      publishSearchFetchView('loading');
      return;
    }
    publishSearchFetchView(dataState.items.length > 0 ? 'results' : 'no-match');
  }, [publishesSearchView, dataState.loading, dataState.stale, dataState.items.length]);

  // The composer's gate. A footer placement has no row of its own to
  // read, and a placement can read state and nothing else — so whether
  // there is a conversation to post to has to be published here, by the
  // AppZet that resolved the thread.
  //
  // Covers three cases with one string: no thread resolved at all (a
  // deep link, or the Chat tab before its list exists), a thread the
  // viewer has left, and a blocked one-to-one — FluentCommunity answers
  // all three with can_send_message false.
  const publishesThreadState = (dataSource?.slug ?? '') === 'fc-chat-thread';
  useEffect(() => {
    if (!publishesThreadState) return;
    if (dataState.loading) return;
    const row = dataState.items[0];
    const canSend = isRecord(row) && row.can_send_message === true;
    setChatControls({ can_send: canSend ? 'yes' : 'no' });
  }, [publishesThreadState, dataState.loading, dataState.items]);

  // A conversation is the one screen where the other side changes it
  // while you are looking at it. FluentCommunity ships realtime OFF by
  // default (`realtime_enabled: no`), so without this the only way a
  // message from the other person appears is a send, a screen change or
  // a window focus — which reads as a chat that has stopped working.
  //
  // The interval is an AppZet prop rather than a constant, so a customer
  // can slow it down or switch it off entirely; 0 means off. It refetches
  // the whole list rather than walking the `new messages` cursor because
  // the refresh event is the mechanism every other mutation already uses,
  // and a second path into the same list is a second thing to keep
  // correct.
  const pollIntervalMs = (() => {
    if (!publishesMessagesView) return 0;
    const raw = (appzet?.default_props_override as Record<string, unknown> | null | undefined)
      ?.['poll_interval_ms'];
    const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(n) && n >= 1000 ? n : 0;
  })();
  const messagesDsSlug = dataSource?.slug ?? '';
  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    if (typeof window === 'undefined') return;
    const tick = () => {
      // Never poll over a screen nobody is looking at, and never while a
      // fetch is already in flight.
      if (document.hidden) return;
      window.dispatchEvent(
        new CustomEvent('appza:refresh-data', { detail: { data_source: messagesDsSlug } }),
      );
    };
    const id = window.setInterval(tick, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [pollIntervalMs, messagesDsSlug]);

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
            // A `prop:` config REPLACES the catalog list wholesale, which
            // is right for labels, order and hidden — those are the
            // customer's call. It is wrong for `requires_permission`: a
            // gate is catalog POLICY, and the admin API cannot even
            // write one (SpaceConfigController's subtab sanitizer allows
            // only value/label/hidden/icon/target_screen). So a space
            // that saved a subtabs override silently un-gated every tab
            // the catalog gated — DOCUMENTS drew there even with the
            // space's document library switched off.
            //
            // `on_click_action` is the same kind of key. It names the
            // EVENT an entry fires, which the AppZet's actions map
            // resolves — CHAT uses it to PUSH the conversation screen
            // instead of switching a sub-tab. The sanitizer drops it
            // too, so an override of a list containing CHAT would leave
            // that tab switching to a sub-tab nothing renders.
            //
            // Carry both across by matching on `value`. An entry that
            // names its own keeps it.
            const CATALOG_OWNED_ENTRY_KEYS = ['requires_permission', 'on_click_action'] as const;
            const baseEntries = (appzet.default_props_override ?? {})[propName];
            let nextValue: unknown = configValue;
            if (Array.isArray(nextValue) && Array.isArray(baseEntries)) {
              // value → { key → catalog value }, for the keys above only.
              const owned = new Map<string, Record<string, string>>();
              for (const base of baseEntries) {
                if (!isRecord(base) || typeof base.value !== 'string') continue;
                const keep: Record<string, string> = {};
                for (const key of CATALOG_OWNED_ENTRY_KEYS) {
                  const v = base[key];
                  if (typeof v === 'string' && v !== '') keep[key] = v;
                }
                if (Object.keys(keep).length > 0) owned.set(base.value, keep);
              }
              if (owned.size > 0) {
                nextValue = nextValue.map((entry) => {
                  if (!isRecord(entry) || typeof entry.value !== 'string') return entry;
                  const keep = owned.get(entry.value);
                  if (keep === undefined) return entry;
                  const add: Record<string, string> = {};
                  for (const key of CATALOG_OWNED_ENTRY_KEYS) {
                    const own = entry[key];
                    if (typeof own === 'string' && own !== '') continue;
                    if (keep[key] !== undefined) add[key] = keep[key];
                  }
                  return Object.keys(add).length > 0 ? { ...entry, ...add } : entry;
                });
              }
            }
            (appzet as { default_props_override: Record<string, unknown> }).default_props_override = {
              ...(appzet.default_props_override ?? {}),
              [propName]: nextValue,
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
  // Permissions bag for `requires_permission` tab entries. Read from the
  // same row _config_apply resolves — the sibling DS when one is declared
  // (fc-space-subtabs / fc-media-tabs both point at fc-space-detail),
  // otherwise the AppZet's own first row. Undefined until it lands, which
  // the entry filter treats as "show the entry".
  const permissionsSource = siblingConfigSlug ? siblingConfigState.items : dataState.items;
  const entryPermissions = isRecord(permissionsSource[0])
    ? ((permissionsSource[0] as Record<string, unknown>).permissions as
        | Record<string, unknown>
        | undefined)
    : undefined;
  const expanded = readExpandedChildren(
    ss,
    appzet,
    undefined,
    isRecord(entryPermissions) ? entryPermissions : undefined,
  );
  const baseChildOverrides = computeChildOverrides(ss, appzet);
  for (const idxStr of Object.keys(expanded.entryOverrides)) {
    const i = Number(idxStr);
    baseChildOverrides[i] = {
      ...(baseChildOverrides[i] ?? {}),
      ...expanded.entryOverrides[i],
    };
  }
  // Add-document screen: two labels are stateful rather than static, so
  // they are resolved here instead of being fixed catalog props. Both
  // still READ their text from catalog props — this only chooses which
  // prop applies, so nothing becomes uneditable.
  if (appzet.slug === 'fc-add-document-appbar' && documentDraft.submitting) {
    const busy = readAppzetProp(ss, appzet, 'submit_busy_label');
    if (typeof busy === 'string' && busy !== '') {
      baseChildOverrides[2] = { ...(baseChildOverrides[2] ?? {}), text: busy };
    }
  }
  // The Post button's two states — designs 1 and 4 pale, design 10 solid.
  //
  // Painted through the CHILD OVERRIDE rather than a stylesheet rule,
  // because ThemedIonButton writes the button's surface onto
  // `::part(native)` with `!important`; an attribute-scoped rule loses to
  // that no matter how specific it is. Going through the override means
  // the pale fill takes exactly the path the authored one does.
  if (
    appzet.slug === 'fc-create-post-appbar' &&
    postDraftStateEntries(composerDraft)['post_draft.can_post'] !== 'yes'
  ) {
    const pale = readAppzetProp(ss, appzet, 'cta_disabled_bg_color');
    const paleText = readAppzetProp(ss, appzet, 'cta_disabled_color');
    if (typeof pale === 'string' && pale !== '') {
      baseChildOverrides[2] = { ...(baseChildOverrides[2] ?? {}), background: pale };
    }
    if (typeof paleText === 'string' && paleText !== '') {
      baseChildOverrides[2] = { ...(baseChildOverrides[2] ?? {}), text_color: paleText };
    }
  }
  if (appzet.slug === 'fc-add-document-schedule' && documentDraft.scheduled_at) {
    const prefix = readAppzetProp(ss, appzet, 'scheduled_prefix');
    baseChildOverrides[1] = {
      ...(baseChildOverrides[1] ?? {}),
      text: `${typeof prefix === 'string' ? prefix : ''}${formatScheduledAt(documentDraft.scheduled_at)}`,
    };
  }

  const hiddenIndices = computeHiddenIndices(ss, appzet);
  // Child `visible_when` on the SINGLE (no data source) path.
  //
  // It used to be evaluated only on the repeat path, where there is a row
  // to read — so a clause on an AppZet that binds no data source was
  // parsed, carried into the snapshot, and then never consulted. The
  // composer is exactly that case: it has no row, and the glyphs that
  // exist only under a plugin switch have nowhere else to be gated.
  //
  // `data.*` clauses resolve to undefined here, which is the honest
  // answer when there is no item; `settings.*` resolve against the site's
  // FluentCommunity configuration; `state.*` against the composer draft.
  const singlePathHidden = useMemo(() => {
    const dataHidden = computeDataHiddenIndices(readChildren(ss), null);
    if (dataHidden.size === 0) return hiddenIndices;
    return new Set<number>([...hiddenIndices, ...dataHidden]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // documentDraft is in here because the attach bar's document-mode
    // gate reads BOTH slices: creating a post keeps files on the
    // composer draft, editing one keeps them in the document draft.
  }, [ss, hiddenIndices, fcSettings, composerDraft, documentDraft]);
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

  // Nested repeat: the SS wants variadic children but the AppZet holds
  // no such array, so each DS row supplies its own (a document card
  // expanding its files). Expansion then has to happen per item rather
  // than once up here, and the outer row loop must NOT collapse — which
  // it doesn't, because `expanded` came back static so isVariadicFromDs
  // stayed false.
  const isVariadicFromItem =
    typeof cfpProp === 'string' && cfpProp.length > 0 && !isVariadicFromDs;

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
    'overlay_text_color',
    // Member card + members-actions knobs (2026-08-06).
    'grid_columns',
    'card_gap',
    'card_bg_color',
    'card_radius',
    'card_shadow',
    'card_padding',
    'avatar_size',
    'avatar_bg_color',
    'avatar_text_color',
    'name_color',
    'username_color',
    'meta_color',
    'points_badge_bg_color',
    'points_badge_text_color',
    'role_badge_bg_color',
    'role_badge_text_color',
    'row_padding',
    'invite_bg_color',
    'invite_text_color',
    'invite_border_color',
    'invite_radius',
    'add_bg_color',
    'add_text_color',
    'add_radius',
    // Space Documents sub-tab knobs (2026-08-16).
    'title_color',
    'file_row_color',
    'file_icon_color',
    'download_icon_color',
    'divider_color',
    'search_bg_color',
    'search_text_color',
    'search_icon_color',
    'search_radius',
    'search_height',
    'icon_circle_color',
    'icon_color',
    'title_size',
    'message_color',
    'message_size',
    'fab_bg_color',
    'fab_icon_color',
    'fab_size',
    'fab_offset_bottom',
    'fab_offset_end',
    // Space Media sub-tab knobs (2026-08-17). grid_columns, aspect_ratio,
    // row_padding, gap, height, font_weight, chip_text_color, chip_radius,
    // active_bg_color, active_text_color and title_color/title_size are
    // already above — the media AppZets reuse them by design so one CSS
    // vocabulary covers the whole screen.
    'track_bg_color',
    'track_radius',
    'track_padding',
    'chip_shadow',
    'tile_gap',
    'tile_radius',
    'tile_bg_color',
    'play_badge_bg_color',
    'play_badge_icon_color',
    'play_badge_size',
    'row_bg_color',
    'row_radius',
    'row_gap',
    'accent_color',
    'play_icon_color',
    'control_color',
    'time_color',
    'progress_color',
    'progress_track_color',
    // Chat knobs (2026-08-18). `row_gap`, `time_color`, `gap` and
    // `font_weight` are already above — the chat AppZets reuse them on
    // purpose, so one CSS vocabulary covers the screen rather than a
    // parallel chat_* set.
    'avatar_size',
    'avatar_bg_color',
    'avatar_text_color',
    'sender_name_color',
    'sender_name_size',
    'sender_name_weight',
    'bubble_bg_color',
    'bubble_text_color',
    'mine_bubble_bg_color',
    'mine_bubble_text_color',
    'bubble_radius',
    'bubble_padding',
    'bubble_max_width',
    'body_size',
    'time_size',
    'reply_bg_color',
    'reply_border_color',
    'reply_name_color',
    'reply_text_color',
    'reply_radius',
    'delete_bg_color',
    'delete_icon_color',
    'delete_radius',
    'group_gap',
    'list_padding',
    'list_bg_color',
    // fc-chat-home-fab. The `fab_*` knobs above belong to the documents
    // FAB, which is a different Superstructure with a different shape.
    'bg_color',
    'icon_color',
    'icon_size',
    'size',
    'shadow',
    'offset_right',
    'offset_bottom',
    // Leaderboard knobs (2026-08-19). `card_*`, `avatar_size`,
    // `avatar_bg_color`, `name_color`, `row_gap`, `row_padding`,
    // `title_color`, `title_size`, `divider_color`, `icon_color`,
    // `height`, `font_weight`, `bg_color`, `active_color` and `gap` are
    // already above and are reused on purpose — one CSS vocabulary for
    // the whole app rather than a parallel leaderboard_* set.
    'avatar_ring_color',
    'badge_bg_color',
    'badge_text_color',
    'badge_size',
    'name_size',
    'name_weight',
    'level_title_color',
    'level_title_size',
    'stat_bg_color',
    'stat_border_color',
    'stat_radius',
    'stat_height',
    'stat_text_color',
    'stat_text_size',
    'trophy_color',
    'level_up_color',
    'level_up_size',
    'info_icon_color',
    'info_icon_size',
    'marker_size',
    'marker_bg_color',
    'marker_text_color',
    'marker_border_color',
    'lock_color',
    'title_weight',
    'tagline_color',
    'tagline_size',
    'text_color',
    'radius',
    'font_size',
    'letter_spacing',
    'gold_color',
    'silver_color',
    'bronze_color',
    'medal_rank_color',
    'trophy_size',
    'rank_color',
    'rank_size',
    'points_color',
    'points_size',
    'points_weight',
    // Saved Posts strip (2026-08-19). `row_padding`, `icon_color` and
    // `divider_color` are already above and reused on purpose.
    'sort_text_color',
    'sort_icon_color',
    'view_icon_color',
    // Search screen (2026-08-23). `track_*`, `row_padding`, `row_gap`,
    // `active_bg_color`, `active_color`, `active_border_color`,
    // `font_size`, `font_weight`, `gap`, `icon_color`, `icon_size`,
    // `text_color`, `divider_color`, `title_color`, `title_size`,
    // `title_weight`, `letter_spacing` and the `search_*` set are all
    // already above and reused on purpose — same rule as every block
    // before this one: one CSS vocabulary, not a parallel search_* set.
    'tab_bg_color',
    'tab_text_color',
    'tab_border_color',
    'tab_radius',
    'tab_height',
    'clear_color',
    'clear_size',
    'remove_color',
    'remove_size',
    'row_height',
    'text_size',
    // Create post (2026-08-24). `card_bg_color`, `card_padding`,
    // `card_radius`, `row_gap`, `row_padding`, `title_color`,
    // `title_size`, `title_weight`, `divider_color`, `icon_color`,
    // `icon_size` and `body_size` are already above and reused on
    // purpose — one CSS vocabulary, not a parallel composer_* set.
    //
    // The topic chips deliberately do NOT reuse `chip_bg_color` /
    // `chip_radius`: those carry Ionic aliases (--background,
    // --border-radius) that inherit through the wrapper and would repaint
    // the five attach buttons sitting inside the same card.
    'page_bg_color',
    'card_margin',
    'card_border_color',
    'card_padding_x',
    'bar_divider_color',
    'bar_padding_x',
    'bar_icon_color',
    'bar_icon_gap',
    'bar_icon_size',
    'bar_height',
    'postedin_gap',
    'postedin_color',
    'postedin_size',
    'space_gap',
    'space_badge_size',
    'space_badge_bg_color',
    'space_color',
    'space_size',
    'space_weight',
    'space_chevron_size',
    'space_chevron_color',
    'title_gap',
    'title_divider_color',
    'title_placeholder_color',
    'topics_gap',
    'topics_label_color',
    'topics_label_size',
    'topics_cap_color',
    'topic_gap',
    'topic_padding',
    'topic_radius',
    'topic_size',
    'topic_bg_color',
    'topic_text_color',
    'topic_active_bg_color',
    'topic_active_text_color',
    'body_min_height',
    'body_color',
    'body_placeholder_color',
    'box_size',
    'box_radius',
    'box_border_color',
    'box_tick_color',
    'box_checked_bg_color',
    'box_checked_tick_color',
    'label_color',
    'label_size',
    // Post preview (2026-08-24). `card_*`, `avatar_size`,
    // `avatar_bg_color`, `name_*`, `meta_color`, `title_*`, `body_*`,
    // `divider_color`, `icon_color`, `icon_size` and `row_gap` are
    // already above and reused on purpose.
    'author_gap',
    'meta_size',
    'empty_color',
    'media_gap',
    'media_radius',
    'media_sample_height',
    'media_sample_color',
    'actions_gap',
    'actions_gap_top',
    'bar_padding',
    'bar_bg_color',
    'close_color',
    'close_size',
    'close_weight',
    // Images on the composer and in the preview (2026-08-24).
    'image_columns',
    'image_gap',
    'image_aspect',
    'image_radius',
    'single_image_aspect',
    'remove_offset',
    'remove_size',
    'remove_bg_color',
    'tile_aspect',
    'single_aspect',
    'overflow_bg_color',
    'overflow_color',
    'overflow_size',
    'overflow_weight',
    // Attached audio (2026-08-24).
    'audio_gap',
    'audio_remove_bg_color',
    'audio_remove_color',
    // The poll strip on the composer and the poll block in the preview
    // (2026-08-25). Both are drawn by bespoke primitives on PLACED
    // AppZets, so unlike the sheet's own knobs — which travel through
    // pollSheetPresentation — these have to be stamped as CSS variables
    // here, or the Properties panel edits nothing.
    'poll_bg_color',
    'poll_text_color',
    'poll_size',
    'poll_radius',
    'poll_padding',
    'poll_gap',
    'poll_icon_color',
    'poll_icon_size',
    'poll_edit_color',
    'poll_edit_size',
    'poll_edit_weight',
    'poll_remove_color',
    'poll_remove_size',
    'poll_row_bg_color',
    'poll_row_border_color',
    'poll_row_radius',
    'poll_row_height',
    'poll_row_gap',
    'poll_row_padding',
    'poll_label_color',
    'poll_label_size',
    'poll_mark_color',
    'poll_mark_size',
    'poll_mark_radius',
    'poll_pct_color',
    'poll_pct_size',
    'poll_votes_color',
    'poll_votes_size',
    'poll_votes_gap',
    // Attached documents (2026-08-25) — the composer's rows and the
    // preview's card. Shared names on purpose: a file that looked
    // different in the preview would defeat the preview.
    'doc_gap',
    'doc_row_gap',
    'doc_row_height',
    'doc_row_padding',
    'doc_radius',
    'doc_bg_color',
    'doc_border_color',
    'doc_text_color',
    'doc_size',
    'doc_icon_color',
    'doc_icon_size',
    'doc_action_color',
    'doc_action_size',
    'doc_card_border_color',
    'doc_card_radius',
    'doc_card_padding',
    'doc_heading_color',
    'doc_heading_size',
    'doc_heading_weight',
    'doc_heading_padding',
    // The schedule strip and the Post CTA's pale state (2026-08-25).
    'strip_margin',
    'strip_padding',
    'strip_height',
    'strip_radius',
    'strip_gap',
    'strip_bg_color',
    'strip_text_color',
    'strip_size',
    'strip_icon_color',
    'strip_icon_size',
    'strip_edit_color',
    'strip_edit_size',
    'strip_edit_weight',
    'strip_clear_color',
    'strip_clear_size',
    'cta_disabled_bg_color',
    'cta_disabled_color',
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
  // Two toolbar knobs that are layout decisions rather than colours, so
  // they reach CSS as attributes rather than as custom properties. The
  // feed's strip puts sort at the right end; Saved Posts puts it at the
  // left with the layout glyph pushed to the far right, and draws no
  // hairline above itself. Both are authored on the AppZet, so a
  // customer can swap either strip round from the right panel.
  const toolbarProps = (appzet?.default_props_override ?? {}) as Record<string, unknown>;
  const toolbarAlign =
    baseAppzet && TOOLBAR_CONTROL_SLICES[baseAppzet.slug]
      ? toolbarProps.align === 'start'
        ? 'start'
        : 'end'
      : undefined;
  const toolbarDivider =
    baseAppzet && TOOLBAR_CONTROL_SLICES[baseAppzet.slug]
      ? String(toolbarProps.show_divider !== false)
      : undefined;

  if (!dataSource) {
    const staticActions = computeChildActions(expanded.children, appzet, undefined);
    return (
      <>
        {optionFetchers}
        <div
          className={wrapperClass}
          data-slug={appzet.slug}
          data-appza-can-submit={
            appzet.slug === 'fc-add-document-appbar'
              ? String(documentDraft.files.length > 0 && !documentDraft.submitting)
              : undefined
          }
          /* Same mechanism, for the composer's send button: it has to
             look awake once there is something to send, and the button is
             a plain ion-button with no view of the draft. */
          data-appza-can-send={
            appzet.slug === 'fc-chat-input'
              ? String(chatControls.draft.trim().length > 0 || chatControls.attachments.length > 0)
              : undefined
          }
          /* And again for the Post button. `can_post` mirrors
             FluentCommunity's OWN refusals — a message, a destination, a
             topic where the space demands one, a title where the site
             does — so the pale button of designs 1 and 4 says what the
             round trip would say. Stamped only for the CREATE appbar;
             the edit appbar shares the shell and is left alone. */
          data-appza-can-post={
            appzet.slug === 'fc-create-post-appbar'
              ? String(postDraftStateEntries(composerDraft)['post_draft.can_post'] === 'yes')
              : undefined
          }
          data-spaces-active-tab={appzet.slug === 'fc-spaces-tabs' ? spacesTab : undefined}
          data-space-detail-active-subtab={appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab : undefined}
          data-space-detail-active-topic={appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug : undefined}
          data-space-detail-active-space={appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug : undefined}
          data-media-active-type={appzet.slug === 'fc-media-tabs' ? spaceDetailMediaType : undefined}
          data-leaderboard-active-range={appzet.slug === 'fc-leaderboard-tabs' ? leaderboardControls.range : undefined}
          data-appza-align={toolbarAlign}
          data-appza-divider={toolbarDivider}
          style={{ ...spacingStyle(spacing), ...styleVars } as React.CSSProperties}
          onClick={handleClick}
        >
          <SuperstructureRenderer
            ss={ss}
            catalogIndex={catalogIndex}
            depth={0}
            childOverrides={baseChildOverrides}
            hiddenIndices={singlePathHidden}
            childLayoutStyles={childLayoutStyles}
            childActions={staticActions}
            appzetSlugForPath={appzet.slug}
            activeChildValue={
              appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab :
              appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug :
              appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug :
              appzet.slug === 'fc-spaces-tabs' ? spacesTab :
              // Rides fc-space-subtabs' Superstructure but reads a
              // different slice, so it cannot fall into the first branch.
              appzet.slug === 'fc-leaderboard-tabs' ? leaderboardControls.range :
              // Search's two strips (2026-08-23). One Superstructure wearing
              // two looks, reading two different keys of the same slice — so,
              // like the leaderboard above, neither can fall into an earlier
              // branch. The active entry is marked with data-active rather
              // than by pairing a wrapper attribute against each value, which
              // is what the CSS keys on.
              appzet.slug === 'fc-search-tabs' ? searchControls.tab :
              appzet.slug === 'fc-search-scope-tabs' ? searchControls.post_scope :
              undefined
            }
            activeChildValues={
              appzet.slug === 'fc-add-document-topics' ? draftTopicValues : undefined
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
    // How many placeholder rows read as "this layout". One is right for a
    // single-fetch AppZet and wrong for a grid — a lone tile where six are
    // about to appear reads as a broken screen rather than a loading one.
    // `skeleton_count` on the AppZet overrides, so a customer who changes
    // a grid's column count can keep the placeholder honest.
    const authoredCount = Number(
      (appzet.default_props_override as Record<string, unknown> | undefined)?.['skeleton_count'],
    );
    const skeletonCount = Number.isFinite(authoredCount) && authoredCount > 0
      ? Math.min(authoredCount, 12)
      : (SKELETON_COUNTS[appzet.slug] ?? (isPaginated ? 3 : 1));
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

  // hide_when_empty — opt-in for AppZets whose empty state is rendered by a
  // SIBLING placement rather than by this one (fc-document-card hands the
  // empty + no-match designs to fc-documents-empty). Without it a
  // non-paginated DS with zero rows falls through to the single-empty-card
  // fallback below and paints a ghost card under the real empty state.
  if (
    (appzet.default_props_override as Record<string, unknown> | undefined)?.['hide_when_empty'] ===
      true &&
    !dataState.loading &&
    dataState.items.length === 0
  ) {
    return <>{optionFetchers}</>;
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

  // `data-leaderboard-levels-view` below: the levels card is the TOP half
  // of a white container whose bottom half is the VIEW ALL button — until
  // the button goes, at which point the list has to round its own bottom
  // corners. A stylesheet cannot see a sibling that is not there, so the
  // verdict it would need is stamped on the wrapper instead.
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
        data-media-active-type={appzet.slug === 'fc-media-tabs' ? spaceDetailMediaType : undefined}
        data-leaderboard-active-range={appzet.slug === 'fc-leaderboard-tabs' ? leaderboardControls.range : undefined}
        data-leaderboard-levels-view={appzet.slug === 'fc-level-row' ? leaderboardControls.levels_view : undefined}
        data-fc-member-layout={
          appzet.slug === 'fc-member-card'
            ? (fcMemberListLayout === 'grid' ? 'grid' : 'list')
            : undefined
        }
        style={Object.keys(styleVars).length > 0 ? (styleVars as React.CSSProperties) : undefined}
      >
      {items.map((item, idx) => {
        // Enrich the raw item with computed viewer-scoped fields (e.g.
        // whether the current user has liked / bookmarked this item)
        // so field_mappings can bind icon + color straight off the data
        // without renderer needing to know about reactions.
        const enrichedItem = enrichItemWithMyReactions(item);
        // Nested-repeat case: this row carries its own children array,
        // so the template expands here instead of at AppZet level.
        const itemExpanded = isVariadicFromItem
          ? readExpandedChildren(ss, appzet, enrichedItem)
          : null;
        const effChildren = itemExpanded ? itemExpanded.children : ssChildren;
        let itemOverrides = mergeFieldMappingsOntoOverrides(baseChildOverrides, appzet, enrichedItem);
        if (itemExpanded) {
          // Copy before stamping per-index entries — the merge helper's
          // result must not be shared across rows or one card's files
          // would leak into the next.
          itemOverrides = { ...itemOverrides };
          // Props bound to the TEMPLATE child (`binds_to:
          // 'children[<template>].<prop>'`) describe every expanded copy,
          // not just the first — the document card's download glyph is one
          // such prop. computeChildOverrides only ever stamps the literal
          // index, so seed each expanded row from the template's bucket and
          // let the per-entry values win over it.
          const templateBase = baseChildOverrides[itemExpanded.templateIndex];
          for (const idxStr of Object.keys(itemExpanded.entryOverrides)) {
            const i = Number(idxStr);
            itemOverrides[i] = {
              ...(templateBase ?? {}),
              ...(itemOverrides[i] ?? {}),
              ...itemExpanded.entryOverrides[i],
            };
          }
        }
        // Member-card special: prepend prefixes to username / joined /
        // active + format joined/active as relative time + stamp initials
        // fallback for the avatar. Kept out of the generic mapping path
        // so other cards don't pick up date formatting they didn't
        // opt in to. All three prefixes are AppZet default_props so the
        // admin can toggle @ off or relocalize the labels.
        if (appzet.slug === 'fc-member-card') {
          itemOverrides = applyMemberCardTransforms(itemOverrides, appzet, enrichedItem);
        }
        const dataHidden = computeDataHiddenIndices(effChildren, enrichedItem);
        const effectiveHidden =
          dataHidden.size === 0
            ? hiddenIndices
            : new Set<number>([...hiddenIndices, ...dataHidden]);
        const childOpenUrls = computeChildOpenUrls(effChildren, enrichedItem);
        // `items` is the post-filter row set in render order, so an action
        // that operates on the collection (the media viewer's paging) sees
        // exactly what the user sees, at the index they tapped.
        const childActions = computeChildActions(effChildren, appzet, enrichedItem, items, idx);
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
        // A per-row DATA value the stylesheet needs. The leaderboard's
        // trophy is gold, silver or bronze depending on `medal`, and a
        // field mapping can only reach a child's props — it cannot reach
        // CSS. So an AppZet may name one field whose value is stamped on
        // the row wrapper as `data-row-variant`, and the stylesheet keys
        // off that.
        //
        // Deliberately ONE field and no path walking: this exists to let
        // a design express a per-row variant, not to become a second
        // binding language alongside field_mappings.
        const rawVariantField = (appzet.default_props_override as
          | Record<string, unknown>
          | undefined)?.['row_variant_field'];
        const rowVariantField =
          typeof rawVariantField === 'string' && rawVariantField !== ''
            ? rawVariantField
            : undefined;
        const rawRowVariant =
          rowVariantField && isRecord(item)
            ? (item as Record<string, unknown>)[rowVariantField]
            : undefined;
        const rowVariantAttr =
          typeof rawRowVariant === 'string' && rawRowVariant !== ''
            ? rawRowVariant
            : typeof rawRowVariant === 'number'
              ? String(rawRowVariant)
              : undefined;
        return (
          <div
            className={wrapperClass}
            data-slug={appzet.slug}
            data-appza-item-id={itemIdAttr}
            data-row-variant={rowVariantAttr}
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
                appzet.slug === 'fc-leaderboard-tabs' ? leaderboardControls.range :
                // Search's two strips (2026-08-23). One Superstructure wearing
                // two looks, reading two different keys of the same slice — so,
                // like the leaderboard above, neither can fall into an earlier
                // branch. The active entry is marked with data-active rather
                // than by pairing a wrapper attribute against each value, which
                // is what the CSS keys on.
                appzet.slug === 'fc-search-tabs' ? searchControls.tab :
                appzet.slug === 'fc-search-scope-tabs' ? searchControls.post_scope :
                undefined
              }
              activeChildValues={
                appzet.slug === 'fc-add-document-topics' ? draftTopicValues : undefined
              }
              expandedChildren={effChildren}
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
            loadingText={
              appzet.slug === 'fc-member-card' ? 'Loading more members…' : 'Loading more posts…'
            }
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
/**
 * Placeholder rows per AppZet, chosen to match the shape the screen is
 * about to show. Anything unlisted keeps the old behaviour — three for a
 * paginated list, one otherwise.
 */
const SKELETON_COUNTS: Record<string, number> = {
  'fc-post-card': 3,
  'fc-post-list-item': 4,
  'fc-post-grid-item': 4,
  'fc-space-card': 3,
  'fc-member-card': 6,
  'fc-media-tile': 6,
  'fc-media-audio-row': 3,
  'fc-document-card': 3,
  'fc-comment-row': 3,
  'fc-chat-message': 5,
  'fc-notification-row': 4,
};

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
 *   _like_icon / _like_color         — 'heart' + 'primary' when reacted, else defaults
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
  // BLUE when liked, not red. Noor's design 18 draws the filled heart
  // and the filled bookmark in the same brand blue, which is also what
  // FluentCommunity's own portal does — `danger` was our invention.
  enriched._like_color = myTypes.has('like') ? 'primary' : 'medium';
  enriched._bookmark_icon = myTypes.has('bookmark') ? 'bookmark' : 'bookmark-outline';
  enriched._bookmark_color = myTypes.has('bookmark') ? 'primary' : 'medium';
  return enriched;
}

function computeChildActions(
  children: SSChild[],
  appzet: AppZet,
  item: unknown,
  siblings?: unknown[],
  siblingIndex?: number,
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
    out[i] = { action_slug, args, binding_root, item, siblings, siblingIndex };
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

/**
 * Post-processes fc-member-card per-item overrides:
 *   - children[0].initials  ← 2-letter initials from display_name (for
 *                             the avatar's initials-fallback badge)
 *   - children[0].alt       ← display_name (accessibility)
 *   - children[3].text      ← username_prefix + username (default '@')
 *   - children[6].text      ← joined_prefix + relativeTime(created_at)
 *   - children[7].text      ← active_prefix + relativeTime(last_activity)
 * Prefixes come off the AppZet's default_props_override so all three
 * are editable from the right panel.
 */
function applyMemberCardTransforms(
  base: ChildOverrides,
  appzet: AppZet,
  item: unknown,
): ChildOverrides {
  const dpo = (appzet.default_props_override ?? {}) as Record<string, unknown>;
  const usernamePrefix = typeof dpo.username_prefix === 'string' ? dpo.username_prefix : '@';
  const joinedPrefix   = typeof dpo.joined_prefix === 'string'   ? dpo.joined_prefix   : 'Joined ';
  const activePrefix   = typeof dpo.active_prefix === 'string'   ? dpo.active_prefix   : 'Active ';
  const avatarMode     = typeof dpo.avatar_mode === 'string'     ? dpo.avatar_mode     : 'photo';

  const result: ChildOverrides = {};
  for (const [k, v] of Object.entries(base)) result[Number(k)] = { ...v };

  const displayName = readDataPath(item, 'data.xprofile.display_name');
  const username = readDataPath(item, 'data.xprofile.username');
  const createdAt = readDataPath(item, 'data.created_at');
  const lastActivity = readDataPath(item, 'data.xprofile.last_activity');

  // children[0] avatar — initials fallback. When avatar_mode=initials
  // we drop the src so the primitive's fallback branch renders the
  // colored initials badge unconditionally (matches the mock design).
  if (typeof displayName === 'string') {
    const bucket0 = result[0] ?? {};
    bucket0.initials = computeInitials(displayName);
    bucket0.alt = displayName;
    if (avatarMode === 'initials') {
      bucket0.src = '';
    }
    result[0] = bucket0;
  }
  // children[1] menu button — always force empty text so the button
  // renders icon-only. Without this, the fallback primitive.name
  // ("Button") paints under the icon (visible as "Bu" / "TT"-like
  // artifacts clipped by the button's small width).
  const bucket1 = result[1] ?? {};
  bucket1.text = '';
  result[1] = bucket1;
  // children[3] @username
  if (typeof username === 'string' && username !== '') {
    const bucket3 = result[3] ?? {};
    bucket3.text = usernamePrefix + username;
    result[3] = bucket3;
  } else {
    // Hide bucket when username missing so we don't render an empty '@'
    const bucket3 = result[3] ?? {};
    bucket3.text = '';
    result[3] = bucket3;
  }
  // children[6] joined date
  if (typeof createdAt === 'string' && createdAt !== '') {
    const bucket6 = result[6] ?? {};
    bucket6.text = joinedPrefix + formatRelativeTime(createdAt);
    result[6] = bucket6;
  }
  // children[7] active date
  if (typeof lastActivity === 'string' && lastActivity !== '') {
    const bucket7 = result[7] ?? {};
    bucket7.text = activePrefix + formatRelativeTime(lastActivity);
    result[7] = bucket7;
  } else {
    const bucket7 = result[7] ?? {};
    bucket7.text = '';
    result[7] = bucket7;
  }
  return result;
}

/**
 * Extracts up to 2-letter uppercase initials from a display name.
 * "Rashedul Raju" → "RR"; "raju" → "R"; "Test User1" → "TU".
 */
function computeInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') return '';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    return (parts[0] ?? '').charAt(0).toUpperCase();
  }
  const first = (parts[0] ?? '').charAt(0);
  const last = (parts[parts.length - 1] ?? '').charAt(0);
  return (first + last).toUpperCase();
}

/**
 * Compact relative-time formatter. Accepts either:
 *   - ISO / mysql datetime — parses + computes diff from now
 *   - Already-relative form ("1mo", "3d", "2w") — appends " ago"
 * The preview-proxy pre-normalizes `created_at` on some payloads
 * (fc-feeds, fc-space-members) but leaves `xprofile.last_activity`
 * raw, so we need to accept both shapes.
 */
function formatRelativeTime(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  // Already-relative (e.g. "1mo", "2w", "23h") — append " ago".
  if (/^\d+\s*(s|m|min|h|hr|d|w|mo|y|yr)$/i.test(trimmed)) {
    return trimmed + ' ago';
  }
  const iso = trimmed.replace(' ', 'T');
  const withZone = iso.includes('T') && !iso.includes('+') && !iso.endsWith('Z') ? iso + 'Z' : iso;
  const t = Date.parse(withZone);
  if (!Number.isFinite(t)) return trimmed;
  const diffSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diffSec < 60) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + 'h ago';
  const day = Math.round(hr / 24);
  if (day < 7) return day + 'd ago';
  const wk = Math.round(day / 7);
  if (wk < 4) return wk + 'w ago';
  const mo = Math.round(day / 30);
  if (mo < 12) return mo + 'mo ago';
  const yr = Math.round(day / 365);
  return yr + 'y ago';
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
   * Multi-select variant. The add-document topic chips are not a filter
   * strip — several can be on at once — so `data-active` also matches
   * against this set when present.
   */
  activeChildValues?: ReadonlySet<string>;
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
  activeChildValues,
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
        // A self-action primitive normally keeps its action to itself. The
        // exception is ion-input, which is also used as a tap-to-navigate
        // pill (fc-post-composer-teaser) — there the wrapper tap IS the
        // event. Nothing else has a meaningful "tap the row" reading: a
        // stray wrapper click on a toggle would dispatch a change that
        // never happened.
        const primitiveSelfHandles =
          SELF_ACTION_PRIMITIVES.has(child.slug) &&
          !(child.on_click_action && child.slug === 'ion-input');
        const wrapperAction = action && !primitiveSelfHandles ? action : undefined;
        // A self-action primitive gets the action EVEN WHEN the SS also
        // wires on_click_action: the two fire on different events (value
        // change vs tap), so handing it to the wrapper alone left every
        // search input inert — it only dispatched on click, with no value.
        // The composer teaser, which wants the tap, is unaffected: it
        // navigates away, so its ionInput never fires.
        const primitiveAction =
          action && SELF_ACTION_PRIMITIVES.has(child.slug) ? action : undefined;
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
              if (!isTopLevel || (activeChildValue === undefined && !activeChildValues)) {
                return undefined;
              }
              // Only mark active when the child has an EXPLICIT `value`
              // override — the empty-string "All" chip is fine, but the
              // static "Choose topic" section header (no value key) must
              // not falsely match activeChildValue=''.
              const bucket = childOverrides?.[idx];
              if (!bucket || !('value' in bucket)) return undefined;
              const v = bucket.value;
              const asStr = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
              if (activeChildValues) return activeChildValues.has(asStr) ? 'true' : undefined;
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
                download={
                  child.download
                    ? // Save under the name the row shows, not the
                      // storage filename FC generated.
                      (typeof childOverrides?.[idx]?.text === 'string'
                        ? (childOverrides[idx].text as string)
                        : '')
                    : undefined
                }
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

type VisibleWhenClause = {
  binding: string;
  op: VisibleWhenOp;
  value?: unknown;
};

/**
 * One clause, or a LIST of clauses that must all hold.
 *
 * The list arrived with the attach bar: the audio glyph needs
 * FluentPlayer's switch AND a draft that has not become a document post,
 * which is two facts about two different things. Placement-level
 * `visible_when` has taken an array since the search screen; children now
 * take the same shape, so there is one grammar rather than two.
 */
type VisibleWhen = VisibleWhenClause | VisibleWhenClause[];

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
  /**
   * Marks an `on_click_open_url` child as a DOWNLOAD rather than a
   * navigation. Adds the `download` attribute, which makes a same-origin
   * file save instead of opening in a tab — what a row with a download
   * glyph promises. Cross-origin (the packaged app talking to the site)
   * the attribute is ignored by design and the platform's own download
   * handling takes over.
   */
  download?: boolean;
};

function parseVisibleWhenClause(raw: unknown): VisibleWhenClause | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.binding !== 'string' || typeof rec.op !== 'string') return null;
  return {
    binding: rec.binding,
    op: rec.op as VisibleWhenOp,
    value: 'value' in rec ? rec.value : undefined,
  };
}

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
      if (Array.isArray(vw)) {
        const clauses = vw
          .map(parseVisibleWhenClause)
          .filter((c): c is VisibleWhenClause => c !== null);
        // An EMPTY list is not "hide this" — it is a catalog row that
        // says nothing, and saying nothing has always meant show. Same
        // reading the placement evaluator gives it.
        if (clauses.length > 0) out.visible_when = clauses;
      } else {
        const clause = parseVisibleWhenClause(vw);
        if (clause) out.visible_when = clause;
      }
      if (typeof rec.on_click_open_url === 'string') {
        out.on_click_open_url = rec.on_click_open_url;
      }
      if (rec.download === true) {
        out.download = true;
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
  item?: unknown,
  permissions?: Record<string, unknown>,
): {
  children: SSChild[];
  entryOverrides: Record<number, Record<string, unknown>>;
  templateIndex: number;
} {
  const propName = (ss as unknown as { children_from_prop?: unknown }).children_from_prop;
  const staticChildren = readChildren(ss);
  if (typeof propName !== 'string' || propName.length === 0) {
    return { children: staticChildren, entryOverrides: {}, templateIndex: 0 };
  }
  const overrides = appzet.default_props_override as Record<string, unknown> | null | undefined;
  // AppZet-level array first — the strip case (tabs / spaces / topics),
  // where one AppZet renders the whole strip. When there isn't one, fall
  // back to the same-named array on the DS row being rendered: the
  // nested case, a card repeated per row that expands its OWN list (a
  // document card's files, and any future list-inside-a-card).
  // The caller decides which mode applies; passing no `item` keeps the
  // historical AppZet-only behaviour untouched.
  let rawEntries = overrides ? overrides[propName] : undefined;
  if ((!Array.isArray(rawEntries) || rawEntries.length === 0) && isRecord(item)) {
    rawEntries = (item as Record<string, unknown>)[propName];
  }
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return { children: staticChildren, entryOverrides: {}, templateIndex: 0 };
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
  if (!template) return { children: staticChildren, entryOverrides: {}, templateIndex };
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
    // `requires_permission: '<key>'` — drop the entry unless the resolved
    // entity says the viewer has that permission. Used by the Space Detail
    // sub-tabs (MEDIA needs can_view_media) and by the media type strip
    // (Audios needs can_view_media_audio), both reading the permissions bag
    // on the fc-space-detail row the AppZet already resolves for
    // _config_apply — so the gate costs no extra request.
    //
    // Fails OPEN on purpose: an absent permissions bag (payload still in
    // flight, or an endpoint that doesn't publish one) keeps the entry.
    // A tab that shouldn't be there is a smaller failure than a tab that
    // vanishes because a fetch was slow.
    if (typeof entry.requires_permission === 'string' && entry.requires_permission !== '') {
      if (permissions && entry.requires_permission in permissions) {
        if (permissions[entry.requires_permission] !== true) continue;
      }
    }
    // Clone the template shape; per-entry `on_click_action` overrides win.
    // For `on_click_open_url` starting with `entry.<path>`, resolve at
    // expansion time so each expanded child carries its own literal URL
    // (computeChildOpenUrls only understands `data.` bindings + literals).
    let openUrlSpec = template.on_click_open_url;
    if (typeof openUrlSpec === 'string' && openUrlSpec.startsWith('entry.')) {
      const resolved = readDataPath(entry, 'data.' + openUrlSpec.slice('entry.'.length));
      openUrlSpec = typeof resolved === 'string' && resolved !== '' ? resolved : undefined;
    }
    const child: SSChild = {
      slug: template.slug,
      on_click_action:
        typeof entry.on_click_action === 'string'
          ? entry.on_click_action
          : template.on_click_action,
      on_click_open_url: openUrlSpec,
      download: template.download,
    };
    children.push(child);
    // Stamp the entry's leaf values as this child's overrides. `text`
    // + `value` are the two universal ones; anything else on the entry
    // (icon, badge_color, ...) rides along by name so future tab knobs
    // don't need a renderer change.
    const bucket: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) {
      // Directive keys, not child props — stamping them would put
      // requires_permission="can_view_media" on the rendered element.
      if (k === 'hidden' || k === 'on_click_action' || k === 'requires_permission') continue;
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
    // `prop_map` — pick which AppZet prop supplies a child prop, based on a
    // value on the entry. The document file row uses it for the leading
    // glyph: `entry.kind` is 'image' or 'document', and each maps to its own
    // builder-editable prop, so both glyphs stay right-panel controllable
    // instead of being frozen into the API payload or the template child.
    //
    //   prop_map: { icon: { from: 'entry.kind',
    //                       props: { image: 'image_icon', document: 'file_icon' } } }
    // Read off the RAW child: readChildren() normalizes to a known key set
    // and would drop prop_map, the same way it drops `template`.
    const rawTemplate = rawChildren[templateIndex];
    const propMap = isRecord(rawTemplate) ? rawTemplate.prop_map : undefined;
    if (isRecord(propMap)) {
      for (const [childProp, rawSpec] of Object.entries(propMap)) {
        if (!isRecord(rawSpec)) continue;
        const from = typeof rawSpec.from === 'string' ? rawSpec.from : '';
        const cases = isRecord(rawSpec.props) ? rawSpec.props : null;
        if (!from.startsWith('entry.') || !cases) continue;
        const key = readDataPath(entry, 'data.' + from.slice('entry.'.length));
        const propName = typeof key === 'string' ? cases[key] : undefined;
        if (typeof propName !== 'string') continue;
        const resolved = readAppzetProp(ss, appzet, propName);
        if (resolved !== undefined) bucket[childProp] = resolved;
      }
    }
    entryOverrides[children.length - 1] = bucket;
  }
  return { children, entryOverrides, templateIndex };
}

/**
 * "Aug 21, 2026, 11:50 AM" — how the design prints a scheduled date.
 * The draft stores 'YYYY-MM-DD HH:MM:SS'; anything unparseable is shown
 * verbatim rather than swallowed.
 */
function formatScheduledAt(value: string): string {
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * DC#16 precedence for a single named prop: AppZet `default_props_override`
 * wins, else the SS `properties_schema` default, else undefined.
 */
function readAppzetProp(ss: Superstructure, appzet: AppZet, name: string): unknown {
  const overrides = appzet.default_props_override as Record<string, unknown> | null | undefined;
  if (overrides && overrides[name] !== undefined && overrides[name] !== '') {
    return overrides[name];
  }
  const schema = (ss.properties_schema ?? null) as PropertiesSchemaEntry[] | null;
  if (!Array.isArray(schema)) return undefined;
  for (const entry of schema) {
    if (entry && entry.name === name) return entry.default;
  }
  return undefined;
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
    // Literal URL — used by variadic expansion which pre-resolves
    // `entry.*` bindings against each entry at children_from_prop time.
    if (/^https?:\/\//i.test(spec)) {
      out[i] = spec;
      continue;
    }
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
 * Grammar v2 — one clause per child, or a LIST that must all hold (AND;
 * no OR nesting). Ops: `==`, `!=`, `exists`, `not_exists`, `in`,
 * `not_in`. Bindings: `data.<path>` (the bound row), `settings.<path>`
 * (the site's FluentCommunity configuration), `state.<path>` (the flat
 * bag below). Unparseable clauses fail-open (child shown) — same
 * silent-no-op posture as the rest of the renderer.
 */
function computeDataHiddenIndices(children: SSChild[], item: unknown): Set<number> {
  const hidden = new Set<number>();
  for (let i = 0; i < children.length; i++) {
    const vw = children[i]?.visible_when;
    if (!vw) continue;
    const holds = Array.isArray(vw)
      ? vw.every((clause) => evaluateVisibleWhen(clause, item))
      : evaluateVisibleWhen(vw, item);
    if (!holds) hidden.add(i);
  }
  return hidden;
}

/**
 * The `state.*` bag a CHILD clause can read.
 *
 * Only the composer draft so far, and built by the slice's own exported
 * function so this and the screen's placement-level bag cannot describe
 * the same fact differently. Read fresh on every evaluation rather than
 * memoised: the caller already re-runs when the draft changes, and a
 * stale copy here would leave the attach bar showing a glyph the draft
 * has ruled out.
 */
function childStateBag(): Record<string, unknown> {
  return {
    ...postDraftStateEntries(getPostDraft()),
    ...bannerStateEntries(getBannerControls()),
  };
}

function evaluateVisibleWhen(vw: VisibleWhenClause, item: unknown): boolean {
  // `settings.*` reads the site's FluentCommunity configuration rather
  // than the bound row. A glyph that exists only where a plugin switch
  // allows it — the audio one needs FluentPlayer with audio on, the poll
  // one needs the survey module — is not a property of any data item, and
  // there is no row under the composer to hang it off. Placement-level
  // gating cannot reach a CHILD, so the clause grammar grows instead of
  // the Superstructure splitting into variants.
  //
  // `readDataPath` only walks a path that begins `data.`, so the prefix is
  // swapped rather than stripped. Stripping it returns undefined for every
  // clause, which fails CLOSED for `== true` — the glyph disappears and
  // looks like the setting is off.
  //
  // `state.*` is the third root, and it reads a FLAT bag rather than
  // dot-walking: `state.post_draft.has_documents` is one key, the way
  // placement-level clauses have always been written. It exists because
  // some gates are facts about the DRAFT rather than about the site or a
  // row — the paperclip needs a space that takes documents, and the other
  // four glyphs have to disappear once a document is attached, because
  // FluentCommunity resolves exactly one content_type and the document
  // filter runs last.
  const resolved = vw.binding.startsWith('settings.')
    ? readDataPath(getFcRuntimeSettings(), vw.binding.replace(/^settings\./, 'data.'))
    : vw.binding.startsWith('state.')
      ? childStateBag()[vw.binding.slice('state.'.length)]
      : readDataPath(item, vw.binding);
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

    const raw =
      overrides && entry.name in overrides
        ? overrides[entry.name]
        : entry.default;
    if (raw === undefined || raw === null) continue;
    const value = interpolateStateTokens(raw);

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

/**
 * Substitutes `{state.<slice>.<key>}` tokens inside a catalog prop string.
 *
 * Two designs need a prop to carry live state, and neither can be served by
 * a per-value AppZet:
 *
 *   - the search field's placeholder follows the tab ("Search posts" /
 *     "Search members" / "Search spaces"). Three tab-gated fields would
 *     have worked visually and been wrong: IonInput renders UNCONTROLLED,
 *     so remounting one clears the text the viewer typed, and design 4
 *     shows that text surviving a tab switch.
 *   - the no-match line echoes the query — `No posts matched "wibble"`.
 *
 * Deliberately narrow. Only `state.*` resolves; anything else is left
 * alone, so a literal brace in copy stays a literal brace. An unresolvable
 * binding collapses to an empty string rather than printing its own path,
 * because a user seeing `No posts matched "{state.search_controls.query}"`
 * is worse than seeing an empty pair of quotes.
 *
 * Non-strings pass straight through: most props are booleans, sizes and
 * colours, and the `indexOf` guard means those cost nothing.
 */
function interpolateStateTokens(value: unknown): unknown {
  if (typeof value !== 'string' || value.indexOf('{state.') === -1) return value;
  return value.replace(/\{(state\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\}/gi, (_match, binding: string) => {
    const resolved = readStateBinding(binding);
    if (resolved === undefined || resolved === null) return '';
    return typeof resolved === 'object' ? '' : String(resolved);
  });
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

    // One toggle may govern SEVERAL children. The level row is the reason:
    // its marker is a numbered circle OR a padlock, two children sharing a
    // grid cell and gated against each other, so "show the marker" cannot
    // name just one of them. Accepts an array or a comma-separated string,
    // the same two shapes every other directive key takes (P53); a bare
    // `children[N]` is the same single-target case as before.
    const targets = parseChildIndexSpec(entry.controls_visibility_of);
    if (targets.size === 0) continue;

    if (!boolValue) for (const idx of targets) hidden.add(idx);
  }
  return hidden;
}

/**
 * Parses a `controls_visibility_of` value into the indices it governs.
 * Accepts `children[2]`, `children[0],children[1]` and
 * `['children[0]', 'children[1]']` alike (P53).
 */
function parseChildIndexSpec(spec: unknown): Set<number> {
  const out = new Set<number>();
  const list = Array.isArray(spec)
    ? spec
    : typeof spec === 'string'
      ? spec.split(',')
      : [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const parsed = parseChildIndex(raw.trim());
    if (parsed) out.add(parsed.index);
  }
  return out;
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

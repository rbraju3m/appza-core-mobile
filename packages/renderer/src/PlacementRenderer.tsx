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
import { childAreas, gridLayoutStyle } from './gridLayout';
import { useActionDispatch, type ActionInvocation } from './actionContext';
import { useFeedControls } from './feedControls';
import { useSpacesControls } from './spacesControls';
import { useProfileControls } from './profileControls';
import { useMemberDirectoryControls } from './memberDirectoryControls';
import { useCourseListControls } from './courseListControls';
import { useCourseStudentsControls } from './courseStudentsControls';
import { useCourseLessonControls } from './courseLessonControls';
import {
  courseDetailStateEntries,
  getCourseDetailControls,
  useCourseDetailControls,
} from './courseDetailControls';
import { useModerationControls } from './moderationControls';
import { setSpaceDetailControls, useSpaceDetailControls } from './spaceDetailControls';
import { setChatControls, useChatControls } from './chatControls';
import { setLeaderboardControls, useLeaderboardControls } from './leaderboardControls';
import { setBookmarkControls, useBookmarkControls } from './bookmarkControls';
import { clearListVerdict, setListVerdict } from './listVerdicts';
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
import { getViewer, useViewer, viewerStateEntries } from './viewer';
import {
  commentSortLabel,
  getPostDetailControls,
  normalizeCommentSort,
  setPostDetailControls,
  usePostDetailControls,
} from './postDetailControls';
import { publishCommentsView } from './CommentThread';
import { getPostDraft, postDraftStateEntries, usePostDraft } from './postDraft';
import { SELF_ACTION_PRIMITIVES } from './PrimitiveRenderer';
import { validLayout } from './effectivePlacements';

const PAGINATED_DATA_SOURCES = new Set<string>(['fc-feed', 'fc-space-members', 'fc-members-directory', 'fc-moderation-reports']);
const PAGE_SIZE_BY_SLUG: Record<string, number> = {
  'fc-feed': 10,
  'fc-space-members': 20,
  'fc-members-directory': 24,
};

type PlacementRendererProps = {
  appzetSlug: string;
  catalogIndex: CatalogIndex;
  customizations?: unknown;
  selectedAppzetSlug?: string | null;
  onSelectAppzet?: (slug: string | null) => void;
  propsOverride?: Record<string, unknown> | null;
  /** The site's own props for this placement (D110); they beat every other layer. */
  sitePropsOverride?: Record<string, unknown> | null;
  /** A variant Superstructure slug from the AppZet's `layouts`. */
  layout?: string | null;
  placementKey?: string;
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

const VIEW_MODE_VARIANTS: Record<
  string,
  { controls: 'feed' | 'bookmarks'; governingDs: string }
> = {
  'fc-post-card': {
    controls: 'feed',
    governingDs: 'fc-feed',
  },
  'fc-bookmark-card': {
    controls: 'bookmarks',
    governingDs: 'fc-bookmarks',
  },
};

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
  sitePropsOverride,
  layout,
  placementKey,
}: PlacementRendererProps) {
  const { viewMode: feedViewMode, sort: feedSort } = useFeedControls();
  // Every slice below is read unconditionally so hook order stays stable.
  const { tab: spacesTab, search: spacesSearch, sort: spacesSort } = useSpacesControls();
  const profileControls = useProfileControls();
  const { tab: profileTab, follow_view: followView } = profileControls;
  const {
    active_subtab: spaceDetailActiveSubtab,
    topic_slug: spaceDetailTopicSlug,
    sort: spaceDetailSort,
    space_slug: spaceDetailSpaceSlug,
    documents_search: spaceDetailDocumentsSearch,
    media_type: spaceDetailMediaType,
  } = useSpaceDetailControls();
  const fcSettings = useFcRuntimeSettings();
  const { member_list_layout: fcMemberListLayout } = fcSettings;
  const documentDraft = useDocumentDraft();
  // Subscribed so child clauses on state.post_draft.* re-evaluate; the evaluator reads the store directly.
  const composerDraft = usePostDraft();
  const chatControls = useChatControls();
  const leaderboardControls = useLeaderboardControls();
  const viewer = useViewer();
  const bannerControls = useBannerControls();
  const bookmarkControls = useBookmarkControls();
  const memberDirectory = useMemberDirectoryControls();
  const moderationControls = useModerationControls();
  const courseList = useCourseListControls();
  useCourseDetailControls();
  const courseStudents = useCourseStudentsControls();
  useCourseLessonControls();
  const postDetailControls = usePostDetailControls();
  const searchControls = useSearchControls();
  const draftTopicValues = useMemo(
    () => new Set(documentDraft.topic_ids.map((id) => String(id))),
    [documentDraft.topic_ids],
  );
  const requestedAppzet = catalogIndex.appzetBySlug.get(appzetSlug);
  // A placement that rebinds the DS isn't governed by feedControls, so it keeps the timeline layout.
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
  // Undefined where no slice governs layout; an absent attribute is what the CSS reads as Timeline.
  const listViewMode = variantGovernedDs ? variantViewMode : undefined;
  const baseAppzet = requestedAppzet;

  // Option fetches are delegated to <OptionDataSourceFetcher /> children so hook order stays stable.
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

  const appzet = baseAppzet
    ? {
        ...baseAppzet,
        default_props_override: {
          // Core placement props sit under the site's AppZet-wide edit; the site's own placement props win.
          ...(resolveOverridableColumn(
            customizations,
            'appzet',
            baseAppzet.slug,
            'default_props_override',
            { ...(baseAppzet.default_props_override ?? {}), ...(propsOverride ?? {}) },
          ) as Record<string, unknown>),
          ...(sitePropsOverride ?? {}),
          ...optionData,
          // The label is state, and no field_mapping can bind state.
          ...(baseAppzet.slug === 'fc-comment-sort'
            ? { label: commentSortLabel(postDetailControls.comment_sort) }
            : {}),
          ...(baseAppzet.slug === 'fc-members-toolbar'
            ? {
                sort_label: followSortLabel(
                  memberDirectory.sort_by,
                  (baseAppzet.actions as Record<string, unknown> | null | undefined)?.[
                    'on_tap_sort'
                  ],
                ),
              }
            : {}),
          ...(baseAppzet.slug === 'fc-course-students-toolbar'
            ? {
                sort_label: followSortLabel(
                  courseStudents.sort_by,
                  (baseAppzet.actions as Record<string, unknown> | null | undefined)?.[
                    'on_tap_sort'
                  ],
                ),
              }
            : {}),
          ...(baseAppzet.slug === 'fc-courses-sort'
            ? {
                sort_button_text: followSortLabel(
                  courseList.sort_by,
                  (baseAppzet.actions as Record<string, unknown> | null | undefined)?.[
                    'on_tap_sort'
                  ],
                ),
              }
            : {}),
          ...(baseAppzet.slug === 'fc-follow-sort'
            ? {
                label: followSortLabel(
                  profileControls.follow_sort,
                  (baseAppzet.actions as Record<string, unknown> | null | undefined)?.[
                    'on_tap_sort'
                  ],
                ),
              }
            : {}),
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
                // Same merged list the sheet opens with, so a site-added sort shows its label, not the raw key.
                const catalogRows = readPickerOptions(opts);
                const rows =
                  slice === 'feed'
                    ? resolveFeedSortRows(catalogRows, viewer.is_logged_in)
                    : catalogRows;
                let label = sortValue;
                const match = rows.find((o) => o.value === sortValue);
                if (match) label = match.label;
                const viewIcon =
                  viewValue === 'card'
                    ? 'grid-outline'
                    : viewValue === 'list'
                      ? 'reorder-four-outline'
                      : 'list-outline';
                // Forced-off only: the site wins when it forbids the picker, but never re-enables one a builder turned off.
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

  const layoutSlug = validLayout(baseAppzet, layout);
  const ss = layoutSlug
    ? catalogIndex.superstructureBySlug.get(layoutSlug)
    : appzet?.superstructure_id
      ? catalogIndex.superstructureById.get(appzet.superstructure_id)
      : undefined;
  const localStateBag: Record<string, unknown> = {
    // Keyed the same way ScreenRenderer keys it so child and placement gates share one vocabulary.
    ...Object.fromEntries(
      Object.entries(viewerStateEntries(viewer)).map(([k, v]) => [`state.${k}`, v]),
    ),
    'state.spaces_tab': spacesTab,
    'state.spaces_search': spacesSearch,
    'state.spaces_sort': spacesSort,
    'state.feed_sort': feedSort,
    'state.feed_view_mode': feedViewMode,
    'state.space_detail_controls.active_subtab': spaceDetailActiveSubtab,
    'state.space_detail_controls.topic_slug': spaceDetailTopicSlug,
    'state.space_detail_controls.sort': spaceDetailSort,
    'state.space_detail_controls.space_slug': spaceDetailSpaceSlug,
    'state.leaderboard_controls.range': leaderboardControls.range,
    'state.leaderboard_controls.levels_scope': leaderboardControls.levels_scope,
    'state.bookmark_controls.search': bookmarkControls.search,
    'state.bookmark_controls.sort': bookmarkControls.sort,
    'state.bookmark_controls.view_mode': bookmarkControls.viewMode,
    'state.bookmark_controls.view': bookmarkControls.view,
    'state.member_directory_controls.status': memberDirectory.status,
    'state.member_directory_controls.search': memberDirectory.search,
    'state.member_directory_controls.sort_by': memberDirectory.sort_by,
    'state.member_directory_controls.sort_dir': memberDirectory.sort_dir,
    'state.moderation_controls.status': moderationControls.status,
    'state.course_list_controls.tab': courseList.tab,
    'state.course_list_controls.type': courseList.type,
    'state.course_list_controls.search': courseList.search,
    'state.course_list_controls.topic_slug': courseList.topic_slug,
    'state.course_list_controls.sort_by': courseList.sort_by,
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
  // Placement-level data_source_slug wins over the state-scoped map and the AppZet default.
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

  // Both hooks always run (never gate a hook behind an `if`); the inactive one gets an undefined slug.
  const isPaginated = !!dataSource && PAGINATED_DATA_SOURCES.has(dataSource.slug);
  const pagedSlug = isPaginated ? dataSource!.slug : undefined;
  // Explicit query_params on the DS win over fc-feed's hardcoded order_by_type fallback.
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
  // The hook never sees the catalog, so the client_state_binding travels with the slug.
  const clientStateBinding = dataSource?.client_state_binding || null;
  const staticState = useDataSource(staticSlug, staticParams, clientStateBinding);
  const dataState = isPaginated
    ? {
        items: pagedState.items,
        loading: pagedState.loading,
        error: pagedState.error,
        stale: false,
      }
    : staticState;

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

  // IonInfiniteScroll needs complete() only once the load-more has landed, or its spinner janks or sticks.
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

  const publishesDocumentsView = (dataSource?.slug ?? '') === 'fc-space-documents';
  useEffect(() => {
    if (!publishesDocumentsView) return;
    // Hold the last view during a refetch: publishing 'loading' would unmount the search bar mid-typing.
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

  const publishesMediaView = (dataSource?.slug ?? '') === 'fc-space-media';
  useEffect(() => {
    if (!publishesMediaView) return;
    // Hold across a refetch, or the empty state flashes between tabs.
    if (dataState.loading) return;
    setSpaceDetailControls({ media_view: dataState.items.length > 0 ? 'list' : 'empty' });
  }, [publishesMediaView, dataState.loading, dataState.items.length]);

  // The message list isn't gated on this: it has to stay mounted to run the fetch.
  const publishesMessagesView = (dataSource?.slug ?? '') === 'fc-chat-messages';
  useEffect(() => {
    if (!publishesMessagesView) return;
    if (dataState.loading) return;
    setChatControls({ messages_view: dataState.items.length > 0 ? 'list' : 'empty' });
  }, [publishesMessagesView, dataState.loading, dataState.items.length]);

  // `has_more` is decided server-side and stamped on every row, so the first row answers.
  const publishesLevelsView = (dataSource?.slug ?? '') === 'fc-leaderboard-levels';
  useEffect(() => {
    if (!publishesLevelsView) return;
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

  // The plug-in answers a denial with an empty list: an error would fall through the proxy into fixture data.
  const publishesRanksView = (dataSource?.slug ?? '') === 'fc-leaderboard-ranks';
  useEffect(() => {
    if (!publishesRanksView) return;
    if (dataState.loading) return;
    setLeaderboardControls({ ranks_view: dataState.items.length > 0 ? 'list' : 'empty' });
  }, [publishesRanksView, dataState.loading, dataState.items.length]);

  const emptyStateKey =
    typeof (appzet?.default_props_override as Record<string, unknown> | undefined)?.[
      'empty_state_key'
    ] === 'string'
      ? ((appzet?.default_props_override as Record<string, unknown>)['empty_state_key'] as string)
      : '';
  useEffect(() => {
    if (!emptyStateKey) return;
    if (dataState.loading) return;
    setListVerdict(emptyStateKey, dataState.items.length > 0 ? 'list' : 'empty');
  }, [emptyStateKey, dataState.loading, dataState.items.length]);
  useEffect(() => {
    if (!emptyStateKey) return;
    // Drop the key on unmount, or a stale 'empty' paints under another tab.
    return () => clearListVerdict(emptyStateKey);
  }, [emptyStateKey]);

  // Ungated on purpose: it has to stay mounted to run the fetch that decides the verdict.
  const publishesBookmarksView = (dataSource?.slug ?? '') === 'fc-bookmarks';
  useEffect(() => {
    if (!publishesBookmarksView) return;
    // `stale`, not just `loading`: loading is set in an effect, so this commit still pairs the new search with the old items.
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

  // Applied once, only to a viewer who never chose; waits for `sort_options` so it seeds from the site, not FC's factory defaults.
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
    // No fallback to `default_view_mode`: FluentCommunity's `default_feed_layout` is never empty.
    const viewMode: FeedViewMode = feed.default_layout;
    seedFeedControls({ ...(sort ? { sort } : {}), viewMode });
  }, [isFeedToolbar, fcSettings.feed, authoredToolbarProps]);

  // Counted here: the clause grammar has no "more than two" operator.
  const publishesBannerCtas = (dataSource?.slug ?? '') === 'fc-welcome-banner';
  useEffect(() => {
    if (!publishesBannerCtas) return;
    if (dataState.loading) return;
    const first = dataState.items[0];
    const ctas = isRecord(first) && Array.isArray(first.ctaButtons) ? first.ctaButtons : [];
    setBannerControls({ hasExtraCtas: ctas.length > 2 });
  }, [publishesBannerCtas, dataState.loading, dataState.items]);

  // Three sources share this key; only one result card is ever mounted, gated on `active_scope`.
  const searchResultSlugs = ['fc-search-posts', 'fc-search-members', 'fc-search-spaces'];
  const publishesSearchView = searchResultSlugs.includes(dataSource?.slug ?? '');
  useEffect(() => {
    if (!publishesSearchView) return;
    // `stale`, not just `loading`: this commit still pairs the new query with the previous items.
    if (dataState.loading || dataState.stale) {
      publishSearchFetchView('loading');
      return;
    }
    publishSearchFetchView(dataState.items.length > 0 ? 'results' : 'no-match');
  }, [publishesSearchView, dataState.loading, dataState.stale, dataState.items.length]);

  // A footer placement reads only state, so the composer's gate is published here.
  const publishesThreadState = (dataSource?.slug ?? '') === 'fc-chat-thread';
  useEffect(() => {
    if (!publishesThreadState) return;
    if (dataState.loading) return;
    const row = dataState.items[0];
    const canSend = isRecord(row) && row.can_send_message === true;
    setChatControls({ can_send: canSend ? 'yes' : 'no' });
  }, [publishesThreadState, dataState.loading, dataState.items]);

  // Published on render, not on the tap, so deep links and the simulator picker get the right gate.
  const publishesPostDetail = (dataSource?.slug ?? '') === 'fc-post-detail';
  const postDetailRow = publishesPostDetail ? dataState.items[0] : undefined;
  const postDetailRowKey =
    publishesPostDetail && isRecord(postDetailRow)
      ? [
          String(postDetailRow.id ?? ''),
          String(postDetailRow.slug ?? ''),
          String(postDetailRow.default_comment_sort_by ?? ''),
          String(isRecord(postDetailRow.meta) ? postDetailRow.meta.comments_disabled ?? '' : ''),
        ].join('|')
      : '';
  useEffect(() => {
    if (!publishesPostDetail) return;
    if (dataState.loading) return;
    const row = postDetailRow;
    if (!isRecord(row)) {
      setPostDetailControls({ can_comment: 'no' });
      return;
    }
    const meta = isRecord(row.meta) ? row.meta : {};
    // FluentCommunity's comments-off switch applies to everyone, moderators included.
    const commentsOff = meta.comments_disabled === 'yes';
    const canComment = commentsOff ? 'no' : getViewer().is_logged_in ? 'yes' : 'signin';

    const patch: Record<string, unknown> = {
      can_comment: canComment,
      post_id: row.id == null ? '' : String(row.id),
      post_slug: typeof row.slug === 'string' ? row.slug : '',
    };
    if (!getPostDetailControls().comment_sort_touched) {
      patch.comment_sort = normalizeCommentSort(row.default_comment_sort_by);
    }
    setPostDetailControls(patch as Partial<ReturnType<typeof getPostDetailControls>>);
    // Keyed on the row's identity: `items` is new every render, and this effect writes state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishesPostDetail, dataState.loading, postDetailRowKey]);

  // `stale` as well as `loading`, or the previous post's comments decide the verdict.
  const publishesLessonDiscussion =
    (dataSource?.slug ?? '') === 'fc-course-lesson' && baseAppzet?.slug === 'fc-course-lesson-header';
  const lessonRow = publishesLessonDiscussion ? dataState.items[0] : undefined;
  const lessonRowKey =
    publishesLessonDiscussion && isRecord(lessonRow)
      ? [String(lessonRow.id ?? ''), String(lessonRow.comments_enabled ?? ''), String(lessonRow.comments_can_write ?? '')].join('|')
      : '';
  useEffect(() => {
    if (!publishesLessonDiscussion || dataState.loading) return;
    const row = lessonRow;
    if (!isRecord(row) || !row.id) {
      setPostDetailControls({ can_comment: 'off' });
      return;
    }
    const patch: Partial<ReturnType<typeof getPostDetailControls>> = {
      post_id: String(row.id),
      post_slug: typeof row.slug === 'string' ? `lesson:${row.slug}` : '',
      can_comment: row.comments_enabled !== true ? 'off' : row.comments_can_write === true ? 'yes' : 'no',
    };
    if (!getPostDetailControls().comment_sort_touched) patch.comment_sort = 'oldest';
    setPostDetailControls(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishesLessonDiscussion, dataState.loading, lessonRowKey]);

  const publishesCommentsView = ['fc-post-comments', 'fc-lesson-comments'].includes(dataSource?.slug ?? '');
  useEffect(() => {
    if (!publishesCommentsView) return;
    if (dataState.loading || dataState.stale) {
      publishCommentsView('loading');
      return;
    }
    publishCommentsView(dataState.items.length > 0 ? 'list' : 'empty');
  }, [publishesCommentsView, dataState.loading, dataState.stale, dataState.items.length]);

  // FluentCommunity ships realtime off, so poll; an interval of 0 disables it.
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

  // Runs before readExpandedChildren so children_from_prop sees the mirrored array in the same pass.
  const dpoBag = (appzet.default_props_override ?? null) as Record<string, unknown> | null;
  // Set when the whole items array went to a prop, so the row loop must not repeat over it too.
  let wholeListMirrored = false;
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
        mirrored = dataState.items;
        wholeListMirrored = true;
      } else if (dataPath.startsWith('data.') && dataState.items.length > 0) {
        mirrored = readDataPath(dataState.items[0], dataPath);
      }
      if (Array.isArray(mirrored) && mirrored.length > 0) {
        (appzet as { default_props_override: Record<string, unknown> }).default_props_override = {
          ...(appzet.default_props_override ?? {}),
          [propName]: mirrored,
        };
      }
    }
  }

  if (
    configApplySpec &&
    typeof configApplySpec.data_path === 'string' &&
    configApplySpec.data_path.length > 0
  ) {
    const dataPath = configApplySpec.data_path;
    const mergeIntoRaw =
      typeof configApplySpec.merge_into === 'string' ? configApplySpec.merge_into : 'default_props';
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
            // Carry requires_permission and on_click_action across a `prop:` override: SpaceConfigController's sanitizer drops both.
            const CATALOG_OWNED_ENTRY_KEYS = ['requires_permission', 'on_click_action'] as const;
            const baseEntries = (appzet.default_props_override ?? {})[propName];
            let nextValue: unknown = configValue;
            if (Array.isArray(nextValue) && Array.isArray(baseEntries)) {
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

  // `hidden` returns early only after the wrapper is built, so the placement keeps its DOM order.
  {
    const dpo = (appzet.default_props_override ?? {}) as Record<string, unknown>;
    if (dpo['hidden'] === true) {
      return <span data-appza-hidden-appzet={appzet.slug} data-appza-placement-key={placementKey} style={{ display: 'none' }} />;
    }
    const readSlug = (v: unknown): string | undefined => {
      if (!isRecord(v)) return undefined;
      const s = (v as Record<string, unknown>).slug;
      return typeof s === 'string' ? s : undefined;
    };
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
  if (appzet.slug === 'fc-add-document-appbar' && documentDraft.submitting) {
    const busy = readAppzetProp(ss, appzet, 'submit_busy_label');
    if (typeof busy === 'string' && busy !== '') {
      baseChildOverrides[2] = { ...(baseChildOverrides[2] ?? {}), text: busy };
    }
  }
  // Through the child override, not a stylesheet: ThemedIonButton paints ::part(native) with !important.
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
  // The dropzone is gated separately: FluentCommunity Pro guards uploads on the space's Document Library switch.
  if (appzet.slug === 'fc-edit-document-files' && !composerDraft.space_can_upload_documents) {
    baseChildOverrides[0] = { ...(baseChildOverrides[0] ?? {}), show_dropzone: false };
  }
  if (appzet.slug === 'fc-add-document-schedule' && documentDraft.scheduled_at) {
    const prefix = readAppzetProp(ss, appzet, 'scheduled_prefix');
    baseChildOverrides[1] = {
      ...(baseChildOverrides[1] ?? {}),
      text: `${typeof prefix === 'string' ? prefix : ''}${formatScheduledAt(documentDraft.scheduled_at)}`,
    };
  }

  const hiddenIndices = computeHiddenIndices(ss, appzet);
  // `data.*` clauses resolve to undefined here: there is no row.
  const singlePathHidden = useMemo(() => {
    const dataHidden = computeDataHiddenIndices(readChildren(ss), null);
    if (dataHidden.size === 0) return hiddenIndices;
    return new Set<number>([...hiddenIndices, ...dataHidden]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ss, hiddenIndices, fcSettings, composerDraft, documentDraft]);
  const childLayoutStyles = computeChildLayoutStyles(appzet, ss, customizations);

  // A strip already expanded from the DS items must not also repeat per item, or each chip draws N times.
  const cfpProp = (ss as unknown as { children_from_prop?: unknown }).children_from_prop;
  const isVariadicFromDs =
    typeof cfpProp === 'string' &&
    cfpProp.length > 0 &&
    Object.keys(expanded.entryOverrides).length > 0;

  const isVariadicFromItem =
    typeof cfpProp === 'string' && cfpProp.length > 0 && !isVariadicFromDs;

  // Same collapse for an AppZet handed the whole list without children_from_prop (the comment thread).
  const isWholeListMirrored = wholeListMirrored;

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

  const optionFetchers =
    optionDsEntries.length > 0 ? (
      <>
        {optionDsEntries.map(([propName, dsSlug]) => {
          // Without the DS's own query_params a route-param bound source fetches with none and returns [].
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

  // Flat right-panel keys win over the `_style` bag.
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
    'row_bg_color',
    'search_bg_color',
    'search_border_color',
    'search_text_color',
    'search_icon_color',
    'search_radius',
    'search_height',
    'sort_bg_color',
    'sort_text_color',
    'tab_text_color',
    'name_size',
    'menu_color',
    'headline_color',
    'badge_bg_color',
    'badge_text_color',
    'pending_bg_color',
    'pending_text_color',
    'blocked_bg_color',
    'blocked_text_color',
    'deactivated_bg_color',
    'deactivated_text_color',
    'follow_bg_color',
    'follow_text_color',
    'following_text_color',
    'divider_color',
    'comment_bg_color',
    'remove_member_icon_color',
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
    'title_color',
    'type_color',
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
    'bg_color',
    'icon_color',
    'icon_size',
    'size',
    'shadow',
    'offset_right',
    'offset_bottom',
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
    'sort_text_color',
    'sort_icon_color',
    'view_icon_color',
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
    // Topic chips don't reuse chip_*: those carry Ionic aliases that would repaint the attach buttons in the same card.
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
    'move_gap',
    'move_box_gap',
    'move_box_size',
    'move_box_radius',
    'move_box_border_color',
    'move_box_checked_bg_color',
    'move_box_checked_tick_color',
    'move_label_color',
    'move_label_size',
    'move_chip_bg_color',
    'move_chip_color',
    'move_chip_size',
    'move_chip_weight',
    'move_chip_radius',
    'move_chip_padding',
    'move_chip_gap',
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
    'audio_gap',
    'audio_remove_bg_color',
    'audio_remove_color',
    // Bespoke primitives on placed AppZets only see panel edits through these CSS variables.
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
    'cover_bg_color',
    'button_bg_color',
    'button_text_color',
    'web_button_bg_color',
    'locked_bg_color',
    'paywall_bg_color',
    'lesson_color',
    'status_icon_color',
    'video_icon_color',
  ]);
  // Custom props inherit through shadow DOM, so Ionic-native aliases are stamped too.
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
          data-appza-placement-key={placementKey}
          data-appza-can-submit={
            appzet.slug === 'fc-add-document-appbar'
              ? String(documentDraft.files.length > 0 && !documentDraft.submitting)
              : undefined
          }
          data-appza-can-send={
            appzet.slug === 'fc-chat-input'
              ? String(chatControls.draft.trim().length > 0 || chatControls.attachments.length > 0)
              : undefined
          }
          /* `can_post` mirrors FluentCommunity's own refusals; stamped only for the create appbar. */
          data-appza-can-post={
            appzet.slug === 'fc-create-post-appbar'
              ? String(postDraftStateEntries(composerDraft)['post_draft.can_post'] === 'yes')
              : undefined
          }
          data-spaces-active-tab={appzet.slug === 'fc-spaces-tabs' ? spacesTab : undefined}
          data-space-detail-active-subtab={appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab : undefined}
          data-profile-active-tab={
            appzet.slug === 'fc-profile-tabs'
              ? profileTab
              : appzet.slug === 'fc-follow-tabs'
                ? followView
                : undefined
          }
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
              appzet.slug === 'fc-profile-tabs' ? profileTab :
              appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab :
              appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug :
              appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug :
              appzet.slug === 'fc-spaces-tabs' ? spacesTab :
              appzet.slug === 'fc-leaderboard-tabs' ? leaderboardControls.range :
              appzet.slug === 'fc-search-tabs' ? searchControls.tab :
              appzet.slug === 'fc-search-scope-tabs' ? searchControls.post_scope :
              appzet.slug === 'fc-follow-tabs' ? followView :
              appzet.slug === 'fc-members-tabs' ? memberDirectory.status :
              appzet.slug === 'fc-moderation-tabs' ? moderationControls.status :
              appzet.slug === 'fc-courses-tabs' ? courseList.tab :
              appzet.slug === 'fc-courses-topics' ? courseList.topic_slug :
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

  // The row says whether the viewer may see this at all, so a placeholder would leak it.
  if (
    (appzet.default_props_override as Record<string, unknown> | undefined)?.['hide_while_loading'] ===
      true &&
    dataState.loading &&
    dataState.items.length === 0
  ) {
    return <>{optionFetchers}</>;
  }

  // Static parts stay live before the row lands; `data-appza-loading` lets CSS hold back what must not be tapped early.
  const drawingWhileLoading =
    (appzet.default_props_override as Record<string, unknown> | undefined)?.['draw_while_loading'] ===
      true &&
    dataState.loading &&
    dataState.items.length === 0;

  // Placeholder only on the first fetch: unmounting on refetch would reset local state like the video's `playing`.
  if (dataState.loading && dataState.items.length === 0 && !drawingWhileLoading) {
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
          data-appza-placement-key={placementKey}
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

  if (
    isPaginated &&
    !dataState.loading &&
    dataState.items.length === 0 &&
    (appzet.default_props_override as Record<string, unknown> | undefined)?.['hide_when_empty'] !== true
  ) {
    return (
      <>
        {optionFetchers}
        <div
          className="appza-renderer-empty"
          data-slug={appzet.slug}
          data-appza-placement-key={placementKey}
          data-view-mode={listViewMode}
        >
          <p>No posts to show</p>
          <small>Try a different sort or come back later.</small>
        </div>
      </>
    );
  }

  // Without hide_when_empty a zero-row list paints a ghost card under the sibling empty state.
  if (
    (appzet.default_props_override as Record<string, unknown> | undefined)?.['hide_when_empty'] ===
      true &&
    !dataState.loading &&
    dataState.items.length === 0
  ) {
    return <>{optionFetchers}</>;
  }

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

  const rowGate = (appzet.default_props_override as Record<string, unknown> | undefined)?.[
    'row_visible_when'
  ];
  if (rowGate && typeof rowGate === 'object' && !dataState.loading) {
    const clauses = (Array.isArray(rowGate) ? rowGate : [rowGate])
      .map(parseVisibleWhenClause)
      .filter((c): c is VisibleWhenClause => c !== null);
    if (clauses.length > 0) {
      filteredItems = filteredItems.filter((it) => clauses.every((c) => evaluateVisibleWhen(c, it)));
      if (
        filteredItems.length === 0 &&
        (appzet.default_props_override as Record<string, unknown> | undefined)?.['hide_when_empty'] === true
      ) {
        return <>{optionFetchers}</>;
      }
    }
  }

  const items = isVariadicFromDs || isWholeListMirrored
    ? [{}]
    : filteredItems.length > 0
    ? filteredItems
    : [{}];
  const ssChildren = expanded.children;

  // A stylesheet can't see a missing sibling, so the verdict is stamped on the wrapper.
  return (
    <>
      {optionFetchers}
      <div
        className="appza-renderer-appzet-list"
        data-slug={appzet.slug}
        data-appza-placement-key={placementKey}
        data-view-mode={listViewMode}
        data-appza-loading={drawingWhileLoading ? 'true' : undefined}
        data-spaces-active-tab={appzet.slug === 'fc-spaces-tabs' ? spacesTab : undefined}
        data-space-detail-active-subtab={appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab : undefined}
          data-profile-active-tab={
            appzet.slug === 'fc-profile-tabs'
              ? profileTab
              : appzet.slug === 'fc-follow-tabs'
                ? followView
                : undefined
          }
        data-space-detail-active-topic={appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug : undefined}
        data-space-detail-active-space={appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug : undefined}
        data-media-active-type={appzet.slug === 'fc-media-tabs' ? spaceDetailMediaType : undefined}
        data-leaderboard-active-range={appzet.slug === 'fc-leaderboard-tabs' ? leaderboardControls.range : undefined}
        data-leaderboard-levels-view={appzet.slug === 'fc-level-row' ? leaderboardControls.levels_view : undefined}
        data-fc-member-layout={
          appzet.slug === 'fc-member-card'
            ? (fcMemberListLayout === 'grid' ? 'grid' : 'list')
            : ss?.slug === 'fc-directory-member-card'
              ? (() => {
                  const chosen = (appzet.default_props_override as Record<string, unknown> | undefined)?.['layout'];
                  if (chosen === 'grid' || chosen === 'list') return chosen;
                  return fcMemberListLayout === 'grid' ? 'grid' : 'list';
                })()
              : undefined
        }
        style={Object.keys(styleVars).length > 0 ? (styleVars as React.CSSProperties) : undefined}
      >
      {items.map((item, idx) => {
        const enrichedItem = enrichItemWithMyReactions(item);
        const itemExpanded = isVariadicFromItem
          ? readExpandedChildren(ss, appzet, enrichedItem)
          : null;
        const effChildren = itemExpanded ? itemExpanded.children : ssChildren;
        let itemOverrides = mergeFieldMappingsOntoOverrides(baseChildOverrides, appzet, enrichedItem);
        if (itemExpanded) {
          // Copy before stamping, or one row's files leak into the next.
          itemOverrides = { ...itemOverrides };
          // Seed each expanded row from the template's bucket: computeChildOverrides only stamps the literal index.
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
        if (appzet.slug === 'fc-member-card') {
          itemOverrides = applyMemberCardTransforms(itemOverrides, appzet, enrichedItem);
        }
        const dataHidden = computeDataHiddenIndices(effChildren, enrichedItem);
        const effectiveHidden =
          dataHidden.size === 0
            ? hiddenIndices
            : new Set<number>([...hiddenIndices, ...dataHidden]);
        const childOpenUrls = computeChildOpenUrls(effChildren, enrichedItem);
        const childActions = computeChildActions(effChildren, appzet, enrichedItem, items, idx);
        const rawItemId = isRecord(item)
          ? ((item as Record<string, unknown>).id ?? (item as Record<string, unknown>)._id)
          : undefined;
        const itemIdAttr =
          typeof rawItemId === 'string' || typeof rawItemId === 'number'
            ? String(rawItemId)
            : undefined;
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
                appzet.slug === 'fc-profile-tabs' ? profileTab :
              appzet.slug === 'fc-space-subtabs' ? spaceDetailActiveSubtab :
                appzet.slug === 'fc-space-topics' ? spaceDetailTopicSlug :
                appzet.slug === 'fc-space-switcher' ? spaceDetailSpaceSlug :
                appzet.slug === 'fc-spaces-tabs' ? spacesTab :
                appzet.slug === 'fc-leaderboard-tabs' ? leaderboardControls.range :
                appzet.slug === 'fc-search-tabs' ? searchControls.tab :
                appzet.slug === 'fc-search-scope-tabs' ? searchControls.post_scope :
                appzet.slug === 'fc-follow-tabs' ? followView :
              appzet.slug === 'fc-members-tabs' ? memberDirectory.status :
              appzet.slug === 'fc-moderation-tabs' ? moderationControls.status :
              appzet.slug === 'fc-courses-tabs' ? courseList.tab :
              appzet.slug === 'fc-courses-topics' ? courseList.topic_slug :
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

const SKELETON_COUNTS: Record<string, number> = {
  'fc-post-card': 3,
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
    let source: unknown[] = items;
    if (propName === 'topic_options' && items.length === 1 && isRecord(items[0])) {
      const rec = items[0] as Record<string, unknown>;
      if (Array.isArray(rec.topics)) source = rec.topics as unknown[];
    }
    const mapped = source
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const rec = raw as Record<string, unknown>;
        // FluentCommunity's /feeds/create and /feeds/update take topic_ids, so topic options key on id.
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

function enrichItemWithMyReactions(item: unknown): unknown {
  if (!isRecord(item)) return item;
  const viewerId =
    typeof (globalThis as { __appzaCurrentUserId?: unknown }).__appzaCurrentUserId === 'number'
      ? ((globalThis as { __appzaCurrentUserId?: number }).__appzaCurrentUserId as number)
      : null;
  const src = (item as Record<string, unknown>);
  const myTypes = new Set<string>();
  // FluentCommunity's reactions list omits bookmarks, so bookmark state needs the proxy's `my_reactions`.
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
  // Always a real string: field mappings ignore null, which would leave the old colour stuck.
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

  if (typeof displayName === 'string') {
    const bucket0 = result[0] ?? {};
    bucket0.initials = computeInitials(displayName);
    bucket0.alt = displayName;
    if (avatarMode === 'initials') {
      bucket0.src = '';
    }
    result[0] = bucket0;
  }
  // Force empty text, or the fallback name "Button" paints under the icon.
  const bucket1 = result[1] ?? {};
  bucket1.text = '';
  result[1] = bucket1;
  if (typeof username === 'string' && username !== '') {
    const bucket3 = result[3] ?? {};
    bucket3.text = usernamePrefix + username;
    result[3] = bucket3;
  } else {
    const bucket3 = result[3] ?? {};
    bucket3.text = '';
    result[3] = bucket3;
  }
  if (typeof createdAt === 'string' && createdAt !== '') {
    const bucket6 = result[6] ?? {};
    bucket6.text = joinedPrefix + formatRelativeTime(createdAt);
    result[6] = bucket6;
  }
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

/** The proxy pre-normalizes some created_at values but leaves last_activity raw, so accept both. */
function formatRelativeTime(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
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
  childLayoutStyles?: Record<number, LayoutStyle>;
  childOpenUrls?: Record<number, string>;
  childActions?: Record<number, ActionInvocation>;
  appzetSlugForPath?: string;
  activeChildValue?: string;
  activeChildValues?: ReadonlySet<string>;
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

  // A layout draws under its root's name so the root's styles apply; data-layout is what its own rules key on.
  const root = ss.parent_superstructure_id ? catalogIndex.superstructureById.get(ss.parent_superstructure_id) : undefined;
  // child_areas counts Composition positions; a children_from_prop strip renumbers them.
  const fromProp = (ss as unknown as { children_from_prop?: unknown }).children_from_prop;
  const areaOf = typeof fromProp === 'string' && fromProp !== '' ? new Map<number, string>() : childAreas(ss.grid_layout);

  return (
    <div
      className="appza-renderer-ss"
      data-slug={root?.slug ?? ss.slug}
      data-layout={root ? ss.slug : undefined}
      style={gridLayoutStyle(ss.grid_layout)}
    >
      {children.map((child, idx) => {
        if (hiddenIndices?.has(idx)) return null;
        const isTopLevel = depth === 0;
        const childLayoutStyle = isTopLevel ? childLayoutStyles?.[idx] : undefined;
        const openUrl = isTopLevel ? childOpenUrls?.[idx] : undefined;
        const action = isTopLevel ? childActions?.[idx] : undefined;
        // ion-input doubles as a tap-to-navigate pill; for other self-action primitives a wrapper tap would dispatch a change that never happened.
        const primitiveSelfHandles =
          SELF_ACTION_PRIMITIVES.has(child.slug) &&
          !(child.on_click_action && child.slug === 'ion-input');
        const wrapperAction = action && !primitiveSelfHandles ? action : undefined;
        // Self-action primitives get the action even with on_click_action: value change and tap are different events.
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
              // Only an explicit `value` override matches, so a value-less header can't match ''.
              const bucket = childOverrides?.[idx];
              if (!bucket || !('value' in bucket)) return undefined;
              const v = bucket.value;
              const asStr = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
              if (activeChildValues) return activeChildValues.has(asStr) ? 'true' : undefined;
              return asStr === activeChildValue ? 'true' : undefined;
            })()}
            style={(() => {
              const area = areaOf.get(idx);
              if (!childLayoutStyle && !area) return undefined;
              return { ...layoutStyleToCss(childLayoutStyle), ...(area ? { gridArea: area } : {}) };
            })()}
            onClick={wrapperAction
              ? (e) => {
                  e.stopPropagation();
                  // Variadic children fire actions that read ctx.slug, so carry the entry's identifying keys too.
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
                    ? // The name the row shows, not FC's storage filename.
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

type VisibleWhenOp =
  | '=='
  | '!='
  | 'exists'
  | 'not_exists'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains';

type VisibleWhenClause = {
  binding: string;
  op: VisibleWhenOp;
  value?: unknown;
  value_from?: string;
};

type VisibleWhen = VisibleWhenClause | VisibleWhenClause[];

type SSChild = {
  slug: string;
  visible_when?: VisibleWhen;
  on_click_open_url?: string;
  on_click_action?: string;
  field_mapping?: Record<string, string>;
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
    ...(typeof rec.value_from === 'string' ? { value_from: rec.value_from } : {}),
  };
}

/** An `entry.` clause is left off: nothing evaluates it yet, and it would fail every row closed. */
function cardLevelClauses(vw: VisibleWhen | undefined): VisibleWhen | undefined {
  if (!vw) return undefined;
  const keep = (c: VisibleWhenClause) =>
    !c.binding.startsWith('entry.') && !(c.value_from ?? '').startsWith('entry.');
  if (Array.isArray(vw)) {
    const kept = vw.filter(keep);
    return kept.length > 0 ? kept : undefined;
  }
  return keep(vw) ? vw : undefined;
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
        // An empty list says nothing, which has always meant show.
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
  let rawEntries = overrides ? overrides[propName] : undefined;
  if ((!Array.isArray(rawEntries) || rawEntries.length === 0) && isRecord(item)) {
    rawEntries = (item as Record<string, unknown>)[propName];
  }
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return { children: staticChildren, entryOverrides: {}, templateIndex: 0 };
  }
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
  // value='' so the query_params resolver drops the filter rather than sending `?topic_slug=`.
  const prependAll = overrides && overrides['prepend_all'] === true;
  const allLabel =
    overrides && typeof overrides['all_label'] === 'string'
      ? (overrides['all_label'] as string)
      : 'All';
  const workingEntries: unknown[] = prependAll
    ? [{ value: '', slug: '', label: allLabel, title: allLabel }, ...rawEntries]
    : rawEntries;
  const children: SSChild[] = [...staticPrefix];
  const entryOverrides: Record<number, Record<string, unknown>> = {};
  const fieldMapping = template.field_mapping;
  for (let i = 0; i < workingEntries.length; i++) {
    const entry = workingEntries[i];
    if (!isRecord(entry)) continue;
    if (entry.hidden === true) continue;
    // Fails open while the permissions bag is absent: a slow fetch shouldn't hide a tab.
    if (typeof entry.requires_permission === 'string' && entry.requires_permission !== '') {
      if (permissions && entry.requires_permission in permissions) {
        if (permissions[entry.requires_permission] !== true) continue;
      }
    }
    // computeChildOpenUrls only understands `data.` bindings, so `entry.` URLs resolve here.
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
    const rowGate = cardLevelClauses(template.visible_when);
    if (rowGate) child.visible_when = rowGate;
    children.push(child);
    const bucket: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) {
      // Directive keys, not child props: stamping them would leak onto the rendered element.
      if (k === 'hidden' || k === 'on_click_action' || k === 'requires_permission') continue;
      if (k === 'label') {
        bucket.text = v;
      } else {
        bucket[k] = v;
      }
    }
    if (fieldMapping) {
      for (const [k, spec] of Object.entries(fieldMapping)) {
        if (typeof spec !== 'string') continue;
        if (!spec.startsWith('entry.')) continue;
        // readDataPath only walks `data.` paths, hence the prefix.
        const resolved = readDataPath(entry, 'data.' + spec.slice('entry.'.length));
        if (resolved !== undefined && resolved !== null) {
          bucket[k] = resolved;
        }
      }
    }
    // Read off the raw child: readChildren() drops unknown keys like prop_map.
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

function computeChildOpenUrls(children: SSChild[], item: unknown): Record<number, string> {
  const out: Record<number, string> = {};
  for (let i = 0; i < children.length; i++) {
    const spec = children[i]?.on_click_open_url;
    if (!spec) continue;
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

/** Unparseable clauses fail open (child shown). */
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

/** Read fresh on every evaluation: a stale copy would show a glyph the draft has ruled out. */
function childStateBag(): Record<string, unknown> {
  return {
    ...postDraftStateEntries(getPostDraft()),
    ...bannerStateEntries(getBannerControls()),
    ...courseDetailStateEntries(getCourseDetailControls()),
  };
}

function followSortLabel(value: string, action: unknown): string {
  const args = isRecord(action) ? (action as Record<string, unknown>)['args'] : undefined;
  const options = isRecord(args) ? (args as Record<string, unknown>)['options'] : undefined;
  if (Array.isArray(options)) {
    for (const opt of options) {
      if (!isRecord(opt)) continue;
      if (opt['value'] === value && typeof opt['label'] === 'string') return opt['label'];
    }
  }
  return value;
}

function evaluateVisibleWhen(vw: VisibleWhenClause, item: unknown): boolean {
  // readDataPath only walks `data.`, so the prefix is swapped, not stripped (stripping fails `== true` closed); `state.*` reads a flat bag.
  const resolved = vw.binding.startsWith('settings.')
    ? readDataPath(getFcRuntimeSettings(), vw.binding.replace(/^settings\./, 'data.'))
    : vw.binding.startsWith('state.')
      ? childStateBag()[vw.binding.slice('state.'.length)]
      : readDataPath(item, vw.binding);
  const expected = vw.value_from ? readDataPath(item, vw.value_from) : vw.value;
  switch (vw.op) {
    case 'exists':
      return resolved !== undefined && resolved !== null && resolved !== '';
    case 'not_exists':
      return resolved === undefined || resolved === null || resolved === '';
    case '==':
      return resolved === expected;
    case '!=':
      return resolved !== expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(resolved as never);
    case 'not_in':
      return !(Array.isArray(expected) && expected.includes(resolved as never));
    case 'contains':
      return Array.isArray(resolved) && resolved.includes(expected as never);
    case 'not_contains':
      return !(Array.isArray(resolved) && resolved.includes(expected as never));
    default:
      return true;
  }
}

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

/** Only `state.*` resolves; an unresolvable binding becomes '' rather than printing its path. */
function interpolateStateTokens(value: unknown): unknown {
  if (typeof value !== 'string' || value.indexOf('{state.') === -1) return value;
  return value.replace(/\{(state\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\}/gi, (_match, binding: string) => {
    const resolved = readStateBinding(binding);
    if (resolved === undefined || resolved === null) return '';
    return typeof resolved === 'object' ? '' : String(resolved);
  });
}

function parseBindsTo(spec: string): { index: number; propName: string } | null {
  const match = /^children\[(\d+)\]\.([a-zA-Z_][\w-]*)$/.exec(spec);
  if (!match || !match[1] || !match[2]) return null;
  const index = Number.parseInt(match[1], 10);
  if (!Number.isInteger(index) || index < 0) return null;
  return { index, propName: match[2] };
}

function parseChildIndex(spec: string): { index: number } | null {
  const match = /^children\[(\d+)\]$/.exec(spec);
  if (!match || !match[1]) return null;
  const index = Number.parseInt(match[1], 10);
  if (!Number.isInteger(index) || index < 0) return null;
  return { index };
}

/** Hidden indices are skipped without renumbering, so binds_to paths still address original positions. */
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

    const targets = parseChildIndexSpec(entry.controls_visibility_of);
    if (targets.size === 0) continue;

    if (!boolValue) for (const idx of targets) hidden.add(idx);
  }
  return hidden;
}

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

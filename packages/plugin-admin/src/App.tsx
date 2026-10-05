import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  BootstrapEnvelopeSchema,
  type BootstrapEnvelope,
  type Catalog,
  type LayoutStyle,
  type PreviewMode,
  type TemplateScreen,
} from '@appza/schemas';
import {
  ActionProvider,
  PostOptionsPopover,
  ViewModePopover,
  buildDrawerMenu,
  filterScreensBySurface,
  openPostOptionsPopover,
  openViewModePopover,
  prefillPostInformationFromContext,
  readDataPath,
  resolveIcon,
  resolveOverridableColumn,
  addMemberPresentation,
  invitePresentation,
  childStylesFromCustomizations,
  ADD_MEMBER_CHILD_COUNT,
  INVITE_USER_CHILD_COUNT,
  setCatalogGlobal,
  setFcRuntimeSettings,
  setViewer,
  canBrowseAsGuest,
  PollVotersSheet,
  openPollVotersSheet,
  ModerationReviewSheet,
  announceModerationDone,
  getFcRuntimeSettings,
  setFeedControls,
  getFeedControls,
  setProfileControls,
  getProfileControls,
  getViewer,
  resolveFeedSortRows,
  setBannerControls,
  dismissBanner,
  DEFAULT_DISMISS_DAYS,
  setRouteParams,
  getRouteParams,
  setSpaceDetailControls,
  setChatControls,
  getChatControls,
  sendChatMessage,
  deleteChatMessage,
  pickAndUploadChatImage,
  discardChatAttachment,
  readActionDefaultsFromCatalog,
  ChatMembersSheet,
  FollowSheet,
  NewMessageModal,
  NEW_MESSAGE_MODAL_CHILD_COUNT,
  openProfileNewMessage,
  openFollowSheet,
  closeFollowSheet,
  followSheetPresentation,
  FOLLOW_SHEET_APPZET_SLUG,
  FOLLOW_SHEET_CHILD_COUNT,
  type FollowView,
  openChatMembersSheet,
  LeaderboardPointsSheet,
  openLeaderboardPointsSheet,
  leaderboardPointsPresentation,
  LEADERBOARD_POINTS_SHEET_CHILD_COUNT,
  setLeaderboardControls,
  resetLeaderboardControls,
  OptionsSheet,
  openOptionsSheet,
  sendJson,
  closeOptionsSheet,
  fetchDataSourceOnce,
  PostSpaceSheet,
  openPostSpaceSheet,
  VideoSheet,
  openVideoSheet,
  videoSheetPresentation,
  VIDEO_SHEET_CHILD_COUNT,
  PollSheet,
  openPollSheet,
  onPollSheetRequest,
  pollSheetPresentation,
  POLL_SHEET_CHILD_COUNT,
  onDocumentRequests,
  setDocumentBusy,
  uploadDraftDocument,
  renameDraftDocument,
  deleteDraftDocument,
  addPostDraftDocuments,
  removePostDraftDocument,
  renamePostDraftDocument,
  onScheduleSheetRequest,
  hydratePostDraftSpace,
  lookupVideoOembed,
  uploadDraftVideo,
  buildVideoMediaPayload,
  postSpaceSheetPresentation,
  POST_SPACE_SHEET_CHILD_COUNT,
  fetchPostSpacePayload,
  preparePostComposer,
  clearPostSpaceCache,
  resetPostDraft,
  setPostDraft,
  usePostDraft,
  getPostDraft,
  addPostDraftImages,
  addPostDraftAudios,
  optionsSheetPresentation,
  OPTIONS_SHEET_CHILD_COUNT,
  readPickerOptions,
  getBookmarkControls,
  setBookmarkControls,
  resetBookmarkControls,
  resetMemberDirectoryControls,
  resetCourseListControls,
  resetModerationControls,
  tryHandleModerationAction,
  tryHandleMemberDirectoryAction,
  tryHandleCourseListAction,
  tryHandleCourseDetailAction,
  tryHandleCourseStudentsAction,
  tryHandleCourseLessonAction,
  tryHandleCommentInlineAction,
  resetCourseStudentsControls,
  CourseAddStudentSheet,
  ReportSheet,
  tryHandleProfilePhotoAction,
  tryHandleLogoutConfirm,
  tryHandleProfileAccountAction,
  openProfileAddToSpace,
  tryHandleProfileTabAction,
  tryHandleScheduledPostAction,
  startHeadlineCounter,
  setSearchControls,
  recordRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  configureSearchControls,
  resetSearchControls,
  setPrimitiveInputValue,
  debounceSearch,
  cancelDebouncedSearch,
  postMenuSheetPresentation,
  POST_MENU_SHEET_CHILD_COUNT,
  closeChatMembersSheet,
  CHAT_MEMBERS_SHEET_CHILD_COUNT,
  chatMembersPresentation,
  ChatUserCard,
  openChatUserCard,
  closeChatUserCard,
  CHAT_USER_CARD_CHILD_COUNT,
  chatUserCardPresentation,
  setDocumentDraft,
  getDocumentDraft,
  resetDocumentDraft,
  ScheduleSheet,
  openScheduleSheet,
  patchScheduleSheet,
  schedulePresentation,
  SCHEDULE_SHEET_CHILD_COUNT,
  SCHEDULE_SHEET_APPZET_SLUG,
  MediaViewer,
  openMediaViewer,
  patchMediaViewer,
  mediaViewerPresentation,
  MEDIA_VIEWER_CHILD_COUNT,
  MEDIA_VIEWER_APPZET_SLUG,
  toggleDraftTopic,
  seedDraftForEdit,
  submitDocumentDraft,
  prepareDocumentEdit,
  setSpacesControls,
  getSpaceDetailControls,
  AddMemberModal,
  InviteUserModal,
  MemberOptionsSheet,
  MemberRemoveConfirm,
  MemberRoleSheet,
  closeAddMemberModal,
  closeInviteUserModal,
  closeMemberRemoveConfirm,
  patchAddMemberModal,
  patchInviteUserModal,
  openAddMemberModal,
  openInviteUserModal,
  openMemberOptionsSheet,
  openMemberRemoveConfirm,
  openMemberRoleSheet,
  type AddMemberRoleOption,
  type InviteChipPalette,
  type InviteRoleOption,
  type MemberMenuItem,
  type MemberRoleOption,
  tryHandlePostMenuAction,
  tryHandleProfileAction,
  tryHandleProfileSave,
  type ActionDispatch,
  type ActionInvocation,
  type PostMenuItem,
  type ViewModeOption,
} from '@appza/renderer';
import { drawerMenuItems, screenAppbarPlacements, screenPlacements } from '@appza/renderer';
import { setAuthHeaderProvider } from '@appza/renderer';

export type { PreviewMode };

export type UiMode = 'edit' | 'drag' | 'app';

import { TopBar } from './TopBar';
import { Sidebar, type BottomTab, type SidebarTab } from './Sidebar';
import { DeviceFrame, type SelectedPrimitive } from './DeviceFrame';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { indexCatalog } from '@appza/renderer';
import { BuilderPanel } from './BuilderPanel';
import { DragCanvas } from './DragCanvas';
import { useLayoutBuilder } from './useLayoutBuilder';
import { GlobalPanel } from './GlobalPanel';
import { patchItem } from './layoutApi';
import { useChromeBuilder } from './useChromeBuilder';
import { mainKeys, rowsOf } from './layoutApi';
import { OverridesPanel } from './OverridesPanel';
import { PropertiesPanel, type PropsScope } from './PropertiesPanel';
import { PrimitivePanel } from './PrimitivePanel';
import { OnboardingModal } from './OnboardingModal';
import { BuildAppModal } from './BuildAppModal';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; envelope: BootstrapEnvelope }
  | { kind: 'error'; message: string };

const DEFAULT_TEMPLATE = 'fluent-community-default';

type TemplateOption = {
  slug: string;
  name: string;
  source_integration_slug: string;
  source_integration_name: string;
};

// Uses the URL API so both the /wp-json and ?rest_route= forms work.
function buildBootstrapUrl(slug: string): string {
  const base = window.appzaCoreConfig?.endpoints?.bootstrap;
  if (base) {
    const url = new URL(base, window.location.origin);
    url.searchParams.set('template', slug);
    return url.toString();
  }
  return `/wp-json/appza/v1/bootstrap?template=${encodeURIComponent(slug)}`;
}

export function App() {
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [templateSlug, setTemplateSlug] = useState(
    window.appzaCoreConfig?.defaultTemplate ?? DEFAULT_TEMPLATE,
  );
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [buildAppOpen, setBuildAppOpen] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>(null);
  const [selectedAppzetSlug, setSelectedAppzetSlug] = useState<string | null>(null);
  const [selectedPrimitive, setSelectedPrimitive] = useState<SelectedPrimitive | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    window.appzaCoreConfig?.previewMode ?? 'auto',
  );
  const [uiMode, setUiMode] = useState<UiMode>('edit');
  const [builderTab, setBuilderTab] = useState<SidebarTab>('screen');
  const [propsScope, setPropsScope] = useState<PropsScope>('placement');
  const [screenStack, setScreenStack] = useState<number[]>([]);
  // A ref so writes don't render; persists on the screen because post.edit reads feed_id from it at Save time.
  const screenContextRef = useRef<Record<string, unknown>>({});
  // Guards the prefill so a memo re-compute doesn't overwrite user edits; nav.push clears it.
  const screenPrefilledRef = useRef<Record<string, true>>({});
  const [auth, setAuthState] = useState<StoredAuth | null>(() => readStoredAuth());
  const setAuth = useCallback((a: StoredAuth | null) => {
    writeStoredAuth(a);
    setAuthState(a);
    // user_id stays on window for enrichItemWithMyReactions.
    const g = window as unknown as { __appzaCurrentUserId?: number };
    if (a) {
      currentAuthHeader = basicAuthHeader(a);
      if (typeof a.user_id === 'number') g.__appzaCurrentUserId = a.user_id;
      else delete g.__appzaCurrentUserId;
    } else {
      currentAuthHeader = undefined;
      delete g.__appzaCurrentUserId;
    }
  }, []);
  useEffect(() => {
    const g = window as unknown as { __appzaCurrentUserId?: number };
    if (auth) {
      currentAuthHeader = basicAuthHeader(auth);
      if (typeof auth.user_id === 'number') g.__appzaCurrentUserId = auth.user_id;
    }
    // Re-issue fetches that ran before the header was set.
    window.dispatchEvent(new Event('appza:refresh-data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const clearAuthMessage = useCallback(() => setAuthMessage(null), []);
  const [menuToast, setMenuToast] = useState<{ message: string; kind: 'info' | 'error' } | null>(null);
  useEffect(() => {
    if (!menuToast) return;
    const t = window.setTimeout(() => setMenuToast(null), menuToast.kind === 'error' ? 3500 : 2000);
    return () => window.clearTimeout(t);
  }, [menuToast]);
  const showMenuInfo = useCallback((m: string) => setMenuToast({ message: m, kind: 'info' }), []);
  const showMenuError = useCallback((m: string) => setMenuToast({ message: m, kind: 'error' }), []);
  useEffect(() => {
    if (!authMessage) return;
    const t = window.setTimeout(() => setAuthMessage(null), 5000);
    return () => window.clearTimeout(t);
  }, [authMessage]);
  const [nowLabel, setNowLabel] = useState<string>(() => formatNowLabel(new Date()));
  useEffect(() => {
    if (uiMode !== 'app') return;
    const tick = () => setNowLabel(formatNowLabel(new Date()));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [uiMode]);
  const postDraft = usePostDraft();
  const pendingImages = useMemo(() => postDraft.images.map((i) => i.url), [postDraft.images]);
  const setImagesFromUrls = useCallback(
    (urls: string[]) => setPostDraft({ images: urls.map((url) => ({ url })) }),
    [],
  );
  const [uploadingCount, setUploadingCount] = useState(0);
  const [pendingVideo, setPendingVideo] = useState<{
    url: string;
    title?: string;
    image?: string;
    provider?: string;
  } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  // Holds everything the modal needs — the tapped item has left the render tree by then.
  type PendingDelete = {
    feedId: number;
    endpoint: string;
    method: string;
    bodyKey: string;
    title: string;
    message: string;
    cta: string;
    failLabel?: string;
    /** Every fcom-mobile comment route wants both the comment id and its post id. */
    extraBody?: Record<string, unknown>;
  };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [simMenuOpen, setSimMenuOpen] = useState(false);
  const [simRefreshing, setSimRefreshing] = useState(false);
  const [simPullDistance, setSimPullDistance] = useState(0);
  type CommentPanelState = {
    feedId: number;
    endpoint: string;
    method: string;
    listEndpoint: string;
    bodyKey: string;
    messageKey: string;
    panelTitle: string;
    placeholder: string;
    sendLabel: string;
    replyTo?: { id: number | string; name: string };
    edit?: {
      commentId: number | string;
      message: string;
      parentBodyKey: string;
      toastMessage: string;
    };
  };
  const [commentPanel, setCommentPanel] = useState<CommentPanelState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioUploadEndpointRef = useRef<string | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  // Rename/delete fire long after the picker closes, so their endpoints wait here.
  const docEndpointsRef = useRef<{ upload: string; rename: string; remove: string } | null>(null);
  // A ref, not state: a state setter would race the file input's onChange.
  const uploadEndpointRef = useRef<{
    method: string;
    endpoint: string;
    accept?: string;
    sink?: (urls: string[]) => void;
    onFail?: () => void;
  } | null>(null);
  const oembedEndpointRef = useRef<{ method: string; endpoint: string } | null>(null);
  // The feed API has no per-viewer "did I react?" flag, so mirror it locally.
  const reactedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!auth) {
      setPostDraft({ images: [] });
      setPendingVideo(null);
      resetPostDraft();
      setPendingDelete(null);
      setDeleteInFlight(false);
      uploadEndpointRef.current = null;
      oembedEndpointRef.current = null;
      reactedRef.current = new Set();
      setCommentPanel(null);
    }
  }, [auth]);
  const [livePreview, setLivePreview] = useState<{
    slug: string;
    override: Record<string, unknown>;
  } | null>(null);
  const [livePrimitivePreview, setLivePrimitivePreview] = useState<{
    compositeKey: string;
    layout: LayoutStyle;
  } | null>(null);

  useEffect(() => {
    pull(templateSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplates = useMemo(
    () => async () => {
      const endpoint = window.appzaCoreConfig?.endpoints?.templates;
      if (!endpoint) return;
      setTemplatesLoading(true);
      try {
        const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const body = await res.json();
        const list: TemplateOption[] = Array.isArray(body?.templates) ? body.templates : [];
        setTemplateOptions(list);
      } catch {
        /* dropdown falls back to whatever slug is already entered */
      } finally {
        setTemplatesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    const endpoint = window.appzaCoreConfig?.endpoints?.activeSourceIntegrations;
    const nonce = window.appzaCoreConfig?.restNonce;
    if (!endpoint || !nonce) {
      setOnboardingChecked(true);
      return;
    }
    let cancelled = false;
    fetch(endpoint, {
      headers: { Accept: 'application/json', 'X-WP-Nonce': nonce },
      credentials: 'same-origin',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        const slugs = Array.isArray(body?.slugs) ? body.slugs : [];
        if (slugs.length === 0) setOnboardingOpen(true);
      })
      .catch(() => {
        /* ignore — wizard can still be opened manually */
      })
      .finally(() => {
        if (!cancelled) setOnboardingChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.appzaCoreConfig) window.appzaCoreConfig = {};
    window.appzaCoreConfig.previewMode = previewMode;
  }, [previewMode]);

  async function syncFromCore(slug: string) {
    const endpoint = window.appzaCoreConfig?.endpoints?.syncFromCore;
    const nonce = window.appzaCoreConfig?.restNonce;
    if (!endpoint || !nonce) {
      setSyncMessage('Sync unavailable — open this page inside /wp-admin/.');
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('template', slug);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-WP-Nonce': nonce },
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
      const body = await response.json();
      setSyncMessage(
        `Synced ${body.template_slug} → v${body.catalog_snapshot_version}`,
      );
      await pull(slug);
      window.setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  // `quiet` refreshes in place after a layout save: no loading flash, and the screen stays.
  async function pull(slug: string, quiet = false) {
    if (!quiet) setState({ kind: 'loading' });
    try {
      const url = buildBootstrapUrl(slug);
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        setState({ kind: 'error', message: `HTTP ${response.status} from ${url}` });
        return;
      }
      const json = await response.json();
      const parsed = BootstrapEnvelopeSchema.safeParse(json);
      if (!parsed.success) {
        setState({
          kind: 'error',
          message: `Schema validation failed: ${parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        });
        return;
      }
      // Surface-gate once at ingest so everything downstream sees only this surface's screens.
      const gated: BootstrapEnvelope = {
        ...parsed.data,
        catalog: {
          ...parsed.data.catalog,
          template_screens: filterScreensBySurface(
            parsed.data.catalog.template_screens ?? [],
            'plugin',
          ),
        },
      };
      applyFcRuntimeSettings(gated);
      setState({ kind: 'ok', envelope: gated });
      const firstScreen = gated.catalog.template_screens?.[0];
      setSelectedScreenId((prev) =>
        quiet && gated.catalog.template_screens?.some((s) => s.id === prev) ? prev : firstScreen ? firstScreen.id : null,
      );
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const envelope = state.kind === 'ok' ? state.envelope : null;
  const catalog = envelope?.catalog;
  const screens = catalog?.template_screens ?? [];
  const appzets = catalog?.appzets ?? [];
  const superstructures = catalog?.superstructures ?? [];

  // PostOptionsPopover reads each menu item's action defaults from here at click time.
  useEffect(() => {
    setCatalogGlobal(catalog ?? null);
  }, [catalog]);

  const currentScreen = useMemo<TemplateScreen | null>(() => {
    if (!selectedScreenId) return null;
    return screens.find((s) => s.id === selectedScreenId) ?? null;
  }, [selectedScreenId, screens]);


  // Warm the per-viewer verdict on arrival (the cached bootstrap can't answer it). Don't reset the draft here — returning from the preview is also an arrival; nav.push owns that.
  useEffect(() => {
    if (uiMode !== 'app') return;
    const slug = currentScreen?.app_map_screen_slug;
    if (slug !== 'create-post-page' && slug !== 'edit-post-page') return;
    const wiring = readAppzetActionsFromCatalog('fc-post-information');
    const dsSlug =
      typeof wiring?.on_tap_space?.args?.data_source === 'string'
        ? (wiring.on_tap_space.args.data_source as string)
        : 'fc-post-space-picker';
    void preparePostComposer(dsSlug);
  }, [uiMode, currentScreen?.app_map_screen_slug, auth]);

  // Guarded by screenPrefilledRef so a re-render doesn't overwrite user edits.
  useEffect(() => {
    if (uiMode !== 'app' || !currentScreen) return;
    const slug = currentScreen.app_map_screen_slug;
    if (!slug) return;
    const ctx = screenContextRef.current[slug];
    if (ctx == null) return;
    if (screenPrefilledRef.current[slug]) return;
    screenPrefilledRef.current[slug] = true;
    prefillPostInformationFromContext(ctx, {
      setImages: setImagesFromUrls,
      // On the draft, not shell state — composer and preview both read it there.
      setPoll: (poll) => setPostDraft({ poll }),
      // Resolve the space as a tap does: chip, topics, permissions and verdict live in the picker payload.
      setSpace: (slug, topicIds) => {
        void hydratePostDraftSpace(
          (readAppzetActionsFromCatalog('fc-post-information')?.on_tap_space?.args
            ?.data_source as string) ?? 'fc-post-space-picker',
          slug,
          topicIds,
        );
      },
    });
  }, [uiMode, currentScreen]);

  // The strip has no child index, so it signals by event; same function as the poll glyph.
  useEffect(
    () => onPollSheetRequest(() => openPollSheetFromCatalog('fc-post-poll-sheet')),
    [],
  );

  useEffect(
    () => onScheduleSheetRequest(() => openScheduleSheetFromCatalog(SCHEDULE_SHEET_APPZET_SLUG)),
    [],
  );

  // Server first, then the draft, so a refusal doesn't drop a file that still exists.
  useEffect(
    () =>
      onDocumentRequests({
        onRename: (id, title) => {
          const endpoints = docEndpointsRef.current;
          if (!endpoints) return;
          setDocumentBusy(id);
          void (async () => {
            const error = await renameDraftDocument(
              id,
              title,
              endpoints.rename,
              auth ? basicAuthHeader(auth) : '',
            );
            setDocumentBusy('');
            if (error) showMenuError(error);
            else renamePostDraftDocument(id, title);
          })();
        },
        onRemove: (id) => {
          const endpoints = docEndpointsRef.current;
          if (!endpoints) return;
          setDocumentBusy(id);
          void (async () => {
            // FC Pro allows deleting unattached media owned by the user.
            const error = await deleteDraftDocument(
              id,
              endpoints.remove,
              auth ? basicAuthHeader(auth) : '',
            );
            setDocumentBusy('');
            if (error) showMenuError(error);
            else removePostDraftDocument(id);
          })();
        },
      }),
    [auth, showMenuError],
  );

  // The levels card only expands, so reset it on arrival or a second visit can't collapse it.
  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'leaderboard') return;
    resetLeaderboardControls();
  }, [currentScreen?.app_map_screen_slug]);

  // Drop pending debounce timers on screen change so they can't refetch a screen nobody is on.
  useEffect(() => {
    cancelDebouncedSearch();
  }, [currentScreen?.app_map_screen_slug]);

  // Search resets per visit; sort and layout are preferences and survive.
  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'bookmarks') return;
    resetBookmarkControls();
  }, [currentScreen?.app_map_screen_slug]);

  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'all-members') return;
    resetMemberDirectoryControls();
  }, [currentScreen?.app_map_screen_slug]);

  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'courses') return;
    resetCourseListControls();
  }, [currentScreen?.app_map_screen_slug]);

  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'course-students') return;
    resetCourseStudentsControls();
  }, [currentScreen?.app_map_screen_slug]);

  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'moderation') return;
    resetModerationControls();
  }, [currentScreen?.app_map_screen_slug]);

  // Config applied after the reset — the reset is per-visit, the config isn't.
  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'search') return;
    resetSearchControls();
    const props = readAppzetPropsFromCatalog('fc-search-field');
    const min = Number(props.min_query_length);
    const limit = Number(props.recent_limit);
    configureSearchControls({
      min_query_length: Number.isFinite(min) && min >= 0 ? min : undefined,
      recent_limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });
  }, [currentScreen?.app_map_screen_slug]);

  // Seed route.slug when landing directly, or DSs bound to route.slug resolve to undefined.
  useEffect(() => {
    if (!currentScreen) return;
    const slug = currentScreen.app_map_screen_slug;
    if (slug !== 'space-detail' && slug !== 'create-post-page' && slug !== 'edit-post-page') return;
    const existing = (window as unknown as { __appzaRouteParams?: Record<string, unknown> })
      .__appzaRouteParams?.slug;
    if (existing) return;
    // App password, no cookies — the wp-admin cookie carries no REST nonce, so WP would answer as a guest.
    fetch('/wp-json/appza/v1/preview/data?ds=fc-spaces-discover&mode=real', {
      credentials: 'omit',
      headers: auth
        ? { Accept: 'application/json', Authorization: basicAuthHeader(auth) }
        : { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.items ?? [];
        const first = Array.isArray(items) ? items[0] : null;
        const firstSlug = first && typeof first === 'object' ? (first as Record<string, unknown>).slug : null;
        if (typeof firstSlug !== 'string' || firstSlug.length === 0) return;
        setRouteParams({ slug: firstSlug, space_slug: firstSlug });
        setSpaceDetailControls({
          space_slug: firstSlug,
          active_subtab: 'posts',
          topic_slug: '',
        });
        window.dispatchEvent(new Event('appza:refresh-data'));
      })
      .catch(() => {
        /* silent — space-detail will just render without space context */
      });
  }, [currentScreen, auth]);

  const appzetBySlug = useMemo(() => new Map(appzets.map((a) => [a.slug, a])), [appzets]);
  const builder = useLayoutBuilder({
    active: uiMode === 'drag',
    template: catalog?.template?.slug ?? templateSlug,
    screen: currentScreen?.app_map_screen_slug ?? null,
    appzetBySlug,
    onSaved: () => pull(templateSlug, true),
  });
  const chrome = useChromeBuilder({
    active: uiMode === 'drag' && builderTab === 'global',
    template: catalog?.template?.slug ?? templateSlug,
    screen: currentScreen?.app_map_screen_slug ?? null,
    onSaved: () => pull(templateSlug, true),
  });
  const layoutOverlay = useCallback((c: unknown) => chrome.overlay(builder.overlay(c)), [chrome.overlay, builder.overlay]);
  const dndSensors = useSensors(
    // A small travel threshold keeps Add buttons and row clicks working.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const catalogIndex = useMemo(() => (catalog ? indexCatalog(catalog) : null), [catalog]);

  const effectiveCustomizations = useMemo(() => {
    const base = envelope?.customizations;
    if (!livePreview && !livePrimitivePreview && uiMode !== 'app') return layoutOverlay(base);
    const baseRecord =
      base && typeof base === 'object' && !Array.isArray(base)
        ? (base as Record<string, unknown>)
        : {};
    let out: Record<string, unknown> = { ...baseRecord };
    if (livePreview) {
      const scopeRecord =
        out['appzet'] && typeof out['appzet'] === 'object'
          ? { ...(out['appzet'] as Record<string, unknown>) }
          : {};
      const targetRecord =
        scopeRecord[livePreview.slug] && typeof scopeRecord[livePreview.slug] === 'object'
          ? { ...(scopeRecord[livePreview.slug] as Record<string, unknown>) }
          : {};
      targetRecord['default_props_override'] = livePreview.override;
      scopeRecord[livePreview.slug] = targetRecord;
      out = { ...out, appzet: scopeRecord };
    }
    if (livePrimitivePreview) {
      const scopeRecord =
        out['appzet_primitive'] && typeof out['appzet_primitive'] === 'object'
          ? { ...(out['appzet_primitive'] as Record<string, unknown>) }
          : {};
      const key = livePrimitivePreview.compositeKey;
      const targetRecord =
        scopeRecord[key] && typeof scopeRecord[key] === 'object'
          ? { ...(scopeRecord[key] as Record<string, unknown>) }
          : {};
      targetRecord['layout'] = livePrimitivePreview.layout;
      scopeRecord[key] = targetRecord;
      out = { ...out, appzet_primitive: scopeRecord };
    }
    // Runs after field_mappings in PlacementRenderer, so the live clock wins.
    if (uiMode === 'app') {
      const scopeRecord =
        out['appzet'] && typeof out['appzet'] === 'object'
          ? { ...(out['appzet'] as Record<string, unknown>) }
          : {};
      const targetRecord =
        scopeRecord['fc-user-avatar'] && typeof scopeRecord['fc-user-avatar'] === 'object'
          ? { ...(scopeRecord['fc-user-avatar'] as Record<string, unknown>) }
          : {};
      const existingOverride =
        targetRecord['default_props_override'] && typeof targetRecord['default_props_override'] === 'object'
          ? (targetRecord['default_props_override'] as Record<string, unknown>)
          : {};
      targetRecord['default_props_override'] = {
        ...existingOverride,
        now_label: nowLabel,
      };
      scopeRecord['fc-user-avatar'] = targetRecord;
      out = { ...out, appzet: scopeRecord };
    }
    return layoutOverlay(out);
  }, [envelope, livePreview, livePrimitivePreview, uiMode, nowLabel, layoutOverlay]);

  useEffect(() => {
    if (uiMode !== 'drag' || !builder.selectedKey) return;
    const el = document.querySelector(
      `.appza-center .appza-renderer-content [data-appza-placement-key="${CSS.escape(builder.selectedKey)}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [uiMode, builder.selectedKey]);

  const placedSlugs = useMemo(
    () =>
      catalog && currentScreen
        ? screenPlacements(currentScreen, catalog, effectiveCustomizations).map((p) => p.appzet_slug)
        : [],
    [catalog, currentScreen, effectiveCustomizations],
  );

  // Overlays open with a props snapshot, so patch the open modal on edit (keeps modal-local state). Wrapper edits null the AppZet slug, hence the fallback.
  const editedAppzetSlug = selectedAppzetSlug ?? selectedPrimitive?.appzetSlug ?? null;

  useEffect(() => {
    setCustomizationsForActions(effectiveCustomizations);
    if (!editedAppzetSlug) return;
    const props = readAppzetPropsFromCatalog(editedAppzetSlug);
    patchAddMemberModal(editedAppzetSlug, {
      ...addMemberPresentation(props),
      childStyles: childStylesFromCustomizations(
        editedAppzetSlug,
        ADD_MEMBER_CHILD_COUNT,
        effectiveCustomizations,
      ),
    });
    patchInviteUserModal(editedAppzetSlug, {
      ...invitePresentation(props),
      childStyles: childStylesFromCustomizations(
        editedAppzetSlug,
        INVITE_USER_CHILD_COUNT,
        effectiveCustomizations,
      ),
    });
    patchScheduleSheet(editedAppzetSlug, {
      presentation: schedulePresentation(props),
      childStyles: childStylesFromCustomizations(
        editedAppzetSlug,
        SCHEDULE_SHEET_CHILD_COUNT,
        effectiveCustomizations,
      ),
    });
    patchMediaViewer(editedAppzetSlug, {
      presentation: mediaViewerPresentation(props),
      childStyles: childStylesFromCustomizations(
        editedAppzetSlug,
        MEDIA_VIEWER_CHILD_COUNT,
        effectiveCustomizations,
      ),
    });
  }, [effectiveCustomizations, editedAppzetSlug]);

  const openImagePicker = useCallback((target: {
    endpoint: string;
    method: string;
    accept?: string;
    onStart?: () => void;
    sink?: (urls: string[]) => void;
    onFail?: () => void;
  }) => {
    console.log('[appza/picker.image] openImagePicker called', {
      hasInputRef: !!fileInputRef.current,
      endpoint: target.endpoint,
    });
    if (!fileInputRef.current) {
      console.warn('[appza/picker.image] fileInputRef is null — input not mounted?');
      return;
    }
    uploadEndpointRef.current = target;
    // Shared picker: `accept` is set per open.
    fileInputRef.current.accept = target.accept ?? 'image/*';
    fileInputRef.current.click();
  }, []);
  const openDocumentPicker = useCallback(
    (t: { upload: string; rename: string; remove: string; accept: string }) => {
      // onChange fires after this returns, so everything it needs must be readable synchronously.
      docEndpointsRef.current = { upload: t.upload, rename: t.rename, remove: t.remove };
      if (docInputRef.current) docInputRef.current.accept = t.accept;
      docInputRef.current?.click();
    },
    [],
  );
  const openAudioPicker = useCallback((endpoint: string) => {
    audioUploadEndpointRef.current = endpoint;
    audioInputRef.current?.click();
  }, []);
  const clearPendingImages = useCallback(() => setPostDraft({ images: [] }), []);
  const clearPendingVideo = useCallback(() => setPendingVideo(null), []);
  const openDeleteConfirm = useCallback((next: PendingDelete) => {
    setPendingDelete(next);
  }, []);
  const openCommentPanel = useCallback((next: CommentPanelState) => {
    setCommentPanel(next);
  }, []);

  const attachVideo = useCallback(
    async (url: string, target: { endpoint: string; method: string }) => {
      if (!auth) {
        setAuthMessage('Please sign in to attach a video.');
        return;
      }
      oembedEndpointRef.current = target;
      setVideoLoading(true);
      if (!target || !target.endpoint) {
        setAuthMessage(
          'Video attach is missing its endpoint — set picker.video args.endpoint in the catalog.',
        );
        setVideoLoading(false);
        return;
      }
      try {
        const res = await fetch(target.endpoint, {
          method: target.method,
          credentials: 'omit',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: basicAuthHeader(auth),
          },
          body: JSON.stringify({ url }),
        });
        const json = await res.json().catch(() => null);
        console.log('[appza/oembed]', { status: res.status, json });
        if (!res.ok) {
          setAuthMessage(`Video lookup failed (HTTP ${res.status})`);
          return;
        }
        // Failure is either a non-200 wrapper or null items on a 200.
        const wrapper = (json && typeof json === 'object') ? (json as Record<string, unknown>) : null;
        const inner = wrapper && wrapper.response && typeof wrapper.response === 'object'
          ? (wrapper.response as Record<string, unknown>)
          : null;
        const items = wrapper && wrapper.items && typeof wrapper.items === 'object'
          ? (wrapper.items as Record<string, unknown>)
          : null;
        if (inner && inner.status && inner.status !== 200) {
          setAuthMessage(
            typeof inner.message === 'string' ? inner.message : 'No preview available for this URL',
          );
          return;
        }
        if (!items) {
          setAuthMessage('No preview available for this URL');
          return;
        }
        setPendingVideo({
          url,
          title: typeof items.title === 'string' ? items.title : undefined,
          image: typeof items.image === 'string' ? items.image : undefined,
          provider: typeof items.provider === 'string' ? items.provider : undefined,
        });
      } catch (err) {
        setAuthMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setVideoLoading(false);
      }
    },
    [auth],
  );
  // Signed-out writes go to the login screen; keep identical to the mobile shell's requireAuthOrLogin.
  const requireAuthOrLogin = useCallback((): boolean => {
    if (auth) return true;
    const login = catalog?.template_screens?.find(
      (s) => s.app_map_screen_slug === 'login-page',
    );
    if (!login) {
      setAuthMessage('Please sign in to do that.');
      return false;
    }
    if (selectedScreenId != null && selectedScreenId !== login.id) {
      setScreenStack((prev) => [...prev, selectedScreenId]);
    }
    setSelectedScreenId(login.id);
    return false;
  }, [auth, catalog, selectedScreenId]);

  const dispatchAction = useCallback<ActionDispatch>(
    (inv: ActionInvocation) => {
      handleAppModeAction(inv, {
        requireAuthOrLogin,
        catalog: catalog ?? null,
        currentScreenId: selectedScreenId,
        setSelectedScreenId,
        setScreenStack,
        auth,
        setAuth,
        onLoginError: (m) => setAuthMessage(m),
        onLoginSuccess: () => setAuthMessage(null),
        onMenuInfo: showMenuInfo,
        onMenuError: showMenuError,
        openImagePicker,
        openAudioPicker,
        openDocumentPicker,
        pendingImages,
        clearPendingImages,
        attachVideo,
        pendingVideo,
        clearPendingVideo,
        openDeleteConfirm,
        reactedSet: reactedRef.current,
        openCommentPanel,
        screenContextRef,
        screenPrefilledRef,
      });
    },
    [
      catalog, selectedScreenId, auth, setAuth, uiMode,
      openImagePicker, openAudioPicker, openDocumentPicker, pendingImages, clearPendingImages,
      attachVideo, pendingVideo, clearPendingVideo,
      openDeleteConfirm, openCommentPanel,
    ],
  );

  const refreshSim = useCallback(async () => {
    if (simRefreshing) return;
    setSimRefreshing(true);
    try {
      await pull(templateSlug);
      triggerFeedRefresh();
    } finally {
      setSimRefreshing(false);
    }
  }, [simRefreshing, templateSlug]);

  const navigateSimTo = useCallback(
    (targetId: number) => {
      setSimMenuOpen(false);
      if (targetId === selectedScreenId) return;
      if (selectedScreenId != null) {
        setScreenStack((prev) => [...prev, selectedScreenId]);
      }
      setSelectedScreenId(targetId);
    },
    [selectedScreenId],
  );

  const logoutFromSimMenu = useCallback(() => {
    setSimMenuOpen(false);
    setAuth(null);
    const login = catalog?.template_screens?.find(
      (s) => s.app_map_screen_slug === 'login-page',
    );
    if (login) {
      setScreenStack(() => []);
      setSelectedScreenId(login.id);
    }
  }, [catalog, setAuth]);

  // children[0] of the app bar is the leading slot; wire it to the Pages drawer.
  useEffect(() => {
    if (uiMode !== 'app') return;
    const outer = document.querySelector('.appza-device-viewport');
    if (!outer) return;
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('ion-header, ion-toolbar')) return;
      const wrapper = target.closest(
        '[data-appza-primitive-path="children[0]"]',
      ) as HTMLElement | null;
      if (!wrapper) return;
      // A leading slot with its own action wins.
      if (wrapper.getAttribute('data-appza-inline-click') === 'true') return;
      const slug = wrapper.getAttribute('data-appza-appzet-slug') ?? '';
      if (!/appbar|header|topbar/i.test(slug)) return;
      e.preventDefault();
      e.stopPropagation();
      setSimMenuOpen(true);
    };
    outer.addEventListener('click', onClick, true);
    return () => outer.removeEventListener('click', onClick, true);
  }, [uiMode, currentScreen]);

  useEffect(() => {
    if (uiMode !== 'app') return;
    const outer = document.querySelector('.appza-device-viewport') as HTMLElement | null;
    if (!outer) return;

    let startY: number | null = null;
    let dy = 0;
    let armed = false;
    let scrollEl: HTMLElement | null = null;

    const findScroll = async (): Promise<HTMLElement | null> => {
      const ic = outer.querySelector('ion-content') as unknown as {
        getScrollElement?: () => Promise<HTMLElement>;
      } | null;
      if (ic && typeof ic.getScrollElement === 'function') {
        try {
          return await ic.getScrollElement();
        } catch {
          return null;
        }
      }
      return null;
    };

    const onDown = async (e: PointerEvent) => {
      if (simMenuOpen || simRefreshing) return;
      if (!scrollEl) scrollEl = await findScroll();
      if (!scrollEl || scrollEl.scrollTop > 2) {
        armed = false;
        return;
      }
      armed = true;
      startY = e.clientY;
      dy = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!armed || startY == null) return;
      dy = e.clientY - startY;
      setSimPullDistance(dy > 0 ? Math.min(dy * 0.6, 90) : 0);
    };
    const onUp = async () => {
      if (!armed) return;
      armed = false;
      const finalDist = Math.min(dy * 0.6, 90);
      setSimPullDistance(0);
      startY = null;
      dy = 0;
      if (finalDist > 55) {
        setSimRefreshing(true);
        try {
          await refreshSim();
        } finally {
          setSimRefreshing(false);
        }
      }
    };

    outer.addEventListener('pointerdown', onDown, { passive: true });
    outer.addEventListener('pointermove', onMove, { passive: true });
    outer.addEventListener('pointerup', onUp, { passive: true });
    outer.addEventListener('pointercancel', onUp, { passive: true });
    return () => {
      outer.removeEventListener('pointerdown', onDown);
      outer.removeEventListener('pointermove', onMove);
      outer.removeEventListener('pointerup', onUp);
      outer.removeEventListener('pointercancel', onUp);
      scrollEl = null;
    };
  }, [uiMode, refreshSim, simMenuOpen, simRefreshing, selectedScreenId]);

  // Capped before uploading: extras would be orphaned FluentPlayer media rows no endpoint removes.
  const uploadAudios = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const endpoint = audioUploadEndpointRef.current;
      if (!endpoint) return;
      const max = getFcRuntimeSettings().composer.fluent_player.max_audios_per_post;
      const room = max > 0 ? Math.max(0, max - getPostDraft().audios.length) : files.length;
      const picked = Array.from(files);
      const list = picked.slice(0, room);
      if (picked.length > list.length) {
        setAuthMessage(
          `Only ${max} audio file${max === 1 ? '' : 's'} can go on a post — ${picked.length - list.length} not added.`,
        );
      }
      if (list.length === 0) return;
      setUploadingCount((c) => c + list.length);
      const results = await Promise.all(
        list.map(async (file) => {
          try {
            const video = await uploadDraftVideo(file, endpoint, auth ? basicAuthHeader(auth) : '', 'audio');
            if (!video || !video.media_id || !video.media_url) {
              setAuthMessage(`Could not upload ${file.name}.`);
              return null;
            }
            return { media_id: video.media_id, url: video.media_url, title: file.name };
          } finally {
            setUploadingCount((c) => c - 1);
          }
        }),
      );
      const clean = results.filter((a): a is { media_id: string; url: string; title: string } => !!a);
      if (clean.length > 0) addPostDraftAudios(clean, max);
    },
    [auth],
  );

  // Sequential so a failure can be attributed to a file; FC applies no cap to document_ids.
  const uploadDocuments = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const endpoints = docEndpointsRef.current;
      if (!endpoints) return;
      const spaceSlug = getPostDraft().space_slug;
      if (!spaceSlug) {
        showMenuError('Choose a space before attaching a file.');
        return;
      }
      const list = Array.from(files);
      setUploadingCount((c) => c + list.length);
      const header = auth ? basicAuthHeader(auth) : '';
      const accepted = [];
      for (const file of list) {
        const { doc, error } = await uploadDraftDocument(file, spaceSlug, endpoints.upload, header);
        setUploadingCount((c) => Math.max(0, c - 1));
        if (doc) accepted.push(doc);
        else if (error) showMenuError(error);
      }
      if (accepted.length > 0) addPostDraftDocuments(accepted);
    },
    [auth, showMenuError],
  );

  const uploadImages = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!auth) {
        setAuthMessage('Please sign in to attach images.');
        return;
      }
      const target = uploadEndpointRef.current;
      if (!target) {
        setAuthMessage(
          'Image attach is missing its endpoint — set picker.image args.endpoint in the catalog.',
        );
        return;
      }
      // Cap before uploading — extra uploads become orphaned Media rows with no delete endpoint. A sink (profile picture) isn't on the draft, so no cap.
      const max = target.sink ? 0 : getFcRuntimeSettings().composer.max_media_per_post;
      const room = max > 0 ? Math.max(0, max - getPostDraft().images.length) : files.length;
      const picked = Array.from(files);
      const list = picked.slice(0, room);
      if (picked.length > list.length) {
        const refused = picked.length - list.length;
        setAuthMessage(
          `Only ${max} image${max === 1 ? '' : 's'} can go on a post — ${refused} not added.`,
        );
      }
      if (list.length === 0) return;
      setUploadingCount((c) => c + list.length);
      const uploads = list.map(async (file) => {
        try {
          const form = new FormData();
          form.append('file', file);
          const res = await fetch(target.endpoint, {
            method: target.method,
            credentials: 'omit',
            headers: {
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
              // No Content-Type: the browser sets the multipart boundary.
            },
            body: form,
          });
          const json = await res.json().catch(() => null);
          console.log('[appza/upload]', {
            file: file.name,
            status: res.status,
            json,
          });
          if (!res.ok) {
            const msg = (json && typeof (json as Record<string, unknown>).message === 'string')
              ? ((json as Record<string, unknown>).message as string)
              : `Upload failed (HTTP ${res.status})`;
            setAuthMessage(msg);
            return null;
          }
          const url =
            (json && typeof json === 'object' && 'items' in json &&
              json.items && typeof json.items === 'object' &&
              typeof (json.items as Record<string, unknown>).url === 'string')
              ? ((json.items as Record<string, string>).url)
              : null;
          if (!url) {
            setAuthMessage('Upload succeeded but no URL returned.');
            return null;
          }
          return url;
        } catch (err) {
          setAuthMessage(err instanceof Error ? err.message : String(err));
          return null;
        } finally {
          setUploadingCount((c) => c - 1);
        }
      });
      const urls = (await Promise.all(uploads)).filter((u): u is string => !!u);
      if (target.sink) {
        if (urls.length > 0) target.sink(urls);
        else target.onFail?.();
        return;
      }
      // Re-cap against the current draft: two picks can be in flight.
      if (urls.length > 0) addPostDraftImages(urls.map((url) => ({ url })), max);
    },
    [auth],
  );

  // Same state slice the mobile shell writes, so `state.viewer.*` gates agree.
  useEffect(() => {
    startHeadlineCounter();
  }, []);

  useEffect(() => {
    setViewer({
      is_logged_in: !!auth,
      user_id: auth && typeof auth.user_id === 'number' ? auth.user_id : null,
    });
  }, [auth]);

  // Force login in App mode unless the site allows guest browsing (settings are applied with the envelope, before this runs).
  useEffect(() => {
    if (uiMode !== 'app') return;
    if (!catalog) return;
    if (auth) return;
    if (canBrowseAsGuest()) return;
    const login = catalog.template_screens?.find(
      (s) => s.app_map_screen_slug === 'login-page',
    );
    if (login && login.id !== selectedScreenId) {
      setScreenStack([]);
      setSelectedScreenId(login.id);
    }
  }, [uiMode, catalog, auth, selectedScreenId]);

  const bottomPanel = useMemo(() => {
    if (!bottomTab || !envelope) return null;
    if (bottomTab === 'settings') {
      return renderSettings(envelope);
    }
    if (bottomTab === 'themes') {
      return renderThemes(catalog?.template?.tokens, currentScreen?.screen_tokens);
    }
    const customizationsEndpoint = window.appzaCoreConfig?.endpoints?.customizations;
    const nonce = window.appzaCoreConfig?.restNonce;
    if (!customizationsEndpoint || !nonce) {
      return (
        <p className="appza-bottom-panel-title">
          Overrides UI requires the WP-admin host. Open this page inside /wp-admin/.
        </p>
      );
    }
    return (
      <OverridesPanel
        listEndpoint={customizationsEndpoint}
        mutateEndpoint={customizationsEndpoint}
        restNonce={nonce}
        onChanged={() => pull(templateSlug)}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomTab, envelope, catalog, currentScreen, templateSlug]);

  // Mounted in both modes (Edit-mode taps dispatch real actions too); inside the viewport they pin to the phone and are selectable.
  const sharedOverlays = (
    <>
      <ViewModePopover />
      <OptionsSheet />
      <PostSpaceSheet />
      <VideoSheet />
      <PollSheet />
      <PostOptionsPopover />
      <MemberOptionsSheet />
      <MemberRoleSheet />
      <MemberRemoveConfirm />
      <CourseAddStudentSheet />
      <ReportSheet />
      <AddMemberModal />
      <InviteUserModal />
      <ScheduleSheet />
      <MediaViewer />
      <ChatMembersSheet />
      <FollowSheet />
      <NewMessageModal />
      <ChatUserCard />
      <LeaderboardPointsSheet />
      <PollVotersSheet />
      <ModerationReviewSheet />
    </>
  );

  return (
    <div className="appza-shell">
      <TopBar
        screens={screens}
        appMap={catalog?.app_map ?? null}
        selectedScreenId={selectedScreenId}
        onSelectScreen={setSelectedScreenId}
        templateSlug={templateSlug}
        onTemplateSlugChange={(slug) => {
          setTemplateSlug(slug);
          pull(slug);
        }}
        templateOptions={templateOptions}
        templatesLoading={templatesLoading}
        onReload={() => pull(templateSlug)}
        onSync={() => syncFromCore(templateSlug)}
        onRefreshData={() => {
          window.dispatchEvent(new Event('appza:refresh-data'));
        }}
        loading={state.kind === 'loading'}
        syncing={syncing}
        syncMessage={syncMessage}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        onBuildApp={() => setBuildAppOpen(true)}
        uiMode={uiMode}
        dirtyCount={builder.dirtyCount + chrome.dirtyCount}
        saving={builder.saving || chrome.saving}
        onSaveLayout={() => void builder.save().then(chrome.save)}
        onDiscardLayout={() => {
          builder.discard();
          chrome.discard();
        }}
        onUiModeChange={(m) => {
          setUiMode(m);
          if (m === 'drag') {
            setSelectedAppzetSlug(null);
            setSelectedPrimitive(null);
            setLivePreview(null);
            setLivePrimitivePreview(null);
            setScreenStack([]);
          } else if (m === 'app') {
            setSelectedAppzetSlug(null);
            setSelectedPrimitive(null);
            setLivePreview(null);
            setLivePrimitivePreview(null);
          } else {
            setScreenStack([]);
          }
        }}
      />

      {state.kind === 'error' && <div className="appza-status">{state.message}</div>}

      {uiMode === 'app' && authMessage && (
        <div
          className="appza-status"
          role="alert"
          style={{ background: '#fee2e2', color: '#991b1b' }}
        >
          {authMessage}
          <button
            type="button"
            onClick={clearAuthMessage}
            style={{
              marginLeft: 8,
              background: 'transparent',
              border: 'none',
              color: '#991b1b',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {uiMode === 'app' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            void uploadImages(files);
            // Reset so selecting the same file again re-fires onChange.
            e.target.value = '';
          }}
        />
      )}

      {/* Own input: a shared one would race over swapping `accept`. */}
      {uiMode === 'app' && (
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            void uploadAudios(files);
            e.target.value = '';
          }}
        />
      )}

      {uiMode === 'app' && (
        <input
          ref={docInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            void uploadDocuments(files);
            e.target.value = '';
          }}
        />
      )}

      {uiMode === 'app' && auth && (pendingVideo || videoLoading) && (
        <div
          className="appza-pending-video"
          role="region"
          aria-label="Attached video"
          style={{
            position: 'fixed',
            bottom: 180,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            background: '#fff',
            padding: 8,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 30,
            maxWidth: 320,
          }}
        >
          {videoLoading ? (
            <span style={{ fontSize: 12, color: '#6b7280' }}>⏳ Fetching video preview…</span>
          ) : pendingVideo ? (
            <>
              <div
                style={{
                  position: 'relative',
                  width: 72,
                  height: 48,
                  flex: '0 0 72px',
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: '#000',
                }}
              >
                {pendingVideo.image && (
                  <img
                    src={pendingVideo.image}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                    fontSize: 20,
                  }}
                >
                  ▶
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                <div
                  style={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={pendingVideo.title || pendingVideo.url}
                >
                  {pendingVideo.title || pendingVideo.url}
                </div>
                {pendingVideo.provider && (
                  <div style={{ color: '#6b7280', textTransform: 'capitalize' }}>
                    {pendingVideo.provider}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPendingVideo(null)}
                aria-label="Remove video"
                style={{
                  border: 'none',
                  background: '#f3f4f6',
                  padding: '4px 8px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                ×
              </button>
            </>
          ) : null}
        </div>
      )}

      {uiMode === 'app' && auth && uploadingCount > 0 && (
        <div
          className="appza-pending-images"
          role="region"
          aria-label="Attaching images"
          style={{
            position: 'fixed',
            bottom: 110,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            background: '#fff',
            padding: 8,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 30,
            maxWidth: 320,
            overflowX: 'auto',
          }}
        >
          {uploadingCount > 0 && (
            <div
              style={{
                width: 56,
                height: 56,
                flex: '0 0 56px',
                borderRadius: 6,
                background: '#f3f4f6',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                color: '#6b7280',
              }}
            >
              ⏳ {uploadingCount}
            </div>
          )}
        </div>
      )}

      {uiMode === 'app' && auth && (
        <div
          className="appza-auth-status-in-app"
          role="status"
          style={{
            // Bottom right, beside the Apps pill: a top position lands on the top bar's buttons.
            position: 'fixed',
            bottom: 18,
            right: 104,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            background: 'rgba(17, 24, 39, 0.92)',
            color: '#f9fafb',
            padding: '4px 10px 4px 4px',
            borderRadius: 999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 30,
            fontSize: 12,
          }}
        >
          {auth.avatar ? (
            <img
              src={auth.avatar}
              alt=""
              width={22}
              height={22}
              style={{ borderRadius: '50%', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#4b5563',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 600,
              }}
            >
              {(auth.display_name || auth.username).charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ fontWeight: 500 }}>{auth.display_name || auth.username}</span>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Log out?')) {
                dispatchAction({ action_slug: 'auth.logout' });
              }
            }}
            title="Log out"
            aria-label="Log out"
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#f9fafb',
              padding: '3px 8px',
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: 11,
              marginLeft: 4,
            }}
          >
            ⎋ Logout
          </button>
        </div>
      )}

      <DndContext
        sensors={dndSensors}
        // The sidebar may scroll itself; the device scrolls through Ionic (useLayoutBuilder), the page never.
        autoScroll={{ canScroll: (el) => !!el.closest('.appza-sidebar') }}
        {...builder.dnd}
      >
      <div className="appza-body">
        <Sidebar
          builderTab={builderTab}
          onSelectBuilderTab={setBuilderTab}
          builderPanel={
            uiMode === 'drag' && catalog && catalogIndex ? (
              builderTab === 'global' ? (
              <GlobalPanel
                chrome={chrome}
                catalog={catalog}
                catalogIndex={catalogIndex}
                customizations={effectiveCustomizations}
                screen={currentScreen?.app_map_screen_slug ?? null}
                screenName={currentScreen?.app_map_screen_slug ?? null}
              />
              ) : (
              <BuilderPanel
                draft={builder.draft}
                loading={builder.loading}
                loadError={builder.loadError}
                saveError={builder.saveError}
                catalog={catalog}
                catalogIndex={catalogIndex}
                customizations={effectiveCustomizations}
                selectedKey={builder.selectedKey}
                onSelectKey={builder.setSelectedKey}
                presentKeys={builder.presentKeys}
                onChangeItems={builder.setItems}
                onAdd={(slug, layout) => builder.add(slug, undefined, layout)}
                onKeepMine={() => void builder.keepMine()}
                onAddNew={builder.addNew}
                onReset={() => void builder.reset()}
              />
              )
            ) : undefined
          }
          mode={uiMode}
          catalogIndex={catalogIndex}
          customizations={effectiveCustomizations}
          appzets={appzets}
          superstructures={superstructures}
          currentScreen={currentScreen}
          placedSlugs={placedSlugs}
          bottomTab={bottomTab}
          onSelectBottomTab={setBottomTab}
          bottomPanel={bottomPanel}
          selectedAppzetSlug={selectedAppzetSlug}
          onSelectAppzet={(slug) => {
            setSelectedAppzetSlug(slug);
            setSelectedPrimitive(null);
            // Close any open modal first so the builder isn't editing one while looking at another.
            const opener = findOpenerAction(slug);
            if (!opener) return;
            closeAddMemberModal();
            closeInviteUserModal();
            dispatchAction({ action_slug: opener.action_slug, args: opener.args });
          }}
        />

        <main
          className={`appza-center${uiMode === 'app' ? ' appza-center-app-mode' : ''}`}
          onClick={
            uiMode === 'edit'
              ? (e) => {
                  // Overlays exempt: a click inside one selects and passes through, and would otherwise undo that selection here.
                  if ((e.target as HTMLElement | null)?.closest('[data-appza-overlay]')) {
                    return;
                  }
                  setSelectedAppzetSlug(null);
                  setSelectedPrimitive(null);
                }
              : undefined
          }
        >
          {state.kind === 'loading' ? (
            <div className="appza-loading">Loading…</div>
          ) : (
            // Wraps both modes: Edit mode still needs state-only actions (tabs, sort, search).
            <ActionProvider dispatch={dispatchAction}>
              {uiMode === 'app' ? (
              <>
              <DeviceFrame
                key={`preview-${previewMode}-app`}
                navDepth={screenStack.length}
                screen={currentScreen}
                catalog={catalog ?? null}
                customizations={effectiveCustomizations}
                templateName={catalog?.template?.name}
                overlaySlot={
                  <>
                    {(simPullDistance > 0 || simRefreshing) && (
                      <div
                        className="appza-sim-pull-indicator"
                        style={{
                          transform: `translateY(${
                            (simRefreshing ? 60 : simPullDistance) - 40
                          }px)`,
                        }}
                        aria-hidden="true"
                      >
                        <span
                          className={
                            simRefreshing || simPullDistance > 55
                              ? 'appza-sim-pull-icon is-spinning'
                              : 'appza-sim-pull-icon'
                          }
                        >
                          ↻
                        </span>
                      </div>
                    )}

                    {simMenuOpen && (
                      <>
                        <div
                          className="appza-sim-menu-backdrop"
                          onClick={() => setSimMenuOpen(false)}
                          aria-hidden="true"
                        />
                        <div
                          className="appza-sim-menu-drawer"
                          role="dialog"
                          aria-label="Pages"
                        >
                          <div className="appza-sim-menu-header">
                            <span>Pages</span>
                            <button
                              type="button"
                              onClick={() => setSimMenuOpen(false)}
                              className="appza-sim-menu-close"
                              aria-label="Close menu"
                            >
                              ×
                            </button>
                          </div>
                          {auth && (
                            <div className="appza-sim-menu-user">
                              Signed in as{' '}
                              <strong>{auth.display_name || auth.username}</strong>
                            </div>
                          )}
                          <ul className="appza-sim-menu-list">
                            {buildDrawerMenu(
                              catalog?.template_screens ?? [],
                              catalog?.app_map,
                              catalog ? drawerMenuItems(catalog, effectiveCustomizations) : undefined,
                            ).map((row) => (
                              <li key={row.id}>
                                <button
                                  type="button"
                                  onClick={() => navigateSimTo(row.id)}
                                  className={
                                    row.id === selectedScreenId
                                      ? 'appza-sim-menu-item is-current'
                                      : 'appza-sim-menu-item'
                                  }
                                >
                                  {row.icon && (
                                    <IonIcon icon={row.icon} className="appza-sim-menu-icon" />
                                  )}
                                  {row.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                          {auth && (
                            <button
                              type="button"
                              onClick={logoutFromSimMenu}
                              className="appza-sim-menu-logout"
                            >
                              Log out
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {pendingDelete ? (
                    <ConfirmDeleteModal
                      title={pendingDelete.title}
                      message={pendingDelete.message}
                      cta={pendingDelete.cta}
                      inFlight={deleteInFlight}
                      onCancel={() => {
                        if (deleteInFlight) return;
                        setPendingDelete(null);
                      }}
                      onConfirm={async () => {
                        if (!auth || !pendingDelete) return;
                        setDeleteInFlight(true);
                        try {
                          const res = await fetch(pendingDelete.endpoint, {
                            method: pendingDelete.method,
                            credentials: 'omit',
                            headers: {
                              'Content-Type': 'application/json',
                              Accept: 'application/json',
                              Authorization: basicAuthHeader(auth),
                            },
                            body: JSON.stringify({
                  [pendingDelete.bodyKey]: pendingDelete.feedId,
                  ...(pendingDelete.extraBody ?? {}),
                }),
                          });
                          const json = await res.json().catch(() => null);
                          const status = (json && typeof json === 'object' && 'response' in json)
                            ? ((json as Record<string, unknown>).response as Record<string, unknown> | undefined)
                            : undefined;
                          const httpOk = res.ok;
                          const bodyOk = !status || status.status === 200;
                          if (!httpOk || !bodyOk) {
                            const msg =
                              (status && typeof status.message === 'string' && status.message) ||
                              (json && typeof (json as Record<string, unknown>).message === 'string'
                                ? (json as Record<string, string>).message
                                : null) ||
                              `${pendingDelete.failLabel ?? 'Delete'} failed (HTTP ${res.status})`;
                            setAuthMessage(msg);
                            return;
                          }
                          setPendingDelete(null);
                          // Closes on the write landing, not the CTA tap — the confirm can be cancelled.
                          announceModerationDone();
                          const g = window as unknown as { __appzaForceRefreshUntil?: number };
                          g.__appzaForceRefreshUntil = Date.now() + 3000;
                          setTimeout(() => {
                            window.dispatchEvent(new Event('appza:refresh-data'));
                          }, 150);
                          setTimeout(() => {
                            window.dispatchEvent(new Event('appza:refresh-data'));
                          }, 600);
                        } catch (err) {
                          setAuthMessage(err instanceof Error ? err.message : String(err));
                        } finally {
                          setDeleteInFlight(false);
                        }
                      }}
                    />
                  ) : commentPanel && auth ? (
                    <CommentPanel
                      feedId={commentPanel.feedId}
                      endpoint={commentPanel.endpoint}
                      method={commentPanel.method}
                      listEndpoint={commentPanel.listEndpoint}
                      bodyKey={commentPanel.bodyKey}
                      messageKey={commentPanel.messageKey}
                      panelTitle={commentPanel.panelTitle}
                      placeholder={commentPanel.placeholder}
                      sendLabel={commentPanel.sendLabel}
                      initialReplyTo={commentPanel.replyTo}
                      edit={commentPanel.edit}
                      auth={auth}
                      onClose={() => setCommentPanel(null)}
                      onError={(m) => setAuthMessage(m)}
                    />
                  ) : null}

                  {menuToast && (
                    <div
                      className="appza-menu-toast"
                      role="status"
                      onClick={() => setMenuToast(null)}
                      style={{
                        position: 'absolute',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: menuToast.kind === 'error' ? '#dc2626' : '#111827',
                        color: '#fff',
                        padding: '8px 14px',
                        borderRadius: 999,
                        fontSize: 12,
                        maxWidth: '90%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                        zIndex: 60,
                        cursor: 'pointer',
                      }}
                    >
                      {menuToast.message}
                    </div>
                  )}

                  {sharedOverlays}
                  </>
                }
              />
              </>
              ) : uiMode === 'drag' ? (
                <DeviceFrame
                  key={`preview-${previewMode}-drag`}
                  navDepth={screenStack.length}
                  screen={currentScreen}
                  catalog={catalog ?? null}
                  customizations={effectiveCustomizations}
                  templateName={catalog?.template?.name}
                  onSelectPlacement={builder.setSelectedKey}
                  overlaySlot={
                    builder.draft ? (
                      <DragCanvas
                        keys={rowsOf(builder.draft).map((r) => r.key)}
                        mainKeys={mainKeys(builder.draft)}
                        names={Object.fromEntries(
                          rowsOf(builder.draft).map((r) => [r.key, appzetBySlug.get(r.appzet_slug)?.name ?? r.appzet_slug]),
                        )}
                        selectedKey={builder.selectedKey}
                        dropIndex={builder.dropIndex}
                        onRemove={builder.remove}
                        onPresentKeys={builder.setPresentKeys}
                      />
                    ) : null
                  }
                />
              ) : (
                <DeviceFrame
                  key={`preview-${previewMode}-edit`}
                  navDepth={screenStack.length}
                  screen={currentScreen}
                  catalog={catalog ?? null}
                  customizations={effectiveCustomizations}
                  templateName={catalog?.template?.name}
                  selectedAppzetSlug={selectedAppzetSlug}
                  onSelectAppzet={(slug) => {
                    setSelectedAppzetSlug(slug);
                    if (slug) setSelectedPrimitive(null);
                  }}
                  selectedPrimitive={selectedPrimitive}
                  onSelectPrimitive={(sel) => {
                    setSelectedPrimitive(sel);
                    if (sel) setSelectedAppzetSlug(null);
                  }}
                  overlaySlot={sharedOverlays}
                />
              )}
            </ActionProvider>
          )}
        </main>

        {uiMode === 'drag' &&
          builder.draft &&
          builder.selectedKey &&
          (() => {
            const draft = builder.draft;
            const row = rowsOf(draft).find((r) => r.key === builder.selectedKey);
            const selected = row ? appzetBySlug.get(row.appzet_slug) : undefined;
            const customizationsEndpoint = window.appzaCoreConfig?.endpoints?.customizations;
            const nonce = window.appzaCoreConfig?.restNonce;
            if (!row || !selected || !customizationsEndpoint || !nonce) return null;
            const item = draft.items.find((i) => i.key === row.key);
            const core = draft.core.find((c) => c.key === row.key);
            // The layout's Superstructure decides which props exist.
            const superstructure =
              (row.layout ? superstructures.find((s) => s.slug === row.layout) : undefined) ??
              superstructures.find((s) => s.id === selected.superstructure_id) ??
              null;
            const ds = catalog?.data_sources?.find((d) => d.id === selected.default_data_source_id);
            return (
              <PropertiesPanel
                key={`${row.key}:${propsScope}:${row.layout ?? ''}`}
                appzet={selected}
                superstructure={superstructure}
                dataSourceSlug={ds && typeof ds.slug === 'string' ? ds.slug : null}
                customizations={envelope?.customizations}
                customizationsEndpoint={customizationsEndpoint}
                restNonce={nonce}
                scope={{ value: propsScope, onChange: setPropsScope }}
                placement={
                  propsScope === 'placement'
                    ? {
                        value: item?.props_override ?? {},
                        coreProps: core?.props_override ?? null,
                        onChange: (value) => builder.setItems(patchItem(draft, row.key, { props_override: value })),
                      }
                    : undefined
                }
                onClose={() => {
                  setLivePreview(null);
                  builder.setSelectedKey(null);
                }}
                onChanged={() => {
                  setLivePreview(null);
                  pull(templateSlug, true);
                }}
                onLivePreview={(override) => {
                  setLivePreview(override ? { slug: selected.slug, override } : null);
                }}
              />
            );
          })()}

        {uiMode !== 'drag' && selectedPrimitive && (() => {
          const compositeKey = `${selectedPrimitive.appzetSlug}#${selectedPrimitive.primitivePath}`;
          const initialLayout = readInitialLayout(envelope?.customizations, compositeKey);
          const customizationsEndpoint = window.appzaCoreConfig?.endpoints?.customizations;
          const nonce = window.appzaCoreConfig?.restNonce;
          if (!customizationsEndpoint || !nonce) return null;
          return (
            <PrimitivePanel
              selection={selectedPrimitive}
              initialLayout={initialLayout}
              customizationsEndpoint={customizationsEndpoint}
              restNonce={nonce}
              onClose={() => {
                setLivePrimitivePreview(null);
                setSelectedPrimitive(null);
              }}
              onLivePreview={(layout) => {
                setLivePrimitivePreview(
                  layout ? { compositeKey, layout } : null,
                );
              }}
              onChanged={() => {
                setLivePrimitivePreview(null);
                pull(templateSlug);
              }}
            />
          );
        })()}

        {uiMode !== 'drag' &&
          !selectedPrimitive &&
          selectedAppzetSlug &&
          (() => {
            const selected = appzets.find((a) => a.slug === selectedAppzetSlug);
            const customizationsEndpoint = window.appzaCoreConfig?.endpoints?.customizations;
            const nonce = window.appzaCoreConfig?.restNonce;
            if (!selected || !customizationsEndpoint || !nonce) return null;
            const superstructure =
              selected.superstructure_id != null
                ? superstructures.find((s) => s.id === selected.superstructure_id) ?? null
                : null;
            const dataSourceSlug: string | null = (() => {
              const dsId = selected.default_data_source_id;
              if (dsId == null) return null;
              const ds = catalog?.data_sources?.find((d) => d.id === dsId);
              const slug = ds && typeof ds.slug === 'string' ? ds.slug : null;
              return slug;
            })();
            return (
              <PropertiesPanel
                appzet={selected}
                superstructure={superstructure}
                dataSourceSlug={dataSourceSlug}
                customizations={envelope?.customizations}
                customizationsEndpoint={customizationsEndpoint}
                restNonce={nonce}
                onClose={() => {
                  setLivePreview(null);
                  setSelectedAppzetSlug(null);
                }}
                onChanged={() => {
                  setLivePreview(null);
                  pull(templateSlug);
                }}
                onLivePreview={(override) => {
                  setLivePreview(override ? { slug: selected.slug, override } : null);
                }}
              />
            );
          })()}
      </div>
      <DragOverlay dropAnimation={null}>
        {builder.dragLabel ? <div className="appza-drag-ghost">{builder.dragLabel}</div> : null}
      </DragOverlay>
      </DndContext>

      {/* Hidden until the first-mount check so it doesn't flash. */}
      {onboardingChecked && (
        <button
          type="button"
          className="appza-onboard-reopen"
          onClick={() => setOnboardingOpen(true)}
          title="Select App"
        >
          Apps
        </button>
      )}

      {onboardingOpen && (
        <OnboardingModal
          onClose={() => setOnboardingOpen(false)}
          onSaved={() => {
            loadTemplates();
            pull(templateSlug);
          }}
        />
      )}

      {buildAppOpen && (
        <BuildAppModal
          onClose={() => setBuildAppOpen(false)}
          templateOptions={templateOptions}
          defaultTemplateSlug={templateSlug}
        />
      )}
    </div>
  );
}

function renderSettings(envelope: BootstrapEnvelope) {
  const cfg = envelope.runtime_config as Record<string, unknown>;
  const rows: Array<[string, string]> = [
    ['schema_version', envelope.schema_version],
    ['catalog_snapshot_version', String(envelope.catalog_snapshot_version)],
    ['customizations_version', String(envelope.customizations_version)],
    ...Object.entries(cfg).map(([k, v]) => [k, formatValue(v)] as [string, string]),
  ];
  return (
    <>
      <p className="appza-bottom-panel-title">Settings</p>
      {rows.map(([k, v]) => (
        <div className="appza-bottom-panel-row" key={k}>
          <span className="appza-bottom-panel-key">{k}</span>
          <span className="appza-bottom-panel-value">{v}</span>
        </div>
      ))}
    </>
  );
}

function renderThemes(templateTokens: unknown, screenTokens: unknown) {
  const tpl = isRecord(templateTokens) ? templateTokens : {};
  const scr = isRecord(screenTokens) ? screenTokens : {};
  return (
    <>
      <p className="appza-bottom-panel-title">Themes</p>
      <div className="appza-bottom-panel-row">
        <span className="appza-bottom-panel-key">template.tokens</span>
        <span className="appza-bottom-panel-value">{summarize(tpl)}</span>
      </div>
      <div className="appza-bottom-panel-row">
        <span className="appza-bottom-panel-key">screen_tokens</span>
        <span className="appza-bottom-panel-value">{summarize(scr)}</span>
      </div>
    </>
  );
}

// Must mirror the mobile shell exactly.
function applyFcRuntimeSettings(envelope: BootstrapEnvelope): void {
  const cfg = (envelope.runtime_config ?? null) as Record<string, unknown> | null;
  const fc = cfg && isRecord(cfg.fluent_community) ? (cfg.fluent_community as Record<string, unknown>) : null;
  if (!fc) return;
  setFcRuntimeSettings(fc);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readInitialLayout(customizations: unknown, compositeKey: string): LayoutStyle {
  if (!isRecord(customizations)) return {};
  const scope = customizations['appzet_primitive'];
  if (!isRecord(scope)) return {};
  const target = scope[compositeKey];
  if (!isRecord(target)) return {};
  const layout = target['layout'];
  return isRecord(layout) ? (layout as LayoutStyle) : {};
}

function summarize(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '(empty)';
  return keys.join(', ');
}

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

// Mirror of the canvas customizations for imperatively opened overlays, which render outside PlacementRenderer.
let currentCustomizations: unknown = null;

function setCustomizationsForActions(customizations: unknown): void {
  currentCustomizations = customizations;
}

function readAppzetActionsFromCatalog(
  slug: string,
): Record<string, { action_slug?: string; args?: Record<string, unknown> }> | null {
  const cat = (window as unknown as { __appzaCatalog?: { appzets?: unknown[] } }).__appzaCatalog;
  const appzets = Array.isArray(cat?.appzets) ? cat!.appzets! : [];
  const found = appzets.find(
    (a): a is Record<string, unknown> =>
      isRecord(a) && (a as Record<string, unknown>).slug === slug,
  );
  return found && isRecord(found.actions)
    ? (found.actions as Record<string, { action_slug?: string; args?: Record<string, unknown> }>)
    : null;
}

function readAppzetPropsFromCatalog(slug: string): Record<string, unknown> {
  const cat = (window as unknown as { __appzaCatalog?: { appzets?: unknown[] } })
    .__appzaCatalog;
  const appzets = Array.isArray(cat?.appzets) ? cat!.appzets! : [];
  const found = appzets.find(
    (a): a is Record<string, unknown> =>
      isRecord(a) && (a as Record<string, unknown>).slug === slug,
  );
  const base = found && isRecord(found.default_props_override)
    ? (found.default_props_override as Record<string, unknown>)
    : {};
  const resolved = resolveOverridableColumn(
    currentCustomizations,
    'appzet',
    slug,
    'default_props_override',
    base,
  );
  return isRecord(resolved) ? resolved : base;
}

function openScheduleSheetFromCatalog(sheetSlug: string): void {
  openScheduleSheet({
    appzetSlug: sheetSlug,
    value: getPostDraft().scheduled_at,
    presentation: schedulePresentation(readAppzetPropsFromCatalog(sheetSlug)),
    childStyles: childStylesFromCustomizations(
      sheetSlug,
      SCHEDULE_SHEET_CHILD_COUNT,
      currentCustomizations,
    ),
    onConfirm: (value) => setPostDraft({ scheduled_at: value }),
  });
}

// Module-level: shared by the picker action and the strip's Edit event so they can't drift.
function openPollSheetFromCatalog(sheetSlug: string): void {
  const poll = getPostDraft().poll;
  openPollSheet({
    appzetSlug: sheetSlug,
    presentation: pollSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
    childStyles: childStylesFromCustomizations(
      sheetSlug,
      POLL_SHEET_CHILD_COUNT,
      currentCustomizations,
    ),
    value: poll,
    // A server-issued slug means the option has votes: its type freezes and the row can't be removed.
    existing: !!poll && poll.options.some((o) => !!o.slug),
  });
}

// Seeds every post; submit omits document_ids unless files were added, so "removed all" is never confused with "had none".
function seedEditDraftFromPost(item: unknown): void {
  if (!isRecord(item)) {
    resetDocumentDraft('');
    return;
  }
  const feedId = typeof item.id === 'number' ? item.id : Number.parseInt(String(item.id), 10);
  if (!Number.isFinite(feedId)) {
    resetDocumentDraft('');
    return;
  }
  const spaceRec = isRecord(item.space) ? item.space : null;
  const spaceSlug =
    (spaceRec && typeof spaceRec.slug === 'string' && spaceRec.slug) ||
    (typeof item.space_slug === 'string' ? item.space_slug : '');
  // meta.document_lists fallback: an empty seed would make Save read as "removed everything".
  let files = Array.isArray(item.files)
    ? (item.files.filter((f) => isRecord(f)) as Array<Record<string, unknown>>)
    : [];
  if (files.length === 0) {
    const meta = isRecord(item.meta) ? item.meta : null;
    const snapshot = meta && Array.isArray(meta.document_lists) ? meta.document_lists : [];
    files = snapshot.filter((f) => isRecord(f)) as Array<Record<string, unknown>>;
  }
  seedDraftForEdit(feedId, spaceSlug, files);
}

function findOpenerAction(
  slug: string,
): { action_slug: string; args: Record<string, unknown> } | null {
  const cat = (window as unknown as { __appzaCatalog?: { appzets?: unknown[] } })
    .__appzaCatalog;
  const appzets = Array.isArray(cat?.appzets) ? cat!.appzets! : [];
  for (const a of appzets) {
    if (!isRecord(a) || a.slug === slug || !isRecord(a.actions)) continue;
    for (const wiring of Object.values(a.actions)) {
      if (!isRecord(wiring) || typeof wiring.action_slug !== 'string') continue;
      const args = isRecord(wiring.args) ? wiring.args : {};
      const opensThis = Object.entries(args).some(
        ([k, v]) => k.endsWith('appzet_slug') && v === slug,
      );
      if (opensThis) return { action_slug: wiring.action_slug, args };
    }
  }
  return null;
}

function readDataSourceEndpointFromCatalog(
  catalog: Catalog | null,
  slug: string,
): string | null {
  const ds = catalog?.data_sources?.find((d) => d.slug === slug);
  return ds && typeof ds.endpoint === 'string' && ds.endpoint ? ds.endpoint : null;
}

// Invitation endpoints answer 200 with the real outcome in response.status.
async function readInvitationOutcome(
  res: Response,
): Promise<{ ok: boolean; message: string }> {
  const json = await res.json().catch(() => null);
  const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
  const inner =
    rec && 'response' in rec ? (rec.response as Record<string, unknown> | undefined) : undefined;
  const innerStatus = inner && typeof inner.status === 'number' ? inner.status : null;
  const ok = innerStatus !== null ? innerStatus === 200 : res.ok;
  const message =
    (inner && typeof inner.message === 'string' && inner.message) ||
    (rec && typeof rec.message === 'string' ? (rec.message as string) : '') ||
    (ok ? '' : `HTTP ${res.status}`);
  return { ok, message };
}

// The async Clipboard API needs a secure origin; the dev site is http.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type AppModeActionDeps = {
  catalog: Catalog | null;
  currentScreenId: number | null;
  setSelectedScreenId: (id: number | null) => void;
  setScreenStack: (fn: (prev: number[]) => number[]) => void;
  auth: StoredAuth | null;
  setAuth: (a: StoredAuth | null) => void;
  onLoginError: (message: string) => void;
  requireAuthOrLogin: () => boolean;
  onLoginSuccess: () => void;
  onMenuInfo: (message: string) => void;
  onMenuError: (message: string) => void;
  openImagePicker: (target: {
    endpoint: string;
    method: string;
    accept?: string;
    onStart?: () => void;
    sink?: (urls: string[]) => void;
    onFail?: () => void;
  }) => void;
  openAudioPicker: (endpoint: string) => void;
  openDocumentPicker: (t: {
    upload: string;
    rename: string;
    remove: string;
    accept: string;
  }) => void;
  pendingImages: string[];
  clearPendingImages: () => void;
  attachVideo: (url: string, target: { endpoint: string; method: string }) => Promise<void>;
  pendingVideo: { url: string; title?: string; image?: string; provider?: string } | null;
  clearPendingVideo: () => void;
  openDeleteConfirm: (next: {
    feedId: number;
    endpoint: string;
    method: string;
    bodyKey: string;
    title: string;
    message: string;
    cta: string;
    extraBody?: Record<string, unknown>;
    failLabel?: string;
  }) => void;
  reactedSet: Set<string>;
  openCommentPanel: (next: {
    feedId: number;
    endpoint: string;
    method: string;
    listEndpoint: string;
    bodyKey: string;
    messageKey: string;
    panelTitle: string;
    placeholder: string;
    sendLabel: string;
    replyTo?: { id: number | string; name: string };
    edit?: {
      commentId: number | string;
      message: string;
      parentBodyKey: string;
      toastMessage: string;
    };
  }) => void;
  screenContextRef: React.MutableRefObject<Record<string, unknown>>;
  screenPrefilledRef: React.MutableRefObject<Record<string, true>>;
};

const AUTH_STORAGE_KEY = 'appza:auth';

let currentAuthHeader: string | undefined;
setAuthHeaderProvider(() => currentAuthHeader);

type StoredAuth = {
  username: string;
  token: string;
  // Application-password uuid, so logout can revoke it.
  uuid?: string;
  display_name?: string;
  avatar?: string;
  user_id?: number;
};

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.username === 'string' &&
      typeof parsed.token === 'string' &&
      parsed.username &&
      parsed.token
    ) {
      return parsed as StoredAuth;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredAuth(a: StoredAuth | null): void {
  try {
    if (a) window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(a));
    else window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* localStorage unavailable — sim just runs unauthenticated */
  }
}

function basicAuthHeader(auth: StoredAuth): string {
  return 'Basic ' + window.btoa(`${auth.username}:${auth.token}`);
}

const REACTION_UI: Record<
  string,
  { actionName: string; iconOn: string; iconOff: string; colorOn: string; countPathTimeline: string | null }
> = {
  like: {
    actionName: 'on_tap_like',
    iconOn: 'heart',
    iconOff: 'heart-outline',
    colorOn: 'danger',
    countPathTimeline: 'children[13]',
  },
  bookmark: {
    actionName: 'on_tap_bookmark',
    iconOn: 'bookmark',
    iconOff: 'bookmark-outline',
    colorOn: 'primary',
    countPathTimeline: null,
  },
};

// DOM-level, so a tap skips a re-render and a feed refetch flash; the caller reverts on failure.
function applyReactionOptimistic(feedId: number, reactType: string, on: boolean) {
  const cfg = REACTION_UI[reactType];
  if (!cfg) return;
  const wrappers = document.querySelectorAll<HTMLElement>(
    `[data-appza-item-id="${CSS.escape(String(feedId))}"]`,
  );
  wrappers.forEach((wrapper) => {
    const btn = wrapper.querySelector<HTMLElement>(
      `[data-appza-action="${cfg.actionName}"]`,
    );
    if (btn) {
      const nextIcon = on ? cfg.iconOn : cfg.iconOff;
      const nextColor = on ? cfg.colorOn : 'medium';
      // resolveIcon passes SVG data — Ionicons' name registry lacks these without addIcons(). Never blank the icon.
      const resolved =
        resolveIcon(nextIcon) ||
        resolveIcon(cfg.iconOff) ||
        resolveIcon(cfg.iconOn);
      if (!resolved) return;
      btn.querySelectorAll<HTMLElement>('ion-icon').forEach((ic) => {
        ic.removeAttribute('name');
        ic.removeAttribute('src');
        ic.setAttribute('icon', resolved);
      });
      btn.querySelectorAll<HTMLElement>('ion-button').forEach((b) => {
        b.setAttribute('color', nextColor);
      });
    }
    // A null count path means no visible count (bookmark); a sibling fallback would hit the like count.
    let countWrap: HTMLElement | null = null;
    if (cfg.countPathTimeline) {
      countWrap = wrapper.querySelector<HTMLElement>(
        `[data-appza-primitive-path="${cfg.countPathTimeline}"]`,
      );
    }
    if (countWrap) {
      const target =
        countWrap.querySelector<HTMLElement>('ion-text p') ??
        countWrap.querySelector<HTMLElement>('ion-text') ??
        countWrap;
      const text = target.textContent ?? '';
      const match = text.match(/(\d+)/);
      const cur = match && match[1] ? parseInt(match[1], 10) : 0;
      const next = Math.max(0, cur + (on ? 1 : -1));
      // Timeline keeps a " likes" suffix; card and list are bare numbers.
      const suffix = text.replace(/^\s*\d+/, '').trim();
      target.textContent = suffix ? `${next} ${suffix}` : String(next);
    }
  });
}

// Also opens the proxy-cache bypass window so a re-mounting AppZet skips the 5-min transient.
function triggerFeedRefresh() {
  const g = window as unknown as { __appzaForceRefreshUntil?: number };
  g.__appzaForceRefreshUntil = Date.now() + 3000;
  setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 150);
  setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 600);
}

function humanizeSlug(slug: string): string {
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}


// `path` uses param_map grammar: children[i].value / .checked / .selectedValue.
function readFormFieldValue(
  appzetSlug: string,
  path: string,
): string | boolean | null {
  const parsed = /^children\[(\d+)\]\.(\w+)$/.exec(path);
  if (!parsed) return null;
  const idx = Number(parsed[1]);
  const prop = parsed[2];
  const wrapper = document.querySelector(
    `[data-appza-appzet-slug="${CSS.escape(appzetSlug)}"][data-appza-primitive-path="children[${idx}]"]`,
  );
  if (!wrapper) return null;
  if (prop === 'value') {
    const el = wrapper.querySelector('ion-input, ion-textarea, ion-select, input, textarea, select') as
      | (HTMLElement & { value?: unknown })
      | null;
    if (!el) return null;
    const v = el.value;
    return typeof v === 'string' ? v : v == null ? '' : String(v);
  }
  if (prop === 'checked') {
    const el = wrapper.querySelector('ion-checkbox, input[type="checkbox"]') as
      | (HTMLElement & { checked?: unknown })
      | null;
    if (!el) return null;
    return !!el.checked;
  }
  if (prop === 'selectedValue') {
    const el = wrapper.querySelector('ion-select, select') as
      | (HTMLElement & { value?: unknown })
      | null;
    if (!el) return null;
    const v = el.value;
    return typeof v === 'string' || typeof v === 'number' ? String(v) : null;
  }
  return null;
}

function resolveFeedIdFromContext(ctx: unknown, feedIdPath: string): number | null {
  if (!isRecord(ctx)) return null;
  const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
  const source =
    isRecord((ctx as Record<string, unknown>).data)
      ? ((ctx as Record<string, unknown>).data as Record<string, unknown>)
      : (ctx as Record<string, unknown>);
  const raw = source[key];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return null;
}

// `draft.<field>` reads the postDraft slice — the composer is one bespoke primitive with no children[i] inputs to read.
function readParamSource(appzetSlug: string, path: string): unknown {
  if (path.startsWith('draft.')) {
    const draft = getPostDraft() as unknown as Record<string, unknown>;
    return draft[path.slice('draft.'.length)];
  }
  return readFormFieldValue(appzetSlug, path);
}

function collectParams(
  appzetSlug: string,
  paramMap: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!paramMap) return out;
  for (const [name, path] of Object.entries(paramMap)) {
    if (typeof path !== 'string') continue;
    const v = readParamSource(appzetSlug, path);
    // `??` not `||`: an empty topic list must stay an array or FC rejects the post.
    out[name] = v ?? '';
  }
  return out;
}

// First match wins when several AppZets declare the same action.
function findAppzetForAction(
  catalog: Catalog | null,
  currentScreenId: number | null,
  action_slug: string,
  customizations: unknown,
): string | null {
  if (!catalog || currentScreenId == null) return null;
  const screen = catalog.template_screens?.find((s) => s.id === currentScreenId);
  if (!screen) return null;
  // The appbar counts too: the create-post appbar's Post button lives outside the main slot.
  const placements = [
    ...screenPlacements(screen, catalog, customizations),
    ...screenAppbarPlacements(screen, catalog, customizations),
  ];
  for (const p of placements) {
    const appzet = catalog.appzets?.find((a) => a.slug === p.appzet_slug);
    const actions = (appzet?.actions ?? null) as Record<string, unknown> | null;
    if (!actions) continue;
    for (const wiring of Object.values(actions)) {
      if (wiring && typeof wiring === 'object' && !Array.isArray(wiring)) {
        if ((wiring as Record<string, unknown>).action_slug === action_slug) return p.appzet_slug;
      }
    }
  }
  return null;
}

function handleAppModeAction(inv: ActionInvocation, deps: AppModeActionDeps) {
  const {
    catalog,
    currentScreenId,
    setSelectedScreenId,
    setScreenStack,
    auth,
    setAuth,
    onLoginError,
    requireAuthOrLogin,
    onLoginSuccess,
    onMenuInfo,
    onMenuError,
    pendingImages,
    clearPendingImages,
    pendingVideo,
    clearPendingVideo,
    openDeleteConfirm,
    reactedSet,
    openCommentPanel,
    screenContextRef,
    screenPrefilledRef,
  } = deps;
  const { action_slug, args, item, binding_root, siblings, siblingIndex } = inv;
  const argRec = (args ?? {}) as Record<string, unknown>;
  // `binding_root` sub-selects a slice of the item (e.g. one CTA).
  const effectiveItem = binding_root ? readDataPath(item, binding_root) ?? item : item;
  const itemRec = isRecord(effectiveItem) ? (effectiveItem as Record<string, unknown>) : null;

  switch (action_slug) {
    case 'nav.push': {
      const targetSlug =
        typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : null;
      if (!targetSlug || !catalog) return;
      // Only nav.push can tell arriving from returning; edit-post-page must start clean or an abandoned draft leaks into it.
      if (targetSlug === 'create-post-page' || targetSlug === 'edit-post-page') {
        resetPostDraft();
      }
      const target = catalog.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        console.warn('[appza-admin/app-mode] nav.push target not found:', targetSlug);
        return;
      }
      // Set context before switching so the first render sees it; clear the prefilled flag so a new Edit re-prefills.
      if (argRec.pass_item_as_context === true && effectiveItem != null) {
        screenContextRef.current[targetSlug] = effectiveItem;
        delete screenPrefilledRef.current[targetSlug];
        if (targetSlug === 'edit-post-page') {
          seedEditDraftFromPost(effectiveItem);
        }
        if (isRecord(effectiveItem)) {
          const ctx = effectiveItem as Record<string, unknown>;
          const routeBag: Record<string, unknown> = {};
          // The space slug wins for route.slug (the topic dropdown needs it); the post slug goes to post_slug.
          const spaceCtx = isRecord(ctx.space) ? (ctx.space as Record<string, unknown>) : null;
          const nestedSpaceSlug =
            spaceCtx && typeof spaceCtx.slug === 'string' && spaceCtx.slug ? spaceCtx.slug : null;
          if (nestedSpaceSlug) {
            routeBag.slug = nestedSpaceSlug;
            routeBag.space_slug = nestedSpaceSlug;
          } else if (typeof ctx.slug === 'string' && ctx.slug) {
            routeBag.slug = ctx.slug;
          }
          if (typeof ctx.space_slug === 'string' && ctx.space_slug) {
            routeBag.space_slug = ctx.space_slug;
            if (!routeBag.slug) routeBag.slug = ctx.space_slug;
          }
          if (typeof ctx.post_slug === 'string' && ctx.post_slug) {
            routeBag.post_slug = ctx.post_slug;
          } else if (nestedSpaceSlug && typeof ctx.slug === 'string' && ctx.slug) {
            routeBag.post_slug = ctx.slug;
          }
          if (typeof ctx.id === 'number' || typeof ctx.id === 'string') routeBag.id = ctx.id;
          if (Object.keys(routeBag).length > 0) {
            setRouteParams(routeBag);
            if (typeof routeBag.slug === 'string' && targetSlug === 'space-detail') {
              // Always land on POSTS with no topic, or stale localStorage can leave a hidden tab.
              setSpaceDetailControls({
                space_slug: routeBag.slug,
                active_subtab: 'posts',
                topic_slug: '',
              });
            }
          }
        }
      }
      if (targetSlug === 'profile') {
        const me = getViewer().user_id;
        if (typeof me === 'number' && me > 0) setProfileControls({ member_id: me, tab: 'posts' });
      } else if (targetSlug === 'profile-page-details') {
        const ctxRec = isRecord(effectiveItem) ? (effectiveItem as Record<string, unknown>) : null;
        const raw = ctxRec?.user_id ?? ctxRec?.id;
        const id = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
        if (Number.isFinite(id) && id > 0) setProfileControls({ member_id: id, tab: 'posts' });
      }
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }
    case 'nav.back': {
      setScreenStack((prev) => {
        if (prev.length === 0) return prev;
        const rest = prev.slice(0, -1);
        setSelectedScreenId(prev[prev.length - 1] ?? null);
        return rest;
      });
      return;
    }
    case 'link.open': {
      // Accept both the action's `url`/`new_tab` and FC's `link`/`newTab`/`permalink`.
      const url =
        pickString(argRec, ['url', 'link', 'permalink', 'website']) ??
        pickString(itemRec, ['url', 'link', 'permalink', 'website']);
      if (!url) {
        console.warn('[appza-admin/app-mode] link.open: no url resolved from', {
          args: argRec,
          item: effectiveItem,
        });
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    case 'auth.logout': {
      const logoutEndpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (logoutEndpoint && auth?.uuid) {
        void fetch(logoutEndpoint, {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: basicAuthHeader(auth),
          },
          body: JSON.stringify({ uuid: auth.uuid }),
        }).catch(() => {});
      }
      setAuth(null);
      // The picker payload is per-viewer; drop it so the next sign-in doesn't inherit it.
      clearPostSpaceCache();
      resetPostDraft();
      const login = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === 'login-page',
      );
      if (login) {
        setScreenStack(() => []);
        setSelectedScreenId(login.id);
      }
      return;
    }

    case 'auth.login': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const paramMap = argRec.param_map && typeof argRec.param_map === 'object'
        ? (argRec.param_map as Record<string, unknown>)
        : undefined;
      const onSuccessScreen = typeof argRec.on_success_screen === 'string'
        ? argRec.on_success_screen
        : null;
      if (!endpoint) {
        console.warn('[appza-admin/app-mode] auth.login missing endpoint');
        return;
      }
      const owningAppzet = findAppzetForAction(catalog, currentScreenId, 'auth.login', currentCustomizations);
      if (!owningAppzet) {
        console.warn('[appza-admin/app-mode] auth.login: no owning appzet found on current screen');
        return;
      }
      const body = collectParams(owningAppzet, paramMap);
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json || typeof json !== 'object') {
            const bodyMsg =
              json && typeof (json as Record<string, unknown>).message === 'string'
                ? ((json as Record<string, unknown>).message as string)
                : null;
            onLoginError(bodyMsg ?? `Login failed (HTTP ${res.status})`);
            return;
          }
          const j = json as Record<string, unknown>;
          const token = typeof j.token === 'string' ? j.token : null;
          const username = typeof j.user_name === 'string'
            ? j.user_name
            : (typeof body.username === 'string' ? (body.username as string) : null);
          if (!token || !username) {
            onLoginError('Login response missing token');
            return;
          }
          const userId = typeof j.user_id === 'number'
            ? j.user_id
            : typeof j.user_id === 'string' && j.user_id !== '' && !Number.isNaN(Number(j.user_id))
              ? Number(j.user_id)
              : undefined;
          const stored: StoredAuth = {
            username,
            token,
            display_name: typeof j.display_name === 'string' ? j.display_name : undefined,
            avatar: typeof j.avatar === 'string' ? j.avatar : undefined,
            user_id: userId,
            uuid: typeof j.uuid === 'string' ? j.uuid : undefined,
          };
          setAuth(stored);
          onLoginSuccess();
          if (onSuccessScreen && catalog) {
            const target = catalog.template_screens?.find(
              (s) => s.app_map_screen_slug === onSuccessScreen,
            );
            if (target) {
              setScreenStack(() => []);
              setSelectedScreenId(target.id);
            }
          }
        } catch (err) {
          onLoginError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'post.create': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const paramMap = argRec.param_map && typeof argRec.param_map === 'object'
        ? (argRec.param_map as Record<string, unknown>)
        : undefined;
      const composerAppzet =
        (typeof argRec.form_appzet_slug === 'string' && argRec.form_appzet_slug) ||
        'fc-post-information';
      if (!endpoint) {
        console.warn('[appza-admin/app-mode] post.create missing endpoint');
        return;
      }
      if (!auth) {
        onLoginError('Please sign in to post.');
        return;
      }
      const body = collectParams(composerAppzet, paramMap);
      // FC answers an empty message with a 422; fail early with a clearer error.
      if (!body.message || (typeof body.message === 'string' && !body.message.trim())) {
        onLoginError('Write something to post.');
        return;
      }
      if (pendingImages.length > 0) {
        body.media_images = pendingImages.map((url) => ({ url, provider: 'uploader' }));
        body.content_type = 'image';
      }
      // FC takes an oEmbed by URL; a pasted iframe or FluentPlayer upload goes as `html` / `media_id`.
      const draftVideo = getPostDraft().video;
      if (draftVideo) {
        // No content_type: FC discards it on create, and on edit a differing one fires a hook that deletes a document post's files.
        const mediaPayload = buildVideoMediaPayload(draftVideo);
        if (mediaPayload) body.media = mediaPayload;
      }
      // Audio sits alongside other media: FC stores audio_medias independently of content_type.
      const draftAudios = getPostDraft().audios;
      if (draftAudios.length > 0) {
        body.audio_medias = draftAudios.map((a) => ({
          media_id: a.media_id,
          player: 'fluent_player',
          content_type: 'audio',
          url: a.url,
          title: a.title,
          settings: { src: a.url, title: a.title, viewType: 'audio' },
        }));
      }
      // Documents take the whole post: FC's document filter runs last and sets content_type itself.
      const draftDocs = getPostDraft().documents;
      if (draftDocs.length > 0) {
        body.document_ids = draftDocs.map((d) => ({
          id: d.id,
          media_key: d.media_key,
          title: d.title,
          url: d.url,
          type: d.type,
        }));
        body.content_type = 'document';
      }
      // FC Pro requires >= 30 min ahead and silently ignores it for non-moderators (the glyph is gated).
      const draftSchedule = getPostDraft().scheduled_at;
      if (draftSchedule !== '') body.scheduled_at = draftSchedule;

      const draftPoll = getPostDraft().poll;
      if (draftPoll && draftPoll.options.length >= 2) {
        body.survey = {
          type: draftPoll.type,
          options: draftPoll.options.map((o) => ({ label: o.label })),
          // '' means the poll never closes in FC.
          end_date: draftPoll.end_date,
        };
        body.content_type = 'survey';
      }
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            // Omit cookies: WP's cookie auth runs first, demands a nonce and 401s before Application Passwords is tried.
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => null);
          const status = (json && typeof json === 'object' && 'response' in json)
            ? ((json as Record<string, unknown>).response as Record<string, unknown> | undefined)
            : undefined;
          const httpOk = res.ok;
          const bodyOk = !status || status.status === 200;
          if (!httpOk || !bodyOk) {
            const msg =
              (status && typeof status.message === 'string' && status.message) ||
              (json && typeof (json as Record<string, unknown>).message === 'string'
                ? (json as Record<string, string>).message
                : null) ||
              `Post failed (HTTP ${res.status})`;
            onLoginError(msg);
            return;
          }
          clearPendingImages();
          clearPendingVideo();
          setScreenStack((prev) => {
            if (prev.length === 0) return prev;
            const rest = prev.slice(0, -1);
            setSelectedScreenId(prev[prev.length - 1] ?? null);
            return rest;
          });
          // Defer the refresh until the nav commits, or the feed's data source misses the event.
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          setTimeout(() => {
            window.dispatchEvent(new Event('appza:refresh-data'));
          }, 150);
          setTimeout(() => {
            window.dispatchEvent(new Event('appza:refresh-data'));
          }, 600);
        } catch (err) {
          onLoginError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    // Remove Preview shares this confirm: FC nulls meta.media_preview with no undo.
    case 'comment.delete':
    case 'post.remove_preview':
    case 'post.delete': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const feedIdPath = typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const bodyKey = typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const title = typeof argRec.confirm_title === 'string' ? argRec.confirm_title : 'Delete post?';
      const message = typeof argRec.confirm_message === 'string'
        ? argRec.confirm_message
        : 'This post will be permanently removed. This action cannot be undone.';
      const cta = typeof argRec.confirm_cta === 'string' ? argRec.confirm_cta : 'Delete';
      if (!endpoint) {
        console.warn('[appza-admin/app-mode] post.delete missing endpoint');
        return;
      }
      if (!auth) {
        onLoginError(
        action_slug === 'post.remove_preview'
          ? 'Please sign in to change this post.'
          : 'Please sign in to delete a post.',
      );
        return;
      }
      // The item is already unwrapped, so strip a `data.` prefix.
      const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const raw = itemRec ? (itemRec as Record<string, unknown>)[key] : undefined;
      const feedId = typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw !== '' && !Number.isNaN(Number(raw))
          ? Number(raw)
          : null;
      if (feedId === null) {
        console.warn('[appza-admin/app-mode] post.delete could not resolve feed_id from', {
          feedIdPath,
          item: effectiveItem,
        });
        onLoginError('Could not identify which post to delete.');
        return;
      }
      let extraBody: Record<string, unknown> | undefined;
      const parentBodyKey =
        typeof argRec.parent_body_key === 'string' && argRec.parent_body_key
          ? argRec.parent_body_key
          : null;
      if (parentBodyKey) {
        const parentPath =
          typeof argRec.parent_id_path === 'string' ? argRec.parent_id_path : 'data.post_id';
        const pk = parentPath.startsWith('data.') ? parentPath.slice(5) : parentPath;
        const rawParent = itemRec ? (itemRec as Record<string, unknown>)[pk] : undefined;
        const parentId =
          typeof rawParent === 'number'
            ? rawParent
            : typeof rawParent === 'string' && rawParent !== '' && !Number.isNaN(Number(rawParent))
              ? Number(rawParent)
              : null;
        if (parentId === null) {
          onLoginError('Could not identify which post this comment belongs to.');
          return;
        }
        extraBody = { [parentBodyKey]: parentId };
      }
      openDeleteConfirm({
        feedId, endpoint, method, bodyKey, title, message, cta,
        extraBody,
        failLabel: action_slug === 'post.remove_preview' ? 'Remove preview' : 'Delete',
      });
      return;
    }

    // Poll voters: the endpoint comes from args — ActionHttpMethod is writes-only.
    case 'poll.voters': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (!endpoint) {
        onLoginError('poll.voters is missing its endpoint.');
        return;
      }
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const fk = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const feedId = itemRec ? (itemRec as Record<string, unknown>)[fk] : undefined;
      const optionSlug =
        itemRec && typeof itemRec.option_slug === 'string' ? itemRec.option_slug : '';
      if ((typeof feedId !== 'number' && typeof feedId !== 'string') || !optionSlug) {
        onLoginError('Could not identify which poll option to open.');
        return;
      }
      openPollVotersSheet({
        endpoint,
        feedId,
        optionSlug,
        optionLabel:
          itemRec && typeof itemRec.option_label === 'string' ? itemRec.option_label : undefined,
        title: typeof argRec.sheet_title === 'string' ? argRec.sheet_title : 'Voters',
        emptyMessage:
          typeof argRec.empty_message === 'string' ? argRec.empty_message : 'No votes yet.',
        authHeader: auth ? basicAuthHeader(auth) : undefined,
      });
      return;
    }

    case 'comment.options':
    // The popover is about gated rows; each row's visible_when resolves against the bound item.
    case 'profile.options':
    case 'post.options': {
      const rawItems = Array.isArray(argRec.items) ? argRec.items : [];
      const items = rawItems
        .filter((i): i is Record<string, unknown> => isRecord(i))
        .map((i) => i as unknown as PostMenuItem)
        .filter((i) => typeof i.action_slug === 'string' && i.action_slug);
      if (items.length === 0) return;
      const itemId =
        itemRec && (typeof itemRec.id === 'number' || typeof itemRec.id === 'string')
          ? String(itemRec.id)
          : null;
      const anchor = itemId
        ? document.querySelector(
            `[data-appza-item-id="${CSS.escape(itemId)}"] [data-appza-action="on_tap_menu"]`,
          )
        : document.querySelector('[data-appza-action="on_tap_menu"]');
      const menuSheetSlug =
        argRec.presentation === 'sheet'
          ? typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
            ? argRec.sheet_appzet_slug
            : 'fc-post-menu-sheet'
          : null;
      openPostOptionsPopover(
        items,
        effectiveItem,
        anchor,
        menuSheetSlug
          ? {
              appzetSlug: menuSheetSlug,
              eyebrowPath:
                typeof argRec.sheet_eyebrow_path === 'string' ? argRec.sheet_eyebrow_path : undefined,
              presentation: postMenuSheetPresentation(
                readAppzetPropsFromCatalog(menuSheetSlug),
                typeof argRec.sheet_title === 'string' ? argRec.sheet_title : undefined,
              ),
              childStyles: childStylesFromCustomizations(
                menuSheetSlug,
                POST_MENU_SHEET_CHILD_COUNT,
                currentCustomizations,
              ),
            }
          : undefined,
      );
      return;
    }

    case 'comment.copy_link':
    case 'comment.pin':
    case 'comment.like':
    case 'comment.report':
    case 'post.copy_link':
    case 'post.pin_top':
    case 'post.pin_sidebar':
    case 'post.disable_comments':
    case 'post.report': {
      const handled = tryHandlePostMenuAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
      });
      if (handled) return;
      return;
    }

    // The picker needs a mounted file input, so the shell supplies it.
    case 'profile.change_username':
    case 'profile.change_password':
    case 'profile.deactivate_confirm':
    case 'profile.deactivate': {
      tryHandleProfileAccountAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
        collect: (slug, map) => collectParams(slug, map as Record<string, unknown> | undefined),
        dispatch: (next) => handleAppModeAction(next, deps),
      });
      return;
    }

    case 'auth.logout_confirm': {
      tryHandleLogoutConfirm(inv);
      return;
    }

    case 'profile.change_photo':
    case 'profile.remove_photo':
    case 'profile.remove_photo_confirm': {
      tryHandleProfilePhotoAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
        pickImage: deps.openImagePicker,
      });
      return;
    }

    case 'course_students.set_search':
    case 'course_students.set_sort':
    case 'course_students.open_add':
    case 'course.add_student':
    case 'course.remove_student_confirm':
    case 'course.remove_student': {
      tryHandleCourseStudentsAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
        readAppzetProps: readAppzetPropsFromCatalog,
        customizations: currentCustomizations,
      });
      return;
    }

    case 'comment.edit_inline':
    case 'comment.save_inline': {
      tryHandleCommentInlineAction(inv, { auth, authHeader: basicAuthHeader });
      return;
    }

    case 'course.open_lesson':
    case 'course_lesson.goto':
    case 'course_lesson.complete':
    case 'course_lesson.submit_quiz': {
      tryHandleCourseLessonAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        dispatch: (next) => handleAppModeAction(next, deps),
      });
      return;
    }

    case 'course_detail.toggle_section':
    case 'course.enroll': {
      tryHandleCourseDetailAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
      });
      return;
    }

    case 'moderation.set_tab':
    case 'moderation.review':
    case 'moderation.set_status':
    case 'moderation.delete_report': {
      tryHandleModerationAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        readAppzetProps: readAppzetPropsFromCatalog,
        dispatch: (next) => handleAppModeAction(next, deps),
      });
      return;
    }

    case 'members.set_search':
    case 'members.set_tab':
    case 'members.set_sort':
    case 'member.status_confirm':
    case 'member.set_status': {
      tryHandleMemberDirectoryAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
        readAppzetProps: readAppzetPropsFromCatalog,
        customizations: currentCustomizations,
      });
      return;
    }

    case 'courses.set_tab':
    case 'courses.set_search':
    case 'courses.set_topic':
    case 'courses.set_sort': {
      tryHandleCourseListAction(inv, {
        onError: onMenuError,
        readAppzetProps: readAppzetPropsFromCatalog,
        customizations: currentCustomizations,
      });
      return;
    }

    case 'user.follow':
    case 'user.unfollow':
    case 'user.notify_subscribe':
    case 'user.notify_unsubscribe':
    case 'profile.block':
    case 'profile.unblock': {
      tryHandleProfileAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
      });
      return;
    }

    case 'profile.save': {
      tryHandleProfileSave(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
        collect: (slug, map) => collectParams(slug, map as Record<string, unknown> | undefined),
        onSaved: () => {
          setScreenStack((prev) => {
            if (prev.length === 0) return prev;
            const rest = prev.slice(0, -1);
            setSelectedScreenId(prev[prev.length - 1] ?? null);
            return rest;
          });
        },
      });
      return;
    }

    case 'post.edit': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'id';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const paramMap =
        argRec.param_map && typeof argRec.param_map === 'object'
          ? (argRec.param_map as Record<string, unknown>)
          : undefined;
      const composerAppzet =
        (typeof argRec.form_appzet_slug === 'string' && argRec.form_appzet_slug) ||
        'fc-post-information';
      if (!endpoint) {
        console.warn('[appza-admin/app-mode] post.edit missing endpoint');
        return;
      }
      if (!auth) {
        onLoginError('Please sign in to edit.');
        return;
      }
      // The composer has no id field; the screen context is the source of truth.
      const screenSlug =
        catalog?.template_screens?.find((s) => s.id === currentScreenId)?.app_map_screen_slug ?? null;
      const ctx = screenSlug ? screenContextRef.current[screenSlug] : null;
      const feedId = resolveFeedIdFromContext(ctx ?? effectiveItem, feedIdPath);
      if (feedId === null) {
        onLoginError('Could not identify which post to update.');
        return;
      }
      const body = collectParams(composerAppzet, paramMap);
      if (!body.message || (typeof body.message === 'string' && !body.message.trim())) {
        onLoginError('Write something to post.');
        return;
      }
      body[bodyKey] = feedId;
      // FC takes a move as its own keys, not a `space` change; 'current' (armed, unchosen) sends nothing.
      const moveDraft = getPostDraft();
      if (moveDraft.can_move_space) {
        if (moveDraft.move_target === 'space' && moveDraft.move_space_id) {
          body.new_space_id = moveDraft.move_space_id;
        } else if (moveDraft.move_target === 'profile') {
          body.move_to_profile = 1;
        }
      }
      // Update reads the same shape as create, so resend the (prefilled) media or Save drops it.
      if (pendingImages.length > 0) {
        body.media_images = pendingImages.map((url) => ({ url, provider: 'uploader' }));
        body.content_type = 'image';
      }
      const draftVideo = getPostDraft().video;
      if (draftVideo) {
        // No content_type: a differing one fires a hook that deletes a document post's files.
        const mediaPayload = buildVideoMediaPayload(draftVideo);
        if (mediaPayload) body.media = mediaPayload;
      }
      const draftAudios = getPostDraft().audios;
      if (draftAudios.length > 0) {
        body.audio_medias = draftAudios.map((a) => ({
          media_id: a.media_id,
          player: 'fluent_player',
          content_type: 'audio',
          url: a.url,
          title: a.title,
          settings: { src: a.url, title: a.title, viewType: 'audio' },
        }));
      }
      // Composer documents aren't read here: an empty document_ids deletes every file, and a leftover create draft would destroy real attachments.
      const editPoll = getPostDraft().poll;
      if (editPoll && editPoll.options.length >= 2) {
        // Forward each existing option's slug, or FC rejects the edit.
        body.survey = {
          type: editPoll.type,
          options: editPoll.options.map((o) =>
            o.slug ? { label: o.label, slug: o.slug } : { label: o.label },
          ),
          end_date: editPoll.end_date,
        };
        body.content_type = 'survey';
      }
      void (async () => {
        try {
          // FC detaches any media_key missing from the list; new files must be uploaded and renames saved first.
          const draft = getDocumentDraft();
          if (draft.edit_feed_id === feedId) {
            const uploadEndpoint =
              typeof argRec.upload_endpoint === 'string' ? argRec.upload_endpoint : '';
            const renameEndpoint =
              typeof argRec.rename_endpoint === 'string' ? argRec.rename_endpoint : '';
            if (!uploadEndpoint || !renameEndpoint) {
              onLoginError('The document endpoints are missing from the action.');
              return;
            }
            const documents = await prepareDocumentEdit({
              uploadEndpoint,
              renameEndpoint,
              authHeader: basicAuthHeader(auth),
            });
            // An empty document_ids deletes every file — only send it when the seed is known.
            if (documents.length > 0) {
              body.document_ids = documents;
              body.content_type = 'document';
            } else if (draft.seeded_file_count > 0) {
              // Seeded with files, now none: the user removed them all.
              body.document_ids = [];
              body.content_type = 'text';
            }
          }
          const res = await fetch(endpoint, {
            method,
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => null);
          const status =
            json && typeof json === 'object' && 'response' in json
              ? ((json as Record<string, unknown>).response as
                  | Record<string, unknown>
                  | undefined)
              : undefined;
          const httpOk = res.ok;
          const bodyOk = !status || status.status === 200;
          if (!httpOk || !bodyOk) {
            const msg =
              (status && typeof status.message === 'string' && status.message) ||
              (json && typeof (json as Record<string, unknown>).message === 'string'
                ? (json as Record<string, string>).message
                : null) ||
              `Update failed (HTTP ${res.status})`;
            onLoginError(msg);
            return;
          }
          clearPendingImages();
          clearPendingVideo();
          setScreenStack((prev) => {
            if (prev.length === 0) return prev;
            const rest = prev.slice(0, -1);
            setSelectedScreenId(prev[prev.length - 1] ?? null);
            return rest;
          });
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 150);
          setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 600);
        } catch (err) {
          onLoginError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'post.like':
    case 'bookmark.toggle': {
      // No appza:refresh-data: it would refetch every data source and flash the feed.
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey = typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const reactType = typeof argRec.react_type === 'string' && argRec.react_type
        ? argRec.react_type
        : (action_slug === 'bookmark.toggle' ? 'bookmark' : 'like');
      const feedIdPath = typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      if (!endpoint) {
        onLoginError(`${action_slug} is missing its endpoint — set args.endpoint in the catalog.`);
        return;
      }
      if (!auth) {
        requireAuthOrLogin();
        return;
      }
      const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const rawId = itemRec ? (itemRec as Record<string, unknown>)[key] : undefined;
      const feedId = typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && rawId !== '' && !Number.isNaN(Number(rawId))
          ? Number(rawId)
          : null;
      if (feedId === null) {
        onLoginError('Could not identify which post to react to.');
        return;
      }
      const myReactions =
        itemRec && Array.isArray((itemRec as Record<string, unknown>).my_reactions)
          ? ((itemRec as Record<string, unknown>).my_reactions as unknown[]).filter(
              (t): t is string => typeof t === 'string',
            )
          : null;
      const reactKey = `${feedId}:${reactType}`;
      // Ignore taps while the same reaction is in flight, or optimistic counts stack up.
      const inflightKey = `react:${reactKey}`;
      const g = window as unknown as { __appzaInflightReactions?: Set<string> };
      if (!g.__appzaInflightReactions) g.__appzaInflightReactions = new Set();
      if (g.__appzaInflightReactions.has(inflightKey)) {
        return;
      }
      g.__appzaInflightReactions.add(inflightKey);
      const alreadyOn = myReactions
        ? myReactions.includes(reactType)
        : reactedSet.has(reactKey);
      const nextOn = !alreadyOn;
      applyReactionOptimistic(feedId, reactType, nextOn);
      // Update state now so a tap slipping past the inflight guard reads the right direction.
      if (nextOn) reactedSet.add(reactKey);
      else reactedSet.delete(reactKey);
      if (itemRec) {
        const rec = itemRec as Record<string, unknown>;
        const cur = Array.isArray(rec.my_reactions) ? [...(rec.my_reactions as string[])] : [];
        if (nextOn && !cur.includes(reactType)) cur.push(reactType);
        if (!nextOn) {
          const idx = cur.indexOf(reactType);
          if (idx >= 0) cur.splice(idx, 1);
        }
        rec.my_reactions = cur;
      }
      const body: Record<string, unknown> = {
        [bodyKey]: feedId,
        react_type: reactType,
      };
      if (alreadyOn) body.remove = 1;
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => null);
          const status = (json && typeof json === 'object' && 'response' in json)
            ? ((json as Record<string, unknown>).response as Record<string, unknown> | undefined)
            : undefined;
          const httpOk = res.ok;
          const bodyOk = !status || status.status === 200;
          if (!httpOk || !bodyOk) {
            applyReactionOptimistic(feedId, reactType, alreadyOn);
            if (alreadyOn) reactedSet.add(reactKey);
            else reactedSet.delete(reactKey);
            if (itemRec) {
              const rec = itemRec as Record<string, unknown>;
              const cur = Array.isArray(rec.my_reactions) ? [...(rec.my_reactions as string[])] : [];
              if (alreadyOn && !cur.includes(reactType)) cur.push(reactType);
              if (!alreadyOn) {
                const idx = cur.indexOf(reactType);
                if (idx >= 0) cur.splice(idx, 1);
              }
              rec.my_reactions = cur;
            }
            const msg =
              (status && typeof status.message === 'string' && status.message) ||
              `Reaction failed (HTTP ${res.status})`;
            onLoginError(msg);
          }
        } catch (err) {
          applyReactionOptimistic(feedId, reactType, alreadyOn);
          if (alreadyOn) reactedSet.add(reactKey);
          else reactedSet.delete(reactKey);
          onLoginError(err instanceof Error ? err.message : String(err));
        } finally {
          g.__appzaInflightReactions?.delete(inflightKey);
        }
      })();
      return;
    }

    case 'comment.create': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const listEndpoint = typeof argRec.list_endpoint === 'string' ? argRec.list_endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey = typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const messageKey = typeof argRec.message_key === 'string' && argRec.message_key ? argRec.message_key : 'comment';
      const feedIdPath = typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const panelTitle = typeof argRec.panel_title === 'string' ? argRec.panel_title : 'Comments';
      const placeholder = typeof argRec.placeholder === 'string' ? argRec.placeholder : 'Write a comment…';
      const sendLabel = typeof argRec.send_label === 'string' ? argRec.send_label : 'Send';
      if (!endpoint) {
        onLoginError('comment.create is missing its endpoint — set args.endpoint in the catalog.');
        return;
      }
      if (!listEndpoint) {
        onLoginError('comment.create is missing its list_endpoint — set args.list_endpoint in the catalog.');
        return;
      }
      if (!auth) {
        requireAuthOrLogin();
        return;
      }
      const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const rawId = itemRec ? (itemRec as Record<string, unknown>)[key] : undefined;
      const feedId = typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && rawId !== '' && !Number.isNaN(Number(rawId))
          ? Number(rawId)
          : null;
      if (feedId === null) {
        onLoginError('Could not identify which post to comment on.');
        return;
      }
      openCommentPanel({
        feedId,
        endpoint,
        method,
        listEndpoint,
        bodyKey,
        messageKey,
        panelTitle,
        placeholder,
        sendLabel,
      });
      return;
    }

    // A reply targets the POST with the comment as parent; an edit targets the COMMENT with the post alongside.
    case 'comment.reply':
    case 'comment.edit': {
      const isEdit = action_slug === 'comment.edit';
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const listEndpoint = typeof argRec.list_endpoint === 'string' ? argRec.list_endpoint : null;
      const method =
        typeof argRec.method === 'string' ? argRec.method.toUpperCase() : isEdit ? 'PUT' : 'POST';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key
          ? argRec.body_key
          : isEdit
            ? 'comment_id'
            : 'feed_id';
      const messageKey =
        typeof argRec.message_key === 'string' && argRec.message_key
          ? argRec.message_key
          : 'comment';
      const parentBodyKey =
        typeof argRec.parent_body_key === 'string' && argRec.parent_body_key
          ? argRec.parent_body_key
          : isEdit
            ? 'feed_id'
            : 'parent_id';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string'
          ? argRec.feed_id_path
          : isEdit
            ? 'data.id'
            : 'data.post_id';
      const parentIdPath =
        typeof argRec.parent_id_path === 'string'
          ? argRec.parent_id_path
          : isEdit
            ? 'data.post_id'
            : 'data.id';
      const panelTitle =
        typeof argRec.panel_title === 'string'
          ? argRec.panel_title
          : isEdit
            ? 'Edit comment'
            : 'Comments';
      const placeholder =
        typeof argRec.placeholder === 'string' ? argRec.placeholder : 'Write a comment…';
      const sendLabel =
        typeof argRec.send_label === 'string' ? argRec.send_label : isEdit ? 'Save' : 'Reply';
      if (!endpoint || !listEndpoint) {
        onLoginError(`${action_slug} is missing its endpoint or list_endpoint.`);
        return;
      }
      if (!auth) {
        requireAuthOrLogin();
        return;
      }
      const readId = (path: string): number | null => {
        const k = path.startsWith('data.') ? path.slice(5) : path;
        const raw = itemRec ? (itemRec as Record<string, unknown>)[k] : undefined;
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string' && raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
        return null;
      };
      const primaryId = readId(feedIdPath);
      const parentId = readId(parentIdPath);
      if (primaryId === null || parentId === null) {
        onLoginError(
          isEdit
            ? 'Could not identify which comment to edit.'
            : 'Could not identify which comment to reply to.',
        );
        return;
      }
      const postId = isEdit ? parentId : primaryId;

      if (isEdit) {
        // message_rendered is HTML.
        const msgPath =
          typeof argRec.message_path === 'string' ? argRec.message_path : 'data.message';
        const mk = msgPath.startsWith('data.') ? msgPath.slice(5) : msgPath;
        const rawMsg = itemRec ? (itemRec as Record<string, unknown>)[mk] : undefined;
        openCommentPanel({
          feedId: postId,
          endpoint,
          method,
          listEndpoint,
          bodyKey,
          messageKey,
          panelTitle,
          placeholder,
          sendLabel,
          edit: {
            commentId: primaryId,
            message: typeof rawMsg === 'string' ? rawMsg : '',
            parentBodyKey,
            toastMessage:
              typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Comment updated',
          },
        });
        return;
      }

      // The `data.` prefix is required: readDataPath returns undefined without it.
      const authorPath =
        typeof argRec.author_name_path === 'string'
          ? argRec.author_name_path
          : 'data.xprofile.display_name';
      const author = readDataPath(effectiveItem, authorPath);
      openCommentPanel({
        feedId: postId,
        endpoint,
        method,
        listEndpoint,
        bodyKey,
        messageKey,
        panelTitle,
        placeholder,
        sendLabel,
        replyTo: { id: parentId, name: typeof author === 'string' && author ? author : 'User' },
      });
      return;
    }

    case 'poll.vote': {
      // Patch meta.survey_config in place with the server's counts — no feed refetch.
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey = typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const voteKey = typeof argRec.vote_key === 'string' && argRec.vote_key ? argRec.vote_key : 'vote_indexes';
      const feedIdPath = typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      if (!endpoint) {
        onLoginError('poll.vote is missing its endpoint — set args.endpoint in the catalog.');
        return;
      }
      if (!auth) {
        requireAuthOrLogin();
        return;
      }
      const voteIndexesRaw =
        (itemRec ? (itemRec as Record<string, unknown>).vote_indexes : undefined) ??
        (isRecord(item) ? (item as Record<string, unknown>).vote_indexes : undefined);
      const voteIndexes = Array.isArray(voteIndexesRaw)
        ? voteIndexesRaw.filter((v): v is string => typeof v === 'string' && v.length > 0)
        : [];
      if (voteIndexes.length === 0) {
        onLoginError('Please pick an option before voting.');
        return;
      }
      const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const rawId = itemRec ? (itemRec as Record<string, unknown>)[key] : undefined;
      const feedId = typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && rawId !== '' && !Number.isNaN(Number(rawId))
          ? Number(rawId)
          : null;
      if (feedId === null) {
        onLoginError('Could not identify which post to vote on.');
        return;
      }
      const body: Record<string, unknown> = {
        [bodyKey]: feedId,
        [voteKey]: voteIndexes,
      };
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => null);
          const status = (json && typeof json === 'object' && 'response' in json)
            ? ((json as Record<string, unknown>).response as Record<string, unknown> | undefined)
            : undefined;
          const httpOk = res.ok;
          const bodyOk = !status || status.status === 200;
          if (!httpOk || !bodyOk) {
            const msg =
              (status && typeof status.message === 'string' && status.message) ||
              `Vote failed (HTTP ${res.status})`;
            onLoginError(msg);
            return;
          }
          const items = json && typeof json === 'object'
            ? (json as Record<string, unknown>).items
            : null;
          if (isRecord(items) && itemRec && isRecord((itemRec as Record<string, unknown>).meta)) {
            const meta = (itemRec as Record<string, unknown>).meta as Record<string, unknown>;
            meta.survey_config = items;
          }
        } catch (err) {
          onLoginError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'picker.emoji': {
      const appzet = typeof argRec.form_appzet_slug === 'string'
        ? argRec.form_appzet_slug : 'fc-post-information';
      const targetPath = typeof argRec.target_path === 'string'
        ? argRec.target_path : 'children[3]';
      const emoji = window.prompt('Enter an emoji (or paste any character):') ?? '';
      if (emoji) appendToTextarea(appzet, targetPath, emoji);
      return;
    }

    case 'link.attach': {
      // FC's message_rendered auto-linkifies bare URLs.
      const appzet = typeof argRec.form_appzet_slug === 'string'
        ? argRec.form_appzet_slug : 'fc-post-information';
      const targetPath = typeof argRec.target_path === 'string'
        ? argRec.target_path : 'children[3]';
      const url = window.prompt('Paste a link URL:') ?? '';
      if (url && /^https?:\/\//i.test(url.trim())) {
        appendToTextarea(appzet, targetPath, ' ' + url.trim() + ' ');
      } else if (url) {
        onLoginError('Please enter a full URL starting with http:// or https://');
      }
      return;
    }

    case 'picker.space': {
      if (!auth) {
        onLoginError('Please sign in to choose where to post.');
        return;
      }
      const dsSlug =
        typeof argRec.data_source === 'string' && argRec.data_source
          ? argRec.data_source
          : 'fc-post-space-picker';
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : 'fc-post-space-sheet';
      // One action for create and move: an action no child names never reaches the phone's snapshot. Move reads its own DS — FC refuses a move into a space the post's author isn't in.
      const moving = argRec.mode === 'move';
      const moveDsSlug =
        typeof argRec.move_data_source === 'string' && argRec.move_data_source
          ? argRec.move_data_source
          : 'fc-post-move-space-picker';
      const movingFeedId = getPostDraft().edit_feed_id;
      if (moving && movingFeedId === null) {
        onLoginError('Could not identify which post to move.');
        return;
      }
      void (async () => {
        const payload = moving
          ? await fetchPostSpacePayload(moveDsSlug, { params: { feed_id: movingFeedId } })
          : await fetchPostSpacePayload(dsSlug);
        // Moderator verdict comes only from the create payload; a move's is about the post.
        if (!moving) setPostDraft({ viewer_is_moderator: payload.viewerIsModerator });
        openPostSpaceSheet({
          appzetSlug: sheetSlug,
          presentation: postSpaceSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
          childStyles: childStylesFromCustomizations(
            sheetSlug,
            POST_SPACE_SHEET_CHILD_COUNT,
            currentCustomizations,
          ),
          groups: payload.groups,
          globalPostsEnabled: moving
            ? payload.canMoveToProfile
            : getFcRuntimeSettings().composer.global_posts_enabled,
          viewerIsModerator: payload.viewerIsModerator,
          mode: moving ? 'move' : 'destination',
          // FC says "On author's profile" when the viewer isn't the author; only the payload knows.
          profileLabel: moving ? payload.profileLabel : undefined,
        });
      })();
      return;
    }

    case 'picker.image': {
      console.log('[appza/picker.image] dispatched', { hasAuth: !!auth });
      if (!auth) {
        onLoginError('Please sign in to attach images.');
        return;
      }
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      if (!endpoint) {
        onLoginError('picker.image is missing its endpoint — set args.endpoint in the catalog.');
        return;
      }
      deps.openImagePicker({ endpoint, method });
      return;
    }

    case 'picker.video': {
      if (!auth) {
        onLoginError('Please sign in to attach a video.');
        return;
      }
      const oembedEndpoint =
        typeof argRec.endpoint === 'string' && argRec.endpoint
          ? argRec.endpoint
          : '/wp-json/fcom-mobile/api/v1/feeds/oembed';
      const uploadEndpoint =
        typeof argRec.upload_endpoint === 'string' && argRec.upload_endpoint
          ? argRec.upload_endpoint
          : '/wp-json/fcom-mobile/api/v1/fluent-player/video-upload';
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : 'fc-post-video-sheet';
      const player = getFcRuntimeSettings().composer.fluent_player;
      void (async () => {
        // A viewer question: per-request payload, not the cached bootstrap.
        const dsSlug =
          typeof readAppzetActionsFromCatalog('fc-post-information')?.on_tap_space?.args
            ?.data_source === 'string'
            ? (readAppzetActionsFromCatalog('fc-post-information')!.on_tap_space!.args!
                .data_source as string)
            : 'fc-post-space-picker';
        const payload = await fetchPostSpacePayload(dsSlug);
        openVideoSheet({
          appzetSlug: sheetSlug,
          presentation: videoSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
          childStyles: childStylesFromCustomizations(
            sheetSlug,
            VIDEO_SHEET_CHILD_COUNT,
            currentCustomizations,
          ),
          canUpload: player.enabled && player.video_upload_enabled && payload.canUploadVideo,
          embedEnabled: getFcRuntimeSettings().composer.video_embed_enabled,
          onLookup: (u: string) =>
            lookupVideoOembed(u, oembedEndpoint, auth ? basicAuthHeader(auth) : ''),
          onUpload: (file: File) =>
            uploadDraftVideo(file, uploadEndpoint, auth ? basicAuthHeader(auth) : ''),
        });
      })();
      return;
    }

    case 'picker.audio': {
      if (!auth) {
        onLoginError('Please sign in to attach audio.');
        return;
      }
      const player = getFcRuntimeSettings().composer.fluent_player;
      if (!player.enabled || !player.audio_upload_enabled) {
        onLoginError('Audio posts are turned off for this community.');
        return;
      }
      const audioEndpoint =
        typeof argRec.endpoint === 'string' && argRec.endpoint
          ? argRec.endpoint
          : '/wp-json/fcom-mobile/api/v1/fluent-player/video-upload';
      deps.openAudioPicker(audioEndpoint);
      return;
    }

    case 'picker.poll': {
      if (!auth) {
        onLoginError('Please sign in to create a poll.');
        return;
      }
      openPollSheetFromCatalog(
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : 'fc-post-poll-sheet',
      );
      return;
    }

    case 'picker.file': {
      if (!auth) {
        onLoginError('Please sign in to attach a file.');
        return;
      }
      if (!getPostDraft().space_slug) {
        onLoginError('Choose a space before attaching a file.');
        return;
      }
      deps.openDocumentPicker({
        upload:
          typeof argRec.endpoint === 'string' && argRec.endpoint
            ? argRec.endpoint
            : '/wp-json/fcom-mobile/api/v1/spaces/documents/upload',
        rename:
          typeof argRec.rename_endpoint === 'string' && argRec.rename_endpoint
            ? argRec.rename_endpoint
            : '/wp-json/fcom-mobile/api/v1/documents/update',
        remove:
          typeof argRec.delete_endpoint === 'string' && argRec.delete_endpoint
            ? argRec.delete_endpoint
            : '/wp-json/fcom-mobile/api/v1/documents/delete',
        accept: typeof argRec.accept === 'string' ? argRec.accept : '',
      });
      return;
    }

    case 'feed.set_sort':
    case 'feed.set_view_mode': {
      const isSort = inv.action_slug === 'feed.set_sort';
      const catalogRows = readPickerOptions(argRec.options);
      // Sort rows come from the site (FC executes them); layout rows are ours.
      const options = isSort
        ? resolveFeedSortRows(catalogRows, getViewer().is_logged_in)
        : catalogRows;
      // Silent: the simulator's only message slot belongs to the login screen.
      if (options.length === 0) return;
      const stateKey = isSort ? 'sort' : 'viewMode';
      const current = isSort ? getFeedControls().sort : getFeedControls().viewMode;
      if (argRec.presentation === 'sheet') {
        const sheetSlug =
          typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
            ? argRec.sheet_appzet_slug
            : isSort
              ? 'fc-feed-sort-sheet'
              : 'fc-feed-layout-sheet';
        openOptionsSheet({
          appzetSlug: sheetSlug,
          presentation: optionsSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
          childStyles: childStylesFromCustomizations(
            sheetSlug,
            OPTIONS_SHEET_CHILD_COUNT,
            currentCustomizations,
          ),
          options,
          stateKey,
          currentValue: current,
        });
        return;
      }
      const anchor = document.querySelector(
        `[data-appza-appzet-slug="fc-feed-toolbar"][data-child-index="${isSort ? 0 : 1}"]`,
      );
      openViewModePopover(options, anchor, stateKey);
      return;
    }

    // Two writers, not a toggle, so a double tap can't desync the clamp and the buttons.
    case 'banner.set_expanded': {
      const value = typeof argRec.value === 'string' ? argRec.value : '';
      if (value !== 'yes' && value !== 'no') return;
      setBannerControls({ expanded: value === 'yes' });
      return;
    }

    case 'banner.dismiss': {
      const days =
        typeof argRec.dismiss_days === 'number' && Number.isFinite(argRec.dismiss_days)
          ? argRec.dismiss_days
          : DEFAULT_DISMISS_DAYS;
      dismissBanner(days);
      return;
    }

    case 'bookmarks.set_sort':
    case 'bookmarks.set_view_mode': {
      const isSort = inv.action_slug === 'bookmarks.set_sort';
      const options = readPickerOptions(argRec.options);
      if (options.length === 0) return;
      const stateKey = isSort ? 'bookmarks_sort' : 'bookmarks_view_mode';
      const current = isSort ? getBookmarkControls().sort : getBookmarkControls().viewMode;
      if (argRec.presentation === 'sheet') {
        const sheetSlug =
          typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
            ? argRec.sheet_appzet_slug
            : isSort
              ? 'fc-bookmarks-sort-sheet'
              : 'fc-bookmarks-layout-sheet';
        openOptionsSheet({
          appzetSlug: sheetSlug,
          presentation: optionsSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
          childStyles: childStylesFromCustomizations(
            sheetSlug,
            OPTIONS_SHEET_CHILD_COUNT,
            currentCustomizations,
          ),
          options,
          stateKey,
          currentValue: current,
        });
        return;
      }
      const anchor = document.querySelector(
        `[data-appza-appzet-slug="fc-bookmarks-toolbar"][data-child-index="${isSort ? 0 : 1}"]`,
      );
      openViewModePopover(options, anchor, stateKey);
      return;
    }

    case 'bookmarks.set_search': {
      // Debounced: fc-bookmarks binds `search`, so each write refetches; the ⨯ clear applies immediately.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      debounceSearch('bookmarks', runtimeValue ?? itemValue ?? '', (search) =>
        setBookmarkControls({ search }),
      );
      return;
    }

    case 'search.set_tab': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      // Closed set: the value feeds placement gates directly, so a typo would mount no result card.
      if (picked === 'posts' || picked === 'members' || picked === 'spaces') {
        setSearchControls({ tab: picked });
      } else {
        console.warn('[appza] search.set_tab: unrecognised tab value', { picked });
      }
      return;
    }

    case 'search.set_post_scope': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      // FC doesn't reject an unknown `search_in`, it just matches nothing.
      if (picked === 'post_content' || picked === 'post_comments') {
        setSearchControls({ post_scope: picked });
      } else {
        console.warn('[appza] search.set_post_scope: unrecognised scope value', { picked });
      }
      return;
    }

    case 'search.set_query': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const value = runtimeValue ?? itemValue ?? '';
      // A recent row applies immediately and cancels any pending keystroke, which would otherwise overwrite it.
      if (argRec.immediate === true) {
        cancelDebouncedSearch('search');
        setSearchControls({ query: value });
        // The field is uncontrolled, so writing the slice doesn't show the term.
        setPrimitiveInputValue('fc-search-field', 'children[1]', value);
        recordRecentSearch(value);
        return;
      }
      // Debounced: three DSs bind `query`, so each keystroke would be a racing refetch. Record on the settled value, not per keystroke.
      debounceSearch('search', value, (query) => {
        setSearchControls({ query });
        recordRecentSearch(query);
      });
      return;
    }

    case 'search.remove_recent': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const term = runtimeValue ?? itemValue ?? '';
      if (!term) {
        console.warn('[appza] search.remove_recent: no term on the tapped row', { item });
        return;
      }
      removeRecentSearch(term);
      return;
    }

    case 'search.clear_recents': {
      clearRecentSearches();
      return;
    }

    case 'spaces.set_tab': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      if (picked && typeof picked === 'string') {
        setSpacesControls({ tab: picked });
      } else {
        console.warn('[appza-admin/app-mode] spaces.set_tab: no picked value', {
          argRec,
          item,
        });
      }
      return;
    }

    case 'spaces.set_search': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const value = runtimeValue ?? itemValue ?? '';
      // Not debounced: the spaces list filters client-side.
      setSpacesControls({ search: value });
      return;
    }

    case 'spaces.set_sort': {
      const rawOptions = Array.isArray(argRec.options) ? argRec.options : [];
      const options: ViewModeOption[] = rawOptions
        .filter((o): o is Record<string, unknown> => isRecord(o))
        .map((o) => ({
          value: typeof o.value === 'string' ? o.value : '',
          label: typeof o.label === 'string' ? o.label : '',
          icon: typeof o.icon === 'string' ? o.icon : undefined,
        }))
        .filter((o) => o.value && o.label);
      const anchor = document.querySelector(
        '[data-appza-appzet-slug="fc-spaces-toolbar"][data-child-index="1"]',
      );
      openViewModePopover(options, anchor, 'spaces_sort');
      return;
    }

    case 'profile.set_tab': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      if (picked) {
        setProfileControls({ tab: picked });
      } else {
        console.warn('[appza] profile.set_tab: no picked value', { argRec, item });
      }
      return;
    }

    case 'profile.set_follow_view': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      if (picked) {
        // Switching lists clears the search, or it silently narrows the other list.
        setProfileControls({ follow_view: picked, follow_search: '' });
      } else {
        console.warn('[appza] profile.set_follow_view: no picked value', { argRec, item });
      }
      return;
    }

    case 'profile.set_follow_search': {
      // Debounced: both follow DSs bind it; Ionic's ⨯ fires ''.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      debounceSearch('follow', runtimeValue ?? itemValue ?? '', (follow_search) =>
        setProfileControls({ follow_search }),
      );
      return;
    }

    case 'profile.set_follow_sort': {
      const options = readPickerOptions(argRec.options);
      // Silent: the simulator's only message slot belongs to the login screen.
      if (options.length === 0) return;
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : 'fc-follow-sort-sheet';
      openOptionsSheet({
        appzetSlug: sheetSlug,
        presentation: optionsSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
        childStyles: childStylesFromCustomizations(
          sheetSlug,
          OPTIONS_SHEET_CHILD_COUNT,
          currentCustomizations,
        ),
        options,
        stateKey: 'profile_follow_sort',
        currentValue: getProfileControls().follow_sort,
      });
      return;
    }

    case 'profile.open_follows': {
      // The tapped count decides which tab the sheet opens on.
      const view =
        argRec.view === 'followers' || argRec.view === 'blocked'
          ? (argRec.view as FollowView)
          : 'followings';
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : FOLLOW_SHEET_APPZET_SLUG;
      const dsFor = (key: string, fallback: string): string =>
        typeof argRec[key] === 'string' && argRec[key] ? (argRec[key] as string) : fallback;

      setProfileControls({ follow_view: view, follow_search: '' });
      openFollowSheet({
        appzetSlug: sheetSlug,
        presentation: followSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
        childStyles: childStylesFromCustomizations(
          sheetSlug,
          FOLLOW_SHEET_CHILD_COUNT,
          currentCustomizations,
        ),
        memberId: getProfileControls().member_id ?? null,
        view,
        dataSources: {
          followings: dsFor('followings_data_source', 'fc-member-followings'),
          followers: dsFor('followers_data_source', 'fc-member-followers'),
          blocked: dsFor('blocked_data_source', 'fc-blocked-users'),
        },
        // Delegated to the nav push, which carries route params and screen context.
        onOpenProfile: (row) => {
          closeFollowSheet();
          handleAppModeAction(
            {
              ...inv,
              action_slug: 'nav.push',
              args: { target_screen_slug: 'profile-page-details', pass_item_as_context: true },
              item: row,
            },
            deps,
          );
        },
        onUnblock: (row) => {
          handleAppModeAction(
            {
              ...inv,
              action_slug: 'profile.unblock',
              args: {
                endpoint: '/wp-json/fcom-mobile/api/v1/members/unblock',
                method: 'POST',
                body_key: 'member_id',
                member_id_path: 'data.user_id',
                toast_message: 'Unblocked',
                refetch_data_source: 'fc-blocked-users',
              },
              item: row,
            },
            deps,
          );
        },
      });
      return;
    }

    case 'space_detail.set_subtab': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      if (picked) {
        setSpaceDetailControls({ active_subtab: picked });
      } else {
        console.warn('[appza-admin/app-mode] space_detail.set_subtab: no picked value', {
          argRec,
          item,
        });
      }
      return;
    }

    case 'space_detail.set_topic': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      setSpaceDetailControls({ topic_slug: picked });
      return;
    }

    case 'space_detail.set_sort': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      if (runtimeValue) {
        setSpaceDetailControls({ sort: runtimeValue });
        return;
      }
      const rawOptions = Array.isArray(argRec.options) ? argRec.options : [];
      const options: ViewModeOption[] = rawOptions
        .filter((o): o is Record<string, unknown> => isRecord(o))
        .map((o) => ({
          value: typeof o.value === 'string' ? o.value : '',
          label: typeof o.label === 'string' ? o.label : '',
          icon: typeof o.icon === 'string' ? o.icon : undefined,
        }))
        .filter((o) => o.value && o.label);
      const anchor = document.querySelector(
        '[data-appza-appzet-slug="fc-space-post-toolbar"][data-child-index="1"]',
      );
      openViewModePopover(options, anchor, 'space_detail_sort');
      return;
    }

    case 'documents.set_search': {
      // Debounced: fc-space-documents binds `search`; Ionic's ⨯ fires ''.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      debounceSearch('documents', runtimeValue ?? itemValue ?? '', (documents_search) =>
        setSpaceDetailControls({ documents_search }),
      );
      return;
    }

    case 'documents.set_draft': {
      const field = typeof argRec.field === 'string' ? argRec.field : '';
      if (!field) {
        console.warn('[appza-admin/app-mode] documents.set_draft: no field');
        return;
      }
      const raw = argRec.value !== undefined ? argRec.value : itemRec?.value;
      if (field === 'publish') {
        setDocumentDraft({ publish: raw === true || raw === 'true' });
      } else if (field === 'title' || field === 'message' || field === 'scheduled_at') {
        setDocumentDraft({ [field]: typeof raw === 'string' ? raw : '' });
      } else {
        console.warn(`[appza-admin/app-mode] documents.set_draft: unknown field ${field}`);
      }
      return;
    }

    case 'documents.toggle_topic': {
      const raw = argRec.value !== undefined ? argRec.value : itemRec?.value;
      const id = Number.parseInt(String(raw ?? ''), 10);
      if (Number.isFinite(id)) toggleDraftTopic(id);
      return;
    }

    case 'documents.cancel_add': {
      resetDocumentDraft('');
      setScreenStack((prev) => {
        if (prev.length === 0) return prev;
        const rest = prev.slice(0, -1);
        setSelectedScreenId(prev[prev.length - 1] ?? null);
        return rest;
      });
      return;
    }

    case 'picker.schedule': {
      if (!auth) {
        onLoginError('Please sign in to schedule a post.');
        return;
      }
      // FC would silently discard a schedule from a non-moderator.
      const d = getPostDraft();
      if (!d.viewer_is_moderator && !d.space_can_announce) {
        onLoginError('Only moderators can schedule a post.');
        return;
      }
      openScheduleSheetFromCatalog(
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : SCHEDULE_SHEET_APPZET_SLUG,
      );
      return;
    }

    case 'documents.open_schedule': {
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string'
          ? argRec.sheet_appzet_slug
          : SCHEDULE_SHEET_APPZET_SLUG;
      openScheduleSheet({
        appzetSlug: sheetSlug,
        value: getDocumentDraft().scheduled_at,
        presentation: schedulePresentation(readAppzetPropsFromCatalog(sheetSlug)),
        childStyles: childStylesFromCustomizations(
          sheetSlug,
          SCHEDULE_SHEET_CHILD_COUNT,
          currentCustomizations,
        ),
        onConfirm: (value) => setDocumentDraft({ scheduled_at: value }),
      });
      return;
    }

    case 'leaderboard.set_range': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      if (picked) {
        setLeaderboardControls({ range: picked });
      } else {
        console.warn('[appza-admin] leaderboard.set_range: no picked value', { argRec, item });
      }
      return;
    }

    case 'leaderboard.expand_levels': {
      // Fixed value: VIEW ALL is one-way.
      const value = typeof argRec.value === 'string' && argRec.value !== '' ? argRec.value : 'all';
      setLeaderboardControls({ levels_scope: value });
      return;
    }

    case 'leaderboard.open_points': {
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string'
          ? argRec.sheet_appzet_slug
          : 'fc-leaderboard-points-sheet';
      const dsSlug =
        typeof argRec.levels_data_source === 'string'
          ? argRec.levels_data_source
          : 'fc-leaderboard-levels';
      // Opened by an action, so there's no useDataSource to resolve the endpoint.
      const levelsEndpoint = readDataSourceEndpointFromCatalog(catalog, dsSlug);
      if (!levelsEndpoint) {
        onLoginError(`No endpoint for the ${dsSlug} data source.`);
        return;
      }
      openLeaderboardPointsSheet({
        appzetSlug: sheetSlug,
        presentation: leaderboardPointsPresentation(readAppzetPropsFromCatalog(sheetSlug)),
        childStyles: childStylesFromCustomizations(
          sheetSlug,
          LEADERBOARD_POINTS_SHEET_CHILD_COUNT,
          currentCustomizations,
        ),
        levelsEndpoint,
        authHeader: auth ? basicAuthHeader(auth) : '',
      });
      return;
    }

    case 'media.set_type': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      if (picked) {
        setSpaceDetailControls({ media_type: picked });
      } else {
        console.warn('[appza-admin] media.set_type: no picked value', { argRec, item });
      }
      return;
    }

    case 'media.open': {
      const kind = itemRec && typeof itemRec.kind === 'string' ? itemRec.kind : '';
      if (kind === 'video' || kind === 'audio') {
        handleAppModeAction({ ...inv, action_slug: 'media.open_post' }, deps);
        return;
      }
      const viewerSlug =
        typeof argRec.viewer_appzet_slug === 'string'
          ? argRec.viewer_appzet_slug
          : MEDIA_VIEWER_APPZET_SLUG;
      const photos = (Array.isArray(siblings) ? siblings : [item])
        .filter(isRecord)
        .filter((row) => row.kind !== 'video' && row.kind !== 'audio')
        .map((row) => ({
          url: typeof row.url === 'string' ? row.url : '',
          title: typeof row.title === 'string' ? row.title : undefined,
          feed_slug: typeof row.feed_slug === 'string' ? row.feed_slug : undefined,
          feed_id:
            typeof row.feed_id === 'number' || typeof row.feed_id === 'string'
              ? (row.feed_id as number | string)
              : undefined,
        }))
        .filter((row) => row.url !== '');
      if (photos.length === 0) return;
      const tappedUrl = itemRec && typeof itemRec.url === 'string' ? itemRec.url : '';
      const startAt = photos.findIndex((row) => row.url === tappedUrl);
      openMediaViewer({
        appzetSlug: viewerSlug,
        items: photos,
        index: startAt >= 0 ? startAt : (typeof siblingIndex === 'number' ? siblingIndex : 0),
        presentation: mediaViewerPresentation(readAppzetPropsFromCatalog(viewerSlug)),
        childStyles: childStylesFromCustomizations(
          viewerSlug,
          MEDIA_VIEWER_CHILD_COUNT,
          currentCustomizations,
        ),
        onDownload: (media) =>
          handleAppModeAction(
            { action_slug: 'media.download', args: argRec, item: media },
            deps,
          ),
        onViewPost: (media) =>
          handleAppModeAction(
            { action_slug: 'media.open_post', args: argRec, item: media },
            deps,
          ),
      });
      return;
    }

    // One slug: the thread `type` decides sheet vs card, so the catalog needn't know.
    case 'chat.thread_menu': {
      const thread = isRecord(effectiveItem) ? effectiveItem : {};
      const type = typeof thread.type === 'string' ? thread.type : 'user';

      if (type === 'user') {
        const cardSlug =
          typeof argRec.card_appzet_slug === 'string'
            ? argRec.card_appzet_slug
            : 'fc-chat-user-card';
        const presentation = chatUserCardPresentation(readAppzetPropsFromCatalog(cardSlug));
        openChatUserCard({
          appzetSlug: cardSlug,
          thread,
          presentation,
          childStyles: childStylesFromCustomizations(
            cardSlug,
            CHAT_USER_CARD_CHILD_COUNT,
            currentCustomizations,
          ),
          onBlock: (t) => handleAppModeAction({
              action_slug: 'chat.block_confirm',
              // The confirm's copy lives on its own action; the menu's args would give an empty bag.
              args: readActionDefaultsFromCatalog('chat.block_confirm') ?? undefined,
              item: t,
            }, deps),
          onDelete: (t) =>
            handleAppModeAction({
              action_slug: 'chat.delete_conversation_confirm',
              args: readActionDefaultsFromCatalog('chat.delete_conversation_confirm') ?? undefined,
              item: t,
            }, deps),
          onCopy: (handle) => {
            if (handle && navigator.clipboard) {
              void navigator.clipboard.writeText(handle);
              onMenuInfo(presentation.copiedToast);
            }
          },
        });
        return;
      }

      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string'
          ? argRec.sheet_appzet_slug
          : 'fc-chat-members-sheet';
      const dsSlug =
        typeof argRec.members_data_source === 'string'
          ? argRec.members_data_source
          : 'fc-chat-members';
      // Opened by an action, so there's no useDataSource to resolve the endpoint.
      const membersEndpoint = readDataSourceEndpointFromCatalog(catalog, dsSlug);
      if (!membersEndpoint) {
        onLoginError(`No endpoint for the ${dsSlug} data source.`);
        return;
      }
      openChatMembersSheet({
        appzetSlug: sheetSlug,
        thread,
        presentation: chatMembersPresentation(readAppzetPropsFromCatalog(sheetSlug)),
        childStyles: childStylesFromCustomizations(
          sheetSlug,
          CHAT_MEMBERS_SHEET_CHILD_COUNT,
          currentCustomizations,
        ),
        listEndpoint: (membersEndpoint),
        authHeader: (auth ? basicAuthHeader(auth) : ''),
        onViewCommunity: (t) => handleAppModeAction({
          action_slug: 'chat.view_community',
          args: readActionDefaultsFromCatalog('chat.view_community') ?? undefined,
          item: t,
        }, deps),
        onLeave: (t) => handleAppModeAction({
          action_slug: 'chat.leave_confirm',
          args: readActionDefaultsFromCatalog('chat.leave_confirm') ?? undefined,
          item: t,
        }, deps),
      });
      return;
    }

    case 'chat.view_community': {
      const slugPath =
        typeof argRec.space_slug_path === 'string' ? argRec.space_slug_path : 'space_slug';
      const spaceSlug = itemRec ? readDataPath(itemRec, `data.${slugPath}`) : undefined;
      if (typeof spaceSlug !== 'string' || spaceSlug === '') {
        onLoginError('This conversation is not attached to a community.');
        return;
      }
      const targetSlug =
        typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : 'space-detail';
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        onLoginError('The community screen is not in this template.');
        return;
      }
      closeChatMembersSheet();
      // Route slug and controls slice must agree, or the screen re-seeds onto another space.
      setSpaceDetailControls({ space_slug: spaceSlug, active_subtab: 'posts' });
      setRouteParams({ ...getRouteParams(), slug: spaceSlug });
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    case 'chat.leave_confirm':
    case 'chat.block_confirm':
    case 'chat.delete_conversation_confirm': {
      const thread = isRecord(effectiveItem) ? effectiveItem : {};
      const isBlocked = thread.is_blocked === true;
      const leaveDefaults = {
        title: 'Leave group?',
        message: "You'll stop receiving message from this group.",
        confirm: 'Leave',
        busy: 'Leaving…',
        next: 'chat.leave',
      };
      const defaults: Record<string, typeof leaveDefaults> = {
        'chat.leave_confirm': leaveDefaults,
        'chat.block_confirm': {
          title: isBlocked ? 'Unblock user?' : 'Block user?',
          message: isBlocked
            ? 'They will be able to message you again.'
            : "They won't be able to message you. You'll stay in this chat and can unblock the anytime.",
          confirm: isBlocked ? 'Unblock' : 'Block',
          busy: isBlocked ? 'Unblocking…' : 'Blocking…',
          next: 'chat.block',
        },
        'chat.delete_conversation_confirm': {
          title: 'Delete conversation?',
          message:
            'Every message will be deleted for both of you, and the conversation will be removed from both chat lists. This cannot be undone.',
          confirm: 'Delete',
          busy: 'Deleting…',
          next: 'chat.delete_conversation',
        },
      };
      const d = defaults[inv.action_slug] ?? leaveDefaults;
      const nextSlugKey =
        inv.action_slug === 'chat.leave_confirm'
          ? 'leave_action_slug'
          : inv.action_slug === 'chat.block_confirm'
            ? 'block_action_slug'
            : 'delete_action_slug';
      openMemberRemoveConfirm({
        subject: typeof argRec.title === 'string' ? argRec.title : d.title,
        message: typeof argRec.message === 'string' ? argRec.message : d.message,
        cancelLabel: typeof argRec.cancel_label === 'string' ? argRec.cancel_label : 'Cancel',
        confirmLabel: typeof argRec.confirm_label === 'string' ? argRec.confirm_label : d.confirm,
        busyLabel: typeof argRec.busy_label === 'string' ? argRec.busy_label : d.busy,
        actionsLayout: 'row',
        item: thread,
        removeActionSlug:
          typeof argRec[nextSlugKey] === 'string' ? (argRec[nextSlugKey] as string) : d.next,
      });
      return;
    }

    case 'chat.leave':
    case 'chat.block':
    case 'chat.delete_conversation': {
      const thread = isRecord(effectiveItem) ? effectiveItem : {};
      const threadId = Number(thread.id ?? 0);
      const isBlocked = thread.is_blocked === true;
      // FC flips the thread status and the blocker's membership, so the same pair undoes it.
      const endpoint =
        inv.action_slug === 'chat.block' && isBlocked
          ? (typeof argRec.unblock_endpoint === 'string' ? argRec.unblock_endpoint : null)
          : (typeof argRec.endpoint === 'string' ? argRec.endpoint : null);
      const toast =
        inv.action_slug === 'chat.block' && isBlocked
          ? (typeof argRec.unblock_toast_message === 'string' ? argRec.unblock_toast_message : 'User unblocked')
          : (typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Done');
      if (!endpoint || !Number.isFinite(threadId) || threadId <= 0) {
        onLoginError('That conversation could not be identified.');
        closeMemberRemoveConfirm();
        return;
      }
      if (!auth) {
        onLoginError('Please sign in first.');
        closeMemberRemoveConfirm();
        return;
      }
      const leavesScreen =
        inv.action_slug === 'chat.leave' || inv.action_slug === 'chat.delete_conversation';
      void (async () => {
        try {
          const res = await fetch((endpoint), {
            method: typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST',
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: (auth ? basicAuthHeader(auth) : ''),
            },
            body: JSON.stringify({ thread_id: threadId }),
          });
          const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
          const inner =
            json && typeof json === 'object' && 'response' in json
              ? (json.response as Record<string, unknown> | undefined)
              : undefined;
          const innerStatus = inner && typeof inner.status === 'number' ? inner.status : null;
          const ok = innerStatus !== null ? innerStatus === 200 : res.ok;
          if (!ok) {
            const msg =
              (inner && typeof inner.message === 'string' && inner.message) || `HTTP ${res.status}`;
            onLoginError(msg);
            return;
          }
          onMenuInfo(toast);
          closeChatMembersSheet();
          closeChatUserCard();
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(
            new CustomEvent('appza:refresh-data', {
              detail: {
                data_source:
                  typeof argRec.refetch_data_source === 'string'
                    ? argRec.refetch_data_source
                    : null,
              },
            }),
          );
          if (leavesScreen) {
            // No chat list screen yet, so pop back to whatever pushed the conversation.
            setScreenStack((prev) => {
              const next = [...prev];
              const back = next.pop();
              if (back != null) setSelectedScreenId(back);
              return next;
            });
          }
        } catch (err) {
          onLoginError(err instanceof Error ? err.message : String(err));
        } finally {
          closeMemberRemoveConfirm();
        }
      })();
      return;
    }

    case 'chat.send': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (!endpoint) {
        onLoginError('chat.send is missing its endpoint.');
        return;
      }
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      void sendChatMessage({
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method : 'POST',
        authHeader: auth ? basicAuthHeader(auth) : '',
        createThreadEndpoint:
          typeof argRec.create_thread_endpoint === 'string' && argRec.create_thread_endpoint
            ? argRec.create_thread_endpoint
            : '/wp-json/fcom-mobile/api/v1/chat/threads/create',
        // Adopt the new thread id into the slice and the route bag, and drop the intent so the next send isn't a second create.
        onThreadCreated: (threadId: number) => {
          setRouteParams({ thread_id: threadId });
          setChatControls({ thread_id: String(threadId), intent_user_id: '', can_send: 'yes' });
        },
        onError: onLoginError,
        onSuccess: () => {
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(
            new CustomEvent('appza:refresh-data', { detail: { data_source: refetchDs } }),
          );
        },
      });
      return;
    }

    case 'chat.delete_message': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (!endpoint) {
        onLoginError('chat.delete_message is missing its endpoint.');
        return;
      }
      const messageId = itemRec ? readDataPath(itemRec, 'data.id') : undefined;
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      void deleteChatMessage(typeof messageId === 'string' || typeof messageId === 'number' ? messageId : '', {
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method : 'POST',
        authHeader: auth ? basicAuthHeader(auth) : '',
        toast: typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Message deleted',
        onError: onLoginError,
        onInfo: onMenuInfo,
        onSuccess: () => {
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(
            new CustomEvent('appza:refresh-data', { detail: { data_source: refetchDs } }),
          );
        },
      });
      return;
    }

    case 'chat.discard_attachment': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const url = itemRec ? readDataPath(itemRec, 'data.url') : undefined;
      if (!endpoint || typeof url !== 'string' || url === '') {
        setChatControls({
          attachments: getChatControls().attachments.filter((u) => u !== url),
        });
        return;
      }
      void discardChatAttachment(url, {
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method : 'POST',
        authHeader: auth ? basicAuthHeader(auth) : '',
        onError: onLoginError,
      });
      return;
    }

    case 'chat.attach_image': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (!endpoint) {
        onLoginError('chat.attach_image is missing its endpoint.');
        return;
      }
      pickAndUploadChatImage({
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method : 'POST',
        accept: typeof argRec.accept === 'string' ? argRec.accept : 'image/*',
        authHeader: auth ? basicAuthHeader(auth) : '',
        onError: onLoginError,
      });
      return;
    }

    // A swipe writes the slice itself; this case keeps the gesture repointable.
    case 'chat.reply_start': {
      if (!itemRec) return;
      const id = readDataPath(itemRec, 'data.id');
      if (id === undefined || id === null || id === '') return;
      const name = readDataPath(itemRec, 'data.author_name');
      const body = readDataPath(itemRec, 'data.message_rendered');
      setChatControls({
        reply_to_id: String(id),
        reply_to_name: typeof name === 'string' ? name : '',
        reply_to_text:
          typeof body === 'string' ? body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '',
      });
      return;
    }

    case 'chat.reply_cancel': {
      setChatControls({ reply_to_id: '', reply_to_name: '', reply_to_text: '' });
      return;
    }

    case 'chat.open': {
      // thread_id and space_slug are alternatives; both DSs bind both.
      const targetSlug =
        typeof argRec.target_screen_slug === 'string'
          ? argRec.target_screen_slug
          : 'chat-page-details';
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        console.warn('[appza-plugin-admin] chat.open: target not in catalog', targetSlug);
        return;
      }

      const threadPath =
        typeof argRec.thread_id_path === 'string' ? argRec.thread_id_path : 'thread_id';
      const slugPath =
        typeof argRec.space_slug_path === 'string' ? argRec.space_slug_path : 'space_slug';
      const rawThread = itemRec ? readDataPath(itemRec, `data.${threadPath}`) : undefined;
      const rawSlug = itemRec ? readDataPath(itemRec, `data.${slugPath}`) : undefined;

      const threadId =
        typeof rawThread === 'number' || (typeof rawThread === 'string' && rawThread !== '')
          ? String(rawThread)
          : '';
      let spaceSlug = typeof rawSlug === 'string' ? rawSlug : '';
      // Slice fallback is the default: shells get `args` verbatim, so a per-entry override carries only a slug.
      const slugSource =
        typeof argRec.space_slug_source === 'string'
          ? argRec.space_slug_source
          : 'space_detail_controls';
      if (spaceSlug === '' && slugSource === 'space_detail_controls') {
        spaceSlug = getSpaceDetailControls().space_slug ?? '';
      }
      if (threadId === '' && spaceSlug === '') {
        console.warn('[appza-plugin-admin] chat.open: neither a thread id nor a space slug', item);
        return;
      }

      setChatControls({ thread_id: threadId, space_slug: spaceSlug });
      // Merge: space-detail's own `slug` must survive, or returning re-seeds it.
      setRouteParams({
        ...getRouteParams(),
        thread_id: threadId,
        space_slug: spaceSlug,
      });

      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    case 'chat.open_dm': {
      // FC can't create an empty one-to-one thread, so this carries an intent; the send handler creates it with the first message.
      const targetSlug =
        typeof argRec.target_screen_slug === 'string'
          ? argRec.target_screen_slug
          : 'chat-page-details';
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        console.warn('[appza] chat.open_dm: target not in catalog', targetSlug);
        return;
      }
      const memberPath =
        typeof argRec.member_id_path === 'string' ? argRec.member_id_path : 'data.user_id';
      const rawMember = readDataPath(effectiveItem, memberPath);
      const memberId =
        typeof rawMember === 'number' || (typeof rawMember === 'string' && rawMember !== '')
          ? String(rawMember)
          : '';
      if (memberId === '') {
        onLoginError('Could not identify who to message.');
        return;
      }

      // Clearing thread_id/space_slug makes this an intent, not a stale conversation.
      setChatControls({ thread_id: '', space_slug: '', intent_user_id: memberId });
      setRouteParams({
        ...getRouteParams(),
        thread_id: '',
        space_slug: '',
        intent_user_id: memberId,
      });

      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    case 'profile.remove_from_space_confirm':
    case 'profile.remove_from_space':
    case 'profile.delete_comment_confirm':
    case 'profile.delete_comment': {
      tryHandleProfileTabAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onLoginError,
        onInfo: onLoginError,
      });
      return;
    }

    case 'scheduled.reschedule':
    case 'scheduled.publish_confirm':
    case 'scheduled.publish':
    case 'scheduled.delete_confirm':
    case 'scheduled.delete': {
      tryHandleScheduledPostAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onLoginError,
        onInfo: onLoginError,
        openSchedule: (sheetSlug, value, onConfirm) =>
          openScheduleSheet({
            appzetSlug: sheetSlug,
            value,
            presentation: schedulePresentation(readAppzetPropsFromCatalog(sheetSlug)),
            childStyles: childStylesFromCustomizations(
              sheetSlug,
              SCHEDULE_SHEET_CHILD_COUNT,
              currentCustomizations,
            ),
            onConfirm,
          }),
      });
      return;
    }

    case 'chat.compose_dm': {
      openProfileNewMessage(argRec, effectiveItem, {
        auth,
        authHeader: basicAuthHeader,
        onError: onLoginError,
        onInfo: onLoginError,
        requireAuth: requireAuthOrLogin,
        readPath: (item, path) => readDataPath(item, path),
        modalProps: (slug) => readAppzetPropsFromCatalog(slug),
        modalChildStyles: (slug) =>
          childStylesFromCustomizations(slug, NEW_MESSAGE_MODAL_CHILD_COUNT, currentCustomizations),
      });
      return;
    }

    case 'profile.add_to_space': {
      openProfileAddToSpace(argRec, effectiveItem, {
        auth,
        authHeader: basicAuthHeader,
        onError: onLoginError,
        onInfo: onLoginError,
        requireAuth: requireAuthOrLogin,
        readPath: (item, path) => readDataPath(item, path),
        sheetProps: (slug) => readAppzetPropsFromCatalog(slug),
        sheetChildStyles: (slug) =>
          childStylesFromCustomizations(slug, OPTIONS_SHEET_CHILD_COUNT, currentCustomizations),
      });
      return;
    }

    case 'media.open_post': {
      const targetSlug =
        typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : 'post-detail';
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        console.warn('[appza-admin] media.open_post: target not in catalog', targetSlug);
        return;
      }
      const slugPath = typeof argRec.feed_slug_path === 'string' ? argRec.feed_slug_path : 'feed_slug';
      const idPath = typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'feed_id';
      const postSlug = itemRec ? readDataPath(itemRec, `data.${slugPath}`) : undefined;
      const postId = itemRec ? readDataPath(itemRec, `data.${idPath}`) : undefined;
      const routeBag: Record<string, unknown> = {};
      if (typeof postSlug === 'string' && postSlug) routeBag.post_slug = postSlug;
      if (typeof postId === 'number' || typeof postId === 'string') routeBag.id = postId;
      // Merge: dropping the space `slug` makes space-detail re-seed and reset the sub-tab on return.
      setRouteParams({ ...getRouteParams(), ...routeBag });
      screenContextRef.current[targetSlug] = {
        ...(isRecord(item) ? item : {}),
        slug: typeof postSlug === 'string' ? postSlug : undefined,
        id: postId,
      };
      delete screenPrefilledRef.current[targetSlug];
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    case 'media.download': {
      const urlPath = typeof argRec.url_path === 'string' ? argRec.url_path : 'url';
      const namePath =
        typeof argRec.filename_path === 'string' ? argRec.filename_path : 'title';
      const url = itemRec ? readDataPath(itemRec, `data.${urlPath}`) : undefined;
      if (typeof url !== 'string' || url === '') {
        console.warn('[appza-admin] media.download: no url on the item', item);
        return;
      }
      const name = itemRec ? readDataPath(itemRec, `data.${namePath}`) : undefined;
      // A real browser honours `download`, so save under the display name (a WebView ignores it).
      const a = document.createElement('a');
      a.href = url;
      a.download = typeof name === 'string' && name !== '' ? name : '';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    case 'documents.submit': {
      const uploadEndpoint =
        typeof argRec.upload_endpoint === 'string' ? argRec.upload_endpoint : '';
      const createEndpoint =
        typeof argRec.create_endpoint === 'string' ? argRec.create_endpoint : '';
      if (!uploadEndpoint || !createEndpoint) {
        console.warn('[appza-admin/app-mode] documents.submit: endpoints missing from the action');
        return;
      }
      if (!auth) {
        onLoginError('Please sign in to upload documents.');
        return;
      }
      void submitDocumentDraft({
        uploadEndpoint,
        createEndpoint,
        authHeader: basicAuthHeader(auth),
        onError: (message) => onLoginError(message),
        onSuccess: () => {
          resetDocumentDraft('');
          setScreenStack((prev) => {
            if (prev.length === 0) return prev;
            const rest = prev.slice(0, -1);
            setSelectedScreenId(prev[prev.length - 1] ?? null);
            return rest;
          });
          // Deferred double-dispatch: the documents list hasn't remounted when the nav commits.
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 150);
          setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 600);
        },
      });
      return;
    }

    case 'documents.open_add': {
      const targetSlug =
        typeof argRec.target_screen_slug === 'string'
          ? argRec.target_screen_slug
          : 'space-document-add';
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        console.warn(`[appza-admin/app-mode] documents.open_add: ${targetSlug} not in catalog`);
        return;
      }
      const rp = (window as unknown as { __appzaRouteParams?: Record<string, unknown> })
        .__appzaRouteParams;
      const spaceSlug = rp && typeof rp.slug === 'string' ? rp.slug : '';
      if (spaceSlug) {
        screenContextRef.current[targetSlug] = { slug: spaceSlug };
        delete screenPrefilledRef.current[targetSlug];
      }
      // Not persisted: the draft holds File handles.
      resetDocumentDraft(spaceSlug);
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    case 'space.compose_open': {
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === 'create-post-page',
      );
      if (!target) {
        console.warn('[appza-admin/app-mode] space.compose_open: create-post-page not in catalog');
        return;
      }
      let ctx: unknown = effectiveItem;
      if (ctx == null) {
        const rp = (window as unknown as { __appzaRouteParams?: Record<string, unknown> })
          .__appzaRouteParams;
        const spaceSlug = rp && typeof rp.slug === 'string' ? rp.slug : '';
        if (spaceSlug) ctx = { slug: spaceSlug };
      }
      if (ctx != null) {
        screenContextRef.current['create-post-page'] = ctx;
        delete screenPrefilledRef.current['create-post-page'];
      }
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    case 'post.open': {
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === 'post-detail',
      );
      if (!target) {
        console.warn('[appza-admin/app-mode] post.open: post-detail not in catalog');
        return;
      }
      if (effectiveItem != null) {
        screenContextRef.current['post-detail'] = effectiveItem;
        delete screenPrefilledRef.current['post-detail'];
        if (isRecord(effectiveItem)) {
          const ctx = effectiveItem as Record<string, unknown>;
          const routeBag: Record<string, unknown> = {};
          if (typeof ctx.slug === 'string' && ctx.slug) routeBag.post_slug = ctx.slug;
          if (typeof ctx.id === 'number' || typeof ctx.id === 'string') routeBag.id = ctx.id;
          const spaceCtx = isRecord(ctx.space) ? (ctx.space as Record<string, unknown>) : null;
          if (spaceCtx && typeof spaceCtx.slug === 'string') routeBag.slug = spaceCtx.slug;
          if (Object.keys(routeBag).length > 0) setRouteParams(routeBag);
        }
      }
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    case 'space.join': {
      // Simulated: stamps a space_pivot so the CTA swaps to View Space.
      if (isRecord(effectiveItem)) {
        (effectiveItem as Record<string, unknown>).space_pivot = { status: 'active' };
      }
      console.info('[appza-admin/app-mode] space.join dispatched (sim: no HTTP):', argRec);
      window.dispatchEvent(new CustomEvent('appza:refresh-data'));
      return;
    }

    case 'space.leave': {
      if (isRecord(effectiveItem)) {
        delete (effectiveItem as Record<string, unknown>).space_pivot;
      }
      console.info('[appza-admin/app-mode] space.leave dispatched (sim: no HTTP):', argRec);
      window.dispatchEvent(new CustomEvent('appza:refresh-data'));
      return;
    }

    case 'member.options': {
      const rawItems = Array.isArray(argRec.items) ? argRec.items : [];
      const items = rawItems
        .filter((i): i is Record<string, unknown> => isRecord(i))
        .map((i) => i as unknown as MemberMenuItem)
        .filter((i) => typeof i.action_slug === 'string' && i.action_slug);
      if (items.length === 0) return;
      const subjectPath =
        typeof argRec.subject_path === 'string' ? argRec.subject_path : 'data.xprofile.display_name';
      const rawSubject = readDataPath(effectiveItem, subjectPath);
      const subject = typeof rawSubject === 'string' && rawSubject ? rawSubject : 'Member';
      openMemberOptionsSheet({ subject, items, item: effectiveItem });
      return;
    }

    case 'member.change_role': {
      const rawRoles = Array.isArray(argRec.roles) ? argRec.roles : [];
      const roles = rawRoles
        .filter((r): r is Record<string, unknown> => isRecord(r))
        .map((r) => r as unknown as MemberRoleOption)
        .filter((r) => typeof r.value === 'string' && typeof r.label === 'string');
      if (roles.length === 0) return;
      const subjectPath =
        typeof argRec.subject_path === 'string' ? argRec.subject_path : 'data.xprofile.display_name';
      const currentRolePath =
        typeof argRec.current_role_path === 'string' ? argRec.current_role_path : 'data.role';
      const rawSubject = readDataPath(effectiveItem, subjectPath);
      const rawRole = readDataPath(effectiveItem, currentRolePath);
      const subject = typeof rawSubject === 'string' && rawSubject ? rawSubject : 'Member';
      const currentRole = typeof rawRole === 'string' && rawRole ? rawRole : 'member';
      openMemberRoleSheet({ subject, currentRole, roles, item: effectiveItem });
      return;
    }

    case 'member.set_role': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const userIdPath =
        typeof argRec.user_id_path === 'string' ? argRec.user_id_path : 'data.user_id';
      const role = typeof argRec.role === 'string' ? argRec.role : null;
      const spaceSlug = getSpaceDetailControls().space_slug;
      const rawUserId = readDataPath(effectiveItem, userIdPath);
      const userId =
        typeof rawUserId === 'number'
          ? rawUserId
          : typeof rawUserId === 'string' && rawUserId !== '' && !Number.isNaN(Number(rawUserId))
            ? Number(rawUserId)
            : null;
      if (!endpoint || !role || userId === null || !spaceSlug) {
        onLoginError('Could not update membership — missing endpoint, role, user, or space.');
        return;
      }
      if (!auth) {
        onLoginError('Please sign in to change memberships.');
        return;
      }
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify({ space_slug: spaceSlug, user_id: userId, role }),
          });
          const json = await res.json().catch(() => null);
          const inner =
            json && typeof json === 'object' && 'response' in json
              ? ((json as Record<string, unknown>).response as
                  | Record<string, unknown>
                  | undefined)
              : undefined;
          const innerStatus =
            inner && typeof inner.status === 'number' ? inner.status : null;
          const ok = innerStatus !== null ? innerStatus === 200 : res.ok;
          if (!ok) {
            const msg =
              (inner && typeof inner.message === 'string' && inner.message) ||
              `HTTP ${res.status}`;
            onLoginError(msg);
            return;
          }
          if (isRecord(effectiveItem)) {
            (effectiveItem as Record<string, unknown>).role = role;
          }
          window.dispatchEvent(new CustomEvent('appza:refresh-data'));
        } catch (err) {
          onLoginError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    // Dual-mode: no user_id/role opens the modal; with them it submits.
    case 'member.add': {
      const hasUser = argRec.user_id !== undefined && argRec.user_id !== null;
      const hasRole = typeof argRec.role === 'string' && argRec.role !== '';

      if (!hasUser || !hasRole) {
        const formSlug =
          typeof argRec.form_appzet_slug === 'string'
            ? argRec.form_appzet_slug
            : 'fc-add-member-modal';
        const usersEndpoint =
          typeof argRec.users_endpoint === 'string'
            ? argRec.users_endpoint
            : '/wp-json/fcom-mobile/api/v1/users/search';
        const spaceSlug = getSpaceDetailControls().space_slug;
        openAddMemberModal({
          appzetSlug: formSlug,
          ...addMemberPresentation(readAppzetPropsFromCatalog(formSlug)),
          childStyles: childStylesFromCustomizations(
            formSlug,
            ADD_MEMBER_CHILD_COUNT,
            currentCustomizations,
          ),
          usersEndpoint,
          spaceSlug: spaceSlug ?? undefined,
          authHeader: auth ? basicAuthHeader(auth) : undefined,
          restNonce: window.appzaCoreConfig?.restNonce,
          submitActionSlug: 'member.add',
          submitArgs: {
            endpoint: typeof argRec.endpoint === 'string' ? argRec.endpoint : undefined,
            method: typeof argRec.method === 'string' ? argRec.method : undefined,
          },
        });
        return;
      }

      const endpoint =
        typeof argRec.endpoint === 'string'
          ? argRec.endpoint
          : '/wp-json/fcom-mobile/api/v1/spaces/add-member';
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const role = typeof argRec.role === 'string' ? argRec.role : null;
      const spaceSlug = getSpaceDetailControls().space_slug;
      const rawUserId = argRec.user_id;
      const userId =
        typeof rawUserId === 'number'
          ? rawUserId
          : typeof rawUserId === 'string' && rawUserId !== '' && !Number.isNaN(Number(rawUserId))
            ? Number(rawUserId)
            : null;
      if (!endpoint || !role || userId === null || !spaceSlug) {
        onLoginError('Could not add member — missing endpoint, role, user, or space.');
        return;
      }
      if (!auth) {
        onLoginError('Please sign in to add members.');
        return;
      }
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify({ space_slug: spaceSlug, user_id: userId, role }),
          });
          const json = await res.json().catch(() => null);
          const inner =
            json && typeof json === 'object' && 'response' in json
              ? ((json as Record<string, unknown>).response as
                  | Record<string, unknown>
                  | undefined)
              : undefined;
          const innerStatus =
            inner && typeof inner.status === 'number' ? inner.status : null;
          const ok = innerStatus !== null ? innerStatus === 200 : res.ok;
          if (!ok) {
            const msg =
              (inner && typeof inner.message === 'string' && inner.message) ||
              `HTTP ${res.status}`;
            onLoginError(msg);
            return;
          }
          closeAddMemberModal();
          window.dispatchEvent(new CustomEvent('appza:refresh-data'));
        } catch (err) {
          onLoginError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    // Blocking confirms first; kept in step with the mobile shell's copy.
    case 'profile.block_confirm':
    case 'profile.unblock_confirm':
    case 'member.remove_confirm': {
      const blocking = action_slug === 'profile.block_confirm';
      const unblocking = action_slug === 'profile.unblock_confirm';
      const isProfileConfirm = blocking || unblocking;
      const subjectPath =
        typeof argRec.subject_path === 'string'
          ? argRec.subject_path
          : isProfileConfirm
            ? 'data.display_name'
            : 'data.xprofile.display_name';
      const rawSubject = readDataPath(effectiveItem, subjectPath);
      const subject = typeof rawSubject === 'string' && rawSubject ? rawSubject : 'Member';
      openMemberRemoveConfirm({
        subject,
        message:
          typeof argRec.message === 'string'
            ? argRec.message
            : blocking
              ? 'Blocking this user will hide their posts from your feed and prevent them from interacting with you. Are you sure you want to block this user?'
              : unblocking
                ? 'Are you sure you want to unblock this user?'
                : undefined,
        cancelLabel: typeof argRec.cancel_label === 'string' ? argRec.cancel_label : undefined,
        confirmLabel: typeof argRec.confirm_label === 'string' ? argRec.confirm_label : undefined,
        ...(isProfileConfirm ? { actionsLayout: 'material' as const, confirmTone: 'primary' as const } : {}),
        item: effectiveItem,
        removeActionSlug:
          typeof argRec.remove_action_slug === 'string'
            ? argRec.remove_action_slug
            : blocking
              ? 'profile.block'
              : unblocking
                ? 'profile.unblock'
                : 'member.remove',
      });
      return;
    }

    case 'member.remove': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const userIdPath =
        typeof argRec.user_id_path === 'string' ? argRec.user_id_path : 'data.user_id';
      const spaceSlug = getSpaceDetailControls().space_slug;
      const rawUserId = readDataPath(effectiveItem, userIdPath);
      const userId =
        typeof rawUserId === 'number'
          ? rawUserId
          : typeof rawUserId === 'string' && rawUserId !== '' && !Number.isNaN(Number(rawUserId))
            ? Number(rawUserId)
            : null;
      if (!endpoint || userId === null || !spaceSlug) {
        onLoginError('Could not remove member — missing endpoint, user, or space.');
        closeMemberRemoveConfirm();
        return;
      }
      if (!auth) {
        onLoginError('Please sign in to remove members.');
        closeMemberRemoveConfirm();
        return;
      }
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify({ space_slug: spaceSlug, user_id: userId }),
          });
          const json = await res.json().catch(() => null);
          const inner =
            json && typeof json === 'object' && 'response' in json
              ? ((json as Record<string, unknown>).response as
                  | Record<string, unknown>
                  | undefined)
              : undefined;
          const innerStatus =
            inner && typeof inner.status === 'number' ? inner.status : null;
          const ok = innerStatus !== null ? innerStatus === 200 : res.ok;
          if (!ok) {
            const msg =
              (inner && typeof inner.message === 'string' && inner.message) ||
              `HTTP ${res.status}`;
            onLoginError(msg);
            return;
          }
          window.dispatchEvent(new CustomEvent('appza:refresh-data'));
        } catch (err) {
          onLoginError(err instanceof Error ? err.message : String(err));
        } finally {
          closeMemberRemoveConfirm();
        }
      })();
      return;
    }

    // Dual-mode like member.add: no email opens the modal; with one it submits.
    case 'member.invite': {
      const email = typeof argRec.email === 'string' ? argRec.email.trim() : '';

      if (email === '') {
        const formSlug =
          typeof argRec.form_appzet_slug === 'string'
            ? argRec.form_appzet_slug
            : 'fc-invite-user-modal';
        const props = readAppzetPropsFromCatalog(formSlug);

        const dsSlug =
          typeof argRec.list_data_source === 'string'
            ? argRec.list_data_source
            : 'fc-space-invitations';
        const listEndpoint =
          readDataSourceEndpointFromCatalog(catalog, dsSlug) ??
          '/wp-json/fcom-mobile/api/v1/spaces/invitations';

        openInviteUserModal({
          appzetSlug: formSlug,
          ...invitePresentation(props),
          childStyles: childStylesFromCustomizations(
            formSlug,
            INVITE_USER_CHILD_COUNT,
            currentCustomizations,
          ),
          listEndpoint,
          spaceSlug: getSpaceDetailControls().space_slug ?? undefined,
          authHeader: auth ? basicAuthHeader(auth) : undefined,
          restNonce: window.appzaCoreConfig?.restNonce,
          submitActionSlug: 'member.invite',
          submitArgs: {
            endpoint: typeof argRec.endpoint === 'string' ? argRec.endpoint : undefined,
            method: typeof argRec.method === 'string' ? argRec.method : undefined,
          },
        });
        return;
      }

      const endpoint =
        typeof argRec.endpoint === 'string'
          ? argRec.endpoint
          : '/wp-json/fcom-mobile/api/v1/spaces/invitations';
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const role = typeof argRec.role === 'string' ? argRec.role : 'member';
      const inviteeName =
        typeof argRec.invitee_name === 'string' ? argRec.invitee_name : '';
      const spaceSlug = getSpaceDetailControls().space_slug;
      if (!spaceSlug) {
        onMenuError('Could not invite — no space in context.');
        return;
      }
      if (!auth) {
        onMenuError('Please sign in to invite people.');
        return;
      }
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify({
              space_slug: spaceSlug,
              email,
              invitee_name: inviteeName,
              role,
            }),
          });
          const outcome = await readInvitationOutcome(res);
          if (!outcome.ok) {
            onMenuError(outcome.message);
            return;
          }
          // Prefer the endpoint's message: it tells "joined" from "invitation emailed".
          onMenuInfo(
            outcome.message ||
              (typeof argRec.toast_message === 'string'
                ? argRec.toast_message
                : 'Invitation sent'),
          );
          closeInviteUserModal();
          window.dispatchEvent(new CustomEvent('appza:refresh-data'));
        } catch (err) {
          onMenuError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'invitation.delete_confirm': {
      openMemberRemoveConfirm({
        subject: typeof argRec.subject === 'string' ? argRec.subject : 'Delete invitation',
        message:
          typeof argRec.message === 'string'
            ? argRec.message
            : 'This cannot be undone. The invitation link will stop working.',
        cancelLabel: typeof argRec.cancel_label === 'string' ? argRec.cancel_label : 'Cancel',
        confirmLabel: typeof argRec.confirm_label === 'string' ? argRec.confirm_label : 'Delete',
        busyLabel: 'Deleting…',
        actionsLayout: 'row',
        item: effectiveItem,
        removeActionSlug:
          typeof argRec.delete_action_slug === 'string'
            ? argRec.delete_action_slug
            : 'invitation.delete',
      });
      return;
    }

    case 'invitation.delete':
    case 'invitation.resend': {
      const isDelete = action_slug === 'invitation.delete';
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const idPath =
        typeof argRec.invitation_id_path === 'string' ? argRec.invitation_id_path : 'data.id';
      const rawId = readDataPath(effectiveItem, idPath);
      const invitationId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string' && rawId !== '' && !Number.isNaN(Number(rawId))
            ? Number(rawId)
            : null;
      const spaceSlug = getSpaceDetailControls().space_slug;

      if (!endpoint || invitationId === null) {
        onMenuError('Could not act on this invitation — missing endpoint or id.');
        if (isDelete) closeMemberRemoveConfirm();
        return;
      }
      if (!auth) {
        onMenuError('Please sign in to manage invitations.');
        if (isDelete) closeMemberRemoveConfirm();
        return;
      }
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: basicAuthHeader(auth),
            },
            body: JSON.stringify({ space_slug: spaceSlug, invitation_id: invitationId }),
          });
          const outcome = await readInvitationOutcome(res);
          if (!outcome.ok) {
            onMenuError(outcome.message);
            return;
          }
          onMenuInfo(
            outcome.message ||
              (typeof argRec.toast_message === 'string'
                ? argRec.toast_message
                : isDelete
                  ? 'Invitation deleted'
                  : 'Invitation resent'),
          );
          window.dispatchEvent(new CustomEvent('appza:refresh-data'));
        } catch (err) {
          onMenuError(err instanceof Error ? err.message : String(err));
        } finally {
          if (isDelete) closeMemberRemoveConfirm();
        }
      })();
      return;
    }

    case 'invitation.copy_link': {
      const urlPath = typeof argRec.url_path === 'string' ? argRec.url_path : 'data.access_url';
      const raw = readDataPath(effectiveItem, urlPath);
      const url = typeof raw === 'string' ? raw : '';
      if (!url) {
        onMenuError('This invitation has no link to copy.');
        return;
      }
      void copyToClipboard(url).then((copied) => {
        if (copied) {
          onMenuInfo(
            typeof argRec.toast_message === 'string'
              ? argRec.toast_message
              : 'Invitation link copied',
          );
        } else {
          onMenuError('Could not copy the link.');
        }
      });
      return;
    }

    default:
      // Unwired mutating actions only log.
      console.info(
        '[appza-admin/app-mode] action fired (not executed in sim):',
        action_slug,
        argRec,
        { effectiveItem },
      );
  }
}

// Fires an input event so Ionic's internal value syncs.
function appendToTextarea(appzetSlug: string, primitivePath: string, text: string): void {
  const wrapper = document.querySelector(
    `[data-appza-appzet-slug="${CSS.escape(appzetSlug)}"][data-appza-primitive-path="${CSS.escape(primitivePath)}"]`,
  );
  if (!wrapper) {
    console.warn('[appza-admin/app-mode] appendToTextarea: no wrapper for', appzetSlug, primitivePath);
    return;
  }
  const el = wrapper.querySelector('ion-textarea, ion-input, textarea, input') as
    | (HTMLElement & { value?: string; setFocus?: () => Promise<void> })
    | null;
  if (!el) {
    console.warn('[appza-admin/app-mode] appendToTextarea: no input inside', appzetSlug, primitivePath);
    return;
  }
  const current = typeof el.value === 'string' ? el.value : '';
  el.value = current + text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  if (typeof el.setFocus === 'function') {
    void el.setFocus();
  }
}

function formatNowLabel(d: Date): string {
  const dateStr = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} · ${timeStr}`;
}

function pickString(
  rec: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!rec) return null;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function ConfirmDeleteModal({
  title,
  message,
  cta,
  inFlight,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  cta: string;
  inFlight: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        // Absolute: fills only the phone screen inside the simulator's position:relative viewport.
        position: 'absolute',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 16,
          width: 'min(300px, 88%)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{title}</h3>
        <p style={{ margin: '6px 0 14px', fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={inFlight}
            style={{
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: inFlight ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={inFlight}
            style={{
              border: 'none',
              background: inFlight ? '#fca5a5' : '#dc2626',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: inFlight ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {inFlight ? 'Deleting…' : cta}
          </button>
        </div>
      </div>
    </div>
  );
}

type PanelComment = {
  id?: number | string;
  parent_id?: number | string | null;
  message?: string;
  message_rendered?: string;
  created_at?: string;
  xprofile?: {
    display_name?: string;
    avatar?: string;
  } | null;
  children?: PanelComment[];
};

// FC returns a flat list; id is a number but parent_id a string.
function buildCommentTree(flat: PanelComment[]): PanelComment[] {
  const byId = new Map<string, PanelComment>();
  for (const c of flat) {
    if (c.id != null) byId.set(String(c.id), { ...c, children: [] });
  }
  const roots: PanelComment[] = [];
  for (const c of flat) {
    if (c.id == null) continue;
    const node = byId.get(String(c.id));
    if (!node) continue;
    const pid = c.parent_id;
    const pidKey =
      pid == null || pid === 0 || pid === '0' ? null : String(pid);
    if (pidKey && byId.has(pidKey)) {
      const parent = byId.get(pidKey);
      if (parent) (parent.children ??= []).push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function formatCommentTimestamp(raw?: string): string {
  if (!raw) return '';
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} ${day === 1 ? 'day' : 'days'} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} ${wk === 1 ? 'week' : 'weeks'} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} ${mo === 1 ? 'month' : 'months'} ago`;
  const yr = Math.floor(day / 365);
  return `${yr} ${yr === 1 ? 'year' : 'years'} ago`;
}

function CommentPanel({
  feedId,
  endpoint,
  method,
  listEndpoint,
  bodyKey,
  messageKey,
  panelTitle,
  placeholder,
  sendLabel,
  initialReplyTo,
  edit,
  auth,
  onClose,
  onError,
}: {
  feedId: number;
  endpoint: string;
  method: string;
  listEndpoint: string;
  bodyKey: string;
  messageKey: string;
  panelTitle: string;
  placeholder: string;
  sendLabel: string;
  initialReplyTo?: { id: number | string; name: string };
  edit?: {
    commentId: number | string;
    message: string;
    parentBodyKey: string;
    toastMessage: string;
  };
  auth: StoredAuth;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [comments, setComments] = useState<PanelComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(edit?.message ?? '');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number | string; name: string } | null>(
    initialReplyTo ?? null,
  );
  const listRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sep = listEndpoint.includes('?') ? '&' : '?';
      const res = await fetch(`${listEndpoint}${sep}feed_id=${encodeURIComponent(String(feedId))}`, {
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          Authorization: basicAuthHeader(auth),
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || typeof json !== 'object') {
        onError(`Loading comments failed (HTTP ${res.status})`);
        return;
      }
      const rec = json as Record<string, unknown>;
      const items = Array.isArray(rec.items) ? (rec.items as PanelComment[]) : [];
      setComments(buildCommentTree(items));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [listEndpoint, feedId, auth, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      // /comments/update 400s without both the comment id and the post id.
      const body: Record<string, unknown> = edit
        ? {
            [bodyKey]: edit.commentId,
            [edit.parentBodyKey]: feedId,
            [messageKey]: trimmed,
          }
        : {
            [bodyKey]: feedId,
            [messageKey]: trimmed,
          };
      if (!edit && replyingTo) body.parent_id = replyingTo.id;
      const res = await fetch(endpoint, {
        method,
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: basicAuthHeader(auth),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      const status = (json && typeof json === 'object' && 'response' in json)
        ? ((json as Record<string, unknown>).response as Record<string, unknown> | undefined)
        : undefined;
      const httpOk = res.ok;
      const bodyOk = !status || status.status === 200;
      if (!httpOk || !bodyOk) {
        const msg =
          (status && typeof status.message === 'string' && status.message) ||
          `Comment failed (HTTP ${res.status})`;
        onError(msg);
        return;
      }
      setDraft('');
      setReplyingTo(null);
      if (edit) {
        await load();
        triggerFeedRefresh();
        onClose();
        return;
      }
      await load();
      // Refresh the feed so the card's comment count updates.
      triggerFeedRefresh();
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, [
    draft,
    sending,
    endpoint,
    method,
    auth,
    bodyKey,
    messageKey,
    feedId,
    replyingTo,
    edit,
    load,
    onClose,
    onError,
  ]);

  const startReply = useCallback((c: PanelComment) => {
    if (c.id == null) return;
    const name = c.xprofile?.display_name ?? 'User';
    setReplyingTo({ id: c.id, name });
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);
  const cancelReply = useCallback(() => setReplyingTo(null), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={panelTitle}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'grid',
        placeItems: 'end center',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          width: '100%',
          height: '78%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -6px 24px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, color: '#111827', fontWeight: 600 }}>
            {panelTitle}
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 20,
              lineHeight: 1,
              color: '#6b7280',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ×
          </button>
        </div>
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#f9fafb',
          }}
        >
          {loading && comments.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: 20 }}>
              Loading comments…
            </div>
          ) : comments.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: 20 }}>
              No comments yet. Be the first to comment.
            </div>
          ) : (
            comments.map((c, i) => (
              <CommentThreadItem
                key={c.id ?? i}
                comment={c}
                depth={0}
                onReply={startReply}
              />
            ))
          )}
        </div>
        {edit && (
          <div
            style={{
              padding: '6px 12px',
              borderTop: '1px solid #e5e7eb',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: '#92400e',
            }}
          >
            <span>Editing your comment</span>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#92400e',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                padding: 4,
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {replyingTo && (
          <div
            style={{
              padding: '6px 12px',
              borderTop: '1px solid #e5e7eb',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: '#1e40af',
            }}
          >
            <span>
              Replying to <strong>@{replyingTo.name}</strong>
            </span>
            <button
              type="button"
              onClick={cancelReply}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#1e40af',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                padding: 4,
              }}
            >
              Cancel
            </button>
          </div>
        )}
        <div
          style={{
            padding: 10,
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            background: '#fff',
          }}
        >
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={replyingTo ? `Reply to ${replyingTo.name}…` : placeholder}
            rows={2}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              color: '#111827',
              background: '#f9fafb',
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || draft.trim().length === 0}
            style={{
              border: 'none',
              background: sending || draft.trim().length === 0 ? '#93c5fd' : '#2563eb',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 8,
              cursor: sending || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {sending ? '…' : replyingTo ? 'Reply' : sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentThreadItem({
  comment,
  depth,
  onReply,
}: {
  comment: PanelComment;
  depth: number;
  onReply: (c: PanelComment) => void;
}) {
  const name = comment.xprofile?.display_name ?? 'User';
  const avatar = comment.xprofile?.avatar ?? '';
  const children = Array.isArray(comment.children) ? comment.children : [];
  const avatarSize = depth === 0 ? 32 : 26;
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: '#fff',
          padding: 10,
          borderRadius: 10,
          border: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: '50%',
            background: avatar ? `#eee url(${avatar}) center/cover` : '#d1d5db',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{name}</span>
            {comment.created_at && (
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                {formatCommentTimestamp(comment.created_at)}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#374151',
              lineHeight: 1.5,
              marginTop: 2,
              wordBreak: 'break-word',
            }}
            {...(comment.message_rendered != null
              ? { dangerouslySetInnerHTML: { __html: String(comment.message_rendered) } }
              : { children: String(comment.message ?? '') })}
          />
          {comment.id != null && (
            <button
              type="button"
              onClick={() => onReply(comment)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#2563eb',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 0 0',
              }}
            >
              Reply
            </button>
          )}
        </div>
      </div>
      {children.length > 0 && (
        <div
          style={{
            marginTop: 8,
            marginLeft: 10 + avatarSize / 2,
            paddingLeft: 14,
            borderLeft: '2px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {children.map((child, idx) => (
            <CommentThreadItem
              key={child.id ?? idx}
              comment={child}
              depth={depth + 1}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

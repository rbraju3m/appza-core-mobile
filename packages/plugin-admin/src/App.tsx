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
  openModerationReview,
  announceModerationDone,
  moderationReviewPresentation,
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
  openChatMembersSheet,
  LeaderboardPointsSheet,
  openLeaderboardPointsSheet,
  leaderboardPointsPresentation,
  LEADERBOARD_POINTS_SHEET_CHILD_COUNT,
  setLeaderboardControls,
  resetLeaderboardControls,
  OptionsSheet,
  openOptionsSheet,
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

// Re-exported so existing local consumers (e.g. TopBar) keep working
// without churning their import path.
export type { PreviewMode };

/**
 * Preview UI mode.
 * - 'edit' (default): design-time. Clicks select the primitive/AppZet so
 *   the Properties panel can edit it. Actions do nothing.
 * - 'app': runtime. Same behavior as the real Capacitor mobile app —
 *   clicks fire nav.push / nav.back / link.open. Mutating actions
 *   (post.create etc.) log a warning instead of hitting the server so
 *   admins don't accidentally create real feed posts from the sim.
 */
export type UiMode = 'edit' | 'app';

import { TopBar } from './TopBar';
import { Sidebar, type BottomTab, type SidebarTab } from './Sidebar';
import { DeviceFrame, type SelectedPrimitive } from './DeviceFrame';
import { OverridesPanel } from './OverridesPanel';
import { PropertiesPanel } from './PropertiesPanel';
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

/**
 * Build the bootstrap URL with a template= parameter.
 *
 * In WP admin: `endpoints.bootstrap` is a fully-qualified URL localized by
 * the plug-in (pretty `/wp-json/...` or query-form `/?rest_route=/...`
 * depending on permalinks). We use the URL API to append `template=` so
 * either form works correctly.
 *
 * Standalone dev: fall back to /wp-json/.../bootstrap, which the Vite
 * proxy rewrites to the query form against the local WP install.
 */
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
  // Onboarding "Select App" modal. Auto-opens once per session if the
  // site owner hasn't picked any Source Integrations yet.
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [buildAppOpen, setBuildAppOpen] = useState(false);
  // Template dropdown data — pulled from the plug-in's /templates proxy,
  // which asks the Core for Templates tied to the currently-activated
  // Source Integrations. Refetched after the onboarding modal saves.
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('global');
  const [bottomTab, setBottomTab] = useState<BottomTab>(null);
  const [selectedAppzetSlug, setSelectedAppzetSlug] = useState<string | null>(null);
  const [selectedPrimitive, setSelectedPrimitive] = useState<SelectedPrimitive | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    window.appzaCoreConfig?.previewMode ?? 'auto',
  );
  const [uiMode, setUiMode] = useState<UiMode>('edit');
  // Track a screen-nav stack so nav.back can pop in App mode. Populated
  // when nav.push runs; irrelevant in Edit mode (screens are picked from
  // the top-bar dropdown, no stack).
  const [screenStack, setScreenStack] = useState<number[]>([]);
  // Screen-mount context: when nav.push carries pass_item_as_context, the
  // tapped item is stashed here keyed by target screen's slug. Downstream
  // AppZets on that screen (fc-post-information on edit-post-page) read it
  // to prefill from — and the post.edit HTTP handler resolves feed_id off
  // it (the composer form doesn't itself carry the id). Kept as a ref so
  // writes don't force renders; consumers pull the value inside effects
  // that already depend on selectedScreenId. Context PERSISTS across
  // re-renders on the same screen — post.edit needs it at Save time.
  const screenContextRef = useRef<Record<string, unknown>>({});
  // Companion flag ref: which slugs have already been prefilled this
  // visit. Prevents the prefill effect from re-writing over user edits
  // when currentScreen's memo re-computes (which produces a new ref
  // even when the selected id is unchanged). Cleared by nav.push so a
  // fresh Edit tap re-prefills.
  const screenPrefilledRef = useRef<Record<string, true>>({});
  // Auth state (real WP Application Password from /fcom-login). Mirrored
  // into localStorage so a page reload keeps the session. When null,
  // App-mode forces the login-page screen on first render.
  const [auth, setAuthState] = useState<StoredAuth | null>(() => readStoredAuth());
  const setAuth = useCallback((a: StoredAuth | null) => {
    writeStoredAuth(a);
    setAuthState(a);
    // Mirror the Basic Auth header into a window global so the renderer's
    // useDataSource can forward it to the preview proxy without importing
    // any auth state cross-package. Same channel exposes user_id so the
    // renderer's enrichItemWithMyReactions can flag the viewer's own
    // reactions on each feed item.
    const g = window as unknown as { __appzaAuthHeader?: string; __appzaCurrentUserId?: number };
    if (a) {
      g.__appzaAuthHeader = basicAuthHeader(a);
      if (typeof a.user_id === 'number') g.__appzaCurrentUserId = a.user_id;
      else delete g.__appzaCurrentUserId;
    } else {
      delete g.__appzaAuthHeader;
      delete g.__appzaCurrentUserId;
    }
  }, []);
  // Bootstrap the window auth header on mount if we already have a stored
  // session (auth was hydrated from localStorage before setAuth ran).
  useEffect(() => {
    const g = window as unknown as { __appzaAuthHeader?: string; __appzaCurrentUserId?: number };
    if (auth) {
      g.__appzaAuthHeader = basicAuthHeader(auth);
      if (typeof auth.user_id === 'number') g.__appzaCurrentUserId = auth.user_id;
    }
    // Also trigger data-source refresh so any in-flight fetches that ran
    // before the header was set can be re-issued with credentials.
    window.dispatchEvent(new Event('appza:refresh-data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Toast-style banner for login / post errors from the HTTP dispatchers.
  // Auto-clears after 5s. Success paths clear it too via clearAuthMessage.
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const clearAuthMessage = useCallback(() => setAuthMessage(null), []);
  // Post-menu toast — anchored inside the DeviceFrame viewport so success
  // + error feedback for the 3-dot menu actions (Copy Link, Pin to top,
  // Report, etc.) shows inside the phone preview rather than as a full-
  // width red banner above the WP admin canvas.
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
  // Spaces list is now fetched by the renderer itself via the AppZet's
  // option_data_sources → fc-spaces-discover binding. Kept no shell-level
  // state for it — see @appza/renderer PlacementRenderer + the fc-post-
  // information seeder for the catalog-side wiring.
  // Live-clock string for the create-post-page's user avatar card. Ticks
  // every 30s so the date line under the user's name reads as "now".
  // Injected into effectiveCustomizations for fc-user-avatar → children[2].text.
  const [nowLabel, setNowLabel] = useState<string>(() => formatNowLabel(new Date()));
  useEffect(() => {
    if (uiMode !== 'app') return;
    const tick = () => setNowLabel(formatNowLabel(new Date()));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [uiMode]);
  // Images the user has selected + uploaded for the current create-post
  // draft. Each entry is a URL returned by /feeds/media-upload. Included
  // as `media_images` on post.create and cleared on success + on logout.
  // The draft owns the images now — the composer and the preview both
  // render them, and neither can read a shell useState. Kept as a local
  // name because post.create / post.edit already build `media_images`
  // from it, and one source of truth is the point.
  const postDraft = usePostDraft();
  const pendingImages = useMemo(() => postDraft.images.map((i) => i.url), [postDraft.images]);
  const setImagesFromUrls = useCallback(
    (urls: string[]) => setPostDraft({ images: urls.map((url) => ({ url })) }),
    [],
  );
  const [uploadingCount, setUploadingCount] = useState(0);
  // Video oembed attachment for the current draft. Populated by picker.video
  // after a successful /feeds/oembed lookup. Sent on post.create as
  // `media: {type: 'oembed', url}` + `content_type: 'oembed'`. FC's server
  // re-parses the URL and materializes meta.media_preview from RemoteUrlParser.
  const [pendingVideo, setPendingVideo] = useState<{
    url: string;
    title?: string;
    image?: string;
    provider?: string;
  } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  // Poll (FC calls it "survey") attachment for the current draft. Built via
  // the poll modal opened by picker.poll. Sent on post.create as
  // `survey: {type, options: [{label}]}`. FC flips content_type to 'survey'
  // + slugs each option server-side. On post.edit the SAME shape ships
  // back, plus each existing option carries its server-issued `slug` so
  // FC's FeedsHelper::getSurveyOptionsUpdateError sees every prior slug
  // present + non-empty (otherwise the update is rejected). Options added
  // during this edit session have no slug — FC assigns one.
  // Pending feed delete confirmation. Set by the post.delete dispatcher when
  // the user taps the overflow menu on a post card; cleared by the modal's
  // Cancel button OR by a successful delete. Holds everything the modal
  // needs to fire the request without a re-lookup — the item that owned the
  // tap has already left the render tree when the modal is shown.
  type PendingDelete = {
    feedId: number;
    endpoint: string;
    method: string;
    bodyKey: string;
    title: string;
    message: string;
    cta: string;
    /**
     * Names the act in the last-resort failure toast. This dialog is no
     * longer only about deleting — Remove Preview rides the same path —
     * and "Delete failed (HTTP 403)" over a preview that is still there
     * describes the wrong thing.
     */
    failLabel?: string;
    /**
     * Extra keys merged into the request body. A COMMENT is addressed by
     * both its own id and its post's — every fcom-mobile comment route
     * wants the pair — and the confirm dialog is otherwise identical to
     * the post's, so it carries the second id rather than being forked.
     */
    extraBody?: Record<string, unknown>;
  };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [simMenuOpen, setSimMenuOpen] = useState(false);
  const [simRefreshing, setSimRefreshing] = useState(false);
  const [simPullDistance, setSimPullDistance] = useState(0);
  // In-device comment panel — replaces the earlier window.prompt path.
  // Owned by App.tsx (not the renderer) so we can mount it in the
  // DeviceFrame's overlaySlot with the same absolute-inside-viewport
  // positioning as ConfirmDeleteModal.
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
    /**
     * Set by comment.reply — the panel opens with the composer already
     * aimed at this comment. Mirrors the mobile shell exactly; the two
     * panels are twins and must not drift.
     */
    replyTo?: { id: number | string; name: string };
    /** Set by comment.edit — prefilled draft, PUT /comments/update. */
    edit?: {
      commentId: number | string;
      message: string;
      parentBodyKey: string;
      toastMessage: string;
    };
  };
  const [commentPanel, setCommentPanel] = useState<CommentPanelState | null>(null);
  // Hidden file input reused across picker.image invocations. Ref lets the
  // dispatcher trigger `.click()` without React re-render.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioUploadEndpointRef = useRef<string | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  // The three document endpoints, stashed together when the paperclip is
  // tapped. Rename and delete fire from the composer's own rows long
  // after the picker has closed, so they cannot be read off the action's
  // args at call time — the ref is where they wait.
  const docEndpointsRef = useRef<{ upload: string; rename: string; remove: string } | null>(null);
  // Endpoint the dispatcher hands over when picker.image / picker.video
  // fires. Kept in a ref (not state) so the write is synchronous with the
  // dispatch AND the subsequent uploadImages / attachVideo read sees the
  // fresh value — a state setter would race the file-input onChange.
  // Enforces "no hardcoded endpoints" — reset to null on logout so a
  // stale endpoint from a previous session never gets reused.
  const uploadEndpointRef = useRef<{ method: string; endpoint: string } | null>(null);
  const oembedEndpointRef = useRef<{ method: string; endpoint: string } | null>(null);
  // Session-scoped tracker of which (feed_id, react_type) pairs the current
  // viewer has toggled on. The feed API doesn't surface a per-viewer
  // "did I react?" flag, so we mirror server state locally: adding on the
  // first tap, sending `remove=1` on the second. Cleared on logout below.
  const reactedRef = useRef<Set<string>>(new Set());
  // Clear all pending draft attachments (images, video, poll) on logout
  // so nothing leaks between sessions.
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
  // Pending panel edits — mirrored into the customizations blob before
  // it's handed to DeviceFrame so the phone-frame preview reflects the
  // panel state instantly, before Save persists it.
  const [livePreview, setLivePreview] = useState<{
    slug: string;
    override: Record<string, unknown>;
  } | null>(null);
  // Same shape as livePreview but for the DC#20 primitive axis.
  // Overlays under customizations.appzet_primitive[<compositeKey>].layout.
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

  // First-mount check: open the "Select App" wizard if the site owner
  // hasn't activated any Source Integrations yet. Cheap GET; fails
  // silently on any error so the app stays usable.
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
      // Auto-clear the success toast after 4s.
      window.setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  async function pull(slug: string) {
    setState({ kind: 'loading' });
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
      // Surface-gate template_screens once at ingest so every downstream
      // .find/.map/.filter already sees only rows tagged for this surface
      // (or 'both'). Screens tagged 'mobile' won't render in the simulator.
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
      // Auto-select first screen on successful load.
      const firstScreen = gated.catalog.template_screens?.[0];
      setSelectedScreenId(firstScreen ? firstScreen.id : null);
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

  // Publish the catalog on window so PostOptionsPopover can look up each
  // menu item's action defaults at click time. See mobile App.tsx for
  // context — without this the non-copy_link menu items resolve without
  // their endpoint / patch_key / body_key defaults.
  useEffect(() => {
    setCatalogGlobal(catalog ?? null);
  }, [catalog]);

  const currentScreen = useMemo<TemplateScreen | null>(() => {
    if (!selectedScreenId) return null;
    return screens.find((s) => s.id === selectedScreenId) ?? null;
  }, [selectedScreenId, screens]);


  // The create-post screen arrives empty, and knowing WHO is looking is
  // part of arriving. The announcement row and the schedule control exist
  // on a per-viewer verdict that the cached bootstrap cannot answer (it
  // would be whoever warmed the cache), and Noor's designs show the
  // composer with that row already decided before a space is chosen — so
  // the verdict is warmed here rather than waiting for the picker.
  //
  // The endpoint is read off the composer's own catalog wiring rather
  // than written down, so pointing the picker at a different list is a
  // right-panel edit and cannot leave these two disagreeing.
  //
  // Emptying the draft is NOT done here. This effect runs on every
  // arrival at the screen, and returning from the preview is an arrival —
  // so a reset here would wipe the draft the user just went to look at.
  // nav.push owns it instead, which is the one place that can tell
  // "opened the composer" from "came back to it".
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

  // Prefill composer forms from screen-mount context. Currently only
  // fc-post-information on edit-post-page uses this — nav.push carried
  // the tapped feed item into screenContextRef; the shared helper waits
  // for the composer to mount, then writes title / body / space slug and
  // hydrates pending image/video/poll state from the item's meta.
  //
  // Guarded by screenPrefilledRef so a currentScreen memo re-compute
  // (React re-render) doesn't retrigger the write and overwrite user
  // edits. Context itself stays put — post.edit reads it at Save time
  // to resolve feed_id. nav.push clears the prefilled flag for a fresh
  // Edit tap.
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
      // The poll goes onto the DRAFT, not into shell state — the strip
      // in the composer and the block in the preview both read it from
      // there, so an edit that seeded shell state would open a composer
      // showing no poll on a post that has one.
      setPoll: (poll) => setPostDraft({ poll }),
      // The destination is a chip, a topic list, a document permission
      // and an announcement verdict — all of which live in the picker's
      // payload, not on the post. Resolve it the same way a tap does.
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

  // "Edit" on the composer's collapsed poll strip. The strip is drawn
  // inside a primitive with no child index of its own, so it asks rather
  // than dispatching — and the answer is the same function the poll
  // glyph's action calls, so the two sheets cannot drift.
  useEffect(
    () => onPollSheetRequest(() => openPollSheetFromCatalog('fc-post-poll-sheet')),
    [],
  );

  // "Edit" on the schedule strip, same channel and same reason as the
  // poll strip's.
  useEffect(
    () => onScheduleSheetRequest(() => openScheduleSheetFromCatalog(SCHEDULE_SHEET_APPZET_SLUG)),
    [],
  );

  // Rename / remove on the composer's document rows. Both go to the
  // SERVER first and only then touch the draft, so a refusal leaves the
  // row where it was rather than losing the user's file from the list
  // while it still exists on the site.
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
            // A real delete, not a local drop. Unlike an image or an
            // audio file, an uploaded-but-unattached document CAN be
            // removed — FC Pro permits it when the media has no feed_id
            // and belongs to the asking user — so nothing is left behind.
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

  // The Leaderboard's levels card expands one way, so arriving on the
  // screen has to put it back in its landing state — otherwise a second
  // visit opens on a nine-level card with no control to collapse it,
  // because VIEW ALL is already gone. The two verdict strings go back to
  // 'loading' with it, or a stale one paints the previous visit's answer
  // over a card that has not fetched yet.
  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'leaderboard') return;
    resetLeaderboardControls();
  }, [currentScreen?.app_map_screen_slug]);

  // A search keystroke still waiting out its debounce belongs to the
  // screen it was typed on. Leaving arms nothing new, but a timer already
  // armed would fire against a screen nobody is looking at and refetch
  // it. Dropping every channel on a screen change is cheaper than
  // reasoning about which one is still live.
  useEffect(() => {
    cancelDebouncedSearch();
  }, [currentScreen?.app_map_screen_slug]);

  // Saved Posts arrives with a clean search box. Sort and layout are
  // preferences and survive; a search string is not one — reopening on a
  // phrase you typed last week would show "No matches" over a list that
  // is not empty, with the reason off screen in a field you have to
  // scroll to. The verdict resets with it so a stale 'empty' cannot
  // paint over a list still loading.
  useEffect(() => {
    if (currentScreen?.app_map_screen_slug !== 'bookmarks') return;
    resetBookmarkControls();
  }, [currentScreen?.app_map_screen_slug]);

  // Search arrives on Posts → Content with an empty field, for the same
  // reason Saved Posts arrives with a clean search box — and here the
  // stakes are higher, because a restored query would ALSO restore
  // whichever tab and sub-scope it was typed against.
  //
  // The two config values are read off fc-search-field's authored props
  // rather than hard-coded, so raising the minimum is a right-panel edit.
  // They are applied AFTER the reset: the reset is per-visit, the config
  // is not, and doing it the other way round would wipe the values on
  // every entry to the screen.
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

  // Seed a default route.slug when landing on space-detail directly (via
  // the Screen dropdown) rather than via a nav.push from the Spaces list.
  // Without this, DS query_params bound to route.slug (fc-space-detail,
  // fc-space-feeds space_slug) resolve to undefined and the endpoints
  // return empty — no cover, no topics, generic feed. Only fires when
  // no route slug is already set (nav.push seeds one via the routeBag).
  useEffect(() => {
    if (!currentScreen) return;
    const slug = currentScreen.app_map_screen_slug;
    // Same seed-if-empty logic also applies to create-post-page and
    // edit-post-page: fc-post-information's topic dropdown pulls from
    // fc-space-detail (needs route.slug). Without a seeded slug the
    // topic dropdown stays empty even when the current user's default
    // space has real topics configured.
    if (slug !== 'space-detail' && slug !== 'create-post-page' && slug !== 'edit-post-page') return;
    const existing = (window as unknown as { __appzaRouteParams?: Record<string, unknown> })
      .__appzaRouteParams?.slug;
    if (existing) return;
    // Fetch the first accessible space via the preview proxy and adopt it.
    fetch('/wp-json/appza/v1/preview/data?ds=fc-spaces-discover&mode=real', {
      credentials: 'include',
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
  }, [currentScreen]);

  // Overlay pending panel edits onto the persisted customizations shape
  // ({ scope: { target_key: { column: value } } }). PlacementRenderer
  // reads through resolveOverridableColumn on this blob, so the preview
  // picks up the pending edit without a network round-trip. Two axes
  // overlay independently: appzet-level (Properties/Options) and DC#20
  // primitive-level (Layout editor).
  const effectiveCustomizations = useMemo(() => {
    const base = envelope?.customizations;
    if (!livePreview && !livePrimitivePreview && uiMode !== 'app') return base;
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
    // Spaces list is no longer injected here — the renderer's
    // OptionDataSourceFetcher handles fc-spaces-discover directly via the
    // fc-post-information AppZet's option_data_sources binding.
    // Inject live "now" string for the create-post user-avatar card's
    // date line. field_mappings on the AppZet also binds children[2].text
    // to data.schedule_date (server stamp fallback); this override runs
    // AFTER that in PlacementRenderer, so the live clock wins.
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
    return out;
  }, [envelope, livePreview, livePrimitivePreview, uiMode, nowLabel]);

  // Mirror the canvas's resolved customizations to the action handler,
  // then re-author the open modal if the panel is editing one. Composed
  // AppZets re-render off effectiveCustomizations by themselves; an
  // overlay was opened imperatively with a snapshot of its props, so it
  // has to be told. Without this, editing a modal's Options changed
  // nothing you could see — the panel saved, the card didn't move.
  //
  // Patching rather than re-opening keeps modal-local state (active tab,
  // picked user, half-typed email) intact while you edit. The patch is
  // addressed by slug and ignored by a modal showing a different AppZet,
  // so a customer's own variant is handled without naming it here.
  // Which AppZet the panel is editing. Options edits select the AppZet;
  // Wrapper edits select one of its children and null the AppZet slug,
  // so keying on `selectedAppzetSlug` alone would leave every width /
  // height / gap change unpushed.
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

  const openImagePicker = useCallback((target: { endpoint: string; method: string }) => {
    console.log('[appza/picker.image] openImagePicker called', {
      hasInputRef: !!fileInputRef.current,
      endpoint: target.endpoint,
    });
    if (!fileInputRef.current) {
      console.warn('[appza/picker.image] fileInputRef is null — input not mounted?');
      return;
    }
    uploadEndpointRef.current = target;
    fileInputRef.current.click();
  }, []);
  const openDocumentPicker = useCallback(
    (t: { upload: string; rename: string; remove: string; accept: string }) => {
      // Same ref-then-click shape as the image and audio pickers: the
      // input's onChange fires after this returns, so everything it needs
      // has to be readable synchronously. The rename and delete endpoints
      // ride along because the composer's rows fire those long after the
      // picker has closed.
      docEndpointsRef.current = { upload: t.upload, rename: t.rename, remove: t.remove };
      if (docInputRef.current) docInputRef.current.accept = t.accept;
      docInputRef.current?.click();
    },
    [],
  );
  const openAudioPicker = useCallback((endpoint: string) => {
    // Same ref-then-click shape as the image picker, and for the same
    // reason: the input's onChange fires after this returns, so the
    // endpoint has to be somewhere it can read synchronously.
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

  /**
   * Fetch oembed preview data for a video URL and stash it in pendingVideo
   * so the composer thumbnail card can render. FC's server also re-parses
   * the URL at post.create time — this call is purely for the preview UX
   * + early validation (URL that doesn't resolve to oembed → banner + no
   * attach). Errors surface via the top-of-app banner.
   */
  const attachVideo = useCallback(
    async (url: string, target: { endpoint: string; method: string }) => {
      if (!auth) {
        setAuthMessage('Please sign in to attach a video.');
        return;
      }
      // Stash for consistency with picker.image's ref-based flow — future
      // helpers reading oembedEndpointRef see the latest. The target param
      // is authoritative for this call.
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
        // Two possible failure envelopes: outer non-200 response wrapper,
        // or a null items on 200 (no oembed match).
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
  /**
   * The guest write guard — the simulator's copy of the mobile shell's.
   *
   * Noor's call: a signed-out viewer who taps like, comment or bookmark
   * goes to the LOGIN SCREEN rather than getting a toast. The action
   * strip still draws for them (design 17), so the tap has to lead
   * somewhere.
   *
   * Kept behaviourally identical to `requireAuthOrLogin` in
   * packages/mobile — the two surfaces sharing a renderer but not a
   * shell is exactly the seam that hides a whole class of bug (P86).
   */
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

  // Wire the template's native app-bar leading button (☰) to open our
  // Pages drawer. The renderer stamps data-appza-primitive-path on every
  // top-level SS child; child[0] is the leading slot on appbar-shell and
  // its variants, so we match any click landing inside an ion-header on
  // the children[0] wrapper.
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
      // If the leading slot already has an action wired (back button,
      // custom click), let it run — don't hijack.
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

  // Pull-to-refresh: pointer drag from the top of the phone viewport.
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

  /**
   * Handle picker.image: called by the hidden file input's onChange after
   * the user selects one or more images. Uploads each via multipart POST
   * to fcom-mobile's /feeds/media-upload proxy with Basic Auth, then
   * appends returned URLs to pendingImages state. Errors surface via the
   * top-of-app red banner. Uploads run in parallel; count is tracked so
   * we can show a "Uploading N…" indicator in the thumbnail strip.
   */
  /**
   * Upload the picked audio files and put them on the draft.
   *
   * Capped BEFORE uploading for the same reason the images are: uploading
   * everything and keeping the first N leaves orphaned FluentPlayer media
   * rows that nothing will attach and no endpoint removes.
   */
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

  /**
   * Upload the picked documents and put them on the draft.
   *
   * Sequential, not parallel: FluentCommunity writes a Media row per
   * call, and one file at a time is the only version of this whose
   * failure can be attributed to a file. No cap — FluentCommunity applies
   * none to `document_ids`.
   */
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
      // Cap BEFORE uploading, not after. Uploading everything and then
      // keeping the first N leaves the rest on the server as orphaned
      // inactive Media rows that nothing will ever attach or clean up —
      // and there is no endpoint to remove them (see removePostDraftImage).
      const max = getFcRuntimeSettings().composer.max_media_per_post;
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
              // No Content-Type — the browser sets multipart/form-data
              // with the correct boundary when body is FormData.
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
      // The cap is applied again here, against the draft as it stands
      // now: two picks can be in flight at once, and the slice above only
      // knew about the images that existed when IT started.
      if (urls.length > 0) addPostDraftImages(urls.map((url) => ({ url })), max);
    },
    [auth],
  );

  // Publish the viewer into the renderer's state bag. The simulator has
  // its own auth state (the in-app sign-in inside the device frame), and
  // it has to reach the same slice the mobile shell writes — otherwise a
  // `state.viewer.*` gate answers differently on the two surfaces, which
  // is exactly the seam P86 warns about.
  useEffect(() => {
    setViewer({
      is_logged_in: !!auth,
      user_id: auth && typeof auth.user_id === 'number' ? auth.user_id : null,
    });
  }, [auth]);

  // App-mode gate: when the user has no stored auth token, force the
  // login-page screen so they can't reach the composer / feed writes
  // before authenticating. Applies only when the App-mode preview is
  // active (Edit mode is a design-time surface — the auth gate would be
  // annoying and pointless there). Runs whenever uiMode flips to 'app'
  // or the catalog is loaded, and gets deferred until screens exist.
  //
  // Guest arc: on a site whose access level is `public` there is nothing
  // to force — a signed-out viewer reads the feed, and the login screen
  // is somewhere they GO when they try to write. Asking
  // canBrowseAsGuest() here is safe because applyFcRuntimeSettings runs
  // with the envelope, before any of this can fire.
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
    // overrides
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

  // Overlays shared by both modes. They mount inside the DeviceFrame's
  // overlaySlot — i.e. inside `.appza-device-viewport` — for two
  // reasons. Visually, they pin to the simulated phone instead of the
  // browser window. Structurally, that's the element whose click-capture
  // handler drives design-time selection, so a modal tagged per
  // designTimeAttrs.ts becomes selectable like anything else on screen.
  //
  // They must be mounted in Edit mode too: Edit-mode taps dispatch real
  // actions (a child's action onClick stops propagation before
  // AppZet-select runs), so the Add Member button opens its modal here
  // exactly as it does in App mode.
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
      <AddMemberModal />
      <InviteUserModal />
      <ScheduleSheet />
      <MediaViewer />
      <ChatMembersSheet />
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
          // Re-pull so the screen dropdown + Sidebar appzets reflect the
          // new template's snapshot immediately.
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
        onUiModeChange={(m) => {
          setUiMode(m);
          // Clear any active selection when leaving Edit so residual
          // property/primitive panels don't shadow the App-mode preview.
          if (m === 'app') {
            setSelectedAppzetSlug(null);
            setSelectedPrimitive(null);
            setLivePreview(null);
            setLivePrimitivePreview(null);
          } else {
            // Leaving App mode — reset nav stack so re-entering doesn't
            // pop back into a screen the user has since navigated away from.
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
            // Reset so selecting the same file again re-fires onChange
            e.target.value = '';
          }}
        />
      )}

      {/* Audio gets its OWN hidden input rather than sharing the image
          one: the accept list differs, and a shared input would need its
          `accept` swapped before every click — a race the picker would
          lose exactly when two glyphs are tapped in quick succession. */}
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

      {/* Documents get their own input for the same reason audio does —
          a different accept list, and no race over swapping it. */}
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

      {/* Images have LEFT this strip — the composer draws them now, in
          the card, where the designs put them. What remains is the
          upload-in-flight indicator. */}
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
            position: 'fixed',
            top: 60,
            right: 20,
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

      <div className="appza-body">
        <Sidebar
          sidebarTab={sidebarTab}
          onSelectTab={setSidebarTab}
          appzets={appzets}
          superstructures={superstructures}
          currentScreen={currentScreen}
          bottomTab={bottomTab}
          onSelectBottomTab={setBottomTab}
          bottomPanel={bottomPanel}
          selectedAppzetSlug={selectedAppzetSlug}
          onSelectAppzet={(slug) => {
            // Mirrors the device-preview selection, and is the way in for
            // an AppZet that no screen places — modals are opened by an
            // action, so they're only on screen once something opens them.
            setSelectedAppzetSlug(slug);
            setSelectedPrimitive(null);
            // Put an action-opened AppZet on the simulated screen, so
            // editing it is visual rather than blind. Close whatever
            // modal is already up first — two stacked cards would let
            // the builder edit one while looking at the other.
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
                  // Clicking the canvas background deselects. Overlays
                  // are exempt: selection inside a modal deliberately
                  // lets the click through (so the modal keeps working
                  // while you edit it), and without this guard that same
                  // click would arrive here and immediately undo the
                  // selection it just made.
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
            // ActionProvider wraps BOTH modes: in App mode it powers real
            // on_click_action wiring; in Edit mode it powers state-only
            // actions like spaces.set_tab / feed.set_sort / spaces.set_search
            // so segmented controls + toolbars still switch what's rendered
            // while the builder is in edit-select mode. Clicks that would
            // trigger network side-effects (post.create, space.join, etc.)
            // are still filtered by App-mode intercepts inside DeviceFrame.
            <ActionProvider dispatch={dispatchAction}>
              {uiMode === 'app' ? (
              <>
              <DeviceFrame
                key={`preview-${previewMode}-app`}
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
                          // The review modal stays open across its own
                          // confirm — that dialog can be cancelled, so
                          // closing when the CTA was merely TAPPED would be
                          // a lie. It closes here, on the write landing.
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
              ) : (
                <DeviceFrame
                  key={`preview-${previewMode}-edit`}
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

        {selectedPrimitive && (() => {
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

        {!selectedPrimitive &&
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
            // Look up the AppZet's data source slug so the panel can
            // re-use useDataSource and hide slot-groups whose runtime
            // data isn't there (e.g. CTA 4 when the API returns 3).
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

      {/* Small pill in the corner to reopen the "Select App" wizard.
          Hidden until the first-mount check has run so it doesn't flash
          before we know whether to auto-open. */}
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
            // Activation set changed → refresh the Template dropdown and
            // re-pull the bootstrap so any Source-scoped catalog updates
            // are reflected.
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

// Pipe FluentCommunity portal settings from the bootstrap envelope into
// the renderer's fcRuntimeSettings store. Mirrors the mobile shell path
// EXACTLY — the two shells dispatch the same actions and render the same
// components, so a setting honoured in one and not the other is a bug
// the simulator cannot show you (P100).
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

/** Non-empty strings only — blank author fields fall back to defaults. */
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/**
 * A modal AppZet's authored props, read off the snapshot the shell
 * already holds. Lets an action open a modal without duplicating any
 * of its copy into the opener's args (P66).
 */
/**
 * Customizations as the canvas currently sees them — saved overrides
 * plus any unsaved live-preview edit from the Properties panel.
 *
 * Composed AppZets get this applied for free inside PlacementRenderer.
 * Overlays are opened imperatively from here instead, well outside that
 * render path, so without this mirror they'd render pure catalog
 * defaults: a saved Options edit wouldn't show, and a live edit couldn't.
 * Kept module-level because the action handler is module-level too.
 */
let currentCustomizations: unknown = null;

function setCustomizationsForActions(customizations: unknown): void {
  currentCustomizations = customizations;
}

/**
 * An AppZet's props with overrides resolved — the same three layers the
 * renderer applies (catalog default, customer override, live edit).
 */
/**
 * The `args` an AppZet's action wiring carries, straight off the catalog.
 *
 * Used to read the composer's space-picker endpoint at screen mount,
 * where there is no placement in the tree to resolve it — the same
 * problem readAppzetPropsFromCatalog solves for overlay props. Reading
 * it rather than writing the path down is what keeps the mount-time warm
 * and the picker itself pointed at the same list.
 */
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

/**
 * Open the schedule sheet on the composer draft.
 *
 * Module-level for the same reason the poll one is: two callers in
 * different worlds — the `picker.schedule` action and the strip's
 * "Edit" window event — and one implementation so they cannot drift.
 */
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

/**
 * Open the "Create poll" sheet with the catalog's own copy and colours.
 *
 * Module-level rather than a callback because it has two callers that
 * live in different worlds: the `picker.poll` action, dispatched from a
 * plain function, and the composer strip's "Edit", which arrives as a
 * window event. One implementation means the sheet the glyph opens and
 * the sheet Edit opens cannot drift.
 */
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
    // An option carrying a server-issued slug is one the post already
    // has votes against, which is what "existing" means here: the type
    // freezes and those rows stop being removable.
    existing: !!poll && poll.options.some((o) => !!o.slug),
  });
}

/**
 * Finds the action wiring that opens `slug`, so selecting an
 * action-opened AppZet in the sidebar can put it on screen instead of
 * leaving the builder editing something invisible.
 *
 * Read out of the catalog rather than hardcoded: any AppZet wiring that
 * points at a form via a `*_appzet_slug` arg is an opener, so a customer
 * variant (`acme-invite-modal`) works with no shell change. Self-
 * references are skipped — fc-post-information names itself in its own
 * picker wirings, and "opening" it would fire a poll/emoji picker.
 */
/**
 * Load a post's attached files into the document draft when its edit
 * screen opens.
 *
 * Seeds for EVERY post now, not only document ones. It used to reset the
 * draft for anything else, which left `edit_feed_id` null — and the file
 * block hides itself on an unseeded draft, so a plain text post could
 * never gain its first document. Where the block BELONGS is decided by
 * the placement's `state.post_draft.can_edit_documents` gate instead: the
 * space must take documents, and the post must not already carry images,
 * a video or a poll.
 *
 * A post with no documents seeds `seeded_file_count = 0`, and that is
 * the interlock that keeps this safe: the submit path leaves
 * `document_ids` out entirely unless files were actually added, so "the
 * user removed them all" still cannot be confused with "there were never
 * any".
 */
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
  // `files` is added by the preview proxy. `meta.document_lists` is
  // FluentCommunity's own snapshot and is always on a document post, so
  // it is the fallback that keeps this from ever seeding empty — an
  // empty seed would make Save look like "the user removed everything".
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

/** Endpoints always come from the catalog, never a literal in the shell. */
function readDataSourceEndpointFromCatalog(
  catalog: Catalog | null,
  slug: string,
): string | null {
  const ds = catalog?.data_sources?.find((d) => d.slug === slug);
  return ds && typeof ds.endpoint === 'string' && ds.endpoint ? ds.endpoint : null;
}

/**
 * The invitation endpoints answer HTTP 200 and carry the real outcome
 * in response.status, so the HTTP status alone would read a 403 as a
 * success. Their message is worth surfacing verbatim — it is what
 * distinguishes "joined the space right away" from "invitation
 * emailed".
 */
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

/**
 * The async Clipboard API only exists on secure origins, and the WP
 * dev site is plain http — so fall back to the execCommand path there
 * rather than leaving Copy Link silently dead.
 */
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
  // The guest write guard. Navigates to the login screen and returns
  // false when nobody is signed in.
  requireAuthOrLogin: () => boolean;
  onLoginSuccess: () => void;
  onMenuInfo: (message: string) => void;
  onMenuError: (message: string) => void;
  openImagePicker: (target: { endpoint: string; method: string }) => void;
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
    /** Extra body keys — a comment carries its post's id too. */
    extraBody?: Record<string, unknown>;
    /** Names the act in the failure toast — see PendingDelete. */
    failLabel?: string;
  }) => void;
  // Session-scoped tracker of (feed_id, react_type) pairs the viewer has
  // toggled on. Passed as a mutable Set so the dispatcher can add/delete
  // without re-render. Cleared on logout.
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
    /**
     * Set by comment.reply — the panel opens with the composer already
     * aimed at this comment. Mirrors the mobile shell exactly; the two
     * panels are twins and must not drift.
     */
    replyTo?: { id: number | string; name: string };
    /** Set by comment.edit — prefilled draft, PUT /comments/update. */
    edit?: {
      commentId: number | string;
      message: string;
      parentBodyKey: string;
      toastMessage: string;
    };
  }) => void;
  // Screen-mount context set by nav.push(pass_item_as_context=true) and
  // read by post.edit to resolve feed_id from the passed post, since the
  // composer form itself doesn't carry the id.
  screenContextRef: React.MutableRefObject<Record<string, unknown>>;
  // Companion "already prefilled" flag ref. Cleared by nav.push so a
  // fresh Edit tap re-prefills; consumed by the prefill useEffect.
  screenPrefilledRef: React.MutableRefObject<Record<string, true>>;
};

/**
 * Auth token bag persisted in localStorage. Written by auth.login on
 * successful /fcom-login POST; read by HTTP write actions (post.create,
 * etc.) to construct the Authorization: Basic <base64(username:token)>
 * header. Cleared by auth.logout.
 *
 * WP Application Password model — the token IS the password (opaque to
 * us), Basic-Auth against WP's REST API validates it. Renderer never
 * decodes / mints it; sim just stores + replays.
 */
const AUTH_STORAGE_KEY = 'appza:auth';

type StoredAuth = {
  username: string;
  token: string;
  display_name?: string;
  avatar?: string;
  // WP user id returned by /fcom-login. Threaded to the renderer via
  // `window.__appzaCurrentUserId` so per-item reaction enrichment can
  // decide whether the viewer has liked / bookmarked each feed.
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
    // Notify any interested subscribers (dataFetch's auth-header injector
    // reads on every request so no listener needed; App re-render is
    // driven by the setter that wraps this call).
  } catch {
    /* localStorage unavailable — sim just runs unauthenticated */
  }
}

/**
 * Build the HTTP Basic Auth header for a stored WP Application Password.
 * Exported so dataFetch can inject it on authenticated read endpoints
 * later; App.tsx uses it directly for post.create writes.
 */
function basicAuthHeader(auth: StoredAuth): string {
  return 'Basic ' + window.btoa(`${auth.username}:${auth.token}`);
}

/**
 * Ionicon + Ionic-theme-color pairs for the outline / filled variants of
 * each reaction type. Add a row here when a new react_type ships.
 * `childPath` is the SS path of the reaction button on fc-post-card;
 * `countPath` is the paired count text (null when the card doesn't show
 * one, e.g. bookmark).
 */
// Reaction visual config — matches the mobile App's REACTION_UI. Now
// keyed by semantic `on_tap_*` action name so we don't need per-variant
// child-index tables. Works for timeline (children[10]), card
// (children[6]) and list (children[5]) uniformly.
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

/**
 * Optimistic UI update for like / bookmark. Finds every rendered card
 * matching `feedId` (data-appza-item-id, stamped by PlacementRenderer),
 * flips the reaction button's ion-icon + color, and — for `like` — nudges
 * the paired count text by ±1 so the visible count stays honest. All
 * mutation is DOM-level so we skip a React re-render + avoid the full
 * feed refetch flash. Caller reverts on HTTP failure by calling this
 * again with the opposite `on` flag.
 */
function applyReactionOptimistic(feedId: number, reactType: string, on: boolean) {
  const cfg = REACTION_UI[reactType];
  if (!cfg) return;
  const wrappers = document.querySelectorAll<HTMLElement>(
    `[data-appza-item-id="${CSS.escape(String(feedId))}"]`,
  );
  wrappers.forEach((wrapper) => {
    // Query by semantic action attribute → variant-independent.
    const btn = wrapper.querySelector<HTMLElement>(
      `[data-appza-action="${cfg.actionName}"]`,
    );
    if (btn) {
      const nextIcon = on ? cfg.iconOn : cfg.iconOff;
      const nextColor = on ? cfg.colorOn : 'medium';
      // Use resolveIcon() so we pass the imported SVG data via `icon=`,
      // not a bare kebab `name=`. Ionicons' built-in name registry does
      // NOT include 'heart' / 'bookmark' unless addIcons() was called,
      // which we don't do (we ship a static import registry instead).
      // Fall back to the outline variant, then to the current icon so
      // we NEVER blank an icon out (that would make the button look
      // "hidden" after a tap — the user's #1 complaint).
      const resolved =
        resolveIcon(nextIcon) ||
        resolveIcon(cfg.iconOff) ||
        resolveIcon(cfg.iconOn);
      if (!resolved) return; // no valid icon at all → leave DOM alone
      btn.querySelectorAll<HTMLElement>('ion-icon').forEach((ic) => {
        ic.removeAttribute('name');
        ic.removeAttribute('src');
        ic.setAttribute('icon', resolved);
      });
      btn.querySelectorAll<HTMLElement>('ion-button').forEach((b) => {
        b.setAttribute('color', nextColor);
      });
    }
    // Locate the count-text wrapper via the explicit primitive-path
    // declared in REACTION_UI. `countPathTimeline: null` means the
    // reaction has no visible count (bookmark), so skip entirely —
    // the previous nextElementSibling fallback wrongly targeted
    // children[13] "N likes" when tapping bookmark, causing the like
    // count to shift on every bookmark click (user-reported bug).
    // For like on the timeline card, `countPathTimeline` is
    // 'children[13]'; do NOT use sibling (which is the comment button).
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
      // Preserve trailing " likes"/"like" if the timeline variant has
      // it; card + list use raw integers with no suffix.
      const suffix = text.replace(/^\s*\d+/, '').trim();
      target.textContent = suffix ? `${next} ${suffix}` : String(next);
    }
  });
}

/**
 * Fires the app-side "refetch every mounted data source" signal + sets
 * the proxy-cache bypass window so a re-mounting AppZet's first fetch
 * still bypasses the 5-min transient. Used after write actions
 * (post.create / delete, comment.create) so counts reflect server truth.
 */
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


/**
 * Read a value out of a rendered form field by its DOM path attributes.
 * Composer/login forms don't have a formal FormState provider yet — the
 * SS-child wrappers already carry data-appza-appzet-slug +
 * data-appza-primitive-path from SuperstructureRenderer, so we scope the
 * lookup to a specific AppZet's children[i] wrapper and pull the value
 * off whichever Ionic input lives inside.
 *
 * `path` is the same grammar as param_map values in action args —
 * `children[1].value` picks up the text; `children[N].checked` picks up
 * a checkbox; `children[N].selectedValue` picks up a native select.
 */
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

/**
 * Resolve a feed id off a screen-mount context blob (a bound feed post
 * item stashed by nav.push(pass_item_as_context=true)). `feedIdPath` is
 * the same grammar as post.delete/report — `data.<key>` or `<key>`.
 * Returns null when the value can't be coerced to a positive integer.
 */
function resolveFeedIdFromContext(ctx: unknown, feedIdPath: string): number | null {
  if (!isRecord(ctx)) return null;
  const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
  // Try data.<key> first (envelope shape); fall back to top-level (raw shape).
  const source =
    isRecord((ctx as Record<string, unknown>).data)
      ? ((ctx as Record<string, unknown>).data as Record<string, unknown>)
      : (ctx as Record<string, unknown>);
  const raw = source[key];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return null;
}

/**
 * Resolve an action's param_map (keys → children[i].value paths) into a
 * flat request body. Missing/empty values pass through as empty strings
 * so the server sees them (and returns its own validation error) rather
 * than us hiding the field entirely.
 */
/**
 * Read one `param_map` source.
 *
 * Two vocabularies, because the composer has two kinds of field. A
 * `children[i].prop` path reads the rendered DOM, which is right for a
 * form built out of generic primitives. A `draft.<field>` path reads the
 * postDraft slice, which is the only thing that works for the create-post
 * composer: chunk 1 replaced its eleven loose primitives with one bespoke
 * one, so there is no `children[3]` input to read the message out of any
 * more — `readFormFieldValue` finds the audio BUTTON at that index and
 * answers null.
 *
 * That is what had been happening. The param_map still named the old
 * indices, so `message` collected as '' and every Post short-circuited on
 * "Write something to post." with no request made.
 */
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
    // `?? ''` and not `|| ''`: an empty topic list is a real answer and
    // has to stay an array, or FC receives the string '' where it
    // expects one and rejects the post.
    out[name] = v ?? '';
  }
  return out;
}

/**
 * Find the AppZet that owns a given action wiring on the current screen.
 * The dispatcher receives the action_slug + args but not the owning
 * AppZet. For auth.login on the login screen only one AppZet declares
 * the login action, so we scan the current screen's placements for the
 * matching action_slug + event.
 *
 * Returns the appzet_slug or null. For screens where multiple AppZets
 * declare the same action_slug, first-match wins — acceptable v1 since
 * mixed-action screens aren't in the FC catalog today.
 */
function findAppzetForAction(
  catalog: Catalog | null,
  currentScreenId: number | null,
  action_slug: string,
): string | null {
  if (!catalog || currentScreenId == null) return null;
  const screen = catalog.template_screens?.find((s) => s.id === currentScreenId);
  if (!screen) return null;
  const placements = (screen as unknown as Record<string, unknown>).placements;
  if (!Array.isArray(placements)) return null;
  for (const p of placements) {
    if (!p || typeof p !== 'object') continue;
    const slug = (p as Record<string, unknown>).appzet_slug;
    if (typeof slug !== 'string') continue;
    const appzet = catalog.appzets?.find((a) => a.slug === slug);
    if (!appzet) continue;
    const actions = (appzet.actions ?? null) as Record<string, unknown> | null;
    if (!actions) continue;
    for (const wiring of Object.values(actions)) {
      if (wiring && typeof wiring === 'object' && !Array.isArray(wiring)) {
        const rec = wiring as Record<string, unknown>;
        if (rec.action_slug === action_slug) return slug;
      }
    }
  }
  // Also check the screen's own appbar_placements — the create-post
  // appbar's Post button lives outside the main slot.
  const appbar = (screen as unknown as Record<string, unknown>).appbar_placements;
  if (Array.isArray(appbar)) {
    for (const p of appbar) {
      if (!p || typeof p !== 'object') continue;
      const slug = (p as Record<string, unknown>).appzet_slug;
      if (typeof slug !== 'string') continue;
      const appzet = catalog.appzets?.find((a) => a.slug === slug);
      if (!appzet) continue;
      const actions = (appzet.actions ?? null) as Record<string, unknown> | null;
      if (!actions) continue;
      for (const wiring of Object.values(actions)) {
        if (wiring && typeof wiring === 'object' && !Array.isArray(wiring)) {
          const rec = wiring as Record<string, unknown>;
          if (rec.action_slug === action_slug) return slug;
        }
      }
    }
  }
  return null;
}

/**
 * App-mode action executor for the plug-in admin sim. Same nav semantics
 * as the Capacitor shell so what admins see matches what customers get:
 *   - nav.push : switch selected screen by args.target_screen_slug,
 *     stash current on a back stack.
 *   - nav.back : pop.
 *   - link.open : window.open new tab.
 *   - post.create + other mutating actions : LOG ONLY. Deliberate — an
 *     admin previewing the composer shouldn't create real feed posts.
 *     Real submission stays confined to the Capacitor build; when
 *     form-state capture ships, we'll add a `dry_run=1` proxy flag so
 *     App mode can safely round-trip through the server too.
 */
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
  // Per-invocation item root. `binding_root` on the AppZet action wiring
  // sub-selects a slice of the item — e.g. `data.ctaButtons[0]` picks the
  // first CTA object so link.open resolves url/newTab against THAT rather
  // than the whole banner payload.
  const effectiveItem = binding_root ? readDataPath(item, binding_root) ?? item : item;
  const itemRec = isRecord(effectiveItem) ? (effectiveItem as Record<string, unknown>) : null;

  switch (action_slug) {
    case 'nav.push': {
      const targetSlug =
        typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : null;
      if (!targetSlug || !catalog) return;
      // A fresh composer starts empty. This is the ONLY place that can
      // tell "opened the composer" from "came back to it": the preview is
      // its own screen, so returning from it changes the screen slug
      // exactly the way arriving does, and a reset keyed on the slug
      // wipes the draft the user just went to look at.
      // Both composer screens start clean, and edit-post-page MUST:
      // nothing else clears the draft between visits, so an abandoned
      // create-post draft would leak into an edit of an unrelated post,
      // carrying its images, its poll and its schedule onto someone
      // else's words. The prefill repopulates from the bound item. Only
      // nav.push can tell arriving from returning (P111).
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
      // Carry the tapped item into the target screen's context BEFORE
      // switching, so the useEffect watching selectedScreenId sees it on
      // the very first render pass (avoids a one-tick empty-form flash).
      // Consumed by fc-post-information prefill + post.edit's feed_id
      // resolution on edit-post-page. Also clear the "already prefilled"
      // flag for the target so a fresh Edit tap on a different post
      // re-prefills instead of skipping.
      if (argRec.pass_item_as_context === true && effectiveItem != null) {
        screenContextRef.current[targetSlug] = effectiveItem;
        delete screenPrefilledRef.current[targetSlug];
        // Editing a document post: seed the file editor from the post the
        // menu passed us. Any other kind clears the draft, so the block
        // stays hidden and Save doesn't carry stale document_ids.
        if (targetSlug === 'edit-post-page') {
          seedEditDraftFromPost(effectiveItem);
        }
        // Populate route params from the passed item so DS query_params
        // with `source: 'route_param'` (e.g. fc-space-detail.slug,
        // fc-space-feeds.space_slug) resolve on the destination screen.
        // Same convention as mobile shell — keeps sim + real app in sync.
        if (isRecord(effectiveItem)) {
          const ctx = effectiveItem as Record<string, unknown>;
          const routeBag: Record<string, unknown> = {};
          // Nested space slug on a post item wins for route.slug —
          // edit-post-page's topic dropdown DS is fc-space-detail, which
          // needs the SPACE slug. Without this, ctx.slug (the post slug)
          // clobbers route.slug and the topic dropdown's options DS
          // returns nothing (observed: [appza-prefill] optionValues=[""]
          // → topic prefill can't match). Carry post slug as post_slug.
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
              // Always land on POSTS + no topic filter when opening a
              // (possibly different) space. Otherwise stale localStorage
              // from a prior visit — e.g. user last tapped CHAT — leaves
              // POSTS content hidden and shows "Coming soon" instead.
              setSpaceDetailControls({
                space_slug: routeBag.slug,
                active_subtab: 'posts',
                topic_slug: '',
              });
            }
          }
        }
      }
      // Whose profile is being opened. The header and the POSTS tab both
      // read `profile_controls.member_id`, so one number decides both —
      // and the two profile screens differ only in where it comes from:
      // the bottom-nav one is always the VIEWER, a member card carries
      // the person it was tapped on.
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
      // Accept the action's canonical `url`/`new_tab` names AND the
      // fcom-mobile API's `link`/`newTab` names so binding_root against a
      // raw ctaButtons entry Just Works without a rename in the proxy.
      // `permalink` joins them for the feed-link chips, which bind their
      // row straight through and where that is FluentCommunity's word.
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
      setAuth(null);
      // The picker's payload is one viewer's answer to "where may I
      // post" — spaces, permissions, moderator verdict. Signing out must
      // drop it, or the next person to sign in on this device opens the
      // composer holding the previous one's destinations.
      clearPostSpaceCache();
      resetPostDraft();
      // Force login screen after logout so the user sees the state change.
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
      // Real HTTP login. Reads username/password out of the login form's
      // ion-inputs via DOM path attributes, POSTs to the endpoint in args,
      // stores the returned {username, token, display_name, avatar} in
      // localStorage, and navigates to args.on_success_screen (home).
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
      const owningAppzet = findAppzetForAction(catalog, currentScreenId, 'auth.login');
      if (!owningAppzet) {
        console.warn('[appza-admin/app-mode] auth.login: no owning appzet found on current screen');
        return;
      }
      const body = collectParams(owningAppzet, paramMap);
      // Fire-and-forget promise (dispatcher signature is sync). Errors surface
      // via onLoginError toast; success drives nav + auth state.
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
      // Real HTTP feed create. Reads message/title/space_id from the
      // create-post form via DOM path attributes, POSTs to args.endpoint
      // with Basic Auth (from the stored login token), on 200 → nav.back +
      // fires appza:refresh-data so the feed reloads with the new post.
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const paramMap = argRec.param_map && typeof argRec.param_map === 'object'
        ? (argRec.param_map as Record<string, unknown>)
        : undefined;
      const composerAppzet =
        (typeof argRec.form_appzet_slug === 'string' && argRec.form_appzet_slug) ||
        // Fallback: look for whichever AppZet on the current screen carries
        // the composer form. fc-post-information is the well-known name.
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
      // FC's /feeds endpoint refuses empty message with a 422; short-circuit
      // to a clearer error before hitting the wire.
      if (!body.message || (typeof body.message === 'string' && !body.message.trim())) {
        onLoginError('Write something to post.');
        return;
      }
      // Attach uploaded images (from picker.image) — FC's sanitizeAndValidateData
      // reads `media_images: [{url, provider}]` and materializes them into
      // meta.media_items / meta.media_preview on the created feed. content_type
      // gets flipped to 'image' so the feed renders as an image post.
      if (pendingImages.length > 0) {
        body.media_images = pendingImages.map((url) => ({ url, provider: 'uploader' }));
        body.content_type = 'image';
      }
      // Attach video oembed (from picker.video). FC's processFeedMetaData
      // sees media.type=oembed and re-parses the URL server-side to build
      // meta.media_preview (thumbnail, title, embed html). Image + video
      // are mutually exclusive in FC's model — video wins if both present
      // (content_type is single-valued).
      // The draft's video, in whichever of the three shapes it came from.
      // FluentCommunity takes an oEmbed by URL and re-parses it; a pasted
      // iframe and a FluentPlayer upload go as `html` and `media_id`, the
      // two shapes its own composer sends.
      const draftVideo = getPostDraft().video;
      if (draftVideo) {
        // ONE builder for both shells and both verbs. The three shapes
        // FluentCommunity accepts are not guessable from the field names
        // — see the note on buildVideoMediaPayload — and a payload
        // written out four times is a payload that drifts (P100).
        //
        // No `content_type` is set: FeedsHelper::sanitizeAndValidateData
        // rebuilds the payload from scratch and discards the request's,
        // so 'oembed' was a no-op on create. On EDIT it is worse than a
        // no-op — a content_type that differs from the post's fires
        // `updating_content_type_old_<existing>`, and for a document post
        // that hook DELETES its files.
        const mediaPayload = buildVideoMediaPayload(draftVideo);
        if (mediaPayload) body.media = mediaPayload;
      }
      // Audio rides alongside whatever else is attached rather than
      // replacing it: FluentCommunity stores meta.audio_medias
      // independently of content_type. The server re-checks ownership and
      // re-applies the per-post cap, so this only has to name the files.
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
      // Attach poll (survey). FC reads survey.options[].label + survey.type,
      // slugs each option server-side (opt_1, opt_2, …) on create + sets
      // content_type = 'survey'. Poll overrides video/image if all three
      // are present — polls are their own post shape in FC's model.
      // post.create doesn't have existing slugs so we omit them; the
      // create endpoint doesn't care and would just re-assign anyway.
      // Documents take the whole post: FluentCommunity's document
      // filter runs after everything else and sets content_type itself,
      // so a draft carrying documents plus other media would post as a
      // document and drop the rest into meta where nothing draws it. The
      // draft enforces the exclusivity, so by here it is one or neither.
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
      // Design 10's schedule. FluentCommunity Pro takes it on the create
      // request, requires it to be at least 30 minutes out, and sets
      // `status = 'scheduled'`. It is ignored SILENTLY for a
      // non-moderator, which is why the glyph that sets it is gated —
      // by the time a value is here, the viewer has already been vetted.
      const draftSchedule = getPostDraft().scheduled_at;
      if (draftSchedule !== '') body.scheduled_at = draftSchedule;

      const draftPoll = getPostDraft().poll;
      if (draftPoll && draftPoll.options.length >= 2) {
        body.survey = {
          type: draftPoll.type,
          options: draftPoll.options.map((o) => ({ label: o.label })),
          // '' is meaningful: FluentCommunity stores an empty end_date
          // as "this poll never closes", which is what the sheet's
          // untouched "Add end date" row means.
          end_date: draftPoll.end_date,
        };
        body.content_type = 'survey';
      }
      void (async () => {
        try {
          const res = await fetch(endpoint, {
            method,
            // Explicit `omit` — same-origin fetch would send WP admin
            // cookies alongside our Authorization header. WP's cookie-auth
            // path fires first for cookie-bearing REST writes and demands
            // an X-WP-Nonce we don't have, returning 401 before
            // Application Passwords gets its turn. Omitting cookies forces
            // WP straight to Basic Auth via the Authorization header.
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
          // Success → pop back to feed and force a data refresh so the
          // new post appears at the top. Also clear pending image + video
          // attachments so the next draft starts empty.
          clearPendingImages();
          clearPendingVideo();
          setScreenStack((prev) => {
            if (prev.length === 0) return prev;
            const rest = prev.slice(0, -1);
            setSelectedScreenId(prev[prev.length - 1] ?? null);
            return rest;
          });
          // Defer the refresh event until after React commits the nav —
          // otherwise the feed's useDataSource hasn't mounted yet, misses
          // the event, and shows a cached (stale) response. Two dispatches
          // + a global marker cover the race for slow mounts.
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

    // A comment's delete is the post's, with a second id and different
    // wording. Same confirm dialog on purpose — design 24 shows no
    // separate one, and two dialogs would drift.
    //
    // Remove Preview rides here too (design 22). It is the same shape all
    // the way down — confirm, POST the id, refetch — and the same stakes:
    // FluentCommunity nulls meta.media_preview with no undo. Every word
    // of its dialog comes from the action's param_schema, so the copy
    // matching FC's own is a catalog fact rather than a branch here.
    case 'comment.delete':
    case 'post.remove_preview':
    // Both review CTAs (designs 31, 32). Same shape again —
    // confirm, POST an id, refetch — with the STATUS riding in
    // extraBody and the id being the report's rather than the
    // post's. FluentCommunity marks every report on the content
    // and republishes or unpublishes it from that one call.
    case 'moderation.set_status':
    case 'post.delete': {
      // Overflow-menu → delete. Read feed_id off the tapped item using the
      // action's `feed_id_path` binding (defaults to `data.id`) and open the
      // confirm modal; the modal fires the actual DELETE on user confirm.
      // Requires login (Basic Auth on the write). The endpoint owns
      // authorization — server 403s a non-owner attempt; we just surface the
      // error message via the same toast auth.login uses.
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const feedIdPath = typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      // Body-payload key the endpoint expects for the item id (e.g. FC's
      // /feeds/delete reads `feed_id`; a different Source could expect
      // `post_id`, `id`, etc.). Defaults to `feed_id` for parity with FC.
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
      // readDataPath expects a `data.` prefix but the item passed here is the
      // item root itself (proxy already unwrapped). Resolve either way:
      // strip the prefix if present and index directly.
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
      // The parent id, when the action names one.
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
      const moderationStatus =
        action_slug === 'moderation.set_status' && typeof argRec.status === 'string'
          ? argRec.status
          : null;
      openDeleteConfirm({
        feedId, endpoint, method, bodyKey, title, message, cta,
        extraBody: moderationStatus ? { ...(extraBody ?? {}), status: moderationStatus } : extraBody,
        failLabel: action_slug === 'post.remove_preview' ? 'Remove preview' : 'Delete',
      });
      return;
    }

    // ── Post 3-dot overflow menu ──────────────────────────────────────
    // Simulator preview only opens the popover; the individual post.*
    // action cases (copy_link, report, edit, pin_top, pin_sidebar,
    // disable_comments) are handled fully in the mobile shell. Tapping
    // an item in the simulator will log a no-op warning — that's fine
    // for preview UX, and matches what post.delete already does here.
    // The COMMENT menu (designs 24, 25) — same popover, different list.
    // The popover is about GATED ROWS, not about posts: every row's
    // visible_when resolves against whatever item was bound, and the
    // comment strip binds a comment.
    // The chevron on a voted poll row (designs 8, 9, 11, 12). Endpoint
    // comes from the action's args — the action declares no write
    // metadata, because ActionHttpMethod is writes-only by decision
    // (DC#12 Q6).
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

    // ── Moderation review (designs 29 to 32) ─────────────────────────
    // Opens the modal over the flagged content. The DETAILS tab is drawn
    // from the item already in hand — the row that showed the banner IS
    // the post — so only the reports are fetched.
    case 'moderation.review': {
      const endpoint =
        typeof argRec.endpoint === 'string' && argRec.endpoint
          ? argRec.endpoint
          : '/wp-json/fcom-mobile/api/v1/moderation/reports';
      const contentType =
        typeof argRec.content_type === 'string' ? argRec.content_type : 'post';
      // post_id for a post, parent_id for a comment. FluentCommunity Pro
      // does not error on the wrong one — it returns every report on the
      // site — so this is never guessed here.
      const idParam = typeof argRec.id_param === 'string' ? argRec.id_param : 'post_id';
      const idPath = typeof argRec.id_path === 'string' ? argRec.id_path : 'data.id';
      const idKey = idPath.startsWith('data.') ? idPath.slice(5) : idPath;
      const contentId = itemRec ? (itemRec as Record<string, unknown>)[idKey] : undefined;
      if (typeof contentId !== 'number' && typeof contentId !== 'string') {
        onLoginError('Could not identify which content to review.');
        return;
      }
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : 'fc-moderation-review';
      const presentation = moderationReviewPresentation(readAppzetPropsFromCatalog(sheetSlug));
      const rec = (itemRec ?? {}) as Record<string, unknown>;
      const xp = isRecord(rec.xprofile) ? rec.xprofile : undefined;
      const space = isRecord(rec.space) ? rec.space : undefined;
      openModerationReview({
        endpoint,
        idParam,
        contentId,
        contentType,
        content: {
          title: typeof rec.title === 'string' ? rec.title : undefined,
          bodyHtml:
            typeof rec.message_rendered === 'string' ? rec.message_rendered : undefined,
          authorName: xp && typeof xp.display_name === 'string' ? xp.display_name : undefined,
          authorAvatar: xp && typeof xp.avatar === 'string' ? xp.avatar : undefined,
          spaceTitle: space && typeof space.title === 'string' ? space.title : undefined,
          reportedAt: typeof rec.created_at === 'string' ? rec.created_at : undefined,
        },
        presentation,
        authHeader: auth ? basicAuthHeader(auth) : undefined,
        onAct: (status, reportId) => {
          const isDismiss = status === 'ignored';
          // Re-enters this same handler, the way media.open_post and the
          // chat card's actions already do — the admin shell has no
          // dispatch closure, only this function and its deps bag.
          handleAppModeAction({
            action_slug: presentation.setStatusActionSlug,
            args: {
              ...(readActionDefaultsFromCatalog(presentation.setStatusActionSlug) ?? {}),
              status,
              confirm_title: isDismiss
                ? presentation.dismissConfirmTitle
                : presentation.unpublishConfirmTitle,
              confirm_message: isDismiss
                ? presentation.dismissConfirmMessage
                : presentation.unpublishConfirmMessage,
              confirm_cta: isDismiss
                ? presentation.dismissConfirmCta
                : presentation.unpublishConfirmCta,
            },
            // The dispatcher resolves the id off the bound item, and the
            // id it needs is the REPORT's, not the post's.
            item: { id: reportId },
          }, deps);
        },
      });
      return;
    }

    case 'comment.options':
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
      // `presentation: 'sheet'` draws the same rows as design 4's bottom
      // sheet instead of the anchored popover. The catalog decides; the
      // rows, their per-viewer visibility and their toggle labels are
      // identical either way, which is the point of doing it here rather
      // than with a second action.
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

    // Five catalog-driven post-menu actions (copy_link, pin_top,
    // pin_sidebar, disable_comments, report) share their implementation
    // with the mobile shell via @appza/renderer's tryHandlePostMenuAction.
    // Edit is NOT in this set — it now dispatches from the appbar CTA on
    // edit-post-page (a full form flow), see the post.edit case below.
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

    // The profile header cluster's four follow actions. Real HTTP here,
    // not a sim log: the simulator signs in the same way and these are
    // the same fcom-mobile routes the phone calls, so keeping them
    // shared is what stops the two shells drifting.
    case 'user.follow':
    case 'user.unfollow':
    case 'user.notify_subscribe':
    case 'user.notify_unsubscribe': {
      tryHandleProfileAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onMenuError,
        onInfo: onMenuInfo,
      });
      return;
    }

    // Save on the profile edit form. Kept in step with the phone: same
    // shared handler, same collector contract, so the form the simulator
    // shows is the form the device posts.
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
      // Real HTTP feed update, dispatched from fc-edit-post-appbar's Save
      // button on edit-post-page. Mirrors post.create except (a) body
      // includes an `id` field resolved from the screen-mount context
      // (the passed post from the 3-dot menu's nav.push), and (b) POSTs
      // to /feeds/update instead of /feeds/create. On success it pops
      // back and dispatches appza:refresh-data so the feed picks up the
      // edited message + title.
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
      // Resolve feed id off the screen-mount context (the passed post
      // from the 3-dot menu's nav.push). The composer form itself has no
      // id field, so context IS the source of truth here.
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
      // Attach media the same way post.create does — otherwise Save on a
      // post that had images / video / poll would drop them because the
      // update endpoint reads the same shape as create. On edit-post-page
      // the prefill effect already hydrated pendingImages / pendingVideo
      // from the item's meta (the poll goes onto the draft), so submitting untouched
      // round-trips the existing media. Precedence: survey > oembed >
      // image > text (matches post.create).
      if (pendingImages.length > 0) {
        body.media_images = pendingImages.map((url) => ({ url, provider: 'uploader' }));
        body.content_type = 'image';
      }
      // The draft's video, in whichever of the three shapes it came from.
      // FluentCommunity takes an oEmbed by URL and re-parses it; a pasted
      // iframe and a FluentPlayer upload go as `html` and `media_id`, the
      // two shapes its own composer sends.
      const draftVideo = getPostDraft().video;
      if (draftVideo) {
        // ONE builder for both shells and both verbs. The three shapes
        // FluentCommunity accepts are not guessable from the field names
        // — see the note on buildVideoMediaPayload — and a payload
        // written out four times is a payload that drifts (P100).
        //
        // No `content_type` is set: FeedsHelper::sanitizeAndValidateData
        // rebuilds the payload from scratch and discards the request's,
        // so 'oembed' was a no-op on create. On EDIT it is worse than a
        // no-op — a content_type that differs from the post's fires
        // `updating_content_type_old_<existing>`, and for a document post
        // that hook DELETES its files.
        const mediaPayload = buildVideoMediaPayload(draftVideo);
        if (mediaPayload) body.media = mediaPayload;
      }
      // Audio rides alongside whatever else is attached rather than
      // replacing it: FluentCommunity stores meta.audio_medias
      // independently of content_type. The server re-checks ownership and
      // re-applies the per-post cap, so this only has to name the files.
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
      // The composer's documents are deliberately NOT read here.
      // post.edit already owns documents through the edit screen's own
      // slice (fc-edit-document-files → documentDraft), which knows what
      // the post's files WERE and can tell "the user removed them all"
      // from "we never learned what they were" — a distinction that
      // matters because an empty document_ids DELETES every file. The
      // composer draft knows neither, and nav.push does not reset it when
      // the edit screen opens, so reading it here would let a leftover
      // create-post draft flip an unrelated post to content_type
      // 'document' and destroy its real attachments.
      const editPoll = getPostDraft().poll;
      if (editPoll && editPoll.options.length >= 2) {
        // post.edit MUST forward the server-issued slug on every option
        // that had one, else FC's FeedsHelper::getSurveyOptionsUpdateError
        // returns "Existing poll options cannot be removed or left empty."
        // The sheet will not let those rows be removed or emptied, so by
        // the time a poll reaches here the slugs are intact. Options
        // added during this edit carry none; the server assigns them.
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
          // Document post: commit the file edits first, then send the
          // resulting list. FC's feed update detaches any media_key
          // missing from it, so a removed row needs no call of its own —
          // but a newly picked file has to be uploaded, and a renamed one
          // updated, before the list can reference it.
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
            // Only touch document_ids when we actually know what the
            // post's files were. Sending an empty list DELETES them all —
            // so if the seed came up empty (nothing to go on) and the user
            // added nothing, leave the field out and let the documents be.
            if (documents.length > 0) {
              body.document_ids = documents;
              body.content_type = 'document';
            } else if (draft.seeded_file_count > 0) {
              // Seeded with files, now none: the user removed every one.
              // That legitimately turns the post back into a text post.
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
          // Success → clear pending media + pop back to feed + force refresh.
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
      // Optimistic-UI reaction flow. The current toggle direction is read
      // straight off the tapped item's `my_reactions` (server-authored
      // per-viewer array from the plug-in proxy). We flip icon + color +
      // like-count text imperatively via data-appza-item-id BEFORE the
      // POST fires so the tap feels instant; on HTTP failure we revert.
      // No appza:refresh-data — that would refetch every data source on
      // screen and flash the whole feed. Server truth is picked up on
      // the next natural refresh (screen switch, manual reload).
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
      // Toggle direction: prefer the server-authored `my_reactions` array
      // on the tapped item (survives page loads); fall back to the
      // session-scoped reactedSet when the item shape doesn't carry it.
      const myReactions =
        itemRec && Array.isArray((itemRec as Record<string, unknown>).my_reactions)
          ? ((itemRec as Record<string, unknown>).my_reactions as unknown[]).filter(
              (t): t is string => typeof t === 'string',
            )
          : null;
      const reactKey = `${feedId}:${reactType}`;
      // Debounce rapid taps: if a previous request for the SAME feed +
      // reaction is still in flight, ignore the new tap. Prevents
      // double / triple clicks from queuing multiple toggles that all
      // race the server (each increments count optimistically, giving
      // counts like 3 / 4 / 5 for a single-user like).
      const inflightKey = `react:${reactKey}`;
      const g = window as unknown as { __appzaInflightReactions?: Set<string> };
      if (!g.__appzaInflightReactions) g.__appzaInflightReactions = new Set();
      if (g.__appzaInflightReactions.has(inflightKey)) {
        return; // ignore extra click while previous is pending
      }
      g.__appzaInflightReactions.add(inflightKey);
      const alreadyOn = myReactions
        ? myReactions.includes(reactType)
        : reactedSet.has(reactKey);
      const nextOn = !alreadyOn;
      // Optimistic UI first — before the network call.
      applyReactionOptimistic(feedId, reactType, nextOn);
      // Also update the state IMMEDIATELY (not just after the network
      // returns) so a rapid second tap that slips past the inflight
      // guard would still read the correct alreadyOn. Reverted on failure.
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
            // Revert both optimistic UI and the pre-updated state.
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
      // Open the in-device comment panel — a proper overlay sheet that
      // lists existing comments (GET list_endpoint?feed_id=X) and hosts
      // a composer. The dispatcher's role is only to resolve the target
      // feed_id + arg names and hand them to the panel; all HTTP happens
      // inside the panel component so its list state stays in sync with
      // submits + the panel can refetch after send without touching the
      // outer feed's data source.
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

    // Reply and Edit, the simulator's half. Same shape as the mobile
    // shell's — both open the comment panel rather than growing a second
    // editor, and both read their ids from opposite ends (a reply is
    // created against the POST with the comment as parent; an edit is
    // addressed to the COMMENT with the post alongside it).
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
      // The panel always mounts against the POST — it lists that post's
      // comments either way.
      const postId = isEdit ? parentId : primaryId;

      if (isEdit) {
        // message, not message_rendered — the rendered copy is HTML.
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

      // The `data.` prefix is not decoration: readDataPath returns
      // undefined without it and the banner reads "@User" for everyone.
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
      // Poll submit — AppzaPollBlock (SELF_ACTION_PRIMITIVES) grafts the
      // picked option slugs onto inv.item.vote_indexes before dispatching.
      // Read them off the item, POST { [body_key]: feed_id, [vote_key]:
      // [...slugs] } to fcom-mobile /feeds/survey-vote, then patch the
      // item's meta.survey_config in place with the fresh server-computed
      // options (vote_counts + percentage + voted) so the block re-renders
      // as results. No feed refetch — the mutation propagates through the
      // shared meta reference and the block's local justVoted state keeps
      // it in results mode for the rest of the session.
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
      // Minimum-viable emoji insert: browser prompt so the user can paste
      // or type an emoji, then append to the composer textarea. Not a
      // proper picker UI yet — that lands with the full renderer form-
      // state model. Works end-to-end today because FC stores emoji chars
      // in the message body verbatim.
      const appzet = typeof argRec.form_appzet_slug === 'string'
        ? argRec.form_appzet_slug : 'fc-post-information';
      const targetPath = typeof argRec.target_path === 'string'
        ? argRec.target_path : 'children[3]';
      const emoji = window.prompt('Enter an emoji (or paste any character):') ?? '';
      if (emoji) appendToTextarea(appzet, targetPath, emoji);
      return;
    }

    case 'link.attach': {
      // Prompt for a URL and append to the composer's message body.
      // FC's message_rendered pass auto-linkifies bare URLs, so we don't
      // need markdown syntax — the URL itself becomes a clickable link
      // in the feed. Full oembed preview (thumbnail + title card) lands
      // in a follow-up pass using /feeds/oembed.
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
      void (async () => {
        const payload = await fetchPostSpacePayload(dsSlug);
        // The moderator verdict rides the same payload, so opening the
        // picker also settles whether the announcement row and the
        // schedule control belong on this screen.
        setPostDraft({ viewer_is_moderator: payload.viewerIsModerator });
        openPostSpaceSheet({
          appzetSlug: sheetSlug,
          presentation: postSpaceSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
          childStyles: childStylesFromCustomizations(
            sheetSlug,
            POST_SPACE_SHEET_CHILD_COUNT,
            currentCustomizations,
          ),
          groups: payload.groups,
          // Settings -> General -> Global Post Status. With it off there
          // is no "On my profile" row, which is Noor's note on design 5.
          globalPostsEnabled: getFcRuntimeSettings().composer.global_posts_enabled,
          viewerIsModerator: payload.viewerIsModerator,
        });
      })();
      return;
    }

    case 'picker.image': {
      // Trigger the hidden file input; onChange handler uploads each
      // selected file via multipart POST to args.endpoint (Source-scoped,
      // supplied by the catalog wiring; see fc-post-information's
      // on_tap_attach_photo). Returned URLs get appended to pendingImages;
      // post.create reads them + clears on success.
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
        // The upload tab's gate is a question about the VIEWER, so it
        // comes off the same per-request payload the space picker uses,
        // not the cached bootstrap. Already warmed at screen mount.
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
        // The glyph is gated on the same two switches, so this only fires
        // if the catalog was edited to show it anyway. Saying why beats a
        // silent no-op.
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
      // The glyph is gated on the space allowing documents, so this only
      // fires without one if the catalog was edited to show it anyway.
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

    // ── Feed controls ────────────────────────────────────────────────
    // Designs 20 and 21 draw both pickers as BOTTOM SHEETS. Which frame
    // opens is a catalog value rather than a fork here: leaving
    // `presentation` unset still gives the anchored popover, which is
    // what keeps this branch safe to point at any screen.
    case 'feed.set_sort':
    case 'feed.set_view_mode': {
      const isSort = inv.action_slug === 'feed.set_sort';
      const catalogRows = readPickerOptions(argRec.options);
      // Sort rows come from the SITE, wearing the catalog's glyphs:
      // FluentCommunity owns which sorts exist, because it is the thing
      // that executes them. Layout rows are ours alone — the three view
      // modes are renderer variants FC knows nothing about.
      const options = isSort
        ? resolveFeedSortRows(catalogRows, getViewer().is_logged_in)
        : catalogRows;
      // Silent return, matching the bookmarks case directly below: this
      // dispatcher has no error channel — the simulator's message slot
      // belongs to the login screen, so reporting here would put "no
      // options wired" under a password field (P127's failure shape).
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
      // Popover fallback — anchored to whichever of the toolbar's two
      // buttons fired.
      const anchor = document.querySelector(
        `[data-appza-appzet-slug="fc-feed-toolbar"][data-child-index="${isSort ? 0 : 1}"]`,
      );
      openViewModePopover(options, anchor, stateKey);
      return;
    }

    // ── Feed banner ──────────────────────────────────────────────────
    // Two children write this, not one toggle: View More sends 'yes' and
    // View Less sends 'no', so a double tap cannot leave the description
    // clamped while the extra buttons are showing.
    case 'banner.set_expanded': {
      const value = typeof argRec.value === 'string' ? argRec.value : '';
      if (value !== 'yes' && value !== 'no') return;
      setBannerControls({ expanded: value === 'yes' });
      return;
    }

    case 'banner.dismiss': {
      // Days come from the catalog so the window is a wiring decision,
      // not a constant buried here. Default matches FluentCommunity's own
      // web dismissal.
      const days =
        typeof argRec.dismiss_days === 'number' && Number.isFinite(argRec.dismiss_days)
          ? argRec.dismiss_days
          : DEFAULT_DISMISS_DAYS;
      dismissBanner(days);
      return;
    }

    // ── Saved Posts controls ─────────────────────────────────────────
    // The same three shapes the feed carries, against bookmarkControls,
    // with one difference that comes from the catalog rather than from
    // here: `presentation`. Noor's designs draw sort and layout as
    // BOTTOM SHEETS on this screen while the feed keeps its anchored
    // popover, so the frame is an action arg. Leaving it unset gives the
    // popover — which is what makes this safe to point at any screen.
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
      // Fires on every keystroke, including the ⨯ clear — which sends an
      // empty string, and must, since clearing the field is how you get
      // the whole list back. fc-bookmarks binds `search`, so the WRITE is
      // a refetch rather than a filter over the loaded page, which is
      // exactly why it goes through debounceSearch: one request when the
      // typing stops, not one per character. The clear is applied
      // immediately — see searchDebounce.ts.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      debounceSearch('bookmarks', runtimeValue ?? itemValue ?? '', (search) =>
        setBookmarkControls({ search }),
      );
      return;
    }

    // ── Search screen (2026-08-23) ─────────────────────────────────────
    //
    // Five handlers, and every one of them is a write to searchControls
    // and nothing else. None calls an endpoint: the three result lists
    // refetch because their DataSources bind the slice as query params,
    // and the four recent-search histories never leave the device.
    //
    // Nothing here decides which list is showing either. The slice
    // derives `active_scope` from the tab and the query length, and the
    // placements gate on that — so a handler that wrote the wrong tab
    // would show the wrong results, but a handler cannot show results
    // for a query too short to have any.

    case 'search.set_tab': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      // Validated against the closed set rather than passed through like
      // spaces.set_tab. These three values are not just catalog labels —
      // `active_scope` carries whichever one is written straight into the
      // placement gates, so a typo in the tabs array would mount NO
      // result card and leave a screen that searches and shows nothing.
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
      // FluentCommunity's own `search_in` values. Guarded for a different
      // reason than the tabs above: FC does not reject an unknown one, it
      // matches NOTHING — so a typo would read as "there are no results"
      // rather than as a bug.
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
      // Two callers, and they want opposite things.
      //
      // A RECENT ROW hands over a whole term at once — there is nothing
      // to wait for, and 300ms of nothing after tapping a row reads as a
      // dead row. It cancels any keystroke still pending first, or that
      // keystroke lands afterwards and overwrites the term just picked.
      if (argRec.immediate === true) {
        cancelDebouncedSearch('search');
        setSearchControls({ query: value });
        // The field is UNCONTROLLED (Ionic holds the text), so writing the
        // slice does not put the term in the box. Without this the tapped
        // search runs and its results — or its "No matches" — appear over
        // an EMPTY field, with the reason for them nowhere on screen.
        setPrimitiveInputValue('fc-search-field', 'children[1]', value);
        // Re-searching something already remembered moves it to the top
        // rather than duplicating it.
        recordRecentSearch(value);
        return;
      }
      // The FIELD fires once per character (onIonInput, by design —
      // onIonChange only fires on blur and search-as-you-type would feel
      // dead until you tapped away). Three DataSources bind `query`, so
      // each write is a REFETCH: without the debounce, six letters is six
      // requests whose answers race (P97). The ⨯ clear sends '' and is
      // applied immediately — see searchDebounce.ts.
      //
      // Remembering the term hangs off the SETTLED write, not the
      // dispatch. Recording per keystroke would fill the list with every
      // prefix of every word.
      debounceSearch('search', value, (query) => {
        setSearchControls({ query });
        recordRecentSearch(query);
      });
      return;
    }

    case 'search.remove_recent': {
      // The ⨯ on one row. The term arrives on the bound item — this row
      // is a Data-Source-backed card, so `item` is the {value,label} row
      // fc-search-recents served out of the slice.
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
      // Clears the CURRENT tab + scope only. Designs 1 and 2 show Content
      // and Comments as two separate lists, so clearing one must leave the
      // other alone — the slice scopes it by `scope_key`, not here.
      clearRecentSearches();
      return;
    }

    case 'spaces.set_tab': {
      // Tab value comes from the tapped child's `value` prop (stamped by
      // the wrapper onClick from binds_to 'children[i].value'). Tab set is
      // catalog-driven now (fc-spaces-tabs.tabs); PlacementRenderer's
      // data_source_by_state maps the picked value to the DS to fetch.
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
      // Fires on every keystroke from ion-input. The value is threaded
      // through inv.item.value payload the PrimitiveRenderer stamps on
      // input events.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const value = runtimeValue ?? itemValue ?? '';
      // NOT debounced, unlike bookmarks and documents. The spaces list
      // filters CLIENT-SIDE — PlacementRenderer matches title/description
      // against this value over rows already in hand (fc-spaces-all /
      // fc-spaces-my), and no DataSource binds it. There is no request to
      // save, so a debounce would only add lag to a local filter.
      setSpacesControls({ search: value });
      return;
    }

    case 'spaces.set_sort': {
      // Same popover pattern as feed.set_sort. Anchored to the toolbar's
      // sort button (child index 1 on fc-spaces-toolbar).
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

    // The profile's tab strip. Same shape as space_detail.set_subtab:
    // the variadic child template stamps the entry's value onto
    // inv.item, with an args fallback for a direct-fire caller.
    //
    // The strip's entries come from the profile ROW — FluentCommunity's
    // own profile_navs — so the values here are whatever that mapped to,
    // and a tab with no placement answering it simply renders an empty
    // body rather than breaking.
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

    // The follow lists (2026-09-02). Three writers into profileControls
    // and the one that opens the screen.
    case 'profile.set_follow_view': {
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      if (picked) {
        // Clearing the search with the strip is deliberate: the two lists
        // are different people, and a query typed against one of them
        // silently narrowing the other reads as an empty list rather than
        // as a filter still being applied.
        setProfileControls({ follow_view: picked, follow_search: '' });
      } else {
        console.warn('[appza] profile.set_follow_view: no picked value', { argRec, item });
      }
      return;
    }

    case 'profile.set_follow_search': {
      // Same contract as documents.set_search — Ionic's ⨯ fires with '',
      // so one case covers set and clear. Debounced because both follow
      // DataSources bind this as a query param and every keystroke would
      // otherwise be a request.
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
      // Silent return, as every other picker in this dispatcher does:
      // the simulator has no error channel, and its one message slot
      // belongs to the login screen (P127).
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
      // Both header counts open ONE screen and differ only in which strip
      // item is active, so the view is written BEFORE the push — a bare
      // nav.push would always land on Following whichever number was
      // tapped. The push itself is delegated rather than restated: it
      // carries route params, screen context and the composer resets, and
      // a second copy of that would drift.
      const view = typeof argRec.view === 'string' && argRec.view ? argRec.view : 'followings';
      setProfileControls({ follow_view: view, follow_search: '' });
      handleAppModeAction(
        {
          ...inv,
          action_slug: 'nav.push',
          args: {
            target_screen_slug:
              typeof argRec.target_screen_slug === 'string' && argRec.target_screen_slug
                ? argRec.target_screen_slug
                : 'profile-follows',
          },
        },
        deps,
      );
      return;
    }

    case 'space_detail.set_subtab': {
      // fc-space-subtabs children_from_prop strip. Same shape as
      // spaces.set_tab above — value flows through inv.item.value.
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
      // fc-space-topics chip. topic_slug='' = "All"; refetch of
      // fc-space-feeds is automatic via query_params state binding.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      setSpaceDetailControls({ topic_slug: picked });
      return;
    }

    case 'space_detail.set_sort': {
      // Sort popover on fc-space-post-toolbar. Same shape as
      // spaces.set_sort: no runtime value = open the picker; runtime
      // value present = commit the picked sort.
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
      // fc-documents-search ion-input. onIonInput grafts the current text
      // onto action.item.value, including when Ionic's ⨯ clears the field
      // (it fires with ''), so one case covers set + clear. The refetch is
      // automatic: fc-space-documents binds `search` to this state key —
      // hence the debounce, and hence the clear landing immediately.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      debounceSearch('documents', runtimeValue ?? itemValue ?? '', (documents_search) =>
        setSpaceDetailControls({ documents_search }),
      );
      return;
    }

    case 'documents.set_draft': {
      // One writer for every plain draft field; `field` names which.
      // The switch reports a boolean and the text inputs a string, so
      // both shapes are accepted rather than coerced to one.
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
      // Chip value comes from the expanded child's `value` override,
      // which field_mapping filled from entry.id.
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
      // The glyph is gated on the moderator verdict, so this only fires
      // without one if the catalog was edited to show it anyway. Saying
      // why beats a sheet whose result FluentCommunity would discard in
      // silence.
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

    // === MEDIA sub-tab (2026-08-17) ===
    // Mirrors the mobile shell case for case, except media.download —
    // see the note there.

    // ---- Leaderboard (2026-08-19) -------------------------------
    //
    // Both setters write a key that a DataSource binds as a query
    // param, so the refetch is the fetch — nothing here filters or
    // slices anything client-side.
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
      // A fixed value, not a toggle: VIEW ALL is one-way by design and
      // the button's placement disappears once the card is expanded.
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
      // Resolved from the catalog, never written down here — the sheet
      // is opened by an action rather than mounted by a placement, so
      // there is no useDataSource in its tree to do it (D51).
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

    // === The conversation 3-dot menu and its three destructive
    // confirms (2026-08-18) ===
    //
    // ONE slug opens both surfaces, because the thread's `type` is what
    // decides which: a space or group conversation opens a member sheet
    // from the bottom, a one-to-one opens a profile card in the middle.
    // Splitting it into two actions would put that branch in the
    // catalog, where a customer editing the appbar would have to know
    // which kind of conversation their app opens.
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
              // The confirm's copy lives on ITS action, not on the menu's —
              // re-entering with the menu's args would hand the alert an
              // empty bag and fall back to the hardcoded wording.
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
      // Resolved from the catalog, never written down here — the sheet
      // is opened by an action rather than mounted by a placement, so
      // there is no useDataSource in its tree to do it.
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
      // The space-detail data sources bind route.slug, and its own
      // controls slice drives which sub-tab opens — both have to agree
      // or the screen re-seeds itself onto a different space.
      setSpaceDetailControls({ space_slug: spaceSlug, active_subtab: 'posts' });
      setRouteParams({ ...getRouteParams(), slug: spaceSlug });
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    // All three confirms are the shared row-layout alert — Cancel beside
    // a destructive verb — which is the shape designs 4, 8 and 9 all
    // draw. Only the copy and the action they dispatch differ, and both
    // come off the catalog.
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
      // The switch above guarantees one of the three keys, but the
      // index signature does not know that.
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
        // Cancel beside the verb, not stacked — the member-removal flow
        // stacks because "Remove from space" is too long to sit next to
        // Cancel; these three verbs are one word each.
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
      // Blocking and unblocking are one action on two endpoints: FC
      // flips both the thread status and the blocker's own membership
      // row, so the same pair undoes it.
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
      // Leaving or deleting takes the screen with it, so the alert, the
      // sheet and the card all come down before the pop.
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
            // Design 9 says delete returns to the chat list. There is no
            // list screen yet (Noor's call), so this pops back to
            // whatever pushed the conversation.
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

    // === Chat writes (2026-08-18) ===
    //
    // The four of them share one shape: everything the write needs is in
    // the chat state slice, and the endpoint comes off the action args.
    // The sequences themselves live in the renderer's chatSend module so
    // this shell and the simulator cannot drift — the same call
    // documentSubmit makes, for the same reason (P69).
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
        // Still drop the thumbnail — the user tapped ×, and a missing
        // endpoint is not their problem. The scheduled sweep takes the
        // file.
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

    // The bubble has already written the slice by the time this fires —
    // a swipe is not a click, so it cannot wait for a dispatch round
    // trip. The case exists so the gesture is still repointable from the
    // right panel, and so a caller that fires it WITHOUT having written
    // the slice (a customer wiring reply to something of their own) gets
    // the same result.
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
      // The CHAT sub-tab entry carries this as a per-entry
      // on_click_action override instead of the usual set_subtab: every
      // chat design Noor supplied is a screen of its own — its own
      // appbar with the conversation's avatar, no switcher strip — so
      // the tap is a push, not a tab switch.
      //
      // thread_id and space_slug are ALTERNATIVES, not a pair. The CHAT
      // tab knows a space slug and nothing else; a conversation opened
      // by id knows only the id. Both data sources bind both and the
      // endpoint falls through, so whichever we have is enough.
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
      // The sub-tab entry is only {value, label} — it cannot carry the
      // space it belongs to. The space being viewed is already in the
      // space-detail slice, which is where the other member actions read
      // it from too.
      let spaceSlug = typeof rawSlug === 'string' ? rawSlug : '';
      // Falling back to the space-detail slice is the DEFAULT, not an
      // opt-in. A per-entry on_click_action override carries a slug and
      // nothing else — the shells receive `args` verbatim and never look
      // the action's param_schema up — so requiring the arg meant the
      // CHAT tab dispatched with an empty bag and bailed out silently.
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

      // Resets the per-visit keys (reply target, selection, draft) when
      // the conversation changes — see the switch guard in the slice.
      setChatControls({ thread_id: threadId, space_slug: spaceSlug });
      // MERGE, don't replace (P85): space-detail's own `slug` has to
      // survive, or coming back re-seeds it and resets the sub-tab.
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
      // MERGE, don't replace: setRouteParams() overwrites the whole bag.
      // Dropping the space `slug` here cost the return trip — space-detail
      // seeds its own route slug when none is set, and that seeding also
      // resets active_subtab to 'posts', so coming back from a post landed
      // on POSTS instead of the MEDIA tab the user left from. A media row
      // never leaves its space, so the existing slug is still correct.
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
      // The simulator runs in a real browser, so an anchor with the
      // download attribute works here and saves under the DISPLAY name
      // rather than FluentCommunity's storage name (P80). The mobile
      // shell can't do this — a WebView ignores the attribute — so it
      // hands off to the system browser instead.
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
          // Same deferred double-dispatch as post.create: the documents
          // list hasn't remounted yet when the nav commits, so a single
          // immediate event would be missed and the new card wouldn't
          // appear until the next visit.
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 150);
          setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 600);
        },
      });
      return;
    }

    case 'documents.open_add': {
      // FAB on the documents tab. The add-document screen ships in chunk 2;
      // until it's seeded this warns instead of blanking the canvas.
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
      // Fresh form every time the screen is opened — the draft holds File
      // handles and is deliberately not persisted.
      resetDocumentDraft(spaceSlug);
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }

    case 'space.compose_open': {
      // Nav.push variant to create-post-page. Carries the current
      // space context so fc-post-information can prefill its space
      // picker. When effectiveItem is null (composer teaser has no
      // per-item context) we synthesize one from the route params.
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
      // Nav.push to post-detail carrying the tapped post. Distinct
      // action slug from a plain nav.push so analytics can filter
      // "View more comments" taps separately later.
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
      // Sim shortcut — real endpoint fires in mobile shell. Stamp a
      // synthetic space_pivot onto the tapped item so the CTA swaps to
      // View Space immediately; the real endpoint call the mobile shell
      // makes returns the same shape after cache TTL.
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

    // ── Member 3-dot overflow flow ────────────────────────────────────
    // Mirrors the mobile shell. The UI-opening actions really do open
    // their sheets/dialogs so admins can preview the flow; the two
    // write actions (member.set_role, member.remove) are simulated —
    // no real HTTP fires from the plugin-admin simulator.
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
      // Real HTTP against the fcom-mobile add-member endpoint (doubles as
      // role updater when the target user is already a member). Uses the
      // WP admin's Basic auth like every other write — plugin-admin runs
      // at the WP origin, so relative endpoints from the catalog resolve
      // fine here without absolutization.
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

    // member.add is dual-mode on the same slug (mirrors the two-phase
    // add-member flow):
    //   - opener: fires from fc-space-members-actions Add Member button.
    //     No user_id + role in args → open the AddMemberModal.
    //   - submit: fires from inside the modal after a user + role are
    //     picked. user_id + role present in args → real HTTP POST.
    case 'member.add': {
      const hasUser = argRec.user_id !== undefined && argRec.user_id !== null;
      const hasRole = typeof argRec.role === 'string' && argRec.role !== '';

      if (!hasUser || !hasRole) {
        // Open path — pull labels + role_options off the referenced modal
        // AppZet's resolved props so builder edits flow through.
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
            // Carry any wire-time overrides through to the submit
            // invocation so the shell POST uses the same endpoint /
            // method the opener resolved.
            endpoint: typeof argRec.endpoint === 'string' ? argRec.endpoint : undefined,
            method: typeof argRec.method === 'string' ? argRec.method : undefined,
          },
        });
        return;
      }

      // Submit path — real HTTP POST /wp-json/fcom-mobile/api/v1/spaces/add-member
      // with {space_slug, user_id, role}. Same shape as member.set_role.
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

    case 'member.remove_confirm': {
      const subjectPath =
        typeof argRec.subject_path === 'string' ? argRec.subject_path : 'data.xprofile.display_name';
      const rawSubject = readDataPath(effectiveItem, subjectPath);
      const subject = typeof rawSubject === 'string' && rawSubject ? rawSubject : 'Member';
      openMemberRemoveConfirm({
        subject,
        message: typeof argRec.message === 'string' ? argRec.message : undefined,
        cancelLabel: typeof argRec.cancel_label === 'string' ? argRec.cancel_label : undefined,
        confirmLabel: typeof argRec.confirm_label === 'string' ? argRec.confirm_label : undefined,
        item: effectiveItem,
        removeActionSlug:
          typeof argRec.remove_action_slug === 'string' ? argRec.remove_action_slug : 'member.remove',
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

    // member.invite is dual-mode on the same slug, exactly like
    // member.add:
    //   - opener: fires from fc-space-members-actions Invite User. No
    //     email in args → open the InviteUserModal.
    //   - submit: fires from inside the modal once an email and role
    //     are filled in → real HTTP POST.
    case 'member.invite': {
      const email = typeof argRec.email === 'string' ? argRec.email.trim() : '';

      if (email === '') {
        const formSlug =
          typeof argRec.form_appzet_slug === 'string'
            ? argRec.form_appzet_slug
            : 'fc-invite-user-modal';
        const props = readAppzetPropsFromCatalog(formSlug);

        // Endpoint comes from the catalog's DataSource row, never a
        // literal in the shell.
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
          // The endpoint's own message distinguishes "joined the space
          // right away" from "invitation emailed", so prefer it over
          // the action's generic toast_message.
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
        // Cancel | Delete sit side by side in this dialog, unlike the
        // member-removal one whose confirm label is far longer.
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
          // The modal's list listens for this and repopulates itself.
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
      // Mutating actions we haven't wired yet (cart.add, profile.save, etc.)
      // still fall through to log-only so admins can see them fire during
      // preview without accidentally hitting real endpoints.
      console.info(
        '[appza-admin/app-mode] action fired (not executed in sim):',
        action_slug,
        argRec,
        { effectiveItem },
      );
  }
}

/**
 * Append text to an ion-textarea located by DOM path attributes. Fires
 * an input event afterward so ion-textarea's internal state syncs — this
 * matters because Ionic tracks value via listeners, not just DOM prop
 * reads. Also focuses the element + moves the cursor to the end for a
 * natural "keep typing" feel.
 */
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
  // Fire an input event so Ionic + any listening controlled components
  // pick up the new value. Ionic's ion-textarea/ion-input dispatches its
  // own ionInput event on `value` mutation via property setter, but firing
  // a native `input` event is a belt-and-braces sync signal.
  el.dispatchEvent(new Event('input', { bubbles: true }));
  if (typeof el.setFocus === 'function') {
    void el.setFocus();
  }
}

/**
 * Format a Date for the composer's user-avatar card date line.
 * Style matches FC portal's "Jul 15, 2026 · 4:37 pm" pattern.
 */
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

/**
 * Confirm-delete modal for the post.delete action. Kept intentionally
 * lean. Cancel + confirm buttons; confirm is a red "Delete" CTA
 * that disables while the request is in flight so a double-tap can't
 * fire two DELETEs.
 */
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
        // Absolute — the parent (.appza-device-viewport) is
        // position:relative in the simulator, so this fills only the phone
        // screen. On the real Capacitor build there's no bezel, so an
        // absolute overlay against IonPage still covers the whole viewport.
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

/**
 * In-device comment panel opened by the comment.create action. Owns:
 *  - GET list_endpoint?feed_id=<id> on mount + after each successful
 *    send, populates a scrollable list of existing comments (avatar +
 *    display name + created_at + message).
 *  - Text input + Send button that POSTs to endpoint with Basic Auth,
 *    body { [body_key]: feed_id, [message_key]: text }.
 *  - Backdrop click / X button dismisses.
 *
 * Same absolute-inside-viewport positioning as ConfirmDeleteModal so it
 * lives inside the DeviceFrame's phone bezel on the simulator and full-
 * viewport on the real Capacitor build.
 */
type PanelComment = {
  id?: number | string;
  parent_id?: number | string | null;
  message?: string;
  created_at?: string;
  xprofile?: {
    display_name?: string;
    avatar?: string;
  } | null;
  children?: PanelComment[];
};

// FCOM /feeds/comments returns a flat list — nest by parent_id here.
// Keys normalized to string because the API returns id as number but
// parent_id as string.
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
  // Opened by comment.edit → the composer starts holding the comment.
  const [draft, setDraft] = useState(edit?.message ?? '');
  const [sending, setSending] = useState(false);
  // Opened by comment.reply → already aimed, banner and all.
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
      // Editing addresses the COMMENT and names the post alongside it;
      // creating addresses the POST. /comments/update 400s without both.
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
      // An edit is done when it lands — the panel was opened FOR it.
      if (edit) {
        await load();
        triggerFeedRefresh();
        onClose();
        return;
      }
      await load();
      // Also refresh the outer feed so the post's comments_summary
      // ("N comments") updates on the card behind the panel.
      triggerFeedRefresh();
      // Scroll to bottom so the fresh comment is visible.
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
            dangerouslySetInnerHTML={{ __html: String(comment.message ?? '') }}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ActionProvider,
  AddMemberModal,
  InviteUserModal,
  MemberOptionsSheet,
  MemberRemoveConfirm,
  MemberRoleSheet,
  PostOptionsPopover,
  ScreenRenderer,
  ViewModePopover,
  closeAddMemberModal,
  closeInviteUserModal,
  closeMemberRemoveConfirm,
  buildDrawerMenu,
  filterScreensBySurface,
  getSpaceDetailControls,
  openAddMemberModal,
  openInviteUserModal,
  openMemberOptionsSheet,
  openMemberRemoveConfirm,
  openMemberRoleSheet,
  openPostOptionsPopover,
  openViewModePopover,
  prefillPostInformationFromContext,
  readDataPath,
  resolveOverridableColumn,
  addMemberPresentation,
  invitePresentation,
  childStylesFromCustomizations,
  ADD_MEMBER_CHILD_COUNT,
  INVITE_USER_CHILD_COUNT,
  setCatalogGlobal,
  setFcRuntimeSettings,
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
  getPostDetailControls,
  setPostDetailControls,
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
  resolveIcon,
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
  schedulePresentation,
  SCHEDULE_SHEET_APPZET_SLUG,
  SCHEDULE_SHEET_CHILD_COUNT,
  MediaViewer,
  openMediaViewer,
  mediaViewerPresentation,
  MEDIA_VIEWER_APPZET_SLUG,
  toggleDraftTopic,
  seedDraftForEdit,
  submitDocumentDraft,
  prepareDocumentEdit,
  setSpacesControls,
  tryHandlePostMenuAction,
  tryHandleProfileAction,
  tryHandleProfileSave,
  type ActionDispatch,
  type ActionInvocation,
  type AddMemberRoleOption,
  type InviteChipPalette,
  type InviteRoleOption,
  type MemberMenuItem,
  type MemberRoleOption,
  type PostMenuItem,
  type ViewModeOption,
  setViewer,
  canBrowseAsGuest,
  PollVotersSheet,
  openPollVotersSheet,
  ModerationReviewSheet,
  OverlayDesignStyle,
  announceModerationDone,
} from '@appza/renderer';
import { drawerMenuItems, screenAppbarPlacements, screenPlacements } from '@appza/renderer';
import { setAuthHeaderProvider, setExternalOpener, openExternal, useBackDismiss, dismissTopOverlay } from '@appza/renderer';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import {
  BootstrapEnvelopeSchema,
  type BootstrapEnvelope,
  type Catalog,
  type TemplateScreen,
} from '@appza/schemas';

const SITE_URL = (import.meta.env.VITE_APPZA_SITE_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://tutor-lms-mobile.local' : '');
const TEMPLATE = (import.meta.env.VITE_APPZA_TEMPLATE as string | undefined) ?? 'fluent-community-default';

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; envelope: BootstrapEnvelope }
  | { kind: 'error'; message: string };

// useDataSource needs an absolute previewProxy URL; relative /wp-json doesn't resolve here.
window.appzaCoreConfig = {
  endpoints: {
    previewProxy: `${SITE_URL}/wp-json/appza/v1/preview/data`,
  },
};

const AUTH_STORAGE_KEY = 'appza:auth';

let currentAuthHeader: string | undefined;
setAuthHeaderProvider(() => currentAuthHeader);

// window.open('_blank') is a no-op in the Android WebView, so links go to Custom Tabs there.
if (Capacitor.isNativePlatform()) {
  setExternalOpener((url) => {
    void Browser.open({ url });
  });
}

// Links leaving the app (other origin or target=_blank) open outside it, including in post HTML.
document.addEventListener(
  'click',
  (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || !/^https?:$/.test(a.protocol)) return;
    if (a.target !== '_blank' && a.origin === window.location.origin) return;
    e.preventDefault();
    openExternal(a.href);
  },
  true,
);

// SecureStorage is async, so main.tsx awaits loadStoredAuth() before mounting.
let storedAuthCache: StoredAuth | null = null;

function parseStoredAuth(raw: string | null): StoredAuth | null {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.username === 'string' && typeof parsed.token === 'string' && parsed.username && parsed.token
      ? (parsed as StoredAuth)
      : null;
  } catch {
    return null;
  }
}

export async function loadStoredAuth(): Promise<void> {
  try {
    let raw = await SecureStorage.getItem(AUTH_STORAGE_KEY);
    const legacy = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw && legacy) {
      raw = legacy;
      await SecureStorage.setItem(AUTH_STORAGE_KEY, legacy);
    }
    if (legacy) window.localStorage.removeItem(AUTH_STORAGE_KEY);
    storedAuthCache = parseStoredAuth(raw);
  } catch {
    storedAuthCache = null;
  }
}

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
  return storedAuthCache;
}

function writeStoredAuth(a: StoredAuth | null): void {
  storedAuthCache = a;
  const write = a ? SecureStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(a)) : SecureStorage.removeItem(AUTH_STORAGE_KEY);
  write.catch(() => {
    /* storage unavailable — the session just won't survive a restart */
  });
}

// `sink` routes the URLs to the caller instead of the post draft (e.g. a comment that doesn't exist yet).
type ImagePickerTarget = {
  endpoint: string;
  method: string;
  accept?: string;
  onStart?: () => void;
  sink?: (urls: string[]) => void;
  onFail?: () => void;
};

function basicAuthHeader(auth: StoredAuth): string {
  return 'Basic ' + window.btoa(`${auth.username}:${auth.token}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(rec: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!rec) return null;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

// Drop taps while the same reaction is in flight; stale `my_reactions` would stack increments and duplicate POSTs.
const reactionInFlight = new Set<string>();

const REACTION_UI: Record<
  string,
  { actionName: string; iconOn: string; iconOff: string; colorOn: string; countPathTimeline: string | null; countActionName: string | null }
> = {
  like: {
    actionName: 'on_tap_like',
    iconOn: 'heart',
    iconOff: 'heart-outline',
    colorOn: 'danger',
    countPathTimeline: 'children[13]',
    countActionName: null,
  },
  bookmark: {
    actionName: 'on_tap_bookmark',
    iconOn: 'bookmark',
    iconOff: 'bookmark-outline',
    colorOn: 'primary',
    countPathTimeline: null,
    countActionName: null,
  },
};

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
        resolveIcon(nextIcon) || resolveIcon(cfg.iconOff) || resolveIcon(cfg.iconOn);
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
    // A null count path means no visible count (bookmark); a sibling fallback hit the wrong node.
    let countWrap: HTMLElement | null = null;
    if (cfg.countPathTimeline) {
      countWrap = wrapper.querySelector<HTMLElement>(
        `[data-appza-primitive-path="${cfg.countPathTimeline}"]`,
      );
    }
    if (countWrap) {
      // ion-text renders into a shadow-DOM <p>.
      const target =
        countWrap.querySelector<HTMLElement>('ion-text p') ??
        countWrap.querySelector<HTMLElement>('ion-text') ??
        countWrap;
      const text = target.textContent ?? '';
      const match = text.match(/(\d+)/);
      const cur = match && match[1] ? parseInt(match[1], 10) : 0;
      const next = Math.max(0, cur + (on ? 1 : -1));
      const suffix = text.replace(/^\s*\d+/, '').trim();
      target.textContent = suffix ? `${next} ${suffix}` : String(next);
    }
  });
}

// Handed over as-is; the store validates and falls back per field.
function applyFcRuntimeSettings(envelope: BootstrapEnvelope): void {
  const cfg = (envelope.runtime_config ?? null) as Record<string, unknown> | null;
  const fc = cfg && isRecord(cfg.fluent_community) ? (cfg.fluent_community as Record<string, unknown>) : null;
  if (!fc) return;
  setFcRuntimeSettings(fc);
}

// Catalog endpoints are relative, and the WebView origin isn't the WP site.
function absolutizeEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const base = SITE_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  return base + path;
}

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

function readFormFieldValue(appzetSlug: string, path: string): string | boolean | null {
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
    out[name] = v ?? '';
  }
  return out;
}

// FC wants topic_ids as ints; an empty selection omits the key, as FC's portal does.
function coerceTopicIds(body: Record<string, unknown>): void {
  const raw = body.topic_ids;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const ids = list
    .map((v) => Number(typeof v === 'string' ? v.trim() : v))
    .filter((n) => Number.isFinite(n));
  if (ids.length === 0) {
    delete body.topic_ids;
    return;
  }
  body.topic_ids = ids;
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

type PendingVideo = {
  url: string;
  title?: string;
  image?: string;
  provider?: string;
};

type PendingDelete = {
  feedId: number;
  endpoint: string;
  method: string;
  bodyKey: string;
  title: string;
  message: string;
  cta: string;
  variant?: string;
  cancelLabel?: string;
  failLabel?: string;
  /** Every fcom-mobile comment route wants both the comment id and its post id. */
  extraBody?: Record<string, unknown>;
};

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

type ActionDeps = {
  catalog: Catalog | null;
  currentScreenId: number | null;
  setSelectedScreenId: (id: number | null) => void;
  setScreenStack: React.Dispatch<React.SetStateAction<number[]>>;
  auth: StoredAuth | null;
  setAuth: (a: StoredAuth | null) => void;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  reactedSet: Set<string>;
  openDeleteConfirm: (p: PendingDelete) => void;
  openCommentPanel: (p: CommentPanelState) => void;
  openImagePicker: (target: ImagePickerTarget) => void;
  openAudioPicker: (endpoint: string) => void;
  openDocumentPicker: (t: {
    upload: string;
    rename: string;
    remove: string;
    accept: string;
  }) => void;
  attachVideo: (url: string, target: { endpoint: string; method: string }) => Promise<void>;
  pendingImages: string[];
  clearPendingImages: () => void;
  pendingVideo: PendingVideo | null;
  clearPendingVideo: () => void;
  screenContextRef: React.MutableRefObject<Record<string, unknown>>;
  screenPrefilledRef: React.MutableRefObject<Record<string, true>>;
  requireAuthOrLogin: () => boolean;
};

export function App() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [screenStack, setScreenStack] = useState<number[]>([]);
  // A ref so writes don't render; persists on the screen because post.edit reads feed_id from it at Save time.
  const screenContextRef = useRef<Record<string, unknown>>({});
  // Guards the prefill so a memo re-compute doesn't overwrite user edits; nav.push clears it.
  const screenPrefilledRef = useRef<Record<string, true>>({});
  // Publish auth in the lazy initializer so the header is set before child effects (which run first) fetch.
  const [auth, setAuthState] = useState<StoredAuth | null>(() => {
    const stored = readStoredAuth();
    if (stored && typeof window !== 'undefined') {
      const g = window as unknown as {
        __appzaCurrentUserId?: number;
      };
      currentAuthHeader = basicAuthHeader(stored);
      if (typeof stored.user_id === 'number') g.__appzaCurrentUserId = stored.user_id;
    }
    return stored;
  });
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [commentPanel, setCommentPanel] = useState<CommentPanelState | null>(null);
  const reactedRef = useRef<Set<string>>(new Set());
  const [nowLabel, setNowLabel] = useState<string>(() => formatNowLabel(new Date()));
  useEffect(() => {
    const tick = () => setNowLabel(formatNowLabel(new Date()));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);
  const postDraft = usePostDraft();
  const pendingImages = useMemo(() => postDraft.images.map((i) => i.url), [postDraft.images]);
  const setImagesFromUrls = useCallback(
    (urls: string[]) => setPostDraft({ images: urls.map((url) => ({ url })) }),
    [],
  );
  const [uploadingCount, setUploadingCount] = useState(0);
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioUploadEndpointRef = useRef<string | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  // Rename/delete fire long after the picker closes, so their endpoints wait here.
  const docEndpointsRef = useRef<{ upload: string; rename: string; remove: string } | null>(null);
  const uploadEndpointRef = useRef<ImagePickerTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useBackDismiss(pendingDelete !== null, () => {
    if (!deleteInFlight) setPendingDelete(null);
  });
  useBackDismiss(commentPanel !== null, () => setCommentPanel(null));
  useBackDismiss(menuOpen, () => setMenuOpen(false));
  const [pullDistance, setPullDistance] = useState(0);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const setAuth = useCallback((a: StoredAuth | null) => {
    writeStoredAuth(a);
    setAuthState(a);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same effect shape as the window globals, so gates and fetch headers agree on who is asking.
  useEffect(() => {
    setViewer({
      is_logged_in: !!auth,
      user_id: auth && typeof auth.user_id === 'number' ? auth.user_id : null,
    });
  }, [auth]);

  useEffect(() => {
    if (!auth) {
      setPendingDelete(null);
      setDeleteInFlight(false);
      setCommentPanel(null);
      reactedRef.current = new Set();
      setPostDraft({ images: [] });
      setPendingVideo(null);
      resetPostDraft();
      uploadEndpointRef.current = null;
    }
  }, [auth]);

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
              absolutizeEndpoint(endpoints.rename),
              currentAuthHeader ?? '',
            );
            setDocumentBusy('');
            if (error) setErrorToast(error);
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
              absolutizeEndpoint(endpoints.remove),
              currentAuthHeader ?? '',
            );
            setDocumentBusy('');
            if (error) setErrorToast(error);
            else removePostDraftDocument(id);
          })();
        },
      }),
    [],
  );

  useEffect(() => {
    if (!errorToast) return;
    const t = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(t);
  }, [errorToast]);

  useEffect(() => {
    if (!infoToast) return;
    const t = setTimeout(() => setInfoToast(null), 2000);
    return () => clearTimeout(t);
  }, [infoToast]);

  useEffect(() => {
    const url = `${SITE_URL}/wp-json/appza/v1/bootstrap?template=${encodeURIComponent(TEMPLATE)}`;
    fetch(url, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const parsed = BootstrapEnvelopeSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error(
            'Bootstrap schema validation failed: ' +
              parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          );
        }
        // Surface-gate once at ingest so everything downstream sees only this surface's screens.
        const gated: BootstrapEnvelope = {
          ...parsed.data,
          catalog: {
            ...parsed.data.catalog,
            template_screens: filterScreensBySurface(
              parsed.data.catalog.template_screens ?? [],
              'mobile',
            ),
          },
        };
        const catalog = gated.catalog;
        const storedAuth = readStoredAuth();

        // Settings before screen: canBrowseAsGuest() reads the access level from them.
        applyFcRuntimeSettings(gated);
        setViewer({
          is_logged_in: !!storedAuth,
          user_id: storedAuth && typeof storedAuth.user_id === 'number' ? storedAuth.user_id : null,
        });

        // Guests land on the feed on a `public` site, else on login; signed-in viewers land on the first screen.
        const login = catalog.template_screens?.find(
          (s) => s.app_map_screen_slug === 'login-page',
        );
        const first = catalog.template_screens?.[0];
        const needsLogin = !storedAuth && !canBrowseAsGuest();
        const target = needsLogin && login ? login : first;
        setSelectedScreenId(target ? target.id : null);
        setState({ kind: 'ok', envelope: gated });
      })
      .catch((err) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, []);

  const envelope = state.kind === 'ok' ? state.envelope : null;
  const catalog = envelope?.catalog ?? null;

  // Hardware back: close the top sheet, else pop a screen, else go Home, else minimise (never exit).
  const backNavRef = useRef({ screenStack, selectedScreenId, catalog });
  backNavRef.current = { screenStack, selectedScreenId, catalog };
  useEffect(() => {
    const onBack = () => {
      if (dismissTopOverlay()) return;
      const { screenStack: stack, selectedScreenId: current, catalog: cat } = backNavRef.current;
      if (stack.length > 0) {
        setSelectedScreenId(stack[stack.length - 1] ?? null);
        setScreenStack(stack.slice(0, -1));
        return;
      }
      const screens = cat?.template_screens ?? [];
      const onLogin = screens.find((s) => s.id === current)?.app_map_screen_slug === 'login-page';
      const home = screens.find((s) => s.app_map_screen_slug === 'home');
      if (home && current !== home.id && !onLogin) {
        setSelectedScreenId(home.id);
        return;
      }
      if (Capacitor.isNativePlatform()) void CapApp.minimizeApp();
    };
    if (import.meta.env.DEV) (window as unknown as { __appzaBack?: () => void }).__appzaBack = onBack;
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener('backButton', onBack);
    return () => {
      void listener.then((h) => h.remove());
    };
  }, []);

  // PostOptionsPopover reads each menu item's action defaults from here at click time.
  useEffect(() => {
    setCatalogGlobal(catalog);
  }, [catalog]);

  const screen = useMemo<TemplateScreen | null>(() => {
    if (!catalog || selectedScreenId == null) return null;
    return catalog.template_screens?.find((s) => s.id === selectedScreenId) ?? null;
  }, [catalog, selectedScreenId]);

  // The levels card only expands, so reset it on arrival or a second visit can't collapse it.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'leaderboard') return;
    resetLeaderboardControls();
  }, [screen?.app_map_screen_slug]);

  // Drop pending debounce timers on screen change so they can't refetch a screen nobody is on.
  useEffect(() => {
    cancelDebouncedSearch();
  }, [screen?.app_map_screen_slug]);

  // Search resets per visit; sort and layout are preferences and survive.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'bookmarks') return;
    resetBookmarkControls();
  }, [screen?.app_map_screen_slug]);

  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'all-members') return;
    resetMemberDirectoryControls();
  }, [screen?.app_map_screen_slug]);

  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'courses') return;
    resetCourseListControls();
  }, [screen?.app_map_screen_slug]);

  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'course-students') return;
    resetCourseStudentsControls();
  }, [screen?.app_map_screen_slug]);

  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'moderation') return;
    resetModerationControls();
  }, [screen?.app_map_screen_slug]);

  // Config applied after the reset — the reset is per-visit, the config isn't.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'search') return;
    resetSearchControls();
    const props = readAppzetPropsFromCatalog('fc-search-field');
    const min = Number(props.min_query_length);
    const limit = Number(props.recent_limit);
    configureSearchControls({
      min_query_length: Number.isFinite(min) && min >= 0 ? min : undefined,
      recent_limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });
  }, [screen?.app_map_screen_slug]);


  // Warm the per-viewer verdict on arrival (the cached bootstrap can't answer it). Don't reset the draft here — returning from the preview is also an arrival; nav.push owns that.
  useEffect(() => {
    const slug = screen?.app_map_screen_slug;
    if (slug !== 'create-post-page' && slug !== 'edit-post-page') return;
    const wiring = readAppzetActionsFromCatalog('fc-post-information');
    const dsSlug =
      typeof wiring?.on_tap_space?.args?.data_source === 'string'
        ? (wiring.on_tap_space.args.data_source as string)
        : 'fc-post-space-picker';
    void preparePostComposer(dsSlug);
  }, [screen?.app_map_screen_slug]);

  // Guarded by screenPrefilledRef so a re-render doesn't overwrite user edits.
  useEffect(() => {
    if (!screen) return;
    const slug = screen.app_map_screen_slug;
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
          readAppzetActionsFromCatalog('fc-post-information')?.on_tap_space?.args
            ?.data_source as string ?? 'fc-post-space-picker',
          slug,
          topicIds,
        );
      },
    });
  }, [screen]);

  // Seed route.slug from the first accessible space, or the topic dropdown's DS returns nothing.
  useEffect(() => {
    if (!screen) return;
    const slug = screen.app_map_screen_slug;
    if (slug !== 'create-post-page' && slug !== 'edit-post-page') return;
    const existing = (window as unknown as { __appzaRouteParams?: Record<string, unknown> })
      .__appzaRouteParams?.slug;
    if (typeof existing === 'string' && existing) return;
    if (!auth) return;
    const url = `${SITE_URL}/wp-json/appza/v1/preview/data?ds=fc-spaces-discover&mode=real`;
    void fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: basicAuthHeader(auth),
      },
    })
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.items ?? [];
        const first = Array.isArray(items) ? items[0] : null;
        const firstSlug = first && typeof first === 'object'
          ? (first as Record<string, unknown>).slug
          : null;
        if (typeof firstSlug !== 'string' || firstSlug.length === 0) return;
        setRouteParams({ slug: firstSlug, space_slug: firstSlug });
        // routeParams is a plain global; poke the controls slice so subscribers re-resolve.
        setSpaceDetailControls({ space_slug: firstSlug });
        window.dispatchEvent(new Event('appza:refresh-data'));
      })
      .catch(() => {
        /* silent — composer will render without space context */
      });
  }, [screen, auth]);

  const customizationsForRender = useMemo(() => {
    const raw = envelope?.customizations;
    const base = isRecord(raw) ? { ...raw } : {};
    const scope = isRecord(base.appzet) ? { ...(base.appzet as Record<string, unknown>) } : {};
    const target = isRecord(scope['fc-user-avatar'])
      ? { ...(scope['fc-user-avatar'] as Record<string, unknown>) }
      : {};
    const existingOverride = isRecord(target.default_props_override)
      ? (target.default_props_override as Record<string, unknown>)
      : {};
    target.default_props_override = { ...existingOverride, now_label: nowLabel };
    scope['fc-user-avatar'] = target;
    base.appzet = scope;
    return base;
  }, [envelope, nowLabel]);

  useEffect(() => {
    setCustomizationsForActions(customizationsForRender);
  }, [customizationsForRender]);

  useEffect(() => {
    startHeadlineCounter();
  }, []);

  const openDeleteConfirm = useCallback((p: PendingDelete) => setPendingDelete(p), []);
  const openCommentPanel = useCallback((p: CommentPanelState) => setCommentPanel(p), []);
  const openImagePicker = useCallback((target: ImagePickerTarget) => {
    // A ref, not state: a state setter would race the file input's onChange.
    uploadEndpointRef.current = target;
    // Shared picker: `accept` is set per open.
    if (fileInputRef.current) {
      fileInputRef.current.accept = target.accept ?? 'image/*';
      fileInputRef.current.click();
    }
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

  // Sequential so a failure can be attributed to a file; FC applies no cap to document_ids.
  const uploadDocuments = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const endpoints = docEndpointsRef.current;
      if (!endpoints) return;
      const spaceSlug = getPostDraft().space_slug;
      if (!spaceSlug) {
        setErrorToast('Choose a space before attaching a file.');
        return;
      }
      const list = Array.from(files);
      setUploadingCount((c) => c + list.length);
      const auth = currentAuthHeader ?? '';
      const accepted = [];
      for (const file of list) {
        const { doc, error } = await uploadDraftDocument(
          file,
          spaceSlug,
          absolutizeEndpoint(endpoints.upload),
          auth,
        );
        setUploadingCount((c) => Math.max(0, c - 1));
        if (doc) accepted.push(doc);
        else if (error) setErrorToast(error);
      }
      if (accepted.length > 0) addPostDraftDocuments(accepted);
    },
    [],
  );

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
        setErrorToast(
          `Only ${max} audio file${max === 1 ? '' : 's'} can go on a post — ${picked.length - list.length} not added.`,
        );
      }
      if (list.length === 0) return;
      setUploadingCount((c) => c + list.length);
      const results = await Promise.all(
        list.map(async (file) => {
          try {
            const video = await uploadDraftVideo(file, endpoint, currentAuthHeader ?? '', 'audio');
            if (!video || !video.media_id || !video.media_url) {
              setErrorToast(`Could not upload ${file.name}.`);
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

  const uploadImages = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!auth) {
        setErrorToast('Please sign in to attach images.');
        return;
      }
      const target = uploadEndpointRef.current;
      if (!target) {
        setErrorToast('Image attach is missing its endpoint.');
        return;
      }
      // Cap before uploading — extra uploads become orphaned Media rows with no delete endpoint. A sink (comment media) isn't on the draft, so no cap.
      const max = target.sink ? 0 : getFcRuntimeSettings().composer.max_media_per_post;
      const room = max > 0 ? Math.max(0, max - getPostDraft().images.length) : files.length;
      const picked = Array.from(files);
      const list = picked.slice(0, room);
      if (picked.length > list.length) {
        const refused = picked.length - list.length;
        setErrorToast(
          `Only ${max} image${max === 1 ? '' : 's'} can go on a post — ${refused} not added.`,
        );
      }
      if (list.length === 0) return;
      target.onStart?.();
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
            },
            body: form,
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            const msg =
              json && typeof (json as Record<string, unknown>).message === 'string'
                ? ((json as Record<string, unknown>).message as string)
                : `Upload failed (HTTP ${res.status})`;
            setErrorToast(msg);
            return null;
          }
          const url =
            json &&
            typeof json === 'object' &&
            'items' in json &&
            json.items &&
            typeof json.items === 'object' &&
            typeof (json.items as Record<string, unknown>).url === 'string'
              ? ((json.items as Record<string, string>).url)
              : null;
          if (!url) {
            setErrorToast('Upload succeeded but no URL returned.');
            return null;
          }
          return url;
        } catch (err) {
          setErrorToast(err instanceof Error ? err.message : String(err));
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

  const attachVideo = useCallback(
    async (url: string, target: { endpoint: string; method: string }) => {
      if (!auth) {
        setErrorToast('Please sign in to attach a video.');
        return;
      }
      setVideoLoading(true);
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
        if (!res.ok) {
          setErrorToast(`Video lookup failed (HTTP ${res.status})`);
          return;
        }
        const wrapper = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
        const inner =
          wrapper && wrapper.response && typeof wrapper.response === 'object'
            ? (wrapper.response as Record<string, unknown>)
            : null;
        const items =
          wrapper && wrapper.items && typeof wrapper.items === 'object'
            ? (wrapper.items as Record<string, unknown>)
            : null;
        if (inner && inner.status && inner.status !== 200) {
          setErrorToast(
            typeof inner.message === 'string' ? inner.message : 'No preview available for this URL',
          );
          return;
        }
        if (!items) {
          setErrorToast('No preview available for this URL');
          return;
        }
        setPendingVideo({
          url,
          title: typeof items.title === 'string' ? items.title : undefined,
          image: typeof items.image === 'string' ? items.image : undefined,
          provider: typeof items.provider === 'string' ? items.provider : undefined,
        });
      } catch (err) {
        setErrorToast(err instanceof Error ? err.message : String(err));
      } finally {
        setVideoLoading(false);
      }
    },
    [auth],
  );

  // Returns false after navigating to login; the caller must just stop.
  const requireAuthOrLogin = useCallback((): boolean => {
    if (auth) return true;
    const login = catalog?.template_screens?.find(
      (s) => s.app_map_screen_slug === 'login-page',
    );
    if (!login) {
      setErrorToast('Please sign in to do that.');
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
      handleAction(inv, {
        catalog,
        currentScreenId: selectedScreenId,
        setSelectedScreenId,
        setScreenStack,
        auth,
        setAuth,
        onError: setErrorToast,
        onInfo: setInfoToast,
        reactedSet: reactedRef.current,
        openDeleteConfirm,
        openCommentPanel,
        openImagePicker,
        openAudioPicker,
        openDocumentPicker,
        attachVideo,
        pendingImages,
        clearPendingImages,
        pendingVideo,
        clearPendingVideo,
        screenContextRef,
        screenPrefilledRef,
        requireAuthOrLogin,
      });
    },
    [
      catalog,
      selectedScreenId,
      auth,
      setAuth,
      requireAuthOrLogin,
      openDeleteConfirm,
      openCommentPanel,
      openImagePicker,
      openAudioPicker,
      openDocumentPicker,
      attachVideo,
      pendingImages,
      clearPendingImages,
      pendingVideo,
      clearPendingVideo,
    ],
  );
  void screenStack;

  const refreshApp = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const url = `${SITE_URL}/wp-json/appza/v1/bootstrap?template=${encodeURIComponent(TEMPLATE)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const parsed = BootstrapEnvelopeSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(
          'Bootstrap validation failed: ' +
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        );
      }
      // Gate on refresh too, or hidden screens leak back into the drawer.
      const gated: BootstrapEnvelope = {
        ...parsed.data,
        catalog: {
          ...parsed.data.catalog,
          template_screens: filterScreensBySurface(
            parsed.data.catalog.template_screens ?? [],
            'mobile',
          ),
        },
      };
      applyFcRuntimeSettings(gated);
      setState({ kind: 'ok', envelope: gated });
      triggerFeedRefresh();
    } catch (err) {
      setErrorToast(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const navigateToScreen = useCallback(
    (targetId: number) => {
      setMenuOpen(false);
      if (targetId === selectedScreenId) return;
      if (selectedScreenId != null) {
        setScreenStack((prev) => [...prev, selectedScreenId]);
      }
      setSelectedScreenId(targetId);
    },
    [selectedScreenId],
  );

  const logoutFromMenu = useCallback(() => {
    setMenuOpen(false);
    setAuth(null);
    const login = catalog?.template_screens?.find(
      (s) => s.app_map_screen_slug === 'login-page',
    );
    if (login) {
      setScreenStack([]);
      setSelectedScreenId(login.id);
    }
  }, [catalog, setAuth]);

  useEffect(() => {
    const outer = shellRef.current;
    if (!outer) return;
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('ion-header, ion-toolbar')) return;
      const wrapper = target.closest(
        '[data-appza-primitive-path="children[0]"]',
      ) as HTMLElement | null;
      if (!wrapper) return;
      if (wrapper.getAttribute('data-appza-inline-click') === 'true') return;
      const slug = wrapper.getAttribute('data-appza-appzet-slug') ?? '';
      if (!/appbar|header|topbar/i.test(slug)) return;
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(true);
    };
    outer.addEventListener('click', onClick, true);
    return () => outer.removeEventListener('click', onClick, true);
  }, [selectedScreenId]);

  useEffect(() => {
    const outer = shellRef.current;
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

    // passive:false so we can preventDefault while pulling, or the WebView cancels the pointer stream.
    const onTouchStart = async (e: TouchEvent) => {
      if (menuOpen || refreshing) return;
      if (e.touches.length !== 1) return;
      if (!scrollEl) scrollEl = await findScroll();
      if (!scrollEl || scrollEl.scrollTop > 2) {
        armed = false;
        return;
      }
      const t0 = e.touches[0];
      if (!t0) return;
      armed = true;
      startY = t0.clientY;
      dy = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!armed || startY == null || e.touches.length !== 1) return;
      const t0 = e.touches[0];
      if (!t0) return;
      dy = t0.clientY - startY;
      if (dy > 0) {
        if (e.cancelable) e.preventDefault();
        setPullDistance(Math.min(dy * 0.6, 90));
      } else {
        setPullDistance(0);
      }
    };
    const onTouchEnd = async () => {
      if (!armed) return;
      armed = false;
      const finalDist = Math.min(dy * 0.6, 90);
      setPullDistance(0);
      startY = null;
      dy = 0;
      if (finalDist > 55) {
        await refreshApp();
      }
    };

    // Skip touch — the touch path handles it.
    const onPointerDown = async (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (menuOpen || refreshing) return;
      if (!scrollEl) scrollEl = await findScroll();
      if (!scrollEl || scrollEl.scrollTop > 2) {
        armed = false;
        return;
      }
      armed = true;
      startY = e.clientY;
      dy = 0;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!armed || startY == null) return;
      dy = e.clientY - startY;
      setPullDistance(dy > 0 ? Math.min(dy * 0.6, 90) : 0);
    };
    const onPointerUp = async (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!armed) return;
      armed = false;
      const finalDist = Math.min(dy * 0.6, 90);
      setPullDistance(0);
      startY = null;
      dy = 0;
      if (finalDist > 55) {
        await refreshApp();
      }
    };

    outer.addEventListener('touchstart', onTouchStart, { passive: true });
    outer.addEventListener('touchmove', onTouchMove, { passive: false });
    outer.addEventListener('touchend', onTouchEnd, { passive: true });
    outer.addEventListener('touchcancel', onTouchEnd, { passive: true });
    outer.addEventListener('pointerdown', onPointerDown, { passive: true });
    outer.addEventListener('pointermove', onPointerMove, { passive: true });
    outer.addEventListener('pointerup', onPointerUp, { passive: true });
    outer.addEventListener('pointercancel', onPointerUp, { passive: true });
    return () => {
      outer.removeEventListener('touchstart', onTouchStart);
      outer.removeEventListener('touchmove', onTouchMove);
      outer.removeEventListener('touchend', onTouchEnd);
      outer.removeEventListener('touchcancel', onTouchEnd);
      outer.removeEventListener('pointerdown', onPointerDown);
      outer.removeEventListener('pointermove', onPointerMove);
      outer.removeEventListener('pointerup', onPointerUp);
      outer.removeEventListener('pointercancel', onPointerUp);
      scrollEl = null;
    };
  }, [refreshApp, menuOpen, refreshing, selectedScreenId]);

  if (state.kind === 'loading') {
    return (
      <div className="appza-mobile-loading" aria-busy="true" aria-live="polite">
        <span className="appza-mobile-spinner" aria-hidden="true" />
      </div>
    );
  }
  if (state.kind === 'error') {
    return <div className="appza-mobile-error">{state.message}</div>;
  }
  // A template the site never synced comes back as an empty catalog.
  if (catalog && !catalog.template_screens?.length) {
    return (
      <div className="appza-mobile-error">
        This site has no app screens for template “{TEMPLATE}”. In wp-admin, open APPZA Core → Sync and sync that
        template, then reopen the app.
      </div>
    );
  }
  if (!screen || !catalog) {
    return <div className="appza-mobile-error">No screen to render.</div>;
  }

  return (
    <div
      ref={shellRef}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh' }}
    >
      <ActionProvider dispatch={dispatchAction}>
        <ScreenRenderer
          screen={screen}
          catalog={catalog}
          navDepth={screenStack.length}
          customizations={customizationsForRender}
        />
        {/* Inside ActionProvider: outside it useActionDispatch() is a no-op. */}
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
        <OverlayDesignStyle catalog={catalog} customizations={customizationsForRender} />
      </ActionProvider>

      {errorToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#dc2626',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            maxWidth: '90%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 80,
          }}
          onClick={() => setErrorToast(null)}
        >
          {errorToast}
        </div>
      )}

      {infoToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#111827',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            maxWidth: '90%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 80,
          }}
          onClick={() => setInfoToast(null)}
        >
          {infoToast}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          title={pendingDelete.title}
          message={pendingDelete.message}
          cta={pendingDelete.cta}
          variant={pendingDelete.variant}
          cancelLabel={pendingDelete.cancelLabel}
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
                  `${pendingDelete.failLabel ?? 'Delete'} failed (HTTP ${res.status})`;
                setErrorToast(msg);
                return;
              }
              setPendingDelete(null);
              // Closes on the write landing, not the CTA tap — the confirm can be cancelled.
              announceModerationDone();
              triggerFeedRefresh();
            } catch (err) {
              setErrorToast(err instanceof Error ? err.message : String(err));
            } finally {
              setDeleteInFlight(false);
            }
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = e.target.files;
          void uploadImages(files);
          e.target.value = '';
        }}
      />
      {/* Own input: a shared one would race over swapping `accept`. */}
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


      {(uploadingCount > 0 || pendingVideo || videoLoading) && (
        <div
          style={{
            position: 'fixed',
            left: 8,
            right: 8,
            bottom: 60,
            background: '#111827',
            color: '#fff',
            borderRadius: 8,
            padding: '8px 10px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontSize: 12,
            boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
            zIndex: 55,
            overflowX: 'auto',
          }}
        >
          {uploadingCount > 0 && <span>Uploading {uploadingCount}…</span>}
          {videoLoading && <span>Loading video…</span>}
          {pendingVideo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🎬 {pendingVideo.title ?? pendingVideo.url}</span>
              <button
                type="button"
                onClick={() => setPendingVideo(null)}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  borderRadius: 999,
                  width: 20,
                  height: 20,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {commentPanel && auth && (
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
          onError={setErrorToast}
        />
      )}

      {(pullDistance > 0 || refreshing) && (
        <div
          className="appza-pull-indicator"
          style={{
            transform: `translateY(${(refreshing ? 60 : pullDistance) - 40}px)`,
          }}
          aria-hidden="true"
        >
          <span
            className={
              refreshing || pullDistance > 55
                ? 'appza-pull-icon is-spinning'
                : 'appza-pull-icon'
            }
          >
            ↻
          </span>
        </div>
      )}

      {menuOpen && (
        <>
          <div
            className="appza-menu-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="appza-menu-drawer" role="dialog" aria-label="Pages">
            <div className="appza-menu-header">
              <span>Pages</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="appza-menu-close"
                aria-label="Close menu"
              >
                ×
              </button>
            </div>
            {auth && (
              <div className="appza-menu-user">
                Signed in as <strong>{auth.display_name || auth.username}</strong>
              </div>
            )}
            <ul className="appza-menu-list">
              {buildDrawerMenu(
                catalog.template_screens ?? [],
                catalog.app_map,
                drawerMenuItems(catalog, customizationsForRender),
              ).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => navigateToScreen(row.id)}
                    className={
                      row.id === selectedScreenId
                        ? 'appza-menu-item is-current'
                        : 'appza-menu-item'
                    }
                  >
                    {row.icon && <IonIcon icon={row.icon} className="appza-menu-icon" />}
                    {row.label}
                  </button>
                </li>
              ))}
            </ul>
            {auth && (
              <button
                type="button"
                onClick={logoutFromMenu}
                className="appza-menu-logout"
              >
                Log out
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
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

// Only reached when a comment has `message_rendered` but no `message`.
function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent ?? '').trim();
}

function handleAction(inv: ActionInvocation, deps: ActionDeps) {
  const {
    requireAuthOrLogin,
    catalog,
    currentScreenId,
    setSelectedScreenId,
    setScreenStack,
    auth,
    setAuth,
    onError,
    onInfo,
    reactedSet,
    openDeleteConfirm,
    openCommentPanel,
    openImagePicker,
    openAudioPicker,
    openDocumentPicker,
    attachVideo,
    screenContextRef,
    screenPrefilledRef,
  } = deps;
  const { action_slug, args, item, binding_root, siblings, siblingIndex } = inv;
  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? readDataPath(item, binding_root) ?? item : item;
  const itemRec = isRecord(effectiveItem) ? (effectiveItem as Record<string, unknown>) : null;

  // Resolved from the catalog screen row so it holds however the screen was reached.
  const isPostDetailScreen = (): boolean => {
    if (currentScreenId == null) return false;
    const screen = catalog?.template_screens?.find((sc) => sc.id === currentScreenId);
    return screen?.app_map_screen_slug === 'post-detail' || screen?.app_map_screen_slug === 'course-lesson';
  };

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
        console.warn('[appza-mobile] nav.push target not found:', targetSlug);
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
            // Placement visible_when reads space_slug from the slice, not route params.
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
      // Published here, not by the header — the header is one of the things waiting on it.
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
      // `permalink` is FC's word for a feed link's URL.
      const url =
        pickString(argRec, ['url', 'link', 'permalink', 'website']) ??
        pickString(itemRec, ['url', 'link', 'permalink', 'website']);
      if (!url) {
        console.warn('[appza-mobile] link.open: no url resolved from', {
          args: argRec,
          item: effectiveItem,
        });
        return;
      }
      openExternal(url);
      return;
    }

    case 'auth.logout': {
      const logoutEndpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (logoutEndpoint && auth?.uuid) {
        void fetch(absolutizeEndpoint(logoutEndpoint), {
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
      const paramMap =
        argRec.param_map && typeof argRec.param_map === 'object'
          ? (argRec.param_map as Record<string, unknown>)
          : undefined;
      const onSuccessScreen =
        typeof argRec.on_success_screen === 'string' ? argRec.on_success_screen : null;
      if (!endpoint) {
        onError('auth.login is missing its endpoint.');
        return;
      }
      const owningAppzet = findAppzetForAction(catalog, currentScreenId, 'auth.login', currentCustomizations);
      if (!owningAppzet) {
        onError('auth.login: no owning appzet found on current screen');
        return;
      }
      const body = collectParams(owningAppzet, paramMap);
      void (async () => {
        try {
          const res = await fetch(absolutizeEndpoint(endpoint), {
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
            onError(bodyMsg ?? `Login failed (HTTP ${res.status})`);
            return;
          }
          const j = json as Record<string, unknown>;
          const token = typeof j.token === 'string' ? j.token : null;
          const username =
            typeof j.user_name === 'string'
              ? j.user_name
              : typeof body.username === 'string'
                ? (body.username as string)
                : null;
          if (!token || !username) {
            onError('Login response missing token');
            return;
          }
          const userId =
            typeof j.user_id === 'number'
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
          if (onSuccessScreen && catalog) {
            const target = catalog.template_screens?.find(
              (s) => s.app_map_screen_slug === onSuccessScreen,
            );
            if (target) {
              setScreenStack(() => []);
              setSelectedScreenId(target.id);
            }
          }
          triggerFeedRefresh();
        } catch (err) {
          onError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'post.like':
    case 'bookmark.toggle': {
      console.log('[appza-mobile] dispatch:', action_slug, { argRec, effectiveItem });
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const reactType =
        typeof argRec.react_type === 'string' && argRec.react_type
          ? argRec.react_type
          : action_slug === 'bookmark.toggle'
            ? 'bookmark'
            : 'like';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      if (!endpoint) {
        onError(`${action_slug} is missing its endpoint.`);
        return;
      }
      // Checked on `auth`, not the guard's return, so the narrowing below holds.
      if (!auth) {
        requireAuthOrLogin();
        return;
      }
      const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const rawId = itemRec ? (itemRec as Record<string, unknown>)[key] : undefined;
      const feedId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string' && rawId !== '' && !Number.isNaN(Number(rawId))
            ? Number(rawId)
            : null;
      if (feedId === null) {
        onError('Could not identify which post to react to.');
        return;
      }
      const myReactions =
        itemRec && Array.isArray((itemRec as Record<string, unknown>).my_reactions)
          ? ((itemRec as Record<string, unknown>).my_reactions as unknown[]).filter(
              (t): t is string => typeof t === 'string',
            )
          : null;
      const reactKey = `${feedId}:${reactType}`;
      if (reactionInFlight.has(reactKey)) return;
      const alreadyOn = myReactions
        ? myReactions.includes(reactType)
        : reactedSet.has(reactKey);
      const nextOn = !alreadyOn;
      reactionInFlight.add(reactKey);
      applyReactionOptimistic(feedId, reactType, nextOn);
      const body: Record<string, unknown> = {
        [bodyKey]: feedId,
        react_type: reactType,
      };
      if (alreadyOn) body.remove = 1;
      void (async () => {
        try {
          const res = await fetch(absolutizeEndpoint(endpoint), {
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
            applyReactionOptimistic(feedId, reactType, alreadyOn);
            const msg =
              (status && typeof status.message === 'string' && status.message) ||
              `Reaction failed (HTTP ${res.status})`;
            onError(msg);
            return;
          }
          if (nextOn) reactedSet.add(reactKey);
          else reactedSet.delete(reactKey);
          if (itemRec) {
            const rec = itemRec as Record<string, unknown>;
            const cur = Array.isArray(rec.my_reactions)
              ? [...(rec.my_reactions as string[])]
              : [];
            if (nextOn && !cur.includes(reactType)) cur.push(reactType);
            if (!nextOn) {
              const idx = cur.indexOf(reactType);
              if (idx >= 0) cur.splice(idx, 1);
            }
            rec.my_reactions = cur;
          }
          // No full feed refresh; the optimistic DOM update is enough.
        } catch (err) {
          applyReactionOptimistic(feedId, reactType, alreadyOn);
          onError(err instanceof Error ? err.message : String(err));
        } finally {
          reactionInFlight.delete(reactKey);
        }
      })();
      return;
    }

    case 'comments.set_sort': {
      const options = readPickerOptions(argRec.options);
      if (options.length === 0) {
        onError('This control has no options wired.');
        return;
      }
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : 'fc-comment-sort-sheet';
      openOptionsSheet({
        appzetSlug: sheetSlug,
        presentation: optionsSheetPresentation(readAppzetPropsFromCatalog(sheetSlug)),
        childStyles: childStylesFromCustomizations(
          sheetSlug,
          OPTIONS_SHEET_CHILD_COUNT,
          currentCustomizations,
        ),
        options,
        stateKey: 'post_detail_comment_sort',
        currentValue: getPostDetailControls().comment_sort,
      });
      return;
    }

    case 'comment.attach': {
      if (!auth) {
        requireAuthOrLogin();
        return;
      }
      const endpoint =
        typeof argRec.endpoint === 'string' && argRec.endpoint
          ? argRec.endpoint
          : '/wp-json/fcom-mobile/api/v1/feeds/media-upload';
      const errorMessage =
        typeof argRec.error_message === 'string'
          ? argRec.error_message
          : 'The image could not be uploaded.';
      // Held until the comment is sent: FC can only attach media once the comment exists.
      openImagePicker({
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST',
        accept: typeof argRec.accept === 'string' ? argRec.accept : 'image/*',
        onStart: () => setPostDetailControls({ uploading: true }),
        sink: (urls: string[]) => {
          const next = [...getPostDetailControls().attachments, ...urls];
          setPostDetailControls({ attachments: next, uploading: false });
        },
        onFail: () => {
          setPostDetailControls({ uploading: false });
          onError(errorMessage);
        },
      });
      return;
    }

    case 'comment.discard_attachment': {
      // Local only: FC sweeps unattached media, and there's no comment-scoped discard endpoint.
      const url = itemRec && typeof itemRec.url === 'string' ? itemRec.url : '';
      if (!url) return;
      setPostDetailControls({
        attachments: getPostDetailControls().attachments.filter((u: string) => u !== url),
      });
      return;
    }

    case 'auth.require_signin': {
      requireAuthOrLogin();
      return;
    }

    // One slug for comment, reply and edit; which one comes from postDetailControls.
    case 'comment.send': {
      if (!auth) {
        requireAuthOrLogin();
        return;
      }
      const pd = getPostDetailControls();
      const body = pd.draft.trim();
      if (body === '' && pd.attachments.length === 0) return;

      const feedId = Number(pd.post_id);
      if (!Number.isFinite(feedId) || feedId <= 0) {
        onError('Could not identify which post to comment on.');
        return;
      }

      const editing = pd.editing_id !== '';
      const endpoint = editing
        ? (typeof argRec.update_endpoint === 'string' && argRec.update_endpoint) ||
          '/wp-json/fcom-mobile/api/v1/feeds/comments/update'
        : (typeof argRec.endpoint === 'string' && argRec.endpoint) ||
          '/wp-json/fcom-mobile/api/v1/feeds/comments/create';
      const method = editing
        ? (typeof argRec.update_method === 'string' && argRec.update_method.toUpperCase()) || 'PUT'
        : (typeof argRec.method === 'string' && argRec.method.toUpperCase()) || 'POST';
      const feedIdKey = typeof argRec.feed_id_key === 'string' ? argRec.feed_id_key : 'feed_id';
      const commentIdKey =
        typeof argRec.comment_id_key === 'string' ? argRec.comment_id_key : 'comment_id';
      const parentIdKey =
        typeof argRec.parent_id_key === 'string' ? argRec.parent_id_key : 'parent_id';
      const messageKey =
        typeof argRec.message_key === 'string' ? argRec.message_key : 'comment';
      const mediaKey = typeof argRec.media_key === 'string' ? argRec.media_key : 'media_images';

      const payload: Record<string, unknown> = {
        [feedIdKey]: feedId,
        [messageKey]: body,
      };
      if (editing) payload[commentIdKey] = Number(pd.editing_id);
      else if (pd.reply_to_id !== '') payload[parentIdKey] = Number(pd.reply_to_id);
      if (pd.attachments.length > 0) payload[mediaKey] = pd.attachments;

      // Cleared before the round-trip so a second tap can't hit FC's duplicate refusal; restored on failure.
      setPostDetailControls({
        draft: '',
        attachments: [],
        reply_to_id: '',
        reply_to_name: '',
        editing_id: '',
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      headers.Authorization = basicAuthHeader(auth);
      fetch(absolutizeEndpoint(endpoint), {
        method,
        headers,
        credentials: 'omit',
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          // fcom-mobile answers 200 with its own status inside the envelope.
          const inner =
            data && typeof data === 'object' && isRecord((data as Record<string, unknown>).response)
              ? ((data as Record<string, unknown>).response as Record<string, unknown>)
              : null;
          const status = inner && typeof inner.status === 'number' ? inner.status : res.status;
          if (!res.ok || status >= 400) {
            const message =
              inner && typeof inner.message === 'string' && inner.message !== 'Success'
                ? inner.message
                : 'The comment could not be posted.';
            throw new Error(message);
          }
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(
            new CustomEvent('appza:refresh-data', {
              detail: {
                data_source:
                  typeof argRec.refetch_data_source === 'string'
                    ? argRec.refetch_data_source
                    : 'fc-post-comments',
              },
            }),
          );
        })
        .catch((err: unknown) => {
          // The reply target isn't restored: the thread may have moved.
          setPostDetailControls({ draft: body });
          onError(err instanceof Error ? err.message : String(err));
        });
      return;
    }

    case 'comment.create': {
      console.log('[appza-mobile] dispatch: comment.create', { argRec, effectiveItem });
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const listEndpoint =
        typeof argRec.list_endpoint === 'string' ? argRec.list_endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const messageKey =
        typeof argRec.message_key === 'string' && argRec.message_key
          ? argRec.message_key
          : 'comment';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const panelTitle =
        typeof argRec.panel_title === 'string' ? argRec.panel_title : 'Comments';
      const placeholder =
        typeof argRec.placeholder === 'string' ? argRec.placeholder : 'Write a comment…';
      const sendLabel =
        typeof argRec.send_label === 'string' ? argRec.send_label : 'Send';
      if (!endpoint) {
        onError('comment.create is missing its endpoint.');
        return;
      }
      if (!listEndpoint) {
        onError('comment.create is missing its list_endpoint.');
        return;
      }
      if (!auth) {
        requireAuthOrLogin();
        return;
      }
      const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const rawId = itemRec ? (itemRec as Record<string, unknown>)[key] : undefined;
      const feedId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string' && rawId !== '' && !Number.isNaN(Number(rawId))
            ? Number(rawId)
            : null;
      if (feedId === null) {
        onError('Could not identify which post to comment on.');
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
      console.log(`[appza-mobile] dispatch: ${action_slug}`, { argRec, effectiveItem });

      // On post detail the footer composer is already mounted, so re-target it instead of opening the panel.
      if (isPostDetailScreen()) {
        if (!auth) {
          requireAuthOrLogin();
          return;
        }
        const rec = (itemRec ?? {}) as Record<string, unknown>;
        if (isEdit) {
          // `message`, not `message_rendered` — the rendered copy is HTML.
          const body =
            typeof rec.message === 'string'
              ? rec.message
              : typeof rec.message_rendered === 'string'
                ? stripHtml(rec.message_rendered)
                : '';
          setPostDetailControls({
            editing_id: rec.id == null ? '' : String(rec.id),
            reply_to_id: '',
            reply_to_name: '',
            draft: body,
          });
          return;
        }
        // The proxy flattens replies onto their top-level ancestor, so reply to the thread root.
        const parent = rec.reply_parent_id ?? rec.id;
        const name =
          rec.xprofile && typeof rec.xprofile === 'object'
            ? String((rec.xprofile as Record<string, unknown>).display_name ?? '')
            : '';
        setPostDetailControls({
          reply_to_id: parent == null ? '' : String(parent),
          reply_to_name: name,
          editing_id: '',
        });
        return;
      }

      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const listEndpoint =
        typeof argRec.list_endpoint === 'string' ? argRec.list_endpoint : null;
      const method =
        typeof argRec.method === 'string'
          ? argRec.method.toUpperCase()
          : isEdit
            ? 'PUT'
            : 'POST';
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
      if (!endpoint) {
        onError(`${action_slug} is missing its endpoint.`);
        return;
      }
      if (!listEndpoint) {
        onError(`${action_slug} is missing its list_endpoint.`);
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
        if (typeof raw === 'string' && raw !== '' && !Number.isNaN(Number(raw))) {
          return Number(raw);
        }
        return null;
      };
      const primaryId = readId(feedIdPath);
      const parentId = readId(parentIdPath);
      if (primaryId === null || parentId === null) {
        onError(
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
              typeof argRec.toast_message === 'string'
                ? argRec.toast_message
                : 'Comment updated',
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
        replyTo: {
          id: parentId,
          name: typeof author === 'string' && author ? author : 'User',
        },
      });
      return;
    }

    case 'poll.vote': {
      // Patch meta.survey_config in place with the server's counts — no feed refetch.
      console.log('[appza-mobile] dispatch: poll.vote', { argRec, effectiveItem });
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const voteKey =
        typeof argRec.vote_key === 'string' && argRec.vote_key ? argRec.vote_key : 'vote_indexes';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      if (!endpoint) {
        onError('poll.vote is missing its endpoint.');
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
        onError('Please pick an option before voting.');
        return;
      }
      const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const rawId = itemRec ? (itemRec as Record<string, unknown>)[key] : undefined;
      const feedId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string' && rawId !== '' && !Number.isNaN(Number(rawId))
            ? Number(rawId)
            : null;
      if (feedId === null) {
        onError('Could not identify which post to vote on.');
        return;
      }
      const body: Record<string, unknown> = {
        [bodyKey]: feedId,
        [voteKey]: voteIndexes,
      };
      void (async () => {
        try {
          const res = await fetch(absolutizeEndpoint(endpoint), {
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
              `Vote failed (HTTP ${res.status})`;
            onError(msg);
            return;
          }
          const items =
            json && typeof json === 'object' ? (json as Record<string, unknown>).items : null;
          if (
            isRecord(items) &&
            itemRec &&
            isRecord((itemRec as Record<string, unknown>).meta)
          ) {
            const meta = (itemRec as Record<string, unknown>).meta as Record<string, unknown>;
            meta.survey_config = items;
          }
          // No refetch: the mutation shares the item's meta reference, and a refetch would lose the voted flag (not enriched per viewer).
          onInfo('Vote submitted');
        } catch (err) {
          onError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'post.create': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const paramMap =
        argRec.param_map && typeof argRec.param_map === 'object'
          ? (argRec.param_map as Record<string, unknown>)
          : undefined;
      const composerAppzet =
        (typeof argRec.form_appzet_slug === 'string' && argRec.form_appzet_slug) ||
        'fc-post-information';
      if (!endpoint) {
        onError('post.create is missing its endpoint.');
        return;
      }
      if (!auth) {
        onError('Please sign in to post.');
        return;
      }
      const body = collectParams(composerAppzet as string, paramMap);
      if (!body.message || (typeof body.message === 'string' && !body.message.trim())) {
        onError('Write something to post.');
        return;
      }
      coerceTopicIds(body);
      if (deps.pendingImages.length > 0) {
        body.media_images = deps.pendingImages.map((u) => ({ url: u, provider: 'uploader' }));
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
        // Create: the server assigns fresh slugs, so drop any stale ones.
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
          const res = await fetch(absolutizeEndpoint(endpoint), {
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
              `Post failed (HTTP ${res.status})`;
            onError(msg);
            return;
          }
          deps.clearPendingImages();
          deps.clearPendingVideo();
          setScreenStack((prev) => {
            if (prev.length === 0) return prev;
            const rest = prev.slice(0, -1);
            setSelectedScreenId(prev[prev.length - 1] ?? null);
            return rest;
          });
          triggerFeedRefresh();
        } catch (err) {
          onError(err instanceof Error ? err.message : String(err));
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
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const title =
        typeof argRec.confirm_title === 'string'
          ? argRec.confirm_title
          : action_slug === 'comment.delete'
            ? 'Delete comment?'
            : 'Delete post?';
      const message =
        typeof argRec.confirm_message === 'string'
          ? argRec.confirm_message
          : 'This post will be permanently removed. This action cannot be undone.';
      const cta = typeof argRec.confirm_cta === 'string' ? argRec.confirm_cta : 'Delete';
      if (!endpoint) {
        onError('post.delete is missing its endpoint.');
        return;
      }
      if (!auth) {
        onError(
          action_slug === 'post.remove_preview'
            ? 'Please sign in to change this post.'
            : 'Please sign in to delete a post.',
        );
        return;
      }
      const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const raw = itemRec ? (itemRec as Record<string, unknown>)[key] : undefined;
      const feedId =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string' && raw !== '' && !Number.isNaN(Number(raw))
            ? Number(raw)
            : null;
      if (feedId === null) {
        onError('Could not identify which post to change.');
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
          onError('Could not identify which post this comment belongs to.');
          return;
        }
        extraBody = { [parentBodyKey]: parentId };
      }
      openDeleteConfirm({
        feedId, endpoint, method, bodyKey, title, message, cta,
        variant: typeof argRec.confirm_variant === 'string' ? argRec.confirm_variant : undefined,
        cancelLabel: typeof argRec.cancel_label === 'string' ? argRec.cancel_label : undefined,
        extraBody,
        failLabel: action_slug === 'post.remove_preview' ? 'Remove preview' : 'Delete',
      });
      return;
    }

    // Poll voters: the endpoint comes from args — ActionHttpMethod is writes-only.
    case 'poll.voters': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (!endpoint) {
        onError('poll.voters is missing its endpoint.');
        return;
      }
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const fk = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
      const feedId = itemRec ? (itemRec as Record<string, unknown>)[fk] : undefined;
      const optionSlug =
        itemRec && typeof itemRec.option_slug === 'string' ? itemRec.option_slug : '';
      if ((typeof feedId !== 'number' && typeof feedId !== 'string') || !optionSlug) {
        onError('Could not identify which poll option to open.');
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
      if (items.length === 0) {
        onError(`The ${action_slug} menu has no entries wired.`);
        return;
      }
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
        onError,
        onInfo,
      });
      if (handled) return;
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
        onError: onError,
        onInfo: onInfo,
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
        onError: onError,
        dispatch: (next) => handleAction(next, deps),
      });
      return;
    }

    case 'course_detail.toggle_section':
    case 'course.enroll': {
      tryHandleCourseDetailAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onError,
        onInfo: onInfo,
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
        onError: onError,
        readAppzetProps: readAppzetPropsFromCatalog,
        dispatch: (next) => handleAction(next, deps),
      });
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
        onError: onError,
        onInfo: onInfo,
        collect: (slug, map) => collectParams(slug, map as Record<string, unknown> | undefined),
        dispatch: (next) => handleAction(next, deps),
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
        onError,
        onInfo,
        pickImage: openImagePicker,
      });
      return;
    }

    // Must stay above the profile-pictures block, or these fall through into it.
    case 'members.set_search':
    case 'members.set_tab':
    case 'members.set_sort':
    case 'member.status_confirm':
    case 'member.set_status': {
      tryHandleMemberDirectoryAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError: onError,
        onInfo: onInfo,
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
        onError: onError,
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
        onError,
        onInfo,
      });
      return;
    }

    // The form is a sibling placement read from the DOM — hence inputs seed their value rather than hold React state.
    case 'profile.save': {
      tryHandleProfileSave(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError,
        onInfo,
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
        onError('post.edit is missing its endpoint.');
        return;
      }
      if (!auth) {
        onError('Please sign in to edit.');
        return;
      }
      const screenSlug =
        catalog?.template_screens?.find((s) => s.id === currentScreenId)?.app_map_screen_slug ??
        null;
      const ctx = screenSlug ? screenContextRef.current[screenSlug] : null;
      const feedId = resolveFeedIdFromContext(ctx ?? effectiveItem, feedIdPath);
      if (feedId === null) {
        onError('Could not identify which post to update.');
        return;
      }
      const body = collectParams(composerAppzet as string, paramMap);
      if (!body.message || (typeof body.message === 'string' && !body.message.trim())) {
        onError('Write something to post.');
        return;
      }
      coerceTopicIds(body);
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
      if (deps.pendingImages.length > 0) {
        body.media_images = deps.pendingImages.map((u) => ({ url: u, provider: 'uploader' }));
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
              onError('The document endpoints are missing from the action.');
              return;
            }
            const documents = await prepareDocumentEdit({
              uploadEndpoint,
              renameEndpoint,
              authHeader: basicAuthHeader(auth),
              absolutize: absolutizeEndpoint,
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
          const res = await fetch(absolutizeEndpoint(endpoint), {
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
            onError(msg);
            return;
          }
          deps.clearPendingImages();
          deps.clearPendingVideo();
          setScreenStack((prev) => {
            if (prev.length === 0) return prev;
            const rest = prev.slice(0, -1);
            setSelectedScreenId(prev[prev.length - 1] ?? null);
            return rest;
          });
          triggerFeedRefresh();
        } catch (err) {
          onError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'picker.space': {
      if (!auth) {
        onError('Please sign in to choose where to post.');
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
        onError('Could not identify which post to move.');
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
      if (!auth) {
        onError('Please sign in to attach images.');
        return;
      }
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      if (!endpoint) {
        onError('picker.image is missing its endpoint.');
        return;
      }
      openImagePicker({ endpoint, method });
      return;
    }

    case 'picker.video': {
      if (!auth) {
        onError('Please sign in to attach a video.');
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
            lookupVideoOembed(u, absolutizeEndpoint(oembedEndpoint), currentAuthHeader ?? ''),
          onUpload: (file: File) =>
            uploadDraftVideo(file, absolutizeEndpoint(uploadEndpoint), currentAuthHeader ?? ''),
        });
      })();
      return;
    }

    case 'picker.audio': {
      if (!auth) {
        onError('Please sign in to attach audio.');
        return;
      }
      const player = getFcRuntimeSettings().composer.fluent_player;
      if (!player.enabled || !player.audio_upload_enabled) {
        onError('Audio posts are turned off for this community.');
        return;
      }
      const audioEndpoint =
        typeof argRec.endpoint === 'string' && argRec.endpoint
          ? argRec.endpoint
          : '/wp-json/fcom-mobile/api/v1/fluent-player/video-upload';
      deps.openAudioPicker(absolutizeEndpoint(audioEndpoint));
      return;
    }

    case 'picker.schedule': {
      if (!auth) {
        onError('Please sign in to schedule a post.');
        return;
      }
      // FC would silently discard a schedule from a non-moderator.
      if (getPostDraft().viewer_is_moderator === false && !getPostDraft().space_can_announce) {
        onError('Only moderators can schedule a post.');
        return;
      }
      openScheduleSheetFromCatalog(
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : SCHEDULE_SHEET_APPZET_SLUG,
      );
      return;
    }

    case 'picker.file': {
      if (!auth) {
        onError('Please sign in to attach a file.');
        return;
      }
      if (!getPostDraft().space_slug) {
        onError('Choose a space before attaching a file.');
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

    case 'picker.poll': {
      if (!auth) {
        onError('Please sign in to create a poll.');
        return;
      }
      openPollSheetFromCatalog(
        typeof argRec.sheet_appzet_slug === 'string' && argRec.sheet_appzet_slug
          ? argRec.sheet_appzet_slug
          : 'fc-post-poll-sheet',
      );
      return;
    }

    case 'picker.emoji': {
      const appzet =
        typeof argRec.form_appzet_slug === 'string' ? argRec.form_appzet_slug : 'fc-post-information';
      const targetPath =
        typeof argRec.target_path === 'string' ? argRec.target_path : 'children[3]';
      const emoji = window.prompt('Enter an emoji (or paste any character):') ?? '';
      if (emoji) appendToTextarea(appzet, targetPath, emoji);
      return;
    }

    case 'link.attach': {
      const appzet =
        typeof argRec.form_appzet_slug === 'string' ? argRec.form_appzet_slug : 'fc-post-information';
      const targetPath =
        typeof argRec.target_path === 'string' ? argRec.target_path : 'children[3]';
      const url = window.prompt('Paste a link URL:') ?? '';
      if (url && /^https?:\/\//i.test(url.trim())) {
        appendToTextarea(appzet, targetPath, ' ' + url.trim() + ' ');
      } else if (url) {
        onError('Please enter a full URL starting with http:// or https://');
      }
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
      if (options.length === 0) {
        onError('This control has no options wired.');
        return;
      }
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
      if (options.length === 0) {
        onError('This control has no options wired.');
        return;
      }
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
        console.warn('[appza-mobile] spaces.set_tab: no picked value', { argRec, item });
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
      if (options.length === 0) {
        onError('This control has no options wired.');
        return;
      }
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
          handleAction(
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
          handleAction(
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
      // A subtab entry with target_screen deep-links via nav.push instead of switching tabs.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const targetScreen =
        itemRec && typeof itemRec.target_screen === 'string' && itemRec.target_screen.length > 0
          ? (itemRec.target_screen as string)
          : null;
      if (targetScreen && catalog) {
        const target = catalog.template_screens?.find(
          (s) => s.app_map_screen_slug === targetScreen,
        );
        if (target) {
          if (currentScreenId != null) {
            setScreenStack((prev) => [...prev, currentScreenId]);
          }
          setSelectedScreenId(target.id);
        } else {
          console.warn('[appza-mobile] set_subtab target_screen not found:', targetScreen);
        }
        return;
      }
      const picked = runtimeValue ?? itemValue ?? '';
      if (picked) {
        setSpaceDetailControls({ active_subtab: picked });
      } else {
        console.warn('[appza-mobile] space_detail.set_subtab: no picked value', { argRec, item });
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
      const rawOptions = Array.isArray(argRec.options) ? argRec.options : [];
      const options: ViewModeOption[] = rawOptions
        .filter((o): o is Record<string, unknown> => isRecord(o))
        .map((o) => ({
          value: typeof o.value === 'string' ? o.value : '',
          label: typeof o.label === 'string' ? o.label : '',
          icon: typeof o.icon === 'string' ? o.icon : undefined,
        }))
        .filter((o) => o.value && o.label);
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      if (runtimeValue) {
        setSpaceDetailControls({ sort: runtimeValue });
        return;
      }
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
        console.warn('[appza-mobile] documents.set_draft: no field');
        return;
      }
      const raw = argRec.value !== undefined ? argRec.value : itemRec?.value;
      if (field === 'publish') {
        setDocumentDraft({ publish: raw === true || raw === 'true' });
      } else if (field === 'title' || field === 'message' || field === 'scheduled_at') {
        setDocumentDraft({ [field]: typeof raw === 'string' ? raw : '' });
      } else {
        console.warn(`[appza-mobile] documents.set_draft: unknown field ${field}`);
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

    case 'documents.open_schedule': {
      const sheetSlug =
        typeof argRec.sheet_appzet_slug === 'string'
          ? argRec.sheet_appzet_slug
          : SCHEDULE_SHEET_APPZET_SLUG;
      openScheduleSheet({
        appzetSlug: sheetSlug,
        value: getDocumentDraft().scheduled_at,
        presentation: schedulePresentation(readAppzetPropsFromCatalog(sheetSlug)),
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
        console.warn('[appza-mobile] leaderboard.set_range: no picked value', { argRec, item });
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
      const levelsEndpoint = readDataSourceEndpointFromCatalog(dsSlug);
      if (!levelsEndpoint) {
        onError(`No endpoint for the ${dsSlug} data source.`);
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
        // Absolute, or the fetch resolves against the Capacitor bundle's origin.
        levelsEndpoint: absolutizeEndpoint(levelsEndpoint),
        authHeader: (currentAuthHeader ?? ''),
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
        console.warn('[appza-mobile] media.set_type: no picked value', { argRec, item });
      }
      return;
    }

    case 'media.open': {
      // A photo opens the viewer; a video goes to its post, so the viewer never hosts a player.
      const kind = itemRec && typeof itemRec.kind === 'string' ? itemRec.kind : '';
      if (kind === 'video' || kind === 'audio') {
        handleAction({ ...inv, action_slug: 'media.open_post' }, deps);
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
      // Find the row rather than reuse siblingIndex — they diverge once anything is filtered.
      const tappedUrl = itemRec && typeof itemRec.url === 'string' ? itemRec.url : '';
      const startAt = photos.findIndex((row) => row.url === tappedUrl);
      openMediaViewer({
        appzetSlug: viewerSlug,
        items: photos,
        index: startAt >= 0 ? startAt : (typeof siblingIndex === 'number' ? siblingIndex : 0),
        presentation: mediaViewerPresentation(readAppzetPropsFromCatalog(viewerSlug)),
        onDownload: (media) =>
          handleAction(
            { action_slug: 'media.download', args: argRec, item: media },
            deps,
          ),
        onViewPost: (media) =>
          handleAction({ action_slug: 'media.open_post', args: argRec, item: media }, deps),
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
          onBlock: (t) => handleAction({
              action_slug: 'chat.block_confirm',
              // The confirm's copy lives on its own action; the menu's args would give an empty bag.
              args: readActionDefaultsFromCatalog('chat.block_confirm') ?? undefined,
              item: t,
            }, deps),
          onDelete: (t) =>
            handleAction({
              action_slug: 'chat.delete_conversation_confirm',
              args: readActionDefaultsFromCatalog('chat.delete_conversation_confirm') ?? undefined,
              item: t,
            }, deps),
          onCopy: (handle) => {
            if (handle && navigator.clipboard) {
              void navigator.clipboard.writeText(handle);
              onInfo(presentation.copiedToast);
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
      const membersEndpoint = readDataSourceEndpointFromCatalog(dsSlug);
      if (!membersEndpoint) {
        onError(`No endpoint for the ${dsSlug} data source.`);
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
        listEndpoint: absolutizeEndpoint(membersEndpoint),
        authHeader: (currentAuthHeader ?? ''),
        onViewCommunity: (t) => handleAction({
          action_slug: 'chat.view_community',
          args: readActionDefaultsFromCatalog('chat.view_community') ?? undefined,
          item: t,
        }, deps),
        onLeave: (t) => handleAction({
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
        onError('This conversation is not attached to a community.');
        return;
      }
      const targetSlug =
        typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : 'space-detail';
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        onError('The community screen is not in this template.');
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
        onError('That conversation could not be identified.');
        closeMemberRemoveConfirm();
        return;
      }
      if (!auth) {
        onError('Please sign in first.');
        closeMemberRemoveConfirm();
        return;
      }
      const leavesScreen =
        inv.action_slug === 'chat.leave' || inv.action_slug === 'chat.delete_conversation';
      void (async () => {
        try {
          const res = await fetch(absolutizeEndpoint(endpoint), {
            method: typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST',
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: (currentAuthHeader ?? ''),
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
            onError(msg);
            return;
          }
          onInfo(toast);
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
          onError(err instanceof Error ? err.message : String(err));
        } finally {
          closeMemberRemoveConfirm();
        }
      })();
      return;
    }

    case 'chat.send': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (!endpoint) {
        onError('chat.send is missing its endpoint.');
        return;
      }
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      void sendChatMessage({
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method : 'POST',
        authHeader: currentAuthHeader ?? '',
                absolutize: absolutizeEndpoint,
        createThreadEndpoint:
          typeof argRec.create_thread_endpoint === 'string' && argRec.create_thread_endpoint
            ? argRec.create_thread_endpoint
            : '/wp-json/fcom-mobile/api/v1/chat/threads/create',
        // Adopt the new thread id into the slice and the route bag, and drop the intent so the next send isn't a second create.
        onThreadCreated: (threadId: number) => {
          setRouteParams({ thread_id: threadId });
          setChatControls({ thread_id: String(threadId), intent_user_id: '', can_send: 'yes' });
        },
        onError,
        onSuccess: () => {
          // Open the force-refresh window so the list bypasses the proxy's transient.
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
        onError('chat.delete_message is missing its endpoint.');
        return;
      }
      const messageId = itemRec ? readDataPath(itemRec, 'data.id') : undefined;
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      void deleteChatMessage(typeof messageId === 'string' || typeof messageId === 'number' ? messageId : '', {
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method : 'POST',
        authHeader: currentAuthHeader ?? '',
        absolutize: absolutizeEndpoint,
        toast: typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Message deleted',
        onError,
        onInfo,
        onSuccess: () => {
          // Open the force-refresh window so the list bypasses the proxy's transient.
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
        authHeader: currentAuthHeader ?? '',
        absolutize: absolutizeEndpoint,
        onError: onError,
      });
      return;
    }

    case 'chat.attach_image': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      if (!endpoint) {
        onError('chat.attach_image is missing its endpoint.');
        return;
      }
      pickAndUploadChatImage({
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method : 'POST',
        accept: typeof argRec.accept === 'string' ? argRec.accept : 'image/*',
        authHeader: currentAuthHeader ?? '',
        absolutize: absolutizeEndpoint,
        onError,
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
        console.warn('[appza-mobile] chat.open: target not in catalog', targetSlug);
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
        console.warn('[appza-mobile] chat.open: neither a thread id nor a space slug', item);
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
        onError('Could not identify who to message.');
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
        onError: onError,
        onInfo: onInfo,
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
        onError: onError,
        onInfo: onInfo,
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
        onError: onError,
        onInfo: onInfo,
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
        onError: onError,
        onInfo: onInfo,
        requireAuth: requireAuthOrLogin,
        readPath: (item, path) => readDataPath(item, path),
        sheetProps: (slug) => readAppzetPropsFromCatalog(slug),
        sheetChildStyles: (slug) =>
          childStylesFromCustomizations(slug, OPTIONS_SHEET_CHILD_COUNT, currentCustomizations),
      });
      return;
    }

    case 'media.open_post': {
      // Not post.open: a media row carries the post slug on `feed_slug` and has no nested `space`.
      const targetSlug =
        typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : 'post-detail';
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        console.warn('[appza-mobile] media.open_post: target not in catalog', targetSlug);
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
      const url = itemRec ? readDataPath(itemRec, `data.${urlPath}`) : undefined;
      if (typeof url !== 'string' || url === '') {
        console.warn('[appza-mobile] media.download: no url on the item', item);
        return;
      }
      const namePath =
        typeof argRec.filename_path === 'string' ? argRec.filename_path : 'title';
      const rawName = itemRec ? readDataPath(itemRec, `data.${namePath}`) : undefined;
      const filename = typeof rawName === 'string' && rawName !== '' ? rawName : undefined;

      // Native download via AppzaDownload: Capacitor's Android bridge has no onCreateWindow, so window.open('_blank') silently does nothing.
      const nativeDownload = (
        window as unknown as {
          Capacitor?: {
            Plugins?: {
              AppzaDownload?: {
                download: (o: { url: string; filename?: string }) => Promise<unknown>;
              };
            };
          };
        }
      ).Capacitor?.Plugins?.AppzaDownload;

      if (nativeDownload?.download) {
        void nativeDownload
          .download({ url, filename })
          .then(() => onInfo?.(filename ? `Saving ${filename}…` : 'Saving…'))
          .catch((e: unknown) => {
            console.warn('[appza-mobile] media.download failed', e);
            onError('Could not save the file.');
          });
        return;
      }

      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    case 'documents.submit': {
      const uploadEndpoint =
        typeof argRec.upload_endpoint === 'string' ? argRec.upload_endpoint : '';
      const createEndpoint =
        typeof argRec.create_endpoint === 'string' ? argRec.create_endpoint : '';
      if (!uploadEndpoint || !createEndpoint) {
        console.warn('[appza-mobile] documents.submit: endpoints missing from the action');
        return;
      }
      if (!auth) {
        onError('Please sign in to upload documents.');
        return;
      }
      void submitDocumentDraft({
        uploadEndpoint,
        createEndpoint,
        authHeader: basicAuthHeader(auth),
        absolutize: absolutizeEndpoint,
        onError: (message) => onError(message),
        onSuccess: () => {
          resetDocumentDraft('');
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
        console.warn(`[appza-mobile] documents.open_add: ${targetSlug} not in catalog`);
        return;
      }
      const spaceSlug =
        typeof (window as unknown as { __appzaRouteParams?: Record<string, unknown> })
          .__appzaRouteParams?.slug === 'string'
          ? ((window as unknown as { __appzaRouteParams?: Record<string, unknown> })
              .__appzaRouteParams!.slug as string)
          : '';
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
        console.warn('[appza-mobile] space.compose_open: create-post-page not in catalog');
        return;
      }
      let ctx: unknown = effectiveItem;
      if (ctx == null) {
        const spaceSlug =
          typeof (window as unknown as { __appzaRouteParams?: Record<string, unknown> })
            .__appzaRouteParams?.slug === 'string'
            ? ((window as unknown as { __appzaRouteParams?: Record<string, unknown> })
                .__appzaRouteParams!.slug as string)
            : '';
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
        console.warn('[appza-mobile] post.open: post-detail not in catalog');
        return;
      }
      // Don't push the shown post onto itself — the back stack would grow with nothing changing.
      if (target.id === currentScreenId) {
        const openSlug = isRecord(effectiveItem) ? effectiveItem.slug : undefined;
        const shownSlug = getRouteParams()?.post_slug;
        if (typeof openSlug === 'string' && openSlug !== '' && openSlug === shownSlug) return;
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

    case 'space.join':
    case 'space.leave': {
      const method = typeof argRec.method === 'string' ? argRec.method : 'POST';
      const endpointTpl = typeof argRec.endpoint === 'string' ? argRec.endpoint : '';
      const slugPath = typeof argRec.slug_path === 'string' ? argRec.slug_path : 'data.slug';
      const slug = readDataPath(effectiveItem, slugPath);
      if (!endpointTpl || typeof slug !== 'string' || !slug) {
        console.warn('[appza-mobile] space.join/leave: missing endpoint or slug', {
          endpointTpl,
          slug,
        });
        return;
      }
      const endpoint = endpointTpl.replace('{space_slug}', encodeURIComponent(slug));
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      const authHeader = currentAuthHeader;
      if (authHeader) headers.Authorization = authHeader;
      fetch(absolutizeEndpoint(endpoint), { method, headers, credentials: 'omit' })
        .then(async (res) => {
          if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${t.slice(0, 120)}`);
          }
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(new CustomEvent('appza:refresh-data'));
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : String(err));
        });
      return;
    }

    case 'member.options': {
      const rawItems = Array.isArray(argRec.items) ? argRec.items : [];
      const items = rawItems
        .filter((i): i is Record<string, unknown> => isRecord(i))
        .map((i) => i as unknown as MemberMenuItem)
        .filter((i) => typeof i.action_slug === 'string' && i.action_slug);
      if (items.length === 0) {
        onError('The member options menu has no entries wired.');
        return;
      }
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
      if (roles.length === 0) {
        onError('No membership roles configured.');
        return;
      }
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
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      const toastMsg =
        typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Membership updated';
      const rawUserId = readDataPath(effectiveItem, userIdPath);
      const userId =
        typeof rawUserId === 'number'
          ? rawUserId
          : typeof rawUserId === 'string' && rawUserId !== '' && !Number.isNaN(Number(rawUserId))
            ? Number(rawUserId)
            : null;
      if (!endpoint || !role || userId === null || !spaceSlug) {
        onError('Could not update membership — missing endpoint, role, user, or space.');
        return;
      }
      if (!auth) {
        onError('Please sign in to change memberships.');
        return;
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      const authHeader = currentAuthHeader;
      if (authHeader) headers.Authorization = authHeader;
      fetch(absolutizeEndpoint(endpoint), {
        method,
        headers,
        body: JSON.stringify({ space_slug: spaceSlug, user_id: userId, role }),
        credentials: 'omit',
      })
        .then(async (res) => {
          const json = await res.json().catch(() => null);
          // fcom-mobile answers 200 with the real status in `response.status`.
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
            throw new Error(msg);
          }
          onInfo(toastMsg);
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(
            new CustomEvent('appza:refresh-data', { detail: { data_source: refetchDs } }),
          );
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : String(err));
        });
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
        const props = readAppzetPropsFromCatalog(formSlug);
        const usersEndpoint =
          typeof argRec.users_endpoint === 'string'
            ? argRec.users_endpoint
            : '/wp-json/fcom-mobile/api/v1/users/search';
        const spaceSlug = getSpaceDetailControls().space_slug;
        const authHeader = currentAuthHeader;
        openAddMemberModal({
          appzetSlug: formSlug,
          ...addMemberPresentation(props),
          childStyles: childStylesFromCustomizations(
            formSlug,
            ADD_MEMBER_CHILD_COUNT,
            currentCustomizations,
          ),
          usersEndpoint: absolutizeEndpoint(usersEndpoint),
          spaceSlug: spaceSlug ?? undefined,
          authHeader,
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
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : 'fc-space-members';
      const toastMsg =
        typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Member added';
      const rawUserId = argRec.user_id;
      const userId =
        typeof rawUserId === 'number'
          ? rawUserId
          : typeof rawUserId === 'string' && rawUserId !== '' && !Number.isNaN(Number(rawUserId))
            ? Number(rawUserId)
            : null;
      if (!endpoint || !role || userId === null || !spaceSlug) {
        onError('Could not add member — missing endpoint, role, user, or space.');
        return;
      }
      if (!auth) {
        onError('Please sign in to add members.');
        return;
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      const authHeader = currentAuthHeader;
      if (authHeader) headers.Authorization = authHeader;
      fetch(absolutizeEndpoint(endpoint), {
        method,
        headers,
        body: JSON.stringify({ space_slug: spaceSlug, user_id: userId, role }),
        credentials: 'omit',
      })
        .then(async (res) => {
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
            throw new Error(msg);
          }
          closeAddMemberModal();
          onInfo(toastMsg);
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(
            new CustomEvent('appza:refresh-data', { detail: { data_source: refetchDs } }),
          );
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : String(err));
        });
      return;
    }

    // Blocking confirms first, reusing the member-removal alert.
    case 'profile.block_confirm':
    case 'profile.unblock_confirm':
    case 'member.remove_confirm': {
      // On the profile row the name is top-level; a space member row nests it.
      const isProfileConfirm =
        action_slug === 'profile.block_confirm' || action_slug === 'profile.unblock_confirm';
      const subjectPath =
        typeof argRec.subject_path === 'string'
          ? argRec.subject_path
          : isProfileConfirm
            ? 'data.display_name'
            : 'data.xprofile.display_name';
      const rawSubject = readDataPath(effectiveItem, subjectPath);
      const subject = typeof rawSubject === 'string' && rawSubject ? rawSubject : 'Member';
      const message =
        typeof argRec.message === 'string'
          ? argRec.message
          : action_slug === 'profile.block_confirm'
            ? 'Blocking this user will hide their posts from your feed and prevent them from interacting with you. Are you sure you want to block this user?'
            : action_slug === 'profile.unblock_confirm'
              ? 'Are you sure you want to unblock this user?'
              : undefined;
      const cancelLabel = typeof argRec.cancel_label === 'string' ? argRec.cancel_label : undefined;
      const confirmLabel = typeof argRec.confirm_label === 'string' ? argRec.confirm_label : undefined;
      const removeActionSlug =
        typeof argRec.remove_action_slug === 'string'
          ? argRec.remove_action_slug
          : action_slug === 'profile.block_confirm'
            ? 'profile.block'
            : action_slug === 'profile.unblock_confirm'
              ? 'profile.unblock'
              : 'member.remove';
      openMemberRemoveConfirm({
        subject,
        message,
        cancelLabel,
        confirmLabel,
        ...(isProfileConfirm ? { actionsLayout: 'material' as const, confirmTone: 'primary' as const } : {}),
        item: effectiveItem,
        removeActionSlug,
      });
      return;
    }

    case 'member.remove': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const userIdPath =
        typeof argRec.user_id_path === 'string' ? argRec.user_id_path : 'data.user_id';
      const spaceSlug = getSpaceDetailControls().space_slug;
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      const toastMsg =
        typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Member removed';
      const rawUserId = readDataPath(effectiveItem, userIdPath);
      const userId =
        typeof rawUserId === 'number'
          ? rawUserId
          : typeof rawUserId === 'string' && rawUserId !== '' && !Number.isNaN(Number(rawUserId))
            ? Number(rawUserId)
            : null;
      if (!endpoint || userId === null || !spaceSlug) {
        onError('Could not remove member — missing endpoint, user, or space.');
        closeMemberRemoveConfirm();
        return;
      }
      if (!auth) {
        onError('Please sign in to remove members.');
        closeMemberRemoveConfirm();
        return;
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      const authHeader = currentAuthHeader;
      if (authHeader) headers.Authorization = authHeader;
      fetch(absolutizeEndpoint(endpoint), {
        method,
        headers,
        body: JSON.stringify({ space_slug: spaceSlug, user_id: userId }),
        credentials: 'omit',
      })
        .then(async (res) => {
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
            throw new Error(msg);
          }
          onInfo(toastMsg);
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(
            new CustomEvent('appza:refresh-data', { detail: { data_source: refetchDs } }),
          );
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          closeMemberRemoveConfirm();
        });
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
          readDataSourceEndpointFromCatalog(dsSlug) ??
          '/wp-json/fcom-mobile/api/v1/spaces/invitations';
        const authHeader = currentAuthHeader;

        openInviteUserModal({
          appzetSlug: formSlug,
          ...invitePresentation(props),
          childStyles: childStylesFromCustomizations(
            formSlug,
            INVITE_USER_CHILD_COUNT,
            currentCustomizations,
          ),
          // Absolute: a Capacitor build has no origin to resolve a root-relative path.
          listEndpoint: absolutizeEndpoint(listEndpoint),
          spaceSlug: getSpaceDetailControls().space_slug ?? undefined,
          authHeader,
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
      const inviteeName = typeof argRec.invitee_name === 'string' ? argRec.invitee_name : '';
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      const spaceSlug = getSpaceDetailControls().space_slug;
      if (!spaceSlug) {
        onError('Could not invite — no space in context.');
        return;
      }
      if (!auth) {
        onError('Please sign in to invite people.');
        return;
      }
      {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        const authHeader = currentAuthHeader;
        if (authHeader) headers.Authorization = authHeader;
        fetch(absolutizeEndpoint(endpoint), {
          method,
          headers,
          body: JSON.stringify({
            space_slug: spaceSlug,
            email,
            invitee_name: inviteeName,
            role,
          }),
          credentials: 'omit',
        })
          .then(async (res) => {
            const outcome = await readInvitationOutcome(res);
            if (!outcome.ok) throw new Error(outcome.message);
            // Prefer the endpoint's message: it tells "joined" from "invitation emailed".
            onInfo(
              outcome.message ||
                (typeof argRec.toast_message === 'string'
                  ? argRec.toast_message
                  : 'Invitation sent'),
            );
            closeInviteUserModal();
            const g = window as unknown as { __appzaForceRefreshUntil?: number };
            g.__appzaForceRefreshUntil = Date.now() + 3000;
            window.dispatchEvent(
              new CustomEvent('appza:refresh-data', { detail: { data_source: refetchDs } }),
            );
          })
          .catch((err) => {
            onError(err instanceof Error ? err.message : String(err));
          });
      }
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
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      const rawId = readDataPath(effectiveItem, idPath);
      const invitationId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string' && rawId !== '' && !Number.isNaN(Number(rawId))
            ? Number(rawId)
            : null;
      const spaceSlug = getSpaceDetailControls().space_slug;

      if (!endpoint || invitationId === null) {
        onError('Could not act on this invitation — missing endpoint or id.');
        if (isDelete) closeMemberRemoveConfirm();
        return;
      }
      if (!auth) {
        onError('Please sign in to manage invitations.');
        if (isDelete) closeMemberRemoveConfirm();
        return;
      }
      {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        const authHeader = currentAuthHeader;
        if (authHeader) headers.Authorization = authHeader;
        fetch(absolutizeEndpoint(endpoint), {
          method,
          headers,
          body: JSON.stringify({ space_slug: spaceSlug, invitation_id: invitationId }),
          credentials: 'omit',
        })
          .then(async (res) => {
            const outcome = await readInvitationOutcome(res);
            if (!outcome.ok) throw new Error(outcome.message);
            onInfo(
              outcome.message ||
                (typeof argRec.toast_message === 'string'
                  ? argRec.toast_message
                  : isDelete
                    ? 'Invitation deleted'
                    : 'Invitation resent'),
            );
            const g = window as unknown as { __appzaForceRefreshUntil?: number };
            g.__appzaForceRefreshUntil = Date.now() + 3000;
            window.dispatchEvent(
              new CustomEvent('appza:refresh-data', { detail: { data_source: refetchDs } }),
            );
          })
          .catch((err) => {
            onError(err instanceof Error ? err.message : String(err));
          })
          .finally(() => {
            if (isDelete) closeMemberRemoveConfirm();
          });
      }
      return;
    }

    case 'invitation.copy_link': {
      const urlPath = typeof argRec.url_path === 'string' ? argRec.url_path : 'data.access_url';
      const raw = readDataPath(effectiveItem, urlPath);
      const url = typeof raw === 'string' ? raw : '';
      if (!url) {
        onError('This invitation has no link to copy.');
        return;
      }
      void copyToClipboard(url).then((copied) => {
        if (copied) {
          onInfo(
            typeof argRec.toast_message === 'string'
              ? argRec.toast_message
              : 'Invitation link copied',
          );
        } else {
          onError('Could not copy the link.');
        }
      });
      return;
    }

    default:
      console.info('[appza-mobile] action dispatched (no-op):', action_slug, argRec, {
        effectiveItem,
      });
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
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
  // Overlays open outside PlacementRenderer, so resolve overrides here or saved Options edits never reach the app.
  const resolved = resolveOverridableColumn(
    currentCustomizations,
    'appzet',
    slug,
    'default_props_override',
    base,
  );
  return isRecord(resolved) ? resolved : base;
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

let currentCustomizations: unknown = null;

function setCustomizationsForActions(customizations: unknown): void {
  currentCustomizations = customizations;
}

function readDataSourceEndpointFromCatalog(slug: string): string | null {
  const cat = (window as unknown as { __appzaCatalog?: { data_sources?: unknown[] } })
    .__appzaCatalog;
  const sources = Array.isArray(cat?.data_sources) ? cat!.data_sources! : [];
  const found = sources.find(
    (d): d is Record<string, unknown> =>
      isRecord(d) && (d as Record<string, unknown>).slug === slug,
  );
  return found && typeof found.endpoint === 'string' && found.endpoint
    ? (found.endpoint as string)
    : null;
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

// The async Clipboard API needs a secure origin; an http WebView has none.
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

function formatNowLabel(d: Date): string {
  const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dateStr} · ${timeStr}`;
}

function appendToTextarea(appzetSlug: string, primitivePath: string, text: string): void {
  const wrapper = document.querySelector(
    `[data-appza-appzet-slug="${CSS.escape(appzetSlug)}"][data-appza-primitive-path="${CSS.escape(primitivePath)}"]`,
  );
  if (!wrapper) return;
  const el = wrapper.querySelector('ion-textarea, ion-input, textarea, input') as
    | (HTMLElement & { value?: string; setFocus?: () => Promise<void> })
    | null;
  if (!el) return;
  const current = typeof el.value === 'string' ? el.value : '';
  el.value = current + text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  if (typeof el.setFocus === 'function') void el.setFocus();
}

function ConfirmDeleteModal({
  title,
  message,
  cta,
  variant,
  cancelLabel,
  inFlight,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  cta: string;
  variant?: string;
  cancelLabel?: string;
  inFlight: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (variant === 'text') {
    const word: React.CSSProperties = {
      border: 0,
      background: 'none',
      padding: '6px 4px',
      color: 'rgb(37, 99, 235)',
      fontSize: 14,
      fontWeight: 500,
      letterSpacing: 0.4,
      cursor: inFlight ? 'not-allowed' : 'pointer',
    };
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="appza-confirm-text"
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center', zIndex: 70 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div style={{ background: '#fff', borderRadius: 4, padding: '20px 18px 10px', width: 'min(280px, 80%)', boxShadow: '0 12px 30px rgba(0,0,0,0.25)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</h3>
          <p style={{ margin: '14px 0 18px', fontSize: 11, color: '#4b5563' }}>{message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={onCancel} disabled={inFlight} style={word}>
              {cancelLabel ?? 'CANCEL'}
            </button>
            <button type="button" onClick={onConfirm} disabled={inFlight} style={word}>
              {cta}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 70,
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
          width: 'min(320px, 88%)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: '#111827' }}>{title}</h3>
        <p style={{ margin: '6px 0 14px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
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
      const res = await fetch(
        `${listEndpoint}${sep}feed_id=${encodeURIComponent(String(feedId))}`,
        {
          credentials: 'omit',
          headers: {
            Accept: 'application/json',
            Authorization: basicAuthHeader(auth),
          },
        },
      );
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
      const res = await fetch(absolutizeEndpoint(endpoint), {
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

  // Track visualViewport so the keyboard doesn't hide the composer.
  const [visibleHeight, setVisibleHeight] = useState<number>(() =>
    typeof window !== 'undefined'
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 800,
  );
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVisibleHeight(vv.height);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={panelTitle}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: visibleHeight,
        background: 'rgba(15,23,42,0.55)',
        display: 'grid',
        placeItems: 'end center',
        zIndex: 70,
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
          height: Math.max(240, Math.round(visibleHeight * 0.78)),
          maxHeight: visibleHeight,
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
            onFocus={() => {
              // Some Android WebViews lag the visualViewport resize, so nudge the composer into view.
              setTimeout(() => {
                composerRef.current?.scrollIntoView({
                  block: 'end',
                  behavior: 'smooth',
                });
              }, 250);
            }}
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
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
              {name}
            </span>
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

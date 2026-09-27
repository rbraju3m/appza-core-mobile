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
  announceModerationDone,
} from '@appza/renderer';
import {
  BootstrapEnvelopeSchema,
  type BootstrapEnvelope,
  type Catalog,
  type TemplateScreen,
} from '@appza/schemas';

/**
 * @appza/mobile — Capacitor shell that mounts ScreenRenderer against the
 * SAME bootstrap envelope the WP-plugin simulator consumes.
 *
 * Auth + write-action dispatcher (auth.login/logout, post.like,
 * bookmark.toggle, comment.create, post.create, post.delete) is a straight
 * port of the plugin-admin implementation. Kept in-file for now — the
 * proper extraction into a shared `@appza/app-shell` package is queued.
 * The three axes shared with plugin-admin: (1) StoredAuth persisted in
 * localStorage + mirrored to window.__appzaAuthHeader so useDataSource
 * picks it up; (2) optimistic-UI reactions via imperative DOM writes
 * (data-appza-item-id + data-appza-primitive-path stamped by renderer);
 * (3) in-viewport overlays (ConfirmDeleteModal, CommentPanel) instead of
 * window.prompt/alert so it works on-device.
 *
 * Deliberately NOT ported (yet): picker.image, picker.video, picker.emoji,
 * link.attach, poll composer. Text-only post.create works; media
 * attachments are the next slice.
 */

const SITE_URL = (import.meta.env.VITE_APPZA_SITE_URL as string | undefined) ?? 'http://tutor-lms-mobile.local';
const TEMPLATE = (import.meta.env.VITE_APPZA_TEMPLATE as string | undefined) ?? 'fluent-community-default';

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; envelope: BootstrapEnvelope }
  | { kind: 'error'; message: string };

// Renderer's useDataSource hook needs an absolute previewProxy URL —
// relative /wp-json/ doesn't resolve under capacitor://.
window.appzaCoreConfig = {
  endpoints: {
    previewProxy: `${SITE_URL}/wp-json/appza/v1/preview/data`,
  },
};

const AUTH_STORAGE_KEY = 'appza:auth';

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
    /* localStorage unavailable — app just runs unauthenticated */
  }
}

/**
 * What the shared image picker needs to know for one open.
 *
 * `sink` is what makes it shared. Without one the URLs land on the post
 * draft, which is where every caller before post detail wanted them;
 * with one they go to the caller instead, because a comment's pending
 * images belong to a comment that does not exist yet and must not be
 * mixed into whatever the composer is holding.
 */
type ImagePickerTarget = {
  endpoint: string;
  method: string;
  /** The file input's accept list. Defaults to images. */
  accept?: string;
  onStart?: () => void;
  /** Takes the uploaded URLs instead of the post draft. */
  sink?: (urls: string[]) => void;
  /** Called when the upload produced nothing usable. */
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

// In-flight guard for reaction toggles. Keyed by `${feedId}:${reactType}`.
// Rapid taps on the same button before the network round-trip completes
// would otherwise re-read stale `my_reactions` (still empty until success)
// and treat every tap as another "add", stacking DOM increments and firing
// duplicate POSTs. Any tap while the previous is pending is dropped.
const reactionInFlight = new Set<string>();

// Ionicon + Ionic-theme-color pairs for reaction toggle states. Mirrors
// Reaction visual config. childPath / countPath are hardcoded for
// the timeline layout (fc-post-card). Card + list variants have the
// like button at different child indices, so applyReactionOptimistic
// now queries by the semantic `data-appza-action` attribute the
// SSRenderer stamps — works across all three variants without needing
// per-variant config here. The paths below are kept only as a
// fallback for the count text (whose semantic attr doesn't exist yet).
const REACTION_UI: Record<
  string,
  { actionName: string; iconOn: string; iconOff: string; colorOn: string; countPathTimeline: string | null; countActionName: string | null }
> = {
  like: {
    actionName: 'on_tap_like',
    iconOn: 'heart',
    iconOff: 'heart-outline',
    colorOn: 'danger',
    // For timeline the comments-count text sits at children[14] and the
    // like-count at children[13]. Card / list variants use raw integer
    // counts (data.reactions_count → children[N].text) which optimistic
    // update can't easily locate without knowing N. We adjust the count
    // for the like button's PAIRED count text by querying the wrapper
    // that shares the parent and sits directly after the like button —
    // see selectCountWrapper below.
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
    // Query the reaction button by its semantic action attribute rather
    // than a hardcoded child index. Works for timeline (children[10]),
    // card (children[6]), list (children[5]) uniformly.
    const btn = wrapper.querySelector<HTMLElement>(
      `[data-appza-action="${cfg.actionName}"]`,
    );
    if (btn) {
      const nextIcon = on ? cfg.iconOn : cfg.iconOff;
      const nextColor = on ? cfg.colorOn : 'medium';
      // Pass the imported SVG data via `icon=`, never a bare kebab
      // `name=`. Ionicons' built-in name registry does NOT contain
      // 'heart' / 'bookmark' unless addIcons() was called, and this app
      // deliberately ships a static import registry instead — so a bare
      // name resolves to nothing and the glyph DISAPPEARS between the tap
      // and the refetch, logging an Ionicons warning on the way out.
      // Falls back to the outline variant, then to the current icon, so
      // an unknown name can never blank the button.
      //
      // plugin-admin has had this right since the reactions work; the
      // mobile shell kept the old line, which is exactly why the
      // simulator never showed the warning. Keep the two in step.
      const resolved =
        resolveIcon(nextIcon) || resolveIcon(cfg.iconOff) || resolveIcon(cfg.iconOn);
      if (!resolved) return; // no valid icon at all → leave the DOM alone
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
    // reaction has no visible count (bookmark), so skip entirely — the
    // previous nextElementSibling strategy wrongly targeted children[11]
    // (comment button) on like taps and children[13] (like count) on
    // bookmark taps, wiping the comment icon and shifting the like count.
    let countWrap: HTMLElement | null = null;
    if (cfg.countPathTimeline) {
      countWrap = wrapper.querySelector<HTMLElement>(
        `[data-appza-primitive-path="${cfg.countPathTimeline}"]`,
      );
    }
    if (countWrap) {
      // ion-text renders content inside a shadow-DOM <p>; find it, or
      // fall back to the wrapper itself for plain text nodes.
      const target =
        countWrap.querySelector<HTMLElement>('ion-text p') ??
        countWrap.querySelector<HTMLElement>('ion-text') ??
        countWrap;
      const text = target.textContent ?? '';
      const match = text.match(/(\d+)/);
      const cur = match && match[1] ? parseInt(match[1], 10) : 0;
      const next = Math.max(0, cur + (on ? 1 : -1));
      // Preserve trailing text (e.g. " likes") if present; otherwise
      // render just the number (card + list variants use raw integers).
      const suffix = text.replace(/^\s*\d+/, '').trim();
      target.textContent = suffix ? `${next} ${suffix}` : String(next);
    }
  });
}

// Pipe FluentCommunity portal settings from the bootstrap envelope into
// the renderer's fcRuntimeSettings store. Runs after every bootstrap
// load (first render + pull-to-refresh) so the mobile follows whatever
// the site admin picked: Settings → Customization → "Members List
// Layout" (classic = list, grid = tiles), and the whole `composer`
// block the create-post screen branches on (post title pref, media cap,
// rich-media layout, FluentPlayer switches).
//
// The whole block is handed over as-is — the store validates and
// falls back per field, so a shell that has not been taught about a new
// setting still passes it through.
function applyFcRuntimeSettings(envelope: BootstrapEnvelope): void {
  const cfg = (envelope.runtime_config ?? null) as Record<string, unknown> | null;
  const fc = cfg && isRecord(cfg.fluent_community) ? (cfg.fluent_community as Record<string, unknown>) : null;
  if (!fc) return;
  setFcRuntimeSettings(fc);
}

// Absolutize an endpoint against the tunnel/SITE_URL. Catalog actions
// carry relative endpoints (/wp-json/...) which work fine in the WP
// simulator (SPA served from the WP origin) but fail on the packaged
// APK — the Capacitor WebView origin is http://localhost, so relative
// fetches never reach the WP site. Any endpoint already starting with
// http(s):// is returned untouched.
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

// Grammar: `children[N].value|checked|selectedValue`. Reads Ionic input
// values out of the DOM by the wrapper attributes SuperstructureRenderer
// stamps (data-appza-appzet-slug + data-appza-primitive-path).
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
    out[name] = v ?? '';
  }
  return out;
}

// FC's /feeds/create + /feeds/update expect topic_ids as an array of
// ints.
//
// Two shapes arrive here. The old single `ion-select` gave one value as a
// string; the composer's topic CHIPS give an array of ids, because the
// site's max_topics_per_post is often more than one. Both are wrapped
// into an array of numbers.
//
// An empty selection deletes the key rather than sending [] — FC's
// "topic_required" spaces validate against absence, and an empty array
// reads to array_intersect as "chose nothing" either way, but absence is
// the shape its own portal sends.
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

/**
 * Resolve a feed id off a screen-mount context blob (bound feed post
 * item stashed by nav.push(pass_item_as_context=true)). Matches the
 * feed_id_path grammar used by post.delete/report — `data.<key>` or
 * plain `<key>`. Returns null when the value can't be coerced.
 */
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
): string | null {
  if (!catalog || currentScreenId == null) return null;
  const screen = catalog.template_screens?.find((s) => s.id === currentScreenId);
  if (!screen) return null;
  const placements = (screen as unknown as Record<string, unknown>).placements;
  if (Array.isArray(placements)) {
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
  }
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
  /**
   * 'text' draws design 26's dialog (a lesson comment): plain blue CANCEL
   * and DELETE words, no outlined or red button. Anything else keeps the
   * post-detail look.
   */
  variant?: string;
  cancelLabel?: string;
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
   * aimed at this comment, exactly as if the reader had tapped Reply
   * inside the panel. The panel has had reply since chunk 2; what was
   * missing was a way in from the strip on the card.
   */
  replyTo?: { id: number | string; name: string };
  /**
   * Set by comment.edit. The panel opens with this comment's text in the
   * composer and sends to `endpoint` (PUT /comments/update) instead of
   * the create route — one composer, two verbs, rather than a second
   * editor that would drift from this one.
   */
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
  // Set by nav.push(pass_item_as_context=true); consumed by post.edit to
  // resolve feed_id off the passed post (composer form has no id field).
  screenContextRef: React.MutableRefObject<Record<string, unknown>>;
  // Cleared by nav.push so a fresh Edit tap re-prefills; read by the
  // prefill useEffect to skip when already done for this visit.
  screenPrefilledRef: React.MutableRefObject<Record<string, true>>;
  // The guest write guard. Navigates to the login screen and returns
  // false when nobody is signed in; see the definition in App() for why
  // this is a guard at write time rather than a gate on the control.
  requireAuthOrLogin: () => boolean;
};

export function App() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [screenStack, setScreenStack] = useState<number[]>([]);
  // Screen-mount context: seeded by nav.push(pass_item_as_context=true).
  // Keyed by target screen slug. Read by (a) the prefill effect that
  // fills fc-post-information on edit-post-page and (b) the post.edit
  // HTTP handler to resolve feed_id from the passed post (composer form
  // doesn't itself carry the id). Ref-not-state so writes don't rerender.
  // Context PERSISTS across re-renders on the same screen — post.edit
  // needs it at Save time.
  const screenContextRef = useRef<Record<string, unknown>>({});
  // Companion "already prefilled" flag. Prevents the prefill effect from
  // re-writing when currentScreen's memo re-computes; nav.push clears
  // the flag for a fresh Edit tap.
  const screenPrefilledRef = useRef<Record<string, true>>({});
  // Read stored auth AND publish it on window during the lazy initializer so
  // __appzaAuthHeader is set BEFORE any child useEffect fires (React runs
  // child effects first). Without this, useDataSourcePaged's initial fetch
  // in nested PlacementRenderers goes out unauthenticated — the fcom-mobile
  // endpoints return errors, the preview proxy falls back to fixtures, and
  // the members list on mobile shows the demo fixture instead of the real
  // 51 members from the space. Plugin-admin doesn't hit this because it
  // relies on the WP admin session cookie for auth, not a window global.
  const [auth, setAuthState] = useState<StoredAuth | null>(() => {
    const stored = readStoredAuth();
    if (stored && typeof window !== 'undefined') {
      const g = window as unknown as {
        __appzaAuthHeader?: string;
        __appzaCurrentUserId?: number;
      };
      g.__appzaAuthHeader = basicAuthHeader(stored);
      if (typeof stored.user_id === 'number') g.__appzaCurrentUserId = stored.user_id;
    }
    return stored;
  });
  const [errorToast, setErrorToast] = useState<string | null>(null);
  // Success/info toast — green, auto-clears after 2s. Used by the new post-menu
  // action cases (copy_link, pin_top, pin_sidebar, disable_comments, report,
  // edit) so a happy-path acknowledgement doesn't render in red.
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [commentPanel, setCommentPanel] = useState<CommentPanelState | null>(null);
  const reactedRef = useRef<Set<string>>(new Set());
  // Ticks every 30s so the composer's "posting as … · <date · time>" line
  // reflects the current moment. Mirrors plugin-admin's app-mode ticker.
  const [nowLabel, setNowLabel] = useState<string>(() => formatNowLabel(new Date()));
  useEffect(() => {
    const tick = () => setNowLabel(formatNowLabel(new Date()));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);
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
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioUploadEndpointRef = useRef<string | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  // The three document endpoints, stashed together when the paperclip is
  // tapped. Rename and delete fire from the composer's own rows long
  // after the picker has closed, so they cannot be read off the action's
  // args at call time — the ref is where they wait.
  const docEndpointsRef = useRef<{ upload: string; rename: string; remove: string } | null>(null);
  const uploadEndpointRef = useRef<ImagePickerTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const setAuth = useCallback((a: StoredAuth | null) => {
    writeStoredAuth(a);
    setAuthState(a);
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

  // Mirror initial auth to window on mount so useDataSource picks it up
  // on the very first bootstrap-consumer render (before any user action).
  useEffect(() => {
    const g = window as unknown as { __appzaAuthHeader?: string; __appzaCurrentUserId?: number };
    if (auth) {
      g.__appzaAuthHeader = basicAuthHeader(auth);
      if (typeof auth.user_id === 'number') g.__appzaCurrentUserId = auth.user_id;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Publish the viewer into the renderer's state bag, in the SAME effect
  // shape the window globals use — every sign-in and sign-out has to
  // reach both, or a placement gate and a fetch header disagree about
  // who is asking.
  useEffect(() => {
    setViewer({
      is_logged_in: !!auth,
      user_id: auth && typeof auth.user_id === 'number' ? auth.user_id : null,
    });
  }, [auth]);

  // Clear session state on logout.
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
              absolutizeEndpoint(endpoints.rename),
              (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? '',
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
            // A real delete, not a local drop. Unlike an image or an
            // audio file, an uploaded-but-unattached document CAN be
            // removed — FC Pro permits it when the media has no feed_id
            // and belongs to the asking user — so the trash icon leaves
            // nothing behind.
            const error = await deleteDraftDocument(
              id,
              absolutizeEndpoint(endpoints.remove),
              (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? '',
            );
            setDocumentBusy('');
            if (error) setErrorToast(error);
            else removePostDraftDocument(id);
          })();
        },
      }),
    [],
  );

  // Toast auto-dismiss.
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
        // Surface-gate template_screens once at ingest so every downstream
        // .find/.map/.filter already sees only rows tagged for this surface
        // (or 'both'). Screens tagged 'plugin' won't render on mobile.
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

        // Settings FIRST, screen SECOND. The boot decision below asks
        // canBrowseAsGuest(), which reads the site's access level out of
        // the runtime settings — asking before they are hydrated would
        // answer from the defaults every time and send a guest to the
        // feed on a locked-down site.
        applyFcRuntimeSettings(gated);
        setViewer({
          is_logged_in: !!storedAuth,
          user_id: storedAuth && typeof storedAuth.user_id === 'number' ? storedAuth.user_id : null,
        });

        // Where a signed-out visitor lands.
        //
        // This used to be "login-page, always". Noor's guest arc changes
        // it to follow the PORTAL: on a site whose access level is
        // `public` a guest reads the feed like anyone else, and the login
        // screen is somewhere they GO when they try to write (design 17).
        // On a `logged_in` or `role_based` site nothing has changed —
        // they still land on login, because there is nothing to read.
        //
        // A signed-in viewer always lands on the first screen; being
        // signed in is what the login screen was for.
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

  // Publish the catalog on a window global so PostOptionsPopover can look
  // up each menu item's action defaults (endpoint / method / patch_key)
  // at click time. Without this every non-copy_link menu action toasts
  // "missing endpoint or patch_key" because the menu-item wiring only
  // carries display metadata, not the HTTP shape.
  useEffect(() => {
    setCatalogGlobal(catalog);
  }, [catalog]);

  const screen = useMemo<TemplateScreen | null>(() => {
    if (!catalog || selectedScreenId == null) return null;
    return catalog.template_screens?.find((s) => s.id === selectedScreenId) ?? null;
  }, [catalog, selectedScreenId]);

  // The Leaderboard's levels card expands one way, so arriving on the
  // screen has to put it back in its landing state — otherwise a second
  // visit opens on a nine-level card with no control to collapse it,
  // because VIEW ALL is already gone. The two verdict strings go back to
  // 'loading' with it, or a stale one paints the previous visit's answer
  // over a card that has not fetched yet.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'leaderboard') return;
    resetLeaderboardControls();
  }, [screen?.app_map_screen_slug]);

  // A search keystroke still waiting out its debounce belongs to the
  // screen it was typed on. Leaving arms nothing new, but a timer already
  // armed would fire against a screen nobody is looking at and refetch
  // it. Dropping every channel on a screen change is cheaper than
  // reasoning about which one is still live.
  useEffect(() => {
    cancelDebouncedSearch();
  }, [screen?.app_map_screen_slug]);

  // Saved Posts arrives with a clean search box. Sort and layout are
  // preferences and survive; a search string is not one — reopening on
  // a phrase you typed last week would show "No matches" over a list
  // that is not empty, with the reason off screen in a field you have
  // to scroll to. The verdict resets with it so a stale 'empty' cannot
  // paint over a list still loading.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'bookmarks') return;
    resetBookmarkControls();
  }, [screen?.app_map_screen_slug]);

  // All Members opens on the Active tab with an empty search (design 5).
  // The sort is a preference and survives.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'all-members') return;
    resetMemberDirectoryControls();
  }, [screen?.app_map_screen_slug]);

  // Courses opens on All Courses, unfiltered. The sort survives.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'courses') return;
    resetCourseListControls();
  }, [screen?.app_map_screen_slug]);

  // A course's Students page opens with no search. The sort survives.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'course-students') return;
    resetCourseStudentsControls();
  }, [screen?.app_map_screen_slug]);

  // Moderation opens on Pending (design 7), whichever tab it was left on.
  useEffect(() => {
    if (screen?.app_map_screen_slug !== 'moderation') return;
    resetModerationControls();
  }, [screen?.app_map_screen_slug]);

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
    const slug = screen?.app_map_screen_slug;
    if (slug !== 'create-post-page' && slug !== 'edit-post-page') return;
    const wiring = readAppzetActionsFromCatalog('fc-post-information');
    const dsSlug =
      typeof wiring?.on_tap_space?.args?.data_source === 'string'
        ? (wiring.on_tap_space.args.data_source as string)
        : 'fc-post-space-picker';
    void preparePostComposer(dsSlug);
  }, [screen?.app_map_screen_slug]);

  // Prefill composer forms from screen-mount context set by
  // nav.push(pass_item_as_context=true). Currently only
  // fc-post-information on edit-post-page uses this. Guarded by
  // screenPrefilledRef so a screen memo re-compute doesn't retrigger
  // the write and overwrite user edits. Context stays put — post.edit
  // reads it at Save time to resolve feed_id.
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
          readAppzetActionsFromCatalog('fc-post-information')?.on_tap_space?.args
            ?.data_source as string ?? 'fc-post-space-picker',
          slug,
          topicIds,
        );
      },
    });
  }, [screen]);

  // Seed a default route.slug when landing on create-post-page or
  // edit-post-page without one. fc-post-information's topic dropdown
  // pulls from fc-space-detail, which needs route.slug to resolve to a
  // space — otherwise the DS returns nothing and the dropdown stays
  // empty. When the user opens create-post directly from the home feed
  // (no per-space context), we fall back to the first accessible space
  // from fc-spaces-discover. Mirrors plugin-admin's seed effect.
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
        // PlacementRenderer subscribes to spaceDetailControls (useHook) but
        // reads routeParams from a plain window global — mutating the
        // global alone won't re-render, so the topic dropdown's option
        // fetcher stays stuck on its initial empty params. Poke the
        // controls slice so subscribers re-render and re-resolve
        // resolveQueryParams against the fresh route.slug. Matches the
        // plugin-admin seed effect for the same reason.
        setSpaceDetailControls({ space_slug: firstSlug });
        window.dispatchEvent(new Event('appza:refresh-data'));
      })
      .catch(() => {
        /* silent — composer will render without space context */
      });
  }, [screen, auth]);

  // Overlay the live `now_label` on fc-user-avatar via the customizations
  // blob's appzet.<slug>.default_props_override. Matches plugin-admin's
  // app-mode behavior so the composer's date/time line ticks in real time.
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

  // Keep the action handler's view of the overrides in step with what the
  // renderer is drawing, so an imperatively-opened overlay is authored
  // from the same layers a composed AppZet renders from.
  useEffect(() => {
    setCustomizationsForActions(customizationsForRender);
  }, [customizationsForRender]);

  // The edit form's headline counter. Idempotent and delegated, so one
  // call at mount covers every time that form appears.
  useEffect(() => {
    startHeadlineCounter();
  }, []);

  const openDeleteConfirm = useCallback((p: PendingDelete) => setPendingDelete(p), []);
  const openCommentPanel = useCallback((p: CommentPanelState) => setCommentPanel(p), []);
  const openImagePicker = useCallback((target: ImagePickerTarget) => {
    // Stash the endpoint in a ref so the file input's onChange (which fires
    // async after the user picks) reads the right one. A state setter would
    // race the onChange since state updates aren't guaranteed to be visible
    // in the very next event tick.
    uploadEndpointRef.current = target;
    // The picker is shared, so its `accept` has to be set per open —
    // a comment takes images only, a post composer may not.
    if (fileInputRef.current) {
      fileInputRef.current.accept = target.accept ?? 'image/*';
      fileInputRef.current.click();
    }
  }, []);
  const openDocumentPicker = useCallback(
    (t: { upload: string; rename: string; remove: string; accept: string }) => {
      // Same ref-then-click shape as the image and audio pickers: the
      // input's onChange fires after this returns, so everything it needs
      // has to be somewhere it can read synchronously. The rename and
      // delete endpoints ride along because the composer's rows fire
      // those long after the picker has closed.
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

  /**
   * Upload the picked documents and put them on the draft.
   *
   * Sequential, not parallel: FluentCommunity writes a Media row per
   * call, and one file at a time is the only version of this whose
   * failure can be attributed to a file. No cap — FluentCommunity applies
   * none to `document_ids`, and inventing one here would refuse a post
   * the server would have accepted.
   */
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
      const auth = (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? '';
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
        setErrorToast(
          `Only ${max} audio file${max === 1 ? '' : 's'} can go on a post — ${picked.length - list.length} not added.`,
        );
      }
      if (list.length === 0) return;
      setUploadingCount((c) => c + list.length);
      const results = await Promise.all(
        list.map(async (file) => {
          try {
            const video = await uploadDraftVideo(file, endpoint, (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? '', 'audio');
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
      // Cap BEFORE uploading, not after. Uploading everything and then
      // keeping the first N leaves the rest on the server as orphaned
      // inactive Media rows that nothing will ever attach or clean up —
      // and there is no endpoint to remove them (see removePostDraftImage).
      // The post composer's cap does not apply to a sink: it counts
      // images already on the POST DRAFT, and a comment's attachments
      // are not on it. FluentCommunity applies no cap of its own to
      // comment media, so inventing one here would refuse an upload the
      // server would have taken.
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
      // A sink takes the URLs instead of the post draft — the comment
      // composer holds its own pending list, because the images belong
      // to a comment that does not exist yet.
      if (target.sink) {
        if (urls.length > 0) target.sink(urls);
        else target.onFail?.();
        return;
      }
      // The cap is applied again here, against the draft as it stands
      // now: two picks can be in flight at once, and the slice above only
      // knew about the images that existed when IT started.
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

  /**
   * The guest write guard.
   *
   * Noor's call for the guest arc: a signed-out viewer who taps like,
   * comment or bookmark is taken to the LOGIN SCREEN, not told off by a
   * toast. The action strip still draws on a logged-out feed (design 17),
   * so this is a guard at the moment of writing rather than a gate on the
   * control — hiding the icons would deviate from the design.
   *
   * Returns true when the caller may proceed. When it returns false it
   * has ALREADY navigated, so the caller must simply stop.
   *
   * The current screen is pushed onto the stack before leaving, so the
   * back arrow — and the post-login pop — return the viewer to the thing
   * they were trying to act on rather than to the top of the feed.
   */
  const requireAuthOrLogin = useCallback((): boolean => {
    if (auth) return true;
    const login = catalog?.template_screens?.find(
      (s) => s.app_map_screen_slug === 'login-page',
    );
    if (!login) {
      // A template with no login screen cannot ask anyone to sign in.
      // Say so rather than swallowing the tap in silence.
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
  // Silence unused-warning — screenStack is exposed for future stack UI;
  // dispatcher already reads/writes it via setScreenStack.
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
      // Must gate template_screens on refresh too — otherwise pull-to-refresh
      // leaks plugin-only and hidden screens back into the mobile drawer.
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

    // Touch listeners (mobile). touchmove uses passive:false so we can
    // preventDefault while pulling — otherwise the WebView cancels our
    // pointer stream as soon as it decides the drag is a scroll gesture.
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
        // Only preventDefault when actively pulling down at scroll-top,
        // so normal scrolling everywhere else is untouched.
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

    // Pointer listeners (desktop/mouse). Skip for touch — the touch path
    // handles that with preventDefault, and we don't want double-firing.
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
        {/*
          Popovers must live INSIDE ActionProvider — PostOptionsPopover's
          handlePick reads dispatch via useActionDispatch(), and outside
          the provider that resolves to the module-level no-op that just
          console.warns. On mobile the 3-dot menu opens but every tap
          silently drops (Copy Link, Edit, Delete, etc. all no-op).
        */}
        <ViewModePopover />
        <OptionsSheet />
        <PostSpaceSheet />
        <VideoSheet />
        <PollSheet />
        <PostOptionsPopover />
        {/* Member overflow flow: 3-dot bottom sheet → role picker sheet
         * (Change Membership) or center confirm alert (Remove from space).
         * All three components sit inside ActionProvider so their tap
         * handlers can dispatch through the shared context — the actual
         * API calls (member.set_role, member.remove) live in
         * dispatchAction alongside every other action handler. */}
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
              // The review modal stays open across its own confirm —
              // the dialog can be cancelled, so closing when the CTA
              // was merely TAPPED would be a lie. It closes here, on
              // the write actually landing.
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
          // Reset so the same file can be re-picked later without a full remount.
          e.target.value = '';
        }}
      />
      {/* Audio gets its OWN hidden input rather than sharing the image
          one: the accept list differs, and a shared input would need its
          `accept` swapped before every click — a race the picker would
          lose exactly when two glyphs are tapped in quick succession. */}
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
      {/* Documents get their own input for the same reason audio does —
          a different accept list, and no race over swapping it. */}
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


      {/* Images, and now the poll, have LEFT this strip — the composer
          draws both, in the card, where the designs put them. What is
          left is upload progress and the legacy video placeholder, which
          the edit-screen prefill still writes (see the note on
          post.edit). */}
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
              {buildDrawerMenu(catalog.template_screens ?? [], catalog.app_map).map((row) => (
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

/**
 * HTML back to the plain text a textarea can hold.
 *
 * Only reached when a comment carries `message_rendered` and no
 * `message` — FluentCommunity stores both, but a row that has been
 * through a transformer may only keep the rendered one, and prefilling
 * an edit with markup shows the reader their own paragraph tags.
 */
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

  /**
   * Is the reader looking at post detail?
   *
   * Three handlers ask, because three verbs mean something different
   * there than in a feed: Reply and Edit re-target the footer composer
   * instead of opening the bottom panel, and a post cannot be opened
   * onto itself. Resolved from the CATALOG's screen row rather than a
   * stored slug so it stays true however the screen was reached.
   */
  const isPostDetailScreen = (): boolean => {
    if (currentScreenId == null) return false;
    const screen = catalog?.template_screens?.find((sc) => sc.id === currentScreenId);
    // A lesson (Courses chunk 6) carries the same footer composer, so its
    // Reply re-targets the footer too.
    return screen?.app_map_screen_slug === 'post-detail' || screen?.app_map_screen_slug === 'course-lesson';
  };

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
      // Both composer screens start clean. This is the ONLY place that
      // can tell "opened the composer" from "came back to it": the
      // preview is its own screen, so returning from it changes the
      // screen slug exactly the way arriving does, and a reset keyed on
      // the slug wipes the draft the user just went to look at (P111).
      //
      // edit-post-page resets too, and MUST: nothing else clears the
      // draft between visits, so a create-post draft the user abandoned
      // would otherwise leak into an edit of an unrelated post — carrying
      // its images, its poll and its schedule onto someone else's words.
      // The prefill repopulates immediately from the bound item.
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
      // Carry the tapped item into the target screen's context BEFORE
      // the setSelectedScreenId — the prefill effect that watches the
      // screen sees it on the very first render pass, so the composer
      // form comes up already populated with no empty-form flash. Also
      // clear the "already prefilled" flag so a fresh Edit tap on a
      // different post re-prefills instead of skipping.
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
        // Convention: prefer `slug` as-is; also thread known synonyms
        // (space_slug, post_slug) so nested routes work.
        if (isRecord(effectiveItem)) {
          const ctx = effectiveItem as Record<string, unknown>;
          const routeBag: Record<string, unknown> = {};
          // Nested space slug on a post item wins for route.slug —
          // edit-post-page's topic dropdown DS is fc-space-detail, which
          // needs the SPACE slug, not the post slug. Without this the
          // post's own slug clobbers route.slug and the topic list is
          // empty. Carry the post slug separately as post_slug.
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
            // Space-detail screen needs its space_slug in the state slice
            // (not just route params) — placement visible_when + a few
            // future actions read it there.
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
      //
      // Published here rather than by the header itself, because the
      // header IS one of the things waiting on the answer.
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
      // `permalink` is FluentCommunity's word for a feed link's URL, and
      // the chip strip binds the row straight through — so the key list
      // learns it rather than the payload being reshaped to say `url`.
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
      window.open(url, '_blank', 'noopener,noreferrer');
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
      // The picker's payload is one viewer's answer to "where may I
      // post" — spaces, permissions, moderator verdict. Signing out must
      // drop it, or the next person to sign in on this device opens the
      // composer holding the previous one's destinations.
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
      const owningAppzet = findAppzetForAction(catalog, currentScreenId, 'auth.login');
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
      // A guest tapping the heart or the bookmark goes to the login
      // screen and comes back — the strip is drawn for them (design 17),
      // so the tap has to lead somewhere. Written as a check on `auth`
      // rather than on the guard's return so the narrowing below still
      // holds; the guard is what NAVIGATES.
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
          // No full feed refresh — jarring UX and unnecessary. The
          // optimistic DOM update (applyReactionOptimistic) now queries
          // by [data-appza-action] so it works across all three variants
          // (timeline / card / list) without hardcoded child indices.
          // Only the reacted post's icon + count flip; the rest of the
          // feed stays put.
        } catch (err) {
          applyReactionOptimistic(feedId, reactType, alreadyOn);
          onError(err instanceof Error ? err.message : String(err));
        } finally {
          reactionInFlight.delete(reactKey);
        }
      })();
      return;
    }

    // ── Post detail (2026-09-01) ──────────────────────────────────
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
      // The URL is held until the comment carrying it is sent —
      // FluentCommunity has nothing to attach a media row to until the
      // comment exists, and resolves each entry back with
      // Helper::getMediaFromUrl at create time.
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
      // Local only, and deliberately. The upload created a Media row
      // with no comment attached; FluentCommunity sweeps unattached
      // media itself, and there is no comment-scoped discard endpoint to
      // call — the chat one refuses anything that is not a chat medium.
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

    // ONE slug for three writes, because the footer is one field: a
    // comment, a reply (the same create with parent_id) and an edit (a
    // PUT). Which one it is comes from postDetailControls rather than
    // from the args — the composer already knows, and a second copy of
    // that fact in the catalog would be a second thing to get wrong.
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

      // Cleared BEFORE the round-trip, not after. A comment field that
      // keeps its text while the request is in flight invites a second
      // tap, and FluentCommunity refuses the duplicate with a sentence
      // about duplicates rather than posting twice — so the reader is
      // told off for the app's latency. On failure the text is put back.
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
          // fcom-mobile answers 200 with its own status inside the
          // envelope, so `res.ok` is not the question — P-shaped trap
          // the profile save already paid for.
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
          // Hand the words back rather than losing them. The reply
          // target is not restored: by now the thread may have moved,
          // and a reply silently re-aimed is worse than one the reader
          // re-aims themselves.
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

    // Reply and Edit both open the comment panel — the composer that
    // already exists and already posts — rather than growing a second
    // editor per verb. What differs is what the panel opens WITH: reply
    // arms `replyingTo` (which the panel has understood since chunk 2),
    // edit prefills the draft and swaps the send target.
    //
    // The two read their ids from opposite ends. A reply is created
    // against the POST with the comment as parent; an edit is addressed
    // to the COMMENT with the post alongside it. The catalog says which
    // is which through feed_id_path / parent_id_path, so neither is
    // hardcoded here.
    case 'comment.reply':
    case 'comment.edit': {
      const isEdit = action_slug === 'comment.edit';
      console.log(`[appza-mobile] dispatch: ${action_slug}`, { argRec, effectiveItem });

      // On POST DETAIL the composer is already on screen, in the footer,
      // and opening the panel over it would put two comment fields in
      // front of the reader — the lower one covering the thread they
      // just tapped Reply on.
      //
      // So the same two slugs re-target the footer here instead. The
      // branch is on the SCREEN rather than on an argument because the
      // difference is entirely about which composer is mounted, and a
      // catalog flag would be a second place for that fact to be wrong.
      if (isPostDetailScreen()) {
        if (!auth) {
          requireAuthOrLogin();
          return;
        }
        const rec = (itemRec ?? {}) as Record<string, unknown>;
        if (isEdit) {
          // `message`, not `message_rendered` — the rendered copy is
          // HTML, and putting it in a plain textarea shows the reader
          // their own paragraph tags.
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
        // Replying to a REPLY answers its thread, not the reply: the
        // proxy flattens every descendant onto its top-level ancestor,
        // so a parent_id pointing at a reply produces a row drawn at the
        // same indent anyway. The thread component grafts the root on as
        // `reply_parent_id`; falling back to the comment's own id covers
        // a top-level one, which is its own root.
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
      // The panel is always mounted against the POST — it lists that
      // post's comments either way — so the feed id is the parent on an
      // edit and the primary on a reply.
      const postId = isEdit ? parentId : primaryId;

      if (isEdit) {
        // message, not message_rendered: the rendered copy is HTML and
        // would land in the textarea as tags.
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

      // The `data.` prefix is not decoration: readDataPath returns
      // undefined for any path without it, and the banner then reads
      // "Replying to @User" for everyone.
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
      // Poll submit — AppzaPollBlock grafts the picked option slugs onto
      // inv.item.vote_indexes before dispatching. Read them off the item,
      // POST { [body_key]: feed_id, [vote_key]: [...slugs] } to fcom-mobile,
      // then update the item's meta.survey_config in place with the fresh
      // server-computed options (vote_counts + percentage + voted) so the
      // block re-renders as results without a full feed refetch.
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
      // AppzaPollBlock puts vote_indexes on the item it dispatches with;
      // fall back to reading it off the effective item root.
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
          // fcom-mobile returns the fresh survey_config on `items`; graft
          // it onto the item's meta so the poll block flips into results
          // mode on the next feed refresh (and immediately from the local
          // justVoted state).
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
          // No triggerFeedRefresh — the in-place mutation above is
          // shared with the useDataSource item (shallow spread by the
          // primitive preserves the meta reference), and the block's
          // local justVoted state keeps it in results mode for the
          // rest of the session. A full refetch would blow away the
          // voted flag unless the FC list endpoint enriches it per-
          // viewer (which fcom-mobile doesn't today).
          onInfo('Vote submitted');
        } catch (err) {
          onError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'post.create': {
      // Text-only create — media pickers (image/video/poll) are not ported
      // yet. If the form has an image/video slot, this posts without them.
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
      // Attachments — FC's server materializes meta.media_items /
      // meta.media_preview / meta.survey_config on the returned feed based
      // on which shape wins. content_type ordering matches plugin-admin:
      // survey > oembed > image > text. Empty arrays / missing fields are
      // omitted so FC's default handling stays intact.
      if (deps.pendingImages.length > 0) {
        body.media_images = deps.pendingImages.map((u) => ({ url: u, provider: 'uploader' }));
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
        // post.create — the server assigns fresh slugs, so any that
        // leaked in from a stale edit state are dropped here.
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

    // ── Post 3-dot overflow menu ──────────────────────────────────────
    // The 3-dot button on each post card fires on_tap_menu → post.options.
    // We resolve the tapped button's DOM rect via the [data-appza-item-id]
    // ancestor and open PostOptionsPopover with the catalog-defined items.
    // Each menu row's click routes back through this dispatcher.
    // The COMMENT menu (designs 24, 25) is the same popover with a
    // different list. Identical code because the popover is about GATED
    // ROWS, not about posts — every row's visible_when resolves against
    // whatever item was bound, and the comment strip binds a comment.
    // The chevron on a voted poll row (designs 8, 9, 11, 12). Reads the
    // endpoint out of the action's args like every other dispatcher —
    // the action itself declares no write metadata, because
    // ActionHttpMethod is writes-only by decision (DC#12 Q6).
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
    // The profile ⋯ (2026-09-02). Identical code for the same reason the
    // comment menu is: this popover is about GATED ROWS, not about posts.
    // Every row's visible_when resolves against whatever item was bound,
    // and here that is the profile row.
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
      // The 3-dot button lives inside the post-card wrapper stamped with
      // data-appza-item-id. Falls back to the first on_tap_menu anchor when
      // the item id is unknown (single-item screens like post detail).
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
      // Five catalog-driven post-menu actions share the same shape and
      // are implemented once in @appza/renderer/postMenuHandlers so the
      // simulator + mobile stay identical. Edit is NOT in this set — it
      // dispatches from the appbar CTA on edit-post-page (see post.edit
      // case below).
      const handled = tryHandlePostMenuAction(inv, {
        auth,
        authHeader: basicAuthHeader,
        onError,
        onInfo,
      });
      if (handled) return;
      return;
    }

    // The profile header cluster's four follow actions, shared with the
    // simulator through @appza/renderer for the same reason the post menu
    // is. They had been seeded since the profile chunk and dispatched
    // NOWHERE — no shell had a case for them, so every tap fell through
    // to the default log-only branch.
    // All Members (2026-09-15) — search, status tabs, the two-part sort
    // sheet, and the status change behind its confirm. Shared with the
    // other shell through @appza/renderer.
    // Moderation (2026-09-17) — the four status tabs, and the two writes
    // behind the doc's own dialog (the report ⋯ sheet and the review
    // modal's CTAs). Shared with the other shell through @appza/renderer.
    // The review modal (designs 9-32) rides here too: from the flagged
    // banner on a post, or from a report row's ⋯ sheet.
    // Course details (Courses doc, states 5–7) — the section accordion
    // and ENROLL THIS COURSE. Shared with the other shell through
    // @appza/renderer.
    // A course's Students page (Courses doc, states 8–15) — search, the
    // sort sheet, Add Student with its confirm, Remove with its confirm.
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

    // The lesson screen (Courses doc, states 16–17) — a lesson row or
    // START / CONTINUE / REVIEW opens it, < > move within it, and
    // Complete Lesson marks it done or undone. Shared with the other
    // shell through @appza/renderer.
    // A lesson discussion's in-place edit (Courses doc, design 25).
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

    // The profile's two pictures (doc states 2-5). Pick-then-save for a
    // change, an empty string for a remove, and a confirm in front of the
    // remove. The PICKER is the shell's — it needs a mounted file input —
    // so it is handed over; everything else lives in the renderer, where
    // both shells share it.
    // The edit form's three account cards (doc state 40) — the username,
    // the password and the deactivation, each its own endpoint.
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

    // Sign out, behind design 33's dialog. auth.logout itself is handled
    // further down and is untouched; this only asks first.
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

    // The three list controls sat above the profile-pictures block and
    // fell through into it, so on the phone they did nothing (found
    // 2026-09-22, Courses chunk 1).
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

    // The Courses list (Courses doc, states 1–4).
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
    // Block and unblock are the same request in every respect — POST an
    // fcom-mobile route with the profile's user id — so they ride the
    // shared handler rather than a branch of their own.
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

    // The profile edit form's Save. The form is a SIBLING placement, so
    // the values are collected from the AppZet the action names rather
    // than from the button's own — and they are read out of the DOM,
    // which is why the inputs seed their value instead of holding it in
    // React state.
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
      // Real HTTP feed update, dispatched from fc-edit-post-appbar's
      // Save button on edit-post-page. Body includes an `id` field
      // resolved from the screen-mount context (the post passed by the
      // 3-dot menu's nav.push) — composer form itself has no id. On
      // success we nav.back and trigger a feed refresh.
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
      // "Move to a different space". FluentCommunity takes the move as
      // its own two keys and NOT as a change to `space` — which keeps
      // carrying the post's original slug, exactly as the portal's own
      // handleUpdatePost sends it.
      //
      // `'current'` is the armed-but-unchosen state: the box is ticked
      // and the chip shows the post's own space. Nothing is sent for it,
      // so ticking the box and changing your mind leaves the post where
      // it was rather than posting a move the server would refuse.
      const moveDraft = getPostDraft();
      if (moveDraft.can_move_space) {
        if (moveDraft.move_target === 'space' && moveDraft.move_space_id) {
          body.new_space_id = moveDraft.move_space_id;
        } else if (moveDraft.move_target === 'profile') {
          body.move_to_profile = 1;
        }
      }
      // Attach media the same way post.create does — otherwise Save on
      // a post that had images / video / poll would drop them because
      // the update endpoint reads the same shape as create. On
      // edit-post-page the prefill effect hydrated the draft (images,
      // poll) and pendingVideo from the item's meta, so submitting
      // untouched round-trips the existing media. Precedence: survey >
      // oembed > image > text (matches post.create).
      if (deps.pendingImages.length > 0) {
        body.media_images = deps.pendingImages.map((u) => ({ url: u, provider: 'uploader' }));
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
        // that had one — FC's FeedsHelper::getSurveyOptionsUpdateError
        // rejects an update that drops an existing slug or blanks its
        // label, because the votes are recorded against it. The sheet
        // will not let those rows be removed or emptied, so by the time
        // a poll reaches here the slugs are intact.
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
              onError('The document endpoints are missing from the action.');
              return;
            }
            const documents = await prepareDocumentEdit({
              uploadEndpoint,
              renameEndpoint,
              authHeader: basicAuthHeader(auth),
              absolutize: absolutizeEndpoint,
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
      // Two questions, one action, one sheet. The composer's "Posted in:"
      // chip asks where a NEW post goes; the edit screen's move chip
      // dispatches the SAME wiring with `mode: 'move'` and asks where an
      // existing post moves to. One action because an action no child
      // names never reaches the phone's snapshot (P133), and the move
      // chip lives inside children[0] where it cannot have a child of
      // its own.
      //
      // The lists genuinely differ: the create picker answers with the
      // spaces the VIEWER may post in, while FluentCommunity refuses a
      // move into any space the POST'S AUTHOR is not an active member
      // of. So move mode reads a data source of its own, scoped to the
      // post.
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
        // The moderator verdict rides the same payload, so opening the
        // picker also settles whether the announcement row and the
        // schedule control belong on this screen. Never from the MOVE
        // payload: that one is about a post, and the announcement
        // verdict belongs to the destination the post already has.
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
          // Settings -> General -> Global Post Status. With it off there
          // is no "On my profile" row, which is Noor's note on design 5.
          //
          // For a MOVE the route answers the whole question — the site
          // setting AND whether the post is in a space at all, since a
          // post already on a profile has nowhere to move to.
          globalPostsEnabled: moving
            ? payload.canMoveToProfile
            : getFcRuntimeSettings().composer.global_posts_enabled,
          viewerIsModerator: payload.viewerIsModerator,
          mode: moving ? 'move' : 'destination',
          // FluentCommunity writes "On author's profile" when the viewer
          // is not the one who wrote the post; only the payload knows.
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
            lookupVideoOembed(u, absolutizeEndpoint(oembedEndpoint), (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? ''),
          onUpload: (file: File) =>
            uploadDraftVideo(file, absolutizeEndpoint(uploadEndpoint), (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? ''),
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
        // The glyph is gated on the same two switches, so this only fires
        // if the catalog was edited to show it anyway. Saying why beats a
        // silent no-op.
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
      // The glyph is gated on the moderator verdict, so this only fires
      // without one if the catalog was edited to show it anyway. Saying
      // why beats a sheet whose result FluentCommunity would discard in
      // silence.
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
      // The glyph is gated on the space allowing documents, so this only
      // fires without one if the catalog was edited to show it anyway.
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
      // Popover fallback — anchored to whichever of the toolbar's two
      // buttons fired, exactly as the feed's controls are.
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
      // fc-spaces-tabs: child value is stamped by the primitive onto
      // inv.item. Tab values are catalog-driven (fc-spaces-tabs.tabs
      // array), so any string is accepted here; PlacementRenderer's
      // data_source_by_state resolves the matching data source.
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
      // Fires on every keystroke from the search ion-input. Value threaded
      // through inv.item.value by the primitive input handler.
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
      // Same popover pattern as feed.set_sort; anchored to the toolbar's
      // sort button (children[1] under fc-spaces-toolbar).
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
      // The three header counts open ONE SHEET (doc states 36-39) and
      // differ only in which tab it lands on — so the count that was
      // tapped decides the view, and a sheet that always opened on
      // Following would make two of the three counts lie.
      //
      // It used to push the `profile-follows` SCREEN, which D79 built and
      // Noor replaced with this on 2026-09-16. The third tab is what the
      // screen could never hold: blocked users had no home, which is why
      // the header's Blocked count had nowhere to go.
      //
      // The sheet reads its rows itself through useDataSource, so only
      // the SLUGS travel here — no endpoint is written down in either
      // shell.
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
        // Tapping a row leaves the sheet for that member's profile. The
        // push is delegated rather than restated: it carries route params
        // and screen context, and a second copy of that would drift.
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
      // fc-space-subtabs children_from_prop strip. Value flows through
      // inv.item.value (variadic child template stamps it) with an
      // args.value fallback for direct-fire callers. See
      // spaces.set_tab above for the same pattern.
      //
      // Per-space runtime config can declare a target_screen on a
      // subtab entry — when present the tap is a deep-link nav.push
      // instead of a local sub-tab switch. Enables e.g. a customer
      // routing "MEMBERS" to a bespoke listing screen.
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
      // fc-space-topics chip tap. Value = topic slug ('' means "All" —
      // the prepend_all synthetic entry passes value:''). Refetch is
      // implicit: fc-space-feeds' query_params bind to this state key,
      // so the store event bumps PlacementRenderer's params → hook
      // refetches automatically.
      const runtimeValue = typeof argRec.value === 'string' ? argRec.value : null;
      const itemValue =
        itemRec && typeof itemRec.value === 'string' ? (itemRec.value as string) : null;
      const picked = runtimeValue ?? itemValue ?? '';
      setSpaceDetailControls({ topic_slug: picked });
      return;
    }

    case 'space_detail.set_sort': {
      // Sort popover for the space post toolbar. Same shape as
      // spaces.set_sort — args.options carries the choice list; the
      // popover writes the picked value back into state via the
      // 'space_detail_sort' scope which our ViewModePopover routes to
      // this action's state slice.
      const rawOptions = Array.isArray(argRec.options) ? argRec.options : [];
      const options: ViewModeOption[] = rawOptions
        .filter((o): o is Record<string, unknown> => isRecord(o))
        .map((o) => ({
          value: typeof o.value === 'string' ? o.value : '',
          label: typeof o.label === 'string' ? o.label : '',
          icon: typeof o.icon === 'string' ? o.icon : undefined,
        }))
        .filter((o) => o.value && o.label);
      // Runtime value takes precedence — the popover fires this action
      // with { value: <picked> } once the user taps a row. When invoked
      // WITHOUT a runtime value, we open the popover instead.
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

    // === MEDIA sub-tab (2026-08-17) ===

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
        console.warn('[appza-mobile] leaderboard.set_range: no picked value', { argRec, item });
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
        // Absolute, or the fetch resolves against the Capacitor bundle's
        // own origin and 404s on the phone while working in the browser
        // (P60).
        levelsEndpoint: absolutizeEndpoint(levelsEndpoint),
        authHeader: ((window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? ''),
      });
      return;
    }

    case 'media.set_type': {
      // fc-media-tabs children_from_prop strip — same value plumbing as
      // space_detail.set_subtab. The refetch is implicit: fc-space-media
      // binds its `type` query param to this state key.
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
      // One action for both grid tabs, because one AppZet renders both.
      // A photo opens the viewer; a video goes to its post — Noor's spec,
      // and the reason the viewer never has to host a player.
      const kind = itemRec && typeof itemRec.kind === 'string' ? itemRec.kind : '';
      if (kind === 'video' || kind === 'audio') {
        handleAction({ ...inv, action_slug: 'media.open_post' }, deps);
        return;
      }
      const viewerSlug =
        typeof argRec.viewer_appzet_slug === 'string'
          ? argRec.viewer_appzet_slug
          : MEDIA_VIEWER_APPZET_SLUG;
      // Page across the photos only. `siblings` is the rendered row set,
      // so on the Photos tab it is already all photos; filtering by kind
      // keeps that true if a future tab ever mixes them.
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
      // The tapped index counts within the FILTERED list, so find the row
      // rather than reusing siblingIndex — they diverge the moment
      // anything is filtered out above.
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
          onBlock: (t) => handleAction({
              action_slug: 'chat.block_confirm',
              // The confirm's copy lives on ITS action, not on the menu's —
              // re-entering with the menu's args would hand the alert an
              // empty bag and fall back to the hardcoded wording.
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
      // Resolved from the catalog, never written down here — the sheet
      // is opened by an action rather than mounted by a placement, so
      // there is no useDataSource in its tree to do it.
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
        authHeader: ((window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? ''),
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
        onError('That conversation could not be identified.');
        closeMemberRemoveConfirm();
        return;
      }
      if (!auth) {
        onError('Please sign in first.');
        closeMemberRemoveConfirm();
        return;
      }
      // Leaving or deleting takes the screen with it, so the alert, the
      // sheet and the card all come down before the pop.
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
              Authorization: ((window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? ''),
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
          onError(err instanceof Error ? err.message : String(err));
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
        onError('chat.send is missing its endpoint.');
        return;
      }
      const refetchDs =
        typeof argRec.refetch_data_source === 'string' ? argRec.refetch_data_source : null;
      void sendChatMessage({
        endpoint,
        method: typeof argRec.method === 'string' ? argRec.method : 'POST',
        authHeader: (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? '',
                absolutize: absolutizeEndpoint,
        createThreadEndpoint:
          typeof argRec.create_thread_endpoint === 'string' && argRec.create_thread_endpoint
            ? argRec.create_thread_endpoint
            : '/wp-json/fcom-mobile/api/v1/chat/threads/create',
        // The thread now exists. Adopt its id — into the slice AND the
        // route bag, because the message list reads the route and the
        // composer reads the slice — and drop the intent, so the next
        // send is an ordinary message rather than a second create.
        onThreadCreated: (threadId: number) => {
          setRouteParams({ thread_id: threadId });
          setChatControls({ thread_id: String(threadId), intent_user_id: '', can_send: 'yes' });
        },
        onError,
        onSuccess: () => {
          // Same force-refresh window every other mutation opens, so the
          // list bypasses the proxy's transient rather than re-reading
          // the message it just replaced.
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
        authHeader: (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? '',
        absolutize: absolutizeEndpoint,
        toast: typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Message deleted',
        onError,
        onInfo,
        onSuccess: () => {
          // Same force-refresh window every other mutation opens, so the
          // list bypasses the proxy's transient rather than re-reading
          // the message it just replaced.
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
        authHeader: (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? '',
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
        authHeader: (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader ?? '',
        absolutize: absolutizeEndpoint,
        onError,
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
        console.warn('[appza-mobile] chat.open: neither a thread id nor a space slug', item);
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

    case 'chat.open_dm': {
      // A conversation that may not exist yet (2026-09-02).
      //
      // FluentCommunity cannot open an empty one-to-one thread — its
      // create endpoint validates `message` as required and makes the
      // thread WITH the first message — so this carries an INTENT and
      // nothing else. The portal's own Message button does the same,
      // linking to /portal/chat?user_id=N.
      //
      // The proxy answers the thread source for an intent with a
      // synthesised row: the member's name and face, id 0, can_send true.
      // So the screen draws the person, the composer exists, and the
      // send handler creates the thread on the first message — after
      // which this is an ordinary conversation.
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

      // Clearing thread_id and space_slug is what makes this an intent
      // rather than a stale conversation wearing a new name — the slice's
      // switch guard then resets the draft and the reply target too.
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

    // The profile tabs' two confirms and their writes (doc states 57,
    // 58, 62, 63). Shared with the other shell; see profileTabActions.
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

    // The Scheduled Posts page (doc states 67-69). Shared with the other
    // shell; see scheduledPostActions. The sheet is the composer's own,
    // opened here because its presentation is the catalog's.
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
      // Doc states 51 and 52 — the New Message modal. Replaced
      // chat.open_dm on the profile; see profileNewMessage.
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
      // Doc states 49 and 50 — the grouped list, then a role for a space.
      // Shared with the other shell; see profileAddToSpace.
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
      // Not post.open: a media row carries the post's slug on `feed_slug`,
      // and has no nested `space` object to read the parent slug from.
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
      // The space slug is already the current route param — a media row
      // never leaves the space it was listed in — so it is deliberately
      // NOT overwritten here.
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
      const url = itemRec ? readDataPath(itemRec, `data.${urlPath}`) : undefined;
      if (typeof url !== 'string' || url === '') {
        console.warn('[appza-mobile] media.download: no url on the item', item);
        return;
      }
      const namePath =
        typeof argRec.filename_path === 'string' ? argRec.filename_path : 'title';
      const rawName = itemRec ? readDataPath(itemRec, `data.${namePath}`) : undefined;
      const filename = typeof rawName === 'string' && rawName !== '' ? rawName : undefined;

      // On the phone this goes through our own AppzaDownload plugin, which
      // hands the URL to Android's DownloadManager.
      //
      // The browser handoff below CANNOT work there, which is what "media
      // photo not download in mobile apk" was: Capacitor 6's Android
      // bridge sets no onCreateWindow, so window.open('_blank') has no
      // window to open, returns null and silently does nothing. It works
      // in the simulator because that is a real browser — which is exactly
      // why this needed checking on the device build (P82).
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

      // Web + simulator: a real browser, so the plain handoff is right.
      // The file is a public uploads URL (verified: 200, real bytes, no
      // auth), so nothing of ours is in the path.
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
      // FAB on the documents tab. The add-document screen ships in chunk 2;
      // until it's seeded this warns instead of blanking the screen.
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
      // Nav.push variant that carries the current space (from screen
      // context OR effectiveItem) into create-post-page so
      // fc-post-information prefills its space picker. Mirrors the
      // nav.push case above but with a fixed target + a smarter item
      // fallback: on the space-detail screen the composer teaser has no
      // per-item context, so we synthesize one from spaceDetailControls
      // when effectiveItem is null.
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
      // Nav.push to post-detail carrying the tapped post. Fires from
      // fc-post-card's "View more comments" tap — same wire shape as
      // the on_tap_row post-open, distinct action slug so analytics can
      // differentiate the entry point later.
      const target = catalog?.template_screens?.find(
        (s) => s.app_map_screen_slug === 'post-detail',
      );
      if (!target) {
        console.warn('[appza-mobile] post.open: post-detail not in catalog');
        return;
      }
      // The card is placed on post-detail as well as in every list, and
      // its title and body now open a post. Tapping them on the screen
      // that is already showing that post must not push it onto itself —
      // it would grow the back stack one screen per tap with nothing
      // visibly changing. Same post only: a DIFFERENT post opened from
      // here (a mention, a quoted row) still pushes.
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
          // Carry the parent space slug forward so the post-detail
          // screen's DSes (comments etc.) can still bind to route.slug.
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
      // POST /spaces/{slug}/join or /leave against the FC mobile namespace
      // then trigger a data-source refetch so the joined-state pill flips
      // to "View Space". The catalog wires slug_path='data.slug' — the
      // effectiveItem is the current space row.
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
      const authHeader = (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader;
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

    // ── Member 3-dot overflow flow ────────────────────────────────────
    // Three UI actions (open sheet / open role picker / open confirm) +
    // two write actions (set role / remove) share this block. The UI
    // actions just surface the corresponding component via its imperative
    // opener; the write actions POST to the fcom-mobile add-member and
    // remove-member endpoints against the currently-viewed space slug
    // (read from space_detail_controls, not the effectiveItem).
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
      const authHeader = (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader;
      if (authHeader) headers.Authorization = authHeader;
      fetch(absolutizeEndpoint(endpoint), {
        method,
        headers,
        body: JSON.stringify({ space_slug: spaceSlug, user_id: userId, role }),
        credentials: 'omit',
      })
        .then(async (res) => {
          const json = await res.json().catch(() => null);
          // fcom-mobile returns HTTP 200 with a nested `response.status`
          // that carries the real status (400 for validation errors etc.).
          // Trust the nested status when present, otherwise fall back to
          // res.ok.
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

    // member.add is dual-mode on the same slug (same as plugin-admin):
    //   - opener: fires from fc-space-members-actions Add Member button.
    //     No user_id + role in args → open the AddMemberModal (picker +
    //     role dropdown).
    //   - submit: fires from inside the modal after both are picked.
    //     Real HTTP POST /wp-json/fcom-mobile/api/v1/spaces/add-member.
    case 'member.add': {
      const hasUser = argRec.user_id !== undefined && argRec.user_id !== null;
      const hasRole = typeof argRec.role === 'string' && argRec.role !== '';

      if (!hasUser || !hasRole) {
        // Open path — pull the modal's labels + role_options off its
        // AppZet default_props_override so builder edits flow through.
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
        const authHeader = (window as unknown as { __appzaAuthHeader?: string })
          .__appzaAuthHeader;
        openAddMemberModal({
          appzetSlug: formSlug,
          // Shared with the plug-in admin so the two shells can't drift
          // into reading different subsets of the authored props.
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

      // Submit path — POST /wp-json/fcom-mobile/api/v1/spaces/add-member
      // with {space_slug, user_id, role}. Mirrors member.set_role.
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
      const authHeader = (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader;
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

    // Blocking someone confirms first, and reuses the member-removal
    // alert: it is a generic "are you sure, then dispatch this action"
    // dialog, and blocking is not undone from where it was done.
    case 'profile.block_confirm':
    case 'profile.unblock_confirm':
    case 'member.remove_confirm': {
      // Block and unblock are the member's OWN profile row, so the name
      // is a top-level field there; a space member row nests it.
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
      // Designs 45 and 48's own sentences. Design 45 reads "Blocking this
      // will hide…" with the noun missing; shipped with "user" restored.
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
        // Designs 45 and 48 draw CANCEL and the action as blue text buttons
        // side by side. Member removal keeps its older stacked layout.
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
      const authHeader = (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader;
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

    // Dual-mode on the same slug, exactly like member.add: no email in
    // args opens the modal, an email present submits it.
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
        const authHeader = (window as unknown as { __appzaAuthHeader?: string })
          .__appzaAuthHeader;

        openInviteUserModal({
          appzetSlug: formSlug,
          // Shared with the plug-in admin so the two shells can't drift
          // into reading different subsets of the authored props.
          ...invitePresentation(props),
          childStyles: childStylesFromCustomizations(
            formSlug,
            INVITE_USER_CHILD_COUNT,
            currentCustomizations,
          ),
          // Absolute, per P60 — a Capacitor build has no origin to
          // resolve a root-relative path against.
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
        const authHeader = (window as unknown as { __appzaAuthHeader?: string })
          .__appzaAuthHeader;
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
            // Prefer the endpoint's message — it distinguishes
            // "joined the space right away" from "invitation emailed".
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
        const authHeader = (window as unknown as { __appzaAuthHeader?: string })
          .__appzaAuthHeader;
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
            // The open modal's list listens for this and repopulates.
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

/** Non-empty strings only — blank author fields fall back to defaults. */
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/**
 * A modal AppZet's authored props, read off the snapshot the shell
 * already holds, so an action can open a modal without duplicating any
 * of its copy into the opener's args (P66).
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
  // Overlays are opened imperatively from the action handler, outside
  // PlacementRenderer — so unlike a composed AppZet they get no override
  // resolution for free. Without this the site admin's saved Options
  // edits on a modal would show in the builder and never reach the app.
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
 * Open the schedule sheet on the composer draft.
 *
 * Module-level for the same reason the poll one is: two callers in
 * different worlds — the `picker.schedule` action, dispatched from a
 * plain function, and the strip's "Edit", which arrives as a window
 * event — and one implementation so the two sheets cannot drift.
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

/** The customizations the renderer is currently drawing with. */
let currentCustomizations: unknown = null;

function setCustomizationsForActions(customizations: unknown): void {
  currentCustomizations = customizations;
}

/** Endpoints always come from the catalog, never a literal in the shell. */
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

/**
 * The invitation endpoints answer HTTP 200 and carry the real outcome
 * in response.status, so the HTTP status alone would read a 403 as a
 * success. Their message is worth surfacing verbatim.
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
 * The async Clipboard API only exists on secure origins; a WebView
 * served over http has none, so fall back to execCommand rather than
 * leaving Copy Link silently dead.
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

// FCOM /feeds/comments returns a flat list — every comment carries
// parent_id but no children[]. Nest here so CommentThreadItem's
// recursive render produces a proper tree. Keys are normalized to
// strings because the API returns id as number but parent_id as string.
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
      // Editing addresses the COMMENT and names the post alongside it;
      // creating addresses the POST. /comments/update 400s without both
      // ids, which is why the edit branch sends the pair.
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
      // An edit is done when it lands — the panel was opened FOR it, and
      // leaving it open would offer to save the same text again.
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

  // Track visualViewport height so the panel shrinks when the on-screen
  // keyboard opens — otherwise the composer at the bottom of the sheet
  // gets hidden behind the keyboard.
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
              // Belt-and-suspenders for Android WebViews where the
              // visualViewport resize event lags — nudge the composer
              // into view after the keyboard has had a moment to open.
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

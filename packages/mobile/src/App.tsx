import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionProvider,
  ScreenRenderer,
  readDataPath,
  type ActionDispatch,
  type ActionInvocation,
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

// Ionicon + Ionic-theme-color pairs for reaction toggle states. Mirrors
// plugin-admin's REACTION_UI so both surfaces produce the same visual.
const REACTION_UI: Record<
  string,
  { childPath: string; iconOn: string; iconOff: string; colorOn: string; countPath: string | null }
> = {
  like: {
    childPath: 'children[10]',
    iconOn: 'heart',
    iconOff: 'heart-outline',
    colorOn: 'danger',
    countPath: 'children[13]',
  },
  bookmark: {
    childPath: 'children[12]',
    iconOn: 'bookmark',
    iconOff: 'bookmark-outline',
    colorOn: 'primary',
    countPath: null,
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
      `[data-appza-primitive-path="${cfg.childPath}"]`,
    );
    if (btn) {
      const nextIcon = on ? cfg.iconOn : cfg.iconOff;
      const nextColor = on ? cfg.colorOn : 'medium';
      btn.querySelectorAll<HTMLElement>('ion-icon').forEach((ic) => {
        ic.setAttribute('name', nextIcon);
        ic.removeAttribute('src');
        ic.removeAttribute('icon');
      });
      btn.querySelectorAll<HTMLElement>('ion-button').forEach((b) => {
        b.setAttribute('color', nextColor);
      });
    }
    if (cfg.countPath) {
      const countWrap = wrapper.querySelector<HTMLElement>(
        `[data-appza-primitive-path="${cfg.countPath}"]`,
      );
      if (countWrap) {
        const p = countWrap.querySelector<HTMLElement>('ion-text p') ?? countWrap;
        const text = p.textContent ?? '';
        const match = text.match(/(\d+)/);
        const cur = match && match[1] ? parseInt(match[1], 10) : 0;
        const next = Math.max(0, cur + (on ? 1 : -1));
        const label = next === 1 ? 'like' : 'likes';
        p.textContent = `${next} ${label}`;
      }
    }
  });
}

function triggerFeedRefresh() {
  const g = window as unknown as { __appzaForceRefreshUntil?: number };
  g.__appzaForceRefreshUntil = Date.now() + 3000;
  setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 150);
  setTimeout(() => window.dispatchEvent(new Event('appza:refresh-data')), 600);
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

function collectParams(
  appzetSlug: string,
  paramMap: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!paramMap) return out;
  for (const [name, path] of Object.entries(paramMap)) {
    if (typeof path !== 'string') continue;
    const v = readFormFieldValue(appzetSlug, path);
    out[name] = v ?? '';
  }
  return out;
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

type PendingPoll = {
  type: 'single_choice' | 'multi_choice';
  options: string[];
};

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
};

type ActionDeps = {
  catalog: Catalog | null;
  currentScreenId: number | null;
  setSelectedScreenId: (id: number | null) => void;
  setScreenStack: React.Dispatch<React.SetStateAction<number[]>>;
  auth: StoredAuth | null;
  setAuth: (a: StoredAuth | null) => void;
  onError: (msg: string) => void;
  reactedSet: Set<string>;
  openDeleteConfirm: (p: PendingDelete) => void;
  openCommentPanel: (p: CommentPanelState) => void;
  openImagePicker: (target: { endpoint: string; method: string }) => void;
  openPollModal: () => void;
  attachVideo: (url: string, target: { endpoint: string; method: string }) => Promise<void>;
  pendingImages: string[];
  clearPendingImages: () => void;
  pendingVideo: PendingVideo | null;
  clearPendingVideo: () => void;
  pendingPoll: PendingPoll | null;
  clearPendingPoll: () => void;
};

export function App() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [screenStack, setScreenStack] = useState<number[]>([]);
  const [auth, setAuthState] = useState<StoredAuth | null>(() => readStoredAuth());
  const [errorToast, setErrorToast] = useState<string | null>(null);
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
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [pendingPoll, setPendingPoll] = useState<PendingPoll | null>(null);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadEndpointRef = useRef<{ endpoint: string; method: string } | null>(null);

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

  // Clear session state on logout.
  useEffect(() => {
    if (!auth) {
      setPendingDelete(null);
      setDeleteInFlight(false);
      setCommentPanel(null);
      reactedRef.current = new Set();
      setPendingImages([]);
      setPendingVideo(null);
      setPendingPoll(null);
      setPollModalOpen(false);
      uploadEndpointRef.current = null;
    }
  }, [auth]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!errorToast) return;
    const t = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(t);
  }, [errorToast]);

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
        // Guest boots to first screen; unauthenticated users see the
        // login-page screen (if one exists) so write actions have credentials.
        const catalog = parsed.data.catalog;
        const storedAuth = readStoredAuth();
        const login = catalog.template_screens?.find(
          (s) => s.app_map_screen_slug === 'login-page',
        );
        const first = catalog.template_screens?.[0];
        const target = !storedAuth && login ? login : first;
        setSelectedScreenId(target ? target.id : null);
        setState({ kind: 'ok', envelope: parsed.data });
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

  const screen = useMemo<TemplateScreen | null>(() => {
    if (!catalog || selectedScreenId == null) return null;
    return catalog.template_screens?.find((s) => s.id === selectedScreenId) ?? null;
  }, [catalog, selectedScreenId]);

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

  const openDeleteConfirm = useCallback((p: PendingDelete) => setPendingDelete(p), []);
  const openCommentPanel = useCallback((p: CommentPanelState) => setCommentPanel(p), []);
  const openImagePicker = useCallback((target: { endpoint: string; method: string }) => {
    // Stash the endpoint in a ref so the file input's onChange (which fires
    // async after the user picks) reads the right one. A state setter would
    // race the onChange since state updates aren't guaranteed to be visible
    // in the very next event tick.
    uploadEndpointRef.current = target;
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);
  const openPollModal = useCallback(() => setPollModalOpen(true), []);
  const clearPendingImages = useCallback(() => setPendingImages([]), []);
  const clearPendingVideo = useCallback(() => setPendingVideo(null), []);
  const clearPendingPoll = useCallback(() => setPendingPoll(null), []);

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
      const list = Array.from(files);
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
      if (urls.length > 0) setPendingImages((prev) => [...prev, ...urls]);
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
        reactedSet: reactedRef.current,
        openDeleteConfirm,
        openCommentPanel,
        openImagePicker,
        openPollModal,
        attachVideo,
        pendingImages,
        clearPendingImages,
        pendingVideo,
        clearPendingVideo,
        pendingPoll,
        clearPendingPoll,
      });
    },
    [
      catalog,
      selectedScreenId,
      auth,
      setAuth,
      openDeleteConfirm,
      openCommentPanel,
      openImagePicker,
      openPollModal,
      attachVideo,
      pendingImages,
      clearPendingImages,
      pendingVideo,
      clearPendingVideo,
      pendingPoll,
      clearPendingPoll,
    ],
  );
  // Silence unused-warning — screenStack is exposed for future stack UI;
  // dispatcher already reads/writes it via setScreenStack.
  void screenStack;

  if (state.kind === 'loading') {
    return <div className="appza-mobile-loading">Loading…</div>;
  }
  if (state.kind === 'error') {
    return <div className="appza-mobile-error">{state.message}</div>;
  }
  if (!screen || !catalog) {
    return <div className="appza-mobile-error">No screen to render.</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh' }}>
      <ActionProvider dispatch={dispatchAction}>
        <ScreenRenderer
          screen={screen}
          catalog={catalog}
          customizations={customizationsForRender}
        />
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

      {pendingDelete && (
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
                body: JSON.stringify({ [pendingDelete.bodyKey]: pendingDelete.feedId }),
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
                  `Delete failed (HTTP ${res.status})`;
                setErrorToast(msg);
                return;
              }
              setPendingDelete(null);
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

      {(pendingImages.length > 0 || uploadingCount > 0 || pendingVideo || videoLoading || pendingPoll) && (
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
          {pendingImages.map((u, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <img
                src={u}
                alt=""
                style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }}
              />
              <button
                type="button"
                onClick={() =>
                  setPendingImages((prev) => prev.filter((_, idx) => idx !== i))
                }
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
          ))}
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
          {pendingPoll && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>
                📊 {pendingPoll.type === 'single_choice' ? 'Single' : 'Multi'} ·{' '}
                {pendingPoll.options.filter((o) => o.trim()).length} opts
              </span>
              <button
                type="button"
                onClick={() => setPendingPoll(null)}
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

      {pollModalOpen && (
        <PollBuilderModal
          initial={pendingPoll}
          onCancel={() => setPollModalOpen(false)}
          onSave={(v) => {
            setPendingPoll(v);
            setPollModalOpen(false);
          }}
        />
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
          auth={auth}
          onClose={() => setCommentPanel(null)}
          onError={setErrorToast}
        />
      )}
    </div>
  );
}

function handleAction(inv: ActionInvocation, deps: ActionDeps) {
  const {
    catalog,
    currentScreenId,
    setSelectedScreenId,
    setScreenStack,
    auth,
    setAuth,
    onError,
    reactedSet,
    openDeleteConfirm,
    openCommentPanel,
    openImagePicker,
    openPollModal,
    attachVideo,
  } = deps;
  const { action_slug, args, item, binding_root } = inv;
  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? readDataPath(item, binding_root) ?? item : item;
  const itemRec = isRecord(effectiveItem) ? (effectiveItem as Record<string, unknown>) : null;

  switch (action_slug) {
    case 'nav.push': {
      const targetSlug =
        typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : null;
      if (!targetSlug || !catalog) return;
      const target = catalog.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        console.warn('[appza-mobile] nav.push target not found:', targetSlug);
        return;
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
      const url =
        pickString(argRec, ['url', 'link']) ?? pickString(itemRec, ['url', 'link']);
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
      setAuth(null);
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
      if (!auth) {
        onError('Please sign in to react.');
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
      const alreadyOn = myReactions
        ? myReactions.includes(reactType)
        : reactedSet.has(reactKey);
      const nextOn = !alreadyOn;
      applyReactionOptimistic(feedId, reactType, nextOn);
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
        } catch (err) {
          applyReactionOptimistic(feedId, reactType, alreadyOn);
          onError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }

    case 'comment.create': {
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
        onError('Please sign in to comment.');
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
      // Attachments — FC's server materializes meta.media_items /
      // meta.media_preview / meta.survey_config on the returned feed based
      // on which shape wins. content_type ordering matches plugin-admin:
      // survey > oembed > image > text. Empty arrays / missing fields are
      // omitted so FC's default handling stays intact.
      if (deps.pendingImages.length > 0) {
        body.media_images = deps.pendingImages.map((u) => ({ url: u, provider: 'uploader' }));
        body.content_type = 'image';
      }
      if (deps.pendingVideo) {
        body.media = { type: 'oembed', url: deps.pendingVideo.url };
        body.content_type = 'oembed';
      }
      if (deps.pendingPoll && deps.pendingPoll.options.filter((o) => o.trim()).length >= 2) {
        body.survey = {
          type: deps.pendingPoll.type,
          options: deps.pendingPoll.options
            .map((label) => label.trim())
            .filter((label) => label.length > 0)
            .map((label) => ({ label })),
        };
        body.content_type = 'survey';
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
          deps.clearPendingPoll();
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

    case 'post.delete': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key ? argRec.body_key : 'feed_id';
      const title =
        typeof argRec.confirm_title === 'string' ? argRec.confirm_title : 'Delete post?';
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
        onError('Please sign in to delete a post.');
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
        onError('Could not identify which post to delete.');
        return;
      }
      openDeleteConfirm({ feedId, endpoint, method, bodyKey, title, message, cta });
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
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method = typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      if (!endpoint) {
        onError('picker.video is missing its endpoint.');
        return;
      }
      const url = window.prompt('Paste a video URL (YouTube, Vimeo, etc.):') ?? '';
      const trimmed = url.trim();
      if (!trimmed) return;
      if (!/^https?:\/\//i.test(trimmed)) {
        onError('Please enter a full URL starting with http:// or https://');
        return;
      }
      void attachVideo(trimmed, { endpoint, method });
      return;
    }

    case 'picker.poll': {
      if (!auth) {
        onError('Please sign in to create a poll.');
        return;
      }
      openPollModal();
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

    default:
      console.info('[appza-mobile] action dispatched (no-op):', action_slug, argRec, {
        effectiveItem,
      });
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

function PollBuilderModal({
  initial,
  onCancel,
  onSave,
}: {
  initial: PendingPoll | null;
  onCancel: () => void;
  onSave: (v: PendingPoll) => void;
}) {
  const [type, setType] = useState<'single_choice' | 'multi_choice'>(
    initial?.type ?? 'single_choice',
  );
  const [options, setOptions] = useState<string[]>(() => {
    const base = initial?.options ?? ['', ''];
    return base[base.length - 1] === '' ? base : [...base, ''];
  });
  const nonEmpty = options.filter((o) => o.trim().length > 0);
  const canSave = nonEmpty.length >= 2;

  function updateOption(idx: number, value: string) {
    setOptions((prev) => {
      const next = [...prev];
      next[idx] = value;
      if (idx === next.length - 1 && value.trim().length > 0) next.push('');
      return next;
    });
  }
  function removeOption(idx: number) {
    setOptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0 || next[next.length - 1] !== '') next.push('');
      while (next.length < 2) next.push('');
      return next;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Poll builder"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 75,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          width: 'min(420px, 90vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>Create poll</h3>
        <p style={{ margin: '4px 0 12px', fontSize: 12, color: '#6b7280' }}>
          Your message body becomes the poll question. Add 2+ options.
        </p>
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
          <legend style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>Type</legend>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
            <input
              type="radio"
              name="polltype"
              checked={type === 'single_choice'}
              onChange={() => setType('single_choice')}
            />
            <span>Single choice</span>
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              type="radio"
              name="polltype"
              checked={type === 'multi_choice'}
              onChange={() => setType('multi_choice')}
            />
            <span>Multi choice</span>
          </label>
        </fieldset>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {options.map((opt, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={opt}
                placeholder={`Option ${idx + 1}`}
                onChange={(e) => updateOption(idx, e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
              {options.length > 2 && idx < options.length - 1 && (
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  aria-label={`Remove option ${idx + 1}`}
                  style={{
                    border: 'none',
                    background: '#f3f4f6',
                    borderRadius: 999,
                    width: 24,
                    height: 24,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: '1px solid #e5e7eb',
              background: '#fff',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave({ type, options: nonEmpty })}
            style={{
              border: 'none',
              background: canSave ? '#3b82f6' : '#93c5fd',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: canSave ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Save poll
          </button>
        </div>
      </div>
    </div>
  );
}

type PanelComment = {
  id?: number | string;
  message?: string;
  created_at?: string;
  xprofile?: {
    display_name?: string;
    avatar?: string;
  } | null;
};

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
  auth: StoredAuth;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [comments, setComments] = useState<PanelComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

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
      setComments(items);
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
      const res = await fetch(endpoint, {
        method,
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: basicAuthHeader(auth),
        },
        body: JSON.stringify({
          [bodyKey]: feedId,
          [messageKey]: trimmed,
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
          `Comment failed (HTTP ${res.status})`;
        onError(msg);
        return;
      }
      setDraft('');
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
  }, [draft, sending, endpoint, method, auth, bodyKey, messageKey, feedId, load, onError]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={panelTitle}
      style={{
        position: 'fixed',
        inset: 0,
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
            comments.map((c, i) => {
              const name = c.xprofile?.display_name ?? 'User';
              const avatar = c.xprofile?.avatar ?? '';
              return (
                <div
                  key={c.id ?? i}
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
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: avatar ? `#eee url(${avatar}) center/cover` : '#d1d5db',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                        {name}
                      </span>
                      {c.created_at && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{c.created_at}</span>
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
                      dangerouslySetInnerHTML={{ __html: String(c.message ?? '') }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
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
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
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
            {sending ? '…' : sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

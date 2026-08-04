import { useEffect, useRef, useState } from 'react';
import { getSpacesControls } from './spacesControls';
import { getSpaceDetailControls } from './spaceDetailControls';
import { getFeedControls } from './feedControls';

/**
 * useDataSource(slug, params) — fetch a list payload for an AppZet's
 * declared `data_source`.
 *
 * Endpoint resolution:
 *   - Browser/plugin-admin: same-origin call to
 *     `/wp-json/appza/v1/preview/data?ds=<slug>&params=<jsonparams>`
 *     (the WP plugin's PreviewProxyController routes to the matching
 *     fcom-mobile / appza-builder controller).
 *   - Capacitor:  the same hook is reused; the host (mobile app) sets
 *     `window.appzaCoreConfig.endpoints.previewProxy` to the production
 *     /wp-json/appza/v1/preview/data URL on the customer's WP install.
 *
 * Behaviour:
 *   - Returns { items, loading, error }.
 *   - On HTTP error or schema mismatch, falls back to a small fixture
 *     dataset baked into the proxy (so local dev with broken WP plugins
 *     still renders a useful preview).
 *   - Refetches when slug or stringified params change.
 */

type FetchState = {
  items: unknown[];
  loading: boolean;
  error: string | null;
};

// `Window['appzaCoreConfig']` is augmented globally by @appza/schemas —
// import at least one binding from there elsewhere in the graph and
// this file picks it up. See packages/schemas/src/augmentations.ts.
import '@appza/schemas';

/**
 * Client-side revalidation event. Dispatched by:
 *   - the plug-in-admin's Refresh button (explicit user action)
 *   - the window `focus` handler installed inside useDataSource
 *
 * Every mounted useDataSource instance listens; on hit, it bumps its
 * private tick, which is an effect dep, which re-runs the fetch. The
 * fetch appends `nocache=1` when triggered by a tick > 0, so the proxy
 * bypasses its 5-min transient read and returns fresh upstream data.
 */
export const APPZA_REFRESH_EVENT = 'appza:refresh-data';

/**
 * Per-screen route params (e.g. { slug: 'appza' } for /space/:slug). The
 * shell (App.tsx) writes into this bag whenever it activates a screen via
 * nav.push — carrying `pass_item_as_context` items' identifying fields
 * (slug, id) so DS query_params with `source: 'route_param'` can read
 * them at fetch time. Kept as a plain window global (mirroring the
 * __appzaAuthHeader pattern) so the renderer stays free of shell imports.
 */
export function setRouteParams(next: Record<string, unknown> | null | undefined): void {
  if (typeof window === 'undefined') return;
  const g = window as unknown as { __appzaRouteParams?: Record<string, unknown> };
  g.__appzaRouteParams = next && typeof next === 'object' ? { ...next } : {};
}

export function getRouteParams(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const g = window as unknown as { __appzaRouteParams?: Record<string, unknown> };
  return g.__appzaRouteParams ?? {};
}

/**
 * Lookup table for state-slice getters. A DS `query_params` entry with
 * `source: 'state'` + `binding: 'state.<slice>.<key>'` reads via the
 * matching getter here. Flat legacy form `state.<key>` (spacesControls'
 * shape) falls through to a scan across all slices — first match wins,
 * ties broken by insertion order below. Adding a new state slice = one
 * entry here + a getter in that slice's controls file.
 */
const STATE_SLICE_GETTERS: Record<string, () => Record<string, unknown>> = {
  spaces_controls: () => getSpacesControls() as unknown as Record<string, unknown>,
  space_detail_controls: () => getSpaceDetailControls() as unknown as Record<string, unknown>,
  feed_controls: () => getFeedControls() as unknown as Record<string, unknown>,
};

/** Legacy flat-key bindings kept for spacesControls callers pre-arc. */
const LEGACY_FLAT_STATE_BAG: Record<string, () => unknown> = {
  spaces_tab: () => getSpacesControls().tab,
  spaces_search: () => getSpacesControls().search,
  spaces_sort: () => getSpacesControls().sort,
  feed_sort: () => getFeedControls().sort,
  feed_view_mode: () => getFeedControls().viewMode,
};

function readStateBinding(binding: string): unknown {
  if (!binding.startsWith('state.')) return undefined;
  const path = binding.slice(6);
  if (path.length === 0) return undefined;
  const dot = path.indexOf('.');
  if (dot > 0) {
    const slice = path.slice(0, dot);
    const key = path.slice(dot + 1);
    const getter = STATE_SLICE_GETTERS[slice];
    if (!getter) return undefined;
    const bag = getter();
    return bag ? bag[key] : undefined;
  }
  // Flat form: state.<key>. Try legacy bag first, then scan slices.
  const flat = LEGACY_FLAT_STATE_BAG[path];
  if (flat) return flat();
  for (const getter of Object.values(STATE_SLICE_GETTERS)) {
    const bag = getter();
    if (bag && path in bag) return bag[path];
  }
  return undefined;
}

/**
 * Resolves a DataSource.query_params config into a concrete params object
 * for `useDataSource` / `useDataSourcePaged`. Supports two source kinds:
 *
 *   - `source: 'state'`    with `binding: 'state.<slice>.<key>'` (or the
 *     legacy flat `state.<key>` for spacesControls).
 *   - `source: 'route_param'` with `binding: 'route.<param>'`, reading
 *     from `getRouteParams()` (shell writes on nav.push).
 *
 * Empty string / undefined resolutions OMIT the param — sending `?topic_slug=`
 * to FC would filter to a nonexistent topic instead of "All". Entries with
 * an explicit `default` fall back to the default when the resolution is
 * undefined (but empty-string still omits — that's how "All" travels).
 *
 * The config may also be a legacy plain `{ key: value }` map; those pass
 * through unchanged.
 */
export function resolveQueryParams(
  config: unknown,
): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const out: Record<string, unknown> = {};
  const routeParams = getRouteParams();
  for (const [key, raw] of Object.entries(config as Record<string, unknown>)) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'source' in raw) {
      const spec = raw as Record<string, unknown>;
      const source = typeof spec.source === 'string' ? spec.source : '';
      const binding = typeof spec.binding === 'string' ? spec.binding : '';
      const fallback = 'default' in spec ? spec.default : undefined;
      let resolved: unknown = undefined;
      if (source === 'state') {
        resolved = readStateBinding(binding);
      } else if (source === 'route_param' && binding.startsWith('route.')) {
        resolved = routeParams[binding.slice(6)];
      }
      if (resolved === undefined) resolved = fallback;
      // Empty string OR undefined → omit. Sending an empty topic_slug would
      // filter to a nonexistent topic instead of the intended "All".
      if (resolved === undefined || resolved === '') continue;
      out[key] = resolved;
    } else if (raw !== undefined) {
      // Legacy pass-through — plain `{ key: value }` map.
      out[key] = raw;
    }
  }
  return out;
}

function buildProxyUrl(
  slug: string,
  params: Record<string, unknown> | undefined,
  bypassCache: boolean,
): string {
  const base =
    (typeof window !== 'undefined' && window.appzaCoreConfig?.endpoints?.previewProxy) ||
    '/wp-json/appza/v1/preview/data';
  const url = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  url.searchParams.set('ds', slug);
  if (params && Object.keys(params).length > 0) {
    url.searchParams.set('params', JSON.stringify(params));
  }
  const mode =
    typeof window !== 'undefined' ? window.appzaCoreConfig?.previewMode : undefined;
  if (mode && mode !== 'auto') {
    url.searchParams.set('mode', mode);
  }
  if (bypassCache) {
    url.searchParams.set('nocache', '1');
  }
  return url.toString();
}

export function useDataSource(slug: string | undefined, params?: Record<string, unknown>): FetchState {
  const [state, setState] = useState<FetchState>({ items: [], loading: !!slug, error: null });
  const [refreshTick, setRefreshTick] = useState(0);
  const paramsKey = params ? JSON.stringify(params) : '';
  const previewMode =
    typeof window !== 'undefined' ? window.appzaCoreConfig?.previewMode : undefined;

  // Subscribe to explicit refresh events + window focus. Both bump the
  // tick; the tick > 0 branch below sends nocache=1 on the next fetch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRefresh = () => setRefreshTick((t) => t + 1);
    window.addEventListener(APPZA_REFRESH_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener(APPZA_REFRESH_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, []);

  useEffect(() => {
    if (!slug) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    // Forward the current user's Application Password (if logged in) to
    // the preview proxy so it can pass it to user-scoped upstream data
    // sources (fc-current-user, etc.). Header lives on window as a light
    // coupling — App.tsx sets/clears it on login/logout. The preview
    // proxy accepts both `Authorization` and `X-Appza-Auth`; we use the
    // custom header so any WP layer that might short-circuit on standard
    // Basic Auth doesn't interfere.
    const authHeader = (typeof window !== 'undefined'
      ? (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader
      : undefined) || undefined;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authHeader) headers['X-Appza-Auth'] = authHeader;
    // App-side shell (post.create success handler) sets
    // __appzaForceRefreshUntil to a future timestamp to signal that any
    // fetch happening in the next few seconds should bypass the proxy
    // cache. Covers the case where an AppZet mounts AFTER the refresh
    // event fired (React commit vs. dispatchEvent race).
    const forceRefreshUntil = (typeof window !== 'undefined'
      ? (window as unknown as { __appzaForceRefreshUntil?: number }).__appzaForceRefreshUntil
      : undefined) || 0;
    const forceBypass = forceRefreshUntil > Date.now();
    fetch(buildProxyUrl(slug, params, refreshTick > 0 || forceBypass), { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        // Response shape flexibility. Most endpoints return either a bare
        // array or `{items: [...]}`. Some single-object endpoints
        // (e.g. fcom-mobile /spaces/by/slug) return `{space: {...}}` — a
        // one-key wrapper object — after the plugin's preview-proxy
        // unwraps its outer envelope. Recognize that shape and produce a
        // single-item array so field_mappings like `data.topics` /
        // `data.cover_photo` resolve through items[0] the same way list
        // DSes do. Same for the pre-unwrap `{items: {space: {...}}}` shape.
        const unwrapSingleKeyObject = (obj: unknown): unknown | null => {
          if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
          const rec = obj as Record<string, unknown>;
          const keys = Object.keys(rec);
          const firstKey = keys[0];
          if (keys.length === 1 && firstKey && rec[firstKey] && typeof rec[firstKey] === 'object') {
            return rec[firstKey];
          }
          return null;
        };
        let items: unknown[];
        if (Array.isArray(json)) {
          items = json;
        } else if (Array.isArray(json?.items)) {
          items = json.items;
        } else if (json?.items && typeof json.items === 'object') {
          const inner = unwrapSingleKeyObject(json.items);
          items = [inner ?? json.items];
        } else if (json && typeof json === 'object') {
          const inner = unwrapSingleKeyObject(json);
          items = inner ? [inner] : [];
        } else {
          items = [];
        }
        setState({ items, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          items: [],
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, paramsKey, previewMode, refreshTick]);

  return state;
}

/**
 * Paginated variant of useDataSource — used by AppZets whose data source
 * is marked as infinite-scroll capable (see PAGINATED_DATA_SOURCES in
 * PlacementRenderer). Fetches page 1 on mount, then `loadMore()` fetches
 * page N+1 and appends its items to the accumulated list.
 *
 * Contract:
 *   - `items`     — accumulated across all fetched pages
 *   - `loading`   — true during ANY fetch (first load OR loadMore)
 *   - `error`     — most recent fetch error, cleared on retry
 *   - `hasMore`   — true until a page returns fewer than `perPage` items
 *                   (upstream lacks an explicit total, so we infer from
 *                   the short-page signal — standard REST pattern)
 *   - `loadMore()` — fetches next page. Idempotent while already loading.
 *   - `refresh()`  — clears items + refetches page 1 (used by the global
 *                   APPZA_REFRESH_EVENT so pull-to-refresh + window focus
 *                   still work).
 *
 * The upstream is expected to accept `page` + `per_page` query params
 * (standard WordPress REST convention). Extra `params` are merged into
 * every page request so filters (space slug, etc.) persist across pages.
 */
type PagedFetchState = {
  items: unknown[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
};

export function useDataSourcePaged(
  slug: string | undefined,
  opts?: { perPage?: number; params?: Record<string, unknown> },
): PagedFetchState {
  const perPage = opts?.perPage ?? 10;
  const extraParams = opts?.params;
  const extraKey = extraParams ? JSON.stringify(extraParams) : '';

  const [items, setItems] = useState<unknown[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  // Guard against concurrent loadMore invocations. IonInfiniteScroll can
  // fire onIonInfinite before React commits the previous page's setPage,
  // so a plain state check races. loadingRef flips synchronously.
  const loadingRef = useRef(false);

  // Subscribe to global refresh events (Refresh button + window focus).
  // On refresh, drop everything and start over from page 1.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRefresh = () => setRefreshTick((t) => t + 1);
    window.addEventListener(APPZA_REFRESH_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener(APPZA_REFRESH_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, []);

  // Reset accumulator when slug / params / refresh-tick change. Keeps the
  // items array from mixing content across different data sources or
  // param sets.
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    loadingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, extraKey, refreshTick]);

  // Fetch whichever page is current. Runs on mount + whenever `page`
  // bumps (via loadMore) + whenever the reset effect above resets to 1.
  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    if (!hasMore && page > 1) return;
    let cancelled = false;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const authHeader = (typeof window !== 'undefined'
      ? (window as unknown as { __appzaAuthHeader?: string }).__appzaAuthHeader
      : undefined) || undefined;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authHeader) headers['X-Appza-Auth'] = authHeader;

    const mergedParams: Record<string, unknown> = {
      ...(extraParams ?? {}),
      page,
      per_page: perPage,
    };
    // refreshTick > 0 signals a manual refresh — bypass proxy cache so
    // fresh upstream posts land.
    const url = buildProxyUrl(slug, mergedParams, refreshTick > 0);

    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const pageItems: unknown[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
            ? json.items
            : [];
        setItems((prev) => (page === 1 ? pageItems : [...prev, ...pageItems]));
        // Upstream doesn't expose total-pages, so we infer end-of-list
        // from a short page — the standard WP REST convention.
        setHasMore(pageItems.length >= perPage);
        setLoading(false);
        loadingRef.current = false;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        loadingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, extraKey, page, perPage, refreshTick]);

  const loadMore = () => {
    if (loadingRef.current || !hasMore) return;
    setPage((p) => p + 1);
  };
  const refresh = () => setRefreshTick((t) => t + 1);

  return { items, loading, error, hasMore, loadMore, refresh };
}

/**
 * Resolves paths like `data.foo.bar` or `data.foo[3].bar` against an item.
 * Returns undefined for missing branches. Array indexing is 0-based; a
 * segment may combine an object key + one or more `[N]` steps (e.g. the
 * catalog field_mapping `data.ctaButtons[0].label`).
 */
export function readDataPath(item: unknown, path: string): unknown {
  if (!path.startsWith('data.')) return undefined;
  const segments = path.slice(5).split('.');
  let cursor: unknown = item;
  for (const seg of segments) {
    const parts = parsePathSegment(seg);
    if (!parts) return undefined;
    for (const step of parts) {
      if (cursor === null || cursor === undefined) return undefined;
      if (typeof step === 'number') {
        if (!Array.isArray(cursor) || step < 0 || step >= cursor.length) return undefined;
        cursor = cursor[step];
      } else {
        if (typeof cursor !== 'object' || !(step in (cursor as Record<string, unknown>))) return undefined;
        cursor = (cursor as Record<string, unknown>)[step];
      }
    }
  }
  return cursor;
}

/**
 * Splits one dot-separated segment into an ordered list of key/index steps.
 * `ctaButtons[0]` → `['ctaButtons', 0]`, `foo[1][2]` → `['foo', 1, 2]`,
 * `foo` → `['foo']`. Returns null on malformed input.
 */
function parsePathSegment(seg: string): Array<string | number> | null {
  if (seg === '') return null;
  const out: Array<string | number> = [];
  const match = /^([^\[\]]+)((?:\[\d+\])*)$/.exec(seg);
  if (!match || !match[1]) return null;
  out.push(match[1]);
  const brackets = match[2] ?? '';
  if (brackets) {
    const idxMatches = brackets.matchAll(/\[(\d+)\]/g);
    for (const m of idxMatches) {
      out.push(Number.parseInt(m[1] as string, 10));
    }
  }
  return out;
}

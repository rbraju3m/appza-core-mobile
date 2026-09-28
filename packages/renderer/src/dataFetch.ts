import { useEffect, useRef, useState } from 'react';
import { getSpacesControls } from './spacesControls';
import { getSpaceDetailControls } from './spaceDetailControls';
import { getFeedControls } from './feedControls';
import { getChatControls } from './chatControls';
import { getLeaderboardControls } from './leaderboardControls';
import { getBookmarkControls } from './bookmarkControls';
import { getSearchControls } from './searchControls';
import { getProfileControls } from './profileControls';
import { getMemberDirectoryControls } from './memberDirectoryControls';
import { getCourseListControls } from './courseListControls';
import { getCourseStudentsControls } from './courseStudentsControls';
import { getCourseLessonControls } from './courseLessonControls';
import { getPostDetailControls } from './postDetailControls';
import { getModerationControls } from './moderationControls';
import { getViewer } from './viewer';
import { getAuthHeader } from './authHeader';

type FetchState = {
  items: unknown[];
  loading: boolean;
  error: string | null;
};

// `loading` lags a render behind a params change; `stale` says whether items belong to the current params.
type DataSourceState = FetchState & { stale: boolean };

// Pulls in the global Window['appzaCoreConfig'] augmentation.
import '@appza/schemas';

// Listeners refetch with nocache=1 so the proxy skips its transient cache.
export const APPZA_REFRESH_EVENT = 'appza:refresh-data';

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

const STATE_SLICE_GETTERS: Record<string, () => Record<string, unknown>> = {
  spaces_controls: () => getSpacesControls() as unknown as Record<string, unknown>,
  space_detail_controls: () => getSpaceDetailControls() as unknown as Record<string, unknown>,
  feed_controls: () => getFeedControls() as unknown as Record<string, unknown>,
  chat_controls: () => getChatControls() as unknown as Record<string, unknown>,
  leaderboard_controls: () => getLeaderboardControls() as unknown as Record<string, unknown>,
  bookmark_controls: () => getBookmarkControls() as unknown as Record<string, unknown>,
  search_controls: () => getSearchControls() as unknown as Record<string, unknown>,
  profile_controls: () => getProfileControls() as unknown as Record<string, unknown>,
  member_directory_controls: () => getMemberDirectoryControls() as unknown as Record<string, unknown>,
  moderation_controls: () => getModerationControls() as unknown as Record<string, unknown>,
  course_list_controls: () => getCourseListControls() as unknown as Record<string, unknown>,
  course_students_controls: () => getCourseStudentsControls() as unknown as Record<string, unknown>,
  course_lesson_controls: () => getCourseLessonControls() as unknown as Record<string, unknown>,
  post_detail_controls: () => getPostDetailControls() as unknown as Record<string, unknown>,
  // Without this, query_params bound to state.viewer.* silently resolve to undefined.
  viewer: () => getViewer() as unknown as Record<string, unknown>,
};

// Only client_state_binding sources need these: they have no fetch to re-run.
const STATE_SLICE_EVENTS: Record<string, string> = {
  spaces_controls: 'appza:spaces-controls-change',
  space_detail_controls: 'appza:space-detail-controls-change',
  feed_controls: 'appza:feed-controls-change',
  chat_controls: 'appza:chat-controls-change',
  leaderboard_controls: 'appza:leaderboard-controls-change',
  bookmark_controls: 'appza:bookmark-controls-change',
  search_controls: 'appza:search-controls-change',
  member_directory_controls: 'appza:member-directory-controls-change',
  moderation_controls: 'appza:moderation-controls-change',
  course_list_controls: 'appza:course-list-controls-change',
  course_students_controls: 'appza:course-students-controls-change',
  course_lesson_controls: 'appza:course-lesson-controls-change',
  post_detail_controls: 'appza:post-detail-controls-change',
  viewer: 'appza:viewer-change',
};

const LEGACY_FLAT_STATE_BAG: Record<string, () => unknown> = {
  spaces_tab: () => getSpacesControls().tab,
  spaces_search: () => getSpacesControls().search,
  spaces_sort: () => getSpacesControls().sort,
  feed_sort: () => getFeedControls().sort,
  feed_view_mode: () => getFeedControls().viewMode,
};

export function readStateBinding(binding: string): unknown {
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
  const flat = LEGACY_FLAT_STATE_BAG[path];
  if (flat) return flat();
  for (const getter of Object.values(STATE_SLICE_GETTERS)) {
    const bag = getter();
    if (bag && path in bag) return bag[path];
  }
  return undefined;
}

// Empty/undefined params are omitted: an empty topic_slug makes FC filter to a nonexistent topic instead of "All".
export function resolveQueryParams(
  config: unknown,
): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const out: Record<string, unknown> = {};
  const routeParams = getRouteParams();
  for (const [key, raw] of Object.entries(config as Record<string, unknown>)) {
    if (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      ('source' in raw || 'default' in raw)
    ) {
      // Constant-only specs ({ default: 20 }) must resolve, not be sent as the object.
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
      if (resolved === undefined || resolved === '') continue;
      out[key] = resolved;
    } else if (raw !== undefined) {
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

// Joins identical in-flight requests; each caller parses its own copy so rows are never shared.
const inFlight = new Map<string, Promise<string>>();

function fetchProxyText(url: string, headers: Record<string, string>): Promise<string> {
  const key = `${headers.Authorization ?? ''}\n${url}`;
  const joined = inFlight.get(key);
  if (joined) return joined;
  // 'omit': a wp-admin cookie beats the app password in WP core, then fails the nonce check and drops to guest.
  const request = fetch(url, { headers, credentials: 'omit' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}

async function fetchProxyJson(url: string, headers: Record<string, string>): Promise<any> {
  return JSON.parse(await fetchProxyText(url, headers));
}

// Via the proxy: fcom-mobile answers 401 to a direct browser fetch (cookie without REST nonce).
export async function fetchDataSourceOnce(
  slug: string,
  params?: Record<string, unknown>,
  opts?: { bypassCache?: boolean },
): Promise<unknown> {
  const authHeader =
    getAuthHeader();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  return fetchProxyJson(buildProxyUrl(slug, params, opts?.bypassCache === true), headers);
}

function useClientStateSource(binding: string): DataSourceState {
  const [items, setItems] = useState<unknown[]>(() => (binding ? readStateArray(binding) : []));
  useEffect(() => {
    if (typeof window === 'undefined' || !binding) return;
    const slice = binding.startsWith('state.') ? binding.slice(6).split('.')[0] : '';
    const event = slice ? STATE_SLICE_EVENTS[slice] : undefined;
    if (!event) {
      // Loud on purpose: silence here looks exactly like an empty list.
      console.warn(
        `[appza] client_state_binding "${binding}" names a slice with no change event registered; the list will not refresh.`,
      );
      return;
    }
    const onChange = () => setItems(readStateArray(binding));
    window.addEventListener(event, onChange);
    // The slice may have changed since the useState initialiser.
    onChange();
    return () => window.removeEventListener(event, onChange);
  }, [binding]);
  return { items, loading: false, error: null, stale: false };
}

function readStateArray(binding: string): unknown[] {
  const value = readStateBinding(binding);
  return Array.isArray(value) ? value : [];
}

export function useDataSource(
  slug: string | undefined,
  params?: Record<string, unknown>,
  clientStateBinding?: string | null,
): DataSourceState {
  const [state, setState] = useState<FetchState>({ items: [], loading: !!slug, error: null });
  // Ref, not state: written in the same tick as the setState that delivers those items.
  const loadedKeyRef = useRef<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const paramsKey = params ? JSON.stringify(params) : '';
  const previewMode =
    typeof window !== 'undefined' ? window.appzaCoreConfig?.previewMode : undefined;

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

  // Always called: hook order must stay stable.
  const clientState = useClientStateSource(clientStateBinding || '');

  useEffect(() => {
    // Must not reach the proxy: an empty endpoint answers with fixture rows.
    if (!slug || clientStateBinding) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const authHeader = getAuthHeader();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authHeader) headers.Authorization = authHeader;
    // Set after post.create so AppZets mounting after the refresh event still bypass the cache.
    const forceRefreshUntil = (typeof window !== 'undefined'
      ? (window as unknown as { __appzaForceRefreshUntil?: number }).__appzaForceRefreshUntil
      : undefined) || 0;
    const forceBypass = forceRefreshUntil > Date.now();
    fetchProxyJson(buildProxyUrl(slug, params, refreshTick > 0 || forceBypass), headers)
      .then((json) => {
        if (cancelled) return;
        // Single-key wrappers (e.g. {space: {...}}) become one-item arrays so items[0] mappings resolve.
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
        loadedKeyRef.current = `${slug}|${paramsKey}`;
        setState({ items, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        // An error is an answer too; leaving the key unset would pin `stale` forever.
        loadedKeyRef.current = `${slug}|${paramsKey}`;
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
  }, [slug, paramsKey, previewMode, refreshTick, clientStateBinding]);

  if (clientStateBinding) return clientState;

  const stale = !!slug && loadedKeyRef.current !== `${slug}|${paramsKey}`;
  return { ...state, stale };
}

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
  // Flips synchronously; IonInfiniteScroll can fire before setPage commits.
  const loadingRef = useRef(false);

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
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    loadingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, extraKey, refreshTick]);

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

    const authHeader = getAuthHeader();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authHeader) headers.Authorization = authHeader;

    const mergedParams: Record<string, unknown> = {
      ...(extraParams ?? {}),
      page,
      per_page: perPage,
    };
    const url = buildProxyUrl(slug, mergedParams, refreshTick > 0);

    fetchProxyJson(url, headers)
      .then((json) => {
        if (cancelled) return;
        const pageItems: unknown[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
            ? json.items
            : [];
        setItems((prev) => (page === 1 ? pageItems : [...prev, ...pageItems]));
        // No total-pages upstream; a short page means the end.
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

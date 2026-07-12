import { useEffect, useState } from 'react';

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
    fetch(buildProxyUrl(slug, params, refreshTick > 0), { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const items = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
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
 * Resolves `data.foo.bar` paths against an item object. Returns undefined
 * for missing branches.
 */
export function readDataPath(item: unknown, path: string): unknown {
  if (!path.startsWith('data.')) return undefined;
  const segments = path.slice(5).split('.');
  let cursor: unknown = item;
  for (const seg of segments) {
    if (cursor && typeof cursor === 'object' && seg in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cursor;
}

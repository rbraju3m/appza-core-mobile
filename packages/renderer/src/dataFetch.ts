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

declare global {
  interface Window {
    appzaCoreConfig?: {
      endpoints?: {
        bootstrap?: string;
        customizations?: string;
        previewProxy?: string;
      };
      restNonce?: string;
      defaultTemplate?: string;
    };
  }
}

function buildProxyUrl(slug: string, params?: Record<string, unknown>): string {
  const base =
    (typeof window !== 'undefined' && window.appzaCoreConfig?.endpoints?.previewProxy) ||
    '/wp-json/appza/v1/preview/data';
  const url = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  url.searchParams.set('ds', slug);
  if (params && Object.keys(params).length > 0) {
    url.searchParams.set('params', JSON.stringify(params));
  }
  return url.toString();
}

export function useDataSource(slug: string | undefined, params?: Record<string, unknown>): FetchState {
  const [state, setState] = useState<FetchState>({ items: [], loading: !!slug, error: null });
  const paramsKey = params ? JSON.stringify(params) : '';

  useEffect(() => {
    if (!slug) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(buildProxyUrl(slug, params), { headers: { Accept: 'application/json' } })
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
  }, [slug, paramsKey]);

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

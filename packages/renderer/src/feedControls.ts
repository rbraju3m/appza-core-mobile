import { useEffect, useState } from 'react';

// Feed controls — sort key + view mode. Written by App-side action
// dispatchers (feed.set_sort / feed.set_view_mode), read by
// PlacementRenderer to build the fc-feed fetch params and pick which
// post appzet variant to render per item.
//
// Kept in a tiny event-backed store rather than passed via props
// because both the renderer (read side) and the App (write side) sit
// in different package boundaries — a store keeps the wire between
// them one-liner-thin. localStorage persistence means the choice
// survives page reloads + Capacitor app restarts (WebView localStorage
// maps to Android app-scoped storage).

export type FeedViewMode = 'timeline' | 'card' | 'list';

export type FeedControls = {
  sort: string;
  viewMode: FeedViewMode;
};

const STORAGE_KEY = 'appza.feedControls';
const EVENT = 'appza:feed-controls-change';

const DEFAULTS: FeedControls = {
  sort: 'latest',
  viewMode: 'timeline',
};

function readFromStorage(): FeedControls {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<FeedControls>;
    return {
      sort: typeof parsed.sort === 'string' && parsed.sort ? parsed.sort : DEFAULTS.sort,
      viewMode: parsed.viewMode === 'card' || parsed.viewMode === 'list' || parsed.viewMode === 'timeline'
        ? parsed.viewMode
        : DEFAULTS.viewMode,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: FeedControls = readFromStorage();

export function getFeedControls(): FeedControls {
  return current;
}

export function setFeedControls(patch: Partial<FeedControls>): void {
  const next: FeedControls = {
    sort: typeof patch.sort === 'string' && patch.sort ? patch.sort : current.sort,
    viewMode: patch.viewMode ?? current.viewMode,
  };
  // Visible debug so we can prove the pick reached this code without
  // needing DevTools. Removable once the flow is trusted.
  console.log('[appza-feedControls] setFeedControls', { patch, next, prev: current });
  if (next.sort === current.sort && next.viewMode === current.viewMode) return;
  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full / private mode — best-effort; the in-memory
      // `current` still wins for the running session.
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function useFeedControls(): FeedControls {
  const [state, setState] = useState<FeedControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

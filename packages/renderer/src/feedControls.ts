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

// Whether localStorage actually held a choice at boot.
//
// The store cannot otherwise tell an ABSENT entry from a stored
// `latest` — both read as `latest` — and the difference is the whole
// question the admin defaults ask: seed a viewer who has never chosen,
// leave alone one who has. Captured once at module load rather than
// re-read, because the seed happens after the first write would have
// made the answer `true` for the wrong reason.
let hadStoredChoice = false;

/** True when this viewer had already picked a sort or layout. */
export function hasStoredFeedControls(): boolean {
  return hadStoredChoice;
}

function readFromStorage(): FeedControls {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    hadStoredChoice = true;
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

// What is actually in storage, tracked apart from `current`.
//
// A SEED is not a choice, so it must not become one. Persisting the
// whole of `current` on the next real pick would write the seeded value
// alongside it — pick a LAYOUT and the site's seeded SORT lands in
// storage as if the person had chosen it, and the next admin change of
// `default_feed_sort_by` would never reach them again. Only the fields a
// persisting caller actually passed are merged in here.
let persisted: Partial<FeedControls> = hadStoredChoice ? { ...current } : {};

export function getFeedControls(): FeedControls {
  return current;
}

/** Guards the one-shot seed below. */
let seeded = false;

function writeFeedControls(patch: Partial<FeedControls>, persist: boolean): void {
  const next: FeedControls = {
    sort: typeof patch.sort === 'string' && patch.sort ? patch.sort : current.sort,
    viewMode: patch.viewMode ?? current.viewMode,
  };
  // Visible debug so we can prove the pick reached this code without
  // needing DevTools. Removable once the flow is trusted.
  console.log('[appza-feedControls] setFeedControls', { patch, next, prev: current, persist });
  if (next.sort === current.sort && next.viewMode === current.viewMode) return;
  current = next;
  if (typeof window !== 'undefined') {
    if (persist) {
      persisted = {
        ...persisted,
        ...(typeof patch.sort === 'string' && patch.sort ? { sort: patch.sort } : {}),
        ...(patch.viewMode ? { viewMode: patch.viewMode } : {}),
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } catch {
        // Storage full / private mode — best-effort; the in-memory
        // `current` still wins for the running session.
      }
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function setFeedControls(patch: Partial<FeedControls>): void {
  writeFeedControls(patch, true);
}

/**
 * Apply a default to a viewer who has never chosen one.
 *
 * Called by the toolbar on mount. Does nothing once anyone has picked —
 * including earlier in this same session — so an admin changing the
 * site default cannot yank the feed out from under someone mid-scroll,
 * and a remount cannot undo a pick.
 *
 * Both fields are optional: the site can express a layout preference
 * and no sort preference, which is what an empty `default_sort_by`
 * means. A field left undefined here keeps whatever the store has.
 *
 * Deliberately does NOT persist. Writing the seed to storage would turn
 * a default into a choice: the next launch would read it back, decide
 * this viewer had chosen, and go on serving the OLD default long after
 * the admin changed it. Unpersisted, the site's answer is re-applied
 * every launch until the person actually picks something.
 */
export function seedFeedControls(patch: Partial<FeedControls>): void {
  if (hadStoredChoice || seeded) return;
  seeded = true;
  writeFeedControls(patch, false);
}

export function useFeedControls(): FeedControls {
  const [state, setState] = useState<FeedControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    // Re-read once the listener is up. Between this component's render
    // and this effect, another one's effect may already have written —
    // and the admin-default seed does exactly that, from the TOOLBAR,
    // which React commits before the post list below it. The event fired
    // into a subscriber that did not exist yet, so the feed booted in
    // the old layout while the toolbar showed the new one. Cheap, and it
    // closes the gap for every future writer, not just the seed.
    setState(current);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

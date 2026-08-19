import { useEffect, useState } from 'react';

// Saved Posts screen controls — the search string, the sort key, which of
// the three layouts is showing, and the derived verdict the gated
// placements read.
//
// The sixth event-backed slice, same shape as the other five
// (feedControls / spacesControls / spaceDetailControls / chatControls /
// leaderboardControls). Still duplicated rather than abstracted into a
// slice manager: the shape has not drifted across six of them, and the
// day it does the divergence is the interesting part.

export type BookmarkViewMode = 'timeline' | 'card' | 'list';

export type BookmarkControls = {
  // Authored — the sort sheet writes it. fc-bookmarks binds it as its
  // `order_by_type` query param, so a pick is a refetch rather than a
  // reorder of the page already loaded. Values are FluentCommunity's own
  // Helper::getPostOrderOptions() keys.
  sort: string;
  // Authored — the layout sheet writes it. Nothing refetches: the rows
  // are already there, only which AppZet variant draws them changes.
  viewMode: BookmarkViewMode;
  // Authored — the search pill writes it on every keystroke, including
  // the ⨯ clear (which fires with an empty value). Bound as `search`, so
  // the match runs server-side against the same query the portal uses.
  search: string;
  // Derived, NOT authored: PlacementRenderer publishes it after each
  // fetch. 'list' | 'no-match' | 'empty' | 'loading'.
  //
  // Three placements gate on this one string, and they have to — a
  // placement can gate on state and never on data (P75), and the
  // difference between "nothing saved" and "nothing matched" is the
  // search value, which no placement can see either.
  view: string;
};

const STORAGE_KEY = 'appza.bookmarkControls';
const EVENT = 'appza:bookmark-controls-change';

const DEFAULTS: BookmarkControls = {
  sort: 'latest',
  viewMode: 'timeline',
  search: '',
  view: 'loading',
};

function isViewMode(v: unknown): v is BookmarkViewMode {
  return v === 'timeline' || v === 'card' || v === 'list';
}

function readFromStorage(): BookmarkControls {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<BookmarkControls>;
    return {
      // Both are genuine preferences — how you like your saved posts
      // sorted and shaped is worth remembering across visits, the same
      // way feedControls remembers them for the feed.
      sort: typeof parsed.sort === 'string' && parsed.sort ? parsed.sort : DEFAULTS.sort,
      viewMode: isViewMode(parsed.viewMode) ? parsed.viewMode : DEFAULTS.viewMode,
      // Never restored. Reopening the screen on a search you typed last
      // week would show "No matches" over a list that is not actually
      // empty, and the reason would be off screen in a field you have to
      // scroll to.
      search: DEFAULTS.search,
      // Never restored: it describes the CURRENT fetch. A stale 'empty'
      // would paint the empty state over a list still loading.
      view: DEFAULTS.view,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: BookmarkControls = readFromStorage();

export function getBookmarkControls(): BookmarkControls {
  return current;
}

export function setBookmarkControls(patch: Partial<BookmarkControls>): void {
  const next: BookmarkControls = {
    sort: typeof patch.sort === 'string' && patch.sort ? patch.sort : current.sort,
    viewMode: isViewMode(patch.viewMode) ? patch.viewMode : current.viewMode,
    // Deliberately NOT guarded on truthiness: '' is the value the ⨯
    // clear sends, and it is the whole point of the clear button.
    search: typeof patch.search === 'string' ? patch.search : current.search,
    view: typeof patch.view === 'string' ? patch.view : current.view,
  };
  if (
    next.sort === current.sort &&
    next.viewMode === current.viewMode &&
    next.search === current.search &&
    next.view === current.view
  ) {
    return;
  }
  current = next;
  if (typeof window !== 'undefined') {
    try {
      // Only the two preferences persist (see the type comments).
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sort: next.sort, viewMode: next.viewMode }),
      );
    } catch {
      // best-effort — in-memory `current` still wins for the running session
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/**
 * Put the screen back in its landing state on mount.
 *
 * Only the search and the verdict: sort and layout are preferences and
 * are meant to survive. Called by the shells when the Saved Posts screen
 * becomes active, the same job resetLeaderboardControls does next door.
 */
export function resetBookmarkControls(): void {
  setBookmarkControls({ search: '', view: 'loading' });
}

export function useBookmarkControls(): BookmarkControls {
  const [state, setState] = useState<BookmarkControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

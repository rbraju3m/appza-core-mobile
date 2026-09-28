import { useEffect, useState } from 'react';
import { cancelDebouncedSearch } from './searchDebounce';

export type BookmarkViewMode = 'timeline' | 'card' | 'list';

export type BookmarkControls = {
  // FluentCommunity Helper::getPostOrderOptions() keys; bound as `order_by_type`, so a change refetches.
  sort: string;
  viewMode: BookmarkViewMode;
  search: string;
  // Published by PlacementRenderer after each fetch; placements can gate on state but never on data.
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
      sort: typeof parsed.sort === 'string' && parsed.sort ? parsed.sort : DEFAULTS.sort,
      viewMode: isViewMode(parsed.viewMode) ? parsed.viewMode : DEFAULTS.viewMode,
      // Never restored: a stale search or verdict paints "No matches"/empty over a real list.
      search: DEFAULTS.search,
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
    // Not truthiness-guarded: '' is what the clear button sends.
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
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sort: next.sort, viewMode: next.viewMode }),
      );
    } catch {
      // best-effort
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function resetBookmarkControls(): void {
  // A pending debounced write would land after this reset and restore the old search.
  cancelDebouncedSearch('bookmarks');
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

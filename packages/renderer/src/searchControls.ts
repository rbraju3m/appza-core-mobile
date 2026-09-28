import { useEffect, useState } from 'react';
import { cancelDebouncedSearch } from './searchDebounce';

// snake_case on purpose: bindings address fields by literal name, and a missing one is silently omitted.

export type SearchTab = 'posts' | 'members' | 'spaces';

// FluentCommunity's own `search_in` values.
export type SearchPostScope = 'post_content' | 'post_comments';

export type SearchScopeKey = 'posts_content' | 'posts_comments' | 'members' | 'spaces';

export type SearchFetchView = 'loading' | 'results' | 'no-match';

export type SearchRecentItem = { value: string; label: string };

export type SearchControls = {
  tab: SearchTab;
  post_scope: SearchPostScope;
  query: string;
  recent: Record<SearchScopeKey, string[]>;

  // Catalog-owned, seeded from fc-search-field's props on mount.
  min_query_length: number;
  recent_limit: number;

  fetch_view: SearchFetchView;

  // Derived; recomputed on every write, never patched.
  scope_key: SearchScopeKey;
  noun: string;
  recent_items: SearchRecentItem[];
  // '' until the query is long enough. Keeps exactly one result card mounted and none for a short query;
  // cards must not gate on `view`, since their fetch decides it.
  active_scope: '' | SearchTab;
  // 'recent' | 'prompt' | 'typing' | 'loading' | 'results' | 'no-match'
  view: string;
};

const STORAGE_KEY = 'appza.searchControls';
const EVENT = 'appza:search-controls-change';

const SCOPE_KEYS: SearchScopeKey[] = ['posts_content', 'posts_comments', 'members', 'spaces'];

function emptyRecent(): Record<SearchScopeKey, string[]> {
  return { posts_content: [], posts_comments: [], members: [], spaces: [] };
}

const BASE = {
  tab: 'posts' as SearchTab,
  post_scope: 'post_content' as SearchPostScope,
  query: '',
  min_query_length: 2,
  recent_limit: 10,
  fetch_view: 'loading' as SearchFetchView,
};

function isTab(v: unknown): v is SearchTab {
  return v === 'posts' || v === 'members' || v === 'spaces';
}

function isPostScope(v: unknown): v is SearchPostScope {
  return v === 'post_content' || v === 'post_comments';
}

function isFetchView(v: unknown): v is SearchFetchView {
  return v === 'loading' || v === 'results' || v === 'no-match';
}

function derive(
  base: Omit<SearchControls, 'scope_key' | 'noun' | 'recent_items' | 'active_scope' | 'view'>,
): SearchControls {
  const scope_key: SearchScopeKey =
    base.tab === 'posts'
      ? base.post_scope === 'post_comments'
        ? 'posts_comments'
        : 'posts_content'
      : base.tab;

  const noun = base.tab === 'posts' ? 'posts' : base.tab;

  const recent_items: SearchRecentItem[] = (base.recent[scope_key] ?? []).map((t) => ({
    value: t,
    label: t,
  }));

  // Whitespace-only would become LIKE '%   %' and match almost everything.
  const trimmed = base.query.trim();
  const active_scope: '' | SearchTab = trimmed.length >= base.min_query_length ? base.tab : '';

  let view: string;
  if (active_scope === '') {
    view = base.query.length === 0 ? (recent_items.length > 0 ? 'recent' : 'prompt') : 'typing';
  } else {
    view = base.fetch_view;
  }

  return { ...base, scope_key, noun, recent_items, active_scope, view };
}

function sanitizeRecent(raw: unknown, limit: number): Record<SearchScopeKey, string[]> {
  const out = emptyRecent();
  if (!raw || typeof raw !== 'object') return out;
  const bag = raw as Record<string, unknown>;
  for (const key of SCOPE_KEYS) {
    const list = bag[key];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    for (const entry of list) {
      if (typeof entry !== 'string') continue;
      const term = entry.trim();
      if (!term || seen.has(term)) continue;
      seen.add(term);
      out[key].push(term);
      if (out[key].length >= limit) break;
    }
  }
  return out;
}

function readFromStorage(): SearchControls {
  const fallback = derive({ ...BASE, recent: emptyRecent() });
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { recent?: unknown };
    // Only the histories are restored; the rest is per-visit or catalog-owned.
    return derive({ ...BASE, recent: sanitizeRecent(parsed.recent, BASE.recent_limit) });
  } catch {
    return fallback;
  }
}

let current: SearchControls = readFromStorage();

export function getSearchControls(): SearchControls {
  return current;
}

function commit(next: SearchControls): void {
  // recent_items is rebuilt on every derive, so compare by value, not reference.
  const same =
    next.tab === current.tab &&
    next.post_scope === current.post_scope &&
    next.query === current.query &&
    next.min_query_length === current.min_query_length &&
    next.recent_limit === current.recent_limit &&
    next.fetch_view === current.fetch_view &&
    next.view === current.view &&
    next.active_scope === current.active_scope &&
    next.recent_items.length === current.recent_items.length &&
    next.recent_items.every((r, i) => r.value === current.recent_items[i]?.value);
  if (same) return;

  const recentChanged = next.recent !== current.recent;
  current = next;
  if (typeof window === 'undefined') return;
  if (recentChanged) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ recent: next.recent }));
    } catch {
      // best-effort
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

// Any change to what is searched resets fetch_view, so a stale "No matches" never flashes.
export function setSearchControls(
  patch: Partial<Pick<SearchControls, 'tab' | 'post_scope' | 'query' | 'min_query_length' | 'recent_limit'>>,
): void {
  const tab = isTab(patch.tab) ? patch.tab : current.tab;
  const post_scope = isPostScope(patch.post_scope) ? patch.post_scope : current.post_scope;
  // '' is what the clear button sends.
  const query = typeof patch.query === 'string' ? patch.query : current.query;
  const min_query_length =
    typeof patch.min_query_length === 'number' && patch.min_query_length >= 0
      ? patch.min_query_length
      : current.min_query_length;
  const recent_limit =
    typeof patch.recent_limit === 'number' && patch.recent_limit > 0
      ? patch.recent_limit
      : current.recent_limit;

  const searchChanged =
    tab !== current.tab || post_scope !== current.post_scope || query !== current.query;

  commit(
    derive({
      tab,
      post_scope,
      query,
      recent: current.recent,
      min_query_length,
      recent_limit,
      fetch_view: searchChanged ? 'loading' : current.fetch_view,
    }),
  );
}

// Must NOT reset to 'loading', unlike setSearchControls.
export function publishSearchFetchView(fetch_view: SearchFetchView): void {
  if (!isFetchView(fetch_view)) return;
  commit(derive({ ...current, fetch_view }));
}

// Called once the debounced query settles, not per keystroke.
export function recordRecentSearch(term: string): void {
  const value = term.trim();
  if (!value || value.length < current.min_query_length) return;
  const key = current.scope_key;
  const existing = current.recent[key] ?? [];
  const next = [value, ...existing.filter((t) => t !== value)].slice(0, current.recent_limit);
  if (next.length === existing.length && next.every((t, i) => t === existing[i])) return;
  commit(derive({ ...current, recent: { ...current.recent, [key]: next } }));
}

export function removeRecentSearch(term: string): void {
  const key = current.scope_key;
  const existing = current.recent[key] ?? [];
  const next = existing.filter((t) => t !== term);
  if (next.length === existing.length) return;
  commit(derive({ ...current, recent: { ...current.recent, [key]: next } }));
}

// Clears only this scope's history.
export function clearRecentSearches(): void {
  const key = current.scope_key;
  if ((current.recent[key] ?? []).length === 0) return;
  commit(derive({ ...current, recent: { ...current.recent, [key]: [] } }));
}

// Separate from reset: config must survive the per-entry reset.
export function configureSearchControls(config: {
  min_query_length?: number;
  recent_limit?: number;
}): void {
  setSearchControls({
    min_query_length: config.min_query_length,
    recent_limit: config.recent_limit,
  });
}

// Cancel the pending debounce first, or it lands after the reset and restores the old query.
export function resetSearchControls(): void {
  cancelDebouncedSearch('search');
  commit(
    derive({
      ...current,
      tab: BASE.tab,
      post_scope: BASE.post_scope,
      query: '',
      fetch_view: 'loading',
    }),
  );
}

export function useSearchControls(): SearchControls {
  const [state, setState] = useState<SearchControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

import { useEffect, useState } from 'react';
import { cancelDebouncedSearch } from './searchDebounce';

// Search screen controls — the seventh event-backed slice, and the first
// one that derives more than it stores.
//
// Same store pattern as the other six (spacesControls / spaceDetailControls
// / feedControls / chatControls / leaderboardControls / bookmarkControls):
// a module-level `current`, a setter that dispatches a window event, and a
// hook that re-renders on it. Still duplicated rather than abstracted — the
// shape has now drifted, but it drifted in ONE direction (derived keys), and
// folding that back into the other six would mean touching six working
// screens to serve one.
//
// ── A NOTE ON NAMING ─────────────────────────────────────────────────────
// Every field here is snake_case, unlike bookmarkControls' `viewMode`. That
// is deliberate: a DataSource `query_params` binding and a placement
// `visible_when` both address this slice by LITERAL PROPERTY NAME
// (`state.search_controls.post_scope`). A binding that names a property
// that does not exist resolves to `undefined` and is silently omitted — no
// error, no warning, just a search that returns everything. Keeping the
// property names identical to the binding names is what makes that class of
// typo impossible rather than merely unlikely.

export type SearchTab = 'posts' | 'members' | 'spaces';

/** FluentCommunity's own `search_in` values. Not ours to rename. */
export type SearchPostScope = 'post_content' | 'post_comments';

/** Which of the four separate recent-search histories is in play. */
export type SearchScopeKey = 'posts_content' | 'posts_comments' | 'members' | 'spaces';

/**
 * What the mounted result card publishes about its own fetch. Kept apart
 * from `view` because `view` also covers three states that happen when no
 * card is mounted at all.
 */
export type SearchFetchView = 'loading' | 'results' | 'no-match';

export type SearchRecentItem = { value: string; label: string };

export type SearchControls = {
  // ── Authored ───────────────────────────────────────────────────────────
  /** Written by fc-search-tabs. */
  tab: SearchTab;
  /** Written by fc-search-scope-tabs. Bound by fc-search-posts as `search_in`. */
  post_scope: SearchPostScope;
  /**
   * Written by the search field on every keystroke (debounced by the shell)
   * and by a recent row (immediately — a whole term arrives at once, so
   * there is nothing to wait for). Bound by all three HTTP sources.
   */
  query: string;
  /** The four histories. The only thing here that survives a reload. */
  recent: Record<SearchScopeKey, string[]>;

  // ── Config, seeded from the catalog on mount ───────────────────────────
  /**
   * How many characters before anything is fetched, read off
   * fc-search-field's `min_query_length` prop. Lives here rather than on
   * each DataSource so raising it is one right-panel edit that cannot drift
   * from the "Keep typing" copy it governs.
   */
  min_query_length: number;
  /** Cap per history, read off fc-search-field's `recent_limit` prop. */
  recent_limit: number;

  // ── Published by the mounted card ──────────────────────────────────────
  fetch_view: SearchFetchView;

  // ── Derived. Never patch these; they are recomputed on every write. ────
  /** Which history is showing. */
  scope_key: SearchScopeKey;
  /** 'posts' | 'members' | 'spaces' — the word in the placeholder and the no-match line. */
  noun: string;
  /** The current history, shaped as DataSource rows for fc-search-recents. */
  recent_items: SearchRecentItem[];
  /**
   * The load-bearing one. `''` until the query is long enough, then the
   * current tab.
   *
   * All three result cards gate on this, and that single clause does three
   * jobs. It keeps exactly ONE card mounted, so one request goes out per
   * settled query and one placement publishes the verdict instead of three
   * fighting. It mounts NO card while the query is short, so nothing ever
   * asks /feeds for everything it has with an empty `search`. And it is
   * what makes "Keep typing" a real state rather than a decoration.
   *
   * The cards deliberately do NOT gate on `view`: they have to be mounted
   * to run the fetch that decides it.
   */
  active_scope: '' | SearchTab;
  /**
   * What the screen is showing. Everything except the three result cards
   * gates on this.
   *
   * 'recent'   — no query, and this scope has a history
   * 'prompt'   — no query, no history (design 3; also where Clear lands)
   * 'typing'   — a query too short to search on (designs 4, 5)
   * 'loading' | 'results' | 'no-match' — whatever the mounted card said
   */
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

/**
 * Recompute every derived field from the authored ones.
 *
 * Centralised on purpose: `view` reads five inputs, and the difference
 * between "nothing saved" and "nothing matched" is one of them. Letting any
 * caller assemble it would be how the two states start disagreeing.
 */
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

  // trim(): a query of three spaces is not a query. Sending it would ask
  // FluentCommunity to LIKE '%   %', which matches almost every post.
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
    // ONLY the histories are restored. Everything else describes the
    // current visit:
    //   - `query`: reopening Search on last week's search would paint "No
    //     matches" over a list that is not empty, with the reason off
    //     screen in a field you have to scroll to.
    //   - `tab` / `post_scope`: every design lands on Posts → Content.
    //   - `fetch_view`: it describes a fetch that is no longer running.
    //   - the config pair: the CATALOG owns those, and a stale stored copy
    //     would quietly outrank a right-panel edit.
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
  // Cheap identity check first, then the derived strings. `recent_items` is
  // rebuilt on every derive, so comparing it by reference would report a
  // change on every call and re-render the screen on each keystroke.
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
      // best-effort — in-memory `current` still wins for this session
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

/**
 * Write the authored keys. Derived keys are recomputed here, not accepted.
 *
 * Any change to what is being searched forces `fetch_view` back to
 * 'loading'. Without it, switching from a tab that found nothing to one
 * that has not fetched yet would show the previous tab's "No matches" over
 * an empty screen for a frame — the same class of staleness P99 records,
 * caught here rather than left to each card to guard.
 */
export function setSearchControls(
  patch: Partial<Pick<SearchControls, 'tab' | 'post_scope' | 'query' | 'min_query_length' | 'recent_limit'>>,
): void {
  const tab = isTab(patch.tab) ? patch.tab : current.tab;
  const post_scope = isPostScope(patch.post_scope) ? patch.post_scope : current.post_scope;
  // NOT guarded on truthiness: '' is what the ⨯ clear sends, and it is the
  // whole point of the clear button.
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

/**
 * Publish what the mounted result card found.
 *
 * Separate from setSearchControls so the two can never be confused: this
 * one must NOT reset itself to 'loading', and that one always must.
 * PlacementRenderer is the only caller.
 */
export function publishSearchFetchView(fetch_view: SearchFetchView): void {
  if (!isFetchView(fetch_view)) return;
  commit(derive({ ...current, fetch_view }));
}

/**
 * Remember a term against the CURRENT tab + scope.
 *
 * Called from the shell once the debounced query has SETTLED — not per
 * keystroke, which is the only reason this does not fill up with every
 * prefix of every word. Pausing mid-word still records the prefix; that is
 * inherent to a screen with no submit control, and the cap keeps it cheap.
 */
export function recordRecentSearch(term: string): void {
  const value = term.trim();
  if (!value || value.length < current.min_query_length) return;
  const key = current.scope_key;
  const existing = current.recent[key] ?? [];
  // Most recent first, and re-searching something you already have moves it
  // up rather than duplicating it.
  const next = [value, ...existing.filter((t) => t !== value)].slice(0, current.recent_limit);
  if (next.length === existing.length && next.every((t, i) => t === existing[i])) return;
  commit(derive({ ...current, recent: { ...current.recent, [key]: next } }));
}

/** The ⨯ on one row — forget just that term, in this scope only. */
export function removeRecentSearch(term: string): void {
  const key = current.scope_key;
  const existing = current.recent[key] ?? [];
  const next = existing.filter((t) => t !== term);
  if (next.length === existing.length) return;
  commit(derive({ ...current, recent: { ...current.recent, [key]: next } }));
}

/**
 * The Clear link — empty THIS scope's history and nothing else.
 *
 * Scoped on purpose: designs 1 and 2 show Content and Comments as two
 * separate lists, so clearing on one must leave the other alone.
 */
export function clearRecentSearches(): void {
  const key = current.scope_key;
  if ((current.recent[key] ?? []).length === 0) return;
  commit(derive({ ...current, recent: { ...current.recent, [key]: [] } }));
}

/**
 * Seed the catalog-owned config. Called by the shells when the Search
 * screen mounts, reading fc-search-field's props.
 *
 * Separate from the reset below because it must survive one: the reset runs
 * on every entry to the screen, and the config is not per-visit state.
 */
export function configureSearchControls(config: {
  min_query_length?: number;
  recent_limit?: number;
}): void {
  setSearchControls({
    min_query_length: config.min_query_length,
    recent_limit: config.recent_limit,
  });
}

/**
 * Put the screen back in its landing state on entry.
 *
 * Drops any keystroke still waiting out its debounce FIRST. A write armed
 * on the way out would otherwise land after this reset and put the
 * abandoned query back — so reopening Search would show "No matches" over a
 * list that is not empty. Exactly the trap resetBookmarkControls documents.
 *
 * The histories are not touched: they are the one thing on this screen the
 * user expects to still be there.
 */
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

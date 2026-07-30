import { useEffect, useState } from 'react';

// Spaces list controls — tab + search string + sort key. Written by
// App-side action dispatchers (spaces.set_tab / spaces.set_search /
// spaces.set_sort), read by PlacementRenderer to (a) evaluate
// state.spaces_tab bindings on the spaces screen placements so the
// active tab's card list is visible while the inactive one is hidden,
// and (b) filter/sort the visible items client-side v1.
//
// Same event-backed store pattern as feedControls — small enough to
// justify the duplication over a generic slice manager. localStorage
// persistence survives page reloads + Capacitor app restarts.

export type SpacesTab = 'all' | 'my';
export type SpacesSort = 'alphabetical' | 'members' | 'recent';

export type SpacesControls = {
  tab: SpacesTab;
  search: string;
  sort: SpacesSort;
};

const STORAGE_KEY = 'appza.spacesControls';
const EVENT = 'appza:spaces-controls-change';

const DEFAULTS: SpacesControls = {
  tab: 'all',
  search: '',
  sort: 'alphabetical',
};

function readFromStorage(): SpacesControls {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SpacesControls>;
    return {
      tab: parsed.tab === 'my' ? 'my' : 'all',
      search: typeof parsed.search === 'string' ? parsed.search : DEFAULTS.search,
      sort:
        parsed.sort === 'members' || parsed.sort === 'recent' || parsed.sort === 'alphabetical'
          ? parsed.sort
          : DEFAULTS.sort,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: SpacesControls = readFromStorage();

export function getSpacesControls(): SpacesControls {
  return current;
}

export function setSpacesControls(patch: Partial<SpacesControls>): void {
  const next: SpacesControls = {
    tab: patch.tab ?? current.tab,
    search: patch.search ?? current.search,
    sort: patch.sort ?? current.sort,
  };
  if (
    next.tab === current.tab &&
    next.search === current.search &&
    next.sort === current.sort
  ) {
    return;
  }
  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort — in-memory `current` still wins for the running session
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function useSpacesControls(): SpacesControls {
  const [state, setState] = useState<SpacesControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

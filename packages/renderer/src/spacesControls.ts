import { useEffect, useState } from 'react';

// Catalog-driven; PlacementRenderer resolves the sort against fc-space-card's default_props.sort_specs.
export type SpacesTab = string;
export type SpacesSort = string;

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
      tab: typeof parsed.tab === 'string' && parsed.tab.length > 0 ? parsed.tab : DEFAULTS.tab,
      search: typeof parsed.search === 'string' ? parsed.search : DEFAULTS.search,
      sort:
        typeof parsed.sort === 'string' && parsed.sort.length > 0 ? parsed.sort : DEFAULTS.sort,
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
    tab: typeof patch.tab === 'string' ? patch.tab : current.tab,
    search: patch.search ?? current.search,
    sort: typeof patch.sort === 'string' ? patch.sort : current.sort,
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
      // best-effort
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

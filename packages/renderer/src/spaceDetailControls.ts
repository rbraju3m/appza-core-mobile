import { useEffect, useState } from 'react';

// Space Detail screen controls — active sub-tab + topic filter + sort +
// currently-viewed space slug. Written by App-side action dispatchers
// (space_detail.set_subtab / .set_topic / .set_sort, plus a screen-mount
// setter for space_slug), read by PlacementRenderer to (a) evaluate
// state.space_detail_controls.* placement + child visible_when clauses,
// and (b) resolve state-bound DS query_params so fc-space-feeds refetches
// when topic_slug / sort change.
//
// Mirrors the spacesControls / feedControls event-backed store pattern —
// small enough to keep duplicated rather than abstract into a slice
// manager. localStorage persistence survives page reloads + Capacitor
// app restarts (WebView localStorage maps to Android app-scoped storage).

export type SpaceDetailControls = {
  active_subtab: string;
  topic_slug: string;
  sort: string;
  space_slug: string;
};

const STORAGE_KEY = 'appza.spaceDetailControls';
const EVENT = 'appza:space-detail-controls-change';

const DEFAULTS: SpaceDetailControls = {
  active_subtab: 'posts',
  topic_slug: '',
  sort: 'latest',
  space_slug: '',
};

function readFromStorage(): SpaceDetailControls {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SpaceDetailControls>;
    return {
      active_subtab:
        typeof parsed.active_subtab === 'string' && parsed.active_subtab.length > 0
          ? parsed.active_subtab
          : DEFAULTS.active_subtab,
      topic_slug: typeof parsed.topic_slug === 'string' ? parsed.topic_slug : DEFAULTS.topic_slug,
      sort:
        typeof parsed.sort === 'string' && parsed.sort.length > 0 ? parsed.sort : DEFAULTS.sort,
      space_slug:
        typeof parsed.space_slug === 'string' ? parsed.space_slug : DEFAULTS.space_slug,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: SpaceDetailControls = readFromStorage();

export function getSpaceDetailControls(): SpaceDetailControls {
  return current;
}

export function setSpaceDetailControls(patch: Partial<SpaceDetailControls>): void {
  const next: SpaceDetailControls = {
    active_subtab:
      typeof patch.active_subtab === 'string' ? patch.active_subtab : current.active_subtab,
    topic_slug: typeof patch.topic_slug === 'string' ? patch.topic_slug : current.topic_slug,
    sort: typeof patch.sort === 'string' ? patch.sort : current.sort,
    space_slug: typeof patch.space_slug === 'string' ? patch.space_slug : current.space_slug,
  };
  if (
    next.active_subtab === current.active_subtab &&
    next.topic_slug === current.topic_slug &&
    next.sort === current.sort &&
    next.space_slug === current.space_slug
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

export function useSpaceDetailControls(): SpaceDetailControls {
  const [state, setState] = useState<SpaceDetailControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

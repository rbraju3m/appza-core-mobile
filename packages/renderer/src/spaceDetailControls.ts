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
  // DOCUMENTS sub-tab (2026-08-16). `documents_search` is written by the
  // documents.set_search action and bound as a query param on the
  // fc-space-documents DS, so typing refetches server-side.
  documents_search: string;
  // Derived, NOT authored: PlacementRenderer publishes which of the three
  // documents designs the tab is currently in — 'list' | 'empty' (space has
  // no documents at all) | 'no-match' (search returned nothing) | 'loading'.
  // Placement visible_when clauses gate the search bar and the two empty
  // states off this single string, which is why it exists as state rather
  // than as local component state. Deliberately NOT persisted (see below).
  documents_view: string;
};

const STORAGE_KEY = 'appza.spaceDetailControls';
const EVENT = 'appza:space-detail-controls-change';

const DEFAULTS: SpaceDetailControls = {
  active_subtab: 'posts',
  topic_slug: '',
  sort: 'latest',
  space_slug: '',
  documents_search: '',
  documents_view: 'loading',
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
      // Also never restored: the search input is uncontrolled, so a restored
      // term would filter the list against a field that renders blank.
      documents_search: DEFAULTS.documents_search,
      // Never restored — it describes the *current* fetch, and a stale
      // 'list' would flash the search bar over an empty space on mount.
      documents_view: DEFAULTS.documents_view,
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
    documents_search:
      typeof patch.documents_search === 'string'
        ? patch.documents_search
        : current.documents_search,
    documents_view:
      typeof patch.documents_view === 'string' ? patch.documents_view : current.documents_view,
  };
  // Invariant: documents_view / documents_search describe the DOCUMENTS tab
  // of the CURRENT space only. Placement visible_when takes a single clause,
  // so the documents chrome gates on documents_view alone — without this
  // reset a stale 'list' would keep the search bar on screen after switching
  // to POSTS, or carry an empty space's view into the next space.
  if (next.active_subtab !== 'documents' || next.space_slug !== current.space_slug) {
    next.documents_view = 'loading';
    next.documents_search = '';
  }
  if (
    next.active_subtab === current.active_subtab &&
    next.topic_slug === current.topic_slug &&
    next.sort === current.sort &&
    next.space_slug === current.space_slug &&
    next.documents_search === current.documents_search &&
    next.documents_view === current.documents_view
  ) {
    return;
  }
  current = next;
  if (typeof window !== 'undefined') {
    try {
      // Both documents_* keys are per-visit, not preferences (see the type
      // comments) — persisting them would restore state the UI can't show.
      const { documents_view: _view, documents_search: _search, ...persisted } = next;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
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

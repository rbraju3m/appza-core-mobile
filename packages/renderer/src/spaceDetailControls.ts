import { useEffect, useState } from 'react';

export type SpaceDetailControls = {
  active_subtab: string;
  topic_slug: string;
  sort: string;
  space_slug: string;
  documents_search: string;
  // Derived by PlacementRenderer, not authored; never persisted.
  documents_view: string;
  media_type: string;
  media_view: string;
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
  media_type: '',
  media_view: 'loading',
};

const DEFAULT_MEDIA_TYPE = 'photos';

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
      // Not restored: the search input is uncontrolled, so a restored term would filter against a blank field.
      documents_search: DEFAULTS.documents_search,
      documents_view: DEFAULTS.documents_view,
      media_type: DEFAULTS.media_type,
      media_view: DEFAULTS.media_view,
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
    media_type: typeof patch.media_type === 'string' ? patch.media_type : current.media_type,
    media_view: typeof patch.media_view === 'string' ? patch.media_view : current.media_view,
  };
  // Reset per space/tab: a stale documents_view would keep the search bar up on POSTS.
  if (next.active_subtab !== 'documents' || next.space_slug !== current.space_slug) {
    next.documents_view = 'loading';
    next.documents_search = '';
  }
  // Blanking media_type off the tab keeps the photo grid (a single visible_when clause) off the POSTS feed.
  if (next.active_subtab !== 'media' || next.space_slug !== current.space_slug) {
    next.media_type = '';
    next.media_view = 'loading';
  }
  if (next.active_subtab === 'media' && next.media_type === '') {
    next.media_type = DEFAULT_MEDIA_TYPE;
  }
  if (
    next.active_subtab === current.active_subtab &&
    next.topic_slug === current.topic_slug &&
    next.sort === current.sort &&
    next.space_slug === current.space_slug &&
    next.documents_search === current.documents_search &&
    next.documents_view === current.documents_view &&
    next.media_type === current.media_type &&
    next.media_view === current.media_view
  ) {
    return;
  }
  current = next;
  if (typeof window !== 'undefined') {
    try {
      // documents_* and media_* are per-visit; persisting them would restore state the UI can't show.
      const {
        documents_view: _view,
        documents_search: _search,
        media_type: _mediaType,
        media_view: _mediaView,
        ...persisted
      } = next;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // best-effort
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

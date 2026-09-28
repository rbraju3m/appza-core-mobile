import { useEffect, useState } from 'react';

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

// Captured at boot: an absent entry and a stored `latest` read the same, and the seed writes later.
let hadStoredChoice = false;

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

// Only fields a persisting caller passed; a seed is not a choice and must not be persisted.
let persisted: Partial<FeedControls> = hadStoredChoice ? { ...current } : {};

export function getFeedControls(): FeedControls {
  return current;
}

let seeded = false;

function writeFeedControls(patch: Partial<FeedControls>, persist: boolean): void {
  const next: FeedControls = {
    sort: typeof patch.sort === 'string' && patch.sort ? patch.sort : current.sort,
    viewMode: patch.viewMode ?? current.viewMode,
  };
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
        // best-effort
      }
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function setFeedControls(patch: Partial<FeedControls>): void {
  writeFeedControls(patch, true);
}

// Deliberately not persisted, or the old admin default would outlive a change to it.
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
    // Re-read: the toolbar's seed may have fired before this listener subscribed.
    setState(current);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

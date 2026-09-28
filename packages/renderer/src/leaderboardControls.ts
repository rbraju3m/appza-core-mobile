import { useEffect, useState } from 'react';

export type LeaderboardControls = {
  // FluentCommunity Pro range keys; bound as `range`, so a tab tap refetches.
  range: string;
  // Trimmed server-side so rendered and fetched rows can never disagree.
  levels_scope: string;
  // Published after each levels fetch; VIEW ALL gates on it since placements can't gate on data.
  levels_view: string;
  ranks_view: string;
};

const STORAGE_KEY = 'appza.leaderboardControls';
const EVENT = 'appza:leaderboard-controls-change';

const DEFAULTS: LeaderboardControls = {
  range: '7_days',
  levels_scope: 'preview',
  levels_view: 'loading',
  ranks_view: 'loading',
};

function readFromStorage(): LeaderboardControls {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LeaderboardControls>;
    return {
      range:
        typeof parsed.range === 'string' && parsed.range.length > 0
          ? parsed.range
          : DEFAULTS.range,
      // Never restored: the levels card is one-way expandable.
      levels_scope: DEFAULTS.levels_scope,
      levels_view: DEFAULTS.levels_view,
      ranks_view: DEFAULTS.ranks_view,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: LeaderboardControls = readFromStorage();

export function getLeaderboardControls(): LeaderboardControls {
  return current;
}

export function setLeaderboardControls(patch: Partial<LeaderboardControls>): void {
  const next: LeaderboardControls = {
    range: typeof patch.range === 'string' ? patch.range : current.range,
    levels_scope:
      typeof patch.levels_scope === 'string' ? patch.levels_scope : current.levels_scope,
    levels_view: typeof patch.levels_view === 'string' ? patch.levels_view : current.levels_view,
    ranks_view: typeof patch.ranks_view === 'string' ? patch.ranks_view : current.ranks_view,
  };
  if (
    next.range === current.range &&
    next.levels_scope === current.levels_scope &&
    next.levels_view === current.levels_view &&
    next.ranks_view === current.ranks_view
  ) {
    return;
  }
  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ range: next.range }));
    } catch {
      // best-effort
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

// The levels card is one-way expandable, so a leftover 'all' would open with no way to collapse.
export function resetLeaderboardControls(): void {
  setLeaderboardControls({
    levels_scope: 'preview',
    levels_view: 'loading',
    ranks_view: 'loading',
  });
}

export function useLeaderboardControls(): LeaderboardControls {
  const [state, setState] = useState<LeaderboardControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

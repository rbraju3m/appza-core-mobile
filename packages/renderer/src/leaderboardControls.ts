import { useEffect, useState } from 'react';

// Leaderboard screen controls — which ranking range is showing, whether
// the levels card has been expanded, and the two derived verdict strings
// the gated placements read.
//
// Mirrors the spacesControls / spaceDetailControls / feedControls /
// chatControls event-backed store pattern. Small enough to keep
// duplicated rather than abstracted into a slice manager — this is the
// fifth of them and the shape has not drifted yet.

export type LeaderboardControls = {
  // Authored — the tab strip writes it, and fc-leaderboard-ranks binds it
  // as its `range` query param, so a tab tap refetches rather than
  // filtering three already-fetched boards client-side. Values are
  // FluentCommunity Pro's own range keys.
  range: string;
  // Authored — VIEW ALL writes 'all'. Bound as fc-leaderboard-levels'
  // `scope` param, so expanding is a refetch. Trimming server-side is
  // what stops the rows the card renders and the rows it fetched from
  // ever disagreeing.
  levels_scope: string;
  // Derived, NOT authored: PlacementRenderer publishes it after each
  // levels fetch. 'more' (there are levels beyond the ones showing) |
  // 'complete' (all of them are on screen) | 'empty' (no viewer, so no
  // card) | 'loading'.
  //
  // The VIEW ALL placement gates on this ONE string, and it has to,
  // because a placement can gate on state and never on data (P75). It
  // covers all three reasons the button should not be there: a guest,
  // an already-expanded card, and a community with three levels or
  // fewer that never had anything to expand.
  levels_view: string;
  // Derived, same contract: 'list' | 'empty' | 'loading'. Zero rows reads
  // two ways — nobody has scored in this range, and the viewer may not
  // see who has — and both land on the same empty state by design.
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
      // The one genuine preference here: which range you were last
      // looking at is worth remembering across visits.
      range:
        typeof parsed.range === 'string' && parsed.range.length > 0
          ? parsed.range
          : DEFAULTS.range,
      // Never restored. Design 1 is the landing state, and a restored
      // 'all' would open the screen on a nine-level card with no way to
      // collapse it — the button is one-way and would already be gone.
      levels_scope: DEFAULTS.levels_scope,
      // Neither verdict is restored: both describe the CURRENT fetch, and
      // a stale 'more' would flash VIEW ALL over a card that has not
      // loaded yet.
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
      // Only `range` is a preference; the rest are per-visit or describe
      // the current fetch (see the type comments).
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ range: next.range }));
    } catch {
      // best-effort — in-memory `current` still wins for the running session
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/**
 * Put the screen back in its landing state on mount.
 *
 * The levels card is one-way expandable, so leaving `levels_scope` at
 * 'all' from a previous visit would open the screen fully expanded with
 * no control to collapse it. Called by the shells when the Leaderboard
 * screen becomes active — the same job the space-detail setter does
 * inline when the space slug changes.
 */
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

import { useEffect, useState } from 'react';

// Whether a list has rows, published so a SIBLING placement can draw the
// empty state.
//
// The pattern (P75) is six screens old: an AppZet bound to a DataSource
// knows whether the fetch came back empty; the placement layer, which
// sees only state, does not. So the list publishes a verdict and the
// empty state gates on it.
//
// What is new here is that the AppZet says its own key rather than the
// renderer naming it. `documents_view`, `media_view`, `messages_view`,
// `levels_view`, `ranks_view` and `comments_view` are each a hand-written
// publisher in PlacementRenderer scoped to one DataSource slug, and the
// profile tabs plus the follow lists would have added five more copies of
// the same six lines. An AppZet that sets `empty_state_key` publishes
// here; one that does not is untouched — which is the objection those
// publishers were written around ("generalising it would put a write in
// every list AppZet's render path for one consumer") answered rather than
// ignored.
//
// The five existing publishers are deliberately NOT moved onto this. They
// work, they carry screen-specific nuance (documents distinguishes
// 'no-match' from 'empty'; the leaderboard's levels card has three
// reasons to be absent), and a mechanical retrofit belongs in its own
// change.
//
// ⚠ ONE PUBLISHER PER KEY. Two AppZets writing one key is P150 — the
// verdicts fight, React cuts the render off at its update-depth limit,
// and every placement gated on that key stays invisible in a way that
// reads exactly like a placement nobody seeded.

/** 'loading' until the first answer, then 'list' or 'empty'. */
export type ListVerdict = 'loading' | 'list' | 'empty';

const EVENT = 'appza:list-verdicts-change';

let current: Record<string, ListVerdict> = {};

export function getListVerdicts(): Record<string, ListVerdict> {
  return current;
}

export function getListVerdict(key: string): ListVerdict {
  return current[key] ?? 'loading';
}

/**
 * Publish one key's verdict. A no-op when it has not changed, so a list
 * re-rendering on every fetch tick does not wake every placement.
 */
export function setListVerdict(key: string, verdict: ListVerdict): void {
  if (!key) return;
  if (current[key] === verdict) return;
  current = { ...current, [key]: verdict };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

/**
 * Forget a key, on the unmount of the AppZet that owns it.
 *
 * This is what lets a gate name the verdict alone. The profile's three
 * tab bodies are placements, so a hidden tab is UNMOUNTED — dropping its
 * key means a stale 'empty' from the Spaces tab cannot paint an empty
 * state under Courses. The alternative was gating every empty state on
 * the tab as well, which works too, and both are used: the tab clause
 * makes the intent readable, this makes it correct while a tab is
 * mid-fetch.
 */
export function clearListVerdict(key: string): void {
  if (!key || !(key in current)) return;
  const next = { ...current };
  delete next[key];
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

export function useListVerdicts(): Record<string, ListVerdict> {
  const [state, setState] = useState<Record<string, ListVerdict>>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

import { useEffect, useState } from 'react';

// Whose profile is on screen, and which tab of it.
//
// One key does almost all the work: `member_id`. Both endpoints the
// profile needs take it —
//
//   /members/profile?member_id=N   the header (fcom-mobile resolves the
//                                  XProfile by user_id; `username` is the
//                                  only other accepted key)
//   /feeds?user_id=N               that member's posts. MEASURED: it is
//                                  the only param that narrows /feeds by
//                                  author. `author_id` and `username` are
//                                  ignored, and so is a key that does not
//                                  exist.
//
// — so the shell publishes one number and both data sources follow.
//
// Two screens ride the same Superstructure and differ only in where that
// number comes from: the bottom-nav `profile` publishes the VIEWER's id,
// and `profile-page-details` publishes the member row it was opened
// with. Neither screen has to know about the other.
//
// Session-only, deliberately. Which profile you were last looking at is
// not a preference, and persisting it would open the app on a stranger.

export type ProfileControls = {
  /** The user whose profile is being drawn. 0 = nobody yet. */
  member_id: number;
  /** Active tab slug. FluentCommunity's own profile navs name these. */
  tab: string;
};

const EVENT = 'appza:profile-controls-change';

const DEFAULTS: ProfileControls = {
  member_id: 0,
  tab: 'posts',
};

let current: ProfileControls = { ...DEFAULTS };

export function getProfileControls(): ProfileControls {
  return current;
}

export function setProfileControls(patch: Partial<ProfileControls>): void {
  const next: ProfileControls = {
    member_id:
      typeof patch.member_id === 'number' && Number.isFinite(patch.member_id)
        ? patch.member_id
        : current.member_id,
    tab: typeof patch.tab === 'string' && patch.tab ? patch.tab : current.tab,
  };
  if (next.member_id === current.member_id && next.tab === current.tab) return;
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/**
 * The `state.profile_controls.*` entries a DataSource query param or a
 * clause can read.
 *
 * `member_id` is published as a STRING because query params are strings
 * on the wire and an empty one is how `resolveQueryParams` decides to
 * omit a param entirely — which is what should happen before any profile
 * is chosen, rather than fetching `?member_id=0`.
 */
export function profileStateEntries(state: ProfileControls): Record<string, unknown> {
  return {
    'profile_controls.member_id': state.member_id > 0 ? String(state.member_id) : '',
    'profile_controls.tab': state.tab,
  };
}

export function useProfileControls(): ProfileControls {
  const [state, setState] = useState<ProfileControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    // Re-read once the listener is up — the shell publishes on screen
    // activation, which can land between this component's render and
    // this effect. The feed controls learned that the hard way in
    // chunk 5: the event fired into a subscriber that did not exist yet.
    setState(current);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

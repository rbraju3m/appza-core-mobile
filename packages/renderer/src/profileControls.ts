import { useEffect, useState } from 'react';

// Session-only: persisting it would reopen the app on a stranger's profile.

export type ProfileControls = {
  member_id: number;
  tab: string;
  follow_view: string;
  follow_search: string;
  // FluentCommunity's own keys: 'id' (Most Recent) or 'alphabetical'.
  follow_sort: string;
};

const EVENT = 'appza:profile-controls-change';

const DEFAULTS: ProfileControls = {
  member_id: 0,
  tab: 'posts',
  follow_view: 'followings',
  follow_search: '',
  follow_sort: 'id',
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
    follow_view:
      typeof patch.follow_view === 'string' && patch.follow_view
        ? patch.follow_view
        : current.follow_view,
    // Empty string is a real value: clearing the search must clear the param.
    follow_search:
      typeof patch.follow_search === 'string' ? patch.follow_search : current.follow_search,
    follow_sort:
      typeof patch.follow_sort === 'string' && patch.follow_sort
        ? patch.follow_sort
        : current.follow_sort,
  };
  if (
    next.member_id === current.member_id &&
    next.tab === current.tab &&
    next.follow_view === current.follow_view &&
    next.follow_search === current.follow_search &&
    next.follow_sort === current.follow_sort
  )
    return;
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

// member_id as a string: an empty param is omitted instead of fetching ?member_id=0.
export function profileStateEntries(state: ProfileControls): Record<string, unknown> {
  return {
    'profile_controls.member_id': state.member_id > 0 ? String(state.member_id) : '',
    'profile_controls.tab': state.tab,
    'profile_controls.follow_view': state.follow_view,
    'profile_controls.follow_search': state.follow_search,
    'profile_controls.follow_sort': state.follow_sort,
  };
}

export function useProfileControls(): ProfileControls {
  const [state, setState] = useState<ProfileControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    // Re-read: the shell may publish between render and this effect.
    setState(current);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

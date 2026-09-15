import { useEffect, useState } from 'react';
import { cancelDebouncedSearch } from './searchDebounce';

// All Members screen controls — which status tab is showing, the search
// string, and the two halves of the sort.
//
// Same event-backed shape as bookmarkControls next door. Every authored
// key here is bound as a query param by BOTH the directory and its
// summary row, so every write is a refetch: FluentCommunity searches,
// filters and sorts server-side, and the title's count is the count of
// what the list is showing.

export type MemberDirectoryStatus = 'active' | 'pending' | 'blocked' | 'deactivated';

export type MemberDirectoryControls = {
  // Authored — the tab strip writes it, and so does a confirmed status
  // change (designs 7, 8, 12: confirming moves you to the tab the member
  // went to). The plug-in route passes it on only for a community admin,
  // so a member who somehow holds 'pending' still gets active members.
  status: MemberDirectoryStatus;
  // Authored on every keystroke, through the debounce. The route ignores
  // a term shorter than three characters, as the portal does.
  search: string;
  // Authored — the sort sheet's two sections. FluentCommunity's own keys:
  // last_activity | display_name | created_at, and ASC | DESC.
  sort_by: string;
  sort_dir: string;
};

const STORAGE_KEY = 'appza.memberDirectoryControls';
const EVENT = 'appza:member-directory-controls-change';

const DEFAULTS: MemberDirectoryControls = {
  status: 'active',
  search: '',
  // The portal's default: Last Activity, newest first — design 2's two
  // checks.
  sort_by: 'last_activity',
  sort_dir: 'DESC',
};

function isStatus(v: unknown): v is MemberDirectoryStatus {
  return v === 'active' || v === 'pending' || v === 'blocked' || v === 'deactivated';
}

function readFromStorage(): MemberDirectoryControls {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<MemberDirectoryControls>;
    return {
      // Never restored — a visit opens on Active (design 5).
      status: DEFAULTS.status,
      search: DEFAULTS.search,
      // The sort is a preference, and the portal remembers it too
      // (uiStore.setListSort('members', …)).
      sort_by: typeof parsed.sort_by === 'string' && parsed.sort_by ? parsed.sort_by : DEFAULTS.sort_by,
      sort_dir: parsed.sort_dir === 'ASC' || parsed.sort_dir === 'DESC' ? parsed.sort_dir : DEFAULTS.sort_dir,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: MemberDirectoryControls = readFromStorage();

export function getMemberDirectoryControls(): MemberDirectoryControls {
  return current;
}

export function setMemberDirectoryControls(patch: Partial<MemberDirectoryControls>): void {
  const next: MemberDirectoryControls = {
    status: isStatus(patch.status) ? patch.status : current.status,
    // '' is the ⨯ clear, and must land.
    search: typeof patch.search === 'string' ? patch.search : current.search,
    sort_by: typeof patch.sort_by === 'string' && patch.sort_by ? patch.sort_by : current.sort_by,
    sort_dir: patch.sort_dir === 'ASC' || patch.sort_dir === 'DESC' ? patch.sort_dir : current.sort_dir,
  };
  if (
    next.status === current.status &&
    next.search === current.search &&
    next.sort_by === current.sort_by &&
    next.sort_dir === current.sort_dir
  ) {
    return;
  }
  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sort_by: next.sort_by, sort_dir: next.sort_dir }),
      );
    } catch {
      // best-effort — in-memory `current` still wins for the session
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/**
 * The landing state, called by the shells when the screen becomes active:
 * Active tab, empty search. The sort survives, as a preference should.
 */
export function resetMemberDirectoryControls(): void {
  // A keystroke still waiting out its debounce would otherwise land after
  // the reset and put the abandoned search back.
  cancelDebouncedSearch('members');
  setMemberDirectoryControls({ status: 'active', search: '' });
}

/** The `state.member_directory_controls.*` entries a gate or query param reads. */
export function memberDirectoryStateEntries(
  state: MemberDirectoryControls,
): Record<string, unknown> {
  return {
    'member_directory_controls.status': state.status,
    'member_directory_controls.search': state.search,
    'member_directory_controls.sort_by': state.sort_by,
    'member_directory_controls.sort_dir': state.sort_dir,
  };
}

export function useMemberDirectoryControls(): MemberDirectoryControls {
  const [state, setState] = useState<MemberDirectoryControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

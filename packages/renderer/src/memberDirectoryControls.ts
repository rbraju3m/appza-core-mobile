import { useEffect, useState } from 'react';
import { cancelDebouncedSearch } from './searchDebounce';

export type MemberDirectoryStatus = 'active' | 'pending' | 'blocked' | 'deactivated';

export type MemberDirectoryControls = {
  // The plug-in route honours it only for a community admin.
  status: MemberDirectoryStatus;
  // The route ignores a term shorter than three characters, as the portal does.
  search: string;
  sort_by: string;
  sort_dir: string;
};

const STORAGE_KEY = 'appza.memberDirectoryControls';
const EVENT = 'appza:member-directory-controls-change';

const DEFAULTS: MemberDirectoryControls = {
  status: 'active',
  search: '',
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
      status: DEFAULTS.status,
      search: DEFAULTS.search,
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
    // '' is the clear button, and must land.
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
      // best-effort
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function resetMemberDirectoryControls(): void {
  // A pending debounced keystroke would otherwise land after the reset.
  cancelDebouncedSearch('members');
  setMemberDirectoryControls({ status: 'active', search: '' });
}

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

import { useEffect, useState } from 'react';
import { getFcAccessSettings } from './fcRuntimeSettings';

// Not persisted: the localStorage auth record is the durable copy, and a second could disagree after a failed refresh.

export type ViewerState = {
  is_logged_in: boolean;
  user_id: number | null;
};

const EVENT = 'appza:viewer-change';

const DEFAULTS: ViewerState = {
  is_logged_in: false,
  user_id: null,
};

let current: ViewerState = DEFAULTS;

export function getViewer(): ViewerState {
  return current;
}

export function setViewer(patch: Partial<ViewerState>): void {
  const next: ViewerState = {
    is_logged_in: patch.is_logged_in ?? current.is_logged_in,
    user_id: patch.user_id !== undefined ? patch.user_id : current.user_id,
  };
  if (next.is_logged_in === current.is_logged_in && next.user_id === current.user_id) return;
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function useViewer(): ViewerState {
  const [state, setState] = useState<ViewerState>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

// `role_based` counts as no: a signed-out visitor can't hold the roles it names.
export function canBrowseAsGuest(): boolean {
  return getFcAccessSettings().access_level === 'public';
}

// `is_guest` means signed out AND permitted here, not just !is_logged_in.
export function viewerStateEntries(viewer: ViewerState): Record<string, unknown> {
  const guestAllowed = canBrowseAsGuest();
  return {
    'viewer.is_logged_in': viewer.is_logged_in,
    'viewer.user_id': viewer.user_id,
    'viewer.is_guest': !viewer.is_logged_in && guestAllowed,
    'viewer.guest_browsing_allowed': guestAllowed,
  };
}

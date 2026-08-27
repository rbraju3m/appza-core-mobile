import { useEffect, useState } from 'react';
import { getFcAccessSettings } from './fcRuntimeSettings';

// The VIEWER slice — who is looking, and what a signed-out one is
// allowed to reach.
//
// Deliberately separate from fcRuntimeSettings, which holds properties
// of the SITE and is hydrated once from the cached bootstrap envelope
// (P105). This slice changes on sign-in and sign-out, and every
// consumer has to re-render when it does.
//
// Written by the App shell, which owns the stored credentials; read by
// ScreenRenderer + PlacementRenderer so a placement or a child can gate
// on `state.viewer.is_logged_in` the way it gates on any other slice.
//
// NOT persisted. The auth record in localStorage is already the
// durable copy; a second one here could disagree with it after a failed
// refresh, and the disagreement would show as a signed-in-looking UI
// that cannot write.

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

/**
 * May a signed-OUT visitor read the community at all?
 *
 * Noor's rule for the guest arc: reachability follows the PORTAL, never
 * a list hardcoded here. FluentCommunity's `access.acess_level` is the
 * switch — `public` lets a guest read, `logged_in` and `role_based` do
 * not. `role_based` counts as no because the roles it names are roles a
 * signed-out visitor cannot hold.
 *
 * A signed-in viewer is never gated by this: they have passed whatever
 * the portal asked for by being signed in at all.
 */
export function canBrowseAsGuest(): boolean {
  return getFcAccessSettings().access_level === 'public';
}

/**
 * The flat entries both state bags register, so a placement and a child
 * describe the viewer with the same vocabulary. Two spellings for one
 * fact is how a clause ends up silently hiding a control (P104).
 *
 * `is_guest` is not merely `!is_logged_in`: it is the state a screen
 * actually branches on — signed out AND permitted to be here. On a
 * locked-down site nobody is a guest, because nobody signed out gets
 * this far.
 */
export function viewerStateEntries(viewer: ViewerState): Record<string, unknown> {
  const guestAllowed = canBrowseAsGuest();
  return {
    'viewer.is_logged_in': viewer.is_logged_in,
    'viewer.user_id': viewer.user_id,
    'viewer.is_guest': !viewer.is_logged_in && guestAllowed,
    'viewer.guest_browsing_allowed': guestAllowed,
  };
}

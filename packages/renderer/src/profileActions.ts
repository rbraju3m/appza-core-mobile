import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import type { ActionInvocation } from './actionContext';

/**
 * The profile header cluster's four follow actions — follow, unfollow,
 * and the two halves of the email-notification toggle.
 *
 * Shared between the Capacitor shell and the WP-admin simulator for the
 * same reason the post menu is: two dispatchers implementing one action
 * drift, and only one of them is ever the one being photographed.
 *
 * All four are the same request: POST an fcom-mobile route with the
 * profile's user id under `member_id`. What differs is the route and the
 * toast, both of which the catalog states.
 *
 * `user.notify_subscribe` and `user.notify_unsubscribe` name the SAME
 * route on purpose. FluentCommunity's notification endpoint is a genuine
 * toggle — it flips level 1 <-> 2 and reads no direction off the request
 * — so the direction is carried by which button was visible, and the
 * catalog gates those two against each other on `is_notifying`. This is
 * the opposite of the comment reaction (P140), whose name says toggle
 * and whose body must state a direction; the lesson is the same one,
 * which is that the name is not the contract.
 *
 * There is no optimistic update here. The cluster has no
 * `data-appza-item-id` wrapper for the feed's DOM-patching path to find
 * (P141), and the refetch is authoritative anyway: the write bumps the
 * viewer's preview-cache generation on the way out, so the refreshed
 * profile carries the new level rather than the cached old one.
 */

export type ProfileActionDeps = {
  /** Currently signed-in user (Basic Auth). Null when no session. */
  auth: StoredAuthLike | null;
  /** Basic-auth header builder — each shell owns its own to stay isolated. */
  authHeader: (auth: StoredAuthLike) => string;
  /** Red toast for failures. */
  onError: (msg: string) => void;
  /** Green/info toast for successful operations. */
  onInfo: (msg: string) => void;
};

const HANDLED = new Set([
  'user.follow',
  'user.unfollow',
  'user.notify_subscribe',
  'user.notify_unsubscribe',
]);

/**
 * Returns true when the action_slug is one of the four handled here and
 * has been dispatched. Callers should return early on `true`.
 */
export function tryHandleProfileAction(
  inv: ActionInvocation,
  deps: ProfileActionDeps,
): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root
    ? (readDataPath(item, binding_root) ?? item)
    : item;
  const { auth, authHeader, onError, onInfo } = deps;

  const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
  const method =
    typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
  const bodyKey =
    typeof argRec.body_key === 'string' && argRec.body_key
      ? argRec.body_key
      : 'member_id';
  const memberIdPath =
    typeof argRec.member_id_path === 'string' && argRec.member_id_path
      ? argRec.member_id_path
      : 'data.user_id';
  const toast =
    typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Updated';

  if (!endpoint) {
    onError(`${action_slug} is missing its endpoint.`);
    return true;
  }
  if (!auth) {
    onError('Please sign in.');
    return true;
  }

  const memberId = resolveMemberId(readDataPath(effectiveItem, memberIdPath));
  if (memberId === null) {
    onError('Could not identify whose profile this is.');
    return true;
  }

  void sendJson(endpoint, method, { [bodyKey]: memberId }, auth, authHeader).then(
    (result) => {
      if (result.ok) {
        onInfo(toast);
        dispatchRefresh();
      } else {
        // fcom-mobile forwards FluentCommunity's own sentence — "You are
        // not currently following this user", "You cannot follow/unfollow
        // a blocked user" — which says more than anything generic here
        // could.
        onError(result.error);
      }
    },
  );
  return true;
}

/** fcom-mobile takes an id or a username; a number is what we bind. */
function resolveMemberId(raw: unknown): number | string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return null;
}

function dispatchRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
}

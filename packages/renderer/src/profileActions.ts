import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import { getProfileControls } from './profileControls';
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

/**
 * The profile edit form's Save button.
 *
 * Shared for the same reason the follow actions are, and kept beside
 * them because it is the other half of one screen.
 *
 * The form's values are read out of the DOM by the shell — each shell
 * owns its own `readFormFieldValue`, so the collector arrives as a
 * dependency rather than being imported. That indirection is the whole
 * contract: `param_map` names `children[N].value` paths into the form's
 * Superstructure, and if those indices ever stop matching the SS the
 * collector returns '' for every field and the save writes empty
 * strings over real data. A contract test in the core pins them.
 *
 * `member_id` comes from the profile_controls slice — the same number
 * the screen's data source used to fetch the row being edited, so the
 * write always addresses the profile the form actually loaded.
 */
export type ProfileSaveDeps = ProfileActionDeps & {
  /** Reads `param_map` paths out of the named AppZet's rendered fields. */
  collect: (
    appzetSlug: string,
    paramMap: Record<string, unknown> | undefined,
  ) => Record<string, unknown>;
  /** Pop the screen after a successful save. */
  onSaved?: () => void;
};

export function tryHandleProfileSave(
  inv: ActionInvocation,
  deps: ProfileSaveDeps,
): boolean {
  if (inv.action_slug !== 'profile.save') return false;

  const argRec = (inv.args ?? {}) as Record<string, unknown>;
  const { auth, authHeader, onError, onInfo, collect, onSaved } = deps;

  const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
  const method =
    typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
  const formSlug =
    typeof argRec.form_appzet_slug === 'string' && argRec.form_appzet_slug
      ? argRec.form_appzet_slug
      : 'fc-basic-profile-information';
  const paramMap =
    argRec.param_map && typeof argRec.param_map === 'object'
      ? (argRec.param_map as Record<string, unknown>)
      : undefined;
  const successMessage =
    typeof argRec.success_message === 'string'
      ? argRec.success_message
      : 'Profile updated';
  const backOnSuccess = argRec.back_on_success !== false;

  if (!endpoint) {
    onError('profile.save is missing its endpoint.');
    return true;
  }
  if (!auth) {
    onError('Please sign in.');
    return true;
  }
  if (!paramMap) {
    onError('profile.save has no fields to send.');
    return true;
  }

  const memberId = getProfileControls().member_id;
  if (!memberId) {
    onError('Could not identify whose profile this is.');
    return true;
  }

  const body: Record<string, unknown> = {
    member_id: memberId,
    ...collect(formSlug, paramMap),
  };

  // No client-side required check on first_name. FluentCommunity
  // validates it and answers "First name is required", and a second copy
  // of that rule here would be a second thing to keep true — the server
  // is the one that decides whether the write happened.
  void sendJson(endpoint, method, body, auth, authHeader).then((result) => {
    if (result.ok) {
      onInfo(successMessage);
      dispatchRefresh();
      if (backOnSuccess) onSaved?.();
    } else {
      onError(result.error);
    }
  });
  return true;
}

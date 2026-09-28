import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import type { ActionInvocation } from './actionContext';
import { APPZA_REFRESH_EVENT } from './dataFetch';
import { getProfileControls } from './profileControls';
import { openMemberRemoveConfirm, closeMemberRemoveConfirm } from './MemberRemoveConfirm';

// Values are read back from the DOM, so nothing binds the password fields and no payload or store ever holds one.

export type ProfileAccountDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  collect: (slug: string, map: Record<string, unknown> | undefined) => Record<string, unknown>;
  dispatch: (inv: ActionInvocation) => void;
};

const HANDLED = new Set([
  'profile.change_username',
  'profile.change_password',
  'profile.deactivate_confirm',
  'profile.deactivate',
]);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function dispatchRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
}

// The fields live in the DOM, so they are cleared there after a successful change.
function clearFields(slug: string, map: Record<string, unknown> | undefined): void {
  if (typeof document === 'undefined' || !map) return;
  const root = document.querySelector(`[data-slug="${slug}"]`);
  if (!root) return;
  for (const path of Object.values(map)) {
    if (typeof path !== 'string') continue;
    const childPath = path.replace(/\.value$/, '');
    const host = root.querySelector(`[data-appza-primitive-path="${childPath}"]`);
    const input = host?.querySelector('input, textarea') as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (!input) continue;
    const proto =
      input.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export function tryHandleProfileAccountAction(
  inv: ActionInvocation,
  deps: ProfileAccountDeps,
): boolean {
  if (!HANDLED.has(inv.action_slug)) return false;

  const argRec = (inv.args ?? {}) as Record<string, unknown>;
  const method = (str(argRec.method) ?? 'POST').toUpperCase();

  if (inv.action_slug === 'profile.deactivate_confirm') {
    openMemberRemoveConfirm({
      subject: str(argRec.title) ?? 'Deactivate account?',
      message:
        str(argRec.message) ??
        'Your profile will be hidden from the community and you will be signed out. An administrator can reactivate it.',
      cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
      confirmLabel: str(argRec.confirm_label) ?? 'DEACTIVATE',
      busyLabel: str(argRec.busy_label) ?? 'Deactivating…',
      actionsLayout: 'material',
      // Destructive tone: unlike a cover removal, a member cannot undo this themselves.
      confirmTone: 'destructive',
      item: inv.item ?? null,
      removeActionSlug: str(argRec.confirm_action_slug) ?? 'profile.deactivate',
      removeArgs: {
        endpoint: str(argRec.endpoint) ?? '/wp-json/fcom-mobile/api/v1/members/deactivate',
        method,
        ...(str(argRec.toast_message) ? { toast_message: argRec.toast_message } : {}),
        ...(str(argRec.then_action_slug) ? { then_action_slug: argRec.then_action_slug } : {}),
      },
    });
    return true;
  }

  const endpoint = str(argRec.endpoint);
  if (!endpoint) {
    deps.onError(`${inv.action_slug} is missing its endpoint.`);
    return true;
  }
  if (!deps.auth) {
    deps.onError('Please sign in.');
    return true;
  }

  if (inv.action_slug === 'profile.deactivate') {
    // The route takes no member argument; it always acts on the caller's own account.
    void sendJson(endpoint, method, {}, deps.auth, deps.authHeader)
      .then((result) => {
        if (!result.ok) {
          deps.onError(result.error);
          return;
        }
        deps.onInfo(str(argRec.toast_message) ?? 'Your account has been deactivated');
        // Stay signed in and every next request fails the inactive-profile status check.
        const then = str(argRec.then_action_slug) ?? 'auth.logout';
        deps.dispatch({ action_slug: then, args: undefined, item: null });
      })
      .finally(() => closeMemberRemoveConfirm());
    return true;
  }

  const formSlug = str(argRec.form_appzet_slug);
  const paramMap =
    argRec.param_map && typeof argRec.param_map === 'object' && !Array.isArray(argRec.param_map)
      ? (argRec.param_map as Record<string, unknown>)
      : undefined;

  if (!formSlug || !paramMap) {
    deps.onError(`${inv.action_slug} has no fields to send.`);
    return true;
  }

  const collected = deps.collect(formSlug, paramMap);

  if (inv.action_slug === 'profile.change_password') {
    // Only the match is checked client-side; FluentCommunity validates the rest.
    const next = collected.new_password;
    const confirm = collected.confirm_password;
    if (typeof next === 'string' && typeof confirm === 'string' && next !== confirm) {
      deps.onError('The new passwords do not match.');
      return true;
    }
  }

  const body: Record<string, unknown> =
    inv.action_slug === 'profile.change_username'
      ? { member_id: getProfileControls().member_id, ...collected }
      : { ...collected };

  void sendJson(endpoint, method, body, deps.auth, deps.authHeader).then((result) => {
    if (!result.ok) {
      deps.onError(result.error);
      return;
    }
    deps.onInfo(str(argRec.success_message) ?? 'Saved');
    if (argRec.clear_on_success !== false && inv.action_slug === 'profile.change_password') {
      clearFields(formSlug, paramMap);
    }
    dispatchRefresh();
  });

  return true;
}

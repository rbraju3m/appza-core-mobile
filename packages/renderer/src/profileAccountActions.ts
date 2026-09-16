import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import type { ActionInvocation } from './actionContext';
import { APPZA_REFRESH_EVENT } from './dataFetch';
import { getProfileControls } from './profileControls';
import { openMemberRemoveConfirm, closeMemberRemoveConfirm } from './MemberRemoveConfirm';

/**
 * The edit form's three account cards — doc state 40.
 *
 * ---------------------------------------------------------------------
 * Three writes, not three sections of one
 * ---------------------------------------------------------------------
 *
 * FluentCommunity has one endpoint for the profile FIELDS, another for
 * the password, and a third state change for deactivation. Design 40
 * draws them as three cards with their own buttons for the same reason,
 * so each is its own action here rather than more keys on profile.save.
 *
 * The username goes through the SAME endpoint as the main Save — it is a
 * profile field — but has its own action because it has its own button,
 * and because FluentCommunity answers a taken or reserved username with a
 * message that belongs beside that button rather than at the top of the
 * form.
 *
 * ---------------------------------------------------------------------
 * Values come out of the DOM
 * ---------------------------------------------------------------------
 *
 * The same way profile.save collects them: this form seeds its inputs
 * from the payload and then the DOM owns them, so `collect` reads
 * `children[N].value` back. That couples the param_map to child indices,
 * which is why the catalog comments say a child must never be inserted
 * into the middle of this form.
 *
 * The password fields are the one case where that is a feature rather
 * than a compromise: nothing is bound to them, so no payload ever
 * carries a password and none is held in a store.
 */

export type ProfileAccountDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  /** Reads the named AppZet's fields out of the DOM. */
  collect: (slug: string, map: Record<string, unknown> | undefined) => Record<string, unknown>;
  /** Dispatches a follow-on action (auth.logout after a deactivation). */
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

/**
 * Empties the password fields after a successful change. They are read
 * from the DOM, so they are cleared there too — leaving a password the
 * member has already used sitting in three visible-to-the-DOM inputs is
 * the one thing this card must not do.
 */
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

/** Returns true when the action was one of these and has been handled. */
export function tryHandleProfileAccountAction(
  inv: ActionInvocation,
  deps: ProfileAccountDeps,
): boolean {
  if (!HANDLED.has(inv.action_slug)) return false;

  const argRec = (inv.args ?? {}) as Record<string, unknown>;
  const method = (str(argRec.method) ?? 'POST').toUpperCase();

  if (inv.action_slug === 'profile.deactivate_confirm') {
    // Design 40's button reads "Continue to Deactivate Account", which is
    // a button that expects to be asked something. Deactivating signs you
    // out and hides the profile, and only an administrator can undo it.
    openMemberRemoveConfirm({
      subject: str(argRec.title) ?? 'Deactivate account?',
      message:
        str(argRec.message) ??
        'Your profile will be hidden from the community and you will be signed out. An administrator can reactivate it.',
      cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
      confirmLabel: str(argRec.confirm_label) ?? 'DEACTIVATE',
      busyLabel: str(argRec.busy_label) ?? 'Deactivating…',
      actionsLayout: 'material',
      // The one destructive confirm in this arc that IS drawn destructive:
      // unlike removing a cover or signing out, a member cannot undo this
      // themselves.
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
    // The route takes NO member argument — it is always the caller's own
    // account, which is why there is nothing to spoof and nothing to
    // collect.
    void sendJson(endpoint, method, {}, deps.auth, deps.authHeader)
      .then((result) => {
        if (!result.ok) {
          deps.onError(result.error);
          return;
        }
        deps.onInfo(str(argRec.toast_message) ?? 'Your account has been deactivated');
        // The session belongs to a profile that is no longer active, so
        // staying signed in would mean every next request failing its
        // status check.
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
    // Checked here and NOT the rest: FluentCommunity validates that all
    // three are present and that the current one is right, and a second
    // copy of those rules would be a second thing to keep true. The match
    // is the exception — it is about what was typed on THIS screen, the
    // server's message for it is generic, and catching it here saves a
    // round trip that can only fail.
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
      // FluentCommunity's own sentences — "Community Username already
      // taken by someone else", "Username should be at least 3 characters
      // long", "Your current password is not correct" — say more than
      // anything here could.
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

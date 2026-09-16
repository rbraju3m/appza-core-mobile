import type { ActionInvocation } from './actionContext';
import { openMemberRemoveConfirm } from './MemberRemoveConfirm';

/**
 * Sign out, behind design 33's dialog.
 *
 * `auth.logout` itself is universal and both shells already handle it —
 * clearing the token, the post draft and the space cache, then landing on
 * the login screen. All this adds is the question in front of it, which
 * design 33 draws: a bold "Sign out?", one line under it, CANCEL and
 * SIGN OUT side by side in blue.
 *
 * It reuses the member-removal alert, which is a generic "ask, then
 * dispatch this action" dialog and has served the block, the member
 * removal, the status changes and the cover removal before this.
 *
 * NO SUBJECT PATH, unlike the member dialogs. Those name the person the
 * question is about; this one is about your own session, and design 33's
 * title is the whole question. So the title comes from the wiring rather
 * than from a row — which also means this action needs no data source and
 * works from an appbar that has no item bound to it.
 *
 * Lives in @appza/renderer rather than in either dispatcher because a
 * confirm implemented twice is a confirm that drifts, and only one of the
 * two is ever the one photographed (P86).
 */

export type LogoutConfirmDeps = {
  /** Where the confirmed action goes. Both shells already handle it. */
  defaultActionSlug?: string;
};

const HANDLED = 'auth.logout_confirm';

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** Returns true when the action was this one and has been handled. */
export function tryHandleLogoutConfirm(
  inv: ActionInvocation,
  deps: LogoutConfirmDeps = {},
): boolean {
  if (inv.action_slug !== HANDLED) return false;

  const argRec = (inv.args ?? {}) as Record<string, unknown>;

  openMemberRemoveConfirm({
    subject: str(argRec.title) ?? 'Sign out?',
    // Design 33 reads "…to post, chat, or se your notifications." The
    // missing E is a typo in the mock, not a house style.
    message:
      str(argRec.message) ??
      "You'll need to sign in again to post, chat, or see your notifications.",
    cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
    confirmLabel: str(argRec.confirm_label) ?? 'SIGN OUT',
    busyLabel: str(argRec.busy_label) ?? 'Signing out…',
    // Design 33 draws both buttons alike, in blue, right-aligned.
    actionsLayout: 'material',
    confirmTone: 'primary',
    // The dialog carries an item through to whatever it dispatches.
    // auth.logout reads nothing from it, but the alert's contract wants
    // one and passing the invocation's keeps the shape honest.
    item: inv.item ?? null,
    removeActionSlug:
      str(argRec.confirm_action_slug) ?? deps.defaultActionSlug ?? 'auth.logout',
  });

  return true;
}

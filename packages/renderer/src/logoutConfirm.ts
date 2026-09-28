import type { ActionInvocation } from './actionContext';
import { openMemberRemoveConfirm } from './MemberRemoveConfirm';

export type LogoutConfirmDeps = {
  defaultActionSlug?: string;
};

const HANDLED = 'auth.logout_confirm';

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function tryHandleLogoutConfirm(
  inv: ActionInvocation,
  deps: LogoutConfirmDeps = {},
): boolean {
  if (inv.action_slug !== HANDLED) return false;

  const argRec = (inv.args ?? {}) as Record<string, unknown>;

  openMemberRemoveConfirm({
    subject: str(argRec.title) ?? 'Sign out?',
    message:
      str(argRec.message) ??
      "You'll need to sign in again to post, chat, or see your notifications.",
    cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
    confirmLabel: str(argRec.confirm_label) ?? 'SIGN OUT',
    busyLabel: str(argRec.busy_label) ?? 'Signing out…',
    actionsLayout: 'material',
    confirmTone: 'primary',
    item: inv.item ?? null,
    removeActionSlug:
      str(argRec.confirm_action_slug) ?? deps.defaultActionSlug ?? 'auth.logout',
    removeArgs: str(argRec.endpoint) ? { endpoint: str(argRec.endpoint) } : undefined,
  });

  return true;
}

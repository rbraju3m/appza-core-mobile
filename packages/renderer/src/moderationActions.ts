import type { ActionInvocation } from './actionContext';
import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { setModerationControls, isModerationStatus } from './moderationControls';
import { closeMemberRemoveConfirm, openMemberRemoveConfirm } from './MemberRemoveConfirm';
import { announceModerationDone } from './ModerationReviewSheet';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';

/**
 * The Moderation screen's actions (doc states 7–32).
 *
 * Shared between the Capacitor shell and the WP-admin simulator, as every
 * handler in this package is: two dispatchers implementing one action
 * drift, and only one of them is ever the one photographed.
 *
 * ---------------------------------------------------------------------
 * The two writes ask first, in the doc's dialog
 * ---------------------------------------------------------------------
 *
 * `moderation.set_status` and `moderation.delete_report` arrive twice. The
 * first time — from a report's ⋯ sheet or the review modal's CTAs — they
 * open the alert every moderation design draws (10, 13, 14, 21, 22, 23): a
 * bold title, one sentence, CANCEL and the verb in blue. Its second button
 * dispatches the same action again with `confirmed`, and that one writes.
 * Every word is on the invocation, so the copy is catalog text.
 *
 * They used to ride the shells' post-delete confirm, whose red button no
 * moderation design draws.
 */

export type ModerationActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
};

const HANDLED = new Set(['moderation.set_tab', 'moderation.set_status', 'moderation.delete_report']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** Returns true when the action was one of these and has been handled. */
export function tryHandleModerationAction(
  inv: ActionInvocation,
  deps?: ModerationActionDeps,
): boolean {
  const { action_slug, args, item } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const itemRec = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;

  if (action_slug === 'moderation.set_tab') {
    // The tapped tab's value arrives on the args from some primitives and
    // on the item from others.
    const runtimeValue =
      typeof argRec.value === 'string'
        ? argRec.value
        : itemRec && typeof itemRec.value === 'string'
          ? itemRec.value
          : null;
    // A closed set: this value is sent to FluentCommunity as `status`.
    if (isModerationStatus(runtimeValue)) setModerationControls({ status: runtimeValue });
    return true;
  }

  const isDelete = action_slug === 'moderation.delete_report';
  const status = str(argRec.status);
  if (!isDelete && !isModerationStatus(status)) {
    deps?.onError('This moderation action has no status wired.');
    return true;
  }

  if (argRec.confirmed !== true) {
    const rest = { ...argRec };
    delete rest.confirmed;
    openMemberRemoveConfirm({
      subject: str(argRec.confirm_title) ?? (isDelete ? 'Delete Report' : 'Are you sure?'),
      message: str(argRec.confirm_message) ?? '',
      cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
      confirmLabel: str(argRec.confirm_cta) ?? (isDelete ? 'YES, DELETE' : 'YES'),
      busyLabel: str(argRec.busy_label) ?? 'Saving…',
      actionsLayout: 'material',
      confirmTone: 'primary',
      raised: true,
      item,
      removeActionSlug: action_slug,
      removeArgs: { ...rest, confirmed: true },
    });
    return true;
  }

  // The id is the REPORT's. A report row binds it as `data.id`, and the
  // review modal passes `{ id: reportId }` for the same path.
  const rawId = readDataPath(item, str(argRec.feed_id_path) ?? 'data.id');
  const reportId =
    typeof rawId === 'number'
      ? rawId
      : typeof rawId === 'string' && rawId !== '' && Number.isFinite(Number(rawId))
        ? Number(rawId)
        : null;
  const endpoint = str(argRec.endpoint);
  if (!endpoint || reportId === null) {
    deps?.onError('Could not identify which report to change.');
    closeMemberRemoveConfirm();
    return true;
  }
  if (!deps?.auth) {
    deps?.onError('Please sign in to moderate.');
    closeMemberRemoveConfirm();
    return true;
  }

  const method = (str(argRec.method) ?? (isDelete ? 'DELETE' : 'POST')).toUpperCase();
  // fcom-mobile reads report_id from the JSON body even on DELETE.
  const body: Record<string, unknown> = { [str(argRec.body_key) ?? 'report_id']: reportId };
  if (!isDelete) body.status = status;

  void sendJson(endpoint, method, body, deps.auth, deps.authHeader)
    .then((result) => {
      if (!result.ok) {
        deps.onError(result.error);
        return;
      }
      // The review modal closes on the write landing, not on the tap; and
      // the list refetches, so the report leaves the tab it was on.
      announceModerationDone();
      // Forced past the preview cache, as the shells' own confirm did: the
      // proxy may still hold this tab's pre-write page.
      if (typeof window !== 'undefined') {
        const g = window as unknown as { __appzaForceRefreshUntil?: number };
        g.__appzaForceRefreshUntil = Date.now() + 3000;
        window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
      }
    })
    .finally(() => {
      closeMemberRemoveConfirm();
    });
  return true;
}

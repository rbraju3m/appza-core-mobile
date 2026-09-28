import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import type { ActionInvocation } from './actionContext';
import { openMemberRemoveConfirm, closeMemberRemoveConfirm } from './MemberRemoveConfirm';

// fcom-mobile answers 200 with the outcome in response.status; sendJson reads it.

export type ScheduledPostActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  openSchedule: (sheetSlug: string, value: string, onConfirm: (value: string) => void) => void;
};

const CONFIRMS: Record<string, string> = {
  'scheduled.publish_confirm': 'scheduled.publish',
  'scheduled.delete_confirm': 'scheduled.delete',
};

const WRITES: Record<string, { method: string; toast: string }> = {
  'scheduled.reschedule': { method: 'PUT', toast: 'Post rescheduled' },
  'scheduled.publish': { method: 'PUT', toast: 'Post published' },
  'scheduled.delete': { method: 'POST', toast: 'Scheduled post deleted' },
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function tryHandleScheduledPostAction(
  inv: ActionInvocation,
  deps: ScheduledPostActionDeps,
): boolean {
  const { action_slug, args, item } = inv;
  const argRec = (args ?? {}) as Record<string, unknown>;

  if (action_slug in CONFIRMS) {
    openMemberRemoveConfirm({
      subject: str(argRec.title) ?? '',
      message: str(argRec.message),
      cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
      confirmLabel: str(argRec.confirm_label) ?? 'CONFIRM',
      busyLabel: str(argRec.busy_label),
      actionsLayout: 'material',
      confirmTone: 'primary',
      item,
      removeActionSlug: str(argRec.remove_action_slug) ?? CONFIRMS[action_slug],
      removeArgs: argRec,
    });
    return true;
  }

  const write = WRITES[action_slug];
  if (!write) return false;

  const { auth, authHeader, onError, onInfo } = deps;
  const finish = () => closeMemberRemoveConfirm();
  const endpoint = str(argRec.endpoint);
  if (!endpoint) {
    onError(`${action_slug} is missing its endpoint.`);
    finish();
    return true;
  }
  if (!auth) {
    onError('Please sign in.');
    finish();
    return true;
  }
  const feedId = num(readDataPath(item, str(argRec.feed_id_path) ?? 'data.id'));
  if (feedId === null) {
    onError('Could not identify which post this is.');
    finish();
    return true;
  }

  const method = (str(argRec.method) ?? write.method).toUpperCase();
  const toast = str(argRec.toast_message) ?? write.toast;

  const send = (body: Record<string, unknown>) =>
    void sendJson(endpoint, method, body, auth, authHeader).then((result) => {
      finish();
      if (result.ok) {
        onInfo(toast);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
      } else {
        onError(result.error);
      }
    });

  if (action_slug === 'scheduled.reschedule') {
    const current = readDataPath(item, str(argRec.scheduled_at_path) ?? 'data.scheduled_at');
    deps.openSchedule(
      str(argRec.sheet_appzet_slug) ?? 'fc-schedule-sheet',
      typeof current === 'string' ? current : '',
      (value) => send({ id: feedId, scheduled_at: value }),
    );
    return true;
  }

  // fcom-mobile's publish wrapper reads `id`; feeds/delete reads `feed_id`.
  send(action_slug === 'scheduled.publish' ? { id: feedId } : { feed_id: feedId });
  return true;
}

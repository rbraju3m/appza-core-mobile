import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import type { ActionInvocation } from './actionContext';
import { openMemberRemoveConfirm, closeMemberRemoveConfirm } from './MemberRemoveConfirm';

/**
 * The profile tabs' two destructive acts — doc states 57, 58 and 62, 63.
 *
 *   Spaces tab   ⋮ on a space → "Remove this member from the space?"
 *   Comments tab trash on a comment → "Delete comment?"
 *
 * Both dialogs are the Material alert designs 45 and 48 already use —
 * left-aligned title and question, CANCEL and the act as blue text — so
 * they open MemberRemoveConfirm rather than the post-delete dialog, which
 * is a different design.
 *
 * Every word arrives on the action's args. The TITLE of the space
 * dialog is read off the row: design 58 writes "Start Here", which is a
 * space name in the mock, over a card for a different space — so the
 * row's own title is what goes there.
 *
 * Both writes are fcom-mobile's wrappers, and both refresh the lists on
 * success, so the removed space or comment leaves the tab.
 */

export type ProfileTabActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
};

const CONFIRMS: Record<string, string> = {
  'profile.remove_from_space_confirm': 'profile.remove_from_space',
  'profile.delete_comment_confirm': 'profile.delete_comment',
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function tryHandleProfileTabAction(
  inv: ActionInvocation,
  deps: ProfileTabActionDeps,
): boolean {
  const { action_slug, args, item } = inv;
  const argRec = (args ?? {}) as Record<string, unknown>;

  if (action_slug in CONFIRMS) {
    const titlePath = str(argRec.title_path);
    const pathTitle = titlePath ? readDataPath(item, titlePath) : undefined;
    openMemberRemoveConfirm({
      subject: (typeof pathTitle === 'string' && pathTitle) || str(argRec.title) || '',
      message: str(argRec.message),
      cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
      confirmLabel: str(argRec.confirm_label) ?? 'REMOVE',
      busyLabel: str(argRec.busy_label),
      actionsLayout: 'material',
      confirmTone: 'primary',
      item,
      removeActionSlug: str(argRec.remove_action_slug) ?? CONFIRMS[action_slug],
    });
    return true;
  }

  if (action_slug !== 'profile.remove_from_space' && action_slug !== 'profile.delete_comment') {
    return false;
  }

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

  let body: Record<string, unknown>;
  if (action_slug === 'profile.remove_from_space') {
    const spaceSlug = readDataPath(item, str(argRec.space_slug_path) ?? 'data.slug');
    const userId = num(readDataPath(item, str(argRec.user_id_path) ?? 'data.profile_member_id'));
    if (typeof spaceSlug !== 'string' || !spaceSlug || userId === null) {
      onError('Could not identify the space or the member.');
      finish();
      return true;
    }
    body = { space_slug: spaceSlug, user_id: userId };
  } else {
    const commentId = num(readDataPath(item, str(argRec.comment_id_path) ?? 'data.id'));
    const feedId = num(readDataPath(item, str(argRec.feed_id_path) ?? 'data.post_id'));
    if (commentId === null || feedId === null) {
      onError('Could not identify which comment to delete.');
      finish();
      return true;
    }
    body = { comment_id: commentId, feed_id: feedId };
  }

  const method = (str(argRec.method) ?? 'POST').toUpperCase();
  const toast =
    str(argRec.toast_message) ??
    (action_slug === 'profile.remove_from_space' ? 'Member removed' : 'Comment deleted');

  void sendJson(endpoint, method, body, auth, authHeader).then((result) => {
    finish();
    if (result.ok) {
      onInfo(toast);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
    } else {
      onError(result.error);
    }
  });
  return true;
}

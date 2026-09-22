import type { ActionInvocation } from './actionContext';
import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { getPostDetailControls, setPostDetailControls } from './postDetailControls';
import { COMMENT_INLINE_REVERT_EVENT } from './CommentThread';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';

/**
 * Editing a comment IN PLACE — a lesson's discussion, design 25.
 *
 * `comment.edit_inline` (the ⋮ sheet's Edit comment) opens the box in the
 * row; `comment.save_inline` (its Save) writes FluentCommunity's comment
 * update. The doc's rules: the new text shows straight away, no message on
 * success, and a failure puts the old text back WITHOUT an error message —
 * so the thread shows the text optimistically and this reverts it.
 *
 * Post detail keeps its own edit, which re-targets the footer composer.
 */

export type CommentInlineActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
};

const HANDLED = new Set(['comment.edit_inline', 'comment.save_inline']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function tryHandleCommentInlineAction(inv: ActionInvocation, deps: CommentInlineActionDeps): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;
  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? (readDataPath(item, binding_root) ?? item) : item;
  const commentId = num(readDataPath(effectiveItem, str(argRec.id_path) ?? 'data.id'));

  if (action_slug === 'comment.edit_inline') {
    if (commentId !== null) setPostDetailControls({ inline_edit_id: String(commentId) });
    return true;
  }

  // comment.save_inline
  const revert = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(COMMENT_INLINE_REVERT_EVENT, { detail: { id: commentId } }));
    }
  };
  const endpoint = str(argRec.endpoint);
  const feedId =
    num(readDataPath(effectiveItem, str(argRec.feed_id_path) ?? 'data.post_id')) ??
    num(getPostDetailControls().post_id);
  const itemRec = effectiveItem && typeof effectiveItem === 'object' ? (effectiveItem as Record<string, unknown>) : null;
  const text = itemRec && typeof itemRec.edit_text === 'string' ? itemRec.edit_text : '';
  if (!endpoint || commentId === null || feedId === null || text === '' || !deps.auth) {
    revert();
    return true;
  }
  const body = {
    [str(argRec.feed_id_key) ?? 'feed_id']: feedId,
    [str(argRec.comment_id_key) ?? 'comment_id']: commentId,
    [str(argRec.message_key) ?? 'comment']: text,
  };
  void sendJson(endpoint, str(argRec.method)?.toUpperCase() ?? 'PUT', body, deps.auth, deps.authHeader).then((result) => {
    if (!result.ok) {
      revert();
      return;
    }
    if (typeof window !== 'undefined') {
      const g = window as unknown as { __appzaForceRefreshUntil?: number };
      g.__appzaForceRefreshUntil = Date.now() + 3000;
      window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
    }
  });
  return true;
}

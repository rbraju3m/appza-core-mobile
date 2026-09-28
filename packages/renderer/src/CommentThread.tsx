import { useEffect, useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import {
  getPostDetailControls,
  setPostDetailControls,
  usePostDetailControls,
} from './postDetailControls';
import type { ActionInvocation } from './actionContext';
import type { CommentEntry } from './CommentList';

// FC's getComments is fixed to created_at asc with no sort param, so sorting happens here over the whole array.

function str(o: Record<string, unknown> | undefined, k: string): string {
  const v = o?.[k];
  return typeof v === 'string' ? v : '';
}

function bool(o: Record<string, unknown> | undefined, k: string, dflt: boolean): boolean {
  const v = o?.[k];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  return dflt;
}

function num(o: Record<string, unknown> | undefined, k: string, dflt: number): number {
  const raw = o?.[k];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : dflt;
}

export type ThreadComment = CommentEntry & {
  children?: ThreadComment[];
  reply_count?: number;
  reply_count_label?: string;
  reply_to_name?: string;
  sort_time?: number;
  sort_likes?: number;
  sort_replies?: number;
  /** Grafted at render time: a reply's parent_id may point at another reply. */
  __root_id?: number | string;
};

function isPinned(c: ThreadComment): boolean {
  return c.is_sticky === 1 || c.is_sticky === true || c.is_sticky === '1';
}

function isLiked(c: ThreadComment): boolean {
  return c.liked === 1 || c.liked === true || c.liked === '1';
}

function readComments(o: Record<string, unknown> | undefined): ThreadComment[] {
  const raw = o?.comments;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is ThreadComment => !!c && typeof c === 'object' && !Array.isArray(c),
  );
}

/** Pinned stays first on every sort; FC un-sticks the others when one is pinned. */
function sortComments(rows: ThreadComment[], order: string): ThreadComment[] {
  const out = [...rows];
  if (order === 'latest') {
    out.sort((a, b) => (b.sort_time ?? 0) - (a.sort_time ?? 0));
  } else if (order === 'popular') {
    out.sort((a, b) => (b.sort_likes ?? 0) - (a.sort_likes ?? 0));
  } else if (order === 'most_replied') {
    out.sort((a, b) => (b.sort_replies ?? 0) - (a.sort_replies ?? 0));
  } else {
    out.sort((a, b) => (a.sort_time ?? 0) - (b.sort_time ?? 0));
  }
  out.sort((a, b) => (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0));
  return out;
}

export function AppzaCommentThread({
  overrides,
  action,
  dispatch,
}: {
  overrides?: Record<string, unknown>;
  action?: ActionInvocation;
  dispatch: (inv: ActionInvocation) => void;
}) {
  const comments = readComments(overrides);
  const controls = usePostDetailControls();

  // Likes live in local state: the post reaction path patches the DOM by data-appza-item-id, which comments lack.
  const [likeFlips, setLikeFlips] = useState<Record<string, boolean>>({});

  const [editText, setEditText] = useState('');
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const onRevert = (e: Event) => {
      const id = String((e as CustomEvent<{ id?: unknown }>).detail?.id ?? '');
      setTextOverrides((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };
    window.addEventListener(COMMENT_INLINE_REVERT_EVENT, onRevert);
    return () => window.removeEventListener(COMMENT_INLINE_REVERT_EVENT, onRevert);
  }, []);

  // Hooks before any early return.
  const ordered = useMemo(
    () => sortComments(comments, controls.comment_sort),
    [comments, controls.comment_sort],
  );

  // Keyed on the raw prop: readComments returns a new array each render and would loop forever.
  const rawComments = overrides?.comments;
  useEffect(() => {
    setLikeFlips((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setTextOverrides((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, [rawComments]);

  const inlineId = controls.inline_edit_id;
  useEffect(() => {
    if (!inlineId) return;
    const all = comments.flatMap((c) => [c, ...(Array.isArray(c.children) ? c.children : [])]);
    const hit = all.find((c) => String(c.id ?? '') === inlineId);
    const raw = hit as unknown as Record<string, unknown> | undefined;
    setEditText(
      typeof raw?.message === 'string'
        ? raw.message
        : stripTags(typeof hit?.message_rendered === 'string' ? hit.message_rendered : ''),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inlineId]);

  if (comments.length === 0) return null;

  const replyLabel = str(overrides, 'reply_label') || 'Reply';
  const likeIcon = resolveIcon(str(overrides, 'like_icon') || 'heart-outline');
  const likeIconOn = resolveIcon(str(overrides, 'like_icon_on') || 'heart');
  const menuIcon = resolveIcon(str(overrides, 'menu_icon') || 'ellipsis-vertical');
  const pinIcon = resolveIcon(str(overrides, 'pin_icon') || 'pin');
  const showMenu = bool(overrides, 'show_menu', true);
  const showLike = bool(overrides, 'show_like', true);
  const showReply = bool(overrides, 'show_reply', true);
  const showReplyCount = bool(overrides, 'show_reply_count', true);

  const replySlug = str(overrides, 'reply_action_slug') || 'comment.reply';
  const likeSlug = str(overrides, 'like_action_slug') || 'comment.like';
  const reviewSlug = str(overrides, 'review_action_slug') || 'moderation.review';
  const inlineSaveSlug = str(overrides, 'inline_save_action_slug') || 'comment.save_inline';
  const cancelLabel = str(overrides, 'edit_cancel_label') || 'Cancel';
  const saveLabel = str(overrides, 'edit_save_label') || 'Save';
  const collapsibleReplies = bool(overrides, 'collapsible_replies', false);

  const closeInline = () => setPostDetailControls({ inline_edit_id: '' });
  const saveInline = (comment: ThreadComment) => {
    const key = String(comment.id ?? '');
    const text = editText.trim();
    if (text === '') return;
    const raw = comment as unknown as Record<string, unknown>;
    const before = typeof raw.message === 'string' ? raw.message : stripTags(comment.message_rendered ?? '');
    closeInline();
    if (text === before.trim()) return;
    setTextOverrides((prev) => ({ ...prev, [key]: text }));
    dispatch({
      action_slug: inlineSaveSlug,
      args: readActionDefaultsFromCatalog(inlineSaveSlug) ?? undefined,
      item: { ...raw, edit_text: text },
    });
  };

  const showReviewChip = bool(overrides, 'show_review_chip', true);
  const showFlagBanner = bool(overrides, 'show_flag_banner', true);
  const reviewChipLabel = str(overrides, 'review_chip_label') || 'In Review';
  const reviewChipIcon = resolveIcon(str(overrides, 'review_chip_icon') || 'time-outline');
  const reviewButtonLabel = str(overrides, 'review_button_label') || 'Review';

  const bannerTextOf = (c: ThreadComment): string => {
    const v = c.meta && typeof c.meta === 'object' ? c.meta['moderation_banner_text'] : undefined;
    return typeof v === 'string' ? v : '';
  };
  const canReviewOf = (c: ThreadComment): boolean =>
    c.permissions?.['can_review_reports'] === true;

  const fire = (slug: string, comment: ThreadComment) => {
    if (!slug) return;
    dispatch({
      action_slug: slug,
      args: readActionDefaultsFromCatalog(slug) ?? undefined,
      item: comment as unknown as Record<string, unknown>,
    });
  };

  const fireReview = (comment: ThreadComment) => {
    dispatch({
      action_slug: reviewSlug,
      args: {
        ...(readActionDefaultsFromCatalog(reviewSlug) ?? {}),
        // FC Pro returns every report on the site for the wrong filter key; a comment filters by parent_id.
        content_type: 'comment',
        id_param: 'parent_id',
        id_path: 'data.id',
      },
      item: comment as unknown as Record<string, unknown>,
    });
  };

  const fireMenu = (comment: ThreadComment) => {
    if (!action) return;
    dispatch({ ...action, item: comment as unknown as Record<string, unknown> });
  };

  const fireReply = (comment: ThreadComment) => {
    // A reply to a reply targets its root, since the proxy flattens descendants onto it.
    const rootId = comment.__root_id ?? comment.id;
    dispatch({
      action_slug: replySlug,
      args: readActionDefaultsFromCatalog(replySlug) ?? undefined,
      item: {
        ...(comment as unknown as Record<string, unknown>),
        reply_parent_id: rootId,
      },
    });
  };

  const row = (c: ThreadComment, depth: number) => {
    const profile = c.xprofile ?? {};
    const key = String(c.id ?? '');
    const pinned = isPinned(c);
    const serverLiked = isLiked(c);
    const liked = likeFlips[key] ?? serverLiked;
    // The server count already includes the viewer's like when `liked` is set.
    const likes =
      num(c as unknown as Record<string, unknown>, 'reactions_count', 0) +
      (liked === serverLiked ? 0 : liked ? 1 : -1);
    const bannerText = bannerTextOf(c);
    const flagged = showFlagBanner && !!bannerText && canReviewOf(c);
    const inReview = showReviewChip && c.status === 'pending';
    const replyCount = num(c as unknown as Record<string, unknown>, 'reply_count', 0);
    const replying = controls.reply_to_id === key;

    return (
      <div
        className={depth > 0 ? 'appza-ct-entry appza-ct-entry-reply' : 'appza-ct-entry'}
        key={key}
      >
        {flagged && (
          <div className="appza-ct-flag">
            <span className="appza-ct-flag-text">{bannerText}</span>
            <button
              type="button"
              className="appza-ct-flag-btn"
              onClick={(e) => {
                e.stopPropagation();
                fireReview(c);
              }}
            >
              {reviewButtonLabel}
            </button>
          </div>
        )}
        {inReview && (
          <span className="appza-ct-review-chip">
            {reviewChipIcon && <IonIcon icon={reviewChipIcon} aria-hidden="true" />}
            {reviewChipLabel}
          </span>
        )}

        <div className={replying ? 'appza-ct-row appza-ct-row-replying' : 'appza-ct-row'}>
          {profile.avatar ? (
            <img className="appza-ct-avatar" src={profile.avatar} alt="" />
          ) : (
            <span className="appza-ct-avatar appza-ct-avatar-empty" />
          )}

          <div className="appza-ct-bubble">
            <span className="appza-ct-name">{profile.display_name ?? ''}</span>
            {pinned && pinIcon && (
              <IonIcon className="appza-ct-pin" icon={pinIcon} aria-label="Pinned comment" />
            )}
            {showMenu && menuIcon && (
              <button
                type="button"
                className="appza-ct-menu"
                aria-label="Comment options"
                onClick={(e) => {
                  e.stopPropagation();
                  fireMenu(c);
                }}
              >
                <IonIcon icon={menuIcon} />
              </button>
            )}
            <span className="appza-ct-time">{c.created_at ?? ''}</span>
            <div className="appza-ct-body">
              {depth > 0 && c.reply_to_name && (
                <span className="appza-ct-mention">{c.reply_to_name}</span>
              )}
              {inlineId === key ? null : key in textOverrides ? (
                <span>{textOverrides[key]}</span>
              ) : (
                <span
                  dangerouslySetInnerHTML={{ __html: c.message_rendered ?? '' }}
                />
              )}
            </div>
            {inlineId === key && (
              <div className="appza-ct-inline-edit" onClick={(e) => e.stopPropagation()}>
                <textarea
                  className="appza-ct-inline-input"
                  value={editText}
                  rows={2}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <div className="appza-ct-inline-actions">
                  <button type="button" className="appza-ct-inline-cancel" onClick={closeInline}>
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
                    className="appza-ct-inline-save"
                    disabled={editText.trim() === ''}
                    onClick={() => saveInline(c)}
                  >
                    {saveLabel}
                  </button>
                </div>
              </div>
            )}
          </div>

          <span className="appza-ct-foot">
            {showReply && (
              <button
                type="button"
                className="appza-ct-reply"
                onClick={(e) => {
                  e.stopPropagation();
                  fireReply(c);
                }}
              >
                {replyLabel}
              </button>
            )}
            {showLike && likeIcon && (
              <button
                type="button"
                className={liked ? 'appza-ct-like appza-ct-like-on' : 'appza-ct-like'}
                aria-label={liked ? 'Unlike this comment' : 'Like this comment'}
                aria-pressed={liked}
                onClick={(e) => {
                  e.stopPropagation();
                  setLikeFlips((prev) => ({ ...prev, [key]: !liked }));
                  fire(likeSlug, c);
                }}
              >
                <IonIcon icon={(liked && likeIconOn) || likeIcon} />
                {likes > 0 && <span className="appza-ct-like-count">({likes})</span>}
              </button>
            )}
            {showReplyCount && depth === 0 && replyCount > 0 && (
              collapsibleReplies ? (
                <button
                  type="button"
                  className="appza-ct-reply-count"
                  aria-expanded={!collapsed[key]}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
                  }}
                >
                  {c.reply_count_label ?? `${replyCount} Reply`}
                </button>
              ) : (
                <span className="appza-ct-reply-count">
                  {c.reply_count_label ?? `${replyCount} Reply`}
                </span>
              )
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="appza-comment-thread">
      {ordered.map((parent) => {
        const kids = Array.isArray(parent.children) ? parent.children : [];
        return (
          <div className="appza-ct-group" key={String(parent.id ?? '')}>
            {row(parent, 0)}
            {!(collapsibleReplies && collapsed[String(parent.id ?? '')]) &&
              kids.map((kid) => row({ ...kid, __root_id: parent.id }, 1))}
          </div>
        );
      })}
    </div>
  );
}

export const COMMENT_INLINE_REVERT_EVENT = 'appza:comment-inline-revert';

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').trim();
}

/** Exported because the component returns null on an empty thread, which is the verdict the empty state needs. */
export function publishCommentsView(view: 'list' | 'empty' | 'loading'): void {
  if (getPostDetailControls().comments_view === view) return;
  setPostDetailControls({ comments_view: view });
}

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

/**
 * The whole comment thread under a post (the 28 FeedPostDetails designs).
 *
 * NOT the inline strip. `AppzaCommentList` draws at most two comments
 * inside a feed card and links to this screen; this draws every comment,
 * one level of replies under each, and the affordances a thread has that
 * a preview of one does not — the reply count, the sort, the reply
 * target. They share the shape of a row and almost nothing else, so they
 * are two components rather than one with a mode flag.
 *
 * ONE child holding the entire array, like the strip, and for one reason
 * the strip did not have: this component has to REORDER its rows.
 * FluentCommunity's `getComments` is hardcoded to `created_at asc` and
 * accepts no sort parameter, so design 18's four orders cannot be a
 * refetch the way every other sort in this app is — they are applied
 * here, over rows this component holds all of. An AppZet that repeated
 * per comment would render in DataSource order and could never do it.
 *
 * Replies arrive already flattened to two levels by the preview proxy:
 * FluentCommunity nests arbitrarily deep (a reply to a reply to a
 * reply), its own portal draws two levels, and so do designs 13 and 21.
 * Each reply carries `reply_to_name` — the author of the comment it
 * answers — which is the blue name in front of its body and the only
 * thing that keeps a flattened list readable.
 *
 * Actions. A child carries one `on_click_action`, and a comment row
 * needs four (the ⋮ menu, reply, like, and Review on a flagged one). So
 * only the MENU rides the child's own invocation; the rest name their
 * action slugs as props and pull their args out of the catalog — the
 * same split the inline strip makes, for the same reason.
 */

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

/** A comment as this screen reads it — the strip's row plus the thread's own fields. */
export type ThreadComment = CommentEntry & {
  children?: ThreadComment[];
  reply_count?: number;
  reply_count_label?: string;
  reply_to_name?: string;
  sort_time?: number;
  sort_likes?: number;
  sort_replies?: number;
  /**
   * The top-level comment a reply hangs under. Grafted on at render
   * time, not sent by the server: a reply's own `parent_id` may point at
   * another reply (FluentCommunity nests without limit), and replying to
   * it has to answer the thread the reader can actually see.
   */
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

/**
 * Apply the picked order, then float the pinned comment.
 *
 * Pinned-first survives every sort on purpose: FluentCommunity's own
 * controller un-sticks every other comment when one is pinned, so this
 * can only ever move a single row, and a pinned comment that sorted back
 * into the middle would make the act of pinning look like it failed
 * (design 23). `sort` is stable in every engine this runs on, so equal
 * rows keep the order the previous step left them in.
 */
function sortComments(rows: ThreadComment[], order: string): ThreadComment[] {
  const out = [...rows];
  if (order === 'latest') {
    out.sort((a, b) => (b.sort_time ?? 0) - (a.sort_time ?? 0));
  } else if (order === 'popular') {
    out.sort((a, b) => (b.sort_likes ?? 0) - (a.sort_likes ?? 0));
  } else if (order === 'most_replied') {
    out.sort((a, b) => (b.sort_replies ?? 0) - (a.sort_replies ?? 0));
  } else {
    // 'oldest' — FluentCommunity's own default, and what the endpoint
    // already returns. Re-applied rather than assumed, because the rows
    // may have been reordered by a previous pick without a refetch.
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

  // The tap has to read as ON before the round-trip, and the post's
  // reaction path cannot be borrowed for it: that one patches the DOM by
  // `data-appza-item-id`, which addresses a POST (P141). A comment has no
  // such wrapper, so the toggle lives in React state keyed by comment id
  // and the next payload's `liked` takes over.
  const [likeFlips, setLikeFlips] = useState<Record<string, boolean>>({});

  // In-place edit (a lesson's discussion, design 25). `textOverrides` is
  // the saved text shown "straight away" before the refetch lands; a
  // failed save takes it back without a word (the doc's rule) through
  // COMMENT_INLINE_REVERT_EVENT.
  const [editText, setEditText] = useState('');
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});
  // Replies folded away by tapping "N Reply" (state 22), when the AppZet
  // makes the count a toggle. Open by default, as the designs draw them.
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

  // Hooks before any early return — an empty thread must call the same
  // hooks in the same order as a full one.
  const ordered = useMemo(
    () => sortComments(comments, controls.comment_sort),
    [comments, controls.comment_sort],
  );

  // A fresh payload is the server's answer and outranks the optimistic
  // flips taken against the previous one. Without this, un-liking and
  // re-liking across a refetch could leave a flip pinned against a
  // `liked` that now agrees with it, and the count would read one out.
  //
  // Keyed on the RAW prop, not `comments`: readComments filters, so it is
  // a new array on every render, and a reset keyed on it re-renders
  // forever ("Maximum update depth exceeded" on the lesson screen). The
  // setters also keep the old object when there is nothing to clear.
  const rawComments = overrides?.comments;
  useEffect(() => {
    setLikeFlips((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setTextOverrides((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, [rawComments]);

  // The box opens holding the comment's own text — `message`, not the
  // rendered HTML.
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
    // "Saving unchanged text just closes the box."
    if (text === before.trim()) return;
    setTextOverrides((prev) => ({ ...prev, [key]: text }));
    dispatch({
      action_slug: inlineSaveSlug,
      args: readActionDefaultsFromCatalog(inlineSaveSlug) ?? undefined,
      item: { ...raw, edit_text: text },
    });
  };

  // Moderation, designs 16 and 17 — the same two affordances the post
  // carries, at comment scale.
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
        // A COMMENT's reports are filtered by parent_id, a post's by
        // post_id, and FluentCommunity Pro does not error on the wrong
        // one — it returns every report on the site. The catalog's
        // default is the post's, so a comment has to say otherwise.
        content_type: 'comment',
        id_param: 'parent_id',
        id_path: 'data.id',
      },
      item: comment as unknown as Record<string, unknown>,
    });
  };

  const fireMenu = (comment: ThreadComment) => {
    // The MENU is the child's own action, so it arrives already resolved
    // with its item list and its gating. Re-point `item` at THIS comment —
    // the invocation the renderer built is scoped to the whole list.
    if (!action) return;
    dispatch({ ...action, item: comment as unknown as Record<string, unknown> });
  };

  const fireReply = (comment: ThreadComment) => {
    // Replying to a REPLY answers its parent thread, not the reply
    // itself: the proxy flattens every descendant onto its top-level
    // ancestor, so a parent_id pointing at a reply would produce a row
    // the next fetch draws at the same indent anyway. Sending the root
    // keeps what is stored and what is drawn the same thing.
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
    // Only ever off by the one tap this viewer made: the server count
    // already includes their like when `liked` is set.
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
              {/* The blue name in front of a reply's body. A separate
                  element rather than markup in the body: FluentCommunity
                  stores a reply's message as the bare text, with no
                  mention of who it answers anywhere in it. */}
              {depth > 0 && c.reply_to_name && (
                <span className="appza-ct-mention">{c.reply_to_name}</span>
              )}
              {inlineId === key ? null : key in textOverrides ? (
                <span>{textOverrides[key]}</span>
              ) : (
                <span
                  // Sanitized upstream by PreviewProxyController's wp_kses
                  // pass, the same one the post body goes through.
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

/** Fired by the inline save's handler when FluentCommunity refuses it. */
export const COMMENT_INLINE_REVERT_EVENT = 'appza:comment-inline-revert';

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').trim();
}

/**
 * Publish the thread's verdict for the sibling placements.
 *
 * Exported rather than done inside the component because the component
 * returns null on an empty thread — and "the thread is empty" is exactly
 * the verdict the empty-state placement needs. A publish that only ran
 * when there was something to draw could never say so. PlacementRenderer
 * calls this from the effect that watches the fetch.
 */
export function publishCommentsView(view: 'list' | 'empty' | 'loading'): void {
  if (getPostDetailControls().comments_view === view) return;
  setPostDetailControls({ comments_view: view });
}

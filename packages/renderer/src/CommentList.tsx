import { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import type { ActionInvocation } from './actionContext';

export type CommentEntry = {
  id?: number | string;
  post_id?: number | string;
  message_rendered?: string;
  created_at?: string;
  reactions_count?: number | string;
  is_sticky?: number | boolean | string;
  xprofile?: {
    display_name?: string;
    avatar?: string;
    user_id?: number;
  };
  permissions?: Record<string, unknown>;
  status?: string;
  meta?: Record<string, unknown> | null;
  /** FC sets this to 1 only when liked; absent means not liked. */
  liked?: number | boolean | string;
};

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

function count(o: Record<string, unknown> | undefined, k: string, dflt: number): number {
  const raw = o?.[k];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}

function readComments(o: Record<string, unknown> | undefined): CommentEntry[] {
  const raw = o?.comments;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is CommentEntry => !!c && typeof c === 'object' && !Array.isArray(c),
  );
}

function isPinned(c: CommentEntry): boolean {
  return c.is_sticky === 1 || c.is_sticky === true || c.is_sticky === '1';
}

function isLiked(c: CommentEntry): boolean {
  return c.liked === 1 || c.liked === true || c.liked === '1';
}

export function AppzaCommentList({
  overrides,
  action,
  dispatch,
}: {
  overrides?: Record<string, unknown>;
  action?: ActionInvocation;
  dispatch: (inv: ActionInvocation) => void;
}) {
  const comments = readComments(overrides);

  // Likes live in local state: a comment has no data-appza-item-id wrapper for the post reaction path.
  const [likeFlips, setLikeFlips] = useState<Record<string, boolean>>({});

  // Hooks first, then the early return.
  if (comments.length === 0) return null;

  const maxRows = count(overrides, 'max_rows', 2);
  const shown = comments.slice(0, maxRows);

  const total = count(overrides, 'total', comments.length);

  const replySlug = str(overrides, 'reply_action_slug') || 'comment.reply';
  const likeSlug = str(overrides, 'like_action_slug') || 'comment.like';

  const replyLabel = str(overrides, 'reply_label') || 'Reply';
  const likeIcon = resolveIcon(str(overrides, 'like_icon') || 'heart-outline');
  const likeIconOn = resolveIcon(str(overrides, 'like_icon_on') || 'heart');
  const menuIcon = resolveIcon(str(overrides, 'menu_icon') || 'ellipsis-vertical');
  const pinIcon = resolveIcon(str(overrides, 'pin_icon') || 'pin');
  const showMenu = bool(overrides, 'show_menu', true);
  const showLike = bool(overrides, 'show_like', true);
  const showReply = bool(overrides, 'show_reply', true);

  const viewAllTemplate = str(overrides, 'view_all_label') || 'View all {count} comments';
  const showViewAll = bool(overrides, 'show_view_all', true) && total > shown.length;

  const showReviewChip = bool(overrides, 'show_review_chip', true);
  const showFlagBanner = bool(overrides, 'show_flag_banner', true);
  const reviewChipLabel = str(overrides, 'review_chip_label') || 'In Review';
  const reviewChipIcon = resolveIcon(str(overrides, 'review_chip_icon') || 'time-outline');
  const reviewButtonLabel = str(overrides, 'review_button_label') || 'Review';
  const reviewSlug = str(overrides, 'review_action_slug') || 'moderation.review';

  const bannerTextOf = (c: CommentEntry): string => {
    const v = c.meta && typeof c.meta === 'object' ? c.meta['moderation_banner_text'] : undefined;
    return typeof v === 'string' ? v : '';
  };
  const canReviewOf = (c: CommentEntry): boolean =>
    c.permissions?.['can_review_reports'] === true;

  const fireReview = (comment: CommentEntry) => {
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

  const fire = (slug: string, comment: CommentEntry) => {
    if (!slug) return;
    dispatch({
      action_slug: slug,
      args: readActionDefaultsFromCatalog(slug) ?? undefined,
      item: comment as unknown as Record<string, unknown>,
    });
  };

  return (
    <div className="appza-comment-list">
      {shown.map((c, idx) => {
        const profile = c.xprofile ?? {};
        const pinned = isPinned(c);
        const key = String(c.id ?? idx);
        const serverLiked = isLiked(c);
        const liked = likeFlips[key] ?? serverLiked;
        // The server count already includes the viewer's like when `liked` is set.
        const likes =
          count(c as unknown as Record<string, unknown>, 'reactions_count', 0) +
          (liked === serverLiked ? 0 : liked ? 1 : -1);
        const bannerText = bannerTextOf(c);
        const flagged = showFlagBanner && !!bannerText && canReviewOf(c);
        const inReview = showReviewChip && c.status === 'pending';
        return (
          <div className="appza-comment-entry" key={c.id ?? idx}>
            {flagged && (
              <div className="appza-comment-flag">
                <span className="appza-comment-flag-text">{bannerText}</span>
                <button
                  type="button"
                  className="appza-comment-flag-btn"
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
              <span className="appza-comment-review-chip">
                {reviewChipIcon && <IonIcon icon={reviewChipIcon} aria-hidden="true" />}
                {reviewChipLabel}
              </span>
            )}
          <div className="appza-comment-row">
            {profile.avatar ? (
              <img className="appza-comment-avatar" src={profile.avatar} alt="" />
            ) : (
              <span className="appza-comment-avatar appza-comment-avatar-empty" />
            )}

            <span className="appza-comment-name">{profile.display_name ?? ''}</span>

            <span className="appza-comment-actions">
              {pinned && pinIcon && (
                <IonIcon className="appza-comment-pin" icon={pinIcon} aria-label="Pinned comment" />
              )}
              {showMenu && menuIcon && (
                <button
                  type="button"
                  className="appza-comment-menu"
                  aria-label="Comment options"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!action) return;
                    dispatch({
                      ...action,
                      item: c as unknown as Record<string, unknown>,
                    });
                  }}
                >
                  <IonIcon icon={menuIcon} />
                </button>
              )}
            </span>

            <span className="appza-comment-time">{c.created_at ?? ''}</span>

            <div
              className="appza-comment-body"
              dangerouslySetInnerHTML={{ __html: c.message_rendered ?? '' }}
            />

            <span className="appza-comment-foot">
              {showReply && (
                <button
                  type="button"
                  className="appza-comment-reply"
                  onClick={(e) => {
                    e.stopPropagation();
                    fire(replySlug, c);
                  }}
                >
                  {replyLabel}
                </button>
              )}
              {showLike && likeIcon && (
                <button
                  type="button"
                  className={
                    liked ? 'appza-comment-like appza-comment-like-on' : 'appza-comment-like'
                  }
                  aria-label={liked ? 'Unlike this comment' : 'Like this comment'}
                  aria-pressed={liked}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLikeFlips((prev) => ({ ...prev, [key]: !liked }));
                    fire(likeSlug, c);
                  }}
                >
                  <IonIcon icon={(liked && likeIconOn) || likeIcon} />
                  {likes > 0 && <span className="appza-comment-like-count">({likes})</span>}
                </button>
              )}
            </span>
          </div>
          </div>
        );
      })}

      {showViewAll && (
        <button
          type="button"
          className="appza-comment-view-all"
          onClick={(e) => {
            e.stopPropagation();
            const slug = str(overrides, 'view_all_action_slug') || 'post.open';
            dispatch({
              action_slug: slug,
              args: readActionDefaultsFromCatalog(slug) ?? undefined,
              // Scalars, not bare `data` (which resolves to undefined); post-detail looks up by route.post_slug.
              item: { id: overrides?.post_id, slug: overrides?.post_slug },
            });
          }}
        >
          {viewAllTemplate.replace('{count}', String(total))}
        </button>
      )}
    </div>
  );
}

import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import type { ActionInvocation } from './actionContext';

/**
 * The inline comment strip under a feed post (Noor's designs 19, 25, 26).
 *
 * ONE child holding the whole array, the way the card already takes files
 * (children[28]) and audio (children[29]) — not N children per comment.
 * Three reasons it has to be this shape:
 *
 *   - The card is a CSS grid with named areas. A second comment drawn as
 *     seven more children needs seven more area rows, and the grid has
 *     to grow again for the third. A list child needs one.
 *   - "The feed shows at most 2 comments" becomes a builder prop
 *     (`max_rows`) rather than a fact encoded in how many children exist.
 *   - The card's child indices stay stable, which every field_mapping and
 *     saved customization on it depends on.
 *
 * The legacy per-child comment block (children 18..27) is left in the
 * Superstructure and switched off by default rather than deleted — a
 * saved customization may address those indices, and removing them would
 * shift nothing but would make such a row point at a child that no longer
 * means what it did.
 *
 * Actions. A child carries one `on_click_action`, and a comment row needs
 * three (reply, like, the ⋮ menu). So only the MENU rides the child's own
 * invocation; reply and like name their action slugs as props and pull
 * their args out of the catalog, the same way the chat composer's discard
 * button does.
 */

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
  /** 'published' | 'pending' — 'pending' is design 33's In Review chip. */
  status?: string;
  /** Carries `moderation_banner_text`, derived in the proxy. */
  meta?: Record<string, unknown> | null;
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
  if (comments.length === 0) return null;

  // Settings → Customization has no switch for this; the designs say two.
  // A prop rather than a constant so the right panel can change it
  // without a release.
  const maxRows = count(overrides, 'max_rows', 2);
  const shown = comments.slice(0, maxRows);

  // `total` is the post's real comment count, which can exceed what the
  // API returned — the feed row carries only the first few. Falls back to
  // the array length so the link never claims more than it can open.
  const total = count(overrides, 'total', comments.length);

  const replySlug = str(overrides, 'reply_action_slug') || 'comment.reply';
  const likeSlug = str(overrides, 'like_action_slug') || 'comment.like';

  const replyLabel = str(overrides, 'reply_label') || 'Reply';
  const likeIcon = resolveIcon(str(overrides, 'like_icon') || 'heart-outline');
  const menuIcon = resolveIcon(str(overrides, 'menu_icon') || 'ellipsis-vertical');
  const pinIcon = resolveIcon(str(overrides, 'pin_icon') || 'pin');
  const showMenu = bool(overrides, 'show_menu', true);
  const showLike = bool(overrides, 'show_like', true);
  const showReply = bool(overrides, 'show_reply', true);

  // "View all 3 comments" — only once there is more than the strip shows.
  // Two comments on a post with two comments needs no link.
  const viewAllTemplate = str(overrides, 'view_all_label') || 'View all {count} comments';
  const showViewAll = bool(overrides, 'show_view_all', true) && total > shown.length;

  // ---- Moderation, designs 33 and 34 -------------------------------
  // The same two affordances the post card carries, on a comment. They
  // live here rather than as Superstructure children for the reason the
  // whole strip does: the card is a grid of named areas, and a per-
  // comment row cannot claim one.
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
        const likes = count(c as unknown as Record<string, unknown>, 'reactions_count', 0);
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
                    // The MENU is the child's own action, so it arrives
                    // already resolved with its item list and gating.
                    // Re-point `item` at THIS comment — the invocation the
                    // renderer built is scoped to the post.
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
              // Sanitized upstream by PreviewProxyController's wp_kses
              // pass, the same one the post body goes through.
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
                  className="appza-comment-like"
                  aria-label="Like this comment"
                  onClick={(e) => {
                    e.stopPropagation();
                    fire(likeSlug, c);
                  }}
                >
                  <IonIcon icon={likeIcon} />
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
            // Deliberately NOT stopping at the strip: this opens the post,
            // which is where the whole thread lives. The catalog wires it
            // through the card's own on_tap_view_more.
            const slug = str(overrides, 'view_all_action_slug') || 'post.open';
            dispatch({
              action_slug: slug,
              args: readActionDefaultsFromCatalog(slug) ?? undefined,
              // The POST's id, bound as a scalar. A field_mapping of
              // bare `data` resolves to nothing — mappings walk a PATH
              // under the row — so binding the whole object arrived
              // undefined and "View all" opened nothing.
              item: { id: overrides?.post_id },
            });
          }}
        >
          {viewAllTemplate.replace('{count}', String(total))}
        </button>
      )}
    </div>
  );
}

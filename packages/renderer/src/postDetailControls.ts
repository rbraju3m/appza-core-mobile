import { useEffect, useState } from 'react';

// Post-detail screen controls — which post is open, how its comment
// thread is ordered, which comment is being replied to, and what the
// footer composer holds.
//
// Written by the App-side dispatchers (post.open, comment.reply,
// comment.set_draft, comments.set_sort) and by the thread component
// itself, which publishes the two derived verdicts the sibling
// placements gate on.
//
// Mirrors chatControls: an event-backed store, small enough to keep
// duplicated rather than abstracted into a slice manager.
//
// NOT persisted, and for chatControls' reason. Every key here describes
// one visit to one post: a restored `post_id` would fetch a thread the
// reader is no longer looking at, and a restored reply target would
// attach the next comment to a comment the screen is not showing.

export type PostDetailControls = {
  /** The open post. Written by post.open alongside the route bag. */
  post_id: string;
  post_slug: string;
  /**
   * Which of FluentCommunity's four comment orders the thread is in.
   * The values are FC's own — `oldest` | `latest` | `popular` |
   * `most_replied` (Helper::getCommentOrderOptions) — rather than names
   * of ours, so the space setting that seeds it needs no translation.
   *
   * The sort is applied CLIENT-SIDE. FluentCommunity's getComments is
   * hardcoded to `created_at asc` and accepts no sort parameter at all,
   * so unlike every other sort in this app (feed, spaces, Saved Posts)
   * this one cannot be a refetch.
   */
  comment_sort: string;
  /**
   * Whether the reader has changed the order themselves. Until they
   * have, each post that opens re-seeds `comment_sort` from its own
   * space's "Default Comment Sort By" — and after they have, their
   * choice stands for the session. Without this flag the seed would
   * overwrite the pick on the next refetch of the same post.
   */
  comment_sort_touched: boolean;
  /**
   * Derived, NOT authored: the thread publishes 'list' | 'empty' |
   * 'loading' after each fetch, and the sort row and the empty state
   * gate on it. Same contract as documents_view / media_view /
   * messages_view, and it exists for the same reason — a placement can
   * read state but cannot count rows (P75).
   */
  comments_view: string;
  /**
   * Derived, NOT authored: 'yes' when the viewer may comment, 'signin'
   * when signing in would let them, 'no' when nothing would — a post
   * whose author has switched comments off. The two footer placements
   * gate on it, which is why it is a THREE-valued string and not a
   * boolean: "no composer because you are a guest" and "no composer
   * because this post takes none" draw differently (design 11 versus
   * nothing at all).
   *
   * Starts at 'no' so a screen that has not resolved a post yet never
   * offers a field that would fail on send.
   */
  can_comment: string;
  /** The comment being replied to. Empty string means a top-level comment. */
  reply_to_id: string;
  reply_to_name: string;
  /**
   * Composer text. Held here rather than in the DOM because other
   * actions write it — clearing after a send, prefilling when a comment
   * is edited — and an uncontrolled field cannot be written to from
   * outside (P139).
   */
  draft: string;
  /**
   * The comment being EDITED, when the 3-dot menu's "Edit comment" put
   * the composer into that mode. Distinct from reply_to_id: a reply
   * creates a comment, an edit replaces one, and the send handler has to
   * know which call to make.
   */
  editing_id: string;
  /** Images picked but not yet sent, as the URLs the upload returned. */
  attachments: string[];
  /** True while an attachment upload is in flight. */
  uploading: boolean;
};

const EVENT = 'appza:post-detail-controls-change';

const DEFAULTS: PostDetailControls = {
  post_id: '',
  post_slug: '',
  comment_sort: 'oldest',
  comment_sort_touched: false,
  comments_view: 'loading',
  can_comment: 'no',
  reply_to_id: '',
  reply_to_name: '',
  draft: '',
  editing_id: '',
  attachments: [],
  uploading: false,
};

let current: PostDetailControls = { ...DEFAULTS };

export function getPostDetailControls(): PostDetailControls {
  return current;
}

export function setPostDetailControls(patch: Partial<PostDetailControls>): void {
  const str = (k: keyof PostDetailControls): string => {
    const v = patch[k];
    return typeof v === 'string' ? v : (current[k] as string);
  };

  const next: PostDetailControls = {
    post_id: str('post_id'),
    post_slug: str('post_slug'),
    comment_sort: str('comment_sort'),
    comment_sort_touched:
      typeof patch.comment_sort_touched === 'boolean'
        ? patch.comment_sort_touched
        : current.comment_sort_touched,
    comments_view: str('comments_view'),
    can_comment: str('can_comment'),
    reply_to_id: str('reply_to_id'),
    reply_to_name: str('reply_to_name'),
    draft: str('draft'),
    editing_id: str('editing_id'),
    attachments: Array.isArray(patch.attachments) ? patch.attachments : current.attachments,
    uploading: typeof patch.uploading === 'boolean' ? patch.uploading : current.uploading,
  };

  // Opening a DIFFERENT post resets everything that described the last
  // one. Without this a reply target survives the switch and the next
  // comment is posted as a reply to a comment on another post — the same
  // invariant chatControls enforces when the thread changes, and for the
  // same reason: the state outlives the screen that produced it.
  //
  // `comment_sort_touched` resets too, so each post opens in ITS space's
  // default order rather than in the order the previous post happened to
  // be left in.
  const switched = next.post_slug !== current.post_slug || next.post_id !== current.post_id;
  if (switched) {
    // `comments_view` is deliberately NOT reset here, though every
    // instinct says it should be.
    //
    // Two publishers write this slice — the post's fetch and the
    // thread's — and resetting the thread's verdict from the post's
    // publish makes them fight: the thread says 'list', the post
    // resolves and knocks it back to 'loading', the thread says 'list'
    // again, and React cuts the render off at its update-depth limit
    // with the sort row and the empty state both permanently invisible.
    //
    // Nothing is lost by leaving it: a changed post changes the comment
    // DataSource's params, which makes its answer `stale`, and the
    // thread's own publisher already reports 'loading' for exactly that.
    // The verdict about the new post therefore comes from the fetch that
    // knows about it, rather than from a guess made here.
    next.can_comment = typeof patch.can_comment === 'string' ? patch.can_comment : 'no';
    next.comment_sort_touched =
      typeof patch.comment_sort_touched === 'boolean' ? patch.comment_sort_touched : false;
    next.reply_to_id = '';
    next.reply_to_name = '';
    next.draft = '';
    next.editing_id = '';
    next.attachments = [];
    next.uploading = false;
  }

  const same =
    next.post_id === current.post_id &&
    next.post_slug === current.post_slug &&
    next.comment_sort === current.comment_sort &&
    next.comment_sort_touched === current.comment_sort_touched &&
    next.comments_view === current.comments_view &&
    next.can_comment === current.can_comment &&
    next.reply_to_id === current.reply_to_id &&
    next.reply_to_name === current.reply_to_name &&
    next.draft === current.draft &&
    next.editing_id === current.editing_id &&
    next.attachments === current.attachments &&
    next.uploading === current.uploading;
  if (same) return;

  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/** Stop replying / editing without discarding what has been typed. */
export function clearCommentReply(): void {
  setPostDetailControls({ reply_to_id: '', reply_to_name: '', editing_id: '' });
}

export function usePostDetailControls(): PostDetailControls {
  const [state, setState] = useState<PostDetailControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

/**
 * The four orders, as FluentCommunity names them, with the labels the
 * designs use for each.
 *
 * FC's own words are "Earliest / Latest / Popular / Most Replied"
 * (Helper::getCommentOrderOptions); design 18 writes them as "Earliest
 * first / Newest first / Top-most liked / Most replied". The designs
 * win, which is the standing rule — the KEYS stay FC's so the space
 * setting drops straight in.
 */
export const COMMENT_SORT_LABELS: Record<string, string> = {
  oldest: 'Earliest first',
  latest: 'Newest first',
  popular: 'Top-most liked',
  most_replied: 'Most replied',
};

export function commentSortLabel(value: string): string {
  return COMMENT_SORT_LABELS[value] ?? 'Earliest first';
}

/**
 * Normalise whatever the space setting holds into one of the four keys.
 *
 * FluentCommunity stores '' for "never configured", which is its own
 * "Earliest" — so an empty string is a value here, not a missing one,
 * and must not fall through to whatever the previous post was sorted by.
 */
export function normalizeCommentSort(value: unknown): string {
  return typeof value === 'string' && value in COMMENT_SORT_LABELS ? value : 'oldest';
}

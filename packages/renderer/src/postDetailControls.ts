import { useEffect, useState } from 'react';

// Not persisted: every key describes one visit to one post.

export type PostDetailControls = {
  post_id: string;
  post_slug: string;
  // FC's own keys. Sorted client-side: FC getComments is hardcoded to created_at asc.
  comment_sort: string;
  // Until set, each opened post re-seeds comment_sort from its space's default.
  comment_sort_touched: boolean;
  // Derived by the thread: 'list' | 'empty' | 'loading'.
  comments_view: string;
  // Derived: 'yes' | 'signin' | 'no' — guest and comments-off draw differently.
  can_comment: string;
  reply_to_id: string;
  reply_to_name: string;
  // Held here, not in the DOM, so a send or an edit can write it.
  draft: string;
  // Footer composer edit mode; inline_edit_id is the in-place editor (lesson discussion).
  editing_id: string;
  inline_edit_id: string;
  attachments: string[];
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
  inline_edit_id: '',
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
    inline_edit_id: str('inline_edit_id'),
    attachments: Array.isArray(patch.attachments) ? patch.attachments : current.attachments,
    uploading: typeof patch.uploading === 'boolean' ? patch.uploading : current.uploading,
  };

  // A different post resets the last one's reply target, draft and sort choice.
  const switched = next.post_slug !== current.post_slug || next.post_id !== current.post_id;
  if (switched) {
    // comments_view is NOT reset: the post's and the thread's publishers would
    // fight and hit React's update-depth limit; the thread reports 'loading' itself.
    next.can_comment = typeof patch.can_comment === 'string' ? patch.can_comment : 'no';
    next.comment_sort_touched =
      typeof patch.comment_sort_touched === 'boolean' ? patch.comment_sort_touched : false;
    next.reply_to_id = '';
    next.reply_to_name = '';
    next.inline_edit_id = '';
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
    next.inline_edit_id === current.inline_edit_id &&
    next.attachments === current.attachments &&
    next.uploading === current.uploading;
  if (same) return;

  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

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

// Keys are FC's; labels follow the designs.
export const COMMENT_SORT_LABELS: Record<string, string> = {
  oldest: 'Earliest first',
  latest: 'Newest first',
  popular: 'Top-most liked',
  most_replied: 'Most replied',
};

export function commentSortLabel(value: string): string {
  return COMMENT_SORT_LABELS[value] ?? 'Earliest first';
}

// FC stores '' for never-configured, which means oldest.
export function normalizeCommentSort(value: unknown): string {
  return typeof value === 'string' && value in COMMENT_SORT_LABELS ? value : 'oldest';
}

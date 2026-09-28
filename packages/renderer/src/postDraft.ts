import { useEffect, useState } from 'react';

import { getFcComposerSettings } from './fcRuntimeSettings';
import { getDocumentDraft } from './documentDraft';

// Not persisted: a restored draft would post into a space the user has moved on from.

export type PostDraftTopic = {
  id: string;
  title: string;
  slug: string;
};

export type PostDraftImage = {
  url: string;
  media_id?: string;
};

// FC allows one video per post, exclusive with images.
export type PostDraftVideo = {
  kind: 'oembed' | 'html' | 'upload';
  url?: string;
  html?: string;
  image?: string;
  provider?: string;
  title?: string;
  media_id?: string;
  media_url?: string;
};

export type PostDraftAudio = {
  media_id: string;
  url: string;
  title: string;
};

// `slug` marks an existing option: FC refuses an edit that drops or blanks one (votes are keyed on it).
export type PostDraftPollOption = {
  label: string;
  slug?: string;
};

// Not exclusive with other media: only a survey sets content_type, images/video live in meta.
export type PostDraftPoll = {
  type: 'single_choice' | 'multi_choice';
  options: PostDraftPollOption[];
  // Site wall-clock 'YYYY-MM-DD HH:MM:SS', or '' for never closes.
  end_date: string;
};

// Rename/delete take `id`; FC matches `document_ids` by `media_key`.
export type PostDraftDocument = {
  id: string;
  media_key: string;
  title: string;
  url: string;
  type: string;
};

export type PostDraftTarget = '' | 'space' | 'profile';

// Separate from `target`, which keeps showing where the post IS. 'current' = ticked but nothing picked: Save sends no move.
export type PostDraftMoveTarget = '' | 'current' | 'space' | 'profile';

export type PostDraft = {
  // null when composing; cleared by resetPostDraft on entry to both composer screens.
  edit_feed_id: number | null;

  // From the post's permissions bag (FC's server rule), not the portal's looser checkbox.
  can_move_space: boolean;
  move_target: PostDraftMoveTarget;
  // FC space id, what `new_space_id` wants.
  move_space_id: string;
  move_space_title: string;
  move_space_logo: string;
  move_space_emoji: string;

  target: PostDraftTarget;
  space_slug: string;
  space_title: string;
  space_logo: string;
  space_emoji: string;
  space_privacy: string;
  // FC allows announce for a moderator globally OR of this space.
  space_can_announce: boolean;
  space_can_upload_documents: boolean;
  topic_required: boolean;

  viewer_is_moderator: boolean;

  title: string;
  body: string;

  topics: PostDraftTopic[];
  topic_ids: string[];

  announcement: boolean;

  // Capped at Max Media Per Post; FC silently slices an over-long list server-side.
  images: PostDraftImage[];

  // Exclusive with images: FC stores a single content_type.
  video: PostDraftVideo | null;

  // Not exclusive: meta.audio_medias is independent of content_type.
  audios: PostDraftAudio[];

  poll: PostDraftPoll | null;

  // Exclusive with everything: FC's document handling sets content_type last and the rest is lost.
  documents: PostDraftDocument[];

  // '' = now. FC Pro silently ignores it for non-moderators, which is why the control is gated.
  scheduled_at: string;
};

const EVENT = 'appza:post-draft-change';

const DEFAULTS: PostDraft = {
  edit_feed_id: null,
  can_move_space: false,
  move_target: '',
  move_space_id: '',
  move_space_title: '',
  move_space_logo: '',
  move_space_emoji: '',
  target: '',
  space_slug: '',
  space_title: '',
  space_logo: '',
  space_emoji: '',
  space_privacy: '',
  space_can_announce: false,
  space_can_upload_documents: false,
  topic_required: false,
  viewer_is_moderator: false,
  title: '',
  body: '',
  topics: [],
  topic_ids: [],
  announcement: false,
  images: [],
  video: null,
  audios: [],
  poll: null,
  documents: [],
  scheduled_at: '',
};

let current: PostDraft = { ...DEFAULTS };

export function getPostDraft(): PostDraft {
  return current;
}

function str(patch: Partial<PostDraft>, key: keyof PostDraft, fallback: string): string {
  const v = patch[key];
  return typeof v === 'string' ? v : fallback;
}

function bool(patch: Partial<PostDraft>, key: keyof PostDraft, fallback: boolean): boolean {
  const v = patch[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function setPostDraft(patch: Partial<PostDraft>): void {
  const next: PostDraft = {
    edit_feed_id:
      patch.edit_feed_id !== undefined ? patch.edit_feed_id : current.edit_feed_id,
    can_move_space: bool(patch, 'can_move_space', current.can_move_space),
    move_target: (typeof patch.move_target === 'string'
      ? patch.move_target
      : current.move_target) as PostDraftMoveTarget,
    move_space_id: str(patch, 'move_space_id', current.move_space_id),
    move_space_title: str(patch, 'move_space_title', current.move_space_title),
    move_space_logo: str(patch, 'move_space_logo', current.move_space_logo),
    move_space_emoji: str(patch, 'move_space_emoji', current.move_space_emoji),
    target: (typeof patch.target === 'string' ? patch.target : current.target) as PostDraftTarget,
    space_slug: str(patch, 'space_slug', current.space_slug),
    space_title: str(patch, 'space_title', current.space_title),
    space_logo: str(patch, 'space_logo', current.space_logo),
    space_emoji: str(patch, 'space_emoji', current.space_emoji),
    space_privacy: str(patch, 'space_privacy', current.space_privacy),
    space_can_announce: bool(patch, 'space_can_announce', current.space_can_announce),
    space_can_upload_documents: bool(
      patch,
      'space_can_upload_documents',
      current.space_can_upload_documents,
    ),
    topic_required: bool(patch, 'topic_required', current.topic_required),
    viewer_is_moderator: bool(patch, 'viewer_is_moderator', current.viewer_is_moderator),
    title: str(patch, 'title', current.title),
    body: str(patch, 'body', current.body),
    topics: Array.isArray(patch.topics) ? patch.topics : current.topics,
    topic_ids: Array.isArray(patch.topic_ids) ? patch.topic_ids : current.topic_ids,
    announcement: bool(patch, 'announcement', current.announcement),
    images: Array.isArray(patch.images) ? patch.images : current.images,
    video: patch.video !== undefined ? patch.video : current.video,
    audios: Array.isArray(patch.audios) ? patch.audios : current.audios,
    poll: patch.poll !== undefined ? patch.poll : current.poll,
    documents: Array.isArray(patch.documents) ? patch.documents : current.documents,
    scheduled_at: str(patch, 'scheduled_at', current.scheduled_at),
  };

  // Documents take the whole post; the attach bar normally prevents reaching this.
  if (Array.isArray(patch.documents) && patch.documents.length > 0) {
    next.images = [];
    next.video = null;
    next.audios = [];
    next.poll = null;
  } else if (
    next.documents.length > 0 &&
    ((Array.isArray(patch.images) && patch.images.length > 0) ||
      (patch.video != null) ||
      (Array.isArray(patch.audios) && patch.audios.length > 0) ||
      (patch.poll != null))
  ) {
    next.documents = [];
  }

  // Video and images are exclusive: one content_type per post.
  if (patch.video != null && next.images.length > 0 && !Array.isArray(patch.images)) {
    next.images = [];
  }
  if (Array.isArray(patch.images) && patch.images.length > 0 && patch.video === undefined) {
    next.video = null;
  }

  // A new destination invalidates its topic ids and the announce/schedule verdicts.
  const moved = next.target !== current.target || next.space_slug !== current.space_slug;
  if (moved) {
    next.topic_ids = Array.isArray(patch.topic_ids) ? patch.topic_ids : [];
    if (typeof patch.announcement !== 'boolean') next.announcement = false;
    // FC silently publishes immediately a schedule it won't honour at the new space.
    if (typeof patch.scheduled_at !== 'string') next.scheduled_at = '';
  }

  // Unticking drops the pick, so re-ticking cannot silently re-arm a cancelled move.
  if (next.move_target === '' || next.move_target === 'current') {
    next.move_space_id = '';
    next.move_space_title = '';
    next.move_space_logo = '';
    next.move_space_emoji = '';
  }
  // The verdict arrives with the prefill, after first draw.
  if (!next.can_move_space) {
    next.move_target = '';
    next.move_space_id = '';
    next.move_space_title = '';
    next.move_space_logo = '';
    next.move_space_emoji = '';
  }

  if (
    next.edit_feed_id === current.edit_feed_id &&
    next.can_move_space === current.can_move_space &&
    next.move_target === current.move_target &&
    next.move_space_id === current.move_space_id &&
    next.move_space_title === current.move_space_title &&
    next.move_space_logo === current.move_space_logo &&
    next.move_space_emoji === current.move_space_emoji &&
    next.target === current.target &&
    next.space_slug === current.space_slug &&
    next.space_title === current.space_title &&
    next.space_logo === current.space_logo &&
    next.space_emoji === current.space_emoji &&
    next.space_privacy === current.space_privacy &&
    next.space_can_announce === current.space_can_announce &&
    next.space_can_upload_documents === current.space_can_upload_documents &&
    next.topic_required === current.topic_required &&
    next.viewer_is_moderator === current.viewer_is_moderator &&
    next.title === current.title &&
    next.body === current.body &&
    next.topics === current.topics &&
    next.topic_ids === current.topic_ids &&
    next.announcement === current.announcement &&
    next.images === current.images &&
    next.video === current.video &&
    next.audios === current.audios &&
    next.poll === current.poll &&
    next.documents === current.documents &&
    next.scheduled_at === current.scheduled_at
  ) {
    return;
  }

  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

// Returns false when refused at the cap, so the composer can flash the label.
export function togglePostDraftTopic(id: string, max: number): boolean {
  const picked = current.topic_ids.includes(id);
  if (picked) {
    setPostDraft({ topic_ids: current.topic_ids.filter((t) => t !== id) });
    return true;
  }
  if (max > 0 && current.topic_ids.length >= max) return false;
  setPostDraft({ topic_ids: [...current.topic_ids, id] });
  return true;
}

// Returns how many were refused.
export function addPostDraftImages(images: PostDraftImage[], max: number): number {
  const have = current.images;
  const room = max > 0 ? Math.max(0, max - have.length) : images.length;
  const seen = new Set(have.map((i) => i.url));
  const fresh = images.filter((i) => i.url !== '' && !seen.has(i.url));
  const accepted = fresh.slice(0, room);
  if (accepted.length > 0) setPostDraft({ images: [...have, ...accepted] });
  return fresh.length - accepted.length;
}

// Local only: FC keeps an abandoned upload as an inactive draft row, like the portal.
export function removePostDraftImage(url: string): void {
  if (!current.images.some((i) => i.url === url)) return;
  setPostDraft({ images: current.images.filter((i) => i.url !== url) });
}

export function addPostDraftAudios(items: PostDraftAudio[], max: number): number {
  const have = current.audios;
  const room = max > 0 ? Math.max(0, max - have.length) : items.length;
  const seen = new Set(have.map((a) => a.media_id));
  const fresh = items.filter((a) => a.media_id !== '' && !seen.has(a.media_id));
  const accepted = fresh.slice(0, room);
  if (accepted.length > 0) setPostDraft({ audios: [...have, ...accepted] });
  return fresh.length - accepted.length;
}

export function removePostDraftAudio(mediaId: string): void {
  if (!current.audios.some((a) => a.media_id === mediaId)) return;
  setPostDraft({ audios: current.audios.filter((a) => a.media_id !== mediaId) });
}

export function removePostDraftVideo(): void {
  if (current.video === null) return;
  setPostDraft({ video: null });
}

// FC skips empty-label options, so they are dropped here; fewer than two attaches nothing.
export function setPostDraftPoll(poll: PostDraftPoll): boolean {
  const options = poll.options
    .map((o) => ({ ...o, label: o.label.trim() }))
    .filter((o) => o.label !== '');
  if (options.length < 2) return false;
  setPostDraft({
    poll: {
      type: poll.type === 'multi_choice' ? 'multi_choice' : 'single_choice',
      options,
      end_date: poll.end_date,
    },
  });
  return true;
}

export function removePostDraftPoll(): void {
  if (current.poll === null) return;
  setPostDraft({ poll: null });
}

// No cap: FC applies none to `document_ids`.
export function addPostDraftDocuments(docs: PostDraftDocument[]): void {
  const have = current.documents;
  const seen = new Set(have.map((d) => d.media_key));
  const fresh = docs.filter((d) => d.media_key !== '' && !seen.has(d.media_key));
  if (fresh.length === 0) return;
  setPostDraft({ documents: [...have, ...fresh] });
}

// Local only; the shells delete server-side first, so a failed delete keeps the row.
export function removePostDraftDocument(id: string): void {
  if (!current.documents.some((d) => d.id === id)) return;
  setPostDraft({ documents: current.documents.filter((d) => d.id !== id) });
}

export function renamePostDraftDocument(id: string, title: string): void {
  const trimmed = title.trim();
  if (trimmed === '') return;
  if (!current.documents.some((d) => d.id === id)) return;
  setPostDraft({
    documents: current.documents.map((d) => (d.id === id ? { ...d, title: trimmed } : d)),
  });
}

// One builder for both placement and child visible_when, so the two vocabularies cannot drift.
export function postDraftStateEntries(draft: PostDraft): Record<string, unknown> {
  const hasOtherMedia =
    draft.images.length > 0 ||
    draft.video !== null ||
    draft.audios.length > 0 ||
    draft.poll !== null;
  // Editing keeps documents in documentDraft (an empty `document_ids` deletes every file), so read both.
  const editing = draft.edit_feed_id !== null;
  const editDoc = getDocumentDraft();
  const editingDocuments = editing && editDoc.edit_feed_id !== null && editDoc.files.length > 0;
  const hasDocuments = draft.documents.length > 0 || editingDocuments;
  // FC grants announce and scheduling on the same rule; separate keys keep the catalog readable.
  const isModerator = draft.viewer_is_moderator || draft.space_can_announce;
  return {
    'post_draft.can_announce':
      draft.viewer_is_moderator || draft.space_can_announce ? 'yes' : 'no',
    'post_draft.target': draft.target,
    'post_draft.space_slug': draft.space_slug,
    'post_draft.can_upload_documents': draft.space_can_upload_documents ? 'yes' : 'no',
    'post_draft.has_documents': hasDocuments ? 'yes' : 'no',
    'post_draft.has_other_media': hasOtherMedia ? 'yes' : 'no',
    // Never while editing: post.edit ignores this draft's documents.
    'post_draft.can_attach_documents':
      draft.space_can_upload_documents && !hasOtherMedia && !editing ? 'yes' : 'no',
    // Listing existing files must not depend on the space's upload switch; `!hasOtherMedia` guards only adding.
    'post_draft.can_edit_documents':
      editing && (editingDocuments || (draft.space_can_upload_documents && !hasOtherMedia))
        ? 'yes'
        : 'no',
    'post_draft.is_editing': editing ? 'yes' : 'no',
    'post_draft.can_move_space': draft.can_move_space && editing ? 'yes' : 'no',
    'post_draft.can_schedule': isModerator ? 'yes' : 'no',
    'post_draft.has_schedule': draft.scheduled_at !== '' ? 'yes' : 'no',
    'post_draft.can_post': isPostable(draft) ? 'yes' : 'no',
  };
}

// Mirrors FC's own refusals. Attachments don't count: FC requires a message even on a photo post.
function isPostable(draft: PostDraft): boolean {
  if (draft.body.trim() === '') return false;
  if (draft.target === '') return false;
  if (draft.topic_required && draft.topic_ids.length === 0) return false;
  if (getFcComposerSettings().post_title_pref === 'required' && draft.title.trim() === '') return false;
  return true;
}

// Ticking arms 'current', which Save treats as no move.
export function togglePostDraftMove(on: boolean): void {
  if (on && !current.can_move_space) return;
  setPostDraft({ move_target: on ? 'current' : '' });
}

export function resetPostDraft(): void {
  const wasEmpty = JSON.stringify(current) === JSON.stringify(DEFAULTS);
  current = { ...DEFAULTS };
  if (!wasEmpty && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

export function usePostDraft(): PostDraft {
  const [state, setState] = useState<PostDraft>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

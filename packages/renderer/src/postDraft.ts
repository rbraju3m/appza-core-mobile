import { useEffect, useState } from 'react';

// The create-post composer's draft — what the user has typed, where it
// is going, and what the space they chose allows.
//
// Held in a slice rather than in the DOM for the same reason the chat
// draft is: other things write it. Picking a space replaces the topic
// chips and can invalidate the selection; opening the screen from a
// post's 3-dot menu prefills it; posting clears it; and the appbar's
// Post button — which is a different AppZet on a different placement —
// has to know whether the draft is postable at all.
//
// Mirrors the chatControls / bookmarkControls event-backed store
// pattern. Not persisted: a draft restored into a session that has moved
// on posts into a space the user is no longer looking at.

export type PostDraftTopic = {
  id: string;
  title: string;
  slug: string;
};

export type PostDraftImage = {
  /** The public URL the upload returned — what `media_images` carries. */
  url: string;
  /** FluentCommunity's Media row id, when the upload reported one. */
  media_id?: string;
};

/**
 * The one video a post may carry. FluentCommunity allows exactly one, and
 * it is exclusive with images — `content_type` is a single value.
 */
export type PostDraftVideo = {
  kind: 'oembed' | 'html' | 'upload';
  /** oEmbed only — the source URL, which is what post.create sends. */
  url?: string;
  /** The markup to render: the provider's iframe, or the pasted one. */
  html?: string;
  /** oEmbed poster, when the provider gave one. */
  image?: string;
  provider?: string;
  title?: string;
  /** Upload only — FluentPlayer's media row. */
  media_id?: string;
  media_url?: string;
};

/**
 * One attached audio. FluentPlayer owns the file; the post stores a
 * reference to it in `meta.audio_medias`.
 */
export type PostDraftAudio = {
  media_id: string;
  url: string;
  title: string;
};

/** Where the post is going. '' until the user has chosen. */
export type PostDraftTarget = '' | 'space' | 'profile';

export type PostDraft = {
  target: PostDraftTarget;
  space_slug: string;
  space_title: string;
  /** Avatar image for the chip. Empty when the space has none. */
  space_logo: string;
  /** FluentCommunity's per-space emoji, drawn when there is no logo. */
  space_emoji: string;
  /** 'public' | 'private' | 'secret' — decides the padlock vs globe. */
  space_privacy: string;
  /**
   * Whether the announcement email may be sent to THIS space. FC gates
   * it on being a moderator globally OR of the space being posted to, so
   * both halves matter and the second only arrives with the space.
   */
  space_can_announce: boolean;
  /** The space's Document Library switch plus its who-can-upload rule. */
  space_can_upload_documents: boolean;
  /** The space refuses a post with no topic on it. */
  topic_required: boolean;

  /** Global community moderator — the half of the announce/schedule gate
   * that is true before any space is chosen. */
  viewer_is_moderator: boolean;

  title: string;
  body: string;

  /** The chips offered, which are a property of the chosen space. */
  topics: PostDraftTopic[];
  /** The chips picked, as topic ids. */
  topic_ids: string[];

  announcement: boolean;

  /**
   * Images uploaded and waiting to be posted, in pick order.
   *
   * Capped at the site's Max Media Per Post. FluentCommunity enforces the
   * same cap server-side by SLICING the array, so an over-long list would
   * not error — it would silently drop the tail. Refusing the pick is the
   * honest version of that.
   */
  images: PostDraftImage[];

  /**
   * The attached video, or null. One at a time and exclusive with images:
   * FluentCommunity stores a single `content_type` per post, so attaching
   * a video to a draft that already carries photos would post one of them
   * and silently drop the other.
   */
  video: PostDraftVideo | null;

  /**
   * Attached audio, in pick order. NOT exclusive with the other media:
   * FluentCommunity stores `meta.audio_medias` independently of
   * `content_type`, so a post can carry audio alongside images or a
   * video — which is why the exclusivity rule above names only those two.
   */
  audios: PostDraftAudio[];
};

const EVENT = 'appza:post-draft-change';

const DEFAULTS: PostDraft = {
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
  };

  // A post is one kind of thing. Attaching a video clears the photos and
  // vice versa, because FluentCommunity's `content_type` is a single
  // value — sending both would post one and silently drop the other, and
  // the composer would have shown the user both right up to the moment
  // they pressed Post.
  if (patch.video != null && next.images.length > 0 && !Array.isArray(patch.images)) {
    next.images = [];
  }
  if (Array.isArray(patch.images) && patch.images.length > 0 && patch.video === undefined) {
    next.video = null;
  }

  // Changing where the post goes invalidates everything that described
  // the previous destination. The topic chips belong to the space, so a
  // selection carried across would submit topic ids the new space has
  // never heard of — FluentCommunity rejects the post, and the user sees
  // chips that look chosen but are not in the list any more. Same
  // invariant chatControls enforces when the thread changes.
  //
  // The announcement flag goes with it: it is a permission on the
  // destination, not a preference of the author's.
  const moved = next.target !== current.target || next.space_slug !== current.space_slug;
  if (moved) {
    next.topic_ids = Array.isArray(patch.topic_ids) ? patch.topic_ids : [];
    if (typeof patch.announcement !== 'boolean') next.announcement = false;
  }

  if (
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
    next.audios === current.audios
  ) {
    return;
  }

  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/**
 * Add or remove one topic chip, respecting the cap.
 *
 * Returns false when the tap was refused because the cap is reached —
 * the composer flashes the label rather than silently ignoring it, which
 * is how the design communicates the limit.
 */
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

/**
 * Append uploaded images, stopping at the cap.
 *
 * Returns how many were REFUSED, so the caller can say so — a picker
 * that silently drops half of what you chose is the failure this is
 * written to avoid. Duplicates are dropped too: the same URL twice would
 * post the same image twice.
 */
export function addPostDraftImages(images: PostDraftImage[], max: number): number {
  const have = current.images;
  const room = max > 0 ? Math.max(0, max - have.length) : images.length;
  const seen = new Set(have.map((i) => i.url));
  const fresh = images.filter((i) => i.url !== '' && !seen.has(i.url));
  const accepted = fresh.slice(0, room);
  if (accepted.length > 0) setPostDraft({ images: [...have, ...accepted] });
  return fresh.length - accepted.length;
}

/**
 * Drop one image from the draft.
 *
 * Local only, deliberately. FluentCommunity creates the Media row at
 * upload time as an inactive draft and attaches it when the post is
 * saved; fcom-mobile's `/feeds/media-delete` removes a media preview from
 * an EXISTING feed and requires a feed_id, so there is nothing it could
 * be called with here. An abandoned upload stays inactive, which is
 * exactly what the portal leaves behind too.
 */
export function removePostDraftImage(url: string): void {
  if (!current.images.some((i) => i.url === url)) return;
  setPostDraft({ images: current.images.filter((i) => i.url !== url) });
}

/**
 * Append uploaded audio, stopping at FluentPlayer's per-post ceiling.
 * Returns how many were refused, same contract as the image adder.
 */
export function addPostDraftAudios(items: PostDraftAudio[], max: number): number {
  const have = current.audios;
  const room = max > 0 ? Math.max(0, max - have.length) : items.length;
  const seen = new Set(have.map((a) => a.media_id));
  const fresh = items.filter((a) => a.media_id !== '' && !seen.has(a.media_id));
  const accepted = fresh.slice(0, room);
  if (accepted.length > 0) setPostDraft({ audios: [...have, ...accepted] });
  return fresh.length - accepted.length;
}

/** Drop one audio from the draft. Local only, as with the images. */
export function removePostDraftAudio(mediaId: string): void {
  if (!current.audios.some((a) => a.media_id === mediaId)) return;
  setPostDraft({ audios: current.audios.filter((a) => a.media_id !== mediaId) });
}

/** Drop the attached video. Local only, for the same reason images are. */
export function removePostDraftVideo(): void {
  if (current.video === null) return;
  setPostDraft({ video: null });
}

/**
 * Back to an empty composer. Called when the create-post screen is left,
 * so the next visit does not open holding the last one's text.
 */
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

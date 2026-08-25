import { useEffect, useState } from 'react';

import { getFcComposerSettings } from './fcRuntimeSettings';
import { getDocumentDraft } from './documentDraft';

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

/**
 * One poll option.
 *
 * `slug` is present only for an option that already exists on the server
 * — a post being EDITED. FluentCommunity refuses an edit that drops an
 * existing option or blanks its label
 * (`FeedsHelper::getSurveyOptionsUpdateError`), because votes are
 * recorded against the slug and removing it would orphan them. So a
 * slug'd row is neither removable nor blankable, and the sheet has to
 * know which rows those are. A newly-added option omits it; the server
 * issues one on save.
 */
export type PostDraftPollOption = {
  label: string;
  slug?: string;
};

/**
 * The attached poll — FluentCommunity calls it a survey.
 *
 * NOT exclusive with the other media, unlike images and video. A survey
 * is the only thing that sets `content_type = 'survey'`; an image or
 * video post stays `'text'` and carries its media in `meta`, verified
 * against this site's own rows. FluentCommunity's SurveyRenderer even
 * takes a `hasTopMedia` prop for the case where a post has both. So a
 * poll rides alongside whatever else is attached.
 */
export type PostDraftPoll = {
  type: 'single_choice' | 'multi_choice';
  options: PostDraftPollOption[];
  /**
   * 'YYYY-MM-DD HH:MM:SS' in the site's wall-clock, or '' for a poll
   * that never closes — which is what the portal's "Leave blank for not
   * end" means, and what FluentCommunity stores when the field is empty.
   */
  end_date: string;
};

/**
 * One attached document — designs 30 and 31.
 *
 * Uploaded on pick, the way the portal's own composer does it, so the
 * shape here is exactly what `Media::getPrivateFileMeta()` returns and
 * what `document_ids` wants back.
 *
 * `id` and `media_key` are both kept because two different endpoints
 * need different ones: `/documents/update` and `/documents/delete` take
 * the row `id`, while FluentCommunity matches `document_ids` entries by
 * `media_key`.
 */
export type PostDraftDocument = {
  /** Media row id — what rename and delete are addressed by. */
  id: string;
  /** What `document_ids` is matched on when the post is saved. */
  media_key: string;
  /** Display name. Editable: the design's pencil. */
  title: string;
  /** FluentCommunity's private download URL, for the preview's glyph. */
  url: string;
  type: string;
};

/** Where the post is going. '' until the user has chosen. */
export type PostDraftTarget = '' | 'space' | 'profile';

export type PostDraft = {
  /**
   * The post being EDITED, or null when composing a new one.
   *
   * Set by the prefill, cleared by `resetPostDraft` — which `nav.push`
   * runs on entry to BOTH composer screens, so it cannot survive into a
   * fresh compose.
   *
   * Two gates need it: documents live in a different slice while
   * editing, and the composer's own paperclip writes somewhere
   * `post.edit` deliberately does not read.
   */
  edit_feed_id: number | null;
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

  /**
   * The attached poll, or null. Designs 24 to 29.
   *
   * Rides alongside the rest for the reason given on PostDraftPoll: a
   * survey is the only content_type a poll claims, and media lives in
   * meta regardless.
   */
  poll: PostDraftPoll | null;

  /**
   * Attached documents — designs 30 and 31.
   *
   * Exclusive with EVERYTHING else, which is the strongest rule on this
   * slice and the only one the designs draw directly: design 30's attach
   * bar has a paperclip and nothing else.
   *
   * The reason is FluentCommunity's, not ours. A request carrying
   * `content_type: 'document'` runs `validateAndSaveDocuments`, which
   * sets `content_type = 'document'` AFTER `processFeedMetaData` has
   * already set it to 'survey' for a poll — so a draft with both posts
   * as a document and the poll is written to meta where nothing renders
   * it. Images and video lose the same way. The portal solves it the
   * same way we do: its composer has a `hasActiveApp` computed that is
   * true when content_type is 'document', and while it holds, the survey,
   * audio and image blocks are not rendered at all.
   */
  documents: PostDraftDocument[];

  /**
   * When the post should publish — 'YYYY-MM-DD HH:MM:SS' in the site's
   * wall-clock, or '' to publish now. Design 10's grey strip.
   *
   * FluentCommunity Pro's SchedulePostHandler takes it on the create
   * request and, if it is at least 30 minutes out, sets `status =
   * 'scheduled'` and queues the publish. It is **silently ignored for a
   * non-moderator** — `if (!is_admin) return $data;` — so a member who
   * could reach the control would set a time and watch the post publish
   * immediately. That is why the calendar glyph is gated rather than
   * merely erroring.
   */
  scheduled_at: string;
};

const EVENT = 'appza:post-draft-change';

const DEFAULTS: PostDraft = {
  edit_feed_id: null,
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

  // Documents take the whole post. FluentCommunity resolves exactly one
  // `content_type`, and the document filter runs last — so a draft
  // carrying documents plus anything else would post as a document and
  // drop the rest into meta where nothing draws it. Attaching the first
  // document clears the others; attaching other media clears the
  // documents. The attach bar hides the losing half either way
  // (`has_documents` / `can_attach_documents`), so this only fires for a
  // caller that got there another way.
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
    // Scheduling goes with it for the same reason. FluentCommunity grants
    // it to a moderator of the space being posted to, so a time set for
    // one destination may be worth nothing at the next — and FC ignores a
    // schedule it will not honour SILENTLY, publishing immediately. A
    // strip that still read "Scheduled for…" would be a lie.
    if (typeof patch.scheduled_at !== 'string') next.scheduled_at = '';
  }

  if (
    next.edit_feed_id === current.edit_feed_id &&
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
 * Attach or replace the poll, dropping the rows the server would drop
 * anyway.
 *
 * FluentCommunity skips any option with an empty label when it formats
 * the survey (`FeedsHelper::processFeedContent`), so a draft that kept
 * them would show the author a count the post is not going to have. The
 * trailing blank row the sheet keeps for typing is exactly such a row,
 * which is why this is filtered here rather than in the sheet.
 *
 * Returns false — and attaches nothing — when fewer than two options
 * survive, because a one-option poll is not a poll and FluentCommunity
 * would store it as one.
 */
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

/**
 * Drop the poll.
 *
 * Local only and, unlike the media, genuinely free: a poll that was
 * never posted has no server-side row at all. Editing a post that
 * already HAS one is a different matter — FluentCommunity keeps the
 * existing survey unless the whole content type changes — so the sheet
 * offers this only where it can be honoured.
 */
export function removePostDraftPoll(): void {
  if (current.poll === null) return;
  setPostDraft({ poll: null });
}

/**
 * Append uploaded documents.
 *
 * No cap: FluentCommunity applies none to `document_ids`, and inventing
 * one here would refuse a post the server would have accepted. Duplicates
 * are dropped by `media_key` — the same file picked twice would otherwise
 * appear twice on the post.
 */
export function addPostDraftDocuments(docs: PostDraftDocument[]): void {
  const have = current.documents;
  const seen = new Set(have.map((d) => d.media_key));
  const fresh = docs.filter((d) => d.media_key !== '' && !seen.has(d.media_key));
  if (fresh.length === 0) return;
  setPostDraft({ documents: [...have, ...fresh] });
}

/**
 * Drop one document from the draft.
 *
 * Local only — the SERVER-side removal is the caller's, because unlike
 * an image or an audio file a document genuinely can be deleted before
 * it is attached to anything: `/documents/delete` resolves an upload with
 * no `feed_id` and permits it as long as the media belongs to the asking
 * user. The shells make that call and then come here, so a failed delete
 * leaves the row visible rather than silently losing the user's file.
 */
export function removePostDraftDocument(id: string): void {
  if (!current.documents.some((d) => d.id === id)) return;
  setPostDraft({ documents: current.documents.filter((d) => d.id !== id) });
}

/** Rename one document locally, after `/documents/update` has agreed. */
export function renamePostDraftDocument(id: string, title: string): void {
  const trimmed = title.trim();
  if (trimmed === '') return;
  if (!current.documents.some((d) => d.id === id)) return;
  setPostDraft({
    documents: current.documents.map((d) => (d.id === id ? { ...d, title: trimmed } : d)),
  });
}

/**
 * The draft as flat `state.*` keys.
 *
 * ONE builder, used by both the screen's placement-level `visible_when`
 * bag and the child-level evaluator, because the two would otherwise
 * describe the same fact in two vocabularies — and a clause written
 * against the wrong one fails silently in the direction that hides a
 * control (P104).
 *
 * Everything is 'yes' / 'no' rather than a boolean: placements have
 * always been authored that way, and one shape across both levels is
 * worth more than matching the slice's own types.
 */
export function postDraftStateEntries(draft: PostDraft): Record<string, unknown> {
  const hasOtherMedia =
    draft.images.length > 0 ||
    draft.video !== null ||
    draft.audios.length > 0 ||
    draft.poll !== null;
  // Documents live in TWO slices, and the gate has to see both.
  //
  // Creating a post puts them on this draft. EDITING one puts them in
  // `documentDraft`, behind `fc-edit-document-files` — a split chunk 7
  // made deliberately, because only that slice can tell "the user
  // removed them all" from "we never learned what they were", and an
  // empty `document_ids` DELETES every file. Merging the slices would
  // throw that distinction away.
  //
  // So the gate reads both instead. Without this the attach bar showed
  // all five glyphs while editing a document post, where creating one
  // leaves only the paperclip — an edit could reach a draft state that
  // create refuses.
  //
  // Scoped to `edit_feed_id`: the add-document screen uses the same
  // slice, and its files are not an attachment on THIS composer.
  const editing = draft.edit_feed_id !== null;
  const editDoc = getDocumentDraft();
  const editingDocuments = editing && editDoc.edit_feed_id !== null && editDoc.files.length > 0;
  const hasDocuments = draft.documents.length > 0 || editingDocuments;
  // The moderator verdict: a global community moderator, or a moderator
  // of the space being posted to. FluentCommunity resolves the two the
  // same way for BOTH the announcement email and scheduling
  // (`hasPermissionOrInCurrentSpace('community_moderator', $space)`), so
  // the derivation is shared — but each control gets its own key, because
  // a calendar gated on something called `can_announce` is a puzzle for
  // whoever reads the catalog next.
  const isModerator = draft.viewer_is_moderator || draft.space_can_announce;
  return {
    // A VERDICT, not a flag the user sets: FluentCommunity grants the
    // announcement email to a global moderator OR to a moderator of the
    // space being posted to, so it can turn on when the destination does.
    'post_draft.can_announce':
      draft.viewer_is_moderator || draft.space_can_announce ? 'yes' : 'no',
    'post_draft.target': draft.target,
    'post_draft.space_slug': draft.space_slug,
    'post_draft.can_upload_documents': draft.space_can_upload_documents ? 'yes' : 'no',
    'post_draft.has_documents': hasDocuments ? 'yes' : 'no',
    'post_draft.has_other_media': hasOtherMedia ? 'yes' : 'no',
    // The paperclip's own gate, pre-combined. Two facts — may this
    // viewer attach documents to this space, and is the draft still free
    // to become a document post — but one clause, because a control that
    // needs two conditions is easier to get wrong as two rows in the
    // catalog than as one derived key here.
    // ...and never while EDITING. The composer's paperclip writes to
    // this draft, and `post.edit` deliberately does not read it — the
    // edit screen's own file block owns documents there, because only
    // that slice can tell "removed them all" from "never knew what they
    // were". A glyph that uploads into a slice nobody reads is worse
    // than no glyph, so it is not drawn.
    //
    // ⚠ The consequence, stated plainly: a NON-document post cannot gain
    // its first document on the edit screen, because the edit file block
    // renders only for posts that already have some. That gap is older
    // than this gate and is not closed by it.
    'post_draft.can_attach_documents':
      draft.space_can_upload_documents && !hasOtherMedia && !editing ? 'yes' : 'no',
    'post_draft.is_editing': editing ? 'yes' : 'no',
    'post_draft.can_schedule': isModerator ? 'yes' : 'no',
    'post_draft.has_schedule': draft.scheduled_at !== '' ? 'yes' : 'no',
    'post_draft.can_post': isPostable(draft) ? 'yes' : 'no',
  };
}

/**
 * Is there enough here for FluentCommunity to accept?
 *
 * Every clause mirrors a refusal the server already makes, so the pale
 * Post button of designs 1 and 4 says the same thing the round trip would
 * — before the round trip:
 *
 *  - **a message**: `/feeds/create` declares `message` required, and the
 *    shells short-circuit an empty one with "Write something to post."
 *  - **a destination**: FeedsController refuses a post with no space
 *    unless the site allows global posts.
 *  - **a topic where the space demands one**: "Please select at least one
 *    topic to post in this space."
 *  - **a title where the site demands one**: `post_title_pref` is
 *    'required'. That one is a SITE setting rather than a draft field,
 *    which is why this reads the runtime store — the verdict genuinely
 *    depends on both, and putting a copy of the pref on the draft would
 *    be one more thing to keep in step.
 *
 * Attachments deliberately do NOT count. FluentCommunity requires a
 * message even on a post that is nothing but a photo, so a draft with an
 * image and no words is not postable and the button must say so.
 */
function isPostable(draft: PostDraft): boolean {
  if (draft.body.trim() === '') return false;
  if (draft.target === '') return false;
  if (draft.topic_required && draft.topic_ids.length === 0) return false;
  if (getFcComposerSettings().post_title_pref === 'required' && draft.title.trim() === '') return false;
  return true;
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

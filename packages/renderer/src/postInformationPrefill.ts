/**
 * Prefills the fc-post-information composer AppZet from a bound feed post
 * item so the edit-post-page arrives populated instead of empty.
 *
 * Called from each app-shell inside a useEffect that watches the current
 * screen. Text fields (title / body / space) are written into the DOM
 * imperatively; media (images / video / poll) is seeded via optional
 * setter callbacks the shell passes in, since those live in shell React
 * state (pendingImages / pendingVideo / pendingPoll).
 *
 * DOM contract stamped by SuperstructureRenderer: each top-level SS child
 * wrapper carries BOTH `data-appza-appzet-slug="fc-post-information"` and
 * `data-appza-primitive-path="children[N]"`. Match children with a
 * combined selector — matching slug alone hits every child and lands on
 * children[0] (the label), which contains no editable inputs.
 *
 * Child indices track the fc-post-information SS layout:
 *   children[1]  = space picker (native <select>, uncontrolled),
 *   children[2]  = title (ion-input),
 *   children[3]  = message (ion-textarea),
 *   children[10] = topic picker (ion-select). Value = topic id
 *                  (as a string — the option-loader stringifies rec.id).
 *
 * Ionic web components are lazy-upgraded. We await `componentOnReady()`
 * before writing, otherwise the assignment lands on an unupgraded shell
 * element and is wiped when Ionic mounts its internal input. Space's
 * <option>s arrive after the async option_data_sources fetch resolves;
 * that one retries until an option matching the target slug exists.
 */

import { setPostDraft } from './postDraft';

export type PrefillMediaSetters = {
  /**
   * Called with the post's space SLUG. The caller resolves it against the
   * picker payload (`hydratePostDraftSpace`) — the prefill deliberately
   * does not fetch.
   */
  setSpace?: (slug: string) => void;
  /** Called with image URLs when the post has uploaded images. */
  setImages?: (urls: string[]) => void;
  /** Called with the video oembed preview when the post is a video. */
  setVideo?: (
    v: { url: string; title?: string; image?: string; provider?: string } | null,
  ) => void;
  /**
   * Called with poll config when the post is a survey. Each option
   * carries its slug when it existed on the server — FC's edit endpoint
   * rejects updates that drop an existing slug OR blank its label
   * (see fluent-community FeedsHelper::getSurveyOptionsUpdateError),
   * so callers MUST forward the slug back on post.edit for options
   * that had one on prefill.
   */
  setPoll?: (
    p: {
      type: 'single_choice' | 'multi_choice';
      options: Array<{ label: string; slug?: string }>;
      /**
       * '' when the poll never closes. FluentCommunity stores it that
       * way and re-sends it that way, so an edit that dropped the field
       * would quietly give every re-saved poll an end date of nothing —
       * which is the same value, but only by luck.
       */
      end_date: string;
    } | null,
  ) => void;
};

export function prefillPostInformationFromContext(
  item: unknown,
  media?: PrefillMediaSetters,
): void {
  if (typeof window === 'undefined') return;
  if (!isPlainObject(item)) return;

  // Item may arrive either as the {data: {...}} envelope the field
  // mapping engine walks, or as the inner data slice directly. Support
  // both — FC's fcom-mobile returns items top-level (no data wrapper),
  // so the fallback fires.
  const data = isPlainObject(item.data)
    ? (item.data as Record<string, unknown>)
    : (item as Record<string, unknown>);

  // ── Text ────────────────────────────────────────────────────────────
  const title = typeof data.title === 'string' ? data.title : '';
  const rawMessage = typeof data.message === 'string' ? data.message : '';
  const rendered =
    typeof data.message_rendered === 'string' ? data.message_rendered : '';
  const message = rawMessage || (rendered ? stripHtml(rendered) : '');
  const space =
    isPlainObject(data.space) && typeof (data.space as Record<string, unknown>).slug === 'string'
      ? ((data.space as Record<string, unknown>).slug as string)
      : '';

  // Topic id from data.terms[0].pivot.term_id. FC returns terms as an
  // array (a post can carry multiple), and topic_options binds by id
  // (the option-loader emits {value: String(rec.id)}). fc-post-information
  // is single-select today, so pick the first term.
  const topicId = extractFirstTopicId(data);

  // ── The text, straight onto the DRAFT ──────────────────────────────
  //
  // This used to poll the DOM for `children[1..3]` and `children[10]` and
  // write Ionic values into them. Chunk 1 replaced the composer's eleven
  // loose primitives with one bespoke one, so those indices are attach
  // BUTTONS now: `writeIonicValue` found no input inside and returned,
  // silently, on every field. Editing a post opened an EMPTY composer —
  // and it did not even warn, because the warning fires only when all
  // four wrappers are missing and three of them still exist.
  //
  // The same lesson as the param_map (P114): a CONTROLLED field cannot be
  // written through the DOM. The fields live on the slice, so write the
  // slice. No polling, no mount race — the composer reads whatever is
  // there whenever it renders.
  setPostDraft({ title, body: message, topic_ids: topicId ? [topicId] : [] });

  // The space is the one thing that cannot be set from the post alone: a
  // destination is a chip, a topic list, a document permission and an
  // announcement verdict, all of which live in the picker's payload. The
  // caller supplies the lookup because it owns the fetch seam.
  if (space && media?.setSpace) media.setSpace(space);

  // ── Media ──────────────────────────────────────────────────────────
  // Media hydration is best-effort. Shape checks are defensive because
  // FC's meta payload varies by content_type (image / oembed / survey /
  // text) and by upload provider. When a shape doesn't match, we skip
  // that media slot rather than write bogus values.
  if (media) {
    const meta = isPlainObject(data.meta) ? (data.meta as Record<string, unknown>) : null;

    // Images. FC surfaces uploaded images two ways:
    //   1. meta.media_items — array of {image, provider, ...} for
    //      multi-image posts.
    //   2. meta.media_preview.image — single-image posts.
    if (media.setImages) {
      const urls = extractImageUrls(meta);
      if (urls.length > 0) media.setImages(urls);
    }

    // Video (oembed). NOTE: content_type is 'text' on these posts, NOT
    // 'oembed'. The oembed marker lives inside meta.media_preview.type
    // — extractVideoPreview handles the shape sniff so callers don't
    // need to guess. Feed row 2 shape:
    //   meta.media_preview = { type: 'oembed', provider: 'youtube',
    //   url: 'https://…', html: '<iframe…', image: '…thumb.jpg' }
    if (media.setVideo) {
      const v = extractVideoPreview(meta);
      if (v) media.setVideo(v);
    }

    // Poll (survey). meta.survey_config carries {type, options: [{label, slug}]}.
    if (media.setPoll) {
      const p = extractPoll(meta);
      if (p) media.setPoll(p);
    }
  }
}

/**
 * The post's first topic id, from `data.terms[0].pivot.term_id`.
 *
 * FluentCommunity returns terms as an array because a post can carry
 * several; the composer's chips are multi-select now, but an edit only
 * ever needs to restore what the post has — and every FC response so far
 * carries at most one.
 */
function extractFirstTopicId(data: Record<string, unknown>): string {
  const terms = Array.isArray(data.terms) ? data.terms : null;
  if (!terms || terms.length === 0) return '';
  const first = terms[0];
  if (!isPlainObject(first)) return '';
  // Preferred: pivot.term_id (FC's shape on read). Fallbacks handle
  // occasional flat responses that expose id/term_id at the top level.
  const pivot = isPlainObject(first.pivot) ? (first.pivot as Record<string, unknown>) : null;
  const raw =
    (pivot && (pivot.term_id ?? pivot.id)) ??
    (first as Record<string, unknown>).term_id ??
    (first as Record<string, unknown>).id;
  if (raw == null) return '';
  return String(raw);
}

function extractImageUrls(meta: Record<string, unknown> | null): string[] {
  if (!meta) return [];
  const urls: string[] = [];
  const items = meta.media_items;
  if (Array.isArray(items)) {
    for (const it of items) {
      if (isPlainObject(it) && typeof it.image === 'string' && it.image) {
        urls.push(it.image);
      } else if (isPlainObject(it) && typeof it.url === 'string' && it.url) {
        urls.push(it.url);
      }
    }
  }
  if (urls.length === 0 && isPlainObject(meta.media_preview)) {
    const mp = meta.media_preview as Record<string, unknown>;
    // media_preview is single-image only when there's no media_items (FC
    // uses it as a summary card). Skip video previews (they have type
    // fields like 'oembed' / 'meta_data' with different keys).
    if (typeof mp.image === 'string' && mp.image && mp.provider === 'uploader') {
      urls.push(mp.image);
    }
  }
  return urls;
}

function extractVideoPreview(
  meta: Record<string, unknown> | null,
): { url: string; title?: string; image?: string; provider?: string } | null {
  if (!meta) return null;
  const mp = isPlainObject(meta.media_preview)
    ? (meta.media_preview as Record<string, unknown>)
    : null;
  if (!mp) return null;
  // Sniff on media_preview.type — image posts have type='meta_data' +
  // provider='uploader' (handled by extractImageUrls). Video posts
  // have type='oembed' (all providers) OR type='iframe_html'.
  const type = typeof mp.type === 'string' ? mp.type : '';
  if (type !== 'oembed' && type !== 'iframe_html') return null;
  const url =
    typeof mp.url === 'string' && mp.url
      ? mp.url
      : typeof mp.embed_url === 'string' && mp.embed_url
        ? mp.embed_url
        : '';
  if (!url) return null;
  return {
    url,
    title: typeof mp.title === 'string' ? mp.title : undefined,
    image: typeof mp.image === 'string' ? mp.image : undefined,
    provider: typeof mp.provider === 'string' ? mp.provider : undefined,
  };
}

function extractPoll(
  meta: Record<string, unknown> | null,
):
  | {
      type: 'single_choice' | 'multi_choice';
      options: Array<{ label: string; slug?: string }>;
      end_date: string;
    }
  | null {
  if (!meta) return null;
  const sc = isPlainObject(meta.survey_config)
    ? (meta.survey_config as Record<string, unknown>)
    : null;
  if (!sc) return null;
  const rawType = typeof sc.type === 'string' ? sc.type : 'single_choice';
  const type: 'single_choice' | 'multi_choice' =
    rawType === 'multi_choice' ? 'multi_choice' : 'single_choice';
  const rawOpts = Array.isArray(sc.options) ? sc.options : [];
  const options: Array<{ label: string; slug?: string }> = [];
  for (const o of rawOpts) {
    if (typeof o === 'string') {
      // Legacy shape — no slug available.
      options.push({ label: o });
    } else if (isPlainObject(o) && typeof o.label === 'string') {
      const entry: { label: string; slug?: string } = { label: o.label };
      if (typeof o.slug === 'string' && o.slug) entry.slug = o.slug;
      options.push(entry);
    }
  }
  if (options.length === 0) return null;
  // Stored as 'YYYY-MM-DD HH:MM:SS' by FeedsHelper, or '' for a poll
  // with no closing time.
  const endDate = typeof sc.end_date === 'string' ? sc.end_date : '';
  return { type, options, end_date: endDate };
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').trim();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

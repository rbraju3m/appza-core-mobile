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

import { setPostDraft, type PostDraftVideo, type PostDraftAudio } from './postDraft';

export type PrefillMediaSetters = {
  /**
   * Called with the post's space SLUG and its topic ids. The caller
   * resolves them against the picker payload (`hydratePostDraftSpace`) —
   * the prefill deliberately does not fetch.
   *
   * The topics ride ALONG with the space rather than being written here,
   * and that is not tidiness. `setPostDraft` clears `topic_ids` whenever
   * the destination changes, because a selection carried across spaces
   * submits ids the new space has never heard of. The space resolves
   * asynchronously, so topics written before it arrive are wiped by it —
   * which is exactly what was happening: the post's topic vanished about
   * a second after the edit screen opened.
   */
  setSpace?: (slug: string, topicIds: string[]) => void;
  /** Called with image URLs when the post has uploaded images. */
  setImages?: (urls: string[]) => void;
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

  // Every topic on the post, from `data.terms[*].pivot.term_id`. The
  // composer's chips are multi-select, so restoring only the first would
  // silently drop the rest on save.
  const topicIds = extractTopicIds(data);

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
  // Which post this is. Two gates read it — see PostDraft.edit_feed_id —
  // and `resetPostDraft` on nav.push clears it, so it cannot leak into a
  // fresh compose.
  const feedId = Number.parseInt(String(data.id ?? ''), 10);
  setPostDraft({
    edit_feed_id: Number.isFinite(feedId) ? feedId : null,
    title,
    body: message,
  });

  // The space is the one thing that cannot be set from the post alone: a
  // destination is a chip, a topic list, a document permission and an
  // announcement verdict, all of which live in the picker's payload. The
  // caller supplies the lookup because it owns the fetch seam — and the
  // topics go with it, for the ordering reason on setSpace above.
  if (space && media?.setSpace) media.setSpace(space, topicIds);

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


    // Poll (survey). meta.survey_config carries {type, options: [{label, slug}]}.
    if (media.setPoll) {
      const p = extractPoll(meta);
      if (p) media.setPoll(p);
    }
  }

  // ── Video and audio, straight onto the draft ───────────────────────
  //
  // Both used to go out through a setter the shells wired to their own
  // legacy state — `setPendingVideo` — while the composer draws
  // `draft.video`. So editing a post with a video showed no video, and
  // audio had no setter at all: `meta.audio_medias` was never read, so
  // the players simply were not there. Same shape of mistake as the text
  // prefill, one layer along.
  //
  // Outside the `if (media)` block on purpose: neither needs anything
  // from the caller, so neither should depend on the caller passing a
  // setters object.
  const meta = isPlainObject(data.meta) ? (data.meta as Record<string, unknown>) : null;
  const video = extractDraftVideo(meta);
  if (video) setPostDraft({ video });
  const audios = extractDraftAudios(meta);
  if (audios.length > 0) setPostDraft({ audios });
}

/**
 * Every topic id on the post, from `data.terms[*].pivot.term_id`.
 *
 * FluentCommunity returns terms as an array because a post can carry
 * several, and the composer's chips are multi-select — so taking only
 * the first would drop the rest the next time the post is saved.
 *
 * Preferred shape is `pivot.term_id`, which is what the feed returns.
 * The fallbacks handle flatter responses that expose id/term_id at the
 * top level.
 */
function extractTopicIds(data: Record<string, unknown>): string[] {
  const terms = Array.isArray(data.terms) ? data.terms : null;
  if (!terms) return [];
  const out: string[] = [];
  for (const term of terms) {
    if (!isPlainObject(term)) continue;
    const rec = term as Record<string, unknown>;
    const pivot = isPlainObject(rec.pivot) ? (rec.pivot as Record<string, unknown>) : null;
    const raw = (pivot && (pivot.term_id ?? pivot.id)) ?? rec.term_id ?? rec.id;
    if (raw == null) continue;
    const id = String(raw);
    if (id !== '' && !out.includes(id)) out.push(id);
  }
  return out;
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

/**
 * The post's video, in the shape the composer draft holds.
 *
 * Three cases, and the discriminator is NOT the same field each time:
 *
 *  - a FluentPlayer upload has `player: 'fluent_player'` — that key, not
 *    the type, which is 'oembed' for uploads too;
 *  - a pasted iframe has `type: 'iframe_html'`;
 *  - everything else with `type: 'oembed'` is a provider embed.
 *
 * An IMAGE post also lives in media_preview (type 'meta_data', provider
 * 'uploader'), which extractImageUrls handles — so the type sniff has to
 * come first or an image would be restored as a video.
 */
function extractDraftVideo(meta: Record<string, unknown> | null): PostDraftVideo | null {
  if (!meta) return null;
  const mp = isPlainObject(meta.media_preview)
    ? (meta.media_preview as Record<string, unknown>)
    : null;
  if (!mp) return null;

  const type = typeof mp.type === 'string' ? mp.type : '';
  if (type !== 'oembed' && type !== 'iframe_html') return null;

  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const url = str(mp.url) || str(mp.embed_url);

  if (str(mp.player) === 'fluent_player') {
    if (!url) return null;
    return {
      kind: 'upload',
      media_id: mp.media_id == null ? '' : String(mp.media_id),
      media_url: url,
      title: str(mp.title),
    };
  }

  if (type === 'iframe_html') {
    const html = str(mp.html);
    return html ? { kind: 'html', html } : null;
  }

  if (!url) return null;
  return {
    kind: 'oembed',
    url,
    html: str(mp.html),
    image: str(mp.image),
    provider: str(mp.provider),
    title: str(mp.title),
  };
}

/**
 * The post's attached audio, from `meta.audio_medias`.
 *
 * This had no reader at all: audio was written on create and never read
 * back, so the edit screen showed none of it. The stored entries carry
 * more than the draft needs (player, content_type, settings) — those are
 * rebuilt on submit from the same three fields kept here.
 */
function extractDraftAudios(meta: Record<string, unknown> | null): PostDraftAudio[] {
  if (!meta) return [];
  const raw = Array.isArray(meta.audio_medias) ? meta.audio_medias : [];
  const out: PostDraftAudio[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry)) continue;
    const rec = entry as Record<string, unknown>;
    const url = typeof rec.url === 'string' ? rec.url : '';
    const mediaId = rec.media_id == null ? '' : String(rec.media_id);
    if (url === '' || mediaId === '') continue;
    out.push({
      media_id: mediaId,
      url,
      title: typeof rec.title === 'string' ? rec.title : '',
    });
  }
  return out;
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

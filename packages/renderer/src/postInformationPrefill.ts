import { setPostDraft, type PostDraftVideo, type PostDraftAudio } from './postDraft';

export type PrefillMediaSetters = {
  // Topics ride with the space: setPostDraft clears topic_ids when the space changes, and the space resolves async.
  setSpace?: (slug: string, topicIds: string[]) => void;
  setImages?: (urls: string[]) => void;
  // Forward each option's slug on edit: FC rejects updates that drop or blank an existing slug.
  setPoll?: (
    p: {
      type: 'single_choice' | 'multi_choice';
      options: Array<{ label: string; slug?: string }>;
      // '' when the poll never closes, as FC stores it.
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

  // fcom-mobile returns items unwrapped, so accept both the {data} envelope and the bare row.
  const data = isPlainObject(item.data)
    ? (item.data as Record<string, unknown>)
    : (item as Record<string, unknown>);

  const title = typeof data.title === 'string' ? data.title : '';
  const rawMessage = typeof data.message === 'string' ? data.message : '';
  const rendered =
    typeof data.message_rendered === 'string' ? data.message_rendered : '';
  const message = rawMessage || (rendered ? stripHtml(rendered) : '');
  const space =
    isPlainObject(data.space) && typeof (data.space as Record<string, unknown>).slug === 'string'
      ? ((data.space as Record<string, unknown>).slug as string)
      : '';

  const topicIds = extractTopicIds(data);

  // Written to the draft slice, not the DOM: the composer fields are controlled.
  const feedId = Number.parseInt(String(data.id ?? ''), 10);
  // Written even when false, so a move armed on the previous post cannot carry over.
  const permissions = isPlainObject(data.permissions)
    ? (data.permissions as Record<string, unknown>)
    : {};
  setPostDraft({
    edit_feed_id: Number.isFinite(feedId) ? feedId : null,
    can_move_space: permissions.can_move_space === true,
    title,
    body: message,
  });

  if (space && media?.setSpace) media.setSpace(space, topicIds);

  if (media) {
    const meta = isPlainObject(data.meta) ? (data.meta as Record<string, unknown>) : null;

    // FC: meta.media_items for multi-image posts, meta.media_preview.image for single.
    if (media.setImages) {
      const urls = extractImageUrls(meta);
      if (urls.length > 0) media.setImages(urls);
    }

    if (media.setPoll) {
      const p = extractPoll(meta);
      if (p) media.setPoll(p);
    }
  }

  const meta = isPlainObject(data.meta) ? (data.meta as Record<string, unknown>) : null;
  const video = extractDraftVideo(meta);
  if (video) setPostDraft({ video });
  const audios = extractDraftAudios(meta);
  if (audios.length > 0) setPostDraft({ audios });
}

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
    // Only uploader previews; video previews share this key.
    if (typeof mp.image === 'string' && mp.image && mp.provider === 'uploader') {
      urls.push(mp.image);
    }
  }
  return urls;
}

// Uploads are marked by player 'fluent_player' (type is 'oembed' for them too); image posts are filtered by type first.
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
      options.push({ label: o });
    } else if (isPlainObject(o) && typeof o.label === 'string') {
      const entry: { label: string; slug?: string } = { label: o.label };
      if (typeof o.slug === 'string' && o.slug) entry.slug = o.slug;
      options.push(entry);
    }
  }
  if (options.length === 0) return null;
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

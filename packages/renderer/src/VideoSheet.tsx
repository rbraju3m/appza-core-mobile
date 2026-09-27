import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';

import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { setPostDraft, type PostDraftVideo } from './postDraft';
import { useBackDismiss } from './backStack';

/**
 * "Attach Media" — the video sheet, Noor's designs 15 to 19.
 *
 * Three ways to put a video on a post, and they are genuinely different
 * operations rather than three shapes of one: an oEmbed URL is looked up
 * on the server and answers with markup; an iframe is pasted whole and
 * looked up by nobody; an upload is a file that becomes a FluentPlayer
 * media row. So each tab owns its own field, its own hint, its own idea
 * of "ready", and only the frame is shared.
 *
 * The Upload tab exists only where FluentPlayer says it may: the plugin
 * active, its `video_upload` switch on, and the viewer's role matching
 * `video_upload_role`. That verdict is resolved per request on the
 * space-picker payload and handed in — it cannot be read from the cached
 * bootstrap, because it is a question about who is asking.
 *
 * The lookup and the upload are the SHELL's, passed in as callbacks. Both
 * are HTTP with auth, and both shells already own that seam; the sheet
 * stays a sheet.
 */

export const VIDEO_SHEET_APPZET_SLUG = 'fc-post-video-sheet';
export const VIDEO_SHEET_CHILD_COUNT = 5;

export type VideoSheetTab = 'oembed' | 'html' | 'upload';

export type VideoOembedResult = {
  html: string;
  url: string;
  provider?: string;
  title?: string;
  image?: string;
};

export type VideoSheetPresentation = {
  eyebrow: string;
  title: string;
  oembedTab: string;
  htmlTab: string;
  uploadTab: string;
  /** Shown on both text tabs before anything is typed — the design's. */
  emptyHint: string;
  oembedHint: string;
  htmlHint: string;
  urlPlaceholder: string;
  htmlPlaceholder: string;
  attachLabel: string;
  uploadTitle: string;
  uploadSubtitle: string;
  uploadIcon: string;
  uploadAccept: string;
  lookupFailedLabel: string;
  hidden: boolean;
  showHandle: boolean;
  showEyebrow: boolean;
  showTitle: boolean;
  sheetBgColor?: string;
  sheetRadius?: string;
  sheetMaxHeight?: string;
  backdropColor?: string;
  handleColor?: string;
  eyebrowColor?: string;
  eyebrowSize?: string;
  titleColor?: string;
  titleSize?: string;
  titleWeight?: string;
  tabBgColor?: string;
  tabTextColor?: string;
  tabRadius?: string;
  tabHeight?: string;
  activeBgColor?: string;
  activeColor?: string;
  hintColor?: string;
  hintSize?: string;
  fieldBgColor?: string;
  fieldTextColor?: string;
  fieldRadius?: string;
  fieldBorderColor?: string;
  attachBgColor?: string;
  attachDisabledBgColor?: string;
  attachTextColor?: string;
  attachRadius?: string;
  uploadBorderColor?: string;
  uploadRadius?: string;
  iconColor?: string;
  iconSize?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: VideoSheetPresentation;
  /** FluentPlayer's upload gate, resolved for this viewer. */
  canUpload: boolean;
  /** Settings → Customization → the oEmbed switch. */
  embedEnabled: boolean;
  /** Looks a URL up through fcom-mobile's /feeds/oembed. */
  onLookup: (url: string) => Promise<VideoOembedResult | null>;
  /** Uploads one file through fcom-mobile's FluentPlayer proxy. */
  onUpload: (file: File) => Promise<PostDraftVideo | null>;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-video-sheet';
const CLOSE_EVENT = 'appza:close-video-sheet';

export function openVideoSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeVideoSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function VideoSheet() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [tab, setTab] = useState<VideoSheetTab>('oembed');
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [looked, setLooked] = useState<VideoOembedResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      // Every open starts clean. A URL left over from a sheet the user
      // dismissed would attach a video they had already decided against.
      setDetail(ce.detail);
      setTab(ce.detail.embedEnabled ? 'oembed' : 'upload');
      setUrl('');
      setHtml('');
      setLooked(null);
      setFailed(false);
      setLooking(false);
      setUploading(false);
    };
    const onClose = () => setDetail(null);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setDetail(null);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Look the URL up once it stops changing. The design shows the player
  // appearing under the field BEFORE Attach is pressed, so the lookup
  // cannot wait for the button — and firing per keystroke would ask the
  // server about every prefix of a pasted URL.
  const lookup = detail?.onLookup;
  useEffect(() => {
    if (!detail || tab !== 'oembed') return;
    const trimmed = url.trim();
    setLooked(null);
    setFailed(false);
    if (!/^https?:\/\/\S+$/i.test(trimmed)) return;
    let cancelled = false;
    setLooking(true);
    const timer = setTimeout(() => {
      void (async () => {
        const result = lookup ? await lookup(trimmed) : null;
        if (cancelled) return;
        setLooking(false);
        if (result && result.html) setLooked(result);
        else setFailed(true);
      })();
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLooking(false);
    };
  }, [url, tab, detail, lookup]);

  const vars: CSSProperties = useMemo(() => {
    const p = detail?.presentation;
    if (!p) return {};
    return {
      ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
      ['--appza-sheet-radius' as string]: p.sheetRadius,
      ['--appza-sheet-max-height' as string]: p.sheetMaxHeight,
      ['--appza-backdrop-color' as string]: p.backdropColor,
      ['--appza-handle-color' as string]: p.handleColor,
      ['--appza-eyebrow-color' as string]: p.eyebrowColor,
      ['--appza-eyebrow-size' as string]: p.eyebrowSize,
      ['--appza-title-color' as string]: p.titleColor,
      ['--appza-title-size' as string]: p.titleSize,
      ['--appza-title-weight' as string]: p.titleWeight,
      ['--appza-tab-bg-color' as string]: p.tabBgColor,
      ['--appza-tab-text-color' as string]: p.tabTextColor,
      ['--appza-tab-radius' as string]: p.tabRadius,
      ['--appza-tab-height' as string]: p.tabHeight,
      ['--appza-active-bg-color' as string]: p.activeBgColor,
      ['--appza-active-color' as string]: p.activeColor,
      ['--appza-hint-color' as string]: p.hintColor,
      ['--appza-hint-size' as string]: p.hintSize,
      ['--appza-field-bg-color' as string]: p.fieldBgColor,
      ['--appza-field-text-color' as string]: p.fieldTextColor,
      ['--appza-field-radius' as string]: p.fieldRadius,
      ['--appza-field-border-color' as string]: p.fieldBorderColor,
      ['--appza-attach-bg-color' as string]: p.attachBgColor,
      ['--appza-attach-disabled-bg-color' as string]: p.attachDisabledBgColor,
      ['--appza-attach-text-color' as string]: p.attachTextColor,
      ['--appza-attach-radius' as string]: p.attachRadius,
      ['--appza-upload-border-color' as string]: p.uploadBorderColor,
      ['--appza-upload-radius' as string]: p.uploadRadius,
      ['--appza-icon-color' as string]: p.iconColor,
      ['--appza-icon-size' as string]: p.iconSize,
    };
  }, [detail]);

  useBackDismiss(!(!detail || detail.presentation.hidden), () => setDetail(null));

  if (!detail || detail.presentation.hidden) return null;

  const p = detail.presentation;
  const slug = detail.appzetSlug ?? VIDEO_SHEET_APPZET_SLUG;
  const cs = detail.childStyles ?? {};

  const tabs: Array<{ key: VideoSheetTab; label: string; enabled: boolean }> = [
    { key: 'oembed', label: p.oembedTab, enabled: detail.embedEnabled },
    { key: 'html', label: p.htmlTab, enabled: detail.embedEnabled },
    { key: 'upload', label: p.uploadTab, enabled: detail.canUpload },
  ];
  const shownTabs = tabs.filter((t) => t.enabled);

  // The hint is per tab AND per state, which is what the designs show:
  // both text tabs read the same generic line until something is typed,
  // then each says what it actually accepts.
  const hint =
    tab === 'oembed'
      ? url.trim() === ''
        ? p.emptyHint
        : p.oembedHint
      : tab === 'html'
        ? html.trim() === ''
          ? p.emptyHint
          : p.htmlHint
        : '';

  const canAttach =
    tab === 'oembed' ? Boolean(looked) : tab === 'html' ? html.trim() !== '' : false;

  const attach = () => {
    if (tab === 'oembed' && looked) {
      setPostDraft({
        video: {
          kind: 'oembed',
          url: looked.url,
          html: looked.html,
          image: looked.image ?? '',
          provider: looked.provider ?? '',
          title: looked.title ?? '',
        },
      });
      closeVideoSheet();
      return;
    }
    if (tab === 'html' && html.trim() !== '') {
      setPostDraft({ video: { kind: 'html', html: html.trim() } });
      closeVideoSheet();
    }
  };

  const uploadIcon = resolveIcon(p.uploadIcon);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      className="appza-video-sheet-backdrop"
      style={vars}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeVideoSheet();
      }}
    >
      <div className="appza-video-sheet" {...appzetAttrs(slug)}>
        {p.showHandle && <div className="appza-video-sheet-grabber" />}

        <div className="appza-video-sheet-scroll">
          {p.showEyebrow && (
            <div
              className="appza-video-sheet-eyebrow"
              style={cs[0]}
              {...childAttrs(slug, 0, 'ion-text')}
            >
              {p.eyebrow}
            </div>
          )}
          {p.showTitle && (
            <div
              className="appza-video-sheet-title"
              style={cs[1]}
              {...childAttrs(slug, 1, 'ion-text')}
            >
              {p.title}
            </div>
          )}

          {shownTabs.length > 1 && (
            <div className="appza-video-sheet-tabs" style={cs[2]} {...childAttrs(slug, 2, 'ion-segment')}>
              {shownTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="appza-video-sheet-tab"
                  data-active={tab === t.key ? 'yes' : 'no'}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {hint !== '' && <div className="appza-video-sheet-hint">{hint}</div>}

          {tab === 'oembed' && (
            <>
              <input
                className="appza-video-sheet-field"
                style={cs[3]}
                placeholder={p.urlPlaceholder}
                value={url}
                inputMode="url"
                onChange={(e) => setUrl(e.target.value)}
                {...childAttrs(slug, 3, 'ion-input')}
              />
              {looking && <div className="appza-video-sheet-hint">…</div>}
              {failed && <div className="appza-video-sheet-error">{p.lookupFailedLabel}</div>}
              {looked && (
                <div
                  className="appza-video-sheet-preview"
                  // FluentCommunity's own oEmbed output, generated
                  // server-side from a provider allow-list — the same
                  // markup its portal renders.
                  dangerouslySetInnerHTML={{ __html: looked.html }}
                />
              )}
            </>
          )}

          {tab === 'html' && (
            <textarea
              className="appza-video-sheet-field appza-video-sheet-textarea"
              style={cs[3]}
              rows={4}
              placeholder={p.htmlPlaceholder}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          )}

          {tab === 'upload' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={p.uploadAccept}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setUploading(true);
                  void (async () => {
                    const video = await detail.onUpload(file);
                    setUploading(false);
                    if (video) {
                      // An upload has nothing left to confirm — the file is
                      // already on the server by the time it returns, so a
                      // second Attach tap would only be ceremony.
                      setPostDraft({ video });
                      closeVideoSheet();
                    }
                  })();
                }}
              />
              <button
                type="button"
                className="appza-video-sheet-dropzone"
                style={cs[4]}
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                {...childAttrs(slug, 4, 'ion-button')}
              >
                {uploadIcon && <IonIcon icon={uploadIcon} aria-hidden="true" />}
                <span className="appza-video-sheet-dropzone-text">
                  <span className="appza-video-sheet-dropzone-title">{p.uploadTitle}</span>
                  <span className="appza-video-sheet-dropzone-sub">{p.uploadSubtitle}</span>
                </span>
              </button>
            </>
          )}

          {tab !== 'upload' && (
            <button
              type="button"
              className="appza-video-sheet-attach"
              data-ready={canAttach ? 'yes' : 'no'}
              disabled={!canAttach}
              onClick={attach}
            >
              {p.attachLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The attached video, drawn the same way in the composer and in the
 * preview — designs 20 and 21.
 *
 * One function rather than two copies: the two surfaces differ only in
 * whether a discard badge rides on top, and a player that looked
 * different in the preview from the composer would defeat the preview.
 */
export function AppzaDraftVideo({
  video,
  onRemove,
  removeIcon,
}: {
  video: PostDraftVideo;
  onRemove?: () => void;
  removeIcon?: string;
}) {
  const glyph = removeIcon ? resolveIcon(removeIcon) : undefined;
  return (
    <span className="appza-draft-video" data-kind={video.kind}>
      {video.kind === 'upload' && video.media_url ? (
        // A real file, so a real player — controls, no autoplay, and
        // metadata only, because a composer should not spend the user's
        // data buffering something they are about to post.
        <video src={video.media_url} controls preload="metadata" playsInline />
      ) : video.html ? (
        <span
          className="appza-draft-video-embed"
          dangerouslySetInnerHTML={{ __html: video.html }}
        />
      ) : null}
      {onRemove && (
        <button
          type="button"
          className="appza-draft-video-remove"
          aria-label="Remove video"
          onClick={onRemove}
        >
          {glyph ? <IonIcon icon={glyph} /> : '×'}
        </button>
      )}
    </span>
  );
}

/**
 * The `media` payload for a post, built from the draft's video.
 *
 * ⚠ FluentCommunity accepts exactly two shapes here, and neither is
 * obvious from the field names:
 *
 *  - **oEmbed**: `type: 'oembed'` with a `url` it re-parses server-side.
 *    Its branch explicitly EXCLUDES `player == 'fluent_player'`.
 *  - **Pasted iframe**: `type: 'iframe_html'` — not `custom_html`, which
 *    is what we sent and which matches no branch at all. Moderators only;
 *    FeedsHelper::canEmbedRawHtml drops it for anyone else.
 *
 * A FluentPlayer UPLOAD is neither. It is picked up by a different
 * plugin entirely — FluentCommunity's FluentPlayer module hooks
 * `new_feed_data` and looks for `media.player == 'fluent_player'`, the
 * PLAYER key, not the type. We were sending `type: 'fluent_player'` with
 * no `player` key, so FluentCommunity's branch skipped it (wrong type)
 * and FluentPlayer's skipped it too (no player) — the upload vanished
 * between them, silently, and the post published with no video.
 *
 * The shape below is copied from what the portal actually stored for an
 * uploaded video on this site, field for field, rather than inferred.
 *
 * Returns null when the draft's video has nothing usable, so the caller
 * can leave `media` off the body entirely.
 */
export function buildVideoMediaPayload(
  video: PostDraftVideo,
): Record<string, unknown> | null {
  if (video.kind === 'oembed' && video.url) {
    return { type: 'oembed', url: video.url };
  }
  if (video.kind === 'html' && video.html) {
    return { type: 'iframe_html', html: video.html };
  }
  if (video.kind === 'upload' && video.media_id && video.media_url) {
    const title = video.title ?? '';
    return {
      // 'oembed' is right even for an upload: that is the type
      // FluentPlayer stores, and `player` is what routes it away from
      // FluentCommunity's own oEmbed parser.
      type: 'oembed',
      url: video.media_url,
      content_type: 'video',
      player: 'fluent_player',
      provider: 'upload',
      title,
      media_id: video.media_id,
      settings: { src: video.media_url, title, viewType: 'video' },
    };
  }
  return null;
}

function envelopeItems(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object') return null;
  const rec = json as Record<string, unknown>;
  const items = rec.items;
  if (items && typeof items === 'object' && !Array.isArray(items)) {
    return items as Record<string, unknown>;
  }
  return null;
}

function s(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/**
 * Look a video URL up through fcom-mobile's `/feeds/oembed`.
 *
 * ⚠ The URL rides the QUERY STRING even though the route is a POST.
 * fcom-mobile's handler forwards `get_query_params()` to FluentCommunity
 * and nothing else, so a JSON body reaches the endpoint and is dropped —
 * the call answers 422 "No oembed data found" for a URL that resolves
 * perfectly well. That is how this arrived: the previous implementation
 * posted a body and had never worked.
 *
 * One implementation, called by both shells with their own auth header
 * and their own resolved endpoint (P100).
 */
export async function lookupVideoOembed(
  url: string,
  endpoint: string,
  authHeader: string,
): Promise<VideoOembedResult | null> {
  const sep = endpoint.includes('?') ? '&' : '?';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  try {
    const res = await fetch(`${endpoint}${sep}url=${encodeURIComponent(url)}`, {
      method: 'POST',
      credentials: 'omit',
      headers,
    });
    const json = await res.json().catch(() => null);
    const items = envelopeItems(json);
    if (!res.ok || !items || s(items.html) === '') return null;
    return {
      html: s(items.html),
      url: s(items.url) || url,
      provider: s(items.provider),
      title: s(items.title),
      image: s(items.image),
    };
  } catch {
    return null;
  }
}

/**
 * Upload one video (or audio) file through fcom-mobile's FluentPlayer
 * proxy. Every gate — the plugin being active, the `video_upload` switch,
 * the viewer's role, the mime type, the file size — is FluentCommunity's
 * and is enforced upstream, so a refusal comes back as its message.
 */
export async function uploadDraftVideo(
  file: File,
  endpoint: string,
  authHeader: string,
  kind: 'video' | 'audio' = 'video',
): Promise<PostDraftVideo | null> {
  const form = new FormData();
  form.append('file', file);
  form.append('media_kind', kind);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      headers,
      body: form,
    });
    const json = await res.json().catch(() => null);
    const items = envelopeItems(json);
    if (!res.ok || !items) return null;
    const mediaUrl = s(items.public_url) || s(items.url) || s(items.media_url);
    if (mediaUrl === '') return null;
    return {
      kind: 'upload',
      media_id: s(items.id) || s(items.media_id),
      media_url: mediaUrl,
      // The portal stores the filename on the media_preview, and the
      // player shows it. Prefer whatever the server named the file;
      // fall back to what was picked.
      title: s(items.title) || file.name,
    };
  } catch {
    return null;
  }
}

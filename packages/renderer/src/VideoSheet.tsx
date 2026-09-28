import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';

import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { setPostDraft, type PostDraftVideo } from './postDraft';
import { useBackDismiss } from './backStack';

// The Upload tab gate is per-viewer, so it comes from the space-picker payload, not the cached bootstrap.

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
  canUpload: boolean;
  embedEnabled: boolean;
  onLookup: (url: string) => Promise<VideoOembedResult | null>;
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
      // Every open starts clean, or a dismissed URL would still attach.
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

  // Debounced: the design shows the player before Attach, and per-keystroke would query every prefix.
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

// FC takes only `oembed` (url) or `iframe_html` (moderators); an upload needs `player: 'fluent_player'` or FC and FluentPlayer both skip it.
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
      // 'oembed' even for an upload: `player` routes it to FluentPlayer instead of FC's parser.
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

// The URL rides the query string: fcom-mobile forwards only query params, so a JSON body is dropped (422).
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
      title: s(items.title) || file.name,
    };
  } catch {
    return null;
  }
}

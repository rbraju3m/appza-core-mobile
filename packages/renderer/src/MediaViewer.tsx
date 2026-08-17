import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { useInsideDeviceViewport } from './insideDeviceViewport';

// Fullscreen photo viewer for the MEDIA sub-tab.
//
// Bespoke React, opened by event, like the schedule sheet and the modals —
// it owns paging state and keyboard/swipe handling, and it has to sit
// above the whole screen rather than in a placement slot. It opts back
// into the builder by hand via childAttrs/appzetAttrs, so the indices
// below MUST match the `children` array of the fc-media-viewer
// superstructure in the catalog.
//
// Photos only. A video tap goes straight to its post (Noor's spec), so
// this never has to host a player.

export const MEDIA_VIEWER_APPZET_SLUG = 'fc-media-viewer';

/** One photo the viewer can page to. */
export type MediaViewerItem = {
  url: string;
  title?: string;
  feed_slug?: string;
  feed_id?: number | string;
};

export type MediaViewerPresentation = {
  closeIcon: string;
  downloadIcon: string;
  downloadLabel: string;
  viewPostIcon: string;
  viewPostLabel: string;
  counterSeparator: string;
  hidden: boolean;
  showCounter: boolean;
  showClose: boolean;
  showDownload: boolean;
  showViewPost: boolean;
  // style knobs — all optional, all fall back to the stock design
  backdropColor?: string;
  counterColor?: string;
  counterSize?: string;
  closeIconColor?: string;
  imageRadius?: string;
  actionTextColor?: string;
  actionIconColor?: string;
  actionTextSize?: string;
  actionGap?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  items: MediaViewerItem[];
  /** Which item the grid tap landed on. */
  index?: number;
  presentation: MediaViewerPresentation;
  /** Save the given item to the device. Each shell does this its own way. */
  onDownload?: (item: MediaViewerItem) => void;
  /** Navigate to the post the item was shared in. */
  onViewPost?: (item: MediaViewerItem) => void;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-media-viewer';
const CLOSE_EVENT = 'appza:close-media-viewer';
const PATCH_EVENT = 'appza:patch-media-viewer';

/** Distance a horizontal drag must cover before it counts as a page turn. */
const SWIPE_THRESHOLD_PX = 50;

export function openMediaViewer(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeMediaViewer(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

/** Live-preview patch from the builder, addressed by AppZet slug. */
export function patchMediaViewer(
  appzetSlug: string,
  patch: {
    presentation?: MediaViewerPresentation;
    childStyles?: Record<number, CSSProperties>;
  },
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PATCH_EVENT, { detail: { appzetSlug, patch } }));
}

/* ---------------------------------------------------------------- */

export function MediaViewer() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const embedded = useInsideDeviceViewport(open);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      const items = Array.isArray(ce.detail.items) ? ce.detail.items : [];
      if (items.length === 0) return;
      const wanted = typeof ce.detail.index === 'number' ? ce.detail.index : 0;
      setDetail(ce.detail);
      setIndex(Math.min(items.length - 1, Math.max(0, wanted)));
      setOpen(true);
    };
    const onClose = () => setOpen(false);
    const onPatch = (e: Event) => {
      const ce = e as CustomEvent<{
        appzetSlug: string;
        patch: {
          presentation?: MediaViewerPresentation;
          childStyles?: Record<number, CSSProperties>;
        };
      }>;
      if (!ce.detail) return;
      setDetail((prev) => {
        if (!prev) return prev;
        const mine = prev.appzetSlug ?? MEDIA_VIEWER_APPZET_SLUG;
        return mine === ce.detail.appzetSlug ? { ...prev, ...ce.detail.patch } : prev;
      });
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener(PATCH_EVENT, onPatch);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener(PATCH_EVENT, onPatch);
    };
  }, []);

  const total = detail?.items.length ?? 0;

  const step = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = i + delta;
        if (next < 0 || next > total - 1) return i;
        return next;
      });
    },
    [total],
  );

  // Escape closes, arrows page. Bound only while open so the viewer never
  // eats keys belonging to the screen underneath.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  const p = detail?.presentation;
  if (!open || !detail || !p || p.hidden) return null;

  const item = detail.items[index];
  if (!item) return null;

  const slug = detail.appzetSlug ?? MEDIA_VIEWER_APPZET_SLUG;
  const childStyle = (i: number) => detail.childStyles?.[i];

  const vars: Record<string, string> = {};
  const put = (name: string, value?: string) => {
    if (value) vars[name] = value;
  };
  put('--appza-mv-backdrop', p.backdropColor);
  put('--appza-mv-counter-color', p.counterColor);
  put('--appza-mv-counter-size', p.counterSize);
  put('--appza-mv-close-color', p.closeIconColor);
  put('--appza-mv-image-radius', p.imageRadius);
  put('--appza-mv-action-color', p.actionTextColor);
  put('--appza-mv-action-icon-color', p.actionIconColor);
  put('--appza-mv-action-size', p.actionTextSize);
  put('--appza-mv-action-gap', p.actionGap);

  const closeIcon = resolveIcon(p.closeIcon || 'close');
  const downloadIcon = resolveIcon(p.downloadIcon || 'download-outline');
  const viewPostIcon = resolveIcon(p.viewPostIcon || 'eye-outline');

  return (
    <div
      className={`appza-media-viewer${embedded ? ' appza-media-viewer-embedded' : ''}`}
      style={vars as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const startX = touchStartX.current;
        touchStartX.current = null;
        if (startX == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
        step(dx < 0 ? 1 : -1);
      }}
      {...appzetAttrs(slug)}
    >
      <div className="appza-media-viewer-header">
        {p.showCounter && (
          <span
            className="appza-media-viewer-counter"
            style={childStyle(0)}
            {...childAttrs(slug, 0, 'ion-text')}
          >
            {index + 1}
            {p.counterSeparator || '/'}
            {total}
          </span>
        )}
        {p.showClose && (
          <button
            type="button"
            className="appza-media-viewer-close"
            style={childStyle(1)}
            onClick={() => setOpen(false)}
            aria-label="Close"
            {...childAttrs(slug, 1, 'ion-button')}
          >
            {closeIcon && <IonIcon icon={closeIcon} />}
          </button>
        )}
      </div>

      <div className="appza-media-viewer-body">
        <img
          className="appza-media-viewer-image"
          src={item.url}
          alt={item.title ?? ''}
          style={childStyle(2)}
          {...childAttrs(slug, 2, 'ion-img')}
        />
      </div>

      <div className="appza-media-viewer-actions">
        {p.showDownload && (
          <button
            type="button"
            className="appza-media-viewer-action"
            style={childStyle(3)}
            onClick={() => detail.onDownload?.(item)}
            {...childAttrs(slug, 3, 'ion-button')}
          >
            {downloadIcon && <IonIcon icon={downloadIcon} />}
            <span>{p.downloadLabel}</span>
          </button>
        )}
        {p.showViewPost && (
          <button
            type="button"
            className="appza-media-viewer-action"
            style={childStyle(4)}
            onClick={() => {
              // Close first: the viewer is a sibling of the screen tree,
              // and leaving it mounted over the pushed post-detail screen
              // would cover the thing the user just asked to see.
              setOpen(false);
              detail.onViewPost?.(item);
            }}
            {...childAttrs(slug, 4, 'ion-button')}
          >
            {viewPostIcon && <IonIcon icon={viewPostIcon} />}
            <span>{p.viewPostLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}

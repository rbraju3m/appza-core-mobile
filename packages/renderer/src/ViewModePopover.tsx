import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { setFeedControls, type FeedViewMode } from './feedControls';
import { setSpacesControls, type SpacesSort } from './spacesControls';
import { resolveIcon } from './PrimitiveRenderer';

// Floating popover anchored to a DOM element, with a small list of
// {value,label,icon?} options. Selecting an option calls
// setFeedControls({viewMode}) and closes the popover. Opened via the
// `openViewModePopover(...)` helper below — the App-side dispatcher for
// `feed.set_view_mode` calls it after resolving the anchor from the
// toolbar's stamped data attributes.
//
// Kept in the renderer package so both mobile + plugin-admin can mount
// one <ViewModePopover /> at the app root and share the exact same UX.

export type ViewModeOption = {
  value: string;
  label: string;
  icon?: string;
};

const OPEN_EVENT = 'appza:open-view-mode-popover';

export type PopoverStateKey = 'sort' | 'viewMode' | 'spaces_sort';

type OpenDetail = {
  options: ViewModeOption[];
  anchorRect: DOMRect;
  stateKey: PopoverStateKey;
};

export function openViewModePopover(
  options: ViewModeOption[],
  anchorEl: Element | null,
  stateKey: PopoverStateKey = 'viewMode',
): void {
  if (typeof window === 'undefined') return;
  const rect = anchorEl?.getBoundingClientRect();
  if (!rect) {
    console.warn('[appza-renderer] openViewModePopover: no anchor rect');
    return;
  }
  window.dispatchEvent(
    new CustomEvent<OpenDetail>(OPEN_EVENT, {
      detail: { options, anchorRect: rect, stateKey },
    }),
  );
}

export function ViewModePopover() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: Event) => {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(ev.target as Node)) return;
      setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    // Bind on the next tick so the click that opened us doesn't
    // immediately close us.
    const touchOpts: AddEventListenerOptions = { capture: true, passive: true };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDoc, true);
      document.addEventListener('touchstart', onDoc, touchOpts);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('touchstart', onDoc, touchOpts);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open || !detail) return null;

  // Anchor to the right edge of the trigger button, top-aligned to its
  // bottom (dropdown-below convention). Clamp to viewport.
  const menuWidth = 180;
  const gap = 6;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0;
  const rawLeft = detail.anchorRect.right - menuWidth;
  const left = Math.max(8, Math.min(rawLeft, viewportW - menuWidth - 8));
  const top = detail.anchorRect.bottom + gap;

  const handlePick = (value: string) => {
    if (detail.stateKey === 'sort') {
      setFeedControls({ sort: value });
    } else if (detail.stateKey === 'spaces_sort') {
      // Sort keys are catalog-driven now (fc-space-card.sort_specs).
      // Any non-empty string is accepted; the renderer's spec lookup
      // falls back to title-asc when the value isn't mapped.
      if (typeof value === 'string' && value.length > 0) {
        setSpacesControls({ sort: value as SpacesSort });
      }
    } else if (value === 'timeline' || value === 'card' || value === 'list') {
      setFeedControls({ viewMode: value as FeedViewMode });
    }
    setOpen(false);
  };

  return (
    <div
      ref={popoverRef}
      className="appza-view-mode-popover"
      role="menu"
      style={{
        position: 'fixed',
        top,
        left,
        width: menuWidth,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
        zIndex: 10000,
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {detail.options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="menuitem"
          onClick={() => handlePick(opt.value)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            font: 'inherit',
            cursor: 'pointer',
            borderRadius: 6,
            color: '#111827',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {opt.icon && (() => {
            const resolved = resolveIcon(opt.icon);
            return resolved ? (
              <IonIcon
                icon={resolved}
                style={{ fontSize: 18, color: '#4b5563' }}
              />
            ) : null;
          })()}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

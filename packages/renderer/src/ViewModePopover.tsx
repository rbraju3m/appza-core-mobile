import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { setFeedControls, type FeedViewMode } from './feedControls';
import { setSpacesControls, type SpacesSort } from './spacesControls';
import { setSpaceDetailControls } from './spaceDetailControls';
import { setBookmarkControls, type BookmarkViewMode } from './bookmarkControls';
import { setPostDetailControls } from './postDetailControls';
import { setProfileControls } from './profileControls';
import { setMemberDirectoryControls } from './memberDirectoryControls';
import { setCourseListControls } from './courseListControls';
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

/**
 * Read an action wiring's `args.options` into the {value,label,icon}
 * rows a picker draws. Every option list in the catalog has this shape,
 * and every dispatcher case was parsing it again by hand.
 */
export function readPickerOptions(raw: unknown): ViewModeOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o))
    .map((o) => ({
      value: typeof o.value === 'string' ? o.value : '',
      label: typeof o.label === 'string' ? o.label : '',
      icon: typeof o.icon === 'string' ? o.icon : undefined,
    }))
    .filter((o) => o.value && o.label);
}

const OPEN_EVENT = 'appza:open-view-mode-popover';

export type PopoverStateKey =
  | 'sort'
  | 'viewMode'
  | 'spaces_sort'
  | 'space_detail_sort'
  | 'bookmarks_sort'
  | 'bookmarks_view_mode'
  | 'post_detail_comment_sort'
  | 'profile_follow_sort'
  | 'member_directory_sort_by'
  | 'member_directory_sort_dir'
  | 'course_list_sort';

/**
 * Write a picked option into whichever control slice the key names.
 *
 * Lives here rather than inside the popover because the Saved Posts
 * screen draws the SAME choice as a bottom sheet (Noor's designs 3 and
 * 5) — two frames, one rule about what a pick means. Splitting it would
 * be two places to add the next state key to, and one of them would get
 * forgotten.
 */
export function applyControlPick(stateKey: PopoverStateKey, value: string): void {
  if (stateKey === 'sort') {
    setFeedControls({ sort: value });
    return;
  }
  if (stateKey === 'spaces_sort') {
    // Sort keys are catalog-driven now (fc-space-card.sort_specs).
    // Any non-empty string is accepted; the renderer's spec lookup
    // falls back to title-asc when the value isn't mapped.
    if (value.length > 0) setSpacesControls({ sort: value as SpacesSort });
    return;
  }
  if (stateKey === 'space_detail_sort') {
    // fc-space-post-toolbar sort. Writes into spaceDetailControls.sort;
    // fc-space-feeds' order_by_type query_param binds to this state key
    // and auto-refetches when it changes.
    if (value.length > 0) setSpaceDetailControls({ sort: value });
    return;
  }
  if (stateKey === 'bookmarks_sort') {
    // fc-bookmarks binds order_by_type to this key, so the pick is a
    // refetch — same contract as space_detail_sort above.
    if (value.length > 0) setBookmarkControls({ sort: value });
    return;
  }
  if (stateKey === 'post_detail_comment_sort') {
    // The one pick here that is NOT a refetch. FluentCommunity's
    // getComments is hardcoded to created_at ASC and takes no sort
    // parameter, so the thread component reorders rows it already holds
    // — see postDetailControls.comment_sort. `touched` is what stops the
    // next payload's space default overwriting the choice.
    if (value.length > 0) {
      setPostDetailControls({ comment_sort: value, comment_sort_touched: true });
    }
    return;
  }
  if (stateKey === 'profile_follow_sort') {
    // A refetch, unlike the comment sort directly above: FC's
    // FollowController reads sort_by ('id' | 'alphabetical') and both
    // follow DataSources bind it as a query param.
    if (value.length > 0) setProfileControls({ follow_sort: value });
    return;
  }
  if (stateKey === 'member_directory_sort_by') {
    // All Members. Both halves of the sort sheet are refetches: the
    // directory and its summary bind sort_by + sort_dir as query params,
    // and FluentCommunity sorts server-side.
    if (value.length > 0) setMemberDirectoryControls({ sort_by: value });
    return;
  }
  if (stateKey === 'member_directory_sort_dir') {
    if (value.length > 0) setMemberDirectoryControls({ sort_dir: value });
    return;
  }
  if (stateKey === 'course_list_sort') {
    // Courses (state 4). A refetch: fc-course-list binds sort_by, and
    // FluentCommunity sorts server-side.
    if (value.length > 0) setCourseListControls({ sort_by: value });
    return;
  }
  if (stateKey === 'bookmarks_view_mode') {
    if (value === 'timeline' || value === 'card' || value === 'list') {
      setBookmarkControls({ viewMode: value as BookmarkViewMode });
    }
    return;
  }
  if (value === 'timeline' || value === 'card' || value === 'list') {
    setFeedControls({ viewMode: value as FeedViewMode });
  }
}

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
    applyControlPick(detail.stateKey, value);
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

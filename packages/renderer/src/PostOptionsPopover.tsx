import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { readDataPath } from './dataFetch';
import { resolveIcon } from './PrimitiveRenderer';
import { childAttrs, appzetAttrs } from './designTimeAttrs';

// Floating overflow menu anchored to a post-card's 3-dot button. Opened
// via `openPostOptionsPopover(items, item, anchorEl)` — the App-side
// dispatcher for `post.options` calls it after resolving the tapped
// button's DOM rect.
//
// Menu shape is 100% catalog-driven: each `PostMenuItem` entry names an
// `action_slug` + optional `args`, and its label + icon + visibility are
// read straight from the catalog wiring. On tap the popover dispatches
// through the shared `useActionDispatch()` context — the same dispatcher
// that handles every other AppZet action — so per-item cases live in one
// place (App.tsx) and this component stays presentation-only.

/** One row in the overflow menu. Mirrors the shape stored in the catalog. */
export type PostMenuItem = {
  action_slug: string;
  args?: Record<string, unknown>;

  /** Static label used when `state_path` is not set. */
  label?: string;
  /** Toggle-mode label shown when the item's state resolves truthy. */
  label_on?: string;
  /** Toggle-mode label shown when the item's state resolves falsy. */
  label_off?: string;

  /** Ionicon slug rendered at the leading edge. */
  icon?: string;

  /**
   * Dotted path (relative to the tapped item) whose truthiness hides
   * the row when falsy. E.g. `data.permissions.can_edit`.
   */
  visible_when?: string;
  /**
   * Dotted path resolved against the item to pick label_on vs label_off.
   * Used by pin/disable-comments toggles.
   */
  state_path?: string;
  /**
   * Values considered "on" for the toggle. Defaults to standard truthy
   * behavior; fcom-mobile surfaces `comments_disabled` as the string
   * `'yes'`, which needs an explicit truthy allowlist.
   */
  state_truthy_values?: Array<unknown>;
  /** Render the row in the destructive color (Delete). */
  destructive?: boolean;
};

const OPEN_EVENT = 'appza:open-post-options-popover';

/**
 * The bottom-sheet frame (Noor's design 4). Supplied by the shell from
 * the fc-post-menu-sheet overlay AppZet when the opening action's
 * `presentation` arg says `sheet`; absent means the anchored popover
 * every other screen has always used.
 *
 * The frame is ALL this changes. Which rows exist, who may see each of
 * them and what a toggle row is currently called are decided once,
 * below, for both.
 */
export type PostMenuSheetPresentation = {
  eyebrow: string;
  hidden: boolean;
  showHandle: boolean;
  showEyebrow: boolean;
  showRowIcons: boolean;
  sheetBgColor?: string;
  sheetRadius?: string;
  sheetMaxHeight?: string;
  backdropColor?: string;
  handleColor?: string;
  eyebrowColor?: string;
  eyebrowSize?: string;
  eyebrowWeight?: string;
  rowPadding?: string;
  rowGap?: string;
  labelColor?: string;
  labelSize?: string;
  iconColor?: string;
  iconSize?: string;
  /** Empty means destructive rows read like every other row — the design. */
  destructiveColor?: string;
  dividerColor?: string;
};

export const POST_MENU_SHEET_APPZET_SLUG = 'fc-post-menu-sheet';
export const POST_MENU_SHEET_CHILD_COUNT = 3;

export type PostMenuSheetOptions = {
  appzetSlug?: string;
  presentation: PostMenuSheetPresentation;
  childStyles?: Record<number, CSSProperties>;
};

type OpenDetail = {
  items: PostMenuItem[];
  /** Absent in sheet mode — a sheet is anchored to the screen, not a button. */
  anchorRect: DOMRect | null;
  item: unknown;
  sheet?: PostMenuSheetOptions;
};

export function openPostOptionsPopover(
  items: PostMenuItem[],
  item: unknown,
  anchorEl: Element | null,
  sheet?: PostMenuSheetOptions,
): void {
  if (typeof window === 'undefined') return;
  const rect = anchorEl?.getBoundingClientRect() ?? null;
  // Only the popover needs somewhere to point. A sheet rises from the
  // bottom of the screen, so a missing anchor is not a reason to swallow
  // the tap.
  if (!rect && !sheet) {
    console.warn('[appza-renderer] openPostOptionsPopover: no anchor rect');
    return;
  }
  window.dispatchEvent(
    new CustomEvent<OpenDetail>(OPEN_EVENT, {
      detail: { items, anchorRect: rect, item, sheet },
    }),
  );
}

/**
 * Resolve a dotted path (e.g. `data.permissions.can_edit`) against the
 * tapped item. The dispatcher already unwrapped the `{ data: <row> }`
 * envelope by the time the item lands here, so we delegate to the
 * renderer's canonical readDataPath which strips the required `data.`
 * prefix and then walks the row.
 */
function readPath(root: unknown, path: string): unknown {
  if (!path) return undefined;
  return readDataPath(root, path);
}

// `readActionDefaultsFromCatalog` used to live here. It is catalog
// access, not popover code, and PrimitiveRenderer needs it too — which
// it cannot have while this module imports `resolveIcon` from
// PrimitiveRenderer. Moved to catalogIndex (a leaf), re-exported here so
// existing importers are untouched.
export { readActionDefaultsFromCatalog } from './catalogIndex';
import { readActionDefaultsFromCatalog } from './catalogIndex';


/**
 * Publish the current catalog snapshot on `window.__appzaCatalog` so the
 * popover can look up per-action defaults. Call once whenever the shell
 * loads or refreshes its catalog.
 */
export function setCatalogGlobal(catalog: unknown): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __appzaCatalog?: unknown }).__appzaCatalog = catalog;
}

function isTruthy(value: unknown, allowlist?: Array<unknown>): boolean {
  if (allowlist && allowlist.length > 0) {
    return allowlist.some((v) => v === value);
  }
  if (value === null || value === undefined) return false;
  if (value === 0 || value === '' || value === '0' || value === 'no') return false;
  return Boolean(value);
}

export function PostOptionsPopover() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const dispatch = useActionDispatch();

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

  // Filter items by their catalog-defined `visible_when` path resolved
  // against the tapped item's permissions bag (surfaced by fcom-mobile).
  const visibleItems = detail.items.filter((it) => {
    if (!it.visible_when) return true;
    return isTruthy(readPath(detail.item, it.visible_when));
  });

  if (visibleItems.length === 0) {
    // Nothing to show — close immediately so the anchor isn't left in an
    // odd "opened but empty" state.
    setOpen(false);
    return null;
  }

  const handlePick = (menuItem: PostMenuItem) => {
    setOpen(false);
    // Menu-item entries only carry action_slug + display metadata; the
    // action's HTTP shape (endpoint / method / patch_key / body_key / etc.)
    // lives on the Action row's param_schema defaults. Merge those in so
    // the dispatcher receives a fully-populated args bag. Menu-item args
    // (rare — used for per-item overrides) win over param_schema defaults.
    const actionDefaults = readActionDefaultsFromCatalog(menuItem.action_slug);
    const mergedArgs =
      actionDefaults || menuItem.args
        ? { ...(actionDefaults ?? {}), ...(menuItem.args ?? {}) }
        : undefined;
    dispatch({
      action_slug: menuItem.action_slug,
      args: mergedArgs,
      item: detail.item,
    });
  };

  /**
   * A toggle row's label depends on the tapped post's current state
   * ("Pin to top" vs "Unpin from top"), which is why the label is
   * resolved here rather than read straight off the catalog entry.
   * Shared by both frames — the sheet must never call the same row
   * something different from the popover.
   */
  const labelFor = (menuItem: PostMenuItem): string => {
    if (!menuItem.state_path) return menuItem.label ?? '';
    const stateOn = isTruthy(
      readPath(detail.item, menuItem.state_path),
      menuItem.state_truthy_values,
    );
    return stateOn
      ? (menuItem.label_on ?? menuItem.label ?? '')
      : (menuItem.label_off ?? menuItem.label ?? '');
  };

  // === Bottom sheet (design 4) ===
  if (detail.sheet) {
    const p = detail.sheet.presentation;
    if (p.hidden) return null;
    const slug = detail.sheet.appzetSlug ?? POST_MENU_SHEET_APPZET_SLUG;
    const cs = detail.sheet.childStyles ?? {};
    const vars: CSSProperties = {
      ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
      ['--appza-sheet-radius' as string]: p.sheetRadius,
      ['--appza-sheet-max-height' as string]: p.sheetMaxHeight,
      ['--appza-backdrop-color' as string]: p.backdropColor,
      ['--appza-handle-color' as string]: p.handleColor,
      ['--appza-eyebrow-color' as string]: p.eyebrowColor,
      ['--appza-eyebrow-size' as string]: p.eyebrowSize,
      ['--appza-eyebrow-weight' as string]: p.eyebrowWeight,
      ['--appza-row-padding' as string]: p.rowPadding,
      ['--appza-row-gap' as string]: p.rowGap,
      ['--appza-label-color' as string]: p.labelColor,
      ['--appza-label-size' as string]: p.labelSize,
      ['--appza-icon-color' as string]: p.iconColor,
      ['--appza-icon-size' as string]: p.iconSize,
      // Empty means destructive rows inherit the label colour, which is
      // what design 4 draws — Delete reads like everything above it.
      ['--appza-destructive-color' as string]: p.destructiveColor || undefined,
      ['--appza-divider-color' as string]: p.dividerColor,
    };
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p.eyebrow}
        className="appza-post-menu-sheet-backdrop"
        style={vars}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="appza-post-menu-sheet" ref={popoverRef} {...appzetAttrs(slug)}>
          {p.showHandle && <div className="appza-post-menu-sheet-grabber" />}
          <div className="appza-post-menu-sheet-scroll">
            {p.showEyebrow && (
              <div
                className="appza-post-menu-sheet-eyebrow"
                style={cs[0]}
                {...childAttrs(slug, 0, 'ion-text')}
              >
                {p.eyebrow}
              </div>
            )}
            {visibleItems.map((menuItem, i) => {
              const resolved = menuItem.icon ? resolveIcon(menuItem.icon) : null;
              // Row zero carries the template attrs. Stamping every row
              // would give the right panel several elements all claiming
              // to be children[1] (P73 / P90).
              const isTemplateRow = i === 0;
              return (
                <button
                  key={menuItem.action_slug}
                  type="button"
                  role="menuitem"
                  className={
                    menuItem.destructive
                      ? 'appza-post-menu-sheet-row is-destructive'
                      : 'appza-post-menu-sheet-row'
                  }
                  onClick={() => handlePick(menuItem)}
                >
                  {p.showRowIcons && (
                    <span
                      className="appza-post-menu-sheet-row-icon"
                      style={cs[1]}
                      {...(isTemplateRow ? childAttrs(slug, 1, 'ion-icon') : {})}
                    >
                      {resolved ? <IonIcon icon={resolved} /> : null}
                    </span>
                  )}
                  <span
                    className="appza-post-menu-sheet-row-label"
                    style={cs[2]}
                    {...(isTemplateRow ? childAttrs(slug, 2, 'ion-text') : {})}
                  >
                    {labelFor(menuItem)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // === Anchored popover (the feed, spaces, post-detail) ===
  // Anchor to the right edge of the trigger button; drop down below it
  // with a small gap. Clamped to the viewport.
  const menuWidth = 200;
  const gap = 6;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0;
  const anchor = detail.anchorRect;
  if (!anchor) return null;
  const rawLeft = anchor.right - menuWidth;
  const left = Math.max(8, Math.min(rawLeft, viewportW - menuWidth - 8));
  const top = anchor.bottom + gap;

  return (
    <div
      ref={popoverRef}
      className="appza-post-options-popover"
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
      {visibleItems.map((menuItem) => {
        const color = menuItem.destructive ? '#dc2626' : '#111827';
        const iconColor = menuItem.destructive ? '#dc2626' : '#4b5563';
        const resolved = menuItem.icon ? resolveIcon(menuItem.icon) : null;
        return (
          <button
            key={menuItem.action_slug}
            type="button"
            role="menuitem"
            onClick={() => handlePick(menuItem)}
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
              color,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {resolved && (
              <IonIcon icon={resolved} style={{ fontSize: 18, color: iconColor }} />
            )}
            <span>{labelFor(menuItem)}</span>
          </button>
        );
      })}
    </div>
  );
}

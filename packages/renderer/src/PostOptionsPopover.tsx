import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { readDataPath } from './dataFetch';
import { resolveIcon } from './PrimitiveRenderer';
import { childAttrs, appzetAttrs } from './designTimeAttrs';

export type PostMenuItem = {
  action_slug: string;
  args?: Record<string, unknown>;

  label?: string;
  label_on?: string;
  label_off?: string;

  icon?: string;

  /** Path(s) that must all resolve truthy for the row to show. */
  visible_when?: string | string[];
  state_path?: string;
  /** Values counted as on; fcom-mobile sends comments_disabled as 'yes'. */
  state_truthy_values?: Array<unknown>;
  destructive?: boolean;
};

const OPEN_EVENT = 'appza:open-post-options-popover';

export type PostMenuSheetPresentation = {
  eyebrow: string;
  title?: string;
  showTitle?: boolean;
  titleColor?: string;
  titleSize?: string;
  titleWeight?: string;
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
  destructiveColor?: string;
  dividerColor?: string;
};

export const POST_MENU_SHEET_APPZET_SLUG = 'fc-post-menu-sheet';
export const POST_MENU_SHEET_CHILD_COUNT = 4;

export type PostMenuSheetOptions = {
  appzetSlug?: string;
  eyebrowPath?: string;
  presentation: PostMenuSheetPresentation;
  childStyles?: Record<number, CSSProperties>;
};

type OpenDetail = {
  items: PostMenuItem[];
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

function readPath(root: unknown, path: string): unknown {
  if (!path) return undefined;
  return readDataPath(root, path);
}

// readActionDefaultsFromCatalog lives in catalogIndex (PrimitiveRenderer needs it too); re-exported for existing importers.
export { readActionDefaultsFromCatalog } from './catalogIndex';
import { readActionDefaultsFromCatalog } from './catalogIndex';
import { useBackDismiss } from './backStack';

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

  useBackDismiss(!(!open || !detail), () => setOpen(false));

  if (!open || !detail) return null;

  // An empty visible_when list means show.
  const visibleItems = detail.items.filter((it) => {
    const vw = it.visible_when;
    if (!vw) return true;
    if (Array.isArray(vw)) {
      return vw.every((path) => !path || isTruthy(readPath(detail.item, path)));
    }
    return isTruthy(readPath(detail.item, vw));
  });

  if (visibleItems.length === 0) {
    setOpen(false);
    return null;
  }

  const handlePick = (menuItem: PostMenuItem) => {
    setOpen(false);
    // Merge the action's param_schema defaults; menu-item args win.
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

  if (detail.sheet) {
    const p = detail.sheet.presentation;
    if (p.hidden) return null;
    const slug = detail.sheet.appzetSlug ?? POST_MENU_SHEET_APPZET_SLUG;
    const cs = detail.sheet.childStyles ?? {};
    const eyebrowPath = detail.sheet.eyebrowPath;
    const pathEyebrow = eyebrowPath ? readPath(detail.item, eyebrowPath) : undefined;
    const eyebrowText =
      typeof pathEyebrow === 'string' && pathEyebrow.trim() !== ''
        ? pathEyebrow.toUpperCase()
        : p.eyebrow;
    const vars: CSSProperties = {
      ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
      ['--appza-sheet-radius' as string]: p.sheetRadius,
      ['--appza-sheet-max-height' as string]: p.sheetMaxHeight,
      ['--appza-backdrop-color' as string]: p.backdropColor,
      ['--appza-handle-color' as string]: p.handleColor,
      ['--appza-eyebrow-color' as string]: p.eyebrowColor,
      ['--appza-eyebrow-size' as string]: p.eyebrowSize,
      ['--appza-eyebrow-weight' as string]: p.eyebrowWeight,
      ['--appza-title-color' as string]: p.titleColor,
      ['--appza-title-size' as string]: p.titleSize,
      ['--appza-title-weight' as string]: p.titleWeight,
      ['--appza-row-padding' as string]: p.rowPadding,
      ['--appza-row-gap' as string]: p.rowGap,
      ['--appza-label-color' as string]: p.labelColor,
      ['--appza-label-size' as string]: p.labelSize,
      ['--appza-icon-color' as string]: p.iconColor,
      ['--appza-icon-size' as string]: p.iconSize,
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
                {eyebrowText}
              </div>
            )}
            {p.showTitle !== false && p.title && (
              <div
                className="appza-post-menu-sheet-title"
                style={cs[3]}
                {...childAttrs(slug, 3, 'ion-text')}
              >
                {p.title}
              </div>
            )}
            {visibleItems.map((menuItem, i) => {
              const resolved = menuItem.icon ? resolveIcon(menuItem.icon) : null;
              // Only row zero carries the template attrs, or the builder sees several children[1].
              const isTemplateRow = i === 0;
              return (
                <button
                  key={`${menuItem.action_slug}-${i}`}
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
      {visibleItems.map((menuItem, i) => {
        const color = menuItem.destructive ? '#dc2626' : '#111827';
        const iconColor = menuItem.destructive ? '#dc2626' : '#4b5563';
        const resolved = menuItem.icon ? resolveIcon(menuItem.icon) : null;
        return (
          <button
            key={`${menuItem.action_slug}-${i}`}
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

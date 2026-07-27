import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { readDataPath } from './dataFetch';
import { resolveIcon } from './PrimitiveRenderer';

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

type OpenDetail = {
  items: PostMenuItem[];
  anchorRect: DOMRect;
  item: unknown;
};

export function openPostOptionsPopover(
  items: PostMenuItem[],
  item: unknown,
  anchorEl: Element | null,
): void {
  if (typeof window === 'undefined') return;
  const rect = anchorEl?.getBoundingClientRect();
  if (!rect) {
    console.warn('[appza-renderer] openPostOptionsPopover: no anchor rect');
    return;
  }
  window.dispatchEvent(
    new CustomEvent<OpenDetail>(OPEN_EVENT, {
      detail: { items, anchorRect: rect, item },
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

/**
 * Read an action's `param_schema.<field>.default` values from the catalog
 * cached on `window.__appzaCatalog` (published by both the mobile shell +
 * plugin-admin at bootstrap time). Returns `null` when the catalog is
 * unavailable or the action isn't listed. The dispatcher shells that use
 * this popover set the global via `setCatalogGlobal()` below.
 */
function readActionDefaultsFromCatalog(
  actionSlug: string,
): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const cat = (window as unknown as { __appzaCatalog?: { actions?: unknown } })
    .__appzaCatalog;
  const actions = cat?.actions;
  if (!Array.isArray(actions)) return null;
  const row = actions.find(
    (a): a is Record<string, unknown> =>
      typeof a === 'object' &&
      a !== null &&
      (a as Record<string, unknown>).slug === actionSlug,
  );
  if (!row) return null;
  const ps = row.param_schema;
  if (typeof ps !== 'object' || ps === null) return null;
  const defaults: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ps as Record<string, unknown>)) {
    if (
      v &&
      typeof v === 'object' &&
      'default' in (v as Record<string, unknown>)
    ) {
      defaults[k] = (v as Record<string, unknown>).default;
    }
  }
  return defaults;
}

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

  // Anchor to the right edge of the trigger button; drop down below it
  // with a small gap. Clamped to the viewport.
  const menuWidth = 200;
  const gap = 6;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0;
  const rawLeft = detail.anchorRect.right - menuWidth;
  const left = Math.max(8, Math.min(rawLeft, viewportW - menuWidth - 8));
  const top = detail.anchorRect.bottom + gap;

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
        let label = menuItem.label ?? '';
        if (menuItem.state_path) {
          const stateOn = isTruthy(
            readPath(detail.item, menuItem.state_path),
            menuItem.state_truthy_values,
          );
          label = stateOn
            ? (menuItem.label_on ?? menuItem.label ?? '')
            : (menuItem.label_off ?? menuItem.label ?? '');
        }
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
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

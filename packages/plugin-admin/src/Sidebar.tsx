import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogIndex } from '@appza/renderer';
import type { AppZet, Superstructure, TemplateScreen } from '@appza/schemas';
import { Thumbnail } from './BuilderPanel';
import { useAdvanced } from './advanced';

export type SidebarTab = 'global' | 'screen';
export type BottomTab = null | 'settings' | 'themes' | 'overrides';

type SidebarProps = {
  /** Edit lists this screen's components; App lists nothing. Drag passes `builderPanel`. */
  mode: 'edit' | 'drag' | 'app';
  appzets: AppZet[];
  superstructures: Superstructure[];
  currentScreen: TemplateScreen | null;
  /** The screen's AppZets after the site's layout. */
  placedSlugs: string[];
  bottomTab: BottomTab;
  onSelectBottomTab: (tab: BottomTab) => void;
  bottomPanel: React.ReactNode;
  selectedAppzetSlug?: string | null;
  /** The only way to reach an AppZet that is never placed (modals opened by actions). */
  onSelectAppzet?: (slug: string) => void;
  /** Drag mode's builder (D110) replaces the component list. */
  builderPanel?: React.ReactNode;
  builderTab?: SidebarTab;
  onSelectBuilderTab?: (tab: SidebarTab) => void;
  /** Edit rows draw a live preview when given. */
  catalogIndex?: CatalogIndex | null;
  customizations?: unknown;
};

export function Sidebar({
  mode,
  appzets,
  superstructures,
  currentScreen,
  placedSlugs,
  bottomTab,
  onSelectBottomTab,
  bottomPanel,
  selectedAppzetSlug,
  onSelectAppzet,
  builderPanel,
  builderTab = 'screen',
  onSelectBuilderTab,
  catalogIndex,
  customizations,
}: SidebarProps) {
  const [advanced] = useAdvanced();
  // Include modals reached via action args (`*appzet_slug`), not just placements — same walk the server does for the bundle.
  const screenAppZetSlugs = useMemo<Set<string>>(() => {
    if (!currentScreen) return new Set();

    const bySlug = new Map(appzets.map((a) => [a.slug, a]));
    const collectRefs = (value: unknown, into: string[]): void => {
      if (Array.isArray(value)) {
        value.forEach((v) => collectRefs(v, into));
        return;
      }
      if (!value || typeof value !== 'object') return;
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        if (key.endsWith('appzet_slug') && typeof v === 'string' && v) into.push(v);
        else collectRefs(v, into);
      }
    };

    const seen = new Set<string>();
    const queue = [...placedSlugs];

    // Cycle guard: two AppZets may reference each other.
    let guard = 0;
    while (queue.length > 0 && guard < 500) {
      guard += 1;
      const slug = queue.shift() as string;
      if (seen.has(slug)) continue;
      seen.add(slug);

      const appzet = bySlug.get(slug) as Record<string, unknown> | undefined;
      if (!appzet) continue;
      const refs: string[] = [];
      collectRefs(appzet.actions, refs);
      refs.forEach((r) => {
        if (!seen.has(r)) queue.push(r);
      });
    }
    return seen;
  }, [currentScreen, placedSlugs, appzets]);

  const visibleAppZets = useMemo<AppZet[]>(
    () => appzets.filter((a) => screenAppZetSlugs.has(a.slug)),
    [appzets, screenAppZetSlugs],
  );

  // Placed ones in screen order; the rest are opened by an action (sheets, modals).
  const { placed, opened } = useMemo(() => {
    const bySlug = new Map(visibleAppZets.map((a) => [a.slug, a]));
    const order = [...new Set(placedSlugs)].filter((s) => bySlug.has(s));
    const placedSet = new Set(order);
    return {
      placed: order.map((s) => bySlug.get(s)!),
      opened: visibleAppZets.filter((a) => !placedSet.has(a.slug)).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [visibleAppZets, placedSlugs]);

  const ssNameById = useMemo(() => new Map(superstructures.map((s) => [s.id, s.name])), [superstructures]);

  const renderList = (items: AppZet[]) => (
    <ul className="appza-builder-list">
      {items.map((item) => {
        const type = item.superstructure_id != null ? ssNameById.get(item.superstructure_id) : undefined;
        const selected = item.slug === selectedAppzetSlug;
        return (
          <li key={item.slug} className="appza-builder-row appza-sidebar-card" data-selected={selected ? 'true' : undefined}>
            <button
              type="button"
              className="appza-sidebar-card-btn"
              aria-pressed={selected}
              title={item.slug}
              onClick={onSelectAppzet ? () => onSelectAppzet(item.slug) : undefined}
            >
              <span className="appza-builder-row-name">
                <span>{item.name}</span>
                {type && type !== item.name && <span className="appza-builder-chip">{type}</span>}
              </span>
              {catalogIndex &&
                (item.image_url ? (
                  <span className="appza-builder-thumb appza-sidebar-card-thumb" aria-hidden="true">
                    <img src={item.image_url} alt="" />
                  </span>
                ) : (
                  <LiveThumb slug={item.slug} catalogIndex={catalogIndex} customizations={customizations} />
                ))}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="appza-sidebar" style={{ position: 'relative' }}>
      {builderPanel ? (
        <>
          <div className="appza-sidebar-tabs">
            <button className="appza-sidebar-tab" data-active={builderTab === 'global'} type="button" onClick={() => onSelectBuilderTab?.('global')}>
              Global
            </button>
            <button className="appza-sidebar-tab" data-active={builderTab === 'screen'} type="button" onClick={() => onSelectBuilderTab?.('screen')}>
              Screen
            </button>
          </div>
          <div className="appza-sidebar-content">{builderPanel}</div>
        </>
      ) : mode === 'app' ? (
        <div className="appza-sidebar-content">
          <div className="appza-sidebar-empty">App mode runs the app as a member sees it. Switch to Edit or Drag to change a screen.</div>
        </div>
      ) : (
      <>
      <div className="appza-sidebar-content">
        {placed.length === 0 && opened.length === 0 ? (
          <div className="appza-sidebar-empty">No components placed on this screen yet.</div>
        ) : (
          <div className="appza-builder">
            <section className="appza-builder-section">
              <h3 className="appza-builder-heading">On this screen</h3>
              {renderList(placed)}
            </section>
            {opened.length > 0 && (
              <section className="appza-builder-section">
                <h3 className="appza-builder-heading">Opened from this screen</h3>
                {renderList(opened)}
              </section>
            )}
          </div>
        )}
      </div>

      </>
      )}

      {bottomPanel && <div className="appza-bottom-panel">{bottomPanel}</div>}

      <div className="appza-bottom-tabs">
        <button
          className="appza-bottom-tab"
          data-active={bottomTab === 'settings'}
          onClick={() => onSelectBottomTab(bottomTab === 'settings' ? null : 'settings')}
        >
          <SettingsIcon />
          Settings
        </button>
        <button
          className="appza-bottom-tab"
          data-active={bottomTab === 'themes'}
          onClick={() => onSelectBottomTab(bottomTab === 'themes' ? null : 'themes')}
        >
          <PaintIcon />
          Themes
        </button>
        {advanced && (
          <button
            className="appza-bottom-tab"
            data-active={bottomTab === 'overrides'}
            onClick={() => onSelectBottomTab(bottomTab === 'overrides' ? null : 'overrides')}
          >
            <OverridesIcon />
            Overrides
          </button>
        )}
      </div>
    </aside>
  );
}

// Hidden when the render draws nothing for this viewer, or only a renderer diagnostic.
function LiveThumb({ slug, catalogIndex, customizations }: { slug: string; catalogIndex: CatalogIndex; customizations: unknown }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [blank, setBlank] = useState(false);
  useEffect(() => {
    const el = ref.current?.querySelector('.appza-builder-thumb-live');
    if (!el) return;
    const check = () =>
      setBlank(el.getBoundingClientRect().height < 4 || (!!el.querySelector('.appza-renderer-missing') && el.textContent?.trim() === el.querySelector('.appza-renderer-missing')?.textContent?.trim()));
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={ref} className="appza-builder-thumb appza-sidebar-card-thumb" data-blank={blank ? 'true' : undefined} aria-hidden="true">
      <Thumbnail slug={slug} catalogIndex={catalogIndex} customizations={customizations} />
    </span>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
    </svg>
  );
}

function PaintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6l5-3 5 3v3H3V6z" />
      <path d="M6 9v3a2 2 0 002 2v0a2 2 0 002-2V9" />
    </svg>
  );
}

function OverridesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M4 8h8M6 12h4" />
    </svg>
  );
}

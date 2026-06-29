import { useMemo, useState } from 'react';
import type { AppZet, Superstructure, TemplateScreen } from '@appza/schemas';

export type SidebarTab = 'global' | 'screen';
export type BottomTab = null | 'settings' | 'themes';

type SidebarProps = {
  sidebarTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  appzets: AppZet[];
  superstructures: Superstructure[];
  currentScreen: TemplateScreen | null;
  bottomTab: BottomTab;
  onSelectBottomTab: (tab: BottomTab) => void;
  bottomPanel: React.ReactNode;
};

export function Sidebar({
  sidebarTab,
  onSelectTab,
  appzets,
  superstructures,
  currentScreen,
  bottomTab,
  onSelectBottomTab,
  bottomPanel,
}: SidebarProps) {
  const screenAppZetSlugs = useMemo<Set<string>>(() => {
    if (!currentScreen) return new Set();
    return new Set(
      (currentScreen.placements ?? [])
        .map((p) => (typeof p['appzet_slug'] === 'string' ? p['appzet_slug'] : ''))
        .filter(Boolean),
    );
  }, [currentScreen]);

  const visibleAppZets = useMemo<AppZet[]>(() => {
    if (sidebarTab === 'global') return appzets;
    return appzets.filter((a) => screenAppZetSlugs.has(a.slug));
  }, [sidebarTab, appzets, screenAppZetSlugs]);

  const grouped = useMemo(() => groupBySuperstructure(visibleAppZets, superstructures), [
    visibleAppZets,
    superstructures,
  ]);

  return (
    <aside className="appza-sidebar" style={{ position: 'relative' }}>
      <div className="appza-sidebar-tabs">
        <button
          className="appza-sidebar-tab"
          data-active={sidebarTab === 'global'}
          onClick={() => onSelectTab('global')}
        >
          Global Components
        </button>
        <button
          className="appza-sidebar-tab"
          data-active={sidebarTab === 'screen'}
          onClick={() => onSelectTab('screen')}
        >
          Screen Components
        </button>
      </div>

      <div className="appza-sidebar-content">
        {grouped.length === 0 ? (
          <div className="appza-sidebar-empty">
            {sidebarTab === 'screen'
              ? 'No components placed on this screen yet.'
              : 'No components in the catalog.'}
          </div>
        ) : (
          grouped.map((group) => (
            <CollapsibleSection
              key={group.key}
              title={group.title}
              count={group.items.length}
              defaultOpen={group.items.length > 0 && group.items.length <= 8}
            >
              {group.items.map((item) => (
                <div key={item.slug} className="appza-section-item">
                  <span>{item.name}</span>
                  <span className="appza-section-item-slug">{item.slug}</span>
                </div>
              ))}
            </CollapsibleSection>
          ))
        )}
      </div>

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
      </div>
    </aside>
  );
}

type Group = { key: string; title: string; items: AppZet[] };

function groupBySuperstructure(appzets: AppZet[], superstructures: Superstructure[]): Group[] {
  const ssById = new Map<number, Superstructure>();
  for (const ss of superstructures) ssById.set(ss.id, ss);

  const buckets = new Map<string, Group>();
  for (const appzet of appzets) {
    const ss = appzet.superstructure_id ? ssById.get(appzet.superstructure_id) : undefined;
    const key = ss ? `ss:${ss.id}` : 'other';
    const title = ss ? ss.name : 'Other';
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, title, items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(appzet);
  }

  return Array.from(buckets.values()).sort((a, b) => a.title.localeCompare(b.title));
}

type CollapsibleSectionProps = {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function CollapsibleSection({ title, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="appza-section" data-open={open}>
      <div className="appza-section-header" onClick={() => setOpen((v) => !v)}>
        <SquareIcon />
        <span>{title}</span>
        <span className="appza-section-item-slug" style={{ marginLeft: 6 }}>
          ({count})
        </span>
        <ChevronIcon className="appza-section-chevron" />
      </div>
      <div className="appza-section-items">{children}</div>
    </div>
  );
}

function SquareIcon() {
  return (
    <svg className="appza-section-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="2" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,5 7,9 11,5" />
    </svg>
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

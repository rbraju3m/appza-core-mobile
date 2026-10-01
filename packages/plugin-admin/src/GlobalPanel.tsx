import { useMemo, useState, type ReactNode } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { iconNames, type CatalogIndex, type DrawerMenuItem } from '@appza/renderer';
import type { AppZet, Catalog } from '@appza/schemas';
import { Thumbnail } from './BuilderPanel';
import { selectedSlug, type ChromeBuilder, type ChromeDraft } from './useChromeBuilder';

type GlobalPanelProps = {
  chrome: ChromeBuilder;
  catalog: Catalog;
  catalogIndex: CatalogIndex;
  customizations: unknown;
  screen: string | null;
  screenName: string | null;
};

type Shared = Pick<GlobalPanelProps, 'chrome' | 'catalogIndex' | 'customizations'> & { appzetBySlug: Map<string, AppZet> };

export function GlobalPanel({ chrome, catalog, catalogIndex, customizations, screen, screenName }: GlobalPanelProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({ appbar: true });
  const appzetBySlug = useMemo(() => new Map((catalog.appzets ?? []).map((a) => [a.slug, a])), [catalog]);
  const shared: Shared = { chrome, catalogIndex, customizations, appzetBySlug };

  const appbar = chrome.get('appbar');
  const screenAppbar = screen ? chrome.get('appbar', screen) : null;
  const nav = chrome.get('nav');
  const drawer = chrome.get('drawer');
  const menu = chrome.get('drawer-menu');

  if (chrome.loadError) return <div className="appza-builder-error">{chrome.loadError}</div>;
  if (!appbar || !nav || !drawer || !menu) return <div className="appza-sidebar-empty">Loading…</div>;

  const section = (id: string, title: string, dirty: boolean, body: ReactNode) => (
    <div className="appza-section" data-open={!!open[id]} data-global-section={id}>
      <div className="appza-section-header" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
        <span>{title}</span>
        {dirty && <span className="appza-builder-chip is-hidden" style={{ marginLeft: 6 }}>Unsaved</span>}
      </div>
      {open[id] && <div className="appza-global-body">{body}</div>}
    </div>
  );

  const appDefaultName = appzetBySlug.get(selectedSlug(appbar) ?? '')?.name ?? 'None';

  return (
    <div className="appza-builder">
      {chrome.saveError && <div className="appza-builder-error" role="alert">{chrome.saveError}</div>}
      {section(
        'appbar',
        'Appbar',
        appbar.dirty || !!screenAppbar?.dirty,
        <>
          <ChromePicker {...shared} draft={appbar} title="App default" />
          {screenAppbar && (
            <ChromePicker
              {...shared}
              draft={screenAppbar}
              title={`This screen${screenName ? ` · ${screenName}` : ''}`}
              emptyLabel={`App default (${appDefaultName})`}
              clearLabel="Use the app default"
            />
          )}
        </>,
      )}
      {section('nav', 'Bottom nav', nav.dirty, <ChromePicker {...shared} draft={nav} title="App default" />)}
      {section(
        'drawer',
        'Drawer',
        drawer.dirty || menu.dirty,
        <>
          {drawer.palette.length === 0 && drawer.core.length === 0 ? (
            <p className="appza-global-note">The app uses its built-in drawer. Other drawer designs arrive as Core adds them.</p>
          ) : (
            <ChromePicker {...shared} draft={drawer} title="Design" />
          )}
          <DrawerMenu chrome={chrome} draft={menu} catalog={catalog} />
        </>,
      )}
    </div>
  );
}

type PickerProps = Shared & {
  draft: ChromeDraft;
  title: string;
  /** What the Selected card says when the list is empty. */
  emptyLabel?: string;
  clearLabel?: string;
};

function ChromePicker({ chrome, draft, title, emptyLabel, clearLabel, appzetBySlug, catalogIndex, customizations }: PickerProps) {
  const current = selectedSlug(draft);
  const others = draft.palette.filter((s) => s !== current && appzetBySlug.has(s));
  const card = (slug: string, action?: ReactNode) => (
    <div key={slug} className="appza-builder-card appza-global-card" data-chrome-card={slug}>
      <div className="appza-builder-card-name">
        <span>{appzetBySlug.get(slug)?.name ?? slug}</span>
      </div>
      <div className="appza-builder-thumb" aria-hidden="true">
        {appzetBySlug.get(slug)?.image_url ? (
          <img src={appzetBySlug.get(slug)!.image_url!} alt="" />
        ) : (
          <Thumbnail slug={slug} catalogIndex={catalogIndex} customizations={customizations} />
        )}
      </div>
      {action && <div className="appza-builder-card-overlay">{action}</div>}
    </div>
  );

  return (
    <div className="appza-global-picker" data-chrome-part={`${draft.screen === null ? 'app' : 'screen'}-${draft.part}`}>
      <h4 className="appza-builder-subheading">{title}</h4>
      <DriftAndReset chrome={chrome} draft={draft} />
      <div className="appza-global-label">Selected</div>
      {current ? card(current) : <div className="appza-global-empty">{emptyLabel ?? 'None'}</div>}
      {current && clearLabel && (
        <button type="button" className="appza-btn appza-global-clear" onClick={() => chrome.select(draft, null)}>
          {clearLabel}
        </button>
      )}
      <div className="appza-global-label">Library</div>
      {others.length === 0 ? (
        <p className="appza-global-note">
          {draft.palette.length <= 1 ? 'One design so far. More arrive as Core adds them.' : 'No other designs.'}
        </p>
      ) : (
        <div className="appza-builder-grid">
          {others.map((slug) =>
            card(
              slug,
              <button type="button" className="appza-btn appza-btn-primary" onClick={() => chrome.select(draft, slug)}>
                Select
              </button>,
            ),
          )}
        </div>
      )}
    </div>
  );
}

function DriftAndReset({ chrome, draft }: { chrome: ChromeBuilder; draft: ChromeDraft }) {
  if (draft.drift) {
    return (
      <div className="appza-builder-drift" role="status">
        <strong>Core updated this.</strong>
        <div className="appza-builder-drift-actions">
          <button type="button" className="appza-btn" onClick={() => void chrome.keepMine(draft)}>Keep mine</button>
          <button type="button" className="appza-btn" onClick={() => void chrome.reset(draft)}>Reset to Core</button>
        </div>
      </div>
    );
  }
  if (draft.baseVersion === null) return null;
  return (
    <button type="button" className="appza-btn appza-global-clear" onClick={() => void chrome.reset(draft)}>
      Reset to Core
    </button>
  );
}

function DrawerMenu({ chrome, draft, catalog }: { chrome: ChromeBuilder; draft: ChromeDraft; catalog: Catalog }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const items = draft.items as DrawerMenuItem[];

  // The label the app shows when the site sets none.
  const coreLabel = useMemo(() => {
    const names = new Map<string, string>();
    for (const s of catalog.app_map?.screens ?? []) {
      if (typeof s?.['slug'] === 'string' && typeof s?.['name'] === 'string') names.set(s['slug'], s['name']);
    }
    for (const s of catalog.template_screens ?? []) {
      if (s.drawer_label?.trim()) names.set(s.app_map_screen_slug, s.drawer_label.trim());
    }
    return names;
  }, [catalog]);
  const coreIcon = useMemo(
    () => new Map((catalog.template_screens ?? []).map((s) => [s.app_map_screen_slug, s.drawer_icon ?? ''])),
    [catalog],
  );

  const change = (slug: string, patch: Partial<DrawerMenuItem>) =>
    chrome.setItems(draft, items.map((i) => (i.screen_slug === slug ? { ...i, ...patch } : i)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    chrome.setItems(draft, arrayMove(items, from, to));
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    move(items.findIndex((i) => i.screen_slug === e.active.id), items.findIndex((i) => i.screen_slug === e.over!.id));
  };

  const shownIcons = items.filter((i) => !i.hidden).map((i) => i.icon?.trim() || coreIcon.get(i.screen_slug) || '');
  const mixedIcons = shownIcons.some(Boolean) && !shownIcons.every((n) => n && isIcon(n));

  return (
    <div className="appza-global-picker" data-chrome-part="app-drawer-menu">
      <h4 className="appza-builder-subheading">Menu</h4>
      <DriftAndReset chrome={chrome} draft={draft} />
      {items.length === 0 && <p className="appza-global-note">No screen is listed in the drawer.</p>}
      {mixedIcons && (
        <p className="appza-global-note is-warn">Icons show only when every visible row has a known one.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.screen_slug)} strategy={verticalListSortingStrategy}>
          <ul className="appza-builder-list appza-global-menu">
            {items.map((item, i) => (
              <MenuRow
                key={item.screen_slug}
                item={item}
                fallbackLabel={coreLabel.get(item.screen_slug) ?? item.screen_slug}
                fallbackIcon={coreIcon.get(item.screen_slug) ?? ''}
                open={openSlug === item.screen_slug}
                first={i === 0}
                last={i === items.length - 1}
                onToggleOpen={() => setOpenSlug(openSlug === item.screen_slug ? null : item.screen_slug)}
                onMove={(by) => move(i, i + by)}
                onChange={(patch) => change(item.screen_slug, patch)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <datalist id="appza-icon-names">
        {iconNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>
  );
}

const isIcon = (name: string) => iconNames.includes(name) || iconNames.includes(`${name}-outline`);

type MenuRowProps = {
  item: DrawerMenuItem;
  fallbackLabel: string;
  fallbackIcon: string;
  open: boolean;
  first: boolean;
  last: boolean;
  onToggleOpen: () => void;
  onMove: (by: number) => void;
  onChange: (patch: Partial<DrawerMenuItem>) => void;
};

function MenuRow({ item, fallbackLabel, fallbackIcon, open, first, last, onToggleOpen, onMove, onChange }: MenuRowProps) {
  const sortable = useSortable({ id: item.screen_slug });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const name = item.label?.trim() || fallbackLabel;
  const icon = item.icon?.trim() ?? '';
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="appza-builder-row"
      data-selected={open ? 'true' : undefined}
      data-dragging={sortable.isDragging ? 'true' : undefined}
      data-absent={item.hidden ? 'true' : undefined}
      data-menu-screen={item.screen_slug}
    >
      <div className="appza-builder-row-main">
        <button type="button" className="appza-builder-handle" aria-label={`Drag ${name}`} {...sortable.attributes} {...sortable.listeners}>
          ⠿
        </button>
        <button type="button" className="appza-builder-row-name" onClick={onToggleOpen} title={item.screen_slug}>
          <span>{name}</span>
          {item.hidden && <span className="appza-builder-chip is-hidden">Hidden</span>}
        </button>
        <button
          type="button"
          className="appza-builder-icon-btn"
          onClick={() => onChange({ hidden: !item.hidden })}
          aria-label={item.hidden ? `Show ${name}` : `Hide ${name}`}
          aria-pressed={!!item.hidden}
          title={item.hidden ? 'Show in the menu' : 'Hide from the menu'}
        >
          {item.hidden ? '◌' : '👁'}
        </button>
        <button type="button" className="appza-builder-icon-btn" disabled={first} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
        <button type="button" className="appza-builder-icon-btn" disabled={last} onClick={() => onMove(1)} aria-label="Move down">↓</button>
      </div>
      {open && (
        <div className="appza-global-fields">
          <label>
            <span>Label</span>
            <input
              type="text"
              maxLength={60}
              value={item.label ?? ''}
              placeholder={fallbackLabel}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </label>
          <label>
            <span>Icon</span>
            <input
              type="text"
              list="appza-icon-names"
              value={item.icon ?? ''}
              placeholder={fallbackIcon || 'none'}
              onChange={(e) => onChange({ icon: e.target.value.trim().toLowerCase() })}
            />
          </label>
          {icon !== '' && !isIcon(icon) && <span className="appza-global-note is-warn">Not a known icon.</span>}
        </div>
      )}
    </li>
  );
}

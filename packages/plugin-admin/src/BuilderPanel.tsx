import { Component, useMemo, useState, type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionProvider, PlacementRenderer, type CatalogIndex } from '@appza/renderer';
import type { AppZet, Catalog } from '@appza/schemas';
import {
  VISIBILITY_LABEL,
  mainKeys,
  rowsOf,
  type LayoutItem,
  type Row,
  type ScreenDraft,
  type Visibility,
} from './layoutApi';

export const LIB_PREFIX = 'lib:';

type BuilderPanelProps = {
  draft: ScreenDraft | null;
  loading: boolean;
  loadError: string | null;
  saveError: string | null;
  catalog: Catalog;
  catalogIndex: CatalogIndex;
  customizations: unknown;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  presentKeys: ReadonlySet<string>;
  onChangeItems: (items: LayoutItem[]) => void;
  onAdd: (slug: string) => void;
  onKeepMine: () => void;
  onAddNew: () => void;
  onReset: () => void;
};

export function BuilderPanel(props: BuilderPanelProps) {
  const { draft, loading, loadError, catalog } = props;
  const appzetBySlug = useMemo(() => new Map((catalog.appzets ?? []).map((a) => [a.slug, a])), [catalog]);

  if (loading && !draft) return <div className="appza-sidebar-empty">Loading layout…</div>;
  if (loadError) return <div className="appza-builder-error">{loadError}</div>;
  if (!draft) return <div className="appza-sidebar-empty">Pick a screen.</div>;

  return (
    <div className="appza-builder">
      {draft.drift && (
        <div className="appza-builder-drift" role="status">
          <strong>Core updated this screen.</strong>
          <span>Your layout is kept as you saved it.</span>
          <div className="appza-builder-drift-actions">
            <button type="button" className="appza-btn" onClick={props.onKeepMine}>Keep mine</button>
            <button type="button" className="appza-btn" onClick={props.onAddNew}>Add the new ones</button>
            <button type="button" className="appza-btn" onClick={props.onReset}>Reset to Core</button>
          </div>
        </div>
      )}
      {props.saveError && <div className="appza-builder-error" role="alert">{props.saveError}</div>}
      <PlacementList {...props} draft={draft} appzetBySlug={appzetBySlug} />
      <Library {...props} draft={draft} appzetBySlug={appzetBySlug} />
      <ResetRow draft={draft} onReset={props.onReset} />
    </div>
  );
}

type WithDraft = BuilderPanelProps & { draft: ScreenDraft; appzetBySlug: Map<string, AppZet> };

function PlacementList(p: WithDraft) {
  const rows = rowsOf(p.draft);
  const main = rows.filter((r) => r.slot !== 'footer');
  const footer = rows.filter((r) => r.slot === 'footer');
  const order = mainKeys(p.draft);

  const move = (key: string, by: number) => {
    const i = order.indexOf(key);
    const j = i + by;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    const byKey = new Map(p.draft.items.map((it) => [it.key, it]));
    p.onChangeItems([...next, ...footer.map((r) => r.key)].map((k) => byKey.get(k)!));
  };
  const remove = (key: string) => {
    p.onChangeItems(p.draft.items.filter((it) => it.key !== key));
    if (p.selectedKey === key) p.onSelectKey(null);
  };
  const setVisibility = (key: string, v: Visibility | '') => {
    p.onChangeItems(
      p.draft.items.map((it) => {
        if (it.key !== key) return it;
        const { visibility: _drop, ...rest } = it;
        return v ? { ...rest, visibility: v } : rest;
      }),
    );
  };

  return (
    <section className="appza-builder-section">
      <h3 className="appza-builder-heading">On this screen</h3>
      {rows.length === 0 && <div className="appza-sidebar-empty">Empty. Drag a component in from the library.</div>}
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="appza-builder-list">
          {main.map((r, i) => (
            <PlacementRow
              key={r.key}
              row={r}
              name={p.appzetBySlug.get(r.appzet_slug)?.name ?? r.appzet_slug}
              present={p.presentKeys.has(r.key)}
              selected={p.selectedKey === r.key}
              first={i === 0}
              last={i === main.length - 1}
              onSelect={() => p.onSelectKey(p.selectedKey === r.key ? null : r.key)}
              onMove={(by) => move(r.key, by)}
              onRemove={() => remove(r.key)}
              onVisibility={(v) => setVisibility(r.key, v)}
            />
          ))}
        </ul>
      </SortableContext>
      {footer.length > 0 && (
        <>
          <h4 className="appza-builder-subheading">Footer</h4>
          <ul className="appza-builder-list">
            {footer.map((r) => (
              <PlacementRow
                key={r.key}
                row={r}
                fixed
                name={p.appzetBySlug.get(r.appzet_slug)?.name ?? r.appzet_slug}
                present={p.presentKeys.has(r.key)}
                selected={p.selectedKey === r.key}
                onSelect={() => p.onSelectKey(p.selectedKey === r.key ? null : r.key)}
                onRemove={() => remove(r.key)}
                onVisibility={(v) => setVisibility(r.key, v)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type PlacementRowProps = {
  row: Row;
  name: string;
  present: boolean;
  selected: boolean;
  fixed?: boolean;
  first?: boolean;
  last?: boolean;
  onSelect: () => void;
  onMove?: (by: number) => void;
  onRemove: () => void;
  onVisibility: (v: Visibility | '') => void;
};

function PlacementRow({ row, name, present, selected, fixed, first, last, onSelect, onMove, onRemove, onVisibility }: PlacementRowProps) {
  const sortable = useSortable({ id: row.key, disabled: fixed });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const gate = row.visibility
    ? VISIBILITY_LABEL[row.visibility]
    : row.coreGate
      ? 'Shown when the design says'
      : null;
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="appza-builder-row"
      data-selected={selected ? 'true' : undefined}
      data-dragging={sortable.isDragging ? 'true' : undefined}
      data-absent={present ? undefined : 'true'}
      data-placement-key={row.key}
    >
      <div className="appza-builder-row-main">
        {fixed ? (
          <span className="appza-builder-handle is-fixed" title="Footer items stay at the bottom" aria-hidden="true">⠿</span>
        ) : (
          <button type="button" className="appza-builder-handle" aria-label={`Drag ${name}`} {...sortable.attributes} {...sortable.listeners}>
            ⠿
          </button>
        )}
        <button type="button" className="appza-builder-row-name" onClick={onSelect} title={row.key}>
          <span>{name}</span>
          {row.isSite && <span className="appza-builder-chip">Added</span>}
          {gate && <span className="appza-builder-chip is-gate">{gate}</span>}
          {!present && <span className="appza-builder-chip is-hidden">Hidden now</span>}
        </button>
        {!fixed && (
          <>
            <button type="button" className="appza-builder-icon-btn" disabled={first} onClick={() => onMove?.(-1)} aria-label="Move up">↑</button>
            <button type="button" className="appza-builder-icon-btn" disabled={last} onClick={() => onMove?.(1)} aria-label="Move down">↓</button>
          </>
        )}
        <button type="button" className="appza-builder-icon-btn is-danger" onClick={onRemove} aria-label={`Remove ${name}`}>✕</button>
      </div>
      {selected && (
        <label className="appza-builder-row-detail">
          <span>Visibility</span>
          <select value={row.visibility ?? ''} onChange={(e) => onVisibility(e.target.value as Visibility | '')}>
            <option value="">As designed</option>
            <option value="always">Always shown</option>
            <option value="signed_in">Signed-in only</option>
            <option value="signed_out">Signed-out only</option>
          </select>
        </label>
      )}
    </li>
  );
}

function tagGroup(a: AppZet | undefined): string {
  const tags = Array.isArray(a?.tags) ? a!.tags : [];
  const g = tags.find((t): t is string => typeof t === 'string' && t.startsWith('group:'));
  return g ? g.slice(6) : 'other';
}

function Library(p: WithDraft) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsOf(p.draft)) m.set(r.appzet_slug, (m.get(r.appzet_slug) ?? 0) + 1);
    return m;
  }, [p.draft]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const labels = new Map((p.catalog.builder_groups ?? []).map((g) => [g.slug, g.label]));
    const order = (p.catalog.builder_groups ?? []).map((g) => g.slug);
    const buckets = new Map<string, AppZet[]>();
    for (const slug of p.draft.palette) {
      const a = p.appzetBySlug.get(slug);
      if (!a) continue;
      if (q && !a.name.toLowerCase().includes(q) && !a.slug.includes(q)) continue;
      const g = tagGroup(a);
      buckets.set(g, [...(buckets.get(g) ?? []), a]);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => (order.indexOf(a) < 0 ? 999 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 999 : order.indexOf(b)))
      .map(([slug, items]) => ({ slug, label: labels.get(slug) ?? 'Other', items }));
  }, [p.draft.palette, p.appzetBySlug, p.catalog.builder_groups, query]);

  return (
    <section className="appza-builder-section">
      <h3 className="appza-builder-heading">Library</h3>
      <input
        type="search"
        className="appza-builder-search"
        placeholder="Search components"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.length === 0 && <div className="appza-sidebar-empty">Nothing matches.</div>}
      {groups.map((g, gi) => {
        const isOpen = query ? true : open[g.slug] ?? gi === 0;
        return (
          <div key={g.slug} className="appza-section" data-open={isOpen}>
            <div className="appza-section-header" onClick={() => setOpen((o) => ({ ...o, [g.slug]: !isOpen }))}>
              <span>{g.label}</span>
              <span className="appza-section-item-slug" style={{ marginLeft: 6 }}>({g.items.length})</span>
            </div>
            {isOpen && (
              <div className="appza-builder-grid">
                {g.items.map((a) => (
                  <LibraryCard
                    key={a.slug}
                    appzet={a}
                    count={counts.get(a.slug) ?? 0}
                    catalogIndex={p.catalogIndex}
                    customizations={p.customizations}
                    onAdd={() => p.onAdd(a.slug)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function isSingle(a: AppZet | undefined): boolean {
  return Array.isArray(a?.tags) && a!.tags.includes('single');
}

function LibraryCard({
  appzet,
  count,
  catalogIndex,
  customizations,
  onAdd,
}: {
  appzet: AppZet;
  count: number;
  catalogIndex: CatalogIndex;
  customizations: unknown;
  onAdd: () => void;
}) {
  const blocked = isSingle(appzet) && count > 0;
  const drag = useDraggable({ id: `${LIB_PREFIX}${appzet.slug}`, data: { slug: appzet.slug }, disabled: blocked });
  return (
    <div
      ref={drag.setNodeRef}
      className="appza-builder-card"
      data-blocked={blocked ? 'true' : undefined}
      data-dragging={drag.isDragging ? 'true' : undefined}
      title={blocked ? 'Once per screen' : `Drag onto the screen, or Add`}
      {...drag.attributes}
      {...drag.listeners}
    >
      <div className="appza-builder-card-name">
        <span>{appzet.name}</span>
        {count > 0 && <span className="appza-builder-chip">×{count}</span>}
      </div>
      <div className="appza-builder-thumb" aria-hidden="true">
        {appzet.image_url ? (
          <img src={appzet.image_url} alt="" />
        ) : (
          <Thumbnail slug={appzet.slug} catalogIndex={catalogIndex} customizations={customizations} />
        )}
      </div>
      <div className="appza-builder-card-overlay">
        {blocked ? (
          <em>Once per screen</em>
        ) : (
          <button
            type="button"
            className="appza-btn appza-btn-primary"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onAdd}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// A live, inert render with the same renderer the phone uses; never goes stale, needs no uploads.
export function Thumbnail({ slug, catalogIndex, customizations }: { slug: string; catalogIndex: CatalogIndex; customizations: unknown }) {
  return (
    <ThumbBoundary fallback={<span className="appza-builder-thumb-fallback">{slug.replace(/^fc-/, '').charAt(0).toUpperCase()}</span>}>
      <div className="appza-builder-thumb-live" {...{ inert: '' }}>
        <ActionProvider dispatch={() => undefined}>
          <PlacementRenderer appzetSlug={slug} catalogIndex={catalogIndex} customizations={customizations} />
        </ActionProvider>
      </div>
    </ThumbBoundary>
  );
}

class ThumbBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ResetRow({ draft, onReset }: { draft: ScreenDraft; onReset: () => void }) {
  const [asking, setAsking] = useState(false);
  if (draft.baseVersion === null) return null;
  return (
    <div className="appza-builder-reset">
      {asking ? (
        <>
          <span>Drop this screen's layout and use Core's?</span>
          <button type="button" className="appza-btn" onClick={() => { setAsking(false); onReset(); }}>Reset</button>
          <button type="button" className="appza-btn" onClick={() => setAsking(false)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="appza-btn" onClick={() => setAsking(true)}>Reset to Core</button>
      )}
    </div>
  );
}

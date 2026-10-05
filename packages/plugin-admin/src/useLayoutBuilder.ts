import { useCallback, useEffect, useRef, useState } from 'react';
import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { AppZet } from '@appza/schemas';
import {
  draftAsCustomization,
  insertAt,
  loadDraft,
  mainKeys,
  missingCore,
  newSiteKey,
  resetDraft,
  rowsOf,
  saveDraft,
  withMainOrder,
  type LayoutItem,
  type ScreenDraft,
} from './layoutApi';
import { LIB_PREFIX, isSingle } from './BuilderPanel';
import { CANVAS_PREFIX, DEVICE_DROP_ID, dropIndexAt } from './DragCanvas';

type Options = {
  active: boolean;
  template: string;
  screen: string | null;
  appzetBySlug: Map<string, AppZet>;
  /** Re-pull the bootstrap after a write so every mode shows the saved layout. */
  onSaved: () => void;
};

const deviceViewport = () => document.querySelector('.appza-center .appza-device-viewport');

export function useLayoutBuilder({ active, template, screen, appzetBySlug, onSaved }: Options) {
  const [drafts, setDrafts] = useState<Record<string, ScreenDraft>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [presentKeys, setPresentKeys] = useState<Set<string>>(new Set());
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const pointerY = useRef(0);
  const stopTracking = useRef<(() => void) | null>(null);

  const id = screen ? `${template}:${screen}` : '';
  const draft = id ? drafts[id] ?? null : null;

  const reload = useCallback(async (t: string, s: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await loadDraft(t, s);
      setDrafts((all) => ({ ...all, [`${t}:${s}`]: d }));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active || !screen || !template || drafts[`${template}:${screen}`]) return;
    void reload(template, screen);
  }, [active, template, screen, drafts, reload]);

  useEffect(() => setSelectedKey(null), [id]);

  const setItems = useCallback(
    (items: LayoutItem[]) => {
      if (!id) return;
      setSaveError(null);
      setDrafts((all) => (all[id] ? { ...all, [id]: { ...all[id]!, items, dirty: true } } : all));
    },
    [id],
  );

  const add = useCallback(
    (slug: string, index?: number, layout?: string) => {
      if (!draft) return;
      if (isSingle(appzetBySlug.get(slug)) && rowsOf(draft).some((r) => r.appzet_slug === slug)) {
        setSaveError(`${appzetBySlug.get(slug)?.name ?? slug} can appear once per screen.`);
        return;
      }
      const key = newSiteKey();
      setItems(insertAt(draft, index ?? mainKeys(draft).length, { key, appzet_slug: slug, ...(layout ? { layout } : {}) }));
      setSelectedKey(key);
    },
    [draft, appzetBySlug, setItems],
  );

  const dirty = Object.values(drafts).filter((d) => d.dirty);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    const problems: string[] = [];
    for (const d of Object.values(drafts).filter((x) => x.dirty)) {
      const r = await saveDraft(d);
      if (r.ok) {
        await reload(d.template, d.screen);
        continue;
      }
      const detail = r.errors ? Object.entries(r.errors).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
      problems.push(`${d.screen}: ${r.message}${detail ? ` (${detail})` : ''}`);
    }
    setSaving(false);
    if (problems.length) setSaveError(problems.join('\n'));
    onSaved();
  }, [drafts, reload, onSaved]);

  const discard = useCallback(() => {
    setSaveError(null);
    setDrafts((all) =>
      Object.fromEntries(
        Object.entries(all).map(([k, d]) => [k, d.dirty ? { ...d, items: d.saved ?? d.core.map((c) => ({ key: c.key })), dirty: false } : d]),
      ),
    );
  }, []);

  const keepMine = useCallback(async () => {
    if (!draft?.saved) return;
    const r = await saveDraft(draft, draft.saved);
    if (!r.ok) setSaveError(r.message);
    await reload(draft.template, draft.screen);
    onSaved();
  }, [draft, reload, onSaved]);

  const addNew = useCallback(() => {
    if (draft) setItems([...draft.items, ...missingCore(draft)]);
  }, [draft, setItems]);

  const reset = useCallback(async () => {
    if (!draft) return;
    if (!(await resetDraft(draft))) setSaveError('Reset failed.');
    await reload(draft.template, draft.screen);
    onSaved();
  }, [draft, reload, onSaved]);

  const remove = useCallback(
    (key: string) => {
      if (!draft) return;
      setItems(draft.items.filter((i) => i.key !== key));
      if (selectedKey === key) setSelectedKey(null);
    },
    [draft, selectedKey, setItems],
  );

  // Pointer inside a row wins; between rows of the list, the nearest row; elsewhere nothing.
  const collision: CollisionDetection = useCallback((args) => {
    const within = pointerWithin(args);
    if (within.length) return within;
    const list = document.querySelector('.appza-builder-list')?.getBoundingClientRect();
    const p = args.pointerCoordinates;
    if (!list || !p || p.x < list.left || p.x > list.right || p.y < list.top - 24 || p.y > list.bottom + 24) return [];
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => c.id !== DEVICE_DROP_ID) });
  }, []);

  const labelOf = (dragId: string): string => {
    if (dragId.startsWith(LIB_PREFIX)) return appzetBySlug.get(dragId.slice(LIB_PREFIX.length))?.name ?? dragId;
    const key = dragId.startsWith(CANVAS_PREFIX) ? dragId.slice(CANVAS_PREFIX.length) : dragId;
    const row = draft ? rowsOf(draft).find((r) => r.key === key) : undefined;
    return row ? appzetBySlug.get(row.appzet_slug)?.name ?? row.appzet_slug : key;
  };

  // The real pointer: dnd-kit's delta is scroll-adjusted, which is wrong for a point on the device.
  const onDragStart = (e: DragStartEvent) => {
    setDragLabel(labelOf(String(e.active.id)));
    pointerY.current = (e.activatorEvent as PointerEvent).clientY ?? 0;
    const track = (ev: PointerEvent) => {
      pointerY.current = ev.clientY;
    };
    window.addEventListener('pointermove', track, true);
    stopTracking.current = () => window.removeEventListener('pointermove', track, true);
  };

  const onDragMove = (e: DragMoveEvent) => {
    if (!draft) return;
    const y = pointerY.current;
    const overDevice = e.over?.id === DEVICE_DROP_ID;
    setDropIndex(overDevice ? dropIndexAt(deviceViewport(), mainKeys(draft), y) : null);
    // Ionic scrolls inside its shadow root, which dnd-kit's auto-scroll can't see.
    const content = deviceViewport()?.querySelector('ion-content') as (HTMLElement & { scrollByPoint?: (x: number, y: number, ms: number) => Promise<void> }) | null;
    const box = content?.getBoundingClientRect();
    if (overDevice && box && content?.scrollByPoint) {
      if (y < box.top + 48) void content.scrollByPoint(0, -24, 0);
      else if (y > box.bottom - 48) void content.scrollByPoint(0, 24, 0);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    stopTracking.current?.();
    setDragLabel(null);
    setDropIndex(null);
    if (!draft || !e.over) return;
    const order = mainKeys(draft);
    const overId = String(e.over.id);
    const activeId = String(e.active.id);
    const fromList = !activeId.startsWith(LIB_PREFIX) && !activeId.startsWith(CANVAS_PREFIX);
    const overRect = e.over.rect;
    // Something new dropped on a row goes above or below it by the half the pointer is in; a row being sorted takes the row's place.
    const lowerHalf = !fromList && pointerY.current > overRect.top + overRect.height / 2;
    const target =
      overId === DEVICE_DROP_ID
        ? dropIndexAt(deviceViewport(), order, pointerY.current)
        : order.indexOf(overId) + (order.includes(overId) && lowerHalf ? 1 : 0);
    if (target < 0) return;
    if (activeId.startsWith(LIB_PREFIX)) {
      add(activeId.slice(LIB_PREFIX.length), target);
      return;
    }
    const key = activeId.startsWith(CANVAS_PREFIX) ? activeId.slice(CANVAS_PREFIX.length) : activeId;
    const from = order.indexOf(key);
    if (from < 0) return;
    const rest = order.filter((k) => k !== key);
    // A sortable row lands on the row it covers; a drop between boxes counts the moved one out.
    const to = !fromList && target > from ? target - 1 : target;
    if (to === from) return;
    rest.splice(Math.min(to, rest.length), 0, key);
    setItems(withMainOrder(draft, rest));
    setSelectedKey(key);
  };

  const onDragCancel = () => {
    stopTracking.current?.();
    setDragLabel(null);
    setDropIndex(null);
  };

  const overlay = useCallback(
    (customizations: unknown) => draftAsCustomization(customizations, Object.values(drafts)),
    [drafts],
  );

  return {
    draft,
    loading,
    loadError,
    saveError,
    saving,
    dirtyCount: dirty.length,
    selectedKey,
    setSelectedKey,
    presentKeys,
    setPresentKeys,
    dropIndex,
    dragLabel,
    setItems,
    add,
    remove,
    save,
    discard,
    keepMine,
    addNew,
    reset,
    overlay,
    dnd: { collisionDetection: collision, onDragStart, onDragMove, onDragEnd, onDragCancel },
  };
}

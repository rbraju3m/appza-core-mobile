import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Undo / Redo over every unsaved change in the builder (Friendly v2 P3b): pages, app bar / tabs / drawer, block
 * settings, piece layouts, theme. For this session only, and only for what is not saved yet: Save and Discard
 * clear it (owner, 2026-11-11: no Undo after Save).
 *
 * A step is the state BEFORE a user's edit. The stores call `record(thing)` just before they change; after the
 * next render `settle` keeps the step only if something really changed, so loads, saves and no-op edits never
 * become steps. Edits to the same thing within 600 ms (a run of typing, a slider drag) are one step.
 */

/** Each store's unsaved edits: id → value. Compared entry by entry, by identity. */
export type EditMaps = Record<string, Record<string, unknown>>;

export type HistorySource = {
  snapshot: () => EditMaps;
  restore: (s: EditMaps) => void;
};

const JOIN_MS = 600;
const LIMIT = 100;

function same(a: EditMaps, b: EditMaps): boolean {
  const stores = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const s of stores) {
    const x = a[s] ?? {};
    const y = b[s] ?? {};
    const xk = Object.keys(x);
    if (xk.length !== Object.keys(y).length) return false;
    for (const k of xk) if (!(k in y) || x[k] !== y[k]) return false;
  }
  return true;
}

export function useBuilderHistory() {
  const source = useRef<HistorySource | null>(null);
  const undoStack = useRef<EditMaps[]>([]);
  const redoStack = useRef<EditMaps[]>([]);
  const pending = useRef<{ before: EditMaps; thing: string } | null>(null);
  const last = useRef<{ thing: string; at: number } | null>(null);
  const [sizes, setSizes] = useState({ undo: 0, redo: 0 });
  const sync = () => setSizes({ undo: undoStack.current.length, redo: redoStack.current.length });

  /** App hands over the stores each render; `snapshot` reads what was last rendered. */
  const bind = useCallback((s: HistorySource) => {
    source.current = s;
  }, []);

  const record = useCallback((thing: string) => {
    if (!source.current) return;
    // Several changes before one render are one step, from the state before the first.
    if (!pending.current) pending.current = { before: source.current.snapshot(), thing };
  }, []);

  useEffect(() => {
    const p = pending.current;
    if (!p || !source.current) return;
    pending.current = null;
    if (same(p.before, source.current.snapshot())) return;
    const now = Date.now();
    const joins = last.current && last.current.thing === p.thing && now - last.current.at < JOIN_MS && undoStack.current.length > 0;
    last.current = { thing: p.thing, at: now };
    if (!joins) {
      undoStack.current.push(p.before);
      if (undoStack.current.length > LIMIT) undoStack.current.shift();
    }
    redoStack.current = [];
    sync();
  });

  const move = (from: { current: EditMaps[] }, to: { current: EditMaps[] }) => {
    const s = source.current;
    const target = from.current.pop();
    if (!s || !target) return;
    to.current.push(s.snapshot());
    pending.current = null;
    last.current = null;
    s.restore(target);
    sync();
  };
  const undo = useCallback(() => move(undoStack, redoStack), []); // eslint-disable-line react-hooks/exhaustive-deps
  const redo = useCallback(() => move(redoStack, undoStack), []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    pending.current = null;
    last.current = null;
    sync();
  }, []);

  return { bind, record, undo, redo, clear, canUndo: sizes.undo > 0, canRedo: sizes.redo > 0 };
}

export type BuilderHistory = ReturnType<typeof useBuilderHistory>;

/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (⌘ on a Mac), except while typing: a text box keeps its own Undo. */
export function useUndoKeys({ undo, redo }: Pick<BuilderHistory, 'undo' | 'redo'>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, enabled]);
}

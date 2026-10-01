import { useEffect, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

export const CANVAS_PREFIX = 'canvas:';
export const DEVICE_DROP_ID = 'device';

type Box = { key: string; top: number; left: number; width: number; height: number };

/** Client rects of the body's placements, keyed, in screen order; a list AppZet is one box. */
export function placementBoxes(viewport: Element | null, keys: string[]): Box[] {
  const content = viewport?.querySelector('.appza-renderer-content');
  if (!content) return [];
  const out: Box[] = [];
  for (const key of keys) {
    const els = content.querySelectorAll(`[data-appza-placement-key="${CSS.escape(key)}"]`);
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    if (top !== Infinity) out.push({ key, top, left, width: right - left, height: bottom - top });
  }
  return out;
}

/** The main-list index a drop at clientY lands on: before the first box whose middle is below it. */
export function dropIndexAt(viewport: Element | null, mainKeys: string[], clientY: number): number {
  const boxes = placementBoxes(viewport, mainKeys);
  for (const b of boxes) {
    if (clientY < b.top + b.height / 2) return mainKeys.indexOf(b.key);
  }
  return mainKeys.length;
}

type DragCanvasProps = {
  keys: string[];
  mainKeys: string[];
  names: Record<string, string>;
  selectedKey: string | null;
  dropIndex: number | null;
  onRemove: (key: string) => void;
  onPresentKeys: (keys: Set<string>) => void;
};

// Sits inside the device viewport; draws over the renderer without touching its DOM.
export function DragCanvas({ keys, mainKeys, names, selectedKey, dropIndex, onRemove, onPresentKeys }: DragCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const droppable = useDroppable({ id: DEVICE_DROP_ID });
  const [hovered, setHovered] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const presentRef = useRef('');

  const viewport = () => rootRef.current?.parentElement ?? null;

  useEffect(() => {
    const vp = viewport();
    if (!vp) return;
    const onMove = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('.appza-drag-toolbar')) return;
      const el = t?.closest('.appza-renderer-content [data-appza-placement-key]');
      setHovered(el?.getAttribute('data-appza-placement-key') ?? null);
    };
    const onLeave = () => setHovered(null);
    vp.addEventListener('mousemove', onMove);
    vp.addEventListener('mouseleave', onLeave);
    // Boxes move with scroll and late data; a light poll keeps outlines and "Hidden now" honest.
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
      const present = placementBoxes(vp, keys).map((b) => b.key);
      const sig = present.join('|');
      if (sig !== presentRef.current) {
        presentRef.current = sig;
        onPresentKeys(new Set(present));
      }
    }, 300);
    return () => {
      vp.removeEventListener('mousemove', onMove);
      vp.removeEventListener('mouseleave', onLeave);
      window.clearInterval(id);
    };
  }, [keys, onPresentKeys]);

  const vp = viewport();
  const origin = vp?.getBoundingClientRect();
  const boxes = placementBoxes(vp, keys);
  const rel = (b: Box) => ({
    top: b.top - (origin?.top ?? 0),
    left: b.left - (origin?.left ?? 0),
    width: b.width,
    height: b.height,
  });
  const content = vp?.querySelector('.appza-renderer-content')?.getBoundingClientRect();
  const clip = content && origin ? { top: content.top - origin.top, bottom: content.bottom - origin.top } : null;
  const visible = (b: Box) => !clip || (rel(b).top + rel(b).height > clip.top && rel(b).top < clip.bottom);

  let line: number | null = null;
  if (dropIndex !== null) {
    const mainBoxes = placementBoxes(vp, mainKeys);
    const at = mainBoxes.find((b) => mainKeys.indexOf(b.key) >= dropIndex);
    const last = mainBoxes[mainBoxes.length - 1];
    line = at ? rel(at).top - 4 : last ? rel(last).top + rel(last).height + 4 : (clip?.top ?? 0) + 8;
  }

  const shown = boxes.filter((b) => (b.key === hovered || b.key === selectedKey) && visible(b));

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        droppable.setNodeRef(el);
      }}
      className="appza-drag-canvas"
      data-over={droppable.isOver ? 'true' : undefined}
    >
      {shown.map((b) => (
        <div
          key={b.key}
          className="appza-drag-outline"
          data-selected={b.key === selectedKey ? 'true' : undefined}
          style={rel(b)}
        >
          <Toolbar
            // Pinned to the visible top, or a long list's handle is out of reach.
            offset={clip ? Math.max(0, clip.top - rel(b).top) : 0}
            dragId={`${CANVAS_PREFIX}${b.key}`}
            name={names[b.key] ?? b.key}
            onRemove={() => onRemove(b.key)}
            onHover={() => setHovered(b.key)}
          />
        </div>
      ))}
      {line !== null && <div className="appza-drag-line" style={{ top: Math.max(line, clip?.top ?? 0) }} />}
    </div>
  );
}

function Toolbar({ dragId, name, offset, onRemove, onHover }: { dragId: string; name: string; offset: number; onRemove: () => void; onHover: () => void }) {
  const drag = useDraggable({ id: dragId });
  return (
    <div className="appza-drag-toolbar" style={{ top: 4 + offset }} onMouseEnter={onHover}>
      <button type="button" ref={drag.setNodeRef} className="appza-drag-handle" aria-label={`Drag ${name}`} {...drag.attributes} {...drag.listeners}>
        ⠿
      </button>
      <span className="appza-drag-name">{name}</span>
      <button type="button" className="appza-drag-remove" onClick={onRemove} aria-label={`Remove ${name}`}>
        ✕
      </button>
    </div>
  );
}

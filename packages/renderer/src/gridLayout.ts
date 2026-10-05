import type { CSSProperties } from 'react';
import type { GridLayout } from '@appza/schemas';

const AREA = /^([a-z][a-z0-9_-]*|\.)$/;
const ONE = '(?:auto|min-content|max-content|0|\\d+(?:\\.\\d+)?(?:px|fr|%|rem|em))';
const SIZE = new RegExp(`^(?:${ONE}|minmax\\(${ONE}, ?${ONE}\\))$`);

// Inline, so it beats the stylesheet's grid for this Superstructure; a malformed grid is ignored, not drawn half.
export function gridLayoutStyle(layout: GridLayout | null | undefined): CSSProperties | undefined {
  if (!layout || layout.apply === false) return undefined;
  const columns = layout.columns ?? [];
  const rows = layout.rows ?? [];
  if (columns.length === 0 || rows.length === 0) return undefined;
  if (!columns.every((c) => SIZE.test(c))) return undefined;
  if (!rows.every((r) => r.length === columns.length && r.every((c) => AREA.test(c)))) return undefined;
  const sizes = layout.row_sizes ?? [];
  const rowSize = (i: number) => { const v = sizes[i]; return sizes.length === rows.length && v !== undefined && SIZE.test(v) ? v : 'auto'; };
  return {
    display: 'grid',
    gridTemplateColumns: columns.join(' '),
    gridTemplateRows: rows.map((_, i) => rowSize(i)).join(' '),
    gridTemplateAreas: rows.map((r) => `"${r.join(' ')}"`).join(' '),
  };
}

// child index → area, only while the grid itself is drawn and only for areas a row contains.
export function childAreas(layout: GridLayout | null | undefined): Map<number, string> {
  const out = new Map<number, string>();
  if (!layout || !gridLayoutStyle(layout)) return out;
  const used = new Set((layout.rows ?? []).flat());
  for (const entry of layout.child_areas ?? []) {
    if (entry.area !== '.' && used.has(entry.area)) out.set(entry.child, entry.area);
  }
  return out;
}

// Pieces drawn without side padding or rounded corners; a look setting, so it holds while the grid itself is off.
export function edgeToEdge(layout: GridLayout | null | undefined): Set<number> {
  return new Set((layout?.edge_to_edge ?? []).filter((c) => Number.isInteger(c)));
}

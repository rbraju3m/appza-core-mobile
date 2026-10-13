import { useMemo } from 'react';
import type { Catalog } from '@appza/schemas';
import { resolveOverridableColumn } from './resolveOverride';

// A sheet or modal opens outside PlacementRenderer, so its block's design and its AppZet's `_style` never reach it
// as inline vars. One stylesheet hands them to every overlay root by its AppZet slug; the overlay's own inline vars
// (from its settings) still win, as they do over a block's design.

const UNSAFE = /[;{}<>\\"]|url\(|expression\(/i;

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

function stamp(into: Map<string, string>, bag: unknown): void {
  if (!isRow(bag)) return;
  for (const [k, v] of Object.entries(bag)) {
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const s = String(v).trim();
    if (s === '' || UNSAFE.test(s) || !/^[a-z0-9_]+$/.test(k)) continue;
    into.set('--appza-' + k.replace(/_/g, '-'), s);
  }
}

export function overlayDesignCss(catalog: Catalog | null | undefined, customizations?: unknown): string {
  const blocks = new Map<number, Row>();
  for (const s of (catalog?.superstructures ?? []) as unknown as Row[]) {
    if (typeof s.id === 'number') blocks.set(s.id, s);
  }
  const rules: string[] = [];
  for (const a of (catalog?.appzets ?? []) as unknown as Row[]) {
    if (typeof a.slug !== 'string' || !/^[a-z0-9-]+$/.test(a.slug)) continue;
    const ss = typeof a.superstructure_id === 'number' ? blocks.get(a.superstructure_id) : undefined;
    const vars = new Map<string, string>();
    stamp(vars, ss?.design);
    for (const e of (Array.isArray(ss?.properties_schema) ? ss!.properties_schema : []) as Row[]) {
      if (isRow(e) && e.style === true && typeof e.name === 'string') stamp(vars, { [e.name]: e.default });
    }
    // A site's saved values win over the catalog's, as everywhere else.
    const base = isRow(a.default_props_override) ? a.default_props_override : {};
    const props = customizations ? resolveOverridableColumn(customizations, 'appzet', a.slug, 'default_props_override', base) : base;
    stamp(vars, isRow(props) ? props._style : undefined);
    if (vars.size === 0) continue;
    const body = [...vars].map(([k, v]) => `${k}:${v}`).join(';');
    rules.push(`[data-appza-overlay][data-appza-appzet-slug="${a.slug}"]{${body}}`);
  }
  return rules.join('\n');
}

export function OverlayDesignStyle({ catalog, customizations }: { catalog: Catalog | null | undefined; customizations?: unknown }) {
  const css = useMemo(() => overlayDesignCss(catalog, customizations), [catalog, customizations]);
  return css ? <style data-appza-overlay-design="">{css}</style> : null;
}

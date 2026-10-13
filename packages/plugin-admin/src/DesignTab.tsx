import { useEffect, useMemo, useState } from 'react';
import { useAdvanced } from './advanced';
import type { Highlight } from './preview/pointer';

// The same parts, names and rules as Core's Design tab (resources/js/Components/DesignPanel.tsx), drawn with the
// simulator's own controls. The index comes from Core at sync (GET appza/v1/design-index).

export type DesignVar = { kind: 'color' | 'size' | 'other'; value: string; shared?: boolean; layouts?: string[]; screens?: string[]; states?: string[] };
export type DesignPart = { key: string; label: string; target: string; pieces: number[]; vars: Record<string, DesignVar> };
export type DesignIndex = {
  // Parts per styled slug, keys local to that slug.
  entries: Record<string, DesignPart[]>;
  appzets: Record<string, { slugs: string[]; pieces: string[] }>;
};
export type AppZetDesign = { parts: DesignPart[]; pieces: string[] };

/** An AppZet's parts, keys made unique across the slugs it draws on, as Core's DesignBag::parts does. */
export function designFor(index: DesignIndex | null, appzetSlug: string): AppZetDesign | null {
  const entry = index?.appzets[appzetSlug];
  if (!index || !entry) return null;
  const parts = entry.slugs.flatMap((slug) => (index.entries[slug] ?? []).map((p) => ({ ...p, key: `${slug}:${p.key}` })));
  return { parts, pieces: entry.pieces };
}

/** Loads the template's index once; null while loading or when the site has not synced one yet. */
export function useDesignIndex(templateSlug: string | null, endpoint: string | undefined, nonce: string | undefined, rev = 0): { index: DesignIndex | null; missing: boolean } {
  const [index, setIndex] = useState<DesignIndex | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setIndex(null);
    setMissing(false);
    if (!templateSlug || !endpoint) return;
    const url = new URL(endpoint, window.location.href);
    url.searchParams.set('template', templateSlug);
    let live = true;
    fetch(url.toString(), { headers: { Accept: 'application/json', ...(nonce ? { 'X-WP-Nonce': nonce } : {}) }, credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: DesignIndex) => live && setIndex(d))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [templateSlug, endpoint, nonce, rev]);
  return { index, missing };
}

const localKey = (p: DesignPart) => p.key.slice(p.key.indexOf(':') + 1);

export type DesignFocus = { keys: string[]; child: number; fallback: boolean; at: number };

/** The parts a click lands on: the piece's own, then every-tag / class parts it matches; none → the whole block. */
export function partsForPick(parts: DesignPart[], pick: { child: number; tags: string[]; classes: string[] }): DesignFocus {
  const own = parts.filter((p) => p.target === 'piece' && p.pieces.includes(pick.child));
  const styling = parts.filter((p) =>
    (p.target === 'all' && pick.tags.includes(localKey(p).replace(/^all-/, '')))
    || (p.target === 'class' && pick.classes.includes(localKey(p).replace(/^class-/, ''))));
  const found = [...own, ...styling];
  const keys = (found.length ? found : parts.filter((p) => p.target === 'block')).map((p) => p.key);
  return { keys, child: pick.child, fallback: found.length === 0, at: Date.now() };
}

/** What the device outlines for an opened part; the block is found from the AppZet. */
export function partHighlight(part: DesignPart, appzet: string): Highlight {
  const key = localKey(part);
  if (part.target === 'piece') return { appzet, pieces: part.pieces };
  if (part.target === 'all') return { appzet, tag: key.replace(/^all-/, '') };
  if (part.target === 'class') return { appzet, cls: key.replace(/^class-/, '') };
  return { appzet, whole: true };
}

/** The hover label: "#10 Button · Like", or "#30 Comment List" when no part styles that piece. */
export function pieceLabel(design: AppZetDesign | null, child: number): string | undefined {
  if (!design || !design.pieces[child]) return undefined;
  const part = design.parts.find((p) => p.target === 'piece' && p.pieces.includes(child));
  const guess = part ? guessed(part.label) : '';
  return pieceName(design.pieces, child) + (guess ? ` · ${guess}` : '');
}
export const pieceName = (pieces: string[] | undefined, i: number) => `#${i} ${pieces?.[i] ?? 'piece'}`;
const guessed = (label: string) => label.replace(/\s*\(piece \d+\)$/i, '').replace(/^Piece \d+$/i, '');

function partTitle(p: DesignPart, pieces?: string[]): { title: string; sub: string } {
  const named = p.target === 'piece' ? p.pieces.map((i) => pieceName(pieces, i)).join(', ') : '';
  const g = guessed(p.label);
  if (p.target !== 'piece') return { title: p.label, sub: p.target === 'all' ? `every ${localKey(p).replace(/^all-ion-/, '').replace(/^all-/, '')}` : '' };
  return g ? { title: g, sub: named } : { title: named, sub: '' };
}

type Control = 'color' | 'corners' | 'spacing' | 'weight' | 'icon' | 'text' | 'exact';

const CHOICES: Record<Exclude<Control, 'color' | 'exact'>, [string, string][]> = {
  corners: [['None', '0'], ['S', '4px'], ['M', '8px'], ['L', '12px'], ['Round', '999px']],
  spacing: [['0', '0'], ['4', '4px'], ['8', '8px'], ['12', '12px'], ['16', '16px'], ['24', '24px']],
  weight: [['Regular', '400'], ['Medium', '500'], ['Semibold', '600'], ['Bold', '700']],
  icon: [['16', '16px'], ['20', '20px'], ['24', '24px'], ['32', '32px'], ['40', '40px'], ['48', '48px']],
  text: [['S', '0.75rem'], ['M', '0.875rem'], ['L', '1rem'], ['XL', '1.25rem']],
};

function controlOf(name: string, v: DesignVar): Control {
  if (v.kind === 'color' || name.endsWith('_color')) return 'color';
  if (/(^|_)radius$/.test(name)) return 'corners';
  if (/(^|_)(padding|margin|gap)$/.test(name)) return 'spacing';
  if (/(^|_)weight$/.test(name)) return 'weight';
  if (/(icon|avatar|logo|image)_size$/.test(name)) return 'icon';
  if (/_size$/.test(name) && v.kind === 'size') return 'text';
  return 'exact';
}

const words = (name: string) => name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
// <input type="color"> takes #rrggbb only; anything else shows black but is kept as typed.
const asHex = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : /^#[0-9a-f]{3}$/i.test(v) ? '#' + [...v.slice(1)].map((c) => c + c).join('') : '#000000');

type SetFn = (name: string, value: string | null) => void;

function Row({ name, v, set, shown, alsoIn, onSet, advanced }: { name: string; v: DesignVar; set: string | undefined; shown: string; alsoIn: string[]; onSet: SetFn; advanced: boolean }) {
  const control = controlOf(name, v);
  const choices = control !== 'color' && control !== 'exact' ? CHOICES[control] : null;
  const notes = [
    ...(v.screens ?? []).map((s) => `only on the ${s} screen`),
    ...(v.layouts ?? []).map((l) => `only in ${l}`),
    ...(v.states ?? []).map((s) => `while ${s}`),
  ];
  const exact = (
    <input
      className="appza-props-panel-input appza-design-exact"
      value={set ?? ''}
      placeholder={shown}
      onChange={(e) => onSet(name, e.target.value === '' ? null : e.target.value)}
      aria-label={`${words(name)} exact value`}
    />
  );

  return (
    <div className="appza-design-row" data-design-var={name}>
      <div className="appza-design-row-head">
        <span className="appza-design-row-name">{words(name)}</span>
        <span className="appza-design-row-value" data-set={set !== undefined}>{set ?? shown}</span>
        {set !== undefined && (
          <button type="button" className="appza-design-reset" onClick={() => onSet(name, null)} title="Back to the default" aria-label="Back to the default">
            ↺
          </button>
        )}
      </div>
      {control === 'color' && (
        <div className="appza-design-color">
          <input type="color" className="appza-props-panel-color" value={asHex(set ?? shown)} onChange={(e) => onSet(name, e.target.value)} aria-label={words(name)} />
          {exact}
        </div>
      )}
      {choices && (
        <div className="appza-design-chips">
          {choices.map(([label, value]) => (
            <button key={value} type="button" className="appza-props-panel-cell" data-active={set === value} onClick={() => onSet(name, set === value ? null : value)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {control !== 'color' && (advanced || !choices) && exact}
      {alsoIn.length > 0 && <div className="appza-design-note">Also changes {alsoIn.join(', ')}.</div>}
      {advanced && (
        <div className="appza-design-tags">
          <code>--appza-{name.replace(/_/g, '-')}</code>
          {notes.map((n) => <span key={n}>{n}</span>)}
        </div>
      )}
    </div>
  );
}

type Props = {
  design: AppZetDesign | null;
  missing: boolean;
  value: Record<string, string>;
  // What shows when nothing is set here: a setting's default, the block's design, else the stylesheet's.
  underneath: (name: string) => string;
  onSet: SetFn;
  // A click on the device: open and light the parts it lands on.
  focus?: DesignFocus | null;
  // The part just opened (null when closed), so the device can outline it.
  onShow?: (part: DesignPart | null) => void;
};

export function DesignTab({ design, missing, value, underneath, onSet, focus, onShow }: Props) {
  const [advanced] = useAdvanced();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const lit = useMemo(() => new Set(focus?.keys ?? []), [focus]);
  useEffect(() => {
    if (!focus || focus.keys.length === 0) return;
    setOpen(Object.fromEntries(focus.keys.map((k) => [k, true])));
    window.setTimeout(() => document.querySelector(`[data-design-part="${CSS.escape(focus.keys[0]!)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.at]);
  useEffect(() => () => onShow?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (p: DesignPart) => {
    const opening = !open[p.key];
    setOpen((o) => ({ ...o, [p.key]: opening }));
    onShow?.(opening ? p : null);
  };
  const parts = design?.parts ?? [];
  const pieces = design?.pieces;
  const partsOf = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const p of parts) for (const n of Object.keys(p.vars)) out.set(n, [...(out.get(n) ?? []), partTitle(p, pieces).title]);
    return out;
  }, [parts, pieces]);

  if (!design) {
    return (
      <div className="appza-props-panel-empty-state">
        <p>{missing ? 'No design index yet. Sync from Core to load the parts this block can be styled by.' : 'Loading the parts…'}</p>
      </div>
    );
  }
  if (parts.length === 0) {
    return (
      <div className="appza-props-panel-empty-state">
        <p>This block’s look has nothing to change here yet.</p>
      </div>
    );
  }

  return (
    <div className="appza-design">
      <p className="appza-design-intro">
        Each part of the block and what it looks like. Anything you leave alone keeps today’s look, shown greyed. Part names are guessed; the #number is the piece.
      </p>
      {focus && (
        <p className="appza-design-focus">
          {focus.fallback
            ? `You clicked ${pieceName(pieces, focus.child)}. It has no design values of its own yet, so the whole block is open.`
            : `You clicked ${pieceName(pieces, focus.child)}: ${focus.keys.length} part${focus.keys.length === 1 ? '' : 's'} lit below.`}
        </p>
      )}
      {parts.map((p) => {
        const names = Object.keys(p.vars);
        const changed = names.filter((n) => value[n] !== undefined).length;
        const t = partTitle(p, pieces);
        const isOpen = parts.length === 1 || !!open[p.key];
        return (
          <div key={p.key} className="appza-props-panel-section" data-design-part={p.key} data-collapsed={isOpen ? 'false' : 'true'} data-lit={lit.has(p.key) || undefined}>
            <button type="button" className="appza-props-panel-section-head" aria-expanded={isOpen} onClick={() => toggle(p)}>
              <span className="appza-props-panel-section-chevron" aria-hidden="true" data-collapsed={isOpen ? 'false' : 'true'}>▸</span>
              <span className="appza-props-panel-section-title">{t.title}</span>
              {t.sub && <span className="appza-design-sub">{t.sub}</span>}
              <span className="appza-design-count">{names.length}</span>
              {changed > 0 && <span className="appza-props-panel-badge appza-design-changed">{changed} changed</span>}
            </button>
            {isOpen && (
              <div className="appza-props-panel-section-body">
                {Object.entries(p.vars).map(([n, v]) => (
                  <Row
                    key={n}
                    name={n}
                    v={v}
                    set={value[n]}
                    shown={underneath(n) || v.value}
                    alsoIn={v.shared ? [...new Set((partsOf.get(n) ?? []).filter((l) => l !== t.title))] : []}
                    onSet={onSet}
                    advanced={advanced}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

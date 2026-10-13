import { useEffect, useMemo, useState } from 'react';
import { useAdvanced } from './advanced';

// "Every block" (D118), as Core's Theme editor shows it: the common colours, corners and text size of all blocks.
// A site stores only what it changes, over the template's own tokens (customization scope `template`, column
// `tokens`); a field left empty follows the template.

type Bag = Record<string, unknown>;

const COLORS: { name: string; label: string }[] = [
  { name: 'surface', label: 'Card background' },
  { name: 'heading', label: 'Heading text (names, titles)' },
  { name: 'body', label: 'Body text' },
  { name: 'muted', label: 'Muted text and icons (times, counts)' },
  { name: 'border', label: 'Lines and borders' },
  { name: 'accent', label: 'Accent (blue links and buttons)' },
];

const SCALES: { name: string; label: string; choices: [string, number][]; min: number; max: number }[] = [
  { name: 'radius_scale', label: 'Corners', choices: [['Square', 0], ['Default', 1], ['Rounder', 1.5]], min: 0, max: 3 },
  { name: 'text_scale', label: 'Text size', choices: [['Smaller', 0.9], ['Default', 1], ['Larger', 1.1]], min: 0.5, max: 2 },
];

const asBag = (v: unknown): Bag => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Bag) : {});
const asHex = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : /^#[0-9a-f]{3}$/i.test(v) ? '#' + [...v.slice(1)].map((c) => c + c).join('') : '#000000');

type Props = {
  templateSlug: string;
  /** The template's own tokens, from the snapshot. */
  templateTokens: unknown;
  customizations: unknown;
  customizationsEndpoint: string;
  restNonce: string;
  /** The site's unsaved tokens, drawn on the device; null = back to what is saved. */
  onLive: (tokens: Bag | null) => void;
  onChanged: () => void;
};

export function ThemePanel({ templateSlug, templateTokens, customizations, customizationsEndpoint, restNonce, onLive, onChanged }: Props) {
  const [advanced] = useAdvanced();
  const saved = useMemo(() => asBag(asBag(asBag(asBag(customizations).template)[templateSlug]).tokens), [customizations, templateSlug]);
  const [bag, setBag] = useState<Bag>(saved);
  const [rowId, setRowId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromTemplate = asBag(asBag(templateTokens).theme);
  const theme = asBag(bag.theme);
  const dirty = JSON.stringify(bag) !== JSON.stringify(saved);

  useEffect(() => setBag(saved), [saved]);
  useEffect(() => {
    onLive(dirty ? bag : null);
  }, [bag, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onLive(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let live = true;
    fetch(customizationsEndpoint, { headers: { Accept: 'application/json', 'X-WP-Nonce': restNonce }, credentials: 'same-origin' })
      .then((r) => r.json())
      .then((rows: Array<{ id: number; scope: string; target_slug: string | null; target_column: string }>) => {
        const row = rows.find((x) => x.scope === 'template' && x.target_slug === templateSlug && x.target_column === 'tokens');
        if (live) setRowId(row ? row.id : null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [customizationsEndpoint, restNonce, templateSlug, saved]);

  // Other token groups the site may have saved (colours, font) are kept as they are.
  const set = (key: string, v: string | number | null) => {
    const nextTheme = { ...asBag(bag.theme) };
    if (v === null || v === '') delete nextTheme[key];
    else nextTheme[key] = v;
    const next: Bag = { ...bag };
    if (Object.keys(nextTheme).length) next.theme = nextTheme;
    else delete next.theme;
    setBag(next);
  };

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const empty = Object.keys(bag).length === 0;
      const res = empty
        ? rowId == null
          ? null
          : await fetch(`${customizationsEndpoint}/${rowId}`, { method: 'DELETE', headers: { 'X-WP-Nonce': restNonce }, credentials: 'same-origin' })
        : await fetch(customizationsEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-WP-Nonce': restNonce },
            credentials: 'same-origin',
            body: JSON.stringify({ scope: 'template', target_slug: templateSlug, target_column: 'tokens', override_value: bag }),
          });
      if (res && !res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      onLive(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="appza-theme-panel">
      <p className="appza-bottom-panel-title">Every block</p>
      <p className="appza-design-intro">
        The common colours, corners and text size of every block and pop-up. Empty follows the template; a block’s Design and settings still win.
      </p>
      <div className="appza-theme-grid">
        {COLORS.map((c) => {
          const set_ = typeof theme[c.name] === 'string' ? (theme[c.name] as string) : '';
          const tpl = typeof fromTemplate[c.name] === 'string' ? (fromTemplate[c.name] as string) : '';
          return (
            <div key={c.name} className="appza-design-row" data-theme-field={c.name}>
              <div className="appza-design-row-head">
                <span className="appza-design-row-name">{c.label}</span>
                {set_ && (
                  <button type="button" className="appza-design-reset" onClick={() => set(c.name, null)} title="Back to the template" aria-label="Back to the template">↺</button>
                )}
              </div>
              <div className="appza-design-color">
                <input type="color" className="appza-props-panel-color" value={asHex(set_ || tpl)} onChange={(e) => set(c.name, e.target.value)} aria-label={c.label} />
                <input
                  className="appza-props-panel-input appza-design-exact"
                  value={set_}
                  placeholder={tpl ? `Template: ${tpl}` : "Not set (each block's own)"}
                  onChange={(e) => set(c.name, e.target.value)}
                  aria-label={`${c.label} value`}
                />
              </div>
            </div>
          );
        })}
      </div>
      {SCALES.map((s) => {
        const v = typeof theme[s.name] === 'number' ? (theme[s.name] as number) : null;
        const tpl = typeof fromTemplate[s.name] === 'number' ? (fromTemplate[s.name] as number) : null;
        return (
          <div key={s.name} className="appza-design-row" data-theme-field={s.name}>
            <div className="appza-design-row-head">
              <span className="appza-design-row-name">{s.label}</span>
              <span className="appza-design-row-value" data-set={v !== null}>{v === null ? (tpl === null ? 'not set' : `template: ×${tpl}`) : `×${v}`}</span>
            </div>
            <div className="appza-design-chips">
              {s.choices.map(([label, n]) => (
                <button key={label} type="button" className="appza-props-panel-cell" data-active={v === n} onClick={() => set(s.name, v === n ? null : n)}>
                  {label}
                </button>
              ))}
            </div>
            {advanced && (
              <input
                type="number"
                className="appza-props-panel-input appza-design-exact"
                min={s.min}
                max={s.max}
                step={0.05}
                value={v ?? ''}
                placeholder="Exact scale, e.g. 1.25"
                onChange={(e) => set(s.name, e.target.value === '' ? null : Math.min(s.max, Math.max(s.min, Number(e.target.value))))}
                aria-label={`${s.label} exact scale`}
              />
            )}
          </div>
        );
      })}
      {advanced && <div className="appza-design-note">Drawn as --appza-theme-surface, -heading, -body, -muted, -border, -accent, -radius-scale, -text-scale.</div>}
      {error && <div className="appza-props-panel-error">{error}</div>}
      <div className="appza-theme-actions">
        <button type="button" className="appza-btn" onClick={() => setBag(saved)} disabled={!dirty || saving}>Reset</button>
        <button type="button" className="appza-btn appza-btn-primary" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

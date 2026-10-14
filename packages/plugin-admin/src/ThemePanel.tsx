import { useEffect, useMemo, useState } from 'react';
import { useAdvanced } from './advanced';

// As Core's Theme editor: main colours + font (color.*, typography.fontFamily), then "Every block" (D118, theme.*).
// A site stores only what it changes, over the template's own tokens (customization scope `template`, column
// `tokens`); a field left empty follows the template.

type Bag = Record<string, unknown>;
type Group = 'color' | 'typography' | 'theme';

const MAIN_COLORS: { name: string; label: string }[] = [
  { name: 'primary', label: 'Main colour (buttons, links)' },
  { name: 'secondary', label: 'Second colour' },
  { name: 'tertiary', label: 'Third colour' },
  { name: 'success', label: 'Success (green states)' },
  { name: 'warning', label: 'Warning' },
  { name: 'danger', label: 'Danger (delete, errors)' },
  { name: 'background', label: 'Page background' },
  { name: 'text', label: 'Text' },
];

const FONTS: { value: string; label: string }[] = [
  { value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', label: "The phone's own font" },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serif (like a book)' },
  { value: 'ui-monospace, Menlo, Consolas, monospace', label: 'Monospace (like code)' },
];

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
  const templateColor = asBag(asBag(templateTokens).color);
  const templateFont = asBag(asBag(templateTokens).typography).fontFamily;
  const theme = asBag(bag.theme);
  const color = asBag(bag.color);
  const font = asBag(bag.typography).fontFamily;
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

  // Keys this panel does not show are kept as they are.
  const setIn = (group: Group, key: string, v: string | number | null) => {
    const nextGroup = { ...asBag(bag[group]) };
    if (v === null || v === '') delete nextGroup[key];
    else nextGroup[key] = v;
    const next: Bag = { ...bag };
    if (Object.keys(nextGroup).length) next[group] = nextGroup;
    else delete next[group];
    setBag(next);
  };
  const set = (key: string, v: string | number | null) => setIn('theme', key, v);
  const extraColors = Object.keys(color).filter((n) => !MAIN_COLORS.some((c) => c.name === n));
  const fontOptions = typeof font === 'string' && font && !FONTS.some((f) => f.value === font) ? [...FONTS, { value: font, label: font }] : FONTS;
  const templateFontLabel = typeof templateFont === 'string' && templateFont ? FONTS.find((f) => f.value === templateFont)?.label ?? templateFont : null;

  const colorRow = (name: string, label: string, value: string, tpl: string, empty: string, onSet: (v: string | null) => void) => (
    <div key={name} className="appza-design-row" data-theme-field={name}>
      <div className="appza-design-row-head">
        <span className="appza-design-row-name">{label}</span>
        {value && (
          <button type="button" className="appza-design-reset" onClick={() => onSet(null)} title="Back to the template" aria-label="Back to the template">↺</button>
        )}
      </div>
      <div className="appza-design-color">
        <input type="color" className="appza-props-panel-color" value={asHex(value || tpl)} onChange={(e) => onSet(e.target.value)} aria-label={label} />
        <input
          className="appza-props-panel-input appza-design-exact"
          value={value}
          placeholder={tpl ? `Template: ${tpl}` : empty}
          onChange={(e) => onSet(e.target.value)}
          aria-label={`${label} value`}
        />
      </div>
    </div>
  );
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

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
      <p className="appza-bottom-panel-title">Main colours and font</p>
      <p className="appza-design-intro">The app's own colours (buttons, states, page) and its font. Empty follows the template.</p>
      <div className="appza-theme-grid">
        {[...MAIN_COLORS, ...extraColors.map((n) => ({ name: n, label: n }))].map((c) =>
          colorRow(`color.${c.name}`, c.label, str(color[c.name]), str(templateColor[c.name]), 'Not set (app default)', (v) => setIn('color', c.name, v)),
        )}
      </div>
      <div className="appza-design-row" data-theme-field="typography.fontFamily">
        <div className="appza-design-row-head">
          <span className="appza-design-row-name">Font</span>
          {str(font) && (
            <button type="button" className="appza-design-reset" onClick={() => setIn('typography', 'fontFamily', null)} title="Back to the template" aria-label="Back to the template">↺</button>
          )}
        </div>
        <select className="appza-props-panel-input" value={str(font)} onChange={(e) => setIn('typography', 'fontFamily', e.target.value || null)} aria-label="Font">
          <option value="">{templateFontLabel ? `Template: ${templateFontLabel}` : "The app's default font"}</option>
          {fontOptions.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
      {advanced && <div className="appza-design-note">Drawn as --ion-color-&lt;name&gt; (and its shade / tint), --ion-background-color, --ion-text-color, --ion-font-family.</div>}
      <p className="appza-bottom-panel-title">Every block</p>
      <p className="appza-design-intro">
        The common colours, corners and text size of every block and pop-up. Empty follows the template; a block’s Design and settings still win.
      </p>
      <div className="appza-theme-grid">
        {COLORS.map((c) => colorRow(c.name, c.label, str(theme[c.name]), str(fromTemplate[c.name]), "Not set (each block's own)", (v) => set(c.name, v)))}
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

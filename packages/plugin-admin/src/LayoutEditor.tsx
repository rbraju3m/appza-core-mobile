import { useMemo, useState } from 'react';
import type { LayoutStyle } from '@appza/schemas';

type Props = {
  value: LayoutStyle;
  onChange: (next: LayoutStyle) => void;
};

/**
 * Web-devtools-level layout editor for a single Ionic primitive
 * inside an AppZet composition (DC#20 slice 4).
 *
 * All controls are free-form — no cell pickers — because the target
 * audience is people who think in pixels + hex + CSS enums. Every
 * knob is opt-in; unset values fall through to browser / Ionic
 * defaults via the deep-optional LayoutStyle shape.
 *
 * Controlled component: parent owns the LayoutStyle state and receives
 * whole-object updates. Undefined leaves are stripped on write so the
 * shape stays clean (no `padding: {}` after clearing all four sides).
 */
export function LayoutEditor({ value, onChange }: Props) {
  const [q, setQ] = useState('');
  const filter = q.trim().toLowerCase();
  const showSection = (label: string) => !filter || label.toLowerCase().includes(filter);

  function set<K extends keyof LayoutStyle>(key: K, next: LayoutStyle[K] | undefined) {
    const draft: LayoutStyle = { ...value };
    if (next === undefined) {
      delete draft[key];
    } else {
      draft[key] = next;
    }
    onChange(draft);
  }

  function setNested<K extends keyof LayoutStyle>(
    key: K,
    subKey: string,
    subVal: unknown,
  ) {
    const current = (value[key] ?? {}) as Record<string, unknown>;
    const draft = { ...current };
    if (subVal === undefined) delete draft[subKey];
    else draft[subKey] = subVal;
    const isEmpty = Object.keys(draft).length === 0;
    set(key, (isEmpty ? undefined : draft) as LayoutStyle[K] | undefined);
  }

  function setBorderSide(
    side: 'top' | 'right' | 'bottom' | 'left',
    field: 'width' | 'style' | 'color',
    v: unknown,
  ) {
    const border = (value.border ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const current = { ...(border[side] ?? {}) };
    if (v === undefined) delete current[field];
    else current[field] = v;
    const nextBorder = { ...border };
    if (Object.keys(current).length === 0) delete nextBorder[side];
    else nextBorder[side] = current;
    set('border', Object.keys(nextBorder).length === 0 ? undefined : (nextBorder as LayoutStyle['border']));
  }

  const padding = value.padding ?? {};
  const margin = value.margin ?? {};
  const border = value.border ?? {};
  const radius = value.borderRadius ?? {};
  const font = value.font ?? {};
  const flex = value.flex ?? {};

  return (
    <div className="appza-layout-editor">
      <div className="appza-props-panel-search">
        <input
          type="search"
          className="appza-props-panel-input"
          placeholder="Filter sections…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {showSection('Box model — padding margin size') && (
        <Section title="Box model" dirty={hasAny(padding) || hasAny(margin)}>
          <SubHeading>Padding</SubHeading>
          <FourSides
            values={padding}
            onChange={(side, v) => setNested('padding', side, v)}
          />
          <SubHeading>Margin</SubHeading>
          <FourSides
            values={margin}
            onChange={(side, v) => setNested('margin', side, v)}
          />
          <SubHeading>Size</SubHeading>
          <div className="appza-layout-grid">
            <DimField label="Width" value={value.width} onChange={(v) => set('width', v)} />
            <DimField label="Height" value={value.height} onChange={(v) => set('height', v)} />
            <DimField label="Min W" value={value.minWidth} onChange={(v) => set('minWidth', v)} />
            <DimField label="Max W" value={value.maxWidth} onChange={(v) => set('maxWidth', v)} />
            <DimField label="Min H" value={value.minHeight} onChange={(v) => set('minHeight', v)} />
            <DimField label="Max H" value={value.maxHeight} onChange={(v) => set('maxHeight', v)} />
          </div>
        </Section>
      )}

      {showSection('Border corner radius') && (
        <Section title="Border" dirty={hasBorder(border) || hasAny(radius)}>
          <SubHeading>Width · style · color per side</SubHeading>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
            const b = (border as Record<string, { width?: number; style?: string; color?: string } | undefined>)[side] ?? {};
            return (
              <div className="appza-layout-border-row" key={side}>
                <span className="appza-layout-side">{side}</span>
                <NumberInput
                  compact
                  placeholder="w"
                  value={b.width}
                  onChange={(v) => setBorderSide(side, 'width', v)}
                />
                <select
                  className="appza-props-panel-input appza-layout-select"
                  value={b.style ?? ''}
                  onChange={(e) =>
                    setBorderSide(side, 'style', e.target.value === '' ? undefined : e.target.value)
                  }
                >
                  <option value="">—</option>
                  <option value="solid">solid</option>
                  <option value="dashed">dashed</option>
                  <option value="dotted">dotted</option>
                  <option value="double">double</option>
                </select>
                <ColorInput
                  value={b.color}
                  onChange={(v) => setBorderSide(side, 'color', v)}
                />
              </div>
            );
          })}
          <SubHeading>Radius per corner</SubHeading>
          <div className="appza-layout-grid">
            <NumberField label="Top-left" value={radius.tl} onChange={(v) => setNested('borderRadius', 'tl', v)} />
            <NumberField label="Top-right" value={radius.tr} onChange={(v) => setNested('borderRadius', 'tr', v)} />
            <NumberField label="Bottom-left" value={radius.bl} onChange={(v) => setNested('borderRadius', 'bl', v)} />
            <NumberField label="Bottom-right" value={radius.br} onChange={(v) => setNested('borderRadius', 'br', v)} />
          </div>
        </Section>
      )}

      {showSection('Background color opacity shadow') && (
        <Section
          title="Background"
          dirty={
            value.backgroundColor !== undefined ||
            value.opacity !== undefined ||
            value.boxShadow !== undefined
          }
        >
          <div className="appza-layout-grid">
            <ColorField
              label="Background color"
              value={value.backgroundColor}
              onChange={(v) => set('backgroundColor', v)}
            />
            <NumberField
              label="Opacity"
              value={value.opacity}
              step={0.05}
              min={0}
              max={1}
              onChange={(v) => set('opacity', v)}
            />
          </div>
          <TextField
            label="Box shadow (CSS)"
            value={value.boxShadow}
            placeholder="0 2px 8px rgba(0,0,0,0.15)"
            onChange={(v) => set('boxShadow', v)}
          />
        </Section>
      )}

      {showSection('Typography text color font') && (
        <Section title="Typography" dirty={value.color !== undefined || hasAny(font) || value.textAlign !== undefined}>
          <div className="appza-layout-grid">
            <ColorField label="Text color" value={value.color} onChange={(v) => set('color', v)} />
            <SelectField
              label="Align"
              value={value.textAlign}
              onChange={(v) => set('textAlign', v as LayoutStyle['textAlign'])}
              options={['left', 'center', 'right', 'justify']}
            />
          </div>
          <TextField
            label="Font family"
            value={font.family}
            placeholder="e.g. Inter, system-ui"
            onChange={(v) => setNested('font', 'family', v)}
          />
          <div className="appza-layout-grid">
            <NumberField label="Font size" value={font.size} onChange={(v) => setNested('font', 'size', v)} />
            <FontWeightField
              value={font.weight}
              onChange={(v) => setNested('font', 'weight', v)}
            />
            <NumberField
              label="Line height"
              value={font.lineHeight}
              step={0.1}
              onChange={(v) => setNested('font', 'lineHeight', v)}
            />
            <NumberField
              label="Letter spacing"
              value={font.letterSpacing}
              step={0.1}
              onChange={(v) => setNested('font', 'letterSpacing', v)}
            />
          </div>
        </Section>
      )}

      {showSection('Flex direction wrap grow shrink gap') && (
        <Section title="Flex" dirty={hasAny(flex) || value.alignSelf !== undefined}>
          <div className="appza-layout-grid">
            <SelectField
              label="Direction"
              value={flex.direction}
              onChange={(v) => setNested('flex', 'direction', v)}
              options={['row', 'row-reverse', 'column', 'column-reverse']}
            />
            <SelectField
              label="Wrap"
              value={flex.wrap}
              onChange={(v) => setNested('flex', 'wrap', v)}
              options={['nowrap', 'wrap', 'wrap-reverse']}
            />
            <NumberField label="Grow" value={flex.grow} step={0.1} onChange={(v) => setNested('flex', 'grow', v)} />
            <NumberField label="Shrink" value={flex.shrink} step={0.1} onChange={(v) => setNested('flex', 'shrink', v)} />
            <DimField
              label="Basis"
              value={flex.basis}
              onChange={(v) => setNested('flex', 'basis', v)}
            />
            <NumberField label="Gap" value={flex.gap} onChange={(v) => setNested('flex', 'gap', v)} />
          </div>
          <div className="appza-layout-grid">
            <SelectField
              label="Justify content"
              value={flex.justifyContent}
              onChange={(v) => setNested('flex', 'justifyContent', v)}
              options={[
                'flex-start',
                'flex-end',
                'center',
                'space-between',
                'space-around',
                'space-evenly',
              ]}
            />
            <SelectField
              label="Align items"
              value={flex.alignItems}
              onChange={(v) => setNested('flex', 'alignItems', v)}
              options={['flex-start', 'flex-end', 'center', 'stretch', 'baseline']}
            />
            <SelectField
              label="Align self"
              value={value.alignSelf}
              onChange={(v) => set('alignSelf', v as LayoutStyle['alignSelf'])}
              options={['auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline']}
            />
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  dirty,
  children,
}: {
  title: string;
  dirty?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="appza-props-panel-section" data-collapsed={collapsed ? 'true' : 'false'}>
      <button
        type="button"
        className="appza-props-panel-section-head"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span
          className="appza-props-panel-section-chevron"
          aria-hidden="true"
          data-collapsed={collapsed ? 'true' : 'false'}
        >
          ▸
        </span>
        <span className="appza-props-panel-section-title">{title}</span>
        {dirty && <span className="appza-props-panel-tab-dot" aria-label="Has values" />}
      </button>
      {!collapsed && <div className="appza-props-panel-section-body">{children}</div>}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <div className="appza-layout-sub">{children}</div>;
}

function FourSides({
  values,
  onChange,
}: {
  values: { top?: number; right?: number; bottom?: number; left?: number };
  onChange: (side: 'top' | 'right' | 'bottom' | 'left', v: number | undefined) => void;
}) {
  return (
    <div className="appza-layout-box">
      <div className="appza-layout-box-row appza-layout-box-row-single">
        <NumberInput compact placeholder="T" value={values.top} onChange={(v) => onChange('top', v)} />
      </div>
      <div className="appza-layout-box-row">
        <NumberInput compact placeholder="L" value={values.left} onChange={(v) => onChange('left', v)} />
        <NumberInput compact placeholder="R" value={values.right} onChange={(v) => onChange('right', v)} />
      </div>
      <div className="appza-layout-box-row appza-layout-box-row-single">
        <NumberInput compact placeholder="B" value={values.bottom} onChange={(v) => onChange('bottom', v)} />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="appza-layout-field">
      <label className="appza-layout-label">{label}</label>
      <NumberInput value={value} onChange={onChange} step={step} min={min} max={max} />
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  step,
  min,
  max,
  placeholder,
  compact,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <input
      type="number"
      className={`appza-props-panel-input ${compact ? 'appza-layout-input-compact' : ''}`}
      value={value === undefined || value === null ? '' : String(value)}
      placeholder={placeholder}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(undefined);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function DimField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | string | undefined;
  onChange: (v: number | string | undefined) => void;
}) {
  const asString = useMemo(() => (typeof value === 'number' ? String(value) : (value ?? '')), [value]);
  return (
    <div className="appza-layout-field">
      <label className="appza-layout-label">{label}</label>
      <input
        type="text"
        className="appza-props-panel-input"
        placeholder="px or auto"
        value={asString}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          if (/^-?\d+(\.\d+)?$/.test(raw)) {
            onChange(Number(raw));
          } else {
            onChange(raw);
          }
        }}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="appza-layout-field">
      <label className="appza-layout-label">{label}</label>
      <ColorInput value={value} onChange={onChange} />
    </div>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="appza-layout-color-wrap">
      <input
        type="color"
        className="appza-props-panel-color"
        value={value ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      {value !== undefined && (
        <button
          type="button"
          className="appza-props-panel-option-clear"
          title="Clear"
          onClick={() => onChange(undefined)}
        >
          ×
        </button>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="appza-layout-field appza-layout-field-full">
      <label className="appza-layout-label">{label}</label>
      <input
        type="text"
        className="appza-props-panel-input"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: string[];
}) {
  return (
    <div className="appza-layout-field">
      <label className="appza-layout-label">{label}</label>
      <select
        className="appza-props-panel-input appza-layout-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function FontWeightField({
  value,
  onChange,
}: {
  value: number | 'normal' | 'bold' | 'lighter' | 'bolder' | undefined;
  onChange: (v: number | 'normal' | 'bold' | 'lighter' | 'bolder' | undefined) => void;
}) {
  const asString = value === undefined ? '' : String(value);
  return (
    <div className="appza-layout-field">
      <label className="appza-layout-label">Weight</label>
      <input
        type="text"
        className="appza-props-panel-input"
        placeholder="400 or bold"
        list="appza-font-weights"
        value={asString}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          if (/^\d+$/.test(raw)) {
            onChange(Number(raw));
            return;
          }
          if (raw === 'normal' || raw === 'bold' || raw === 'lighter' || raw === 'bolder') {
            onChange(raw);
          }
        }}
      />
      <datalist id="appza-font-weights">
        <option value="100" />
        <option value="200" />
        <option value="300" />
        <option value="400" />
        <option value="500" />
        <option value="600" />
        <option value="700" />
        <option value="800" />
        <option value="900" />
        <option value="normal" />
        <option value="bold" />
        <option value="lighter" />
        <option value="bolder" />
      </datalist>
    </div>
  );
}

function hasAny(obj: object | undefined): boolean {
  return !!obj && Object.keys(obj).length > 0;
}

function hasBorder(b: object | undefined): boolean {
  if (!b) return false;
  return Object.values(b).some((side) => side && typeof side === 'object' && Object.keys(side as object).length > 0);
}

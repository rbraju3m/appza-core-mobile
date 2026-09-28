import { useEffect, useMemo, useState } from 'react';
import type { AppZet, PropertiesSchemaEntry, Superstructure } from '@appza/schemas';
import { readDataPath, resolveOverridableColumn, useDataSource } from '@appza/renderer';
import { IconPicker } from './IconPicker';

type Props = {
  appzet: AppZet;
  superstructure: Superstructure | null;
  /** Lets the panel hide slot groups whose runtime data is empty (e.g. CTA 4/5 when the API returns 3). */
  dataSourceSlug?: string | null;
  customizations: unknown;
  customizationsEndpoint: string;
  restNonce: string;
  onClose: () => void;
  onChanged: () => void;
  onLivePreview: (mergedOverride: Record<string, unknown> | null) => void;
};

type OptionValue = boolean | number | string | Array<Record<string, unknown>>;
type OptionValues = Record<string, OptionValue>;

type TabKey = 'wrapper' | 'options' | 'action';

const CELL_VALUES = [0, 4, 8, 16, 24] as const;
const BORDER_WIDTHS = [0, 1, 2, 4, 8] as const;

type Spacing = {
  margin_h?: number;
  margin_v?: number;
  padding_h?: number;
  padding_v?: number;
  border_width?: number;
  border_color?: string;
  border_radius?: number;
};

export function PropertiesPanel({
  appzet,
  superstructure,
  dataSourceSlug,
  customizations,
  customizationsEndpoint,
  restNonce,
  onClose,
  onChanged,
  onLivePreview,
}: Props) {
  const dataState = useDataSource(dataSourceSlug ?? undefined);
  const previewItem = dataState.items[0];
  const [activeTab, setActiveTab] = useState<TabKey>('wrapper');
  const [spacing, setSpacing] = useState<Spacing>({});
  const [options, setOptions] = useState<OptionValues>({});
  const [existingRowId, setExistingRowId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [optionsFilter, setOptionsFilter] = useState('');

  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // Same resolver as the renderer, so panel and preview agree after a refresh.
  const overridesBlob = useMemo<Record<string, unknown>>(() => {
    const catalogBlob =
      (appzet.default_props_override as Record<string, unknown> | null | undefined) ?? {};
    const merged = resolveOverridableColumn(
      customizations,
      'appzet',
      appzet.slug,
      'default_props_override',
      catalogBlob,
    );
    return merged && typeof merged === 'object' && !Array.isArray(merged)
      ? (merged as Record<string, unknown>)
      : {};
  }, [appzet, customizations]);

  const initialSpacing = useMemo<Spacing>(() => {
    const v = overridesBlob['spacing'];
    return v && typeof v === 'object' ? (v as Spacing) : {};
  }, [overridesBlob]);

  const exposedProps = useMemo<PropertiesSchemaEntry[]>(() => {
    const schema = superstructure?.properties_schema ?? null;
    if (!Array.isArray(schema)) return [];
    const baseExposed = schema.filter((p) => p.exposed_to_builder !== false);
    return baseExposed.filter((p) =>
      isPropertyVisibleForItem(p, previewItem, superstructure),
    );
  }, [superstructure, previewItem]);

  const initialOptions = useMemo<OptionValues>(() => {
    const out: OptionValues = {};
    for (const p of exposedProps) {
      const stored = overridesBlob[p.name];
      if (stored !== undefined && isOptionValue(stored)) {
        out[p.name] = stored;
      }
    }
    return out;
  }, [exposedProps, overridesBlob]);

  useEffect(() => {
    return () => onLivePreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSpacing({ ...initialSpacing });
    setOptions({ ...initialOptions });
    fetch(customizationsEndpoint, {
      headers: { Accept: 'application/json', 'X-WP-Nonce': restNonce },
      credentials: 'same-origin',
    })
      .then((r) => r.json())
      .then((rows: Array<{ id: number; scope: string; target_slug: string | null; target_column: string }>) => {
        const match = rows.find(
          (r) => r.scope === 'appzet' && r.target_slug === appzet.slug && r.target_column === 'default_props_override',
        );
        setExistingRowId(match ? match.id : null);
      })
      .catch(() => {
        // Not critical — Save creates a new row anyway.
      });
  }, [appzet.slug, initialSpacing, initialOptions, customizationsEndpoint, restNonce]);

  const spacingDirty = useMemo(
    () => JSON.stringify(spacing) !== JSON.stringify(initialSpacing),
    [spacing, initialSpacing],
  );
  const optionsDirty = useMemo(
    () => JSON.stringify(options) !== JSON.stringify(initialOptions),
    [options, initialOptions],
  );
  const dirty = spacingDirty || optionsDirty;

  // Starts from the persisted view so keys this panel doesn't manage survive the save.
  function composeOverrideValue(
    spacingState: Spacing,
    optionsState: OptionValues,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...overridesBlob, spacing: spacingState, ...optionsState };
    for (const p of exposedProps) {
      if (!(p.name in optionsState) && p.name in out && p.name !== 'spacing') {
        delete out[p.name];
      }
    }
    return out;
  }

  useEffect(() => {
    if (JSON.stringify(spacing) === JSON.stringify(initialSpacing) &&
        JSON.stringify(options) === JSON.stringify(initialOptions)) {
      onLivePreview(null);
      return;
    }
    onLivePreview(composeOverrideValue(spacing, options));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacing, options, initialSpacing, initialOptions]);

  function setField<K extends keyof Spacing>(key: K, value: Spacing[K]) {
    setSpacing((prev) => ({ ...prev, [key]: value }));
  }

  function setOption(name: string, value: OptionValue | undefined) {
    setOptions((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[name];
      else next[name] = value;
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const newValue = composeOverrideValue(spacing, options);

      const response = await fetch(customizationsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-WP-Nonce': restNonce,
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: 'appzet',
          target_slug: appzet.slug,
          target_column: 'default_props_override',
          override_value: newValue,
        }),
      });
      if (!response.ok) {
        const t = await response.text();
        throw new Error(`HTTP ${response.status}: ${t.slice(0, 200)}`);
      }
      onLivePreview(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (existingRowId == null) {
      setSpacing({});
      setOptions({});
      onLivePreview(null);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`${customizationsEndpoint}/${existingRowId}`, {
        method: 'DELETE',
        headers: { 'X-WP-Nonce': restNonce },
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const t = await response.text();
        throw new Error(`HTTP ${response.status}: ${t.slice(0, 200)}`);
      }
      setSpacing({});
      setOptions({});
      setExistingRowId(null);
      onLivePreview(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSpacing({ ...initialSpacing });
    setOptions({ ...initialOptions });
    setError(null);
  }

  const grouped = useMemo(() => groupOptions(exposedProps), [exposedProps]);

  return (
    <aside className="appza-props-panel">
      <header className="appza-props-panel-header">
        <div className="appza-props-panel-header-titles">
          <span className="appza-props-panel-title">{appzet.name ?? appzet.slug}</span>
          <span className="appza-props-panel-subtitle">{appzet.slug}</span>
        </div>
        <button className="appza-props-panel-close" onClick={onClose} aria-label="Close">×</button>
      </header>

      <div className="appza-props-panel-tabs" role="tablist">
        {(['wrapper', 'options', 'action'] as TabKey[]).map((tab) => {
          const tabDirty =
            (tab === 'wrapper' && spacingDirty) ||
            (tab === 'options' && optionsDirty);
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className="appza-props-panel-tab"
              data-active={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              {tabDirty && <span className="appza-props-panel-tab-dot" aria-label="Unsaved changes" />}
            </button>
          );
        })}
      </div>

      <div className="appza-props-panel-body">
        {activeTab === 'wrapper' && (
          <>
            <Section
              id="spacing"
              title="Spacing"
              collapsed={collapsed['spacing']}
              onToggle={() => toggleCollapsed('spacing')}
            >
              <Subsection title="Margin">
                <CellRow label="Horizontal" value={spacing.margin_h} onPick={(v) => setField('margin_h', v)} values={CELL_VALUES} />
                <CellRow label="Vertical" value={spacing.margin_v} onPick={(v) => setField('margin_v', v)} values={CELL_VALUES} />
              </Subsection>
              <Subsection title="Padding">
                <CellRow label="Horizontal" value={spacing.padding_h} onPick={(v) => setField('padding_h', v)} values={CELL_VALUES} />
                <CellRow label="Vertical" value={spacing.padding_v} onPick={(v) => setField('padding_v', v)} values={CELL_VALUES} />
              </Subsection>
            </Section>
            <Section
              id="border"
              title="Border"
              collapsed={collapsed['border']}
              onToggle={() => toggleCollapsed('border')}
            >
              <CellRow label="Width" value={spacing.border_width} onPick={(v) => setField('border_width', v)} values={BORDER_WIDTHS} labelZero="Off" />
              <ColorRow label="Color" value={spacing.border_color} onChange={(v) => setField('border_color', v)} />
              <CellRow label="Radius" value={spacing.border_radius} onPick={(v) => setField('border_radius', v)} values={CELL_VALUES} />
            </Section>
          </>
        )}

        {activeTab === 'options' && (
          <>
            {!superstructure ? (
              <div className="appza-props-panel-empty-state">
                <p>No linked Superstructure.</p>
              </div>
            ) : exposedProps.length === 0 ? (
              <div className="appza-props-panel-empty-state">
                <p>This Superstructure exposes no options.</p>
              </div>
            ) : (
              <>
                {exposedProps.length > 6 && (
                  <div className="appza-props-panel-search">
                    <input
                      type="search"
                      className="appza-props-panel-input"
                      placeholder={`Search ${exposedProps.length} options…`}
                      value={optionsFilter}
                      onChange={(e) => setOptionsFilter(e.target.value)}
                    />
                  </div>
                )}
                {grouped.map(([groupTitle, props]) => {
                  const filtered = optionsFilter.trim()
                    ? props.filter((p) => p.name.toLowerCase().includes(optionsFilter.toLowerCase()))
                    : props;
                  if (filtered.length === 0) return null;
                  return (
                    <Section
                      key={groupTitle}
                      id={`options-${groupTitle}`}
                      title={groupTitle}
                      count={filtered.length}
                      collapsed={collapsed[`options-${groupTitle}`]}
                      onToggle={() => toggleCollapsed(`options-${groupTitle}`)}
                    >
                      <div className="appza-props-panel-options">
                        {filtered.map((prop) => (
                          <OptionRow
                            key={prop.name}
                            prop={prop}
                            value={options[prop.name]}
                            onChange={(v) => setOption(prop.name, v)}
                          />
                        ))}
                      </div>
                    </Section>
                  );
                })}
              </>
            )}
          </>
        )}

        {activeTab === 'action' && (
          <Section
            id="wired-actions"
            title="Wired actions"
            count={
              appzet.actions && typeof appzet.actions === 'object'
                ? Object.keys(appzet.actions as object).length
                : 0
            }
            collapsed={collapsed['wired-actions']}
            onToggle={() => toggleCollapsed('wired-actions')}
          >
            {appzet.actions && typeof appzet.actions === 'object' && Object.keys(appzet.actions as object).length > 0 ? (
              <ul className="appza-props-panel-actions">
                {Object.entries(appzet.actions as Record<string, { action_slug?: string }>).map(([slot, wiring]) => (
                  <li key={slot}>
                    <span className="appza-props-panel-action-slot">
                      <span className="appza-props-panel-action-gesture">{gestureFor(slot)}</span>
                      {slot}
                    </span>
                    {wiring?.action_slug ? (
                      <span className="appza-props-panel-action-slug appza-props-panel-badge">
                        {wiring.action_slug}
                      </span>
                    ) : (
                      <span className="appza-props-panel-action-unwired">unwired</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="appza-props-panel-empty-state">
                <p>This AppZet wires no actions.</p>
              </div>
            )}
          </Section>
        )}
      </div>

      {error && <div className="appza-props-panel-error">{error}</div>}

      <footer className="appza-props-panel-footer">
        <button
          className="appza-btn appza-btn-danger"
          onClick={handleRemove}
          disabled={saving || existingRowId == null}
          title="Delete the customization row for this AppZet"
        >
          Remove
        </button>
        <div className="appza-props-panel-footer-primary">
          <button className="appza-btn" onClick={handleReset} disabled={!dirty || saving}>
            Reset
          </button>
          <button className="appza-btn appza-btn-primary" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </footer>
    </aside>
  );
}

const CANONICAL_ORDER = ['Visibility', 'Icons', 'Labels'];
const OTHER_GROUP = 'Other';

function groupOptions(
  props: PropertiesSchemaEntry[],
): Array<[string, PropertiesSchemaEntry[]]> {
  const buckets = new Map<string, PropertiesSchemaEntry[]>();
  const authorOrder: string[] = [];
  for (const p of props) {
    const declared = typeof p.group === 'string' && p.group.length > 0 ? p.group : null;
    const groupName = declared ?? heuristicGroup(p);
    if (!buckets.has(groupName)) {
      buckets.set(groupName, []);
      if (declared && !CANONICAL_ORDER.includes(groupName) && groupName !== OTHER_GROUP) {
        authorOrder.push(groupName);
      }
    }
    buckets.get(groupName)!.push(p);
  }
  const ordered: Array<[string, PropertiesSchemaEntry[]]> = [];
  for (const name of CANONICAL_ORDER) {
    if (buckets.has(name)) ordered.push([name, buckets.get(name)!]);
  }
  for (const name of authorOrder) {
    ordered.push([name, buckets.get(name)!]);
  }
  if (buckets.has(OTHER_GROUP)) ordered.push([OTHER_GROUP, buckets.get(OTHER_GROUP)!]);
  return ordered;
}

function heuristicGroup(p: PropertiesSchemaEntry): string {
  if (p.controls_visibility_of || p.controls_branch) return 'Visibility';
  if (isIconProp(p)) return 'Icons';
  if (isLabelProp(p)) return 'Labels';
  return OTHER_GROUP;
}

function isIconProp(p: PropertiesSchemaEntry): boolean {
  if (/_icon$|Icon$/.test(p.name)) return true;
  const b = typeof p.binds_to === 'string' ? p.binds_to : '';
  return b.endsWith('.icon');
}

function isLabelProp(p: PropertiesSchemaEntry): boolean {
  if (/_label$|_text$|Label$|Text$/.test(p.name)) return true;
  const b = typeof p.binds_to === 'string' ? p.binds_to : '';
  return b.endsWith('.text') || b.endsWith('.label');
}

function gestureFor(slot: string): string {
  if (slot.startsWith('on_tap_')) return 'TAP';
  if (slot.startsWith('on_long_press_')) return 'HOLD';
  if (slot.startsWith('on_swipe_')) return 'SWIPE';
  if (slot.startsWith('on_scroll_')) return 'SCROLL';
  return 'EVENT';
}

function Section({
  id,
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const collapsible = typeof onToggle === 'function';
  return (
    <div
      className="appza-props-panel-section"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-section={id}
    >
      <button
        type="button"
        className="appza-props-panel-section-head"
        onClick={onToggle}
        aria-expanded={!collapsed}
        disabled={!collapsible}
      >
        {collapsible && (
          <span
            className="appza-props-panel-section-chevron"
            aria-hidden="true"
            data-collapsed={collapsed ? 'true' : 'false'}
          >
            ▸
          </span>
        )}
        <span className="appza-props-panel-section-title">{title}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="appza-props-panel-section-count">{count}</span>
        )}
      </button>
      {!collapsed && <div className="appza-props-panel-section-body">{children}</div>}
    </div>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="appza-props-panel-sub">
      <div className="appza-props-panel-sub-title">{title}</div>
      {children}
    </div>
  );
}

function CellRow({
  label,
  value,
  values,
  onPick,
  labelZero,
}: {
  label: string;
  value: number | undefined;
  values: readonly number[];
  onPick: (v: number | undefined) => void;
  labelZero?: string;
}) {
  return (
    <div className="appza-props-panel-row">
      <span className="appza-props-panel-row-label">{label}</span>
      <div className="appza-props-panel-cells">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className="appza-props-panel-cell"
            data-active={value === v}
            onClick={() => onPick(value === v ? undefined : v)}
          >
            {v === 0 && labelZero ? labelZero : v}
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionRow({
  prop,
  value,
  onChange,
}: {
  prop: PropertiesSchemaEntry;
  value: OptionValue | undefined;
  onChange: (v: OptionValue | undefined) => void;
}) {
  const type = inferOptionType(prop);
  const effective = value !== undefined ? value : (prop.default as OptionValue | undefined);
  const isOverridden = value !== undefined;
  const defaultHint = formatDefault(prop.default);
  const label = humanizeName(prop.name);
  const iconFlavored = type === 'string' && isIconProp(prop);
  const selectOptions = readSelectOptions(prop);
  const sizePresets = readSizePresets(prop);
  const sizeUnit = readSizeUnit(prop);
  const hint = readHint(prop);

  return (
    <div className="appza-props-panel-option">
      <div className="appza-props-panel-option-head">
        <span className="appza-props-panel-option-label">{label}</span>
        {isOverridden && <span className="appza-props-panel-option-dot" title="Overridden" />}
      </div>
      <div className="appza-props-panel-option-control">
        {type === 'boolean' ? (
          <label className="appza-props-panel-switch">
            <input
              type="checkbox"
              checked={Boolean(effective)}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="appza-props-panel-switch-track">
              <span className="appza-props-panel-switch-thumb" />
            </span>
            <span className="appza-props-panel-switch-state">
              {Boolean(effective) ? 'On' : 'Off'}
            </span>
          </label>
        ) : type === 'color' ? (
          // onInput repaints while dragging; Firefox fires onChange only when the picker closes.
          <div className="appza-props-panel-color-group">
            <input
              type="color"
              className="appza-props-panel-color"
              value={normalizeHex(effective) ?? '#000000'}
              onInput={(e) => onChange((e.target as HTMLInputElement).value)}
              onChange={(e) => onChange(e.target.value)}
            />
            <input
              type="text"
              className="appza-props-panel-input"
              value={typeof effective === 'string' ? effective : ''}
              placeholder={typeof prop.default === 'string' ? prop.default : '#000000'}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        ) : type === 'select' ? (
          <select
            className="appza-props-panel-input"
            value={typeof effective === 'string' ? effective : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            <option value="">
              {typeof prop.default === 'string' && prop.default !== ''
                ? `Default (${prop.default})`
                : '— Default —'}
            </option>
            {selectOptions.map(({ label: l, value: v }) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        ) : type === 'number' ? (
          <input
            type="number"
            className="appza-props-panel-input"
            value={effective === undefined || effective === null ? '' : String(effective)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') return;
              const n = Number(raw);
              if (Number.isFinite(n)) onChange(n);
            }}
          />
        ) : type === 'size' ? (
          <SizeControl
            value={typeof effective === 'string' ? effective : undefined}
            presets={sizePresets}
            unit={sizeUnit}
            onChange={onChange}
          />
        ) : type === 'array_of_objects' ? (
          <ArrayOfObjectsEditor
            value={Array.isArray(effective) ? effective : undefined}
            defaultRows={Array.isArray(prop.default) ? (prop.default as Array<Record<string, unknown>>) : undefined}
            onChange={onChange}
          />
        ) : iconFlavored ? (
          <IconPicker
            value={typeof effective === 'string' ? effective : undefined}
            onChange={onChange}
          />
        ) : (
          <input
            type="text"
            className="appza-props-panel-input"
            value={effective === undefined || effective === null ? '' : String(effective)}
            placeholder={hint ?? (typeof prop.default === 'string' ? prop.default : '')}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {isOverridden && !iconFlavored && (
          <button
            type="button"
            className="appza-props-panel-option-clear"
            title="Clear override"
            aria-label="Clear override"
            onClick={() => onChange(undefined)}
          >
            ×
          </button>
        )}
      </div>
      {defaultHint && !isOverridden && (
        <div className="appza-props-panel-option-hint">Default: {defaultHint}</div>
      )}
    </div>
  );
}

function ArrayOfObjectsEditor({
  value,
  defaultRows,
  onChange,
}: {
  value: Array<Record<string, unknown>> | undefined;
  defaultRows: Array<Record<string, unknown>> | undefined;
  onChange: (v: Array<Record<string, unknown>> | undefined) => void;
}) {
  const rows = value ?? defaultRows ?? [];
  const isDirty = value !== undefined;

  const columns: string[] = (() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const sources = rows.length > 0 ? rows : defaultRows ?? [];
    for (const r of sources) {
      if (r && typeof r === 'object') {
        for (const k of Object.keys(r)) {
          if (!seen.has(k)) {
            seen.add(k);
            ordered.push(k);
          }
        }
      }
    }
    return ordered;
  })();

  function inferColType(colKey: string): 'boolean' | 'number' | 'string' {
    for (const r of rows.length > 0 ? rows : defaultRows ?? []) {
      const v = r?.[colKey];
      if (typeof v === 'boolean') return 'boolean';
      if (typeof v === 'number') return 'number';
      if (typeof v === 'string') return 'string';
    }
    return 'string';
  }

  function commit(next: Array<Record<string, unknown>>) {
    onChange(next);
  }

  function setCell(rowIdx: number, colKey: string, cellValue: unknown) {
    const next = rows.map((r, i) => (i === rowIdx ? { ...r, [colKey]: cellValue } : r));
    commit(next);
  }

  function addRow() {
    const seed: Record<string, unknown> = {};
    for (const c of columns) {
      const t = inferColType(c);
      seed[c] = t === 'boolean' ? false : t === 'number' ? 0 : '';
    }
    commit([...rows, seed]);
  }

  function removeRow(idx: number) {
    commit(rows.filter((_, i) => i !== idx));
  }

  function move(idx: number, delta: number) {
    const target = idx + delta;
    if (target < 0 || target >= rows.length) return;
    const next = rows.slice();
    const [row] = next.splice(idx, 1);
    if (!row) return;
    next.splice(target, 0, row);
    commit(next);
  }

  return (
    <div className="appza-props-panel-aoo">
      {rows.length === 0 && columns.length === 0 ? (
        <div className="appza-props-panel-aoo-empty">
          <em>No row template — click + Add row to create a first entry.</em>
        </div>
      ) : (
        <table className="appza-props-panel-aoo-table">
          <thead>
            <tr>
              <th style={{ width: 20 }}></th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="appza-props-panel-aoo-idx">{idx + 1}</td>
                {columns.map((c) => {
                  const t = inferColType(c);
                  const cellV = row?.[c];
                  if (t === 'boolean') {
                    return (
                      <td key={c}>
                        <input
                          type="checkbox"
                          checked={Boolean(cellV)}
                          onChange={(e) => setCell(idx, c, e.target.checked)}
                        />
                      </td>
                    );
                  }
                  if (t === 'number') {
                    return (
                      <td key={c}>
                        <input
                          type="number"
                          className="appza-props-panel-input"
                          value={typeof cellV === 'number' ? cellV : ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const n = raw === '' ? 0 : Number(raw);
                            if (Number.isFinite(n)) setCell(idx, c, n);
                          }}
                        />
                      </td>
                    );
                  }
                  return (
                    <td key={c}>
                      <input
                        type="text"
                        className="appza-props-panel-input"
                        value={typeof cellV === 'string' ? cellV : ''}
                        onChange={(e) => setCell(idx, c, e.target.value)}
                      />
                    </td>
                  );
                })}
                <td className="appza-props-panel-aoo-actions">
                  <button type="button" title="Move up" onClick={() => move(idx, -1)} disabled={idx === 0}>▲</button>
                  <button type="button" title="Move down" onClick={() => move(idx, 1)} disabled={idx === rows.length - 1}>▼</button>
                  <button type="button" title="Remove row" onClick={() => removeRow(idx)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="appza-props-panel-aoo-toolbar">
        <button type="button" className="appza-props-panel-aoo-add" onClick={addRow}>
          + Add row
        </button>
        {!isDirty && rows.length > 0 && (
          <span className="appza-props-panel-aoo-hint">Editing default (no override yet).</span>
        )}
      </div>
    </div>
  );
}

function inferOptionType(
  prop: PropertiesSchemaEntry,
): 'boolean' | 'number' | 'string' | 'color' | 'select' | 'size' | 'array_of_objects' {
  const declared = typeof prop.type === 'string' ? prop.type.toLowerCase() : '';
  if (declared === 'boolean' || declared === 'bool') return 'boolean';
  if (declared === 'number' || declared === 'int' || declared === 'integer') return 'number';
  if (declared === 'color') return 'color';
  if (declared === 'array_of_objects' || declared === 'array' || declared === 'list') {
    return 'array_of_objects';
  }
  if (declared === 'select' || declared === 'enum') return 'select';
  if (declared === 'size' || declared === 'length') return 'size';
  const hasPresets = Array.isArray((prop as { presets?: unknown }).presets);
  if (hasPresets) return 'size';
  if (declared === 'string' || declared === 'text') {
    if (/(^|_)color$|Color$/.test(prop.name)) return 'color';
    return 'string';
  }
  if (typeof prop.default === 'boolean') return 'boolean';
  if (typeof prop.default === 'number') return 'number';
  return 'string';
}

// Fail-open: an unresolvable reference shows the entry rather than hiding a control.
function isPropertyVisibleForItem(
  prop: PropertiesSchemaEntry,
  previewItem: unknown,
  ss: Superstructure | null,
): boolean {
  if (previewItem === undefined || previewItem === null) return true;
  const targetIdx = readTargetChildIndex(prop);
  if (targetIdx === null) return true;
  const children = readSSChildren(ss);
  const child = children[targetIdx];
  if (!child) return true;
  const vw = (child as { visible_when?: unknown }).visible_when;
  if (!isRecord(vw)) return true;
  return evaluateSchemaVisibleWhen(vw, previewItem);
}

function readTargetChildIndex(prop: PropertiesSchemaEntry): number | null {
  const bind = typeof prop.binds_to === 'string' ? prop.binds_to : null;
  const vis = typeof prop.controls_visibility_of === 'string' ? prop.controls_visibility_of : null;
  const spec = bind ?? vis;
  if (!spec) return null;
  const m = spec.match(/^children\[(\d+)\]/);
  if (!m || !m[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function readSSChildren(ss: Superstructure | null): Array<Record<string, unknown>> {
  const raw = (ss as { children?: unknown })?.children;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

function evaluateSchemaVisibleWhen(vw: Record<string, unknown>, item: unknown): boolean {
  const binding = typeof vw['binding'] === 'string' ? (vw['binding'] as string) : '';
  const op = typeof vw['op'] === 'string' ? (vw['op'] as string) : '';
  const value = vw['value'];
  if (!binding || !op) return true;
  const resolved = readDataPath(item, binding);
  switch (op) {
    case 'exists':
      return resolved !== undefined && resolved !== null && resolved !== '';
    case 'not_exists':
      return resolved === undefined || resolved === null || resolved === '';
    case '==':
      return resolved === value;
    case '!=':
      return resolved !== value;
    case 'in':
      return Array.isArray(value) && value.includes(resolved as never);
    case 'not_in':
      return !(Array.isArray(value) && value.includes(resolved as never));
    default:
      return true;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readSizePresets(prop: PropertiesSchemaEntry): number[] {
  const raw = (prop as { presets?: unknown }).presets;
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
}

function readSizeUnit(prop: PropertiesSchemaEntry): string {
  const raw = (prop as { unit?: unknown }).unit;
  return typeof raw === 'string' && raw ? raw : 'px';
}

function readHint(prop: PropertiesSchemaEntry): string | undefined {
  const raw = (prop as { hint?: unknown }).hint;
  return typeof raw === 'string' && raw ? raw : undefined;
}

function readSelectOptions(
  prop: PropertiesSchemaEntry,
): Array<{ label: string; value: string }> {
  const raw = (prop as { options?: unknown }).options;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      out.push({ label: entry, value: entry });
    } else if (entry && typeof entry === 'object') {
      const rec = entry as { label?: unknown; value?: unknown };
      if (typeof rec.value === 'string') {
        out.push({
          label: typeof rec.label === 'string' && rec.label ? rec.label : rec.value,
          value: rec.value,
        });
      }
    }
  }
  return out;
}

function normalizeHex(v: OptionValue | undefined): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/)!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return undefined;
}

function humanizeName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDefault(v: unknown): string | null {
  if (v === undefined) return null;
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (typeof v === 'string') return v === '' ? '(empty)' : v;
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v);
}

function isOptionValue(v: unknown): v is OptionValue {
  if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') return true;
  if (Array.isArray(v)) {
    return v.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row));
  }
  return false;
}

function SizeControl({
  value,
  presets,
  unit,
  onChange,
}: {
  value: string | undefined;
  presets: number[];
  unit: string;
  onChange: (v: string | undefined) => void;
}) {
  const activePreset = (() => {
    if (typeof value !== 'string' || value === '') return undefined;
    for (const p of presets) {
      if (value === `${p}${unit}` || value === `${p}`) return p;
    }
    return undefined;
  })();
  const showCustom = value !== undefined && value !== '' && activePreset === undefined;

  return (
    <div className="appza-props-panel-size">
      <div className="appza-props-panel-cells">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className="appza-props-panel-cell"
            data-active={activePreset === p}
            onClick={() =>
              onChange(activePreset === p ? undefined : `${p}${unit}`)
            }
          >
            {p === 0 ? 'Off' : p}
          </button>
        ))}
      </div>
      <input
        type="text"
        className="appza-props-panel-input appza-props-panel-size-custom"
        value={showCustom ? value : ''}
        placeholder={`Custom (e.g. 12${unit})`}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === '' ? undefined : raw);
        }}
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="appza-props-panel-row">
      <span className="appza-props-panel-row-label">{label}</span>
      <input
        type="color"
        value={value ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="appza-props-panel-color"
      />
      {value && (
        <button type="button" className="appza-btn" onClick={() => onChange(undefined)} title="Clear">
          ×
        </button>
      )}
    </div>
  );
}

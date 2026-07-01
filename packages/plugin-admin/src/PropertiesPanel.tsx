import { useEffect, useMemo, useState } from 'react';
import type { AppZet, PropertiesSchemaEntry, Superstructure } from '@appza/schemas';
import { resolveOverridableColumn, iconNames } from '@appza/renderer';

/**
 * Right-side properties editor that matches the legacy plug-in's panel.
 *
 * Opens when an AppZet placement is clicked in the preview. Edits the
 * AppZet's `default_props_override.spacing` sub-object through cell
 * selectors (0 / 4 / 8 / 16 / 24) for margin + padding, plus border
 * width / color / radius. Save writes a customization row at scope
 * `appzet` so the next bootstrap surface the edit; Remove deletes it.
 */

type Props = {
  appzet: AppZet;
  superstructure: Superstructure | null;
  customizations: unknown;
  customizationsEndpoint: string;
  restNonce: string;
  onClose: () => void;
  onChanged: () => void;
  onLivePreview: (mergedOverride: Record<string, unknown> | null) => void;
};

type OptionValue = boolean | number | string;
type OptionValues = Record<string, OptionValue>;

type TabKey = 'properties' | 'options' | 'action';

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
  customizations,
  customizationsEndpoint,
  restNonce,
  onClose,
  onChanged,
  onLivePreview,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('properties');
  const [spacing, setSpacing] = useState<Spacing>({});
  const [options, setOptions] = useState<OptionValues>({});
  const [existingRowId, setExistingRowId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [optionsFilter, setOptionsFilter] = useState('');

  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // Merged catalog + persisted customization view — the source of truth
  // for what the panel should PRE-FILL with. Matches the same resolver
  // the renderer uses so panel + preview stay in sync across refreshes.
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
    return schema.filter((p) => p.exposed_to_builder !== false);
  }, [superstructure]);

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
    // Find existing customization row id for this AppZet.
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
        // Not critical — Save will create a new row anyway.
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

  // Compose the effective override_value for both live preview + save.
  // Starts from the persisted merged view so keys the current panel
  // doesn't manage (e.g. non-exposed PropMeta from an older customization)
  // survive unchanged; then applies the session's spacing + options state.
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

  // Emit live preview whenever the panel's state changes. Passing this
  // blob up to App.tsx lets DeviceFrame render with the pending override
  // BEFORE Save, so the phone-frame preview reflects edits instantly.
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
        {(['properties', 'options', 'action'] as TabKey[]).map((tab) => {
          const tabDirty =
            (tab === 'properties' && spacingDirty) ||
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
        {activeTab === 'properties' && (
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

function groupOptions(
  props: PropertiesSchemaEntry[],
): Array<[string, PropertiesSchemaEntry[]]> {
  const visibility: PropertiesSchemaEntry[] = [];
  const icons: PropertiesSchemaEntry[] = [];
  const labels: PropertiesSchemaEntry[] = [];
  const other: PropertiesSchemaEntry[] = [];
  for (const p of props) {
    if (p.controls_visibility_of || p.controls_branch) {
      visibility.push(p);
    } else if (isIconProp(p)) {
      icons.push(p);
    } else if (isLabelProp(p)) {
      labels.push(p);
    } else {
      other.push(p);
    }
  }
  return [
    ['Visibility', visibility],
    ['Icons', icons],
    ['Labels', labels],
    ['Other', other],
  ];
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
  const datalistId = iconFlavored ? `appza-icons-${prop.name}` : undefined;
  const iconTextValue =
    iconFlavored && typeof effective === 'string' && effective.length > 0
      ? effective
      : null;
  const iconIsValid = iconTextValue ? iconNames.includes(iconTextValue) : null;

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
        ) : (
          <div className="appza-props-panel-input-wrap">
            <input
              type="text"
              className="appza-props-panel-input"
              value={effective === undefined || effective === null ? '' : String(effective)}
              placeholder={typeof prop.default === 'string' ? prop.default : ''}
              list={datalistId}
              onChange={(e) => onChange(e.target.value)}
            />
            {iconFlavored && iconTextValue && (
              <span
                className="appza-props-panel-input-status"
                data-valid={iconIsValid ? 'true' : 'false'}
                title={iconIsValid ? 'Valid icon name' : 'Not in icon registry'}
              >
                {iconIsValid ? '✓' : '!'}
              </span>
            )}
            {iconFlavored && (
              <datalist id={datalistId}>
                {iconNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
          </div>
        )}
        {isOverridden && (
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

function inferOptionType(prop: PropertiesSchemaEntry): 'boolean' | 'number' | 'string' {
  const declared = typeof prop.type === 'string' ? prop.type.toLowerCase() : '';
  if (declared === 'boolean' || declared === 'bool') return 'boolean';
  if (declared === 'number' || declared === 'int' || declared === 'integer') return 'number';
  if (declared === 'string' || declared === 'text') return 'string';
  // Fall back to inferring from the default value.
  if (typeof prop.default === 'boolean') return 'boolean';
  if (typeof prop.default === 'number') return 'number';
  return 'string';
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
  return typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string';
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

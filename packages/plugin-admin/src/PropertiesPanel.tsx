import { useEffect, useMemo, useState } from 'react';
import type { AppZet } from '@appza/schemas';

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
  customizationsEndpoint: string;
  restNonce: string;
  onClose: () => void;
  onChanged: () => void;
};

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

export function PropertiesPanel({ appzet, customizationsEndpoint, restNonce, onClose, onChanged }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('properties');
  const [spacing, setSpacing] = useState<Spacing>({});
  const [existingRowId, setExistingRowId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialSpacing = useMemo<Spacing>(() => {
    const o = appzet.default_props_override as Record<string, unknown> | null | undefined;
    if (!o || typeof o['spacing'] !== 'object') return {};
    return o['spacing'] as Spacing;
  }, [appzet]);

  useEffect(() => {
    setSpacing({ ...initialSpacing });
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
  }, [appzet.slug, initialSpacing, customizationsEndpoint, restNonce]);

  const dirty = useMemo(
    () => JSON.stringify(spacing) !== JSON.stringify(initialSpacing),
    [spacing, initialSpacing],
  );

  function setField<K extends keyof Spacing>(key: K, value: Spacing[K]) {
    setSpacing((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const baseOverrides = (appzet.default_props_override ?? {}) as Record<string, unknown>;
      const newValue: Record<string, unknown> = { ...baseOverrides, spacing };

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
      setExistingRowId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSpacing({ ...initialSpacing });
    setError(null);
  }

  return (
    <aside className="appza-props-panel">
      <header className="appza-props-panel-header">
        <span className="appza-props-panel-title">{appzet.name ?? appzet.slug}</span>
        <button className="appza-props-panel-close" onClick={onClose} aria-label="Close">×</button>
      </header>

      <div className="appza-props-panel-tabs">
        {(['properties', 'options', 'action'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            className="appza-props-panel-tab"
            data-active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="appza-props-panel-body">
        {activeTab === 'properties' && (
          <>
            <Section title="General">
              <Subsection title="Margin">
                <CellRow label="Horizontal" value={spacing.margin_h} onPick={(v) => setField('margin_h', v)} values={CELL_VALUES} />
                <CellRow label="Vertical" value={spacing.margin_v} onPick={(v) => setField('margin_v', v)} values={CELL_VALUES} />
              </Subsection>
              <Subsection title="Padding">
                <CellRow label="Horizontal" value={spacing.padding_h} onPick={(v) => setField('padding_h', v)} values={CELL_VALUES} />
                <CellRow label="Vertical" value={spacing.padding_v} onPick={(v) => setField('padding_v', v)} values={CELL_VALUES} />
              </Subsection>
            </Section>
            <Section title="Border">
              <CellRow label="Width" value={spacing.border_width} onPick={(v) => setField('border_width', v)} values={BORDER_WIDTHS} labelZero="No Border" />
              <ColorRow label="Color" value={spacing.border_color} onChange={(v) => setField('border_color', v)} />
              <CellRow label="Radius" value={spacing.border_radius} onPick={(v) => setField('border_radius', v)} values={CELL_VALUES} />
            </Section>
          </>
        )}

        {activeTab === 'options' && (
          <Section title="Options">
            <p className="appza-props-panel-empty">
              Options tab coming next — visibility toggles, alignment, etc.
            </p>
          </Section>
        )}

        {activeTab === 'action' && (
          <Section title="Action">
            {appzet.actions && typeof appzet.actions === 'object' && Object.keys(appzet.actions as object).length > 0 ? (
              <ul className="appza-props-panel-actions">
                {Object.entries(appzet.actions as Record<string, { action_slug?: string }>).map(([slot, wiring]) => (
                  <li key={slot}>
                    <span className="appza-props-panel-action-slot">{slot}</span>
                    <span className="appza-props-panel-action-slug">{wiring?.action_slug ?? '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="appza-props-panel-empty">This AppZet wires no actions.</p>
            )}
          </Section>
        )}
      </div>

      {error && <div className="appza-props-panel-error">{error}</div>}

      <footer className="appza-props-panel-footer">
        <button className="appza-btn" onClick={handleReset} disabled={!dirty || saving}>
          Reset
        </button>
        <button className="appza-btn" onClick={handleRemove} disabled={saving || existingRowId == null}>
          Remove
        </button>
        <button className="appza-btn appza-btn-primary" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="appza-props-panel-section">
      <div className="appza-props-panel-section-title">{title}</div>
      {children}
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

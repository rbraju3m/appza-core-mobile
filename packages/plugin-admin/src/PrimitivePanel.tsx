import { useEffect, useMemo, useState } from 'react';
import type { LayoutStyle } from '@appza/schemas';
import type { SelectedPrimitive } from './DeviceFrame';
import { LayoutEditor } from './LayoutEditor';

type Props = {
  selection: SelectedPrimitive;
  initialLayout: LayoutStyle;
  customizationsEndpoint: string;
  restNonce: string;
  onClose: () => void;
  onLivePreview: (layout: LayoutStyle | null) => void;
  onChanged: () => void;
};

export function PrimitivePanel({
  selection,
  initialLayout,
  customizationsEndpoint,
  restNonce,
  onClose,
  onLivePreview,
  onChanged,
}: Props) {
  const [layout, setLayout] = useState<LayoutStyle>(initialLayout);
  const [existingRowId, setExistingRowId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compositeKey = `${selection.appzetSlug}#${selection.primitivePath}`;

  // Reset on selection change, or the prior primitive's pending edit sticks to the new one.
  useEffect(() => {
    setLayout(initialLayout);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.appzetSlug, selection.primitivePath]);

  useEffect(() => {
    fetch(customizationsEndpoint, {
      headers: { Accept: 'application/json', 'X-WP-Nonce': restNonce },
      credentials: 'same-origin',
    })
      .then((r) => r.json())
      .then(
        (
          rows: Array<{
            id: number;
            scope: string;
            target_slug: string | null;
            target_slug_composite: string | null;
            target_column: string;
          }>,
        ) => {
          const match = rows.find(
            (r) =>
              r.scope === 'appzet_primitive' &&
              r.target_slug === selection.appzetSlug &&
              r.target_slug_composite === compositeKey &&
              r.target_column === 'layout',
          );
          setExistingRowId(match ? match.id : null);
        },
      )
      .catch(() => {
        // Not critical — Save creates a new row anyway.
      });
  }, [selection.appzetSlug, selection.primitivePath, compositeKey, customizationsEndpoint, restNonce]);

  const dirty = useMemo(
    () => JSON.stringify(layout) !== JSON.stringify(initialLayout),
    [layout, initialLayout],
  );

  useEffect(() => {
    onLivePreview(dirty ? layout : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, dirty]);

  useEffect(() => {
    return () => onLivePreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(customizationsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-WP-Nonce': restNonce,
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: 'appzet_primitive',
          target_slug: selection.appzetSlug,
          target_slug_composite: compositeKey,
          target_column: 'layout',
          override_value: layout,
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
      setLayout({});
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
      setLayout({});
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
    setLayout(initialLayout);
    setError(null);
  }

  return (
    <aside className="appza-props-panel">
      <header className="appza-props-panel-header">
        <div className="appza-props-panel-header-titles">
          <span className="appza-props-panel-title">{selection.primitiveSlug}</span>
          <span className="appza-props-panel-subtitle">
            {selection.appzetSlug} · {selection.primitivePath}
          </span>
        </div>
        <button className="appza-props-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <div className="appza-props-panel-tabs" role="tablist">
        <button
          role="tab"
          aria-selected="true"
          className="appza-props-panel-tab"
          data-active="true"
        >
          <span>Layout</span>
          {dirty && <span className="appza-props-panel-tab-dot" aria-label="Unsaved" />}
        </button>
      </div>

      <div className="appza-props-panel-body">
        <LayoutEditor value={layout} onChange={setLayout} />
      </div>

      {error && <div className="appza-props-panel-error">{error}</div>}

      <footer className="appza-props-panel-footer">
        <button
          className="appza-btn appza-btn-danger"
          onClick={handleRemove}
          disabled={saving || existingRowId == null}
          title="Delete the customization row for this primitive"
        >
          Remove
        </button>
        <div className="appza-props-panel-footer-primary">
          <button className="appza-btn" onClick={handleReset} disabled={!dirty || saving}>
            Reset
          </button>
          <button
            className="appza-btn appza-btn-primary"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </footer>
    </aside>
  );
}

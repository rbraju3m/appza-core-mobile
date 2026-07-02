import { useEffect, useMemo, useState } from 'react';
import type { LayoutStyle } from '@appza/schemas';
import type { SelectedPrimitive } from './DeviceFrame';
import { LayoutEditor } from './LayoutEditor';

type Props = {
  selection: SelectedPrimitive;
  initialLayout: LayoutStyle;
  onClose: () => void;
  onLivePreview: (layout: LayoutStyle | null) => void;
};

/**
 * Right-side editor shown when a single Ionic primitive inside an
 * AppZet composition is selected in the DeviceFrame (DC#20 slice 4).
 *
 * Hosts the LayoutEditor as a controlled child. Pending edits are
 * mirrored up to App.tsx via onLivePreview so the DeviceFrame preview
 * paints the pending LayoutStyle before Save. Save/Remove wiring lands
 * in slice 5 (POST /customizations with scope=appzet_primitive).
 *
 * Reuses `appza-props-panel` class so the `.appza-body:has(...)` grid
 * rule allocates the 360 px right column without touching CSS.
 */
export function PrimitivePanel({ selection, initialLayout, onClose, onLivePreview }: Props) {
  const [layout, setLayout] = useState<LayoutStyle>(initialLayout);

  // Reset local state whenever the selection changes (user clicks a
  // different primitive) — otherwise the panel would keep the prior
  // primitive's pending edit on top of the new selection.
  useEffect(() => {
    setLayout(initialLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.appzetSlug, selection.primitivePath]);

  const dirty = useMemo(
    () => JSON.stringify(layout) !== JSON.stringify(initialLayout),
    [layout, initialLayout],
  );

  // Emit the live-preview override upward on every change.
  useEffect(() => {
    onLivePreview(dirty ? layout : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, dirty]);

  // Ensure we don't leave a stale live-preview behind after unmount
  // (close, selection cleared, etc.).
  useEffect(() => {
    return () => onLivePreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleReset() {
    setLayout(initialLayout);
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

      <footer className="appza-props-panel-footer">
        <span className="appza-primitive-panel-hint">
          {dirty ? 'Preview only — Save wiring lands next.' : 'Pick a knob to override.'}
        </span>
        <div className="appza-props-panel-footer-primary">
          <button className="appza-btn" onClick={handleReset} disabled={!dirty}>
            Reset
          </button>
          <button className="appza-btn appza-btn-primary" disabled title="Save wires in slice 5">
            Save
          </button>
        </div>
      </footer>
    </aside>
  );
}

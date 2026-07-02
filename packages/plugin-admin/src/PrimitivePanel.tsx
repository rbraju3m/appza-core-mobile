import type { SelectedPrimitive } from './DeviceFrame';

type Props = {
  selection: SelectedPrimitive;
  onClose: () => void;
};

/**
 * Right-side editor shown when a single Ionic primitive inside an AppZet
 * composition is selected in the DeviceFrame (DC#20 slice 3 shell).
 *
 * The real LayoutEditor lands in slice 4 — this shell just renders the
 * header + a placeholder body so the click-capture flow is verifiable
 * end-to-end without waiting for the editor UI.
 *
 * Reuses `appza-props-panel` class so the outer `.appza-body:has(...)`
 * grid rule allocates the 360 px right column without touching CSS.
 */
export function PrimitivePanel({ selection, onClose }: Props) {
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
        </button>
      </div>

      <div className="appza-props-panel-body">
        <div className="appza-props-panel-empty-state">
          <p>Layout editor lands in the next slice.</p>
          <small>
            Selection wire is live — clicking primitives in the preview picks
            them here. The web-devtools-level controls (box model, colors,
            typography, flex) come next.
          </small>
        </div>
      </div>
    </aside>
  );
}

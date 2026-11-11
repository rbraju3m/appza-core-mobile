import type { LayoutStyle } from '@appza/schemas';
import type { SelectedPrimitive } from './DeviceFrame';
import { LayoutEditor } from './LayoutEditor';
import { stableJson, type DraftHandle } from './useCustomizationDrafts';
import { ConfirmButton, revertQuestion } from './ConfirmButton';

type Props = {
  selection: SelectedPrimitive;
  /** What the phone shows: the unsaved layout when there is one, else the saved one. */
  layout: LayoutStyle;
  savedLayout: LayoutStyle;
  /** Whether the site has a saved layout for this piece ("Back to original" deletes it on Save). */
  savedRow: boolean;
  /** This piece's unsaved change; the top bar saves it with everything else (P3). */
  draft: DraftHandle;
  onClose: () => void;
};

export function PrimitivePanel({ selection, layout, savedLayout, savedRow, draft, onClose }: Props) {
  const dirty = draft.state !== 'none';

  function setLayout(next: LayoutStyle) {
    if (stableJson(next) === stableJson(savedLayout)) draft.clear();
    else draft.set(next);
  }

  const canRevert = savedRow ? draft.state !== 'remove' : draft.state === 'value';
  const revert = () => (savedRow ? draft.remove() : draft.clear());

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
        <span className="appza-props-scope-hint">Saved from the top bar.</span>
        <ConfirmButton
          className="appza-btn appza-btn-danger"
          label="Back to original"
          question={revertQuestion(selection.primitiveSlug)}
          confirmLabel="Go back"
          onConfirm={revert}
          disabled={!canRevert}
          title="Go back to how this part was designed (saved with your other changes)"
        />
      </footer>
    </aside>
  );
}

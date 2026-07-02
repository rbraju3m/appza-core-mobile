import { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { iconNames, resolveIcon } from '@appza/renderer';

type Props = {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
};

/**
 * Icon picker for the PropertiesPanel Options tab. Replaces the plain
 * text-with-datalist input for icon-flavored PropMeta fields.
 *
 * Trigger button shows the current icon's glyph + name; opening it
 * reveals a popover with a search box + a grid of every icon in
 * ICON_REGISTRY (rendered as its actual glyph via IonIcon). Click a
 * glyph → sets the value + closes. Search filters names by substring.
 *
 * Closes on Escape or on click outside the popover.
 *
 * Popover anchors below the trigger inside the panel. When the panel
 * is scrolled, the popover follows because it's positioned relative
 * to the trigger's wrapper.
 */
export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return iconNames;
    return iconNames.filter((n) => n.toLowerCase().includes(query));
  }, [q]);

  const currentSvg = value ? resolveIcon(value) : undefined;
  const isValid = value ? currentSvg !== undefined : true;

  return (
    <div className="appza-icon-picker" ref={rootRef}>
      <button
        type="button"
        className="appza-icon-picker-trigger"
        onClick={() => setOpen((o) => !o)}
        data-empty={value ? 'false' : 'true'}
        data-invalid={isValid ? 'false' : 'true'}
      >
        <span className="appza-icon-picker-preview">
          {currentSvg ? (
            <IonIcon icon={currentSvg} />
          ) : (
            <span className="appza-icon-picker-preview-empty">?</span>
          )}
        </span>
        <span className="appza-icon-picker-name">
          {value ? value : 'Pick an icon'}
        </span>
        <span className="appza-icon-picker-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {value && (
        <button
          type="button"
          className="appza-props-panel-option-clear"
          title="Clear"
          aria-label="Clear icon"
          onClick={() => onChange(undefined)}
        >
          ×
        </button>
      )}

      {open && (
        <div className="appza-icon-picker-pop" role="dialog" aria-label="Pick an icon">
          <input
            type="search"
            className="appza-props-panel-input appza-icon-picker-search"
            placeholder={`Search ${iconNames.length} icons…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="appza-icon-picker-grid">
            {filtered.length === 0 ? (
              <div className="appza-icon-picker-empty">No icons match.</div>
            ) : (
              filtered.map((name) => {
                const svg = resolveIcon(name);
                const selected = name === value;
                return (
                  <button
                    key={name}
                    type="button"
                    className="appza-icon-picker-cell"
                    data-selected={selected ? 'true' : 'false'}
                    title={name}
                    onClick={() => {
                      onChange(name);
                      setOpen(false);
                    }}
                  >
                    {svg ? <IonIcon icon={svg} /> : <span>?</span>}
                    <span className="appza-icon-picker-cell-label">{name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IonIcon } from '@ionic/react';
import { iconNames, resolveIcon } from '@appza/renderer';

type Props = {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
};

export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Portal to <body> with position: fixed to escape the panel section's overflow:hidden.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) {
        setAnchorRect(triggerRef.current.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
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
        ref={triggerRef}
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

      {open && anchorRect && createPortal(
        <div
          ref={popRef}
          className="appza-icon-picker-pop"
          role="dialog"
          aria-label="Pick an icon"
          style={{
            position: 'fixed',
            top: anchorRect.bottom + 4,
            left: anchorRect.left,
            width: anchorRect.width,
            zIndex: 10000,
          }}
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}
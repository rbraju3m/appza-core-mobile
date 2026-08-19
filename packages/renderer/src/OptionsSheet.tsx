import { useEffect, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { applyControlPick, type PopoverStateKey, type ViewModeOption } from './ViewModePopover';

/**
 * A bottom sheet of pickable options with the current one marked —
 * Noor's design 5 ("Sort saved posts") and design 3 ("Layout").
 *
 * The same choice the feed draws as an anchored popover, in the frame
 * the Saved Posts designs ask for. Which frame opens is a catalog value
 * (`presentation` on the action), not a fork in this file or in the
 * dispatcher, and the PICK ITSELF is shared: both call
 * applyControlPick, so the two frames can never disagree about what
 * choosing "Latest" means.
 *
 * One component for both sheets. They differ in a title and a row list,
 * and the row list already travels on the action that opens them — so
 * the catalog carries two AppZets on one Superstructure and this file
 * does not know which of them it is drawing.
 *
 * Bespoke React opened by event, like the chat and points sheets: there
 * is no placement to mount it from, so it opts back into the builder by
 * hand via childAttrs/appzetAttrs. The indices below MUST match the
 * `children` array of the fc-options-sheet superstructure.
 */

export const OPTIONS_SHEET_APPZET_SLUG = 'fc-options-sheet';
export const OPTIONS_SHEET_CHILD_COUNT = 4;

export type OptionsSheetPresentation = {
  title: string;
  checkIcon: string;
  emptyLabel: string;
  hidden: boolean;
  showHandle: boolean;
  showTitle: boolean;
  showRowIcons: boolean;
  showCheck: boolean;
  sheetBgColor?: string;
  sheetRadius?: string;
  sheetMaxHeight?: string;
  backdropColor?: string;
  handleColor?: string;
  titleColor?: string;
  titleSize?: string;
  titleWeight?: string;
  rowPadding?: string;
  rowGap?: string;
  rowRadius?: string;
  labelColor?: string;
  labelSize?: string;
  iconColor?: string;
  iconSize?: string;
  selectedBgColor?: string;
  selectedLabelColor?: string;
  selectedIconColor?: string;
  checkColor?: string;
  checkSize?: string;
  dividerColor?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: OptionsSheetPresentation;
  options: ViewModeOption[];
  /** Which control slice the pick is written into. */
  stateKey: PopoverStateKey;
  /** The value currently in that slice — the row that wears the check. */
  currentValue: string;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-options-sheet';
const CLOSE_EVENT = 'appza:close-options-sheet';

export function openOptionsSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeOptionsSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function OptionsSheet() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
    };
    const onClose = () => setDetail(null);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setDetail(null);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!detail || detail.presentation.hidden) return null;

  const p = detail.presentation;
  const slug = detail.appzetSlug ?? OPTIONS_SHEET_APPZET_SLUG;
  const cs = detail.childStyles ?? {};

  const vars: CSSProperties = {
    ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
    ['--appza-sheet-radius' as string]: p.sheetRadius,
    ['--appza-sheet-max-height' as string]: p.sheetMaxHeight,
    ['--appza-backdrop-color' as string]: p.backdropColor,
    ['--appza-handle-color' as string]: p.handleColor,
    ['--appza-title-color' as string]: p.titleColor,
    ['--appza-title-size' as string]: p.titleSize,
    ['--appza-title-weight' as string]: p.titleWeight,
    ['--appza-row-padding' as string]: p.rowPadding,
    ['--appza-row-gap' as string]: p.rowGap,
    ['--appza-row-radius' as string]: p.rowRadius,
    ['--appza-label-color' as string]: p.labelColor,
    ['--appza-label-size' as string]: p.labelSize,
    ['--appza-icon-color' as string]: p.iconColor,
    ['--appza-icon-size' as string]: p.iconSize,
    ['--appza-selected-bg-color' as string]: p.selectedBgColor,
    ['--appza-selected-label-color' as string]: p.selectedLabelColor,
    ['--appza-selected-icon-color' as string]: p.selectedIconColor,
    ['--appza-check-color' as string]: p.checkColor,
    ['--appza-check-size' as string]: p.checkSize,
    ['--appza-divider-color' as string]: p.dividerColor,
  };

  const handlePick = (value: string) => {
    applyControlPick(detail.stateKey, value);
    closeOptionsSheet();
  };

  const check = resolveIcon(p.checkIcon);
  // The FIRST selected row carries the design-time attrs for the check
  // and the row template. Stamping every row would give the right panel
  // several elements claiming to be children[2] (P73 / P90) — and the
  // check exists on at most one row anyway.
  const selectedIndex = detail.options.findIndex((o) => o.value === detail.currentValue);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      className="appza-options-sheet-backdrop"
      style={vars}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeOptionsSheet();
      }}
    >
      <div className="appza-options-sheet" {...appzetAttrs(slug)}>
        {p.showHandle && <div className="appza-options-sheet-grabber" />}

        <div className="appza-options-sheet-scroll">
          {p.showTitle && (
            <div
              className="appza-options-sheet-title"
              style={cs[0]}
              {...childAttrs(slug, 0, 'ion-text')}
            >
              {p.title}
            </div>
          )}

          {detail.options.map((opt, i) => {
            const selected = opt.value === detail.currentValue;
            const glyph = opt.icon ? resolveIcon(opt.icon) : undefined;
            // Row zero owns the glyph + label template attrs; the
            // selected row owns the check's. When nothing is selected the
            // check is simply not on screen to address, which is correct.
            const isTemplateRow = i === 0;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={
                  selected ? 'appza-options-sheet-row is-selected' : 'appza-options-sheet-row'
                }
                onClick={() => handlePick(opt.value)}
              >
                {p.showRowIcons && (
                  <span
                    className="appza-options-sheet-row-icon"
                    style={cs[1]}
                    {...(isTemplateRow ? childAttrs(slug, 1, 'ion-icon') : {})}
                  >
                    {glyph ? <IonIcon icon={glyph} /> : null}
                  </span>
                )}
                <span
                  className="appza-options-sheet-row-label"
                  style={cs[2]}
                  {...(isTemplateRow ? childAttrs(slug, 2, 'ion-text') : {})}
                >
                  {opt.label}
                </span>
                {p.showCheck && selected && (
                  <span
                    className="appza-options-sheet-row-check"
                    style={cs[3]}
                    {...(i === selectedIndex ? childAttrs(slug, 3, 'ion-icon') : {})}
                  >
                    {check ? <IonIcon icon={check} /> : null}
                  </span>
                )}
              </button>
            );
          })}

          {detail.options.length === 0 && (
            <div className="appza-options-sheet-empty">{p.emptyLabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}

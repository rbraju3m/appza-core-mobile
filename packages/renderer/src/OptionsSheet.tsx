import { useEffect, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { applyControlPick, type PopoverStateKey, type ViewModeOption } from './ViewModePopover';
import { useBackDismiss } from './backStack';

// Child indices below must match the fc-options-sheet superstructure's `children`.

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
  sectionTitleColor?: string;
  sectionTitleSize?: string;
  eyebrowColor?: string;
  eyebrowSize?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: OptionsSheetPresentation;
  options: ViewModeOption[];
  stateKey: PopoverStateKey;
  currentValue: string;
  // Handed the pick instead of writing a slice: applyControlPick is state-only by design.
  onPick?: (value: string, label: string) => void;
  // When present, options/stateKey/currentValue are ignored and a pick does not close the sheet.
  sections?: OptionsSheetSection[];
  childStyles?: Record<number, CSSProperties>;
  eyebrow?: string;
};

export type OptionsSheetSection = {
  title?: string;
  options: ViewModeOption[];
  stateKey?: PopoverStateKey;
  currentValue: string;
  onPick?: (value: string, label: string) => void;
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
  // A sectioned sheet stays open across picks, so the check moves locally.
  const [sectionPicks, setSectionPicks] = useState<Record<number, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setSectionPicks({});
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

  useBackDismiss(!(!detail || detail.presentation.hidden), () => setDetail(null));

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
    ['--appza-section-title-color' as string]: p.sectionTitleColor,
    ['--appza-section-title-size' as string]: p.sectionTitleSize,
    ['--appza-eyebrow-color' as string]: p.eyebrowColor,
    ['--appza-eyebrow-size' as string]: p.eyebrowSize,
  };

  const handleSectionPick = (sectionIndex: number, section: OptionsSheetSection, value: string) => {
    if (section.onPick) {
      const picked = section.options.find((o) => o.value === value);
      // Close first: the pick may open the next sheet, which a later close would shut.
      closeOptionsSheet();
      section.onPick(value, picked?.label ?? value);
      return;
    }
    if (!section.stateKey) return;
    applyControlPick(section.stateKey, value);
    setSectionPicks((prev) => ({ ...prev, [sectionIndex]: value }));
  };

  const handlePick = (value: string) => {
    closeOptionsSheet();
    if (detail.onPick) {
      const picked = detail.options.find((o) => o.value === value);
      detail.onPick(value, picked?.label ?? value);
    } else {
      applyControlPick(detail.stateKey, value);
    }
  };

  const check = resolveIcon(p.checkIcon);
  // Design-time attrs on one row only: the builder panel needs one element per child index.
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
          {detail.eyebrow && <div className="appza-options-sheet-eyebrow">{detail.eyebrow}</div>}
          {p.showTitle && (
            <div
              className="appza-options-sheet-title"
              style={cs[0]}
              {...childAttrs(slug, 0, 'ion-text')}
            >
              {p.title}
            </div>
          )}

          {detail.sections &&
            detail.sections.map((section, si) => {
              const current = sectionPicks[si] ?? section.currentValue;
              const hasGlyphs = p.showRowIcons && section.options.some((o) => !!o.icon);
              return (
                <div className="appza-options-sheet-section" key={`section-${si}`}>
                  {section.title && (
                    <div className="appza-options-sheet-section-title">{section.title}</div>
                  )}
                  {section.options.map((opt, i) => {
                    const selected = !section.onPick && opt.value === current;
                    const glyph = opt.icon ? resolveIcon(opt.icon) : undefined;
                    const isTemplateRow = si === 0 && i === 0;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className={
                          selected
                            ? 'appza-options-sheet-row is-selected'
                            : 'appza-options-sheet-row'
                        }
                        onClick={() => handleSectionPick(si, section, opt.value)}
                      >
                        {hasGlyphs && (
                          <span className="appza-options-sheet-row-icon" style={cs[1]}>
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
                            {...(si === 0 ? childAttrs(slug, 3, 'ion-icon') : {})}
                          >
                            {check ? <IonIcon icon={check} /> : null}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {!detail.sections && detail.options.map((opt, i) => {
            const selected = opt.value === detail.currentValue;
            const glyph = opt.icon ? resolveIcon(opt.icon) : undefined;
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

          {!detail.sections && detail.options.length === 0 && (
            <div className="appza-options-sheet-empty">{p.emptyLabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}

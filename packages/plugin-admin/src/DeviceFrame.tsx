import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { setLabeler, startPointer, stylingOf } from './preview/pointer';
import { ScreenRenderer } from '@appza/renderer';
import type { Catalog, TemplateScreen } from '@appza/schemas';

export type SelectedPrimitive = {
  appzetSlug: string;
  primitivePath: string;
  primitiveSlug: string;
  /** The top-level piece and what the click landed on inside it: the Design tab opens the parts that style it. */
  child?: number;
  tags?: string[];
  classes?: string[];
};

type DeviceFrameProps = {
  screen: TemplateScreen | null;
  catalog: Catalog | null;
  customizations?: unknown;
  templateName?: string;
  selectedAppzetSlug?: string | null;
  onSelectAppzet?: (slug: string | null) => void;
  navDepth?: number;
  selectedPrimitive?: SelectedPrimitive | null;
  onSelectPrimitive?: (sel: SelectedPrimitive | null) => void;
  /** Positioned inside the device viewport so modals align with the simulated screen, not the browser. */
  overlaySlot?: ReactNode;
  /** Drag mode (D110): nothing on the screen fires; a click selects a placement. */
  onSelectPlacement?: (key: string | null) => void;
  /** Edit mode: outline the piece under the pointer with this label ("#10 Button · Like"). */
  hoverLabel?: (appzet: string | null, child: number) => string | undefined;
};

// Selection outline is toggled here, not in the renderer, so the shared renderer stays unaware of designer state.
export function DeviceFrame({
  screen,
  catalog,
  customizations,
  templateName,
  selectedAppzetSlug,
  onSelectAppzet,
  navDepth,
  selectedPrimitive,
  onSelectPrimitive,
  overlaySlot,
  onSelectPlacement,
  hoverLabel,
}: DeviceFrameProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef(hoverLabel);
  labelRef.current = hoverLabel;
  const hovering = !!hoverLabel;
  useEffect(() => {
    if (!hovering || !viewportRef.current) return;
    setLabeler((_block, appzet, child) => labelRef.current?.(appzet, child));
    const stop = startPointer(viewportRef.current);
    return () => {
      setLabeler(null);
      stop();
    };
  }, [hovering]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.querySelectorAll('.is-selected-primitive').forEach((n) =>
      n.classList.remove('is-selected-primitive'),
    );
    if (!selectedPrimitive) return;
    const selector = `[data-appza-appzet-slug="${CSS.escape(
      selectedPrimitive.appzetSlug,
    )}"][data-appza-primitive-path="${CSS.escape(selectedPrimitive.primitivePath)}"]`;
    el.querySelector(selector)?.classList.add('is-selected-primitive');
  });

  function handleClickCapture(e: React.MouseEvent) {
    if (onSelectPlacement) {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.appza-drag-toolbar')) return;
      e.stopPropagation();
      e.preventDefault();
      const el = target?.closest('.appza-renderer-content [data-appza-placement-key]');
      onSelectPlacement(el?.getAttribute('data-appza-placement-key') ?? null);
      return;
    }
    if (!onSelectPrimitive && !onSelectAppzet) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // Inline controls (e.g. video play badge) opt out of primitive-select via this attr.
    if (target.closest('[data-appza-inline-click]')) return;
    // Inside a live overlay the click must reach its control as well as select it; elsewhere selecting consumes it so no real action fires.
    const inOverlay = Boolean(target.closest('[data-appza-overlay]'));
    const primitiveEl = target.closest('[data-appza-primitive-path]') as HTMLElement | null;
    if (primitiveEl && onSelectPrimitive) {
      const primitivePath = primitiveEl.getAttribute('data-appza-primitive-path');
      const appzetSlug = primitiveEl.getAttribute('data-appza-appzet-slug');
      const primitiveSlug = primitiveEl.getAttribute('data-child-slug');
      if (primitivePath && appzetSlug && primitiveSlug) {
        if (!inOverlay) e.stopPropagation();
        onSelectPrimitive({
          appzetSlug,
          primitivePath,
          primitiveSlug,
          child: Number(primitiveEl.getAttribute('data-child-index') ?? 0),
          ...stylingOf(target, primitiveEl),
        });
        return;
      }
    }
    if (!onSelectAppzet) return;
    // Hand-written overlays aren't composed by PlacementRenderer, so without this a click on their padding clears the selection.
    const appzetEl = target.closest('[data-appza-appzet-slug]') as HTMLElement | null;
    const slug = appzetEl?.getAttribute('data-appza-appzet-slug');
    if (!slug) return;
    if (!inOverlay) e.stopPropagation();
    onSelectAppzet(slug);
  }

  return (
    <div className="appza-device-frame">
      <div className="appza-device-notch" aria-hidden="true" />
      <div
        className="appza-device-viewport"
        ref={viewportRef}
        onClickCapture={handleClickCapture}
        onPointerDownCapture={
          onSelectPlacement
            ? (e) => {
                if (!(e.target as HTMLElement | null)?.closest('.appza-drag-toolbar')) e.stopPropagation();
              }
            : undefined
        }
        style={{ position: 'relative' }}
      >
        {!screen || !catalog ? (
          <div className="appza-renderer-empty">
            <p>Pick a screen.</p>
            {templateName && <small>Template: {templateName}</small>}
          </div>
        ) : (
          <ScreenRenderer
            screen={screen}
            catalog={catalog}
            customizations={customizations}
            selectedAppzetSlug={selectedAppzetSlug}
            onSelectAppzet={onSelectAppzet}
            navDepth={navDepth}
          />
        )}
        {overlaySlot}
      </div>
      <div className="appza-device-homebar" aria-hidden="true" />
    </div>
  );
}

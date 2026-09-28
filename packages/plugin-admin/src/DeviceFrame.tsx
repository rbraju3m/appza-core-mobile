import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ScreenRenderer } from '@appza/renderer';
import type { Catalog, TemplateScreen } from '@appza/schemas';

export type SelectedPrimitive = {
  appzetSlug: string;
  primitivePath: string;
  primitiveSlug: string;
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
}: DeviceFrameProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

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
        onSelectPrimitive({ appzetSlug, primitivePath, primitiveSlug });
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

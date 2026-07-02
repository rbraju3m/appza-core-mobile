import { useLayoutEffect, useRef } from 'react';
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
  selectedPrimitive?: SelectedPrimitive | null;
  onSelectPrimitive?: (sel: SelectedPrimitive | null) => void;
};

/**
 * Outer phone bezel for the WP-admin preview. The Ionic app shell
 * (IonApp > IonPage > IonHeader/IonContent/IonFooter) lives inside
 * the renderer itself, so this component renders only the bezel +
 * a viewport. Capacitor uses the renderer without any bezel.
 *
 * Design-time primitive selection (DC#20): captures clicks on any
 * DOM element carrying `data-appza-primitive-path` (emitted by the
 * renderer at depth 0 SS-child level), walks up for the AppZet slug,
 * and fires onSelectPrimitive with the composed key. Runs at capture
 * phase + stops propagation so the AppZet-level onClick doesn't also
 * grab focus.
 *
 * Selection outline is painted via a useLayoutEffect that toggles the
 * `.is-selected-primitive` class on the matching ss-child DOM node.
 * Kept out of the renderer to avoid teaching the shared renderer about
 * designer state.
 */
export function DeviceFrame({
  screen,
  catalog,
  customizations,
  templateName,
  selectedAppzetSlug,
  onSelectAppzet,
  selectedPrimitive,
  onSelectPrimitive,
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
    if (!onSelectPrimitive) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const primitiveEl = target.closest('[data-appza-primitive-path]') as HTMLElement | null;
    if (!primitiveEl) return;
    const primitivePath = primitiveEl.getAttribute('data-appza-primitive-path');
    const appzetSlug = primitiveEl.getAttribute('data-appza-appzet-slug');
    const primitiveSlug = primitiveEl.getAttribute('data-child-slug');
    if (!primitivePath || !appzetSlug || !primitiveSlug) return;
    e.stopPropagation();
    onSelectPrimitive({ appzetSlug, primitivePath, primitiveSlug });
  }

  return (
    <div className="appza-device-frame">
      <div className="appza-device-notch" aria-hidden="true" />
      <div
        className="appza-device-viewport"
        ref={viewportRef}
        onClickCapture={handleClickCapture}
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
          />
        )}
      </div>
      <div className="appza-device-homebar" aria-hidden="true" />
    </div>
  );
}

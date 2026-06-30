import { ScreenRenderer } from '@appza/renderer';
import type { Catalog, TemplateScreen } from '@appza/schemas';

type DeviceFrameProps = {
  screen: TemplateScreen | null;
  catalog: Catalog | null;
  customizations?: unknown;
  templateName?: string;
  selectedAppzetSlug?: string | null;
  onSelectAppzet?: (slug: string | null) => void;
};

/**
 * Outer phone bezel for the WP-admin preview. The Ionic app shell
 * (IonApp > IonPage > IonHeader/IonContent/IonFooter) lives inside
 * the renderer itself, so this component renders only the bezel +
 * a viewport. Capacitor uses the renderer without any bezel.
 */
export function DeviceFrame({
  screen,
  catalog,
  customizations,
  templateName,
  selectedAppzetSlug,
  onSelectAppzet,
}: DeviceFrameProps) {
  return (
    <div className="appza-device-frame">
      <div className="appza-device-notch" aria-hidden="true" />
      <div className="appza-device-viewport">
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

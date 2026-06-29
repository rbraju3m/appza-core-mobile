import { ScreenRenderer } from '@appza/renderer';
import type { Catalog, TemplateScreen } from '@appza/schemas';

type DeviceFrameProps = {
  screen: TemplateScreen | null;
  catalog: Catalog | null;
  templateName?: string;
};

export function DeviceFrame({ screen, catalog, templateName }: DeviceFrameProps) {
  return (
    <div className="appza-device-frame">
      <div className="appza-device-statusbar">
        <span>{templateName ?? '—'}</span>
        <span className="appza-device-statusbar-screen">
          {screen ? screen.app_map_screen_slug : 'no screen'}
        </span>
      </div>

      <div className="appza-device-render-area">
        {!screen || !catalog ? (
          <div className="appza-renderer-empty">
            <p>Pick a screen.</p>
          </div>
        ) : (
          <ScreenRenderer screen={screen} catalog={catalog} />
        )}
      </div>

      <div className="appza-device-footer">
        {screen ? `${screen.placements?.length ?? 0} placements` : ''}
      </div>
    </div>
  );
}

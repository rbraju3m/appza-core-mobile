import type { TemplateScreen } from '@appza/schemas';

type DeviceFrameProps = {
  screen: TemplateScreen | null;
  templateName?: string;
};

export function DeviceFrame({ screen, templateName }: DeviceFrameProps) {
  return (
    <div className="appza-device-frame">
      <div className="appza-device-content">
        <p className="appza-device-heading">Selected screen</p>
        <h2 className="appza-device-screen-title">
          {screen ? screen.app_map_screen_slug : '—'}
        </h2>

        <div className="appza-device-meta">
          <span className="appza-device-meta-key">Template</span>
          <span className="appza-device-meta-value">{templateName ?? '—'}</span>
          <span className="appza-device-meta-key">Screen ID</span>
          <span className="appza-device-meta-value">{screen?.id ?? '—'}</span>
          <span className="appza-device-meta-key">Placements</span>
          <span className="appza-device-meta-value">{screen?.placements?.length ?? 0}</span>
        </div>

        <p className="appza-device-heading">Placements</p>
        <div className="appza-device-placements">
          {!screen || (screen.placements?.length ?? 0) === 0 ? (
            <p className="appza-device-empty">No placements wired on this screen.</p>
          ) : (
            (screen.placements ?? []).map((placement, idx) => (
              <div key={idx} className="appza-device-placement">
                <div className="appza-device-placement-slot">
                  {typeof placement['slot'] === 'string'
                    ? placement['slot']
                    : `Slot ${idx + 1}`}
                </div>
                <div className="appza-device-placement-slug">
                  {typeof placement['appzet_slug'] === 'string'
                    ? placement['appzet_slug']
                    : '(no appzet_slug)'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="appza-device-footer">
        Live preview ships in Phase 1C.3 (@appza/renderer)
      </div>
    </div>
  );
}

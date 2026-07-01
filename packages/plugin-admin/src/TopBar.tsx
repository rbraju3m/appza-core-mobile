import type { AppMap, TemplateScreen } from '@appza/schemas';

type TopBarProps = {
  screens: TemplateScreen[];
  appMap?: AppMap | null;
  selectedScreenId: number | null;
  onSelectScreen: (id: number) => void;
  templateSlug: string;
  onTemplateSlugChange: (slug: string) => void;
  onReload: () => void;
  onSync: () => void;
  loading: boolean;
  syncing: boolean;
  syncMessage: string | null;
};

export function TopBar({
  screens,
  appMap,
  selectedScreenId,
  onSelectScreen,
  templateSlug,
  onTemplateSlugChange,
  onReload,
  onSync,
  loading,
  syncing,
  syncMessage,
}: TopBarProps) {
  const nameBySlug = new Map<string, string>();
  if (appMap && Array.isArray(appMap.screens)) {
    for (const s of appMap.screens) {
      if (s && typeof s === 'object') {
        const slug = (s as Record<string, unknown>)['slug'];
        const name = (s as Record<string, unknown>)['name'];
        if (typeof slug === 'string' && typeof name === 'string') {
          nameBySlug.set(slug, name);
        }
      }
    }
  }

  const assetsBase = window.appzaCoreConfig?.assetsBase ?? '';
  const logoUrl = assetsBase ? `${assetsBase.replace(/\/$/, '')}/images/appza-logo.png` : '';

  return (
    <header className="appza-topbar">
      <div className="appza-topbar-logo">
        {logoUrl ? (
          <img src={logoUrl} alt="APPZA" className="appza-topbar-logo-img" />
        ) : (
          <span className="appza-topbar-logo-fallback">appza</span>
        )}
      </div>

      <div className="appza-topbar-screen">
        <span className="appza-topbar-screen-label">Screen</span>
        <select
          className="appza-select"
          value={selectedScreenId ?? ''}
          onChange={(e) => onSelectScreen(Number(e.target.value))}
          disabled={screens.length === 0}
        >
          {screens.length === 0 && <option value="">— no screens —</option>}
          {screens.map((screen) => {
            const friendly = nameBySlug.get(screen.app_map_screen_slug);
            return (
              <option key={screen.id} value={screen.id}>
                {friendly ? `${friendly} — ${screen.app_map_screen_slug}` : screen.app_map_screen_slug}
              </option>
            );
          })}
        </select>
      </div>

      <div className="appza-topbar-actions">
        <div className="appza-topbar-template">
          <span>Template</span>
          <input
            value={templateSlug}
            onChange={(e) => onTemplateSlugChange(e.target.value)}
            spellCheck={false}
          />
          <button
            className="appza-btn"
            onClick={onSync}
            disabled={syncing || loading}
            title="Fetch the latest catalog from Core and rebuild the plug-in snapshot"
          >
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button
            className="appza-btn"
            onClick={onReload}
            disabled={loading || syncing}
            title="Re-fetch the plug-in bootstrap (does not pull from Core)"
          >
            {loading ? '…' : 'Reload'}
          </button>
        </div>
        {syncMessage && (
          <div
            className="appza-topbar-sync-message"
            data-error={syncMessage.startsWith('HTTP') || syncMessage.startsWith('Sync unavailable') ? 'true' : 'false'}
          >
            {syncMessage}
          </div>
        )}

        <button className="appza-btn">Preview</button>
        <button className="appza-btn appza-btn-primary" disabled>
          Build App
        </button>
      </div>
    </header>
  );
}

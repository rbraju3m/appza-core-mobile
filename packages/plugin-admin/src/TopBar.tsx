import type { AppMap, TemplateScreen } from '@appza/schemas';
import type { PreviewMode } from './App';

type TemplateOption = {
  slug: string;
  name: string;
  source_integration_slug: string;
  source_integration_name: string;
};

type TopBarProps = {
  screens: TemplateScreen[];
  appMap?: AppMap | null;
  selectedScreenId: number | null;
  onSelectScreen: (id: number) => void;
  templateSlug: string;
  onTemplateSlugChange: (slug: string) => void;
  templateOptions: TemplateOption[];
  templatesLoading: boolean;
  onReload: () => void;
  onSync: () => void;
  onRefreshData: () => void;
  loading: boolean;
  syncing: boolean;
  syncMessage: string | null;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
};

const PREVIEW_MODES: Array<{ value: PreviewMode; label: string; title: string }> = [
  { value: 'auto', label: 'Auto', title: 'Real data if the upstream responds, demo fixture otherwise.' },
  { value: 'demo', label: 'Demo', title: 'Always render with the bundled fixture data — skip the upstream call.' },
  { value: 'real', label: 'Real', title: 'Always call the upstream — no fixture fallback (empty list if it fails).' },
];

export function TopBar({
  screens,
  appMap,
  selectedScreenId,
  onSelectScreen,
  templateSlug,
  onTemplateSlugChange,
  templateOptions,
  templatesLoading,
  onReload,
  onSync,
  onRefreshData,
  loading,
  syncing,
  syncMessage,
  previewMode,
  onPreviewModeChange,
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
        <div className="appza-topbar-mode" role="group" aria-label="Preview data mode">
          <span className="appza-topbar-mode-label">Data</span>
          <div className="appza-segmented">
            {PREVIEW_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                className="appza-segmented-btn"
                data-active={previewMode === m.value ? 'true' : 'false'}
                title={m.title}
                onClick={() => onPreviewModeChange(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="appza-btn appza-topbar-refresh-btn"
            onClick={onRefreshData}
            title="Refresh the data feed — bypasses the 5-min proxy cache and pulls fresh upstream data (new fcom posts appear immediately)."
            aria-label="Refresh data"
          >
            ↻
          </button>
        </div>

        <div className="appza-topbar-template">
          <span>Template</span>
          {(() => {
            // Group Templates by their Source Integration for nicer <optgroup>
            // display. Preserves Core-side ordering (source slug, then template slug).
            const groups: Array<{ label: string; opts: TemplateOption[] }> = [];
            const idx = new Map<string, number>();
            for (const t of templateOptions) {
              const key = t.source_integration_slug;
              if (!idx.has(key)) {
                idx.set(key, groups.length);
                groups.push({ label: t.source_integration_name, opts: [] });
              }
              const gi = idx.get(key)!;
              (groups[gi] as { opts: TemplateOption[] }).opts.push(t);
            }
            const known = templateOptions.some((t) => t.slug === templateSlug);
            const placeholder = templatesLoading
              ? 'Loading templates…'
              : templateOptions.length === 0
              ? 'Activate an app to see templates'
              : 'Select a template…';
            return (
              <select
                value={known ? templateSlug : ''}
                onChange={(e) => onTemplateSlugChange(e.target.value)}
                disabled={templatesLoading || templateOptions.length === 0}
              >
                <option value="" disabled>
                  {placeholder}
                </option>
                {!known && templateSlug && (
                  <option value={templateSlug}>{templateSlug} (unknown)</option>
                )}
                {groups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.opts.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            );
          })()}
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

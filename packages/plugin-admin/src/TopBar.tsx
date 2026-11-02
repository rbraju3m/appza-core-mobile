import type { AppMap, TemplateScreen } from '@appza/schemas';
import type { PreviewMode, UiMode } from './App';
import { useAdvanced } from './advanced';

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
  uiMode: UiMode;
  onUiModeChange: (mode: UiMode) => void;
  onBuildApp: () => void;
  dirtyCount: number;
  saving: boolean;
  onSaveLayout: () => void;
  onDiscardLayout: () => void;
};

const UI_MODES: Array<{ value: UiMode; label: string; title: string }> = [
  { value: 'edit', label: 'Edit', title: 'Design mode — click any element to select it and edit its properties on the right.' },
  { value: 'drag', label: 'Drag', title: 'Layout mode — add, remove and reorder components on this screen. Nothing on the screen fires.' },
  { value: 'app', label: 'App', title: 'Runtime mode — clicks fire real actions (navigate, open links). Same behavior as the mobile app.' },
];

const PREVIEW_MODES: Array<{ value: PreviewMode; label: string; title: string }> = [
  { value: 'auto', label: 'Auto', title: 'Your site\'s real content, or sample content where your site has none yet.' },
  { value: 'demo', label: 'Sample', title: 'Always show sample content, never your site\'s.' },
  { value: 'real', label: 'Real', title: 'Only your site\'s real content; empty where there is none.' },
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
  uiMode,
  onUiModeChange,
  onBuildApp,
  dirtyCount,
  saving,
  onSaveLayout,
  onDiscardLayout,
}: TopBarProps) {
  const [advanced, setAdvanced] = useAdvanced();
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
    <header className="appza-topbar" data-dirty={dirtyCount > 0 || saving ? 'true' : undefined}>
      <div className="appza-topbar-logo">
        {logoUrl ? (
          <img src={logoUrl} alt="APPZA" className="appza-topbar-logo-img" />
        ) : (
          <span className="appza-topbar-logo-fallback">appza</span>
        )}
      </div>

      <div className="appza-topbar-screen">
        <span className="appza-topbar-screen-label">Page</span>
        <select
          className="appza-select"
          value={selectedScreenId ?? ''}
          onChange={(e) => onSelectScreen(Number(e.target.value))}
          disabled={screens.length === 0}
        >
          {screens.length === 0 && <option value="">No pages yet</option>}
          {screens.map((screen) => {
            const friendly = nameBySlug.get(screen.app_map_screen_slug);
            return (
              <option key={screen.id} value={screen.id}>
                {friendly ?? screen.app_map_screen_slug}
              </option>
            );
          })}
        </select>
      </div>

      <div className="appza-topbar-actions">
        <div className="appza-topbar-mode" role="group" aria-label="UI mode">
          <span className="appza-topbar-mode-label">Mode</span>
          <div className="appza-segmented">
            {UI_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                className="appza-segmented-btn"
                data-active={uiMode === m.value ? 'true' : 'false'}
                title={m.title}
                onClick={() => onUiModeChange(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="appza-topbar-mode" role="group" aria-label="Controls">
          <div className="appza-segmented">
            {[false, true].map((on) => (
              <button
                key={String(on)}
                type="button"
                className="appza-segmented-btn"
                data-active={advanced === on ? 'true' : 'false'}
                title={on
                  ? 'Exact values, variable names, Wrapper, the piece Layout editor and Overrides.'
                  : 'Design, Options and Action — the controls a site needs.'}
                onClick={() => setAdvanced(on)}
              >
                {on ? 'Advanced' : 'Simple'}
              </button>
            ))}
          </div>
        </div>

        {(dirtyCount > 0 || saving) && (
          <div className="appza-topbar-layout" role="group" aria-label="Unsaved layout">
            <span className="appza-topbar-unsaved" title="Layout changes not saved yet">
              ● {dirtyCount} unsaved
            </span>
            <button type="button" className="appza-btn" onClick={onDiscardLayout} disabled={saving}>
              Discard
            </button>
            <button type="button" className="appza-btn appza-btn-primary" onClick={onSaveLayout} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        <div className="appza-topbar-mode" role="group" aria-label="Preview data mode">
          <span className="appza-topbar-mode-label">Content</span>
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
            title="Show the newest content from your site"
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
            title="Get the newest designs and blocks from APPZA"
          >
            {syncing ? 'Updating…' : 'Get latest designs'}
          </button>
          {advanced && <button
            className="appza-btn"
            onClick={onReload}
            disabled={loading || syncing}
            title="Reload what this site already has (does not get new designs)"
          >
            {loading ? '…' : 'Reload'}
          </button>}
        </div>
        {syncMessage && (
          <div
            className="appza-topbar-sync-message"
            data-error={syncMessage.startsWith('! ') ? 'true' : 'false'}
          >
            {syncMessage.replace(/^! /, '')}
          </div>
        )}

        <button
          className="appza-btn appza-btn-primary"
          onClick={onBuildApp}
          title="Pick an activated app + base URL, then kick off a build"
        >
          Build App
        </button>
      </div>
    </header>
  );
}

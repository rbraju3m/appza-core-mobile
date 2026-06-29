import type { TemplateScreen } from '@appza/schemas';

type TopBarProps = {
  screens: TemplateScreen[];
  selectedScreenId: number | null;
  onSelectScreen: (id: number) => void;
  templateSlug: string;
  onTemplateSlugChange: (slug: string) => void;
  onReload: () => void;
  loading: boolean;
};

export function TopBar({
  screens,
  selectedScreenId,
  onSelectScreen,
  templateSlug,
  onTemplateSlugChange,
  onReload,
  loading,
}: TopBarProps) {
  return (
    <header className="appza-topbar">
      <div className="appza-topbar-logo">appza</div>

      <div className="appza-topbar-screen">
        <span className="appza-topbar-screen-label">Screen</span>
        <select
          className="appza-select"
          value={selectedScreenId ?? ''}
          onChange={(e) => onSelectScreen(Number(e.target.value))}
          disabled={screens.length === 0}
        >
          {screens.length === 0 && <option value="">— no screens —</option>}
          {screens.map((screen) => (
            <option key={screen.id} value={screen.id}>
              {screen.app_map_screen_slug}
            </option>
          ))}
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
          <button className="appza-btn" onClick={onReload} disabled={loading}>
            {loading ? '…' : 'Reload'}
          </button>
        </div>

        <button className="appza-btn">Preview</button>
        <button className="appza-btn appza-btn-primary" disabled>
          Build App
        </button>
      </div>
    </header>
  );
}

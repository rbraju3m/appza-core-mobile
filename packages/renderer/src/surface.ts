import type { AppSurface, TemplateScreen } from '@appza/schemas';

// Filter TemplateScreens by author-tagged surface availability. Rows
// tagged 'both' (or missing/legacy) always pass through; 'plugin'-only
// rows are dropped on mobile, 'mobile'-only rows are dropped in the
// plugin-admin simulator. Runs once at snapshot ingest so every
// downstream .find/.map sees only the surface's own list.
export function filterScreensBySurface<T extends Pick<TemplateScreen, 'surface'>>(
  screens: readonly T[],
  surface: Exclude<AppSurface, 'both' | 'none'>,
): T[] {
  return screens.filter((s) => {
    const value = s.surface ?? 'both';
    return value === 'both' || value === surface;
  });
}

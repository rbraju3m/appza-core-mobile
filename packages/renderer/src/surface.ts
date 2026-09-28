import type { AppSurface, TemplateScreen } from '@appza/schemas';

export function filterScreensBySurface<T extends Pick<TemplateScreen, 'surface'>>(
  screens: readonly T[],
  surface: Exclude<AppSurface, 'both' | 'none'>,
): T[] {
  return screens.filter((s) => {
    const value = s.surface ?? 'both';
    return value === 'both' || value === surface;
  });
}

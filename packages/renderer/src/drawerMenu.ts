import { resolveIcon } from './PrimitiveRenderer';
import type { Catalog, TemplateScreen } from '@appza/schemas';

export type DrawerMenuRow = {
  id: number;
  label: string;
  icon?: string;
};

function humanizeSlug(slug: string): string {
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Icons are all-or-none: one unresolvable name drops every row's icon rather than a ragged column.
export function buildDrawerMenu(
  screens: readonly TemplateScreen[],
  appMap?: Catalog['app_map'],
): DrawerMenuRow[] {
  const appMapNames = new Map<string, string>();
  for (const entry of appMap?.screens ?? []) {
    const slug = entry?.['slug'];
    const name = entry?.['name'];
    if (typeof slug === 'string' && typeof name === 'string' && name !== '') {
      appMapNames.set(slug, name);
    }
  }

  const listed = screens.filter((s) => s.show_in_drawer !== false);

  const ordered = [...listed].sort((a, b) => {
    const ao = a.drawer_position ?? a.position ?? 0;
    const bo = b.drawer_position ?? b.position ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id - b.id;
  });

  const rows = ordered.map((s) => ({
    id: s.id,
    label:
      s.drawer_label?.trim() ||
      appMapNames.get(s.app_map_screen_slug) ||
      humanizeSlug(s.app_map_screen_slug),
    icon: s.drawer_icon ? resolveIcon(s.drawer_icon) : undefined,
  }));

  const everyRowHasAnIcon = rows.length > 0 && rows.every((r) => r.icon !== undefined);

  return everyRowHasAnIcon ? rows : rows.map(({ id, label }) => ({ id, label }));
}

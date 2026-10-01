import { resolveIcon } from './PrimitiveRenderer';
import type { Catalog, TemplateScreen } from '@appza/schemas';
import type { DrawerMenuItem } from './effectivePlacements';

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
  siteMenu?: DrawerMenuItem[],
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

  // The site's order first; screens it has never seen follow in Core's order.
  const site = new Map((siteMenu ?? []).map((item, i) => [item.screen_slug, { ...item, at: i }]));
  const final = siteMenu
    ? [...ordered]
        .filter((s) => site.get(s.app_map_screen_slug)?.hidden !== true)
        .sort((a, b) => (site.get(a.app_map_screen_slug)?.at ?? Number.MAX_SAFE_INTEGER) - (site.get(b.app_map_screen_slug)?.at ?? Number.MAX_SAFE_INTEGER))
    : ordered;

  const rows = final.map((s) => {
    const own = site.get(s.app_map_screen_slug);
    const icon = own?.icon || s.drawer_icon;
    return {
      id: s.id,
      label:
        own?.label?.trim() ||
        s.drawer_label?.trim() ||
        appMapNames.get(s.app_map_screen_slug) ||
        humanizeSlug(s.app_map_screen_slug),
      icon: icon ? resolveIcon(icon) : undefined,
    };
  });

  const everyRowHasAnIcon = rows.length > 0 && rows.every((r) => r.icon !== undefined);

  return everyRowHasAnIcon ? rows : rows.map(({ id, label }) => ({ id, label }));
}

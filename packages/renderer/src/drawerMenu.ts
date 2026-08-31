import { resolveIcon } from './PrimitiveRenderer';
import type { Catalog, TemplateScreen } from '@appza/schemas';

export type DrawerMenuRow = {
  id: number;
  label: string;
  /** Already resolved to an SVG. Absent on every row, or present on all. */
  icon?: string;
};

function humanizeSlug(slug: string): string {
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The app's side menu, as core decided it.
 *
 * Both shells drew this list themselves: every screen in the catalog, in
 * catalog order, labelled by humanising its slug — so `space-document-add`
 * sat in the menu as "Space Document Add" beside Bookmarks, and the only
 * way to keep a screen out was `surface: 'none'`, which removes it from the
 * catalog and breaks every nav.push at it (P136).
 *
 * Three fallbacks, in order, for a row's label: the screen's `drawer_label`,
 * the App Map's name for that screen, the humanised slug. The last one is
 * what the shells did unconditionally, so a catalog that says nothing about
 * the drawer still produces exactly the menu it produced before.
 *
 * Icons are ALL-OR-NONE. A menu where some rows carry an icon and others do
 * not reads as broken, so one unresolvable name (the admin's picker offers
 * a few the renderer's registry lacks) costs the whole menu its icons
 * rather than leaving a ragged column.
 */
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

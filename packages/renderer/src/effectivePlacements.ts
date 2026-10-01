import type { Catalog, TemplateScreen } from '@appza/schemas';
import { isRecord, readOverride } from './resolveOverride';

/**
 * A screen's or chrome's placement list after the site's layout (D110): the site's
 * whole list when it saved one, else Core's. Site rows live in customizations as
 * `{items: [...], core_hash}` under `template_screen["<template>:<screen>"]` and
 * `template["<template>"]`.
 */
export type EffectivePlacement = {
  key: string;
  slot: string;
  appzet_slug: string;
  layout: string | null;
  visible_when: unknown;
  core_props: Record<string, unknown> | null;
  site_props: Record<string, unknown> | null;
};

export type DrawerMenuItem = {
  screen_slug: string;
  hidden?: boolean;
  label?: string;
  icon?: string;
};

export const SITE_KEY_PREFIX = 'site-';

export function screenLayoutKey(templateSlug: string, screenSlug: string): string {
  return `${templateSlug}:${screenSlug}`;
}

/** `slug`, then `slug#2`, `slug#3` for repeats: Core rows carry no id, so both sides derive the same one. */
export function derivedKeys(list: readonly unknown[]): string[] {
  const seen = new Map<string, number>();
  return list.map((p) => {
    const slug = isRecord(p) && typeof p['appzet_slug'] === 'string' ? (p['appzet_slug'] as string) : '';
    const n = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, n);
    return n === 1 ? slug : `${slug}#${n}`;
  });
}

function propsOf(p: Record<string, unknown>): Record<string, unknown> | null {
  const raw = p['props_override'];
  return isRecord(raw) ? raw : null;
}

function layoutOf(p: Record<string, unknown>): string | null {
  const raw = p['layout'];
  return typeof raw === 'string' && raw !== '' ? raw : null;
}

export function corePlacements(list: unknown): EffectivePlacement[] {
  if (!Array.isArray(list)) return [];
  const keys = derivedKeys(list);
  const out: EffectivePlacement[] = [];
  list.forEach((p, i) => {
    if (!isRecord(p)) return;
    const slug = p['appzet_slug'];
    if (typeof slug !== 'string' || slug === '') return;
    out.push({
      key: keys[i]!,
      slot: typeof p['slot'] === 'string' ? (p['slot'] as string) : 'other',
      appzet_slug: slug,
      layout: layoutOf(p),
      visible_when: p['visible_when'],
      core_props: propsOf(p),
      site_props: null,
    });
  });
  return out;
}

/** The site's saved list, or undefined when it saved none. */
export function readSiteItems(
  customizations: unknown,
  scope: 'template_screen' | 'template',
  targetKey: string,
  column: string,
): unknown[] | undefined {
  const value = readOverride(customizations, scope, targetKey, column);
  if (!isRecord(value) || !Array.isArray(value['items'])) return undefined;
  return value['items'] as unknown[];
}

/**
 * A site row with a Core key joins that Core row: Core keeps slot, AppZet, gate and
 * props; the site adds its own props and layout. A Core key Core no longer has is dropped.
 */
export function mergeSiteItems(core: EffectivePlacement[], siteItems: unknown[]): EffectivePlacement[] {
  const coreByKey = new Map(core.map((p) => [p.key, p]));
  const seen = new Set<string>();
  const out: EffectivePlacement[] = [];
  for (const item of siteItems) {
    if (!isRecord(item) || typeof item['key'] !== 'string' || item['key'] === '') continue;
    const key = item['key'] as string;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = coreByKey.get(key);
    if (base) {
      out.push({
        ...base,
        layout: layoutOf(item) ?? base.layout,
        visible_when: 'visible_when' in item ? item['visible_when'] : base.visible_when,
        site_props: propsOf(item),
      });
      continue;
    }
    const slug = item['appzet_slug'];
    if (!key.startsWith(SITE_KEY_PREFIX) || typeof slug !== 'string' || slug === '') continue;
    out.push({
      key,
      slot: typeof item['slot'] === 'string' ? (item['slot'] as string) : 'main',
      appzet_slug: slug,
      layout: layoutOf(item),
      visible_when: item['visible_when'],
      core_props: null,
      site_props: propsOf(item),
    });
  }
  return out;
}

function effective(core: EffectivePlacement[], siteItems: unknown[] | undefined): EffectivePlacement[] {
  return siteItems === undefined ? core : mergeSiteItems(core, siteItems);
}

function templateSlugOf(catalog: Catalog): string {
  return catalog.template?.slug ?? catalog.template_slug ?? '';
}

export function screenPlacements(
  screen: TemplateScreen,
  catalog: Catalog,
  customizations: unknown,
): EffectivePlacement[] {
  const key = screenLayoutKey(templateSlugOf(catalog), screen.app_map_screen_slug);
  return effective(
    corePlacements(screen.placements),
    readSiteItems(customizations, 'template_screen', key, 'placements'),
  );
}

/** Empty means "use the template's appbar", on either side. */
export function screenAppbarPlacements(
  screen: TemplateScreen,
  catalog: Catalog,
  customizations: unknown,
): EffectivePlacement[] {
  const key = screenLayoutKey(templateSlugOf(catalog), screen.app_map_screen_slug);
  const raw = (screen as unknown as Record<string, unknown>)['appbar_placements'];
  return effective(
    corePlacements(raw),
    readSiteItems(customizations, 'template_screen', key, 'appbar_placements'),
  );
}

export function templateChromePlacements(
  catalog: Catalog,
  customizations: unknown,
  column: 'appbar_placements' | 'nav_placements' | 'drawer_placements',
): EffectivePlacement[] {
  const raw = (catalog.template as Record<string, unknown> | undefined)?.[column];
  return effective(
    corePlacements(raw),
    readSiteItems(customizations, 'template', templateSlugOf(catalog), column),
  );
}

export function drawerMenuItems(catalog: Catalog, customizations: unknown): DrawerMenuItem[] | undefined {
  const items = readSiteItems(customizations, 'template', templateSlugOf(catalog), 'drawer_menu');
  if (!items) return undefined;
  return items.filter(
    (i): i is DrawerMenuItem => isRecord(i) && typeof i['screen_slug'] === 'string' && i['screen_slug'] !== '',
  );
}

/** The layout's Superstructure slug, only when the AppZet offers it. */
export function validLayout(appzet: unknown, layout: string | null | undefined): string | null {
  if (!layout || !isRecord(appzet) || !Array.isArray(appzet['layouts'])) return null;
  return (appzet['layouts'] as unknown[]).some((l) => isRecord(l) && l['slug'] === layout) ? layout : null;
}

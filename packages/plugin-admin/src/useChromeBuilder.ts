import { useCallback, useEffect, useState } from 'react';
import { isRecord, screenLayoutKey, type DrawerMenuItem } from '@appza/renderer';
import { loadPart, newSiteKey, resetPart, savePart, type LayoutPart } from './layoutApi';

/** One Global-tab resource: a chrome list (at most one entry) or the drawer menu. */
export type ChromeDraft = {
  template: string;
  screen: string | null;
  part: LayoutPart;
  core: unknown[];
  palette: string[];
  baseVersion: number | null;
  drift: boolean;
  saved: unknown[] | null;
  items: unknown[];
  dirty: boolean;
};

export type ChromeItem = { key: string; appzet_slug?: string };

const TEMPLATE_PARTS: LayoutPart[] = ['appbar', 'nav', 'drawer', 'drawer-menu'];

const COLUMN: Record<Exclude<LayoutPart, 'body'>, string> = {
  appbar: 'appbar_placements',
  nav: 'nav_placements',
  drawer: 'drawer_placements',
  'drawer-menu': 'drawer_menu',
};

export function chromeId(template: string, screen: string | null, part: LayoutPart): string {
  return `${template}:${screen ?? '_'}:${part}`;
}

const slugOf = (c: unknown): string => (isRecord(c) && typeof c.screen_slug === 'string' ? c.screen_slug : '');

/** The whole menu in the site's order; screens it has never seen follow in Core's. */
function menuItems(core: unknown[], site: unknown[] | null): DrawerMenuItem[] {
  const coreSlugs = core.map(slugOf).filter(Boolean);
  if (!site) return coreSlugs.map((screen_slug) => ({ screen_slug }));
  const known = new Set(coreSlugs);
  const mine = site.filter((i): i is DrawerMenuItem => known.has(slugOf(i)));
  const seen = new Set(mine.map((i) => i.screen_slug));
  return [...mine, ...coreSlugs.filter((s) => !seen.has(s)).map((screen_slug) => ({ screen_slug }))];
}

function initialItems(part: LayoutPart, core: unknown[], site: unknown[] | null): unknown[] {
  if (part === 'drawer-menu') return menuItems(core, site);
  return site ?? core.map((c) => ({ key: (c as ChromeItem).key }));
}

/** The AppZet a chrome draft shows, or null when its list is empty. */
export function selectedSlug(d: ChromeDraft): string | null {
  const item = d.items[0] as ChromeItem | undefined;
  if (!item) return null;
  const core = (d.core as ChromeItem[]).find((c) => c.key === item.key);
  return core?.appzet_slug ?? item.appzet_slug ?? null;
}

type Options = {
  active: boolean;
  template: string;
  screen: string | null;
  onSaved: () => void;
};

export function useChromeBuilder({ active, template, screen, onSaved }: Options) {
  const [drafts, setDrafts] = useState<Record<string, ChromeDraft>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async (t: string, s: string | null, part: LayoutPart) => {
    try {
      const body = await loadPart(t, s, part);
      const d: ChromeDraft = {
        template: t,
        screen: s,
        part,
        core: body.core,
        palette: body.palette,
        baseVersion: body.version,
        drift: body.drift,
        saved: body.site,
        items: initialItems(part, body.core, body.site),
        dirty: false,
      };
      setDrafts((all) => ({ ...all, [chromeId(t, s, part)]: d }));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (!active || !template) return;
    setLoadError(null);
    for (const part of TEMPLATE_PARTS) {
      if (!drafts[chromeId(template, null, part)]) void reload(template, null, part);
    }
    if (screen && !drafts[chromeId(template, screen, 'appbar')]) void reload(template, screen, 'appbar');
    // Loaded once per target; `drafts` is read, not watched, or every load would re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, template, screen, reload]);

  const get = useCallback(
    (part: LayoutPart, ofScreen: string | null = null) => drafts[chromeId(template, ofScreen, part)] ?? null,
    [drafts, template],
  );

  const setItems = useCallback((d: ChromeDraft, items: unknown[]) => {
    setSaveError(null);
    const id = chromeId(d.template, d.screen, d.part);
    setDrafts((all) => (all[id] ? { ...all, [id]: { ...all[id]!, items, dirty: true } } : all));
  }, []);

  /** A slug Core placed keeps Core's key; anything else is the site's own row. Null empties the list. */
  const select = useCallback(
    (d: ChromeDraft, slug: string | null) => {
      if (slug === null) return setItems(d, []);
      const core = (d.core as ChromeItem[]).find((c) => c.appzet_slug === slug);
      setItems(d, [core ? { key: core.key } : { key: newSiteKey(), appzet_slug: slug }]);
    },
    [setItems],
  );

  const dirty = Object.values(drafts).filter((d) => d.dirty);

  const save = useCallback(async () => {
    const pending = Object.values(drafts).filter((d) => d.dirty);
    if (pending.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const problems: string[] = [];
    for (const d of pending) {
      const items =
        d.part === 'drawer-menu'
          ? (d.items as DrawerMenuItem[]).map(({ screen_slug, hidden, label, icon }) => ({
              screen_slug,
              ...(hidden ? { hidden: true } : {}),
              ...(label?.trim() ? { label: label.trim() } : {}),
              ...(icon?.trim() ? { icon: icon.trim() } : {}),
            }))
          : d.items;
      const r = await savePart(d.template, d.screen, d.part, items, d.baseVersion);
      if (r.ok) {
        await reload(d.template, d.screen, d.part);
        continue;
      }
      const detail = r.errors ? Object.entries(r.errors).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
      problems.push(`${d.part}: ${r.message}${detail ? ` (${detail})` : ''}`);
    }
    setSaving(false);
    if (problems.length) setSaveError(problems.join('\n'));
    onSaved();
  }, [drafts, reload, onSaved]);

  const discard = useCallback(() => {
    setSaveError(null);
    setDrafts((all) =>
      Object.fromEntries(
        Object.entries(all).map(([k, d]) => [k, d.dirty ? { ...d, items: initialItems(d.part, d.core, d.saved), dirty: false } : d]),
      ),
    );
  }, []);

  const reset = useCallback(
    async (d: ChromeDraft) => {
      if (!(await resetPart(d.template, d.screen, d.part))) setSaveError('Reset failed.');
      await reload(d.template, d.screen, d.part);
      onSaved();
    },
    [reload, onSaved],
  );

  const keepMine = useCallback(
    async (d: ChromeDraft) => {
      if (!d.saved) return;
      const r = await savePart(d.template, d.screen, d.part, d.saved, d.baseVersion);
      if (!r.ok) setSaveError(r.message);
      await reload(d.template, d.screen, d.part);
      onSaved();
    },
    [reload, onSaved],
  );

  /** Unsaved chrome drafts as the renderer reads saved rows, so the preview shows them. */
  const overlay = useCallback(
    (customizations: unknown) => {
      const shown = Object.values(drafts).filter((d) => d.dirty && d.part !== 'body');
      if (shown.length === 0) return customizations;
      const root = isRecord(customizations) ? { ...customizations } : {};
      for (const d of shown) {
        const scope = d.screen === null ? 'template' : 'template_screen';
        const target = d.screen === null ? d.template : screenLayoutKey(d.template, d.screen);
        const byTarget = isRecord(root[scope]) ? { ...(root[scope] as Record<string, unknown>) } : {};
        const prev = isRecord(byTarget[target]) ? (byTarget[target] as Record<string, unknown>) : {};
        byTarget[target] = { ...prev, [COLUMN[d.part as Exclude<LayoutPart, 'body'>]]: { items: d.items } };
        root[scope] = byTarget;
      }
      return root;
    },
    [drafts],
  );

  return { get, loadError, saveError, saving, dirtyCount: dirty.length, setItems, select, save, discard, reset, keepMine, overlay };
}

export type ChromeBuilder = ReturnType<typeof useChromeBuilder>;

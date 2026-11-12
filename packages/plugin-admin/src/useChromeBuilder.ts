import { useCallback, useEffect, useMemo, useState } from 'react';
import { isRecord, screenLayoutKey, type DrawerMenuItem } from '@appza/renderer';
import { loadPart, newSiteKey, resetPart, savePart, type LayoutPart, type LayoutSave, type PartPayload } from './layoutApi';

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
  /** "Back to original" is staged: Save deletes the site's row (P3c). `items` then shows Core's. */
  revert?: boolean;
};

export type ChromeItem = { key: string; appzet_slug?: string; layout?: string };

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

/** A draft as loaded from the plug-in, nothing changed yet. */
export function chromeDraftFrom(t: string, s: string | null, part: LayoutPart, body: PartPayload): ChromeDraft {
  return {
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
}

type Options = {
  active: boolean;
  template: string;
  screen: string | null;
  onSaved: () => void;
  /** Called just before a user's edit changes a part (Undo's step, P3b). */
  onEdit?: (thing: string) => void;
};

export function useChromeBuilder({ active, template, screen, onSaved, onEdit }: Options) {
  const [drafts, setDrafts] = useState<Record<string, ChromeDraft>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reload = useCallback(async (t: string, s: string | null, part: LayoutPart) => {
    try {
      const d = chromeDraftFrom(t, s, part, await loadPart(t, s, part));
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

  const setItems = useCallback(
    (d: ChromeDraft, items: unknown[]) => {
      setSaveError(null);
      const id = chromeId(d.template, d.screen, d.part);
      onEdit?.(`chrome:${id}`);
      setDrafts((all) => (all[id] ? { ...all, [id]: { ...all[id]!, items, dirty: true, revert: false } } : all));
    },
    [onEdit],
  );

  /** "Back to original" as an unsaved change: the phone shows Core's at once, Undo takes it back, Save writes it. */
  const revert = useCallback(
    (d: ChromeDraft) => {
      setSaveError(null);
      const id = chromeId(d.template, d.screen, d.part);
      onEdit?.(`chrome:${id}`);
      setDrafts((all) =>
        all[id] ? { ...all, [id]: { ...all[id]!, items: initialItems(d.part, d.core, null), dirty: true, revert: true } } : all,
      );
    },
    [onEdit],
  );

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

  /** The unsaved app bar / tabs / drawer parts, for the top bar's one Save. A staged revert deletes the row. */
  const pending = useCallback(
    (): LayoutSave[] =>
      Object.values(drafts)
        .filter((d) => d.dirty)
        .map((d): LayoutSave => {
          const at = { template: d.template, screen: d.screen, part: d.part, base_version: d.baseVersion };
          if (d.revert) return { ...at, remove: true };
          const items =
            d.part === 'drawer-menu'
              ? (d.items as DrawerMenuItem[]).map(({ screen_slug, hidden, label, icon }) => ({
                  screen_slug,
                  ...(hidden ? { hidden: true } : {}),
                  ...(label?.trim() ? { label: label.trim() } : {}),
                  ...(icon?.trim() ? { icon: icon.trim() } : {}),
                }))
              : d.items;
          return { ...at, items };
        }),
    [drafts],
  );

  /** After a Save: each saved part reloads, for its new version. */
  const afterSave = useCallback(async () => {
    setSaveError(null);
    await Promise.all(Object.values(drafts).filter((d) => d.dirty).map((d) => reload(d.template, d.screen, d.part)));
  }, [drafts, reload]);

  /** The unsaved parts, for Undo (P3b): the draft itself, which is a new object only when it changes. */
  const edits = useMemo(
    () => Object.fromEntries(Object.entries(drafts).filter(([, d]) => d.dirty).map(([k, d]) => [k, d as unknown])),
    [drafts],
  );

  /** Puts the parts back as `edits` had them; a part not in it goes back to what is saved. */
  const restoreEdits = useCallback((target: Record<string, unknown>) => {
    setSaveError(null);
    setDrafts((all) =>
      Object.fromEntries(
        Object.entries(all).map(([k, d]) =>
          k in target
            ? [k, { ...d, items: (target[k] as ChromeDraft).items, revert: (target[k] as ChromeDraft).revert, dirty: true }]
            : [k, d.dirty ? { ...d, items: initialItems(d.part, d.core, d.saved), dirty: false, revert: false } : d],
        ),
      ),
    );
  }, []);

  /** P1d "Reset app": each part the site saved goes back to Core's (staged); other unsaved part edits are dropped. */
  const stageRevertAll = useCallback(
    (saved: ChromeDraft[]) => {
      setSaveError(null);
      onEdit?.('reset:chrome');
      setDrafts((all) => {
        const next: Record<string, ChromeDraft> = {};
        for (const [k, d] of Object.entries(all)) {
          next[k] = d.dirty ? { ...d, items: initialItems(d.part, d.core, d.saved), dirty: false, revert: false } : d;
        }
        for (const d of saved) {
          next[chromeId(d.template, d.screen, d.part)] = { ...d, items: initialItems(d.part, d.core, null), dirty: true, revert: true };
        }
        return next;
      });
    },
    [onEdit],
  );

  const discard = useCallback(() => {
    setSaveError(null);
    setDrafts((all) =>
      Object.fromEntries(
        Object.entries(all).map(([k, d]) => [k, d.dirty ? { ...d, items: initialItems(d.part, d.core, d.saved), dirty: false, revert: false } : d]),
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

  return { get, loadError, saveError, dirtyCount: dirty.length, setItems, select, revert, stageRevertAll, pending, afterSave, edits, restoreEdits, discard, reset, keepMine, overlay };
}

export type ChromeBuilder = ReturnType<typeof useChromeBuilder>;

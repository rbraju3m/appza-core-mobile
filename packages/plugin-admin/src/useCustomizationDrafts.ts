import { useCallback, useMemo, useState } from 'react';
import { isRecord } from '@appza/renderer';

/**
 * The builder's unsaved customizations (Friendly v2 P3): a block's settings "Everywhere", a piece's layout, the
 * theme. Held here, not in the panel that edits them, so they survive the panel closing and all show on the
 * phone at once. Written by the top bar's one Save (`POST builder/save`).
 */
export type CustomizationTarget = {
  scope: string;
  target_slug: string;
  /** `appzet_primitive` only: the piece's `<appzet>#<path>`. */
  target_slug_composite?: string | null;
  target_column: string;
};

/** A new value, or `remove`: back to the original design (the saved row is deleted on Save). */
export type CustomizationDraft = CustomizationTarget & ({ value: unknown; remove?: undefined } | { remove: true; value?: undefined });

export type DraftState = 'none' | 'value' | 'remove';

const idOf = (t: CustomizationTarget) => [t.scope, t.target_slug, t.target_slug_composite ?? '', t.target_column].join('|');

/** Where the bootstrap's customizations tree keeps a row (the plug-in's `target_key_for`). */
const treeKey = (t: CustomizationTarget) =>
  t.scope === 'appzet_primitive' || t.scope === 'template_screen_placement' ? t.target_slug_composite ?? '' : t.target_slug;

const targetOf = (t: CustomizationTarget): CustomizationTarget => ({
  scope: t.scope,
  target_slug: t.target_slug,
  ...(t.target_slug_composite ? { target_slug_composite: t.target_slug_composite } : {}),
  target_column: t.target_column,
});

/** Key order doesn't matter: MySQL's JSON and a panel's spread can order one object two ways. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    isRecord(val) && !Array.isArray(val)
      ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]]))
      : val,
  );
}

/** Whether the saved customizations have a row for this target. */
export function hasSavedRow(customizations: unknown, t: CustomizationTarget): boolean {
  if (!isRecord(customizations)) return false;
  const scope = customizations[t.scope];
  const target = isRecord(scope) ? scope[treeKey(t)] : undefined;
  return isRecord(target) && t.target_column in target;
}

/** `onEdit` is called just before a user's edit changes a draft (Undo's step, P3b). */
export function useCustomizationDrafts(onEdit?: (thing: string) => void) {
  const [drafts, setDrafts] = useState<Record<string, CustomizationDraft>>({});

  const stateOf = useCallback(
    (t: CustomizationTarget): DraftState => {
      const d = drafts[idOf(t)];
      return !d ? 'none' : d.remove ? 'remove' : 'value';
    },
    [drafts],
  );

  /** Setting the value a draft already has changes nothing (no re-render, no loop with the panel). */
  const set = useCallback((t: CustomizationTarget, value: unknown) => {
    const id = idOf(t);
    onEdit?.(`custom:${id}`);
    setDrafts((all) => {
      const prev = all[id];
      if (prev && !prev.remove && stableJson(prev.value) === stableJson(value)) return all;
      return { ...all, [id]: { ...targetOf(t), value } };
    });
  }, [onEdit]);

  const remove = useCallback(
    (t: CustomizationTarget) => {
      const id = idOf(t);
      onEdit?.(`custom:${id}`);
      setDrafts((all) => (all[id]?.remove ? all : { ...all, [id]: { ...targetOf(t), remove: true } }));
    },
    [onEdit],
  );

  const clear = useCallback((t: CustomizationTarget) => {
    const id = idOf(t);
    onEdit?.(`custom:${id}`);
    setDrafts((all) => {
      if (!(id in all)) return all;
      const next = { ...all };
      delete next[id];
      return next;
    });
  }, [onEdit]);

  const discard = useCallback(() => setDrafts((all) => (Object.keys(all).length ? {} : all)), []);

  /** P1d "Reset app": every saved row goes back to the original design on Save; unsaved edits are dropped. */
  const stageRemoveAll = useCallback(
    (targets: CustomizationTarget[]) => {
      onEdit?.('reset:custom');
      setDrafts(Object.fromEntries(targets.map((t) => [idOf(t), { ...targetOf(t), remove: true } as CustomizationDraft])));
    },
    [onEdit],
  );

  /** The saved customizations with every draft laid over them, as the renderer reads them. */
  const overlay = useCallback(
    (customizations: unknown): unknown => {
      const list = Object.values(drafts);
      if (list.length === 0) return customizations;
      const root: Record<string, unknown> = isRecord(customizations) ? { ...customizations } : {};
      for (const d of list) {
        const byTarget = isRecord(root[d.scope]) ? { ...(root[d.scope] as Record<string, unknown>) } : {};
        const key = treeKey(d);
        const columns = isRecord(byTarget[key]) ? { ...(byTarget[key] as Record<string, unknown>) } : {};
        if (d.remove) delete columns[d.target_column];
        else columns[d.target_column] = d.value;
        if (Object.keys(columns).length) byTarget[key] = columns;
        else delete byTarget[key];
        root[d.scope] = byTarget;
      }
      return root;
    },
    [drafts],
  );

  /** The body's `customizations` list for `POST builder/save`. */
  const payload = useCallback(
    () =>
      Object.values(drafts).map((d) =>
        d.remove ? { ...targetOf(d), remove: true } : { ...targetOf(d), override_value: d.value },
      ),
    [drafts],
  );

  /** Undo (P3b): every draft as it is, and back to a set of them. */
  const restore = useCallback((all: Record<string, unknown>) => setDrafts(all as Record<string, CustomizationDraft>), []);

  const count = Object.keys(drafts).length;
  return useMemo(
    () => ({ all: drafts as Record<string, unknown>, count, stateOf, set, remove, clear, discard, stageRemoveAll, restore, overlay, payload }),
    [drafts, count, stateOf, set, remove, clear, discard, stageRemoveAll, restore, overlay, payload],
  );
}

export type CustomizationDrafts = ReturnType<typeof useCustomizationDrafts>;

/** One target's draft, as a panel uses it. */
export type DraftHandle = {
  state: DraftState;
  set: (value: unknown) => void;
  remove: () => void;
  clear: () => void;
};

export function draftHandle(drafts: CustomizationDrafts, t: CustomizationTarget): DraftHandle {
  return {
    state: drafts.stateOf(t),
    set: (value) => drafts.set(t, value),
    remove: () => drafts.remove(t),
    clear: () => drafts.clear(t),
  };
}

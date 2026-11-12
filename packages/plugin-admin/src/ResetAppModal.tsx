import { useEffect, useState } from 'react';
import { isRecord } from '@appza/renderer';
import { Problem, caughtProblem, httpProblem } from './errors';
import { loadDraft, loadPart, type LayoutPart, type ScreenDraft } from './layoutApi';
import { chromeDraftFrom, type ChromeDraft } from './useChromeBuilder';
import type { CustomizationTarget } from './useCustomizationDrafts';

/**
 * v1 parity P1d: "Reset app to the look's design". Everything the site changed for this look goes: block settings,
 * theme, piece layouts, data-feed / action tweaks, page layouts, app bar / tabs / drawer. Staged as unsaved changes
 * (D126): the phone shows the look's design at once, one Undo brings it all back, Save deletes the rows.
 * The app's name, icon and splash (P1c) are not design and stay.
 */

const LAYOUT_COLUMNS = ['placements', 'appbar_placements', 'nav_placements', 'drawer_placements', 'drawer_menu'];
const CHROME_PART: Record<string, LayoutPart> = {
  appbar_placements: 'appbar',
  nav_placements: 'nav',
  drawer_placements: 'drawer',
  drawer_menu: 'drawer-menu',
};
const SCREEN_PART: Record<string, LayoutPart> = { placements: 'body', appbar_placements: 'appbar' };

type Row = { scope: string; target_slug: string | null; target_slug_composite: string | null; target_column: string };

export type ResetPlan = {
  /** Every saved setting row (incl. data-feed / action tweaks), each to be removed. */
  settings: CustomizationTarget[];
  /** Of `settings`, the data-feed and action tweaks (Advanced). */
  tweaks: number;
  pages: ScreenDraft[];
  chrome: ChromeDraft[];
};

async function savedRows(): Promise<Row[]> {
  const cfg = window.appzaCoreConfig;
  const endpoint = cfg?.endpoints?.customizations;
  if (!endpoint || !cfg?.restNonce) throw new Problem('Open this page from your WordPress dashboard (APPZA in the menu) to continue.');
  const res = await fetch(endpoint, { headers: { Accept: 'application/json', 'X-WP-Nonce': cfg.restNonce }, credentials: 'same-origin' });
  if (!res.ok) throw new Problem(await httpProblem(res, "Reading your app's changes"));
  const body: unknown = await res.json();
  return Array.isArray(body) ? (body.filter(isRecord) as unknown as Row[]) : [];
}

/** What the site saved for this look, with each layout freshly loaded (its version is what Save deletes). */
export async function loadResetPlan(template: string): Promise<ResetPlan> {
  const rows = await savedRows();
  const settings: CustomizationTarget[] = [];
  let tweaks = 0;
  const pageLoads: Array<Promise<ScreenDraft>> = [];
  const chromeLoads: Array<Promise<ChromeDraft>> = [];
  for (const r of rows) {
    const layout = LAYOUT_COLUMNS.includes(r.target_column) && (r.scope === 'template' || r.scope === 'template_screen');
    if (!layout) {
      // Another look's theme is that look's, not this one's.
      if (r.scope === 'template' && r.target_slug !== template) continue;
      settings.push({
        scope: r.scope,
        target_slug: r.target_slug ?? '',
        ...(r.target_slug_composite ? { target_slug_composite: r.target_slug_composite } : {}),
        target_column: r.target_column,
      });
      if (r.scope === 'data_source' || r.scope === 'action') tweaks++;
      continue;
    }
    if (r.scope === 'template' && r.target_slug === template && CHROME_PART[r.target_column]) {
      const part = CHROME_PART[r.target_column]!;
      chromeLoads.push(loadPart(template, null, part).then((b) => chromeDraftFrom(template, null, part, b)));
    } else if (r.scope === 'template_screen' && r.target_slug_composite === template && r.target_slug && SCREEN_PART[r.target_column]) {
      const screen = r.target_slug;
      const part = SCREEN_PART[r.target_column]!;
      if (part === 'body') pageLoads.push(loadDraft(template, screen));
      else chromeLoads.push(loadPart(template, screen, part).then((b) => chromeDraftFrom(template, screen, part, b)));
    }
  }
  // A layout for a page the look no longer has can't be read (404): nothing of it shows, so nothing to reset.
  const kept = <T,>(all: PromiseSettledResult<T>[]) => all.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const [pages, chrome] = await Promise.all([Promise.allSettled(pageLoads), Promise.allSettled(chromeLoads)]);
  return {
    settings,
    tweaks,
    pages: kept(pages).filter((d) => d.baseVersion !== null),
    chrome: kept(chrome).filter((d) => d.baseVersion !== null),
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Props = {
  template: string;
  lookName: string;
  unsavedCount: number;
  onReset: (plan: ResetPlan) => void;
  onClose: () => void;
};

export function ResetAppModal({ template, lookName, unsavedCount, onReset, onClose }: Props) {
  const [plan, setPlan] = useState<ResetPlan | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadResetPlan(template)
      .then((p) => !cancelled && setPlan(p))
      .catch((err) => !cancelled && setProblem(caughtProblem(err, "Reading your app's changes")));
    return () => {
      cancelled = true;
    };
  }, [template]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saved = plan ? plan.settings.length + plan.pages.length + plan.chrome.length : 0;
  const nothing = plan !== null && saved === 0 && unsavedCount === 0;
  const lines = plan
    ? [
        plan.settings.length - plan.tweaks > 0 && plural(plan.settings.length - plan.tweaks, 'changed setting (blocks, pieces, theme)', 'changed settings (blocks, pieces, theme)'),
        plan.pages.length > 0 && plural(plan.pages.length, 'page layout', 'page layouts'),
        plan.chrome.length > 0 && plural(plan.chrome.length, 'app bar, bottom nav or drawer change', 'app bar, bottom nav and drawer changes'),
        plan.tweaks > 0 && plural(plan.tweaks, 'data feed or action tweak', 'data feed and action tweaks'),
        unsavedCount > 0 && `your ${plural(unsavedCount, 'unsaved change', 'unsaved changes')}`,
      ].filter((l): l is string => typeof l === 'string')
    : [];

  return (
    <div className="appza-onboard-overlay" role="dialog" aria-modal="true" aria-label="Reset app" data-reset-app>
      <div className="appza-onboard-card appza-onboard-card-small">
        <div className="appza-onboard-header">
          <h2 className="appza-onboard-title">Reset your app to {lookName}'s design?</h2>
          <p className="appza-onboard-subtitle">
            {nothing
              ? `Nothing to reset: your app already uses ${lookName}'s design.`
              : 'Everything you changed in this look goes back to how the look comes. Your app name, icon and splash stay.'}
          </p>
        </div>
        <div className="appza-onboard-body">
          {!plan && !problem && <div className="appza-onboard-status">Checking what you changed…</div>}
          {plan && lines.length > 0 && (
            <>
              <ul className="appza-reset-list">
                {lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p className="appza-onboard-hint">You see the result at once. Nothing is deleted until you Save, and Undo brings it all back.</p>
            </>
          )}
        </div>
        {problem && <div className="appza-onboard-status appza-onboard-error">{problem}</div>}
        <div className="appza-onboard-footer">
          <button type="button" className="appza-onboard-btn appza-onboard-btn-ghost" onClick={onClose}>
            {nothing ? 'Close' : 'Cancel'}
          </button>
          {!nothing && (
            <button type="button" className="appza-onboard-btn appza-onboard-btn-primary" disabled={!plan} onClick={() => plan && onReset(plan)}>
              Reset app
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import type { Catalog, TemplateScreen } from '@appza/schemas';
import { indexCatalog } from './catalogIndex';
import { PlacementRenderer } from './PlacementRenderer';
import { resolveOverridableColumn } from './resolveOverride';
import { tokensToCssVars } from './tokens';

type ScreenRendererProps = {
  screen: TemplateScreen;
  catalog: Catalog;
  customizations?: unknown;
};

type SlotKey = 'header' | 'main' | 'footer' | 'actions' | 'other';

const SLOT_ORDER: SlotKey[] = ['header', 'main', 'actions', 'footer', 'other'];

const SLOT_LABEL: Record<SlotKey, string> = {
  header: 'Header',
  main: 'Main',
  actions: 'Actions',
  footer: 'Footer',
  other: 'Other',
};

/**
 * Renders a single TemplateScreen into Ionic-styled JSX. Top-level layout
 * follows the four slot conventions (header / main / actions / footer);
 * unrecognized slots fall into an "other" bucket so future Source
 * Integrations adding new slots degrade gracefully.
 *
 * Tokens cascade (DC#09 Q2 visual cascade + DC#13 Q2 customer overrides):
 *   Layer 1: catalog Template.tokens
 *   Layer 2: customizations.template.<slug>.tokens (leaf-level REPLACE)
 *   Layer 3: catalog TemplateScreen.screen_tokens (per-screen narrowing)
 *   Layer 4: customizations.template_screen.<slug>.screen_tokens (override)
 *
 * Resolved tokens become CSS custom properties on the renderer root, so
 * Ionic components inside the subtree pick them up automatically.
 */
export function ScreenRenderer({ screen, catalog, customizations }: ScreenRendererProps) {
  const catalogIndex = useMemo(() => indexCatalog(catalog), [catalog]);

  const cssVars = useMemo(() => {
    const templateSlug = catalog.template?.slug ?? '';
    const baseTokens = (catalog.template?.tokens as unknown) ?? {};
    const templateTokens = resolveOverridableColumn(
      customizations,
      'template',
      templateSlug,
      'tokens',
      baseTokens,
    );
    const baseScreenTokens = (screen.screen_tokens as unknown) ?? {};
    const screenTokens = resolveOverridableColumn(
      customizations,
      'template_screen',
      screen.app_map_screen_slug,
      'screen_tokens',
      baseScreenTokens,
    );
    // Merge template-level under screen-level (screen wins where set).
    return {
      ...tokensToCssVars(templateTokens),
      ...tokensToCssVars(screenTokens),
    };
  }, [catalog.template, screen, customizations]);

  const placements = screen.placements ?? [];
  const bySlot = new Map<SlotKey, Array<{ appzet_slug: string }>>();
  for (const p of placements) {
    const rawSlot = typeof p['slot'] === 'string' ? (p['slot'] as string) : 'other';
    const slot = normalizeSlot(rawSlot);
    const appzet_slug = typeof p['appzet_slug'] === 'string' ? (p['appzet_slug'] as string) : '';
    if (!appzet_slug) continue;
    const list = bySlot.get(slot) ?? [];
    list.push({ appzet_slug });
    bySlot.set(slot, list);
  }

  if (placements.length === 0) {
    return (
      <div className="appza-renderer-empty" style={cssVars}>
        <p>No placements on this screen.</p>
        <small>Wire AppZets to slots in the Core admin to see them here.</small>
      </div>
    );
  }

  return (
    <div className="appza-renderer-screen" style={cssVars}>
      {SLOT_ORDER.map((slot) => {
        const list = bySlot.get(slot);
        if (!list || list.length === 0) return null;
        return (
          <section key={slot} className="appza-renderer-slot" data-slot={slot}>
            <div className="appza-renderer-slot-label">{SLOT_LABEL[slot]}</div>
            <div className="appza-renderer-slot-content">
              {list.map((p, idx) => (
                <PlacementRenderer
                  key={`${p.appzet_slug}:${idx}`}
                  appzetSlug={p.appzet_slug}
                  catalogIndex={catalogIndex}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function normalizeSlot(raw: string): SlotKey {
  switch (raw) {
    case 'header':
    case 'main':
    case 'footer':
    case 'actions':
      return raw;
    default:
      return 'other';
  }
}

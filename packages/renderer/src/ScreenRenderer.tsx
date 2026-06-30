import { useMemo } from 'react';
import {
  IonApp,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { Catalog, TemplateScreen } from '@appza/schemas';
import { indexCatalog } from './catalogIndex';
import { PlacementRenderer } from './PlacementRenderer';
import { resolveOverridableColumn } from './resolveOverride';
import { tokensToCssVars } from './tokens';

type ScreenRendererProps = {
  screen: TemplateScreen;
  catalog: Catalog;
  customizations?: unknown;
  selectedAppzetSlug?: string | null;
  onSelectAppzet?: (slug: string | null) => void;
};

type SlotKey = 'header' | 'main' | 'footer' | 'actions' | 'other';

/**
 * Renders a single TemplateScreen into an Ionic app shell.
 *
 * Shell layout (per Slice 1, before chrome AppZets exist in Slice 2):
 *   IonApp > IonPage > IonHeader (appbar) | IonContent (main + actions + other) | IonFooter (tab nav)
 *
 * When chrome Superstructures land in Slice 2, the appbar/footer come from
 * Template.appbar_placements / .nav_placements; until then, a fallback
 * appbar shows the screen slug so the frame still reads as an app.
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
export function ScreenRenderer({
  screen,
  catalog,
  customizations,
  selectedAppzetSlug,
  onSelectAppzet,
}: ScreenRendererProps) {
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

  const headerList = bySlot.get('header') ?? [];
  const mainList = bySlot.get('main') ?? [];
  const actionsList = bySlot.get('actions') ?? [];
  const footerList = bySlot.get('footer') ?? [];
  const otherList = bySlot.get('other') ?? [];

  const templateChrome = readTemplateChrome(catalog);
  const appbarPlacements = templateChrome.appbar;
  const navPlacements = templateChrome.nav;

  const screenTitle = readScreenTitle(screen);

  return (
    <IonApp className="appza-renderer-app" style={cssVars as React.CSSProperties}>
      <IonPage className="appza-renderer-page">
        <IonHeader className="appza-renderer-header">
          <IonToolbar>
            {appbarPlacements.length > 0 ? (
              appbarPlacements.map((p, idx) => (
                <PlacementRenderer
                  key={`appbar:${p.appzet_slug}:${idx}`}
                  appzetSlug={p.appzet_slug}
                  catalogIndex={catalogIndex}
                  customizations={customizations}
                  selectedAppzetSlug={selectedAppzetSlug}
                  onSelectAppzet={onSelectAppzet}
                />
              ))
            ) : headerList.length > 0 ? (
              headerList.map((p, idx) => (
                <PlacementRenderer
                  key={`hdr:${p.appzet_slug}:${idx}`}
                  appzetSlug={p.appzet_slug}
                  catalogIndex={catalogIndex}
                  customizations={customizations}
                  selectedAppzetSlug={selectedAppzetSlug}
                  onSelectAppzet={onSelectAppzet}
                />
              ))
            ) : (
              <IonTitle>{screenTitle}</IonTitle>
            )}
          </IonToolbar>
        </IonHeader>

        <IonContent className="appza-renderer-content" fullscreen>
          {placements.length === 0 ? (
            <div className="appza-renderer-empty">
              <p>No placements on this screen.</p>
              <small>Wire AppZets to slots in the Core admin to see them here.</small>
            </div>
          ) : (
            <div className="appza-renderer-screen">
              {mainList.length > 0 && (
                <section className="appza-renderer-slot" data-slot="main">
                  {mainList.map((p, idx) => (
                    <PlacementRenderer
                      key={`main:${p.appzet_slug}:${idx}`}
                      appzetSlug={p.appzet_slug}
                      catalogIndex={catalogIndex}
                      customizations={customizations}
                      selectedAppzetSlug={selectedAppzetSlug}
                      onSelectAppzet={onSelectAppzet}
                    />
                  ))}
                </section>
              )}
              {actionsList.length > 0 && (
                <section className="appza-renderer-slot" data-slot="actions">
                  {actionsList.map((p, idx) => (
                    <PlacementRenderer
                      key={`act:${p.appzet_slug}:${idx}`}
                      appzetSlug={p.appzet_slug}
                      catalogIndex={catalogIndex}
                      customizations={customizations}
                      selectedAppzetSlug={selectedAppzetSlug}
                      onSelectAppzet={onSelectAppzet}
                    />
                  ))}
                </section>
              )}
              {otherList.length > 0 && (
                <section className="appza-renderer-slot" data-slot="other">
                  {otherList.map((p, idx) => (
                    <PlacementRenderer
                      key={`oth:${p.appzet_slug}:${idx}`}
                      appzetSlug={p.appzet_slug}
                      catalogIndex={catalogIndex}
                      customizations={customizations}
                      selectedAppzetSlug={selectedAppzetSlug}
                      onSelectAppzet={onSelectAppzet}
                    />
                  ))}
                </section>
              )}
            </div>
          )}
        </IonContent>

        {(navPlacements.length > 0 || footerList.length > 0) && (
          <IonFooter className="appza-renderer-footer">
            <IonToolbar>
              <div className="appza-renderer-nav">
                {(navPlacements.length > 0 ? navPlacements : footerList).map((p, idx) => (
                  <PlacementRenderer
                    key={`nav:${p.appzet_slug}:${idx}`}
                    appzetSlug={p.appzet_slug}
                    catalogIndex={catalogIndex}
                    customizations={customizations}
                    selectedAppzetSlug={selectedAppzetSlug}
                    onSelectAppzet={onSelectAppzet}
                  />
                ))}
              </div>
            </IonToolbar>
          </IonFooter>
        )}
      </IonPage>
    </IonApp>
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

type ChromePlacement = { appzet_slug: string };

function readTemplateChrome(catalog: Catalog): {
  appbar: ChromePlacement[];
  nav: ChromePlacement[];
  drawer: ChromePlacement[];
} {
  const template = catalog.template as Record<string, unknown> | undefined;
  return {
    appbar: readChromeList(template, 'appbar_placements'),
    nav: readChromeList(template, 'nav_placements'),
    drawer: readChromeList(template, 'drawer_placements'),
  };
}

function readChromeList(
  template: Record<string, unknown> | undefined,
  key: string,
): ChromePlacement[] {
  if (!template) return [];
  const raw = template[key];
  if (!Array.isArray(raw)) return [];
  const out: ChromePlacement[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === 'object' && 'appzet_slug' in entry) {
      const slug = (entry as Record<string, unknown>)['appzet_slug'];
      if (typeof slug === 'string' && slug.length > 0) {
        out.push({ appzet_slug: slug });
      }
    }
  }
  return out;
}

function readScreenTitle(screen: TemplateScreen): string {
  const raw = (screen as unknown as Record<string, unknown>)['name'];
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return screen.app_map_screen_slug ?? '';
}

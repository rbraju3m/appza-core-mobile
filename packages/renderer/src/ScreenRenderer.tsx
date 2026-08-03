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
import { useSpacesControls } from './spacesControls';
import { useSpaceDetailControls } from './spaceDetailControls';

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

  // Read state slices that placement-level visible_when may reference.
  // Adding a slice here is enough — the evaluator looks up state.<key>
  // out of the assembled `stateBag` at match time.
  const spacesControls = useSpacesControls();
  const spaceDetailControls = useSpaceDetailControls();
  // Placement-level visible_when reads out of this bag via
  // `binding.slice(6)` (i.e. `state.<key>` → `<key>`). Register nested
  // paths as flat keys so `state.space_detail_controls.active_subtab`
  // resolves without a dot-walk helper.
  const stateBag: Record<string, unknown> = useMemo(
    () => ({
      spaces_tab: spacesControls.tab,
      spaces_search: spacesControls.search,
      spaces_sort: spacesControls.sort,
      'space_detail_controls.active_subtab': spaceDetailControls.active_subtab,
      'space_detail_controls.topic_slug': spaceDetailControls.topic_slug,
      'space_detail_controls.sort': spaceDetailControls.sort,
      'space_detail_controls.space_slug': spaceDetailControls.space_slug,
    }),
    [
      spacesControls.tab,
      spacesControls.search,
      spacesControls.sort,
      spaceDetailControls.active_subtab,
      spaceDetailControls.topic_slug,
      spaceDetailControls.sort,
      spaceDetailControls.space_slug,
    ],
  );

  const placements = screen.placements ?? [];
  type PlacementEntry = {
    appzet_slug: string;
    props_override: Record<string, unknown> | null;
  };
  const bySlot = new Map<SlotKey, PlacementEntry[]>();
  for (const p of placements) {
    const rawSlot = typeof p['slot'] === 'string' ? (p['slot'] as string) : 'other';
    const slot = normalizeSlot(rawSlot);
    const appzet_slug = typeof p['appzet_slug'] === 'string' ? (p['appzet_slug'] as string) : '';
    if (!appzet_slug) continue;
    // Placement-level visible_when — currently only supports state.* bindings.
    // Failing-open on unparseable shapes keeps a stale catalog from silently
    // dropping placements the renderer doesn't recognize yet.
    if (!evaluatePlacementVisibleWhen(p as Record<string, unknown>, stateBag)) continue;
    // Placement-level props_override rides along with the placement; the
    // renderer inspects `data_source_slug` on it to steer DS resolution
    // for THIS placement only.
    const rawPropsOverride = p['props_override'];
    const props_override =
      rawPropsOverride && typeof rawPropsOverride === 'object' && !Array.isArray(rawPropsOverride)
        ? (rawPropsOverride as Record<string, unknown>)
        : null;
    const list = bySlot.get(slot) ?? [];
    list.push({ appzet_slug, props_override });
    bySlot.set(slot, list);
  }

  const headerList = bySlot.get('header') ?? [];
  const mainList = bySlot.get('main') ?? [];
  const actionsList = bySlot.get('actions') ?? [];
  const footerList = bySlot.get('footer') ?? [];
  const otherList = bySlot.get('other') ?? [];

  const templateChrome = readTemplateChrome(catalog);
  // Per-screen appbar override wins over the template's default chrome
  // (create-post-page needs its own "Post" button + back arrow instead of
  // the feed's hamburger + search). NULL/empty falls back to template.
  const screenAppbar = readScreenAppbar(screen);
  const appbarPlacements = screenAppbar.length > 0 ? screenAppbar : templateChrome.appbar;
  const navPlacements = templateChrome.nav;

  const screenTitle = readScreenTitle(screen);

  return (
    <IonApp
      className="appza-renderer-app"
      data-screen-slug={screen.app_map_screen_slug}
      style={cssVars as React.CSSProperties}
    >
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
                      propsOverride={p.props_override}
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
                      propsOverride={p.props_override}
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
                      propsOverride={p.props_override}
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

function readScreenAppbar(screen: TemplateScreen): ChromePlacement[] {
  const raw = (screen as unknown as Record<string, unknown>)['appbar_placements'];
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

/**
 * Placement-level `visible_when` evaluator. Supports `state.<key>` bindings
 * only for now (data.* has no meaning at placement level — placements are
 * pre-item). Fail-open on missing / unparseable shapes so a catalog that
 * ships an unknown op or binding root still shows the placement.
 *
 * Grammar mirrors the per-child evaluator in PlacementRenderer:
 *   { binding: 'state.spaces_tab', op: '==', value: 'all' }
 */
function evaluatePlacementVisibleWhen(
  placement: Record<string, unknown>,
  stateBag: Record<string, unknown>,
): boolean {
  const vw = placement['visible_when'];
  if (!vw || typeof vw !== 'object' || Array.isArray(vw)) return true;
  const rec = vw as Record<string, unknown>;
  const binding = typeof rec['binding'] === 'string' ? (rec['binding'] as string) : '';
  const op = typeof rec['op'] === 'string' ? (rec['op'] as string) : '';
  const value = 'value' in rec ? rec['value'] : undefined;
  if (!binding || !op) return true;

  let resolved: unknown = undefined;
  if (binding.startsWith('state.')) {
    resolved = stateBag[binding.slice(6)];
  } else {
    // Unknown root — fail open. data.* has no meaning at placement level.
    return true;
  }

  switch (op) {
    case '==':
      return resolved === value;
    case '!=':
      return resolved !== value;
    case 'exists':
      return resolved !== undefined && resolved !== null && resolved !== '';
    case 'not_exists':
      return resolved === undefined || resolved === null || resolved === '';
    case 'in':
      return Array.isArray(value) && (value as unknown[]).includes(resolved);
    case 'not_in':
      return !(Array.isArray(value) && (value as unknown[]).includes(resolved));
    default:
      return true;
  }
}

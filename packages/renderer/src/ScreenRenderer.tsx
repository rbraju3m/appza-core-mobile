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
import { useChatControls } from './chatControls';
import { useLeaderboardControls } from './leaderboardControls';
import { useBookmarkControls } from './bookmarkControls';
import { useSearchControls } from './searchControls';
import { usePostDraft, postDraftStateEntries } from './postDraft';
import { useDocumentDraft } from './documentDraft';

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
  const chatControls = useChatControls();
  const leaderboardControls = useLeaderboardControls();
  const bookmarkControls = useBookmarkControls();
  const searchControls = useSearchControls();
  const postDraft = usePostDraft();
  // Subscribed, not read directly: postDraftStateEntries consults the
  // document draft for the attach bar's gate, so the bag has to be
  // rebuilt when that slice moves.
  const documentDraft = useDocumentDraft();
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
      'space_detail_controls.documents_search': spaceDetailControls.documents_search,
      'space_detail_controls.documents_view': spaceDetailControls.documents_view,
      'space_detail_controls.media_type': spaceDetailControls.media_type,
      'space_detail_controls.media_view': spaceDetailControls.media_view,
      // Conversation screen. `messages_view` is the only one a placement
      // gates on today; the reply keys are here so the reply bar can be
      // a placement of its own rather than a child the composer hides.
      'chat_controls.messages_view': chatControls.messages_view,
      'chat_controls.can_send': chatControls.can_send,
      'chat_controls.reply_to_id': chatControls.reply_to_id,
      'chat_controls.thread_id': chatControls.thread_id,
      'chat_controls.space_slug': chatControls.space_slug,
      // Leaderboard. Both keys a placement gates on are VERDICTS, not
      // counts — `levels_view` decides whether VIEW ALL exists,
      // `ranks_view` whether the empty state shows (P75). The two
      // authored keys are here too so the strip and the button can be
      // read back without a second subscription.
      'leaderboard_controls.range': leaderboardControls.range,
      'leaderboard_controls.levels_scope': leaderboardControls.levels_scope,
      'leaderboard_controls.levels_view': leaderboardControls.levels_view,
      'leaderboard_controls.ranks_view': leaderboardControls.ranks_view,
      // Saved Posts. `view` is the three-way VERDICT the search pill,
      // the toolbar and both empty states gate on — 'list' | 'no-match'
      // | 'empty' | 'loading' (P75). `search` is here so the difference
      // between the two empty designs stays readable from a placement
      // if it ever needs to be.
      'bookmark_controls.view': bookmarkControls.view,
      'bookmark_controls.search': bookmarkControls.search,
      'bookmark_controls.sort': bookmarkControls.sort,
      'bookmark_controls.view_mode': bookmarkControls.viewMode,
      // Search. Three keys carry the whole screen.
      //
      // `view` is the six-way verdict everything except the three result
      // cards gates on: 'recent' | 'prompt' | 'typing' | 'loading' |
      // 'results' | 'no-match'.
      //
      // `active_scope` is what the three result CARDS gate on, and it is
      // deliberately not `tab`: it stays '' until the query is long enough,
      // so a short query mounts no card, fires no request, and cannot ask
      // /feeds for everything it has with an empty search. It also keeps
      // exactly one card mounted, which is what makes one request per
      // settled query true rather than three.
      //
      // `tab` is here because the two-condition no-match placements pair it
      // with `view` — the AND-list case the evaluator below grew for.
      'search_controls.view': searchControls.view,
      'search_controls.active_scope': searchControls.active_scope,
      'search_controls.tab': searchControls.tab,
      'search_controls.post_scope': searchControls.post_scope,
      'search_controls.query': searchControls.query,
      'search_controls.noun': searchControls.noun,
      // Create post. Built by postDraftStateEntries so this bag and the
      // CHILD-level evaluator in PlacementRenderer describe the draft
      // identically — two vocabularies for the same fact is how a clause
      // ends up silently hiding a control (P104). The announcement row is
      // its own placement gated on `can_announce` rather than a child the
      // composer hides, which is what makes Noor's design 4 a catalog
      // decision (P75).
      ...postDraftStateEntries(postDraft),
    }),
    [
      spacesControls.tab,
      spacesControls.search,
      spacesControls.sort,
      spaceDetailControls.active_subtab,
      spaceDetailControls.topic_slug,
      spaceDetailControls.sort,
      spaceDetailControls.space_slug,
      spaceDetailControls.documents_search,
      spaceDetailControls.documents_view,
      spaceDetailControls.media_type,
      spaceDetailControls.media_view,
      chatControls.messages_view,
      chatControls.can_send,
      chatControls.reply_to_id,
      chatControls.thread_id,
      chatControls.space_slug,
      leaderboardControls.range,
      leaderboardControls.levels_scope,
      leaderboardControls.levels_view,
      leaderboardControls.ranks_view,
      bookmarkControls.view,
      bookmarkControls.search,
      bookmarkControls.sort,
      bookmarkControls.viewMode,
      searchControls.view,
      searchControls.active_scope,
      searchControls.tab,
      searchControls.post_scope,
      searchControls.query,
      searchControls.noun,
      // The whole draft, not five of its fields. postDraftStateEntries
      // derives `has_documents` / `has_other_media` from the attachment
      // arrays, so a memo keyed on the old five would keep serving a
      // stale bag the moment a document was attached — and the attach
      // bar would not change until something else moved.
      postDraft,
      documentDraft,
    ],
  );

  const placements = screen.placements ?? [];
  type PlacementEntry = {
    appzet_slug: string;
    props_override: Record<string, unknown> | null;
    // React key, derived from the placement's position in the UNFILTERED
    // list. See the note on `key=` below for why it cannot be the index
    // of the filtered one.
    key: string;
  };
  const bySlot = new Map<SlotKey, PlacementEntry[]>();
  for (const [placementIndex, p] of placements.entries()) {
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
    list.push({ appzet_slug, props_override, key: `${appzet_slug}:${placementIndex}` });
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
              headerList.map((p) => (
                <PlacementRenderer
                  key={`hdr:${p.key}`}
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
                  {/*
                    Keyed by the placement's position in the UNFILTERED
                    list, never by its index in this filtered one.

                    A `visible_when` placement leaves no element behind
                    when it fails, so the filtered indices of everything
                    AFTER it shift by one — and with an index-derived key
                    React reads that as "different component here" and
                    unmounts + remounts every survivor. On Saved Posts
                    that cost two extra fetches of the whole bookmark
                    list every time the search box appeared or vanished:
                    the card placement had done nothing, but its key moved
                    from 2 to 0 and its useDataSource started over.

                    Same family as P90 — a failing child leaves no gap, so
                    nothing positional can address a placement.
                  */}
                  {mainList.map((p) => (
                    <PlacementRenderer
                      key={`main:${p.key}`}
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
                  {actionsList.map((p) => (
                    <PlacementRenderer
                      key={`act:${p.key}`}
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
                  {otherList.map((p) => (
                    <PlacementRenderer
                      key={`oth:${p.key}`}
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

        {/*
          A screen's own footer and the template's nav bar BOTH render,
          screen footer above, nav pinned at the bottom — Noor's call:
          the footer has to read the same on every page, so the nav is
          never displaced by a screen that brings its own controls.

          It used to be either/or, and in the wrong direction: the nav
          won, so a `footer` placement could never render at all on a
          template that ships one, and the conversation's composer and
          profile-page-edit's Save button were both silently dropped.
        */}
        {(navPlacements.length > 0 || footerList.length > 0) && (
          <IonFooter className="appza-renderer-footer">
            {footerList.length > 0 && (
              <IonToolbar>
                <div className="appza-renderer-footer-slot" data-slot="footer">
                  {footerList.map((p) => (
                    <PlacementRenderer
                      key={`ftr:${p.key}`}
                      appzetSlug={p.appzet_slug}
                      catalogIndex={catalogIndex}
                      customizations={customizations}
                      selectedAppzetSlug={selectedAppzetSlug}
                      onSelectAppzet={onSelectAppzet}
                      propsOverride={p.props_override}
                    />
                  ))}
                </div>
              </IonToolbar>
            )}
            {navPlacements.length > 0 && (
              <IonToolbar>
                <div className="appza-renderer-nav">
                  {navPlacements.map((p, idx) => (
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
            )}
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
 * Two accepted shapes:
 *
 *   { binding: 'state.spaces_tab', op: '==', value: 'all' }            one clause
 *   [ { ... }, { ... } ]                                               ALL must pass
 *
 * The list form arrived with the Search screen (2026-08-23), whose no-match
 * placements have to say "this tab AND nothing matched" — two facts that no
 * single binding holds. The alternative was deriving another slice key per
 * such pair, which would have meant minting one forever.
 *
 * It is an AND-list, not an OR-list, to match the per-child `conditions`
 * grammar D45 already locked. Nothing here is an OR: a placement that needs
 * one is two placements.
 */
function evaluatePlacementVisibleWhen(
  placement: Record<string, unknown>,
  stateBag: Record<string, unknown>,
): boolean {
  const vw = placement['visible_when'];
  if (!vw || typeof vw !== 'object') return true;
  if (Array.isArray(vw)) {
    // An EMPTY list is not "hide everything" — it is a catalog row that
    // says nothing, and saying nothing has always meant show.
    if (vw.length === 0) return true;
    return vw.every((clause) =>
      clause && typeof clause === 'object' && !Array.isArray(clause)
        ? evaluateVisibleWhenClause(clause as Record<string, unknown>, stateBag)
        : true,
    );
  }
  return evaluateVisibleWhenClause(vw as Record<string, unknown>, stateBag);
}

/** One `{binding, op, value}` clause. See the grammar note above. */
function evaluateVisibleWhenClause(
  rec: Record<string, unknown>,
  stateBag: Record<string, unknown>,
): boolean {
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

import { useEffect, useMemo, useRef } from 'react';
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
import { indexCatalog, type CatalogIndex } from './catalogIndex';
import { useScreenScrollMemory } from './screenScrollMemory';
import { PlacementRenderer } from './PlacementRenderer';
import { resolveOverridableColumn } from './resolveOverride';
import { tokensToCssVars } from './tokens';
import { useSpacesControls } from './spacesControls';
import { useSpaceDetailControls } from './spaceDetailControls';
import { useChatControls } from './chatControls';
import { usePostDetailControls } from './postDetailControls';
import { useLeaderboardControls } from './leaderboardControls';
import { useBookmarkControls } from './bookmarkControls';
import { useSearchControls } from './searchControls';
import { usePostDraft, postDraftStateEntries } from './postDraft';
import { useDocumentDraft } from './documentDraft';
import { useFcRuntimeSettings } from './fcRuntimeSettings';
import { useViewer, viewerStateEntries } from './viewer';
import { useBannerControls, bannerStateEntries } from './bannerControls';
import { useProfileControls, setProfileControls } from './profileControls';
import { useMemberDirectoryControls, memberDirectoryStateEntries } from './memberDirectoryControls';
import { useModerationControls, moderationStateEntries } from './moderationControls';
import { useCourseListControls, courseListStateEntries } from './courseListControls';
import { useListVerdicts } from './listVerdicts';
import { getFcRuntimeSettings } from './fcRuntimeSettings';
import { readDataPath } from './dataFetch';

type ScreenRendererProps = {
  screen: TemplateScreen;
  catalog: Catalog;
  customizations?: unknown;
  selectedAppzetSlug?: string | null;
  onSelectAppzet?: (slug: string | null) => void;
  navDepth?: number;
};

type SlotKey = 'header' | 'main' | 'footer' | 'actions' | 'other';

export function ScreenRenderer({
  screen,
  catalog,
  customizations,
  selectedAppzetSlug,
  onSelectAppzet,
  navDepth,
}: ScreenRendererProps) {
  const catalogIndex = useMemo(() => indexCatalog(catalog), [catalog]);
  const contentRef = useRef<HTMLIonContentElement | null>(null);
  useScreenScrollMemory(contentRef, screen.id ?? screen.app_map_screen_slug, navDepth);

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

  // A slice any placement's visible_when reads must be subscribed here, or its gate compares against undefined.
  const spacesControls = useSpacesControls();
  const spaceDetailControls = useSpaceDetailControls();
  const chatControls = useChatControls();
  const postDetailControls = usePostDetailControls();
  const leaderboardControls = useLeaderboardControls();
  const bookmarkControls = useBookmarkControls();
  const searchControls = useSearchControls();
  const postDraft = usePostDraft();
  const documentDraft = useDocumentDraft();
  const fcSettings = useFcRuntimeSettings();
  const viewer = useViewer();
  const bannerControls = useBannerControls();
  const profileControls = useProfileControls();
  const memberDirectoryControls = useMemberDirectoryControls();
  const moderationControls = useModerationControls();
  const courseListControls = useCourseListControls();
  const listVerdicts = useListVerdicts();

  // Published here, not only on navigation: the simulator's screen picker never dispatches, so the profile would load with no member.
  const screenSlug = screen.app_map_screen_slug;
  const viewerId = viewer.user_id;
  const shownMemberId = profileControls.member_id;
  useEffect(() => {
    if (screenSlug !== 'profile') return;
    if (typeof viewerId !== 'number' || viewerId <= 0) return;
    if (shownMemberId === viewerId) return;
    setProfileControls({ member_id: viewerId, tab: 'posts' });
  }, [screenSlug, viewerId, shownMemberId]);
  // Nested paths registered as flat keys: the evaluator reads `binding.slice(6)` without a dot-walk.
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
      'chat_controls.messages_view': chatControls.messages_view,
      'chat_controls.can_send': chatControls.can_send,
      'chat_controls.reply_to_id': chatControls.reply_to_id,
      'chat_controls.thread_id': chatControls.thread_id,
      'chat_controls.space_slug': chatControls.space_slug,
      'leaderboard_controls.range': leaderboardControls.range,
      'leaderboard_controls.levels_scope': leaderboardControls.levels_scope,
      'leaderboard_controls.levels_view': leaderboardControls.levels_view,
      'leaderboard_controls.ranks_view': leaderboardControls.ranks_view,
      'profile_controls.tab': profileControls.tab,
      'profile_controls.member_id': profileControls.member_id,
      'profile_controls.follow_view': profileControls.follow_view,
      ...memberDirectoryStateEntries(memberDirectoryControls),
      ...moderationStateEntries(moderationControls),
      ...courseListStateEntries(courseListControls),
      ...Object.fromEntries(
        Object.entries(listVerdicts).map(([key, verdict]) => [`list_verdicts.${key}`, verdict]),
      ),
      'post_detail_controls.comments_view': postDetailControls.comments_view,
      'post_detail_controls.can_comment': postDetailControls.can_comment,
      'post_detail_controls.comment_sort': postDetailControls.comment_sort,
      'post_detail_controls.reply_to_id': postDetailControls.reply_to_id,
      'bookmark_controls.view': bookmarkControls.view,
      'bookmark_controls.search': bookmarkControls.search,
      'bookmark_controls.sort': bookmarkControls.sort,
      'bookmark_controls.view_mode': bookmarkControls.viewMode,
      // `active_scope` stays '' until the query is long enough, so no result card mounts or asks /feeds with an empty search.
      'search_controls.view': searchControls.view,
      'search_controls.active_scope': searchControls.active_scope,
      'search_controls.tab': searchControls.tab,
      'search_controls.post_scope': searchControls.post_scope,
      'search_controls.query': searchControls.query,
      'search_controls.noun': searchControls.noun,
      // Built by postDraftStateEntries so this bag and the child-level evaluator describe the draft identically.
      ...postDraftStateEntries(postDraft),
      // Branch on `viewer.is_guest`, not !is_logged_in, which is also true on a locked site.
      ...viewerStateEntries(viewer),
      ...bannerStateEntries(bannerControls),
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
      postDetailControls.comments_view,
      postDetailControls.can_comment,
      postDetailControls.comment_sort,
      postDetailControls.reply_to_id,
      leaderboardControls.range,
      leaderboardControls.levels_scope,
      leaderboardControls.levels_view,
      leaderboardControls.ranks_view,
      profileControls.tab,
      profileControls.member_id,
      profileControls.follow_view,
      memberDirectoryControls,
      moderationControls,
      courseListControls,
      listVerdicts,
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
      // The whole draft: has_documents / has_other_media derive from the attachment arrays.
      postDraft,
      documentDraft,
      // The whole viewer: is_guest also derives from the site's access level.
      viewer,
      bannerControls,
      fcSettings,
    ],
  );

  const placements = screen.placements ?? [];
  type PlacementEntry = {
    appzet_slug: string;
    props_override: Record<string, unknown> | null;
    key: string;
  };
  const bySlot = new Map<SlotKey, PlacementEntry[]>();
  for (const [placementIndex, p] of placements.entries()) {
    const rawSlot = typeof p['slot'] === 'string' ? (p['slot'] as string) : 'other';
    const slot = normalizeSlot(rawSlot);
    const appzet_slug = typeof p['appzet_slug'] === 'string' ? (p['appzet_slug'] as string) : '';
    if (!appzet_slug) continue;
    // Fails open on unparseable shapes so a stale catalog doesn't silently drop placements.
    if (!evaluatePlacementVisibleWhen(p as Record<string, unknown>, stateBag)) continue;
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
  const screenAppbar = readScreenAppbar(screen);
  const appbarPlacements = screenAppbar.length > 0 ? screenAppbar : templateChrome.appbar;
  // null inherits the template's nav; [] means this screen has none.
  const screenNav = readScreenNav(screen);
  const navPlacements = screenNav ?? templateChrome.nav;

  const screenTitle = readScreenTitle(screen);

  return (
    <IonApp
      className="appza-renderer-app"
      data-screen-slug={screen.app_map_screen_slug}
      // Stamped on the root so fc-post-card, whose order is CSS, can honour FluentCommunity's rich media layout.
      data-fc-rich-post-layout={fcSettings.composer.rich_post_layout}
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

        <IonContent ref={contentRef} className="appza-renderer-content" fullscreen>
          {placements.length === 0 ? (
            <div className="appza-renderer-empty">
              <p>No placements on this screen.</p>
              <small>Wire AppZets to slots in the Core admin to see them here.</small>
            </div>
          ) : (
            <div className="appza-renderer-screen">
              {mainList.length > 0 && (
                <section className="appza-renderer-slot" data-slot="main">
                  {/* Keyed by position in the unfiltered list: a hidden placement would shift the indices and remount (and refetch) every survivor. */}
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
                <div
                  className="appza-renderer-nav"
                  data-active-tab={activeNavTab(navPlacements, catalogIndex, screen.app_map_screen_slug)}
                >
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

/** null inherits the template's nav; [] means none (unlike the appbar, which falls back on empty). */
function readScreenNav(screen: TemplateScreen): ChromePlacement[] | null {
  const raw = (screen as unknown as Record<string, unknown>)['nav_placements'];
  if (!Array.isArray(raw)) return null;
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

/** One clause or an AND-list; fails open on unknown shapes or roots. */
function evaluatePlacementVisibleWhen(
  placement: Record<string, unknown>,
  stateBag: Record<string, unknown>,
): boolean {
  const vw = placement['visible_when'];
  if (!vw || typeof vw !== 'object') return true;
  if (Array.isArray(vw)) {
    // An empty list says nothing, which has always meant show.
    if (vw.length === 0) return true;
    return vw.every((clause) =>
      clause && typeof clause === 'object' && !Array.isArray(clause)
        ? evaluateVisibleWhenClause(clause as Record<string, unknown>, stateBag)
        : true,
    );
  }
  return evaluateVisibleWhenClause(vw as Record<string, unknown>, stateBag);
}

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
  } else if (binding.startsWith('settings.')) {
    // settings.* is cached site config, so safe here; as an unknown root it would fail open and only look gated.
    resolved = readDataPath(getFcRuntimeSettings(), binding.replace(/^settings\./, 'data.'));
  } else {
    // Unknown root fails open; `data.*` has no meaning before anything is fetched.
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

function activeNavTab(
  navPlacements: Array<{ appzet_slug: string }>,
  catalogIndex: CatalogIndex,
  screenSlug: string | undefined,
): string | undefined {
  if (!screenSlug) return undefined;
  for (const p of navPlacements) {
    const actions = catalogIndex.appzetBySlug.get(p.appzet_slug)?.actions as
      | Record<string, unknown>
      | null
      | undefined;
    if (!actions) continue;
    for (const [event, wiring] of Object.entries(actions)) {
      const m = /^on_tap_tab(\d+)$/.exec(event);
      if (!m || !wiring || typeof wiring !== 'object') continue;
      const args = (wiring as { args?: Record<string, unknown> }).args;
      if (args && args.target_screen_slug === screenSlug) return m[1];
      if (args && Array.isArray(args.also_active_on) && args.also_active_on.includes(screenSlug)) return m[1];
    }
  }
  return undefined;
}

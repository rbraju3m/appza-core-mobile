import { useEffect, useState, type CSSProperties } from 'react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { useDataSource } from './dataFetch';
import { getProfileControls, setProfileControls } from './profileControls';
import { useBackDismiss } from './backStack';

/**
 * Following / Followers / Blocked, as ONE bottom sheet — doc states 36
 * to 39.
 *
 * ---------------------------------------------------------------------
 * This replaces a screen, and that is a reversal
 * ---------------------------------------------------------------------
 *
 * D79 made these lists a full screen, `profile-follows`, with a search
 * field, a sort row and two tabs. The doc draws a sheet with three tabs
 * and neither control, and Noor chose the doc on 2026-09-16. The third
 * tab is the difference that matters: blocked users had no home at all
 * under D79, which is why the header's Blocked count had nowhere to go.
 *
 * ---------------------------------------------------------------------
 * It fetches through the PROXY, not the endpoint
 * ---------------------------------------------------------------------
 *
 * ChatMembersSheet is handed a resolved endpoint because it predates
 * this; calling `useDataSource` with a slug instead means the rows arrive
 * ENRICHED — `display_name`, `username_at` and the avatar flattened off
 * the pivot FluentCommunity actually returns, which is a Follow row with
 * the person one level down. Fetching the raw endpoint here would give
 * three lists of pivots and a fourth copy of the flattening.
 *
 * Hooks stay unconditional: the hook is always called, and the SLUG is
 * what changes with the tab.
 *
 * ---------------------------------------------------------------------
 * The active tab lives in profileControls
 * ---------------------------------------------------------------------
 *
 * `follow_view` already existed for the screen this replaces, and the
 * header's two counts already set it before opening — tapping Followers
 * has to land on Followers, not on whichever tab was last used. Keeping
 * it there rather than in local state is also what lets the count that
 * opened the sheet decide the tab.
 */

export const FOLLOW_SHEET_APPZET_SLUG = 'fc-follow-sheet';

/**
 * Children the builder can select, in the order the markup stamps them.
 * MUST match the `children` array of the fc-follow-sheet superstructure.
 */
export const FOLLOW_SHEET_CHILD_COUNT = 8;

export type FollowView = 'followings' | 'followers' | 'blocked';

export type FollowSheetPresentation = {
  followingsLabel: string;
  followersLabel: string;
  blockedLabel: string;
  unblockLabel: string;
  /** One empty sentence per tab — an empty Blocked list is good news. */
  emptyFollowings: string;
  emptyFollowers: string;
  emptyBlocked: string;
  usernamePrefix: string;
  showBlockedTab: boolean;
  hidden: boolean;
  sheetBgColor?: string;
  sheetRadius?: string;
  tabTrackColor?: string;
  tabActiveBgColor?: string;
  tabActiveColor?: string;
  tabColor?: string;
  tabSize?: string;
  nameColor?: string;
  nameSize?: string;
  handleColor?: string;
  handleSize?: string;
  avatarSize?: string;
  emptyColor?: string;
  emptySize?: string;
  unblockColor?: string;
  unblockBorderColor?: string;
  unblockRadius?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: FollowSheetPresentation;
  childStyles?: Record<number, CSSProperties>;
  /** Whose lists these are. */
  memberId: number | null;
  /** Which tab to land on — the count that was tapped decides. */
  view: FollowView;
  /** Catalog slugs, one per tab. No URL is written down in this file. */
  dataSources: Record<FollowView, string>;
  onOpenProfile?: (item: Record<string, unknown>) => void;
  onUnblock?: (item: Record<string, unknown>) => void;
};

const OPEN_EVENT = 'appza:open-follow-sheet';
const CLOSE_EVENT = 'appza:close-follow-sheet';

export function openFollowSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeFollowSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function FollowSheet() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [view, setView] = useState<FollowView>('followings');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setView(ce.detail.view);
      // Keep the shared slice in step, so anything else reading
      // `follow_view` agrees with what is on screen.
      setProfileControls({ follow_view: ce.detail.view });
    };
    const onClose = () => setDetail(null);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  // Unconditional, as every hook here must be: the sheet is mounted for
  // the life of the app and only RENDERS conditionally. An undefined slug
  // is the closed state and fetches nothing.
  const slug = detail ? detail.dataSources[view] : undefined;
  const memberId = detail?.memberId ?? getProfileControls().member_id ?? null;
  const state = useDataSource(
    detail ? slug : undefined,
    memberId ? { member_id: memberId } : undefined,
  );

  useBackDismiss(!(!detail || detail.presentation.hidden), () => setDetail(null));

  if (!detail || detail.presentation.hidden) return null;

  const p = detail.presentation;
  const appzetSlug = detail.appzetSlug ?? FOLLOW_SHEET_APPZET_SLUG;
  const cs = detail.childStyles ?? {};
  const rows = state.items as Array<Record<string, unknown>>;

  const tabs: Array<{ value: FollowView; label: string }> = [
    { value: 'followings', label: p.followingsLabel },
    { value: 'followers', label: p.followersLabel },
    ...(p.showBlockedTab ? [{ value: 'blocked' as FollowView, label: p.blockedLabel }] : []),
  ];

  const emptyFor: Record<FollowView, string> = {
    followings: p.emptyFollowings,
    followers: p.emptyFollowers,
    blocked: p.emptyBlocked,
  };

  const vars: CSSProperties = {
    ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
    ['--appza-sheet-radius' as string]: p.sheetRadius,
    ['--appza-tab-track-color' as string]: p.tabTrackColor,
    ['--appza-tab-active-bg-color' as string]: p.tabActiveBgColor,
    ['--appza-tab-active-color' as string]: p.tabActiveColor,
    ['--appza-tab-color' as string]: p.tabColor,
    ['--appza-tab-size' as string]: p.tabSize,
    ['--appza-name-color' as string]: p.nameColor,
    ['--appza-name-size' as string]: p.nameSize,
    ['--appza-handle-color' as string]: p.handleColor,
    ['--appza-handle-size' as string]: p.handleSize,
    ['--appza-avatar-size' as string]: p.avatarSize,
    ['--appza-empty-color' as string]: p.emptyColor,
    ['--appza-empty-size' as string]: p.emptySize,
    ['--appza-unblock-color' as string]: p.unblockColor,
    ['--appza-unblock-border-color' as string]: p.unblockBorderColor,
    ['--appza-unblock-radius' as string]: p.unblockRadius,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tabs.find((t) => t.value === view)?.label ?? ''}
      className="appza-follow-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeFollowSheet();
      }}
    >
      <div className="appza-follow-sheet" style={vars} {...appzetAttrs(appzetSlug)}>
        <div className="appza-follow-sheet-grabber" />

        <div className="appza-follow-sheet-tabs" style={cs[0]} {...childAttrs(appzetSlug, 0, 'ion-list')}>
          {tabs.map((t, i) => (
            <button
              type="button"
              key={t.value}
              className={
                'appza-follow-sheet-tab' + (t.value === view ? ' is-active' : '')
              }
              style={cs[i + 1]}
              {...childAttrs(appzetSlug, i + 1, 'ion-button')}
              onClick={() => {
                setView(t.value);
                setProfileControls({ follow_view: t.value });
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="appza-follow-sheet-list">
          {rows.length === 0 && !state.loading ? (
            <div
              className="appza-follow-sheet-empty"
              style={cs[4]}
              {...childAttrs(appzetSlug, 4, 'ion-text')}
            >
              {emptyFor[view]}
            </div>
          ) : (
            rows.map((row, i) => {
              const name = str(row.display_name);
              // `username_at` is composed by the proxy for all three
              // lists; the prefix is only a fallback for a payload that
              // predates it.
              const handle = str(row.username_at)
                || (str(row.username) ? p.usernamePrefix + str(row.username) : '');
              const avatar = str(row.avatar);
              const first = i === 0;
              return (
                <div className="appza-follow-sheet-row" key={String(row.user_id ?? i)}>
                  <span
                    className="appza-follow-sheet-avatar"
                    style={cs[5]}
                    {...(first ? childAttrs(appzetSlug, 5, 'ion-avatar') : {})}
                    onClick={() => detail.onOpenProfile?.(row)}
                  >
                    {avatar ? (
                      <img src={avatar} alt={name} loading="lazy" />
                    ) : (
                      <span className="appza-follow-sheet-avatar-fallback">{initialsOf(name)}</span>
                    )}
                  </span>
                  <span
                    className="appza-follow-sheet-person"
                    onClick={() => detail.onOpenProfile?.(row)}
                  >
                    <span
                      className="appza-follow-sheet-name"
                      style={cs[6]}
                      {...(first ? childAttrs(appzetSlug, 6, 'ion-text') : {})}
                    >
                      {name}
                    </span>
                    <span className="appza-follow-sheet-handle">{handle}</span>
                  </span>
                  {view === 'blocked' ? (
                    <button
                      type="button"
                      className="appza-follow-sheet-unblock"
                      style={cs[7]}
                      {...(first ? childAttrs(appzetSlug, 7, 'ion-button') : {})}
                      onClick={() => detail.onUnblock?.(row)}
                    >
                      {p.unblockLabel}
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

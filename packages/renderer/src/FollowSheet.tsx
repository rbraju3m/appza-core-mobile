import { useEffect, useState, type CSSProperties } from 'react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { useDataSource } from './dataFetch';
import { getProfileControls, setProfileControls } from './profileControls';
import { useBackDismiss } from './backStack';

// Fetches by DataSource slug so rows arrive enriched (FC returns a Follow pivot with the person one level down).

export const FOLLOW_SHEET_APPZET_SLUG = 'fc-follow-sheet';

// Must match the `children` array of the fc-follow-sheet superstructure.
export const FOLLOW_SHEET_CHILD_COUNT = 8;

export type FollowView = 'followings' | 'followers' | 'blocked';

export type FollowSheetPresentation = {
  followingsLabel: string;
  followersLabel: string;
  blockedLabel: string;
  unblockLabel: string;
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
  memberId: number | null;
  view: FollowView;
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

  // Hooks stay unconditional: an undefined slug is the closed state and fetches nothing.
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
              // The prefix is only a fallback for a payload without `username_at`.
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

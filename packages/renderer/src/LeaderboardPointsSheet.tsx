import { useEffect, useState, type CSSProperties } from 'react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { useBackDismiss } from './backStack';

// Opened by event, fetches its own levels; child indices below MUST match the fc-leaderboard-points-sheet `children` array.

export const LEADERBOARD_POINTS_SHEET_APPZET_SLUG = 'fc-leaderboard-points-sheet';
export const LEADERBOARD_POINTS_SHEET_CHILD_COUNT = 7;

export type LeaderboardPointsPresentation = {
  title: string;
  pointsHeading: string;
  pointsBody: string;
  levelsHeading: string;
  levelsBody: string;
  emptyLabel: string;
  hidden: boolean;
  showHandle: boolean;
  showLevelsList: boolean;
  sheetBgColor?: string;
  sheetRadius?: string;
  sheetMaxHeight?: string;
  handleColor?: string;
  titleColor?: string;
  titleSize?: string;
  headingColor?: string;
  headingSize?: string;
  bodyColor?: string;
  bodySize?: string;
  levelTitleColor?: string;
  levelTitleSize?: string;
  levelPointsColor?: string;
  levelPointsSize?: string;
  dividerColor?: string;
  rowPadding?: string;
};

export type LeaderboardLevel = {
  slug?: string;
  level?: number;
  title?: string;
  // Worded and translated by the plug-in; the app must not re-format it.
  points_label?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: LeaderboardPointsPresentation;
  levelsEndpoint: string;
  authHeader?: string;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-leaderboard-points-sheet';
const CLOSE_EVENT = 'appza:close-leaderboard-points-sheet';

export function openLeaderboardPointsSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeLeaderboardPointsSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function LeaderboardPointsSheet() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [levels, setLevels] = useState<LeaderboardLevel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setLevels([]);
    };
    const onClose = () => setDetail(null);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  const levelsEndpoint = detail?.levelsEndpoint;
  const authHeader = detail?.authHeader;

  useEffect(() => {
    if (!levelsEndpoint) return;
    let cancelled = false;
    setLoading(true);
    const url = `${levelsEndpoint}${levelsEndpoint.includes('?') ? '&' : '?'}scope=all`;
    void (async () => {
      try {
        const res = await fetch(url, {
          credentials: 'omit',
          headers: authHeader
            ? { Accept: 'application/json', Authorization: authHeader }
            : { Accept: 'application/json' },
        });
        const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const rows =
          (Array.isArray(json?.data) && json?.data) ||
          (Array.isArray(json?.items) && json?.items) ||
          [];
        if (!cancelled) setLevels(rows as LeaderboardLevel[]);
      } catch {
        if (!cancelled) setLevels([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [levelsEndpoint, authHeader]);

  useBackDismiss(!(!detail || detail.presentation.hidden), () => setDetail(null));

  if (!detail || detail.presentation.hidden) return null;

  const p = detail.presentation;
  const slug = detail.appzetSlug ?? LEADERBOARD_POINTS_SHEET_APPZET_SLUG;
  const cs = detail.childStyles ?? {};

  const vars: CSSProperties = {
    ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
    ['--appza-sheet-radius' as string]: p.sheetRadius,
    ['--appza-sheet-max-height' as string]: p.sheetMaxHeight,
    ['--appza-handle-color' as string]: p.handleColor,
    ['--appza-title-color' as string]: p.titleColor,
    ['--appza-title-size' as string]: p.titleSize,
    ['--appza-heading-color' as string]: p.headingColor,
    ['--appza-heading-size' as string]: p.headingSize,
    ['--appza-body-color' as string]: p.bodyColor,
    ['--appza-body-size' as string]: p.bodySize,
    ['--appza-level-title-color' as string]: p.levelTitleColor,
    ['--appza-level-title-size' as string]: p.levelTitleSize,
    ['--appza-level-points-color' as string]: p.levelPointsColor,
    ['--appza-level-points-size' as string]: p.levelPointsSize,
    ['--appza-divider-color' as string]: p.dividerColor,
    ['--appza-row-padding' as string]: p.rowPadding,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      className="appza-lb-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLeaderboardPointsSheet();
      }}
    >
      <div className="appza-lb-sheet" style={vars} {...appzetAttrs(slug)}>
        {p.showHandle && <div className="appza-lb-sheet-grabber" />}

        <div className="appza-lb-sheet-scroll">
          <div className="appza-lb-sheet-title" style={cs[0]} {...childAttrs(slug, 0, 'ion-text')}>
            {p.title}
          </div>
          <div
            className="appza-lb-sheet-heading"
            style={cs[1]}
            {...childAttrs(slug, 1, 'ion-text')}
          >
            {p.pointsHeading}
          </div>
          <div className="appza-lb-sheet-body" style={cs[2]} {...childAttrs(slug, 2, 'ion-text')}>
            {p.pointsBody}
          </div>
          <div
            className="appza-lb-sheet-heading"
            style={cs[3]}
            {...childAttrs(slug, 3, 'ion-text')}
          >
            {p.levelsHeading}
          </div>
          <div className="appza-lb-sheet-body" style={cs[4]} {...childAttrs(slug, 4, 'ion-text')}>
            {p.levelsBody}
          </div>

          {p.showLevelsList && (
            <div className="appza-lb-sheet-levels">
              {levels.map((l, i) => (
                <div className="appza-lb-sheet-level" key={l.slug ?? `${l.level ?? i}`}>
                  <span
                    className="appza-lb-sheet-level-title"
                    style={cs[5]}
                    {...(i === 0 ? childAttrs(slug, 5, 'ion-text') : {})}
                  >
                    {l.title ?? ''}
                  </span>
                  <span
                    className="appza-lb-sheet-level-points"
                    style={cs[6]}
                    {...(i === 0 ? childAttrs(slug, 6, 'ion-text') : {})}
                  >
                    {l.points_label ?? ''}
                  </span>
                </div>
              ))}
              {!loading && levels.length === 0 && (
                <div className="appza-lb-sheet-empty">{p.emptyLabel}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

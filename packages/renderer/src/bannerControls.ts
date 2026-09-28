import { useEffect, useState } from 'react';
import { getViewer } from './viewer';

// Only dismissedUntil persists; the two overflow verdicts have separate writers so neither clobbers the other.

export type BannerControls = {
  expanded: boolean;
  descriptionOverflows: boolean;
  hasExtraCtas: boolean;
  dismissedUntil: number;
};

const EVENT = 'appza:banner-controls-change';

// Matches FluentCommunity's web 7-day dismissal.
export const DEFAULT_DISMISS_DAYS = 7;

const DEFAULTS: BannerControls = {
  expanded: false,
  descriptionOverflows: false,
  hasExtraCtas: false,
  dismissedUntil: 0,
};

// Guest vs signed-in buckets like FC's; read at call time because the viewer changes on sign-in.
function storageKey(): string {
  return getViewer().is_logged_in
    ? 'appza.bannerControls.auth'
    : 'appza.bannerControls.guest';
}

function readDismissedUntil(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { dismissedUntil?: unknown };
    const until = typeof parsed.dismissedUntil === 'number' ? parsed.dismissedUntil : 0;
    // Compared here so a banner can't reappear on one screen and stay hidden on another.
    return until > Date.now() ? until : 0;
  } catch {
    return 0;
  }
}

let current: BannerControls = { ...DEFAULTS, dismissedUntil: readDismissedUntil() };

export function getBannerControls(): BannerControls {
  return current;
}

export function setBannerControls(patch: Partial<BannerControls>): void {
  const next: BannerControls = {
    expanded: patch.expanded ?? current.expanded,
    descriptionOverflows: patch.descriptionOverflows ?? current.descriptionOverflows,
    hasExtraCtas: patch.hasExtraCtas ?? current.hasExtraCtas,
    dismissedUntil: patch.dismissedUntil ?? current.dismissedUntil,
  };
  if (
    next.expanded === current.expanded &&
    next.descriptionOverflows === current.descriptionOverflows &&
    next.hasExtraCtas === current.hasExtraCtas &&
    next.dismissedUntil === current.dismissedUntil
  ) {
    return;
  }
  const dismissalChanged = next.dismissedUntil !== current.dismissedUntil;
  current = next;
  if (typeof window !== 'undefined') {
    if (dismissalChanged) {
      try {
        window.localStorage.setItem(
          storageKey(),
          JSON.stringify({ dismissedUntil: next.dismissedUntil }),
        );
      } catch {
        // best-effort
      }
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function dismissBanner(days: number = DEFAULT_DISMISS_DAYS): void {
  const span = Number.isFinite(days) && days > 0 ? days : DEFAULT_DISMISS_DAYS;
  setBannerControls({ dismissedUntil: Date.now() + span * 24 * 60 * 60 * 1000 });
}

export function refreshBannerDismissal(): void {
  const until = readDismissedUntil();
  if (until === current.dismissedUntil) return;
  current = { ...current, dismissedUntil: until };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

// Strings, not booleans: catalog clauses compare against 'yes' / 'no'.
export function bannerStateEntries(state: BannerControls): Record<string, unknown> {
  return {
    'feed_banner.expanded': state.expanded ? 'yes' : 'no',
    'feed_banner.collapsible':
      state.descriptionOverflows || state.hasExtraCtas ? 'yes' : 'no',
    'feed_banner.dismissed': state.dismissedUntil > Date.now() ? 'yes' : 'no',
  };
}

export function useBannerControls(): BannerControls {
  const [state, setState] = useState<BannerControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    // The dismissal is per viewer bucket, so re-read on sign-in.
    const onViewer = () => refreshBannerDismissal();
    window.addEventListener('appza:viewer-change', onViewer);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('appza:viewer-change', onViewer);
    };
  }, []);
  return state;
}

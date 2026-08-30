import { useEffect, useState } from 'react';
import { getViewer } from './viewer';

// Feed-banner controls — whether the hero banner is expanded, whether it
// CAN be expanded, and whether this viewer has dismissed it.
//
// Same event-backed store as feedControls, and here for the same reason:
// the write side (action dispatchers in the App) and the read side (the
// renderer's per-child visible_when evaluator) sit in different package
// boundaries.
//
// Four keys, and only one of them persists:
//
//   expanded     session-only. Designs 14 and 15 are the same banner
//                collapsed and open; a fresh feed draws the collapsed
//                one, so remembering the choice across launches would
//                make design 14 unreachable after a single tap.
//   descriptionOverflows / hasExtraCtas
//                PUBLISHED by the renderer, not stored. "Show the toggle
//                when the description is long OR there are more than 2
//                buttons" — the first half is a measurement no clause
//                grammar can express, and a character threshold in the
//                proxy would be a guess that breaks at a different font
//                size. They are two keys rather than one `collapsible`
//                because they have two different writers: the rich-text
//                primitive measures the paragraph, the placement counts
//                the buttons, and a single key would let whichever
//                rendered last clobber the other's verdict.
//   dismissedUntil  persists. FluentCommunity's own web dismissal writes
//                a 7-day expiry to localStorage (assets/app.js: 6048e5 ms
//                under fcom_welcome_banner_closed_auth / _guest), and a
//                banner that came back on the next launch would read as
//                the × not working.

export type BannerControls = {
  expanded: boolean;
  /** The clamped description is taller than its clamp. Measured, not derived. */
  descriptionOverflows: boolean;
  /** The API sent more than two CTA buttons. */
  hasExtraCtas: boolean;
  /** Epoch ms the dismissal expires at. 0 = not dismissed. */
  dismissedUntil: number;
};

const EVENT = 'appza:banner-controls-change';

/** Default dismissal window, in days. Matches FluentCommunity's web. */
export const DEFAULT_DISMISS_DAYS = 7;

const DEFAULTS: BannerControls = {
  expanded: false,
  descriptionOverflows: false,
  hasExtraCtas: false,
  dismissedUntil: 0,
};

/**
 * Storage key, scoped the way FluentCommunity scopes its own: one bucket
 * for anyone signed in, one for guests. Not per-user-id — a shared device
 * is exactly the case where the guest bucket must not inherit a member's
 * dismissal, and the reverse (two members on one device sharing it) is
 * what FC already accepts.
 *
 * Read at call time rather than captured: the viewer changes underneath
 * this module on sign-in, and a key captured at import would keep writing
 * to the guest bucket for the rest of the session.
 */
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
    // An expired dismissal is the same as none. Compared here rather than
    // at read sites so a banner cannot come back mid-session on one
    // screen and stay hidden on another.
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
    // Only the dismissal is worth a write. The two verdicts are
    // republished on every measure pass, and persisting them would mean a
    // storage write per banner render.
    if (dismissalChanged) {
      try {
        window.localStorage.setItem(
          storageKey(),
          JSON.stringify({ dismissedUntil: next.dismissedUntil }),
        );
      } catch {
        // Storage full / private mode — best-effort; the in-memory
        // `current` still hides the banner for this session.
      }
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/** Dismiss for `days` days. Called by the `banner.dismiss` dispatcher. */
export function dismissBanner(days: number = DEFAULT_DISMISS_DAYS): void {
  const span = Number.isFinite(days) && days > 0 ? days : DEFAULT_DISMISS_DAYS;
  setBannerControls({ dismissedUntil: Date.now() + span * 24 * 60 * 60 * 1000 });
}

/**
 * Re-read the persisted dismissal for the CURRENT viewer.
 *
 * Signing in swaps which bucket `storageKey()` points at, and the
 * in-memory value is still the previous viewer's. Called from the viewer
 * subscription so a member does not inherit a guest's dismissal.
 */
export function refreshBannerDismissal(): void {
  const until = readDismissedUntil();
  if (until === current.dismissedUntil) return;
  current = { ...current, dismissedUntil: until };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

/**
 * The `state.feed_banner.*` entries both bags expose — the placement-level
 * one in ScreenRenderer and the per-child one in PlacementRenderer.
 *
 * Strings, not booleans: every clause the catalog writes for these
 * compares against 'yes' / 'no', the way the post-draft gates already do.
 * Built here rather than spelled out at each call site so the two bags
 * cannot describe the same fact differently.
 */
export function bannerStateEntries(state: BannerControls): Record<string, unknown> {
  return {
    'feed_banner.expanded': state.expanded ? 'yes' : 'no',
    // The OR the designs describe, joined HERE rather than at either
    // writer, so neither has to know the other exists.
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
    // The persisted dismissal belongs to whoever is signed in, so the
    // bucket has to be re-read when that changes.
    const onViewer = () => refreshBannerDismissal();
    window.addEventListener('appza:viewer-change', onViewer);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('appza:viewer-change', onViewer);
    };
  }, []);
  return state;
}

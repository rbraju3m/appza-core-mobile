import { useEffect, useState } from 'react';

// Moderation screen controls — which of the four tabs is showing (doc
// states 7, 15, 24, 29).
//
// Same event-backed shape as memberDirectoryControls. The one authored key
// is bound as fc-moderation-reports' `status` query param, so a tab tap is
// a refetch: FluentCommunity filters reports by status server-side.

// FluentCommunity's own four values — the ones its portal Moderation page
// sends. `ignored` is the tab both it and Noor's designs call Dismissed.
export type ModerationStatus = 'pending' | 'flagged' | 'ignored' | 'unpublished';

export type ModerationControls = {
  status: ModerationStatus;
};

const EVENT = 'appza:moderation-controls-change';

const DEFAULTS: ModerationControls = {
  status: 'pending',
};

export function isModerationStatus(v: unknown): v is ModerationStatus {
  return v === 'pending' || v === 'flagged' || v === 'ignored' || v === 'unpublished';
}

// Not persisted: every visit opens on Pending (design 7), so there is
// nothing worth remembering between them.
let current: ModerationControls = DEFAULTS;

export function getModerationControls(): ModerationControls {
  return current;
}

export function setModerationControls(patch: Partial<ModerationControls>): void {
  const next: ModerationControls = {
    status: isModerationStatus(patch.status) ? patch.status : current.status,
  };
  if (next.status === current.status) return;
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/** The landing state, called by the shells when the screen becomes active. */
export function resetModerationControls(): void {
  setModerationControls({ status: DEFAULTS.status });
}

/** The `state.moderation_controls.*` entries a gate or query param reads. */
export function moderationStateEntries(state: ModerationControls): Record<string, unknown> {
  return {
    'moderation_controls.status': state.status,
  };
}

export function useModerationControls(): ModerationControls {
  const [state, setState] = useState<ModerationControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    // Re-read on subscribe: a reset may have landed between the useState
    // initialiser and this effect.
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

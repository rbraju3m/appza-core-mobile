import { useEffect, useState } from 'react';

// FluentCommunity's own values; `ignored` is the tab labelled Dismissed.
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

export function resetModerationControls(): void {
  setModerationControls({ status: DEFAULTS.status });
}

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
    // Re-read: a reset may have landed between useState and this effect.
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

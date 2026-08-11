import { useEffect, useState } from 'react';

// FluentCommunity runtime settings surfaced by the WP portal's
// customization panel (Settings → Customization). The bootstrap
// controller reads FluentCommunity's own `customization_settings`
// option and ships the fields we honor as `runtime_config.fluent_community`.
// The mobile shell (App.tsx) hydrates this store once the envelope
// lands; PlacementRenderer subscribes so fc-member-card can flip
// between grid and list layouts.
//
// Values mirror FluentCommunity's own strings verbatim — `classic`
// is the list layout in FC vocabulary; `grid` is the tile grid.

export type FcMemberListLayout = 'classic' | 'grid';

export type FcRuntimeSettings = {
  member_list_layout: FcMemberListLayout;
};

const EVENT = 'appza:fc-runtime-settings-change';

const DEFAULTS: FcRuntimeSettings = {
  member_list_layout: 'classic',
};

let current: FcRuntimeSettings = DEFAULTS;

export function getFcRuntimeSettings(): FcRuntimeSettings {
  return current;
}

export function setFcRuntimeSettings(patch: Partial<FcRuntimeSettings>): void {
  const nextLayout =
    patch.member_list_layout === 'classic' || patch.member_list_layout === 'grid'
      ? patch.member_list_layout
      : current.member_list_layout;
  const next: FcRuntimeSettings = { member_list_layout: nextLayout };
  if (next.member_list_layout === current.member_list_layout) return;
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function useFcRuntimeSettings(): FcRuntimeSettings {
  const [state, setState] = useState<FcRuntimeSettings>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

import type { ActionInvocation } from './actionContext';
import { setModerationControls, isModerationStatus } from './moderationControls';

/**
 * The Moderation screen's actions (doc states 7–32).
 *
 * Shared between the Capacitor shell and the WP-admin simulator, as every
 * handler in this package is: two dispatchers implementing one action
 * drift, and only one of them is ever the one photographed.
 */

const HANDLED = new Set(['moderation.set_tab']);

/** Returns true when the action was one of these and has been handled. */
export function tryHandleModerationAction(inv: ActionInvocation): boolean {
  const { action_slug, args, item } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const itemRec = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
  // The tapped tab's value arrives on the args from some primitives and on
  // the item from others.
  const runtimeValue =
    typeof argRec.value === 'string'
      ? argRec.value
      : itemRec && typeof itemRec.value === 'string'
        ? itemRec.value
        : null;

  switch (action_slug) {
    case 'moderation.set_tab': {
      // A closed set: this value is sent to FluentCommunity as `status`.
      if (isModerationStatus(runtimeValue)) setModerationControls({ status: runtimeValue });
      return true;
    }
  }
  return false;
}

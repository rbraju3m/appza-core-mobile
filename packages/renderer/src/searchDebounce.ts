// Debounce for search-as-you-type.
//
// Every search field in the app is wired the same way: the ion-input
// dispatches on `onIonInput` — once per character, by design, because
// `onIonChange` only fires on blur and search-as-you-type would feel
// dead until you tapped away — and the shell's dispatcher writes the
// text straight into a control slice. A DataSource query_param binds to
// that slice, so each write is a REFETCH, not a filter over rows already
// in hand.
//
// The consequence measured on the real mobile bundle (2026-08-20):
// typing six letters into Saved Posts fired six requests, one per
// keystroke. On a phone over mobile data that is the difference between
// one round trip and one per letter, and the answers race: nothing
// guarantees the reply for "zzzqq" lands before the reply for "zzzq".
//
// Three of the four search fields are wired this way — bookmarks, space
// documents and the Search screen, all of which bind `search` as a
// DataSource query_param. The SPACES search is deliberately absent from
// this module: it filters client-side in PlacementRenderer over rows
// already in hand, so there is no request to save and a debounce would
// only make a local filter feel slow. If another field is added,
// debounce it only if a DataSource binds it (P97).
//
// The Search screen channel carries one extra job the other two do not:
// the settled write is also when a term is REMEMBERED. Recording per
// keystroke would fill the recent list with every prefix of every word,
// so `recordRecentSearch` hangs off the debounce landing, not the
// dispatch. A recent ROW, by contrast, hands over a whole term at once
// and bypasses this module entirely — there is nothing to wait for.
//
// This module sits between the dispatcher and the slice write. The
// keystrokes still arrive one at a time; only the WRITE is delayed, so
// the field itself stays as responsive as it ever was (Ionic holds the
// text, not us).

/** How long the field must be quiet before the write lands. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Identifies a debounce channel. One per SERVER-BACKED search field, so
 * typing in space documents cannot cancel a pending bookmarks write.
 */
export type SearchDebounceKey = 'bookmarks' | 'documents' | 'search' | 'follow' | 'members' | 'courses' | 'course_students' | 'course_add_student';

type Pending = {
  timer: ReturnType<typeof setTimeout>;
  apply: (value: string) => void;
  value: string;
};

const pending = new Map<SearchDebounceKey, Pending>();

function clear(key: SearchDebounceKey): Pending | undefined {
  const p = pending.get(key);
  if (p) {
    clearTimeout(p.timer);
    pending.delete(key);
  }
  return p;
}

/**
 * Write `value` into a control slice once the user stops typing.
 *
 * Clearing the field is applied IMMEDIATELY rather than debounced. Two
 * reasons: tapping Ionic's ⨯ is a discrete act, not typing, and waiting
 * 300ms to show the full list back reads as a stuck button. And it must
 * also CANCEL whatever was pending — otherwise the last keystroke before
 * the clear lands afterwards and refills a search the user just emptied.
 */
export function debounceSearch(
  key: SearchDebounceKey,
  value: string,
  apply: (value: string) => void,
): void {
  clear(key);

  if (value === '') {
    apply('');
    return;
  }

  const timer = setTimeout(() => {
    pending.delete(key);
    apply(value);
  }, SEARCH_DEBOUNCE_MS);

  pending.set(key, { timer, apply, value });
}

/**
 * Drop a pending write without performing it.
 *
 * Called when the active screen changes. A timer armed on the way out
 * would otherwise fire against a screen nobody is looking at — and worse,
 * for Saved Posts it would land AFTER `resetBookmarkControls()` and put
 * the abandoned search string back, so reopening the screen would show
 * "No matches" over a list that is not empty.
 *
 * With no key, drops every channel.
 */
export function cancelDebouncedSearch(key?: SearchDebounceKey): void {
  if (key) {
    clear(key);
    return;
  }
  pending.forEach((p) => clearTimeout(p.timer));
  pending.clear();
}

/**
 * Perform a pending write NOW instead of waiting out the interval.
 *
 * Nothing calls this yet. It exists for the submit-on-enter case: if a
 * search field ever grows a keyboard "search" key, that key must not
 * have to wait 300ms behind the character that triggered it.
 */
export function flushDebouncedSearch(key: SearchDebounceKey): void {
  const p = clear(key);
  if (p) p.apply(p.value);
}

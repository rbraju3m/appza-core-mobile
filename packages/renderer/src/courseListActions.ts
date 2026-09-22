import { readDataPath } from './dataFetch';
import type { ActionInvocation } from './actionContext';
import { debounceSearch } from './searchDebounce';
import { getCourseListControls, setCourseListControls } from './courseListControls';
import { openOptionsSheet, OPTIONS_SHEET_CHILD_COUNT } from './OptionsSheet';
import { readPickerOptions } from './ViewModePopover';
import { childStylesFromCustomizations, optionsSheetPresentation } from './modalPresentation';

/**
 * The Courses screen's list controls (Courses doc, states 1–4) — the tab
 * strip, the search field, the topic chips and the sort sheet.
 *
 * Shared between the Capacitor shell and the WP-admin simulator, like
 * every handler in this package: two dispatchers implementing one action
 * drift, and only one of them is ever the one photographed.
 */

export type CourseListActionDeps = {
  onError: (msg: string) => void;
  /** The shell's catalog lookup for an overlay AppZet's authored props. */
  readAppzetProps: (slug: string) => Record<string, unknown>;
  /** The right panel's live edits, for the sheet's per-child styles. */
  customizations: unknown;
};

const HANDLED = new Set(['courses.set_tab', 'courses.set_search', 'courses.set_topic', 'courses.set_sort']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** Returns true when the action was one of these and has been handled. */
export function tryHandleCourseListAction(inv: ActionInvocation, deps: CourseListActionDeps): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? (readDataPath(item, binding_root) ?? item) : item;
  const itemRec =
    effectiveItem && typeof effectiveItem === 'object'
      ? (effectiveItem as Record<string, unknown>)
      : null;
  // The typed text, the tapped tab or chip — on the args from some
  // primitives, on the item from others.
  const runtimeValue =
    typeof argRec.value === 'string'
      ? argRec.value
      : itemRec && typeof itemRec.value === 'string'
        ? itemRec.value
        : null;

  switch (action_slug) {
    case 'courses.set_tab': {
      if (runtimeValue === 'all' || runtimeValue === 'my') setCourseListControls({ tab: runtimeValue });
      return true;
    }

    case 'courses.set_search': {
      // Every keystroke, including the ⨯ clear, which brings the full
      // list back (state 2). One request when the typing stops.
      debounceSearch('courses', runtimeValue ?? '', (search) => setCourseListControls({ search }));
      return true;
    }

    case 'courses.set_topic': {
      // The synthetic All chip carries '' — no topic filter.
      setCourseListControls({ topic_slug: runtimeValue ?? '' });
      return true;
    }

    case 'courses.set_sort': {
      const options = readPickerOptions(argRec.options);
      if (options.length === 0) {
        deps.onError('This control has no options wired.');
        return true;
      }
      const sheetSlug = str(argRec.sheet_appzet_slug) ?? 'fc-courses-sort-sheet';
      openOptionsSheet({
        appzetSlug: sheetSlug,
        presentation: optionsSheetPresentation(deps.readAppzetProps(sheetSlug)),
        childStyles: childStylesFromCustomizations(sheetSlug, OPTIONS_SHEET_CHILD_COUNT, deps.customizations),
        options,
        stateKey: 'course_list_sort',
        currentValue: getCourseListControls().sort_by,
      });
      return true;
    }
  }

  return false;
}

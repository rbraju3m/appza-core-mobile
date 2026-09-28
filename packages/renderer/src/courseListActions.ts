import { readDataPath } from './dataFetch';
import type { ActionInvocation } from './actionContext';
import { debounceSearch } from './searchDebounce';
import { getCourseListControls, setCourseListControls } from './courseListControls';
import { openOptionsSheet, OPTIONS_SHEET_CHILD_COUNT } from './OptionsSheet';
import { readPickerOptions } from './ViewModePopover';
import { childStylesFromCustomizations, optionsSheetPresentation } from './modalPresentation';

export type CourseListActionDeps = {
  onError: (msg: string) => void;
  readAppzetProps: (slug: string) => Record<string, unknown>;
  customizations: unknown;
};

const HANDLED = new Set(['courses.set_tab', 'courses.set_search', 'courses.set_topic', 'courses.set_sort']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function tryHandleCourseListAction(inv: ActionInvocation, deps: CourseListActionDeps): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? (readDataPath(item, binding_root) ?? item) : item;
  const itemRec =
    effectiveItem && typeof effectiveItem === 'object'
      ? (effectiveItem as Record<string, unknown>)
      : null;
  // A runtime value arrives on args from some primitives and on the item from others.
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
      debounceSearch('courses', runtimeValue ?? '', (search) => setCourseListControls({ search }));
      return true;
    }

    case 'courses.set_topic': {
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

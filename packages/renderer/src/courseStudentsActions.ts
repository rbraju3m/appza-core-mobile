import type { ActionInvocation } from './actionContext';
import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { debounceSearch } from './searchDebounce';
import { getCourseStudentsControls, setCourseStudentsControls } from './courseStudentsControls';
import { openOptionsSheet, OPTIONS_SHEET_CHILD_COUNT } from './OptionsSheet';
import { readPickerOptions } from './ViewModePopover';
import { childStylesFromCustomizations, optionsSheetPresentation } from './modalPresentation';
import { closeMemberRemoveConfirm, openMemberRemoveConfirm } from './MemberRemoveConfirm';
import {
  openCourseAddStudentSheet,
  COURSE_ADD_STUDENT_SHEET_CHILD_COUNT,
  type CourseAddStudentPresentation,
} from './CourseAddStudentSheet';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';

/**
 * A course's Students page (Courses doc, states 8–15): the search, the
 * sort sheet, the Add Student sheet with its confirm, and Remove with its
 * confirm.
 *
 * Both writes are fcom-mobile's wrappers of the calls FluentCommunity's
 * portal makes — POST admin/courses/{id}/students {user_id} and DELETE
 * admin/courses/{id}/students/{user_id}. Every word the dialogs and toasts
 * say travels on the action's args (`{name}`, `{course}` filled here), so
 * the right panel owns them.
 *
 * Shared between the Capacitor shell and the WP-admin simulator.
 */

export type CourseStudentsActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  /** The shell's catalog lookup for an overlay AppZet's authored props. */
  readAppzetProps: (slug: string) => Record<string, unknown>;
  /** The right panel's live edits, for an overlay's per-child styles. */
  customizations: unknown;
};

const HANDLED = new Set([
  'course_students.set_search',
  'course_students.set_sort',
  'course_students.open_add',
  'course.add_student',
  'course.remove_student_confirm',
  'course.remove_student',
]);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fill(template: string, name: string, course = ''): string {
  return template.split('{name}').join(name).split('{course}').join(course);
}

function refresh(): void {
  if (typeof window === 'undefined') return;
  const g = window as unknown as { __appzaForceRefreshUntil?: number };
  g.__appzaForceRefreshUntil = Date.now() + 3000;
  window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
}

function addStudentPresentation(props: Record<string, unknown>): CourseAddStudentPresentation {
  const s = (k: string, d = '') => (typeof props[k] === 'string' ? (props[k] as string) : d);
  return {
    title: s('title', 'Add Student'),
    placeholder: s('placeholder', 'Search students...'),
    emptyLabel: s('empty_label', 'No users found'),
    searchIcon: s('search_icon', 'search-outline'),
    clearIcon: s('clear_icon', 'close'),
    hidden: props.hidden === true,
    sheetBgColor: s('sheet_bg_color') || undefined,
    sheetRadius: s('sheet_radius') || undefined,
    backdropColor: s('backdrop_color') || undefined,
    titleColor: s('title_color') || undefined,
    eyebrowColor: s('eyebrow_color') || undefined,
    fieldBgColor: s('field_bg_color') || undefined,
    nameColor: s('name_color') || undefined,
    emailColor: s('email_color') || undefined,
  };
}

/** Returns true when the action was one of these and has been handled. */
export function tryHandleCourseStudentsAction(inv: ActionInvocation, deps: CourseStudentsActionDeps): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? (readDataPath(item, binding_root) ?? item) : item;
  const itemRec =
    effectiveItem && typeof effectiveItem === 'object' ? (effectiveItem as Record<string, unknown>) : null;

  switch (action_slug) {
    case 'course_students.set_search': {
      const value =
        typeof argRec.value === 'string' ? argRec.value : itemRec && typeof itemRec.value === 'string' ? itemRec.value : '';
      // Every keystroke, the ⨯ clear included (state 9) — one request when
      // the typing stops.
      debounceSearch('course_students', value, (search) => setCourseStudentsControls({ search }));
      return true;
    }

    case 'course_students.set_sort': {
      // "Sort members" (state 10): Sort by and Order, one sheet.
      const sortOptions = readPickerOptions(argRec.options);
      const orderOptions = readPickerOptions(argRec.order_options);
      if (sortOptions.length === 0) {
        deps.onError('This control has no options wired.');
        return true;
      }
      const sheetSlug = str(argRec.sheet_appzet_slug) ?? 'fc-course-students-sort-sheet';
      const current = getCourseStudentsControls();
      openOptionsSheet({
        appzetSlug: sheetSlug,
        presentation: optionsSheetPresentation(deps.readAppzetProps(sheetSlug)),
        childStyles: childStylesFromCustomizations(sheetSlug, OPTIONS_SHEET_CHILD_COUNT, deps.customizations),
        options: [],
        stateKey: 'course_students_sort_by',
        currentValue: current.sort_by,
        sections: [
          {
            title: str(argRec.sort_section_title),
            options: sortOptions,
            stateKey: 'course_students_sort_by',
            currentValue: current.sort_by,
          },
          ...(orderOptions.length > 0
            ? [
                {
                  title: str(argRec.order_section_title),
                  options: orderOptions,
                  stateKey: 'course_students_sort_dir' as const,
                  currentValue: current.sort_dir,
                },
              ]
            : []),
        ],
      });
      return true;
    }

    case 'course_students.open_add': {
      // The appbar's row is the course (fc-course-detail).
      const courseId = num(readDataPath(effectiveItem, str(argRec.course_id_path) ?? 'data.id'));
      const courseTitle = String(readDataPath(effectiveItem, str(argRec.course_title_path) ?? 'data.title') ?? '');
      if (courseId === null) {
        deps.onError('Could not identify the course.');
        return true;
      }
      const sheetSlug = str(argRec.sheet_appzet_slug) ?? 'fc-course-add-student-sheet';
      openCourseAddStudentSheet({
        appzetSlug: sheetSlug,
        presentation: addStudentPresentation(deps.readAppzetProps(sheetSlug)),
        childStyles: childStylesFromCustomizations(sheetSlug, COURSE_ADD_STUDENT_SHEET_CHILD_COUNT, deps.customizations),
        dataSourceSlug: str(argRec.users_data_source) ?? 'fc-course-other-users',
        courseId,
        eyebrow: courseTitle || undefined,
        // State 15: "Add <name> to this course?" — CANCEL and ADD.
        onPick: (user) => {
          openMemberRemoveConfirm({
            subject: str(argRec.confirm_title) ?? 'Add Student',
            message: fill(str(argRec.confirm_message) ?? 'Add {name} to this course?', user.display_name, courseTitle),
            cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
            confirmLabel: str(argRec.confirm_label) ?? 'ADD',
            busyLabel: str(argRec.busy_label) ?? 'ADDING…',
            actionsLayout: 'material',
            confirmTone: 'primary',
            item: { user_id: user.user_id, display_name: user.display_name, course_id: courseId, course_title: courseTitle },
            // Named in the catalog's args, or the snapshot walker never
            // ships the action to the phone.
            removeActionSlug: str(argRec.confirm_action_slug) ?? 'course.add_student',
          });
        },
      });
      return true;
    }

    case 'course.remove_student_confirm': {
      // State 12: "Remove <name> from this course?" — CANCEL and REMOVE.
      const name = String(readDataPath(effectiveItem, str(argRec.subject_path) ?? 'data.display_name') ?? '');
      openMemberRemoveConfirm({
        subject: str(argRec.confirm_title) ?? 'Remove student',
        message: fill(str(argRec.message) ?? 'Remove {name} from this course?', name || 'this student'),
        cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
        confirmLabel: str(argRec.confirm_label) ?? 'REMOVE',
        busyLabel: str(argRec.busy_label) ?? 'REMOVING…',
        actionsLayout: 'material',
        confirmTone: 'primary',
        item: effectiveItem,
        removeActionSlug: str(argRec.remove_action_slug) ?? 'course.remove_student',
      });
      return true;
    }

    case 'course.add_student':
    case 'course.remove_student': {
      const adding = action_slug === 'course.add_student';
      const endpoint = str(argRec.endpoint);
      const courseId = num(readDataPath(effectiveItem, 'data.course_id'));
      const userId = num(readDataPath(effectiveItem, 'data.user_id'));
      const name = String(readDataPath(effectiveItem, 'data.display_name') ?? '');
      const course = String(readDataPath(effectiveItem, 'data.course_title') ?? '');
      const failure = fill(
        str(argRec.error_message) ?? (adding ? "Couldn't add {name}. Try again." : "Couldn't remove {name}. Try again."),
        name,
        course,
      );
      if (!endpoint || courseId === null || userId === null) {
        deps.onError(failure);
        closeMemberRemoveConfirm();
        return true;
      }
      if (!deps.auth) {
        deps.onError('Please sign in.');
        closeMemberRemoveConfirm();
        return true;
      }
      void sendJson(endpoint, 'POST', { course_id: courseId, user_id: userId }, deps.auth, deps.authHeader)
        .then((result) => {
          if (!result.ok) {
            deps.onError(failure);
            return;
          }
          deps.onInfo(
            fill(
              str(argRec.toast_message) ?? (adding ? '{name} added to {course}' : '{name} removed from this course'),
              name,
              course,
            ),
          );
          refresh();
        })
        .finally(() => closeMemberRemoveConfirm());
      return true;
    }
  }

  return false;
}

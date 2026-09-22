import type { ActionInvocation } from './actionContext';
import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { setCourseLessonControls } from './courseLessonControls';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';

/**
 * The lesson screen (Courses doc, states 16–21) — opening a lesson, the
 * < > arrows, Complete Lesson / COMPLETED LESSON, and SUBMIT QUIZ.
 *
 * Shared between the Capacitor shell and the WP-admin simulator, like
 * every handler in this package.
 */

export type CourseLessonActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  /** The shell's own dispatcher — course.open_lesson ends in a nav.push. */
  dispatch: (inv: ActionInvocation) => void;
};

const HANDLED = new Set(['course.open_lesson', 'course_lesson.goto', 'course_lesson.complete', 'course_lesson.submit_quiz']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Refetch what is on screen past the preview cache (chunk 2's enroll rule). */
function refresh(): void {
  if (typeof window === 'undefined') return;
  const g = window as unknown as { __appzaForceRefreshUntil?: number };
  g.__appzaForceRefreshUntil = Date.now() + 3000;
  window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
}

/** Returns true when the action was one of these and has been handled. */
export function tryHandleCourseLessonAction(inv: ActionInvocation, deps: CourseLessonActionDeps): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? (readDataPath(item, binding_root) ?? item) : item;

  switch (action_slug) {
    // A lesson row, or START / CONTINUE / REVIEW on the details. The slug
    // is written first, then the screen opens WITHOUT carrying the item,
    // so route.slug stays the course's for the details behind it.
    case 'course.open_lesson': {
      const slug = readDataPath(effectiveItem, str(argRec.slug_path) ?? 'data.slug');
      setCourseLessonControls({ lesson_slug: typeof slug === 'string' ? slug : '' });
      deps.dispatch({
        action_slug: 'nav.push',
        args: { target_screen_slug: str(argRec.target_screen_slug) ?? 'course-lesson' },
      });
      return true;
    }

    // < and > — the same screen, another lesson. The header draws a
    // disabled arrow at either end; an empty slug does nothing.
    case 'course_lesson.goto': {
      const slug = readDataPath(effectiveItem, str(argRec.slug_path) ?? 'data.next_slug');
      if (typeof slug === 'string' && slug !== '') setCourseLessonControls({ lesson_slug: slug });
      return true;
    }

    // COMPLETE LESSON marks it done; COMPLETED LESSON undoes it (state 17).
    // FluentCommunity decides: "Please enroll this course first" and every
    // other refusal is its own sentence, toasted.
    case 'course_lesson.complete': {
      const endpoint = str(argRec.endpoint);
      const courseId = num(readDataPath(effectiveItem, str(argRec.course_id_path) ?? 'data.course_id'));
      const lessonId = num(readDataPath(effectiveItem, str(argRec.id_path) ?? 'data.id'));
      const state = str(argRec.state) === 'incomplete' ? 'incomplete' : 'completed';
      if (!endpoint || courseId === null || lessonId === null) {
        deps.onError('Could not identify which lesson to update.');
        return true;
      }
      if (!deps.auth) {
        deps.onError(str(argRec.guest_message) ?? 'Please enroll this course first');
        return true;
      }
      void sendJson(endpoint, 'PUT', { course_id: courseId, lesson_id: lessonId, state }, deps.auth, deps.authHeader).then(
        (result) => {
          if (!result.ok) {
            deps.onError(result.error);
            return;
          }
          // The button flips, and the details' progress behind it moves.
          refresh();
        },
      );
      return true;
    }

    // SUBMIT QUIZ (states 19–21). The quiz component puts the picks on the
    // item — { <question slug>: label | label[] }, FC Pro's own shape — and
    // FC grades, counts the attempt and decides passed / failed. The lesson
    // refetches and the card turns into FC's result.
    case 'course_lesson.submit_quiz': {
      const endpoint = str(argRec.endpoint);
      const courseId = num(readDataPath(effectiveItem, str(argRec.course_id_path) ?? 'data.course_id'));
      const lessonId = num(readDataPath(effectiveItem, str(argRec.id_path) ?? 'data.id'));
      const itemRec = effectiveItem && typeof effectiveItem === 'object' ? (effectiveItem as Record<string, unknown>) : null;
      const answers = itemRec && itemRec.answers && typeof itemRec.answers === 'object' ? itemRec.answers : null;
      if (!endpoint || courseId === null || lessonId === null || !answers) {
        deps.onError('Could not identify which quiz to submit.');
        return true;
      }
      if (!deps.auth) {
        deps.onError(str(argRec.guest_message) ?? 'You must be enrolled in this course to submit the quiz.');
        return true;
      }
      void sendJson(endpoint, 'POST', { course_id: courseId, lesson_id: lessonId, answers }, deps.auth, deps.authHeader).then(
        (result) => {
          if (!result.ok) {
            deps.onError(result.error);
            return;
          }
          refresh();
        },
      );
      return true;
    }
  }

  return false;
}

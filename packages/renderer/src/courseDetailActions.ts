import type { ActionInvocation } from './actionContext';
import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { toggleCourseSection } from './courseDetailControls';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';

/**
 * Course details (Courses doc, states 5–7) — the section accordion and the
 * ENROLL THIS COURSE button.
 *
 * Shared between the Capacitor shell and the WP-admin simulator, like
 * every handler in this package.
 */

export type CourseDetailActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
};

const HANDLED = new Set(['course_detail.toggle_section', 'course.enroll']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Returns true when the action was one of these and has been handled. */
export function tryHandleCourseDetailAction(inv: ActionInvocation, deps: CourseDetailActionDeps): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? (readDataPath(item, binding_root) ?? item) : item;

  switch (action_slug) {
    case 'course_detail.toggle_section': {
      // The section card's own row — its id is the section's.
      const id = num(readDataPath(effectiveItem, str(argRec.id_path) ?? 'data.id'));
      if (id !== null) toggleCourseSection(id);
      return true;
    }

    case 'course.enroll': {
      const courseId = num(readDataPath(effectiveItem, str(argRec.id_path) ?? 'data.id'));
      const endpoint = str(argRec.endpoint);
      if (!endpoint || courseId === null) {
        deps.onError('Could not identify which course to enroll in.');
        return true;
      }
      // A guest is offered the button too; fcom-mobile turns them away
      // with a generic 401 before FluentCommunity is asked, so the doc's
      // sentence — FC's own — is the catalog's to say (state 5).
      if (!deps.auth) {
        deps.onError(str(argRec.guest_message) ?? 'You need to login to enroll in this course.');
        return true;
      }
      void sendJson(endpoint, 'POST', { course_id: courseId }, deps.auth, deps.authHeader).then((result) => {
        if (!result.ok) {
          deps.onError(result.error);
          return;
        }
        // FC's own sentence — "You have been enrolled in this course." —
        // or the catalog's when the body carries none.
        const body = result.body as Record<string, unknown> | null;
        const response = body && typeof body.response === 'object' ? (body.response as Record<string, unknown>) : null;
        const serverMsg = response ? str(response.message) : undefined;
        deps.onInfo(serverMsg && serverMsg !== 'Success' ? serverMsg : str(argRec.toast_message) ?? 'You have been enrolled in this course.');
        // The button becomes START COURSE: the details refetch, past the
        // preview cache, and so does the list behind them.
        if (typeof window !== 'undefined') {
          const g = window as unknown as { __appzaForceRefreshUntil?: number };
          g.__appzaForceRefreshUntil = Date.now() + 3000;
          window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
        }
      });
      return true;
    }
  }

  return false;
}

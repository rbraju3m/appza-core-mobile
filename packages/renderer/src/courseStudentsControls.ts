import { useEffect, useState } from 'react';
import { cancelDebouncedSearch } from './searchDebounce';

// A course's Students page (Courses doc, states 8–10) — the search and
// the two-part sort.
//
// Every key is a query param of fc-course-students, so every write is a
// refetch: FluentCommunity searches (name or username) and sorts
// (display_name · created_at = the enrolment · last_activity, ASC | DESC)
// server-side. The sheet's default is Start Date, Descending — "most
// recently enrolled first" (state 10).

export type CourseStudentsControls = {
  search: string;
  sort_by: string;
  sort_dir: string;
};

const EVENT = 'appza:course-students-controls-change';

const DEFAULTS: CourseStudentsControls = {
  search: '',
  sort_by: 'created_at',
  sort_dir: 'DESC',
};

let current: CourseStudentsControls = DEFAULTS;

export function getCourseStudentsControls(): CourseStudentsControls {
  return current;
}

export function setCourseStudentsControls(patch: Partial<CourseStudentsControls>): void {
  const next: CourseStudentsControls = {
    // '' is the ⨯ clear and must land.
    search: typeof patch.search === 'string' ? patch.search : current.search,
    sort_by: typeof patch.sort_by === 'string' && patch.sort_by ? patch.sort_by : current.sort_by,
    sort_dir: typeof patch.sort_dir === 'string' && patch.sort_dir ? patch.sort_dir : current.sort_dir,
  };
  if (
    next.search === current.search &&
    next.sort_by === current.sort_by &&
    next.sort_dir === current.sort_dir
  ) {
    return;
  }
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/** Called by the shells when the page opens: no search, the sort kept. */
export function resetCourseStudentsControls(): void {
  cancelDebouncedSearch('course_students');
  setCourseStudentsControls({ search: '' });
}

/** The `state.course_students_controls.*` entries a gate or param reads. */
export function courseStudentsStateEntries(state: CourseStudentsControls): Record<string, unknown> {
  return {
    'course_students_controls.search': state.search,
    'course_students_controls.sort_by': state.sort_by,
    'course_students_controls.sort_dir': state.sort_dir,
  };
}

export function useCourseStudentsControls(): CourseStudentsControls {
  const [state, setState] = useState<CourseStudentsControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

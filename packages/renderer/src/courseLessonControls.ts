import { useEffect, useState } from 'react';

// The lesson screen (Courses doc, states 16–17) — which lesson is open.
//
// A query param of fc-course-lesson, so every write is a refetch: a lesson
// row, START / CONTINUE / REVIEW on the details, and the < > arrows each
// write the slug they lead to. The COURSE is not here — it stays
// `route.slug`, which the details screen wrote and which nav.back needs
// untouched: nav.push replaces the route bag and nav.back never restores
// it, so a lesson opened with pass_item_as_context would leave the details
// behind it reading the lesson's slug as the course's.
//
// '' opens the viewer's next lesson (the route's rule), which is also what
// a screen opened with no lesson — a screen picker — gets.

export type CourseLessonControls = {
  lesson_slug: string;
};

const EVENT = 'appza:course-lesson-controls-change';

let current: CourseLessonControls = { lesson_slug: '' };

export function getCourseLessonControls(): CourseLessonControls {
  return current;
}

export function setCourseLessonControls(patch: Partial<CourseLessonControls>): void {
  const lesson_slug = typeof patch.lesson_slug === 'string' ? patch.lesson_slug : current.lesson_slug;
  if (lesson_slug === current.lesson_slug) return;
  current = { lesson_slug };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

/** The `state.course_lesson_controls.*` entries a gate or param reads. */
export function courseLessonStateEntries(state: CourseLessonControls): Record<string, unknown> {
  return {
    'course_lesson_controls.lesson_slug': state.lesson_slug,
  };
}

export function useCourseLessonControls(): CourseLessonControls {
  const [state, setState] = useState<CourseLessonControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

import { useEffect, useState } from 'react';

// The course stays in route.slug: nav.push replaces the route bag and nav.back never restores it.

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

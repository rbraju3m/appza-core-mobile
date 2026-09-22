import { useEffect, useState } from 'react';

// Course details (Courses doc, states 5–7) — which sections are open.
//
// "Tapping a section expands it to list its lessons; tapping again
// collapses it" (state 6), and design 6 has two open at once, so this is
// a SET of section ids rather than one open key. A section is a
// FluentCommunity post row, so its id is unique across every course: one
// set serves them all, and a course you come back to opens the way you
// left it. In memory only — a fresh launch opens every course collapsed,
// as design 5 draws it.
//
// The section card reads it with a child clause —
//   { binding: 'state.course_detail.open_sections', op: 'contains',
//     value_from: 'data.id' }
// — so which lessons draw is decided in the catalog, not here.

export type CourseDetailControls = {
  open_sections: number[];
};

const EVENT = 'appza:course-detail-controls-change';

let current: CourseDetailControls = { open_sections: [] };

export function getCourseDetailControls(): CourseDetailControls {
  return current;
}

/** Open a closed section, close an open one. */
export function toggleCourseSection(sectionId: number): void {
  if (!Number.isFinite(sectionId) || sectionId <= 0) return;
  const open = current.open_sections.includes(sectionId)
    ? current.open_sections.filter((id) => id !== sectionId)
    : [...current.open_sections, sectionId];
  current = { open_sections: open };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

/** The `state.course_detail.*` entries a gate reads. */
export function courseDetailStateEntries(state: CourseDetailControls): Record<string, unknown> {
  return {
    'course_detail.open_sections': state.open_sections,
  };
}

export function useCourseDetailControls(): CourseDetailControls {
  const [state, setState] = useState<CourseDetailControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

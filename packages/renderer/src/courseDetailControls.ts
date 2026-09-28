import { useEffect, useState } from 'react';

// A set of section ids (post ids, unique across courses); in memory only.

export type CourseDetailControls = {
  open_sections: number[];
};

const EVENT = 'appza:course-detail-controls-change';

let current: CourseDetailControls = { open_sections: [] };

export function getCourseDetailControls(): CourseDetailControls {
  return current;
}

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

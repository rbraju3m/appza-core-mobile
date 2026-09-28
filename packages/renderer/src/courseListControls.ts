import { useEffect, useState } from 'react';
import { cancelDebouncedSearch } from './searchDebounce';

export type CourseListTab = 'all' | 'my';

export type CourseListControls = {
  // `type` is derived: the route speaks FluentCommunity's word for My Courses ('enrolled').
  tab: CourseListTab;
  type: '' | 'enrolled';
  search: string;
  topic_slug: string;
  // FluentCommunity's keys: alphabetical | latest | oldest.
  sort_by: string;
};

const STORAGE_KEY = 'appza.courseListControls';
const EVENT = 'appza:course-list-controls-change';

const DEFAULTS: CourseListControls = {
  tab: 'all',
  type: '',
  search: '',
  topic_slug: '',
  sort_by: 'alphabetical',
};

function isTab(v: unknown): v is CourseListTab {
  return v === 'all' || v === 'my';
}

function typeFor(tab: CourseListTab): '' | 'enrolled' {
  return tab === 'my' ? 'enrolled' : '';
}

function readFromStorage(): CourseListControls {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<CourseListControls>;
    return {
      ...DEFAULTS,
      sort_by: typeof parsed.sort_by === 'string' && parsed.sort_by ? parsed.sort_by : DEFAULTS.sort_by,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: CourseListControls = readFromStorage();

export function getCourseListControls(): CourseListControls {
  return current;
}

export function setCourseListControls(patch: Partial<CourseListControls>): void {
  const tab = isTab(patch.tab) ? patch.tab : current.tab;
  const next: CourseListControls = {
    tab,
    type: typeFor(tab),
    // '' is the clear button and the All chip, and must land.
    search: typeof patch.search === 'string' ? patch.search : current.search,
    topic_slug: typeof patch.topic_slug === 'string' ? patch.topic_slug : current.topic_slug,
    sort_by: typeof patch.sort_by === 'string' && patch.sort_by ? patch.sort_by : current.sort_by,
  };
  if (
    next.tab === current.tab &&
    next.search === current.search &&
    next.topic_slug === current.topic_slug &&
    next.sort_by === current.sort_by
  ) {
    return;
  }
  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sort_by: next.sort_by }));
    } catch {
      // best-effort
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function resetCourseListControls(): void {
  cancelDebouncedSearch('courses');
  setCourseListControls({ tab: 'all', search: '', topic_slug: '' });
}

export function courseListStateEntries(state: CourseListControls): Record<string, unknown> {
  return {
    'course_list_controls.tab': state.tab,
    'course_list_controls.type': state.type,
    'course_list_controls.search': state.search,
    'course_list_controls.topic_slug': state.topic_slug,
    'course_list_controls.sort_by': state.sort_by,
  };
}

export function useCourseListControls(): CourseListControls {
  const [state, setState] = useState<CourseListControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

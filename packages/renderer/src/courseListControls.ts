import { useEffect, useState } from 'react';
import { cancelDebouncedSearch } from './searchDebounce';

// Courses screen controls (Courses doc, states 1–4) — which tab is
// showing, the search string, the topic chip and the sort.
//
// Same event-backed shape as memberDirectoryControls. Every key here is
// bound as a query param by fc-course-list, so every write is a refetch:
// FluentCommunity searches, filters and sorts server-side, and "search,
// topic and sort all work together on the current tab" (state 2) falls
// out of one request carrying all four.

export type CourseListTab = 'all' | 'my';

export type CourseListControls = {
  // The strip writes it. `type` is derived from it, because the route
  // speaks FluentCommunity's word for My Courses ('enrolled').
  tab: CourseListTab;
  type: '' | 'enrolled';
  // Authored on every keystroke, through the debounce.
  search: string;
  // '' is the "All" chip — no topic filter.
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
  // State 4: "Alphabetical — A to Z by title (default)".
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
      // The sort is a preference and survives; the tab, the search and
      // the topic do not — a visit opens on All Courses, unfiltered.
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
    // '' is the ⨯ clear and the All chip, and must land.
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
      // best-effort — in-memory `current` still wins for the session
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/**
 * The landing state, called by the shells when the screen becomes active:
 * All Courses, no search, All topics. The sort survives.
 */
export function resetCourseListControls(): void {
  cancelDebouncedSearch('courses');
  setCourseListControls({ tab: 'all', search: '', topic_slug: '' });
}

/** The `state.course_list_controls.*` entries a gate or query param reads. */
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

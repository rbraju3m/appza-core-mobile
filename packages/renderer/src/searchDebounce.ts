// Only for fields a DataSource binds (each write is a refetch); the SPACES search filters locally and must not be debounced.

export const SEARCH_DEBOUNCE_MS = 300;

export type SearchDebounceKey = 'bookmarks' | 'documents' | 'search' | 'follow' | 'members' | 'courses' | 'course_students' | 'course_add_student';

type Pending = {
  timer: ReturnType<typeof setTimeout>;
  apply: (value: string) => void;
  value: string;
};

const pending = new Map<SearchDebounceKey, Pending>();

function clear(key: SearchDebounceKey): Pending | undefined {
  const p = pending.get(key);
  if (p) {
    clearTimeout(p.timer);
    pending.delete(key);
  }
  return p;
}

// Clearing applies immediately and cancels any pending write, or the last keystroke would refill the field.
export function debounceSearch(
  key: SearchDebounceKey,
  value: string,
  apply: (value: string) => void,
): void {
  clear(key);

  if (value === '') {
    apply('');
    return;
  }

  const timer = setTimeout(() => {
    pending.delete(key);
    apply(value);
  }, SEARCH_DEBOUNCE_MS);

  pending.set(key, { timer, apply, value });
}

// Called on screen change: a late timer would restore an abandoned search after resetBookmarkControls().
export function cancelDebouncedSearch(key?: SearchDebounceKey): void {
  if (key) {
    clear(key);
    return;
  }
  pending.forEach((p) => clearTimeout(p.timer));
  pending.clear();
}

export function flushDebouncedSearch(key: SearchDebounceKey): void {
  const p = clear(key);
  if (p) p.apply(p.value);
}

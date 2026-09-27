import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { fetchDataSourceOnce } from './dataFetch';
import { useBackDismiss } from './backStack';

/**
 * "Add Student" — Courses doc, states 13 and 14.
 *
 * A bottom sheet: whose course it is, the title, a search field, and the
 * site users who are NOT in the course yet (FluentCommunity's own
 * `users/search`, up to 100, which already leaves the course's members
 * out — so a student cannot be added twice). The email shows only when
 * the admin's WordPress role may list users; FC leaves it off otherwise,
 * and the row simply has no second line.
 *
 * Presentation only. The rows come through the preview proxy under the
 * catalog's DataSource (where this app's auth lives, as for every opened
 * sheet), and a tap is handed to `onPick` — the confirm and the write are
 * the action handler's.
 */

export const COURSE_ADD_STUDENT_SHEET_APPZET_SLUG = 'fc-course-add-student-sheet';

/** MUST match the children of the fc-course-add-student-sheet superstructure. */
export const COURSE_ADD_STUDENT_SHEET_CHILD_COUNT = 5;

export type CourseAddStudentPresentation = {
  title: string;
  placeholder: string;
  emptyLabel: string;
  searchIcon: string;
  clearIcon: string;
  hidden: boolean;
  sheetBgColor?: string;
  sheetRadius?: string;
  backdropColor?: string;
  titleColor?: string;
  eyebrowColor?: string;
  fieldBgColor?: string;
  nameColor?: string;
  emailColor?: string;
};

export type CourseAddStudentUser = {
  user_id: number;
  display_name: string;
  email: string;
  photo: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: CourseAddStudentPresentation;
  dataSourceSlug: string;
  courseId: number;
  eyebrow?: string;
  onPick: (user: CourseAddStudentUser) => void;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-course-add-student';
const CLOSE_EVENT = 'appza:close-course-add-student';

export function openCourseAddStudentSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeCourseAddStudentSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

function toUsers(payload: unknown): CourseAddStudentUser[] {
  const rec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(rec?.items)
      ? (rec!.items as unknown[])
      : Array.isArray(rec?.data)
        ? (rec!.data as unknown[])
        : [];
  const out: CourseAddStudentUser[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = Number(r.ID ?? r.id ?? r.user_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    out.push({
      user_id: id,
      display_name: str(r.display_name),
      email: str(r.user_email ?? r.email),
      photo: str(r.photo ?? r.avatar),
    });
  }
  return out;
}

export function CourseAddStudentSheet() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<CourseAddStudentUser[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setQuery('');
      setUsers([]);
      setDetail(ce.detail);
    };
    const onClose = () => setDetail(null);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  // One request when the typing stops; a late answer to an older query
  // never overwrites a newer one.
  useEffect(() => {
    if (!detail) return;
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      const params: Record<string, unknown> = { course_id: detail.courseId };
      if (query.trim() !== '') params.search = query.trim();
      void fetchDataSourceOnce(detail.dataSourceSlug, params, { bypassCache: true })
        .then((payload) => {
          if (mine === seq.current) setUsers(toUsers(payload));
        })
        .catch(() => {
          if (mine === seq.current) setUsers([]);
        })
        .finally(() => {
          if (mine === seq.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [detail, query]);

  useBackDismiss(!(!detail || detail.presentation.hidden), () => setDetail(null));

  if (!detail || detail.presentation.hidden) return null;
  const p = detail.presentation;
  const slug = detail.appzetSlug ?? COURSE_ADD_STUDENT_SHEET_APPZET_SLUG;
  const cs = detail.childStyles ?? {};
  const searchGlyph = resolveIcon(p.searchIcon);
  const clearGlyph = resolveIcon(p.clearIcon);

  const vars: CSSProperties = {
    ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
    ['--appza-sheet-radius' as string]: p.sheetRadius,
    ['--appza-backdrop-color' as string]: p.backdropColor,
    ['--appza-title-color' as string]: p.titleColor,
    ['--appza-eyebrow-color' as string]: p.eyebrowColor,
    ['--appza-field-bg-color' as string]: p.fieldBgColor,
    ['--appza-name-color' as string]: p.nameColor,
    ['--appza-email-color' as string]: p.emailColor,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      className="appza-options-sheet-backdrop appza-add-student-backdrop"
      style={vars}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCourseAddStudentSheet();
      }}
    >
      <div className="appza-options-sheet appza-add-student-sheet" {...appzetAttrs(slug)}>
        <div className="appza-options-sheet-grabber" />
        {detail.eyebrow && <div className="appza-add-student-eyebrow">{detail.eyebrow}</div>}
        <div className="appza-add-student-title" style={cs[0]} {...childAttrs(slug, 0, 'ion-text')}>
          {p.title}
        </div>
        <label className="appza-add-student-search" style={cs[1]} {...childAttrs(slug, 1, 'ion-input')}>
          {searchGlyph && <IonIcon icon={searchGlyph} />}
          <input
            type="search"
            value={query}
            placeholder={p.placeholder}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query !== '' && clearGlyph && (
            <button type="button" aria-label="Clear" onClick={() => setQuery('')}>
              <IonIcon icon={clearGlyph} />
            </button>
          )}
        </label>
        <div className="appza-add-student-list">
          {users.map((u, i) => (
            <button
              key={u.user_id}
              type="button"
              className="appza-add-student-row"
              data-user-id={u.user_id}
              onClick={() => {
                // Closed first: the pick opens the confirm.
                closeCourseAddStudentSheet();
                detail.onPick(u);
              }}
            >
              <span className="appza-add-student-avatar" style={cs[2]} {...(i === 0 ? childAttrs(slug, 2, 'ion-avatar') : {})}>
                {u.photo ? <img src={u.photo} alt="" /> : null}
              </span>
              <span className="appza-add-student-text">
                <span className="appza-add-student-name" style={cs[3]} {...(i === 0 ? childAttrs(slug, 3, 'ion-text') : {})}>
                  {u.display_name}
                </span>
                {u.email && (
                  <span className="appza-add-student-email" style={cs[4]} {...(i === 0 ? childAttrs(slug, 4, 'ion-text') : {})}>
                    {u.email}
                  </span>
                )}
              </span>
            </button>
          ))}
          {!loading && users.length === 0 && <div className="appza-add-student-empty">{p.emptyLabel}</div>}
        </div>
      </div>
    </div>
  );
}

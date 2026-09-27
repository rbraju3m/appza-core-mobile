import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { useInsideDeviceViewport } from './insideDeviceViewport';
import { useBackDismiss } from './backStack';

// Bottom-sheet date + time picker for scheduling a document post.
//
// Bespoke React for the same reason as the modals: a month grid with
// navigation, a selected day and a time field is local, stateful UI that
// the primitive composer can't express. It opts back into the builder by
// hand via childAttrs/appzetAttrs — the indices below MUST match the
// `children` array of the fc-schedule-sheet superstructure.
//
// FluentCommunity Pro's SchedulePostHandler decides whether a post is
// really scheduled, and it enforces two rules we mirror here so the user
// finds out before the round trip:
//   - only moderators/admins may schedule (server-side, from the space
//     role — nothing the client can assert)
//   - the time must be at least 30 minutes out
// Past days are disabled outright; the 30-minute rule is checked on
// confirm, because it depends on the time as well as the date.

export const SCHEDULE_SHEET_APPZET_SLUG = 'fc-schedule-sheet';

/** Minutes FC Pro requires between now and a scheduled post. */
const MIN_LEAD_MINUTES = 30;

export type SchedulePresentation = {
  eyebrow: string;
  title: string;
  timeLabel: string;
  submitLabel: string;
  prevIcon: string;
  nextIcon: string;
  monthCaretIcon: string;
  weekdays: string[];
  hidden: boolean;
  showEyebrow: boolean;
  showHandle: boolean;
  minLeadMinutes: number;
  // style knobs — all optional, all fall back to the stock design
  sheetBgColor?: string;
  sheetRadius?: string;
  backdropColor?: string;
  eyebrowColor?: string;
  titleColor?: string;
  titleSize?: string;
  monthColor?: string;
  navIconColor?: string;
  weekdayColor?: string;
  dayColor?: string;
  dayMutedColor?: string;
  selectedRingColor?: string;
  selectedTextColor?: string;
  timeLabelColor?: string;
  timeBgColor?: string;
  timeTextColor?: string;
  timeRadius?: string;
  submitBgColor?: string;
  submitTextColor?: string;
  submitRadius?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  /** 'YYYY-MM-DD HH:MM:SS' — seeds the grid when re-opening. */
  value?: string;
  presentation: SchedulePresentation;
  /** Fired with the chosen 'YYYY-MM-DD HH:MM:SS'. */
  onConfirm?: (value: string) => void;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-schedule-sheet';
const CLOSE_EVENT = 'appza:close-schedule-sheet';
const PATCH_EVENT = 'appza:patch-schedule-sheet';

export function openScheduleSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeScheduleSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

/** Live-preview patch from the builder, addressed by AppZet slug. */
export function patchScheduleSheet(
  appzetSlug: string,
  patch: { presentation?: SchedulePresentation; childStyles?: Record<number, CSSProperties> },
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PATCH_EVENT, { detail: { appzetSlug, patch } }),
  );
}

/* ---------------------------------------------------------------- */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local 'YYYY-MM-DD' — never toISOString(), which shifts to UTC. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseValue(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Day cells for a month, padded with nulls so the 1st lands under its
 * weekday column.
 */
function monthCells(year: number, month: number): Array<number | null> {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function ScheduleSheet() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [monthOpen, setMonthOpen] = useState(false);
  const [error, setError] = useState('');
  const embedded = useInsideDeviceViewport(open);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      const now = new Date();
      const seeded = parseValue(ce.detail.value) ?? now;
      setDetail(ce.detail);
      setCursor(startOfDay(seeded));
      setSelected(startOfDay(seeded));
      setTime(`${pad(seeded.getHours())}:${pad(seeded.getMinutes())}`);
      setMonthOpen(false);
      setError('');
      setOpen(true);
    };
    const onClose = () => setOpen(false);
    const onPatch = (e: Event) => {
      const ce = e as CustomEvent<{
        appzetSlug: string;
        patch: { presentation?: SchedulePresentation; childStyles?: Record<number, CSSProperties> };
      }>;
      if (!ce.detail) return;
      setDetail((prev) => {
        if (!prev) return prev;
        const mine = prev.appzetSlug ?? SCHEDULE_SHEET_APPZET_SLUG;
        return mine === ce.detail.appzetSlug ? { ...prev, ...ce.detail.patch } : prev;
      });
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener(PATCH_EVENT, onPatch);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener(PATCH_EVENT, onPatch);
    };
  }, []);

  const p = detail?.presentation;
  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  useBackDismiss(!(!open || !detail || !p || p.hidden), () => setOpen(false));

  if (!open || !detail || !p || p.hidden) return null;

  const slug = detail.appzetSlug ?? SCHEDULE_SHEET_APPZET_SLUG;
  const childStyle = (i: number) => detail.childStyles?.[i];
  const today = startOfDay(new Date());
  const leadMinutes = p.minLeadMinutes > 0 ? p.minLeadMinutes : MIN_LEAD_MINUTES;

  const vars: Record<string, string> = {};
  const put = (name: string, value?: string) => {
    if (value) vars[name] = value;
  };
  put('--appza-ss-bg', p.sheetBgColor);
  put('--appza-ss-radius', p.sheetRadius);
  put('--appza-ss-backdrop', p.backdropColor);
  put('--appza-ss-eyebrow-color', p.eyebrowColor);
  put('--appza-ss-title-color', p.titleColor);
  put('--appza-ss-title-size', p.titleSize);
  put('--appza-ss-month-color', p.monthColor);
  put('--appza-ss-nav-color', p.navIconColor);
  put('--appza-ss-weekday-color', p.weekdayColor);
  put('--appza-ss-day-color', p.dayColor);
  put('--appza-ss-day-muted-color', p.dayMutedColor);
  put('--appza-ss-ring-color', p.selectedRingColor);
  put('--appza-ss-selected-color', p.selectedTextColor);
  put('--appza-ss-time-label-color', p.timeLabelColor);
  put('--appza-ss-time-bg', p.timeBgColor);
  put('--appza-ss-time-color', p.timeTextColor);
  put('--appza-ss-time-radius', p.timeRadius);
  put('--appza-ss-submit-bg', p.submitBgColor);
  put('--appza-ss-submit-color', p.submitTextColor);
  put('--appza-ss-submit-radius', p.submitRadius);

  const confirm = () => {
    if (!selected) {
      setError('Pick a date.');
      return;
    }
    const [h = '0', m = '0'] = (time || '00:00').split(':');
    const when = new Date(selected);
    when.setHours(Number.parseInt(h, 10) || 0, Number.parseInt(m, 10) || 0, 0, 0);
    if (when.getTime() - Date.now() < leadMinutes * 60_000) {
      setError(`Pick a time at least ${leadMinutes} minutes from now.`);
      return;
    }
    setOpen(false);
    // Local wall-clock, not toISOString(): FC parses this in the site's
    // timezone, so sending UTC would silently shift the post.
    detail.onConfirm?.(
      `${ymd(when)} ${pad(when.getHours())}:${pad(when.getMinutes())}:00`,
    );
  };

  const prevIcon = resolveIcon(p.prevIcon);
  const nextIcon = resolveIcon(p.nextIcon);
  const caretIcon = resolveIcon(p.monthCaretIcon);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      className={`appza-schedule-backdrop${embedded ? ' is-embedded' : ''}`}
      style={vars as CSSProperties}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="appza-schedule-sheet" {...appzetAttrs(slug)}>
        {p.showHandle && <div className="appza-schedule-handle" />}

        {p.showEyebrow && (
          <div
            className="appza-schedule-eyebrow"
            style={childStyle(0)}
            {...childAttrs(slug, 0, 'ion-text')}
          >
            {p.eyebrow}
          </div>
        )}

        <div
          className="appza-schedule-title"
          style={childStyle(1)}
          {...childAttrs(slug, 1, 'ion-text')}
        >
          {p.title}
        </div>

        <div className="appza-schedule-monthbar">
          <button
            type="button"
            className="appza-schedule-month"
            style={childStyle(2)}
            aria-expanded={monthOpen}
            onClick={() => setMonthOpen((v) => !v)}
            {...childAttrs(slug, 2, 'ion-button')}
          >
            <span>
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            {caretIcon && <IonIcon icon={caretIcon} className="appza-schedule-caret" />}
          </button>

          <div className="appza-schedule-nav">
            <button
              type="button"
              className="appza-schedule-navbtn"
              aria-label="Previous month"
              style={childStyle(3)}
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              {...childAttrs(slug, 3, 'ion-button')}
            >
              {prevIcon && <IonIcon icon={prevIcon} />}
            </button>
            <button
              type="button"
              className="appza-schedule-navbtn"
              aria-label="Next month"
              style={childStyle(4)}
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              {...childAttrs(slug, 4, 'ion-button')}
            >
              {nextIcon && <IonIcon icon={nextIcon} />}
            </button>
          </div>
        </div>

        {monthOpen && (
          <div className="appza-schedule-monthpicker">
            <div className="appza-schedule-yearrow">
              <button
                type="button"
                aria-label="Previous year"
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear() - 1, cursor.getMonth(), 1))
                }
              >
                {prevIcon && <IonIcon icon={prevIcon} />}
              </button>
              <span>{cursor.getFullYear()}</span>
              <button
                type="button"
                aria-label="Next year"
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear() + 1, cursor.getMonth(), 1))
                }
              >
                {nextIcon && <IonIcon icon={nextIcon} />}
              </button>
            </div>
            <div className="appza-schedule-monthgrid">
              {MONTH_NAMES.map((name, idx) => (
                <button
                  key={name}
                  type="button"
                  className={idx === cursor.getMonth() ? 'is-current' : undefined}
                  onClick={() => {
                    setCursor(new Date(cursor.getFullYear(), idx, 1));
                    setMonthOpen(false);
                  }}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className="appza-schedule-weekdays"
          style={childStyle(5)}
          {...childAttrs(slug, 5, 'ion-text')}
        >
          {p.weekdays.map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>

        <div
          className="appza-schedule-grid"
          style={childStyle(6)}
          {...childAttrs(slug, 6, 'ion-button')}
        >
          {cells.map((day, idx) => {
            if (day === null) return <span key={`pad-${idx}`} />;
            const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
            const past = date.getTime() < today.getTime();
            const isSelected = !!selected && ymd(selected) === ymd(date);
            return (
              <button
                key={day}
                type="button"
                disabled={past}
                className={
                  'appza-schedule-day' +
                  (past ? ' is-past' : '') +
                  (isSelected ? ' is-selected' : '')
                }
                onClick={() => {
                  setSelected(date);
                  setError('');
                }}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="appza-schedule-timerow">
          <span
            className="appza-schedule-timelabel"
            style={childStyle(7)}
            {...childAttrs(slug, 7, 'ion-text')}
          >
            {p.timeLabel}
          </span>
          <input
            type="time"
            className="appza-schedule-time"
            value={time}
            style={childStyle(8)}
            onChange={(e) => {
              setTime(e.target.value);
              setError('');
            }}
            {...childAttrs(slug, 8, 'ion-input')}
          />
        </div>

        {error && <div className="appza-schedule-error">{error}</div>}

        <div className="appza-schedule-footer">
          <button
            type="button"
            className="appza-schedule-submit"
            style={childStyle(9)}
            onClick={confirm}
            {...childAttrs(slug, 9, 'ion-button')}
          >
            {p.submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

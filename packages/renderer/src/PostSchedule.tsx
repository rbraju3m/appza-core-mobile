import { IonIcon } from '@ionic/react';

import { resolveIcon } from './PrimitiveRenderer';
import { usePostDraft, setPostDraft } from './postDraft';

// FC Pro silently ignores scheduled_at for non-moderators, so the calendar glyph is gated on can_schedule.

export type PostScheduleProps = {
  overrides?: Record<string, unknown>;
};

function str(o: Record<string, unknown> | undefined, k: string): string {
  const v = o?.[k];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function bool(o: Record<string, unknown> | undefined, k: string, fallback: boolean): boolean {
  const v = o?.[k];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** The space→T swap parses as local time; the value is the site's wall-clock. */
export function formatScheduledFor(value: string, template: string): string {
  if (!value) return '';
  const when = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(when.getTime())) return '';
  return template
    .replace('{d}', String(when.getDate()))
    .replace('{dd}', pad(when.getDate()))
    .replace('{mon}', MONTHS[when.getMonth()]!)
    .replace('{yyyy}', String(when.getFullYear()))
    .replace('{HH}', pad(when.getHours()))
    .replace('{mm}', pad(when.getMinutes()));
}

const REQUEST_EVENT = 'appza:request-schedule-sheet';

export function requestScheduleSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REQUEST_EVENT));
}

export function onScheduleSheetRequest(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(REQUEST_EVENT, handler);
  return () => window.removeEventListener(REQUEST_EVENT, handler);
}

export function AppzaPostSchedule({ overrides }: PostScheduleProps) {
  const draft = usePostDraft();

  const template = str(overrides, 'date_format') || '{d} {mon} {yyyy} at {HH}:{mm}';
  const prefix = str(overrides, 'label') || 'Scheduled for ';
  const editLabel = str(overrides, 'edit_label') || 'Edit';
  const icon = resolveIcon(str(overrides, 'calendar_icon') || 'calendar-outline');
  const clearIcon = resolveIcon(str(overrides, 'clear_icon') || 'close');
  const showEdit = bool(overrides, 'show_edit', true);
  const showClear = bool(overrides, 'show_clear', true);

  const when = formatScheduledFor(draft.scheduled_at, template);
  const label = when === '' ? `${prefix}…` : `${prefix}${when}`;

  return (
    <span className="appza-post-schedule">
      {icon && <IonIcon className="appza-post-schedule-icon" icon={icon} aria-hidden="true" />}
      <span className="appza-post-schedule-text">{label}</span>
      {showEdit && (
        <button
          type="button"
          className="appza-post-schedule-edit"
          onClick={requestScheduleSheet}
        >
          {editLabel}
        </button>
      )}
      {showClear && (
        <button
          type="button"
          className="appza-post-schedule-clear"
          aria-label="Publish now instead"
          onClick={() => setPostDraft({ scheduled_at: '' })}
        >
          {clearIcon ? <IonIcon icon={clearIcon} /> : '×'}
        </button>
      )}
    </span>
  );
}

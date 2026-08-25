import { IonIcon } from '@ionic/react';

import { resolveIcon } from './PrimitiveRenderer';
import { usePostDraft, setPostDraft } from './postDraft';

/**
 * "Scheduled for 27 Aug 2026 at 13:14 — Edit" — Noor's design 10.
 *
 * The strip under the announcement row, drawn only once a time has been
 * chosen. Its own primitive rather than a composition of ion-text and
 * ion-button because the sentence is built from a draft value, and a
 * placement's props cannot read state.
 *
 * Whether it appears at all is decided twice, and both gates matter:
 * the PLACEMENT is gated on `state.post_draft.has_schedule`, so an
 * unscheduled draft has no strip; and the calendar glyph that sets it is
 * gated on `state.post_draft.can_schedule`, so a member never gets one.
 * FluentCommunity Pro ignores `scheduled_at` for a non-moderator
 * SILENTLY — `if (!is_admin) return $data;` — and publishes immediately,
 * so a control that merely errored would still be a lie.
 *
 * Edit re-opens the same sheet through the same request channel the poll
 * strip uses; ⨯ clears the schedule, which is how a post goes back to
 * publishing now.
 */

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

/**
 * Render 'YYYY-MM-DD HH:MM:SS' with the authored template.
 *
 * Parsed by replacing the space with a T so it is read as LOCAL time —
 * `new Date('2026-08-27 13:14:00')` is implementation-defined, and the
 * value is the site's wall-clock, not UTC.
 */
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

/**
 * Ask the shell to open the schedule sheet on the current draft.
 *
 * Same channel shape as the poll strip's "Edit": opening the sheet needs
 * the AppZet's props and the saved customizations, which live in the
 * shell, and the strip is drawn inside a primitive with no child index of
 * its own to hang an action on.
 */
export function requestScheduleSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REQUEST_EVENT));
}

/** Shell side of {@link requestScheduleSheet}. Returns its unsubscribe. */
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
  // Nothing scheduled: the placement is gated on `has_schedule` and so
  // should never mount this, but a builder previewing the AppZet in Edit
  // mode reaches it with an empty draft — and a strip that read
  // "Scheduled for " with nothing after it would be worse than a sample.
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

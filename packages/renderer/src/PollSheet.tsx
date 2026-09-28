import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';

import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import {
  removePostDraftPoll,
  setPostDraftPoll,
  type PostDraftPoll,
  type PostDraftPollOption,
} from './postDraft';
import { useBackDismiss } from './backStack';

// Rules mirror FC: 2 options min (empty labels are dropped), server-issued options can't be removed or blanked (votes keyed on slug), type fixed once votes exist.

export const POLL_SHEET_APPZET_SLUG = 'fc-post-poll-sheet';
export const POLL_SHEET_CHILD_COUNT = 9;

const MIN_OPTIONS = 2;

export type PollSheetPresentation = {
  eyebrow: string;
  title: string;
  optionPlaceholder: string;
  addOptionLabel: string;
  singleLabel: string;
  multipleLabel: string;
  addEndDateLabel: string;
  timeLabel: string;
  removeLabel: string;
  doneLabel: string;
  addIcon: string;
  removeOptionIcon: string;
  calendarIcon: string;
  prevIcon: string;
  nextIcon: string;
  monthCaretIcon: string;
  weekdays: string[];
  endDateFormat: string;
  hidden: boolean;
  showHandle: boolean;
  showEyebrow: boolean;
  showTitle: boolean;
  showEndDate: boolean;
  showRemove: boolean;
  allowPastEndDate: boolean;
  sheetBgColor?: string;
  sheetRadius?: string;
  sheetMaxHeight?: string;
  backdropColor?: string;
  handleColor?: string;
  eyebrowColor?: string;
  eyebrowSize?: string;
  titleColor?: string;
  titleSize?: string;
  titleWeight?: string;
  fieldBgColor?: string;
  fieldTextColor?: string;
  fieldPlaceholderColor?: string;
  fieldBorderColor?: string;
  fieldRadius?: string;
  fieldHeight?: string;
  fieldGap?: string;
  optionRemoveColor?: string;
  optionRemoveSize?: string;
  addColor?: string;
  addSize?: string;
  addWeight?: string;
  segmentBgColor?: string;
  segmentTextColor?: string;
  segmentBorderColor?: string;
  segmentRadius?: string;
  segmentHeight?: string;
  segmentGap?: string;
  segmentActiveBgColor?: string;
  segmentActiveTextColor?: string;
  segmentActiveBorderColor?: string;
  endDateColor?: string;
  endDateSize?: string;
  endDateIconColor?: string;
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
  removeColor?: string;
  removeSize?: string;
  doneBgColor?: string;
  doneDisabledBgColor?: string;
  doneTextColor?: string;
  doneRadius?: string;
  doneHeight?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: PollSheetPresentation;
  value?: PostDraftPoll | null;
  existing?: boolean;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-poll-sheet';
const CLOSE_EVENT = 'appza:close-poll-sheet';
const PATCH_EVENT = 'appza:patch-poll-sheet';
const REQUEST_EVENT = 'appza:request-poll-sheet';

export function requestPollSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REQUEST_EVENT));
}

export function onPollSheetRequest(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(REQUEST_EVENT, handler);
  return () => window.removeEventListener(REQUEST_EVENT, handler);
}

export function openPollSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closePollSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function patchPollSheet(
  appzetSlug: string,
  patch: { presentation?: PollSheetPresentation; childStyles?: Record<number, CSSProperties> },
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PATCH_EVENT, { detail: { appzetSlug, patch } }));
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local 'YYYY-MM-DD' — never toISOString(), which shifts to UTC. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseEndDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

export function formatPollEndDate(value: string, template: string): string {
  const when = parseEndDate(value);
  if (!when) return '';
  return template
    .replace('{d}', String(when.getDate()))
    .replace('{dd}', pad(when.getDate()))
    .replace('{mon}', MONTH_NAMES[when.getMonth()]!.slice(0, 3))
    .replace('{month}', MONTH_NAMES[when.getMonth()]!)
    .replace('{yyyy}', String(when.getFullYear()))
    .replace('{HH}', pad(when.getHours()))
    .replace('{mm}', pad(when.getMinutes()));
}

type Row = PostDraftPollOption & { key: string };

function seedRows(poll: PostDraftPoll | null | undefined): Row[] {
  const from = poll?.options ?? [];
  const rows: Row[] = from.map((o, i) => ({
    label: o.label,
    ...(o.slug ? { slug: o.slug } : {}),
    key: o.slug ? `srv:${o.slug}` : `seed:${i}`,
  }));
  let n = rows.length;
  while (rows.length < MIN_OPTIONS) rows.push({ label: '', key: `seed:${n++}` });
  return rows;
}

export function PollSheet() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [type, setType] = useState<'single_choice' | 'multi_choice'>('single_choice');
  const [endDate, setEndDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [monthOpen, setMonthOpen] = useState(false);
  // A counter, not Date.now(): same-ms keys would collide and React would reuse a row's DOM.
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      const poll = ce.detail.value ?? null;
      const seeded = parseEndDate(poll?.end_date ?? '');
      setDetail(ce.detail);
      setRows(seedRows(poll));
      setType(poll?.type === 'multi_choice' ? 'multi_choice' : 'single_choice');
      setEndDate(poll?.end_date ?? '');
      setCalendarOpen(false);
      setCursor(startOfDay(seeded ?? new Date()));
      setSelected(seeded ? startOfDay(seeded) : null);
      setTime(seeded ? `${pad(seeded.getHours())}:${pad(seeded.getMinutes())}` : '');
      setMonthOpen(false);
      setSeq(0);
      setOpen(true);
    };
    const onClose = () => setOpen(false);
    const onPatch = (e: Event) => {
      const ce = e as CustomEvent<{
        appzetSlug: string;
        patch: { presentation?: PollSheetPresentation; childStyles?: Record<number, CSSProperties> };
      }>;
      if (!ce.detail) return;
      setDetail((prev) => {
        if (!prev) return prev;
        const mine = prev.appzetSlug ?? POLL_SHEET_APPZET_SLUG;
        return mine === ce.detail.appzetSlug ? { ...prev, ...ce.detail.patch } : prev;
      });
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener(PATCH_EVENT, onPatch);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener(PATCH_EVENT, onPatch);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const p = detail?.presentation;

  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const vars: CSSProperties = useMemo(() => {
    if (!p) return {};
    const v: Record<string, string> = {};
    const put = (name: string, value?: string) => {
      if (value) v[name] = value;
    };
    put('--appza-sheet-bg-color', p.sheetBgColor);
    put('--appza-sheet-radius', p.sheetRadius);
    put('--appza-sheet-max-height', p.sheetMaxHeight);
    put('--appza-backdrop-color', p.backdropColor);
    put('--appza-handle-color', p.handleColor);
    put('--appza-eyebrow-color', p.eyebrowColor);
    put('--appza-eyebrow-size', p.eyebrowSize);
    put('--appza-title-color', p.titleColor);
    put('--appza-title-size', p.titleSize);
    put('--appza-title-weight', p.titleWeight);
    put('--appza-field-bg-color', p.fieldBgColor);
    put('--appza-field-text-color', p.fieldTextColor);
    put('--appza-field-placeholder-color', p.fieldPlaceholderColor);
    put('--appza-field-border-color', p.fieldBorderColor);
    put('--appza-field-radius', p.fieldRadius);
    put('--appza-field-height', p.fieldHeight);
    put('--appza-field-gap', p.fieldGap);
    put('--appza-option-remove-color', p.optionRemoveColor);
    put('--appza-option-remove-size', p.optionRemoveSize);
    put('--appza-add-color', p.addColor);
    put('--appza-add-size', p.addSize);
    put('--appza-add-weight', p.addWeight);
    put('--appza-segment-bg-color', p.segmentBgColor);
    put('--appza-segment-text-color', p.segmentTextColor);
    put('--appza-segment-border-color', p.segmentBorderColor);
    put('--appza-segment-radius', p.segmentRadius);
    put('--appza-segment-height', p.segmentHeight);
    put('--appza-segment-gap', p.segmentGap);
    put('--appza-segment-active-bg-color', p.segmentActiveBgColor);
    put('--appza-segment-active-text-color', p.segmentActiveTextColor);
    put('--appza-segment-active-border-color', p.segmentActiveBorderColor);
    put('--appza-end-date-color', p.endDateColor);
    put('--appza-end-date-size', p.endDateSize);
    put('--appza-end-date-icon-color', p.endDateIconColor);
    put('--appza-month-color', p.monthColor);
    put('--appza-nav-color', p.navIconColor);
    put('--appza-weekday-color', p.weekdayColor);
    put('--appza-day-color', p.dayColor);
    put('--appza-day-muted-color', p.dayMutedColor);
    put('--appza-ring-color', p.selectedRingColor);
    put('--appza-selected-color', p.selectedTextColor);
    put('--appza-time-label-color', p.timeLabelColor);
    put('--appza-time-bg', p.timeBgColor);
    put('--appza-time-color', p.timeTextColor);
    put('--appza-time-radius', p.timeRadius);
    put('--appza-remove-color', p.removeColor);
    put('--appza-remove-size', p.removeSize);
    put('--appza-done-bg-color', p.doneBgColor);
    put('--appza-done-disabled-bg-color', p.doneDisabledBgColor);
    put('--appza-done-text-color', p.doneTextColor);
    put('--appza-done-radius', p.doneRadius);
    put('--appza-done-height', p.doneHeight);
    return v as CSSProperties;
  }, [p]);

  useBackDismiss(!(!open || !detail || !p || p.hidden), () => setOpen(false));

  if (!open || !detail || !p || p.hidden) return null;

  const slug = detail.appzetSlug ?? POLL_SHEET_APPZET_SLUG;
  const cs = detail.childStyles ?? {};
  const today = startOfDay(new Date());
  const existing = detail.existing === true;

  const filled = rows.filter((r) => r.label.trim() !== '').length;
  // FC refuses an emptied server-issued option outright.
  const blankedExisting = rows.some((r) => !!r.slug && r.label.trim() === '');
  const canSave = filled >= MIN_OPTIONS && !blankedExisting;
  const canRemoveRows = rows.length > MIN_OPTIONS;

  const updateRow = (idx: number, label: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, label } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { label: '', key: `new:${seq}` }]);
    setSeq((n) => n + 1);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => {
      if (prev[idx]?.slug) return prev;
      if (prev.length <= MIN_OPTIONS) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const commitEndDate = (day: Date | null, hhmm: string) => {
    if (!day) {
      setEndDate('');
      return;
    }
    const [h = '0', m = '0'] = (hhmm || '00:00').split(':');
    const when = new Date(day);
    when.setHours(Number.parseInt(h, 10) || 0, Number.parseInt(m, 10) || 0, 0, 0);
    // Local wall-clock, not toISOString(): FC runs it through strtotime() in the site timezone.
    setEndDate(`${ymd(when)} ${pad(when.getHours())}:${pad(when.getMinutes())}:00`);
  };

  const done = () => {
    if (!canSave) return;
    const saved = setPostDraftPoll({
      type,
      options: rows.map((r) => (r.slug ? { label: r.label, slug: r.slug } : { label: r.label })),
      end_date: endDate,
    });
    if (saved) closePollSheet();
  };

  const remove = () => {
    removePostDraftPoll();
    closePollSheet();
  };

  const addIcon = resolveIcon(p.addIcon);
  const removeOptionIcon = resolveIcon(p.removeOptionIcon);
  const calendarIcon = resolveIcon(p.calendarIcon);
  const prevIcon = resolveIcon(p.prevIcon);
  const nextIcon = resolveIcon(p.nextIcon);
  const caretIcon = resolveIcon(p.monthCaretIcon);

  const endDateLabel =
    endDate !== '' ? formatPollEndDate(endDate, p.endDateFormat) : p.addEndDateLabel;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      className="appza-poll-sheet-backdrop"
      style={vars}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="appza-poll-sheet" {...appzetAttrs(slug)}>
        {p.showHandle && <div className="appza-poll-sheet-grabber" />}

        <div className="appza-poll-sheet-scroll">
          {p.showEyebrow && (
            <div
              className="appza-poll-sheet-eyebrow"
              style={cs[0]}
              {...childAttrs(slug, 0, 'ion-text')}
            >
              {p.eyebrow}
            </div>
          )}
          {p.showTitle && (
            <div
              className="appza-poll-sheet-title"
              style={cs[1]}
              {...childAttrs(slug, 1, 'ion-text')}
            >
              {p.title}
            </div>
          )}

          <div className="appza-poll-sheet-options">
            {rows.map((row, idx) => {
              const locked = !!row.slug;
              return (
                <div className="appza-poll-sheet-optionrow" key={row.key}>
                  <input
                    className="appza-poll-sheet-field"
                    style={idx === 0 ? cs[2] : undefined}
                    data-blanked={locked && row.label.trim() === '' ? 'yes' : 'no'}
                    placeholder={`${p.optionPlaceholder} ${idx + 1}`}
                    value={row.label}
                    onChange={(e) => updateRow(idx, e.target.value)}
                    {...(idx === 0 ? childAttrs(slug, 2, 'ion-input') : {})}
                  />
                  {!locked && canRemoveRows && (
                    <button
                      type="button"
                      className="appza-poll-sheet-optionremove"
                      aria-label={`Remove option ${idx + 1}`}
                      onClick={() => removeRow(idx)}
                    >
                      {removeOptionIcon ? <IonIcon icon={removeOptionIcon} /> : '×'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="appza-poll-sheet-add"
            style={cs[3]}
            onClick={addRow}
            {...childAttrs(slug, 3, 'ion-button')}
          >
            {addIcon && <IonIcon icon={addIcon} aria-hidden="true" />}
            <span>{p.addOptionLabel}</span>
          </button>

          {!existing && (
            <div
              className="appza-poll-sheet-segment"
              style={cs[4]}
              {...childAttrs(slug, 4, 'ion-segment')}
            >
              <button
                type="button"
                className="appza-poll-sheet-segbtn"
                data-active={type === 'single_choice' ? 'yes' : 'no'}
                onClick={() => setType('single_choice')}
              >
                {p.singleLabel}
              </button>
              <button
                type="button"
                className="appza-poll-sheet-segbtn"
                data-active={type === 'multi_choice' ? 'yes' : 'no'}
                onClick={() => setType('multi_choice')}
              >
                {p.multipleLabel}
              </button>
            </div>
          )}

          {p.showEndDate && (
            <button
              type="button"
              className="appza-poll-sheet-enddate"
              data-set={endDate !== '' ? 'yes' : 'no'}
              aria-expanded={calendarOpen}
              style={cs[5]}
              onClick={() => setCalendarOpen((v) => !v)}
              {...childAttrs(slug, 5, 'ion-button')}
            >
              {calendarIcon && <IonIcon icon={calendarIcon} aria-hidden="true" />}
              <span>{endDateLabel}</span>
            </button>
          )}

          {p.showEndDate && calendarOpen && (
            <>
              <div className="appza-poll-sheet-monthbar">
                <button
                  type="button"
                  className="appza-poll-sheet-month"
                  style={cs[6]}
                  aria-expanded={monthOpen}
                  onClick={() => setMonthOpen((v) => !v)}
                  {...childAttrs(slug, 6, 'ion-button')}
                >
                  <span>
                    {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
                  </span>
                  {caretIcon && <IonIcon icon={caretIcon} className="appza-poll-sheet-caret" />}
                </button>
                <div className="appza-poll-sheet-nav">
                  <button
                    type="button"
                    className="appza-poll-sheet-navbtn"
                    aria-label="Previous month"
                    onClick={() =>
                      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                    }
                  >
                    {prevIcon && <IonIcon icon={prevIcon} />}
                  </button>
                  <button
                    type="button"
                    className="appza-poll-sheet-navbtn"
                    aria-label="Next month"
                    onClick={() =>
                      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                    }
                  >
                    {nextIcon && <IonIcon icon={nextIcon} />}
                  </button>
                </div>
              </div>

              {monthOpen && (
                <div className="appza-poll-sheet-monthpicker">
                  <div className="appza-poll-sheet-yearrow">
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
                  <div className="appza-poll-sheet-monthgrid">
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
                className="appza-poll-sheet-weekdays"
                style={cs[7]}
                {...childAttrs(slug, 7, 'ion-text')}
              >
                {p.weekdays.map((d, i) => (
                  <span key={`${d}-${i}`}>{d}</span>
                ))}
              </div>

              <div className="appza-poll-sheet-grid">
                {cells.map((day, idx) => {
                  if (day === null) return <span key={`pad-${idx}`} />;
                  const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
                  const past = !p.allowPastEndDate && date.getTime() < today.getTime();
                  const isSelected = !!selected && ymd(selected) === ymd(date);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={past}
                      className={
                        'appza-poll-sheet-day' +
                        (past ? ' is-past' : '') +
                        (isSelected ? ' is-selected' : '')
                      }
                      onClick={() => {
                        setSelected(date);
                        commitEndDate(date, time);
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="appza-poll-sheet-timerow">
                <span
                  className="appza-poll-sheet-timelabel"
                  style={cs[8]}
                  {...childAttrs(slug, 8, 'ion-text')}
                >
                  {p.timeLabel}
                </span>
                <input
                  type="time"
                  className="appza-poll-sheet-time"
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value);
                    commitEndDate(selected, e.target.value);
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="appza-poll-sheet-footer">
          {p.showRemove && (
            <button type="button" className="appza-poll-sheet-remove" onClick={remove}>
              {p.removeLabel}
            </button>
          )}
          <button
            type="button"
            className="appza-poll-sheet-done"
            data-ready={canSave ? 'yes' : 'no'}
            disabled={!canSave}
            onClick={done}
          >
            {p.doneLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppzaDraftPollStrip({
  poll,
  label,
  optionsLabel,
  separator,
  editLabel,
  icon,
  removeIcon,
  onEdit,
  onRemove,
}: {
  poll: PostDraftPoll;
  label: string;
  optionsLabel: string;
  separator: string;
  editLabel: string;
  icon?: string;
  removeIcon?: string;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const glyph = icon ? resolveIcon(icon) : undefined;
  const close = removeIcon ? resolveIcon(removeIcon) : undefined;
  const count = poll.options.length;
  return (
    <span className="appza-draft-poll">
      {glyph && <IonIcon className="appza-draft-poll-icon" icon={glyph} aria-hidden="true" />}
      <span className="appza-draft-poll-text">
        {label}
        {separator}
        {optionsLabel.replace('{n}', String(count))}
      </span>
      {onEdit && (
        <button type="button" className="appza-draft-poll-edit" onClick={onEdit}>
          {editLabel}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          className="appza-draft-poll-remove"
          aria-label="Remove poll"
          onClick={onRemove}
        >
          {close ? <IonIcon icon={close} /> : '×'}
        </button>
      )}
    </span>
  );
}

export function AppzaPollPreview({
  poll,
  percentFormat,
  votesLabel,
  showVotes,
}: {
  poll: PostDraftPoll;
  percentFormat: string;
  votesLabel: string;
  showVotes: boolean;
}) {
  const isMulti = poll.type === 'multi_choice';
  const percent = percentFormat.replace('{whole}', '0').replace('{decimal}', '0');
  return (
    <span className="appza-poll-preview" data-type={poll.type}>
      {poll.options.map((option, i) => (
        <span className="appza-poll-preview-row" key={option.slug ?? `opt:${i}`}>
          <span className="appza-poll-preview-mark" data-shape={isMulti ? 'box' : 'circle'} />
          <span className="appza-poll-preview-label">{option.label}</span>
          <span className="appza-poll-preview-pct">{percent}</span>
        </span>
      ))}
      {showVotes && (
        <span className="appza-poll-preview-votes">{votesLabel.replace('{n}', '0')}</span>
      )}
    </span>
  );
}

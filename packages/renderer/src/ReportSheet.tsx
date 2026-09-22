import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';

/**
 * The report sheet — Courses doc, states 28–29 (a lesson comment's Report
 * Comment).
 *
 * "REPORT — Why are you reporting this?", the site's own reasons (FC's
 * `/report-reasons`, read by the handler), one pick with a check, "Add
 * details (Optional)" with a live N/1000 counter that cannot pass 1000,
 * and SUBMIT REPORT disabled until a reason is picked. While sending it
 * reads "Submitting…" and is disabled; on success the sheet closes (the
 * handler toasts); on failure it stays open with the pick and the text
 * kept and shows the server's message. It opens empty every time.
 *
 * The write is the same action that opened it, dispatched again with the
 * reason and details on its args — so the endpoint and body shape stay in
 * the catalog and in one handler.
 */

export type ReportReason = { value: string; label: string };

type OpenDetail = {
  reasons: ReportReason[];
  item: unknown;
  actionSlug: string;
  args: Record<string, unknown>;
};

const OPEN_EVENT = 'appza:open-report-sheet';
/** The handler's answer to a submit: `{ ok, message }`. */
export const REPORT_SHEET_RESULT_EVENT = 'appza:report-sheet-result';

export function openReportSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function announceReportResult(ok: boolean, message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REPORT_SHEET_RESULT_EVENT, { detail: { ok, message } }));
}

function word(args: Record<string, unknown>, key: string, fallback: string): string {
  const v = args[key];
  return typeof v === 'string' && v !== '' ? v : fallback;
}

export function ReportSheet() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useActionDispatch();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<OpenDetail>).detail;
      if (!d) return;
      // "The sheet opens empty every time."
      setReason('');
      setDetails('');
      setSending(false);
      setError('');
      setDetail(d);
    };
    const onResult = (e: Event) => {
      const r = (e as CustomEvent<{ ok: boolean; message: string }>).detail;
      setSending(false);
      if (r?.ok) {
        setDetail(null);
      } else {
        setError(r?.message ?? '');
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(REPORT_SHEET_RESULT_EVENT, onResult);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(REPORT_SHEET_RESULT_EVENT, onResult);
    };
  }, []);

  if (!detail) return null;
  const a = detail.args;
  const max = typeof a.details_max === 'number' && a.details_max > 0 ? a.details_max : 1000;
  const checkIcon = resolveIcon('checkmark');

  const submit = () => {
    if (!reason || sending) return;
    setSending(true);
    setError('');
    dispatch({
      action_slug: detail.actionSlug,
      args: { ...a, reason, explanation: details.trim(), from_report_sheet: true },
      item: detail.item,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={word(a, 'sheet_title', 'Why are you reporting this?')}
      className="appza-member-sheet-backdrop"
      onClick={(e) => {
        // "Closing the sheet without submitting reports nothing."
        if (e.target === e.currentTarget && !sending) setDetail(null);
      }}
    >
      <div className="appza-member-sheet appza-report-sheet">
        <div className="appza-member-sheet-handle" />
        <div className="appza-member-sheet-subject">{word(a, 'sheet_eyebrow', 'REPORT')}</div>
        <div className="appza-member-sheet-title">{word(a, 'sheet_title', 'Why are you reporting this?')}</div>
        <div className="appza-member-sheet-list">
          {detail.reasons.map((r) => {
            const picked = r.value === reason;
            return (
              <button
                key={r.value}
                type="button"
                className={'appza-member-sheet-row appza-member-role-row' + (picked ? ' is-current' : '')}
                onClick={() => !sending && setReason(r.value)}
              >
                <span className="appza-member-role-label">{r.label}</span>
                {picked && checkIcon && <IonIcon icon={checkIcon} className="appza-member-role-check" />}
              </button>
            );
          })}
        </div>
        <div className="appza-report-details">
          <div className="appza-report-details-label">{word(a, 'details_label', 'Add details (Optional)')}</div>
          <textarea
            className="appza-report-details-input"
            rows={1}
            maxLength={max}
            placeholder={word(a, 'details_placeholder', 'Anything the moderators should know')}
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, max))}
          />
          <div className="appza-report-details-counter">
            {details.length}/{max}
          </div>
        </div>
        {error && <div className="appza-report-error">{error}</div>}
        <button type="button" className="appza-report-submit" disabled={!reason || sending} onClick={submit}>
          {sending ? word(a, 'submitting_label', 'Submitting…') : word(a, 'submit_label', 'SUBMIT REPORT')}
        </button>
      </div>
    </div>
  );
}

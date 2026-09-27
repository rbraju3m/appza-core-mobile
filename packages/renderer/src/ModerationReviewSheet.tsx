import { useEffect, useState } from 'react';
import { useBackDismiss } from './backStack';

/**
 * The moderation review modal — Noor's designs 29 and 30.
 *
 * Opened by an ACTION rather than mounted by a placement, like the poll
 * voters sheet and the options sheet, so it fetches its own list and has
 * no useDataSource anywhere in its tree. No URL is written down here:
 * every endpoint arrives from the catalog action's args (D51).
 *
 * Two tabs, and only one of them fetches. **Details** draws the content
 * the banner was attached to, which the caller already holds — the row
 * that drew the banner IS the post — so opening the modal shows
 * something instantly rather than a spinner over a post you were just
 * looking at. **Reports** is the fetch.
 *
 * The CTAs do not act here. They hand their verb to `onAct`, and
 * moderationActions opens the doc's confirm and sends the write. This
 * modal closes when that write reports success, which it announces on a
 * window event — the confirm can be cancelled, so closing optimistically
 * would be a lie.
 *
 * Opened two ways. From the flagged banner on a post it offers Dismiss and
 * Unpublish, as it always has. From a report row on the Moderation screen
 * (doc states 9–32) the row says which of the four buttons its status
 * allows — Dismiss, Unpublish, Publish, Delete — and which report they act
 * on.
 */

export type ModerationReport = {
  id?: number | string;
  /** Derived by the plug-in: the bold line design 30 draws. */
  headline?: string;
  explanation?: string;
  created_at?: string;
  created_at_relative?: string;
  reason?: string;
  reason_label?: string;
  reporter_name?: string;
  /** Design 12's face. Empty on an auto-flag. */
  reporter_avatar?: string;
  is_auto_flagged?: boolean;
};

/** The four verbs a review can offer. */
export type ModerationReviewAct = 'dismiss' | 'unpublish' | 'publish' | 'delete';

export type ModerationReviewPresentation = {
  detailsTabLabel: string;
  reportsTabLabel: string;
  dismissLabel: string;
  unpublishLabel: string;
  publishLabel: string;
  deleteLabel: string;
  /** Design 28's bold line over an auto-flag, in place of a reporter. */
  autoFlagHeading: string;
  /** Design 12's "Reported for Spam" under the reporter's name. */
  reportedForPrefix: string;
  reportedAtPrefix: string;
  postedInPrefix: string;
  emptyLabel: string;
  loadingLabel: string;
  dismissConfirmTitle: string;
  dismissConfirmMessage: string;
  dismissConfirmCta: string;
  unpublishConfirmTitle: string;
  unpublishConfirmMessage: string;
  unpublishConfirmCta: string;
  publishConfirmTitle: string;
  publishConfirmMessage: string;
  publishConfirmCta: string;
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  deleteConfirmCta: string;
  /** The actions the CTAs dispatch. See the note on their catalog props. */
  setStatusActionSlug: string;
  deleteActionSlug: string;
};

export type ModerationReviewOpenDetail = {
  /** Where the reports live. From the action's param_schema. */
  endpoint: string;
  /** `post_id` for a post, `parent_id` for a comment — FC Pro's own split. */
  idParam: string;
  contentId: number | string;
  contentType: string;
  content: {
    title?: string;
    bodyHtml?: string;
    authorName?: string;
    authorAvatar?: string;
    spaceTitle?: string;
    reportedAt?: string;
    /** Design 9's picture under the words. */
    mediaUrl?: string;
  };
  /**
   * Which buttons to draw. Absent on the banner path, which offers Dismiss
   * and Unpublish.
   */
  buttons?: Partial<Record<ModerationReviewAct, boolean>>;
  /**
   * The report the buttons act on. From a report row it is that row's; on
   * the banner path it is the first fetched report.
   */
  reportId?: number | string;
  presentation: ModerationReviewPresentation;
  authHeader?: string;
  /** Fired for each CTA; moderationActions owns the confirm + request. */
  onAct: (act: ModerationReviewAct, reportId: number | string) => void;
};

const OPEN_EVENT = 'appza:open-moderation-review';
/** The app announces a successful status write here; we close on it. */
export const MODERATION_DONE_EVENT = 'appza:moderation-review-done';

export function openModerationReview(detail: ModerationReviewOpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ModerationReviewOpenDetail>(OPEN_EVENT, { detail }));
}

export function announceModerationDone(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MODERATION_DONE_EVENT));
}

function readReports(payload: unknown): ModerationReport[] {
  if (!payload || typeof payload !== 'object') return [];
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter((v): v is ModerationReport => !!v && typeof v === 'object' && !Array.isArray(v));
}

export function ModerationReviewSheet() {
  const [open, setOpen] = useState<ModerationReviewOpenDetail | null>(null);
  const [reports, setReports] = useState<ModerationReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'details' | 'reports'>('details');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<ModerationReviewOpenDetail>).detail;
      setReports(null);
      setError(null);
      setTab('details');
      setOpen(detail);
    };
    const onDone = () => setOpen(null);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(MODERATION_DONE_EVENT, onDone);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(MODERATION_DONE_EVENT, onDone);
    };
  }, []);

  // Fetched on OPEN rather than on first tab switch: the Reports tab
  // carries its own count in the label, so the number has to be known
  // before anyone taps it.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const url =
      `${open.endpoint}?${encodeURIComponent(open.idParam)}=${encodeURIComponent(String(open.contentId))}` +
      `&content_type=${encodeURIComponent(open.contentType)}&per_page=20`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (open.authHeader) headers.Authorization = open.authHeader;
    // `omit`: a wp-admin cookie would shadow the application password
    // and WP core would answer as a guest (see dataFetch fetchProxyText).
    void fetch(url, { headers, credentials: 'omit' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setReports(readReports(j));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useBackDismiss(!(!open), () => setOpen(null));

  if (!open) return null;
  const p = open.presentation;
  const count = reports?.length ?? 0;
  // FluentCommunity acts on reports.data[0] and its update marks every
  // report on the content anyway, so on the banner path the first is the
  // one to send. A report row names its own — Delete removes that one.
  const actableId =
    open.reportId ?? (reports && reports.length > 0 ? reports[0]?.id : undefined);
  const canAct = actableId !== undefined && actableId !== null;
  const buttons = open.buttons ?? { dismiss: true, unpublish: true };
  // Design order: Dismiss · Unpublish · Publish · Delete, drawing only
  // those this report's status allows (designs 9, 26, 31).
  const cta: Array<{ act: ModerationReviewAct; label: string; className: string }> = [
    { act: 'dismiss', label: p.dismissLabel, className: 'appza-modreview-dismiss' },
    { act: 'unpublish', label: p.unpublishLabel, className: 'appza-modreview-unpublish' },
    { act: 'publish', label: p.publishLabel, className: 'appza-modreview-unpublish' },
    { act: 'delete', label: p.deleteLabel, className: 'appza-modreview-delete' },
  ];

  return (
    <div className="appza-modreview-backdrop" onClick={() => setOpen(null)}>
      <div className="appza-modreview" onClick={(e) => e.stopPropagation()}>
        <div className="appza-modreview-head">
          {open.content.authorAvatar ? (
            <img className="appza-modreview-avatar" src={open.content.authorAvatar} alt="" />
          ) : (
            <span className="appza-modreview-avatar" />
          )}
          <div className="appza-modreview-who">
            <span className="appza-modreview-name">{open.content.authorName ?? ''}</span>
            {open.content.spaceTitle && (
              <span className="appza-modreview-space">
                {p.postedInPrefix} {open.content.spaceTitle}
              </span>
            )}
          </div>
          {/* Every design draws a close cross; the backdrop tap is not
              discoverable. */}
          <button
            type="button"
            className="appza-modreview-close"
            aria-label="Close"
            onClick={() => setOpen(null)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {open.content.reportedAt && (
          <span className="appza-modreview-reported">
            {p.reportedAtPrefix} {open.content.reportedAt}
          </span>
        )}

        <div className="appza-modreview-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'details'}
            className={`appza-modreview-tab${tab === 'details' ? ' is-active' : ''}`}
            onClick={() => setTab('details')}
          >
            {p.detailsTabLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'reports'}
            className={`appza-modreview-tab${tab === 'reports' ? ' is-active' : ''}`}
            onClick={() => setTab('reports')}
          >
            {p.reportsTabLabel}({count})
          </button>
        </div>

        <div className="appza-modreview-body">
          {tab === 'details' && (
            <div className="appza-modreview-content">
              {open.content.title && (
                <div className="appza-modreview-content-title">{open.content.title}</div>
              )}
              {open.content.bodyHtml && (
                <div
                  className="appza-modreview-content-body"
                  dangerouslySetInnerHTML={{ __html: open.content.bodyHtml }}
                />
              )}
              {open.content.mediaUrl && (
                <img className="appza-modreview-content-media" src={open.content.mediaUrl} alt="" />
              )}
            </div>
          )}
          {tab === 'reports' && (
            <>
              {error && <div className="appza-modreview-empty">{error}</div>}
              {!error && reports === null && (
                <div className="appza-modreview-empty">{p.loadingLabel}</div>
              )}
              {!error && reports !== null && reports.length === 0 && (
                <div className="appza-modreview-empty">{p.emptyLabel}</div>
              )}
              {!error &&
                reports !== null &&
                reports.map((r, i) => {
                  const time = r.created_at_relative ?? r.created_at ?? '';
                  const why = r.explanation || (r.is_auto_flagged ? r.reason_label : '') || '';
                  // An auto-flag has no one behind it: design 28 draws the
                  // site rule as the heading and the rule's reason below.
                  if (r.is_auto_flagged || !r.reporter_name) {
                    return (
                      <div className="appza-modreview-report is-auto" key={r.id ?? i}>
                        <div className="appza-modreview-report-head">
                          {r.is_auto_flagged ? p.autoFlagHeading : (r.headline ?? '')}
                        </div>
                        <div className="appza-modreview-report-time">{time}</div>
                        {why && <div className="appza-modreview-report-why">{why}</div>}
                      </div>
                    );
                  }
                  // Design 12: face, name, "Reported for Spam", time, note.
                  return (
                    <div className="appza-modreview-report is-person" key={r.id ?? i}>
                      {r.reporter_avatar ? (
                        <img className="appza-modreview-report-avatar" src={r.reporter_avatar} alt="" />
                      ) : (
                        <span className="appza-modreview-report-avatar" />
                      )}
                      <div className="appza-modreview-report-main">
                        <div className="appza-modreview-report-head">{r.reporter_name}</div>
                        {r.reason_label && (
                          <div className="appza-modreview-report-reason">
                            {p.reportedForPrefix} {r.reason_label}
                          </div>
                        )}
                        <div className="appza-modreview-report-time">{time}</div>
                        {why && <div className="appza-modreview-report-why">{why}</div>}
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>

        <div className="appza-modreview-foot">
          {cta
            .filter((b) => buttons[b.act])
            .map((b) => (
              <button
                key={b.act}
                type="button"
                className={b.className}
                disabled={!canAct}
                onClick={() => canAct && open.onAct(b.act, actableId!)}
              >
                {b.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

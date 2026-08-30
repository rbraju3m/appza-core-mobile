import { useEffect, useState } from 'react';

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
 * The two CTAs do not act here. They dispatch `moderation.set_status`
 * and the app-side dispatcher runs the same confirm-then-request path
 * `post.delete` uses, because designs 31 and 32 are that dialog and the
 * stakes are the same: FluentCommunity marks every report on the content
 * and republishes or unpublishes it. This modal closes when that path
 * reports success, which it announces on a window event — the confirm
 * can be cancelled, so closing optimistically would be a lie.
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
};

export type ModerationReviewPresentation = {
  detailsTabLabel: string;
  reportsTabLabel: string;
  dismissLabel: string;
  unpublishLabel: string;
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
  /** The action the CTAs dispatch. See the note on its catalog prop. */
  setStatusActionSlug: string;
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
  };
  presentation: ModerationReviewPresentation;
  authHeader?: string;
  /** Fired for each CTA; the app dispatcher owns the confirm + request. */
  onAct: (status: 'ignored' | 'unpublished', reportId: number | string) => void;
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
    if (open.authHeader) {
      headers.Authorization = open.authHeader;
      headers['X-Appza-Auth'] = open.authHeader;
    }
    void fetch(url, { headers, credentials: 'same-origin' })
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

  if (!open) return null;
  const p = open.presentation;
  const count = reports?.length ?? 0;
  // FluentCommunity acts on reports.data[0] and its update marks every
  // report on the content anyway, so the first is the one to send.
  const actableId = reports && reports.length > 0 ? reports[0]?.id : undefined;
  const canAct = actableId !== undefined && actableId !== null;

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
                reports.map((r, i) => (
                  <div className="appza-modreview-report" key={r.id ?? i}>
                    <div className="appza-modreview-report-head">{r.headline ?? ''}</div>
                    <div className="appza-modreview-report-time">
                      {r.created_at_relative ?? r.created_at ?? ''}
                    </div>
                    {r.explanation && (
                      <div className="appza-modreview-report-why">{r.explanation}</div>
                    )}
                  </div>
                ))}
            </>
          )}
        </div>

        <div className="appza-modreview-foot">
          <button
            type="button"
            className="appza-modreview-dismiss"
            disabled={!canAct}
            onClick={() => canAct && open.onAct('ignored', actableId!)}
          >
            {p.dismissLabel}
          </button>
          <button
            type="button"
            className="appza-modreview-unpublish"
            disabled={!canAct}
            onClick={() => canAct && open.onAct('unpublished', actableId!)}
          >
            {p.unpublishLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

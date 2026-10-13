import { useEffect, useState } from 'react';
import { useBackDismiss } from './backStack';
import { appzetAttrs } from './designTimeAttrs';

// The CTAs only hand their verb to onAct; the modal closes on MODERATION_DONE_EVENT, since the confirm can still be cancelled.

export type ModerationReport = {
  id?: number | string;
  headline?: string;
  explanation?: string;
  created_at?: string;
  created_at_relative?: string;
  reason?: string;
  reason_label?: string;
  reporter_name?: string;
  reporter_avatar?: string;
  is_auto_flagged?: boolean;
};

export type ModerationReviewAct = 'dismiss' | 'unpublish' | 'publish' | 'delete';

export type ModerationReviewPresentation = {
  detailsTabLabel: string;
  reportsTabLabel: string;
  dismissLabel: string;
  unpublishLabel: string;
  publishLabel: string;
  deleteLabel: string;
  autoFlagHeading: string;
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
  setStatusActionSlug: string;
  deleteActionSlug: string;
};

export type ModerationReviewOpenDetail = {
  endpoint: string;
  // `post_id` for a post, `parent_id` for a comment: FC Pro's own split.
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
    mediaUrl?: string;
  };
  buttons?: Partial<Record<ModerationReviewAct, boolean>>;
  reportId?: number | string;
  presentation: ModerationReviewPresentation;
  /** Its sheet AppZet: the overlay design stylesheet finds the root by it. */
  appzetSlug?: string;
  authHeader?: string;
  onAct: (act: ModerationReviewAct, reportId: number | string) => void;
};

const OPEN_EVENT = 'appza:open-moderation-review';
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

  // Fetched on open: the Reports tab label carries the count.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const url =
      `${open.endpoint}?${encodeURIComponent(open.idParam)}=${encodeURIComponent(String(open.contentId))}` +
      `&content_type=${encodeURIComponent(open.contentType)}&per_page=20`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (open.authHeader) headers.Authorization = open.authHeader;
    // `omit`: a wp-admin cookie would shadow the application password and WP would answer as a guest.
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
  // FC acts on reports.data[0] and marks every report on the content, so the banner path sends the first.
  const actableId =
    open.reportId ?? (reports && reports.length > 0 ? reports[0]?.id : undefined);
  const canAct = actableId !== undefined && actableId !== null;
  const buttons = open.buttons ?? { dismiss: true, unpublish: true };
  const cta: Array<{ act: ModerationReviewAct; label: string; className: string }> = [
    { act: 'dismiss', label: p.dismissLabel, className: 'appza-modreview-dismiss' },
    { act: 'unpublish', label: p.unpublishLabel, className: 'appza-modreview-unpublish' },
    { act: 'publish', label: p.publishLabel, className: 'appza-modreview-unpublish' },
    { act: 'delete', label: p.deleteLabel, className: 'appza-modreview-delete' },
  ];

  return (
    <div className="appza-modreview-backdrop" onClick={() => setOpen(null)}>
      <div className="appza-modreview" onClick={(e) => e.stopPropagation()} {...(open.appzetSlug ? appzetAttrs(open.appzetSlug) : {})}>
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

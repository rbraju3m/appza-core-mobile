import { useEffect, useState } from 'react';
import { useBackDismiss } from './backStack';

export type PollVotersOpenDetail = {
  endpoint: string;
  feedId: number | string;
  optionSlug: string;
  optionLabel?: string;
  title: string;
  emptyMessage: string;
  authHeader?: string;
};

type Voter = {
  id?: number;
  xprofile?: { display_name?: string; avatar?: string; user_id?: number };
};

const OPEN_EVENT = 'appza:open-poll-voters-sheet';

export function openPollVotersSheet(detail: PollVotersOpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PollVotersOpenDetail>(OPEN_EVENT, { detail }));
}

function readVoters(payload: unknown): Voter[] {
  if (!payload || typeof payload !== 'object') return [];
  const items = (payload as { items?: unknown }).items;
  const raw =
    items && typeof items === 'object' && !Array.isArray(items)
      ? (items as { voters?: unknown }).voters
      : items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is Voter => !!v && typeof v === 'object' && !Array.isArray(v));
}

export function PollVotersSheet() {
  const [open, setOpen] = useState<PollVotersOpenDetail | null>(null);
  const [voters, setVoters] = useState<Voter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<PollVotersOpenDetail>).detail;
      setVoters(null);
      setError(null);
      setOpen(detail);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const url =
      `${open.endpoint}?feed_id=${encodeURIComponent(String(open.feedId))}` +
      `&option_slug=${encodeURIComponent(open.optionSlug)}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (open.authHeader) headers.Authorization = open.authHeader;
    // `omit`: a wp-admin cookie would shadow the app password and WP would answer as a guest.
    void fetch(url, { headers, credentials: 'omit' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setVoters(readVoters(j));
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

  return (
    <div className="appza-poll-voters-backdrop" onClick={() => setOpen(null)}>
      <div className="appza-poll-voters-sheet" onClick={(e) => e.stopPropagation()}>
        <span className="appza-poll-voters-handle" />
        <div className="appza-poll-voters-title">
          {open.title}
          {open.optionLabel ? ` · ${open.optionLabel}` : ''}
        </div>
        {error && <div className="appza-poll-voters-empty">{error}</div>}
        {!error && voters === null && (
          <div className="appza-poll-voters-empty">Loading…</div>
        )}
        {!error && voters !== null && voters.length === 0 && (
          <div className="appza-poll-voters-empty">{open.emptyMessage}</div>
        )}
        {!error && voters !== null && voters.length > 0 && (
          <ul className="appza-poll-voters-list">
            {voters.map((v, i) => (
              <li className="appza-poll-voters-row" key={v.id ?? i}>
                {v.xprofile?.avatar ? (
                  <img className="appza-poll-voters-avatar" src={v.xprofile.avatar} alt="" />
                ) : (
                  <span className="appza-poll-voters-avatar" />
                )}
                <span className="appza-poll-voters-name">
                  {v.xprofile?.display_name ?? ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

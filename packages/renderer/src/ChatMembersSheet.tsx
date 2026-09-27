import { useEffect, useState, type CSSProperties } from 'react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { useBackDismiss } from './backStack';

/**
 * The members sheet behind the 3-dot menu on a space or group
 * conversation (design 3): a count line, the conversation's title, every
 * member with their role, then VIEW COMMUNITY and Leave group.
 *
 * Bespoke React, opened by event, like the other sheets — it fetches its
 * own list and has to sit above the whole screen rather than in a
 * placement slot. It opts back into the builder by hand via
 * childAttrs/appzetAttrs, so the indices below MUST match the `children`
 * array of the fc-chat-members-sheet superstructure.
 *
 * The member list is fetched here rather than passed in, for the reason
 * the invitations tab is: the sheet is opened by an action, not mounted
 * by a placement, so there is no useDataSource in its tree. The shell
 * resolves the DataSource's endpoint out of the catalog and hands it
 * over — no URL is written down in this file.
 */

export const CHAT_MEMBERS_SHEET_APPZET_SLUG = 'fc-chat-members-sheet';
export const CHAT_MEMBERS_SHEET_CHILD_COUNT = 8;

export type ChatMembersPresentation = {
  membersLabel: string;
  viewCommunityLabel: string;
  leaveLabel: string;
  emptyLabel: string;
  usernamePrefix: string;
  /** role slug → the pill's label. Anything unlisted shows no pill. */
  roleLabels: Record<string, string>;
  /** role slug → [background, text] for its pill. */
  roleColors: Record<string, [string, string]>;
  showViewCommunity: boolean;
  showLeave: boolean;
  hidden: boolean;
  sheetBgColor?: string;
  sheetRadius?: string;
  countColor?: string;
  countSize?: string;
  titleColor?: string;
  titleSize?: string;
  nameColor?: string;
  nameSize?: string;
  handleColor?: string;
  avatarSize?: string;
  rowGap?: string;
  viewCommunityColor?: string;
  viewCommunityBorderColor?: string;
  leaveColor?: string;
};

export type ChatMember = {
  user_id?: number | string;
  display_name?: string;
  username?: string;
  avatar?: string;
  role?: string;
  is_group_admin?: boolean;
};

type OpenDetail = {
  appzetSlug?: string;
  /** The thread row — title, member_count, space_slug, permissions. */
  thread: Record<string, unknown>;
  presentation: ChatMembersPresentation;
  /** Resolved from the catalog by the shell; absolute in the app (P60). */
  listEndpoint: string;
  authHeader?: string;
  onViewCommunity?: (thread: Record<string, unknown>) => void;
  onLeave?: (thread: Record<string, unknown>) => void;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-chat-members-sheet';
const CLOSE_EVENT = 'appza:close-chat-members-sheet';

export function openChatMembersSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeChatMembersSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function ChatMembersSheet() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setMembers([]);
    };
    const onClose = () => setDetail(null);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  const threadId = detail?.thread?.id;
  const listEndpoint = detail?.listEndpoint;
  const authHeader = detail?.authHeader;

  useEffect(() => {
    if (!listEndpoint || threadId === undefined || threadId === null) return;
    let cancelled = false;
    setLoading(true);
    const url = `${listEndpoint}${listEndpoint.includes('?') ? '&' : '?'}thread_id=${encodeURIComponent(String(threadId))}`;
    void (async () => {
      try {
        const res = await fetch(url, {
          credentials: 'omit',
          headers: authHeader
            ? { Accept: 'application/json', Authorization: authHeader }
            : { Accept: 'application/json' },
        });
        const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const rows =
          (Array.isArray(json?.data) && json?.data) ||
          (Array.isArray(json?.items) && json?.items) ||
          [];
        if (!cancelled) setMembers(rows as ChatMember[]);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listEndpoint, threadId, authHeader]);

  useBackDismiss(!(!detail || detail.presentation.hidden), () => setDetail(null));

  if (!detail || detail.presentation.hidden) return null;

  const p = detail.presentation;
  const slug = detail.appzetSlug ?? CHAT_MEMBERS_SHEET_APPZET_SLUG;
  const cs = detail.childStyles ?? {};
  const title = typeof detail.thread.title === 'string' ? detail.thread.title : '';
  // The count on the sheet is the list it is showing, falling back to the
  // thread's own tally while the fetch is still in flight — so the header
  // never reads "0 MEMBERS" over a list that is about to arrive.
  const count = members.length > 0
    ? members.length
    : Number(detail.thread.member_count ?? 0) || 0;

  const vars: CSSProperties = {
    ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
    ['--appza-sheet-radius' as string]: p.sheetRadius,
    ['--appza-count-color' as string]: p.countColor,
    ['--appza-count-size' as string]: p.countSize,
    ['--appza-title-color' as string]: p.titleColor,
    ['--appza-title-size' as string]: p.titleSize,
    ['--appza-name-color' as string]: p.nameColor,
    ['--appza-name-size' as string]: p.nameSize,
    ['--appza-handle-color' as string]: p.handleColor,
    ['--appza-avatar-size' as string]: p.avatarSize,
    ['--appza-row-gap' as string]: p.rowGap,
    ['--appza-view-community-color' as string]: p.viewCommunityColor,
    ['--appza-view-community-border-color' as string]: p.viewCommunityBorderColor,
    ['--appza-leave-color' as string]: p.leaveColor,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="appza-chat-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeChatMembersSheet();
      }}
    >
      <div className="appza-chat-sheet" style={vars} {...appzetAttrs(slug)}>
        <div className="appza-chat-sheet-grabber" />

        <div className="appza-chat-sheet-count" style={cs[0]} {...childAttrs(slug, 0, 'ion-text')}>
          {count} {p.membersLabel}
        </div>
        <div className="appza-chat-sheet-title" style={cs[1]} {...childAttrs(slug, 1, 'ion-text')}>
          {title}
        </div>

        <div className="appza-chat-sheet-list">
          {members.map((m, i) => {
            const name = typeof m.display_name === 'string' ? m.display_name : '';
            const handle = typeof m.username === 'string' && m.username !== ''
              ? p.usernamePrefix + m.username
              : '';
            // A group thread reports `is_group_admin` instead of a space
            // role, so the two are folded into one lookup here rather
            // than branching the row.
            const role = m.is_group_admin ? 'admin' : (typeof m.role === 'string' ? m.role : '');
            const roleLabel = p.roleLabels[role];
            const roleColor = p.roleColors[role];
            return (
              <div className="appza-chat-sheet-row" key={`${m.user_id ?? i}`}>
                <span
                  className="appza-chat-sheet-avatar"
                  style={cs[2]}
                  {...(i === 0 ? childAttrs(slug, 2, 'ion-avatar') : {})}
                >
                  {m.avatar ? (
                    <img src={m.avatar} alt={name} loading="lazy" />
                  ) : (
                    <span className="appza-chat-sheet-avatar-fallback">{initialsOf(name)}</span>
                  )}
                </span>
                <span
                  className="appza-chat-sheet-name"
                  style={cs[3]}
                  {...(i === 0 ? childAttrs(slug, 3, 'ion-text') : {})}
                >
                  {name}
                </span>
                <span
                  className="appza-chat-sheet-handle"
                  style={cs[4]}
                  {...(i === 0 ? childAttrs(slug, 4, 'ion-text') : {})}
                >
                  {handle}
                </span>
                {roleLabel && (
                  <span
                    className="appza-chat-sheet-role"
                    style={{
                      ...(cs[5] ?? {}),
                      background: roleColor?.[0],
                      color: roleColor?.[1],
                    }}
                    {...(i === 0 ? childAttrs(slug, 5, 'ion-chip') : {})}
                  >
                    {roleLabel}
                  </span>
                )}
              </div>
            );
          })}
          {!loading && members.length === 0 && (
            <div className="appza-chat-sheet-empty">{p.emptyLabel}</div>
          )}
        </div>

        <div className="appza-chat-sheet-actions">
          {p.showViewCommunity && (
            <button
              type="button"
              className="appza-chat-sheet-view"
              style={cs[6]}
              {...childAttrs(slug, 6, 'ion-button')}
              onClick={() => detail.onViewCommunity?.(detail.thread)}
            >
              {p.viewCommunityLabel}
            </button>
          )}
          {p.showLeave && (
            <button
              type="button"
              className="appza-chat-sheet-leave"
              style={cs[7]}
              {...childAttrs(slug, 7, 'ion-button')}
              onClick={() => detail.onLeave?.(detail.thread)}
            >
              {p.leaveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

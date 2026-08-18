import { useEffect, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';

/**
 * The profile card behind the 3-dot menu on a one-to-one conversation
 * (designs 5 and 6): avatar, name, a copyable @handle, the activity
 * line, then BLOCK USER and DELETE CONVERSATION.
 *
 * A centred card rather than a bottom sheet, because that is what the
 * designs show — the members sheet for a space rises from the bottom,
 * this one sits in the middle.
 *
 * The two designs differ in exactly one string. FluentCommunity blanks
 * its own `last_activity` once it is older than five minutes, so the API
 * answers the question with a boolean and both wordings are props —
 * neither is computed here.
 *
 * Bespoke React, opened by event, and it opts back into the builder by
 * hand: the indices below MUST match the `children` array of the
 * fc-chat-user-card superstructure.
 */

export const CHAT_USER_CARD_APPZET_SLUG = 'fc-chat-user-card';
export const CHAT_USER_CARD_CHILD_COUNT = 8;

export type ChatUserCardPresentation = {
  activeLabel: string;
  inactiveLabel: string;
  blockLabel: string;
  unblockLabel: string;
  deleteLabel: string;
  copiedToast: string;
  closeIcon: string;
  copyIcon: string;
  infoIcon: string;
  showBlock: boolean;
  showDelete: boolean;
  hidden: boolean;
  cardBgColor?: string;
  cardRadius?: string;
  avatarSize?: string;
  nameColor?: string;
  nameSize?: string;
  handleBgColor?: string;
  handleTextColor?: string;
  handleRadius?: string;
  activityColor?: string;
  infoIconColor?: string;
  blockColor?: string;
  blockBorderColor?: string;
  deleteColor?: string;
  deleteBorderColor?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  /** The thread row — title, photo, initials, handle, is_active_now. */
  thread: Record<string, unknown>;
  presentation: ChatUserCardPresentation;
  onBlock?: (thread: Record<string, unknown>) => void;
  onDelete?: (thread: Record<string, unknown>) => void;
  onCopy?: (handle: string) => void;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-chat-user-card';
const CLOSE_EVENT = 'appza:close-chat-user-card';

export function openChatUserCard(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeChatUserCard(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

function str(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  return typeof v === 'string' ? v : '';
}

export function ChatUserCard() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (ce.detail) setDetail(ce.detail);
    };
    const onClose = () => setDetail(null);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  if (!detail || detail.presentation.hidden) return null;

  const p = detail.presentation;
  const slug = detail.appzetSlug ?? CHAT_USER_CARD_APPZET_SLUG;
  const cs = detail.childStyles ?? {};
  const t = detail.thread;

  const name = str(t, 'title');
  const photo = str(t, 'photo');
  const initials = str(t, 'initials');
  const handle = str(t, 'handle');
  const isActive = t.is_active_now === true;
  const isBlocked = t.is_blocked === true;

  const vars: CSSProperties = {
    ['--appza-card-bg-color' as string]: p.cardBgColor,
    ['--appza-card-radius' as string]: p.cardRadius,
    ['--appza-avatar-size' as string]: p.avatarSize,
    ['--appza-name-color' as string]: p.nameColor,
    ['--appza-name-size' as string]: p.nameSize,
    ['--appza-handle-bg-color' as string]: p.handleBgColor,
    ['--appza-handle-text-color' as string]: p.handleTextColor,
    ['--appza-handle-radius' as string]: p.handleRadius,
    ['--appza-activity-color' as string]: p.activityColor,
    ['--appza-info-icon-color' as string]: p.infoIconColor,
    ['--appza-block-color' as string]: p.blockColor,
    ['--appza-block-border-color' as string]: p.blockBorderColor,
    ['--appza-delete-color' as string]: p.deleteColor,
    ['--appza-delete-border-color' as string]: p.deleteBorderColor,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="appza-chat-card-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeChatUserCard();
      }}
    >
      <div className="appza-chat-card" style={vars} {...appzetAttrs(slug)}>
        <button
          type="button"
          className="appza-chat-card-close"
          aria-label="Close"
          style={cs[0]}
          {...childAttrs(slug, 0, 'ion-button')}
          onClick={() => closeChatUserCard()}
        >
          <IonIcon icon={resolveIcon(p.closeIcon || 'close')} />
        </button>

        <span className="appza-chat-card-avatar" style={cs[1]} {...childAttrs(slug, 1, 'ion-avatar')}>
          {photo !== '' ? (
            <img src={photo} alt={name} />
          ) : (
            <span className="appza-chat-card-avatar-fallback">{initials}</span>
          )}
        </span>

        <div className="appza-chat-card-name" style={cs[2]} {...childAttrs(slug, 2, 'ion-text')}>
          {name}
        </div>

        <button
          type="button"
          className="appza-chat-card-handle"
          style={cs[3]}
          {...childAttrs(slug, 3, 'ion-button')}
          onClick={() => detail.onCopy?.(handle)}
        >
          <IonIcon icon={resolveIcon(p.copyIcon || 'copy-outline')} />
          <span>{handle}</span>
        </button>

        <div className="appza-chat-card-activity">
          <IonIcon
            className="appza-chat-card-activity-icon"
            icon={resolveIcon(p.infoIcon || 'information-circle')}
            style={cs[4]}
            {...childAttrs(slug, 4, 'ion-icon')}
          />
          <span style={cs[5]} {...childAttrs(slug, 5, 'ion-text')}>
            {isActive ? p.activeLabel : p.inactiveLabel}
          </span>
        </div>

        {p.showBlock && (
          <button
            type="button"
            className="appza-chat-card-block"
            style={cs[6]}
            {...childAttrs(slug, 6, 'ion-button')}
            onClick={() => detail.onBlock?.(t)}
          >
            {isBlocked ? p.unblockLabel : p.blockLabel}
          </button>
        )}
        {p.showDelete && (
          <button
            type="button"
            className="appza-chat-card-delete"
            style={cs[7]}
            {...childAttrs(slug, 7, 'ion-button')}
            onClick={() => detail.onDelete?.(t)}
          >
            {p.deleteLabel}
          </button>
        )}
      </div>
    </div>
  );
}

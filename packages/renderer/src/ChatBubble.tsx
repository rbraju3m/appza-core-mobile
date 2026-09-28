import { useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { setChatControls, useChatControls } from './chatControls';

// No `on_click_action` in the catalog on purpose: it would stamp data-appza-inline-click and hijack the pointer before these gestures.

const DEFAULT_SWIPE_THRESHOLD = 48;
const MAX_DRAG_PX = 72;
const TAP_SLOP_PX = 6;

function str(o: Record<string, unknown> | undefined, k: string): string {
  const v = o?.[k];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function bool(o: Record<string, unknown> | undefined, k: string, fallback = false): boolean {
  const v = o?.[k];
  if (typeof v === 'boolean') return v;
  // PHP json_encode of a tinyint arrives as 1/0.
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
}

function strList(o: Record<string, unknown> | undefined, k: string): string[] {
  const v = o?.[k];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export function AppzaChatBubble({ overrides }: { overrides?: Record<string, unknown> }) {
  const dispatch = useActionDispatch();
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef(0);
  const moved = useRef(false);

  const messageId = str(overrides, 'message_id');
  const isMine = bool(overrides, 'is_mine');
  const isSystem = bool(overrides, 'is_system');
  const startsRun = bool(overrides, 'starts_run', true);
  const endsRun = bool(overrides, 'ends_run', true);
  const bodyHtml = str(overrides, 'body_html');
  const images = strList(overrides, 'images');
  const timeLabel = str(overrides, 'time_label');
  const authorName = str(overrides, 'author_name');
  const authorAvatar = str(overrides, 'author_avatar');
  const authorInitials = str(overrides, 'author_initials');
  const hasReply = bool(overrides, 'has_reply');
  const replyName = str(overrides, 'reply_to_name');
  const replyText = str(overrides, 'reply_to_text');
  const canDelete = bool(overrides, 'can_delete');

  const mineLabel = str(overrides, 'mine_label') || 'You';
  const showSenderName = bool(overrides, 'show_sender_name', true);
  const showAvatarColumn = bool(overrides, 'show_avatar_column', true);
  const showTime = bool(overrides, 'show_time', true);
  const allowReply = bool(overrides, 'allow_reply', true);
  const allowDelete = bool(overrides, 'allow_delete', true);

  const deleteIcon = resolveIcon(str(overrides, 'delete_icon') || 'trash');
  const replyIcon = resolveIcon(str(overrides, 'reply_icon') || 'arrow-undo-outline');
  const deleteActionSlug = str(overrides, 'delete_action_slug') || 'chat.delete_message';
  const replyActionSlug = str(overrides, 'reply_action_slug') || 'chat.reply_start';

  const thresholdRaw = Number.parseInt(str(overrides, 'swipe_threshold'), 10);
  const threshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0
    ? thresholdRaw
    : DEFAULT_SWIPE_THRESHOLD;

  // Subscribed: only one message shows its actions at a time.
  const chat = useChatControls();
  const selected = messageId !== '' && chat.active_message_id === messageId;
  const deletable = allowDelete && canDelete && messageId !== '' && !isSystem;
  const replyable = allowReply && messageId !== '' && !isSystem;

  if (isSystem) {
    return (
      <span className="appza-chat-row is-system">
        <span
          className="appza-chat-system"
          // Sanitised upstream by the preview proxy's wp_kses pass.
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </span>
    );
  }

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    // Vertical intent wins so the list can scroll.
    if (Math.abs(dy) > Math.abs(dx)) {
      startX.current = null;
      setDragX(0);
      return;
    }
    if (Math.abs(dx) > TAP_SLOP_PX) moved.current = true;
    if (!allowReply) return;
    const travel = isMine ? Math.min(0, dx) : Math.max(0, dx);
    setDragX(Math.max(-MAX_DRAG_PX, Math.min(MAX_DRAG_PX, travel)));
  };

  const onPointerUp = () => {
    const dragged = Math.abs(dragX);
    const wasDrag = moved.current;
    startX.current = null;
    setDragX(0);
    moved.current = false;

    if (allowReply && dragged >= threshold) {
      // Also dispatched so a repointed reply_action_slug still fires.
      setChatControls({
        reply_to_id: messageId,
        reply_to_name: isMine ? mineLabel : authorName,
        reply_to_text: stripTags(bodyHtml),
      });
      dispatchAction(replyActionSlug);
      return;
    }

    if (wasDrag) return;

    if (replyable || deletable) {
      setChatControls({ active_message_id: selected ? '' : messageId });
    }
  };

  const dispatchAction = (slug: string, extra?: Record<string, unknown>) => {
    if (!slug) return;
    const defaults = readActionDefaultsFromCatalog(slug);
    dispatch({
      action_slug: slug,
      args: defaults ?? undefined,
      item: {
        id: messageId,
        thread_id: str(overrides, 'thread_id'),
        is_mine: isMine,
        author_name: authorName,
        message_rendered: bodyHtml,
        ...(extra ?? {}),
      },
    });
  };

  const avatarVisible = showAvatarColumn && !isMine;
  const senderText = isMine ? mineLabel : authorName;

  return (
    <span
      className="appza-chat-row"
      data-mine={isMine ? '1' : '0'}
      data-starts-run={startsRun ? '1' : '0'}
      data-ends-run={endsRun ? '1' : '0'}
      data-selected={selected ? '1' : '0'}
    >
      {showSenderName && startsRun && senderText !== '' && (
        <span className="appza-chat-sender">{senderText}</span>
      )}
      <span className="appza-chat-line">
        {avatarVisible && (
          <span className="appza-chat-avatar" aria-hidden={endsRun ? undefined : true}>
            {endsRun &&
              (authorAvatar !== '' ? (
                <img src={authorAvatar} alt={authorName} loading="lazy" />
              ) : (
                <span className="appza-chat-avatar-fallback">{authorInitials}</span>
              ))}
          </span>
        )}
        <span
          className="appza-chat-bubble"
          data-has-images={images.length > 0 ? '1' : undefined}
          style={{ transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined } as CSSProperties}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            startX.current = null;
            setDragX(0);
          }}
        >
          {hasReply && (replyName !== '' || replyText !== '') && (
            <span className="appza-chat-quote">
              <span className="appza-chat-quote-name">{replyName}</span>
              <span className="appza-chat-quote-text">{replyText}</span>
            </span>
          )}
          {images.length > 0 && (
            <span className="appza-chat-images">
              {images.map((url) => (
                <img key={url} src={url} alt="" loading="lazy" />
              ))}
            </span>
          )}
          {bodyHtml !== '' && (
            <span
              className="appza-chat-body"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}
          {showTime && timeLabel !== '' && (
            <span className="appza-chat-time">{timeLabel}</span>
          )}
        </span>
        {allowReply && dragX !== 0 && (
          <span className="appza-chat-swipe-hint" aria-hidden="true">
            <IonIcon icon={replyIcon} />
          </span>
        )}
        {replyable && selected && (
          <button
            type="button"
            className="appza-chat-reply"
            aria-label="Reply to message"
            onClick={(e) => {
              e.stopPropagation();
              setChatControls({
                active_message_id: '',
                reply_to_id: messageId,
                reply_to_name: isMine ? mineLabel : authorName,
                reply_to_text: stripTags(bodyHtml),
              });
              dispatchAction(replyActionSlug);
            }}
          >
            <IonIcon icon={replyIcon} />
          </button>
        )}
        {deletable && selected && (
          <button
            type="button"
            className="appza-chat-delete"
            aria-label="Delete message"
            onClick={(e) => {
              e.stopPropagation();
              setChatControls({ active_message_id: '' });
              dispatchAction(deleteActionSlug);
            }}
          >
            <IonIcon icon={deleteIcon} />
          </button>
        )}
      </span>
    </span>
  );
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

import { useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { setChatControls, useChatControls } from './chatControls';

/**
 * One message in a conversation.
 *
 * Bespoke rather than composed, for the same reason fc-media-tile is:
 * nearly every visual decision flips on `is_mine` — which side the row
 * sits on, the bubble fill, whether the label reads a name or "You",
 * whether an avatar draws at all, and (see MIRRORING below) which end of
 * the bubble the text and the timestamp hug. On top of that the avatar
 * hangs off the LAST message of a run while the name sits above the
 * FIRST, the reply quote nests INSIDE the bubble, and both gestures are
 * imperative.
 *
 * MIRRORING. Measured off Noor's designs, the bubble is mirrored rather
 * than merely re-aligned: someone else's message puts the text at the
 * left and the timestamp at the right; your own puts the text at the
 * right and the timestamp at the left. Both, in other words, keep the
 * text on the outer edge and the time on the inner one. It is not two
 * independent alignments — it is one axis flipped, which is why the CSS
 * expresses it as a single `align-items` swap.
 *
 * GESTURES: a tap on ANY message reveals its actions beside the bubble —
 * a reply arrow, plus the trash on one the viewer may delete. A
 * horizontal drag past a threshold still starts a reply directly, as a
 * shortcut for anyone who knows it.
 *
 * The swipe alone was the first cut, and it shipped invisible: it worked
 * on a real device, and the person who drew the designs could not find
 * it. A gesture nothing advertises is a gesture nobody uses, so the tap
 * now surfaces the same action next to the trash that was already there.
 *
 * Neither is a click on the child, which
 * is why this child deliberately declares no `on_click_action` in the
 * catalog — naming one would make the renderer stamp
 * data-appza-inline-click and hijack the pointer before this component
 * sees it. The two actions it fires are named by props instead, so the
 * builder can still repoint them.
 *
 * Reply target and selection go straight into the chatControls slice
 * rather than through the dispatcher — the same call AppzaFilePicker
 * makes writing the document draft. Only the delete has an HTTP tail,
 * so only the delete dispatches.
 */

const DEFAULT_SWIPE_THRESHOLD = 48;
/** How far the bubble may travel while dragging, however far the finger goes. */
const MAX_DRAG_PX = 72;
/** Under this, a pointer sequence is a tap rather than a drag. */
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
  // Field mappings carry whatever the payload held, and PHP's json_encode
  // of a tinyint column arrives as 1 / 0 rather than true / false.
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

  // Subscribed, not read imperatively: only ONE message shows its
  // actions at a time, so every row has to know when another was tapped.
  // A conversation is tens of rows, not thousands — the re-render is
  // cheaper than the bookkeeping that avoiding it would need.
  const chat = useChatControls();
  const selected = messageId !== '' && chat.active_message_id === messageId;
  const deletable = allowDelete && canDelete && messageId !== '' && !isSystem;
  const replyable = allowReply && messageId !== '' && !isSystem;

  // A group lifecycle event ("X joined") is not a bubble in any design —
  // it is a centred caption with no author, no time and no affordances.
  if (isSystem) {
    return (
      <span className="appza-chat-row is-system">
        <span
          className="appza-chat-system"
          // Sanitised upstream by the preview proxy's wp_kses pass, which
          // is what makes this sink safe — same contract as
          // appza-rich-text.
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
    // Vertical intent wins: the list scrolls, and a diagonal flick that
    // nudged the bubble sideways would fight it.
    if (Math.abs(dy) > Math.abs(dx)) {
      startX.current = null;
      setDragX(0);
      return;
    }
    if (Math.abs(dx) > TAP_SLOP_PX) moved.current = true;
    if (!allowReply) return;
    // One direction only — toward the centre of the screen, which is
    // rightwards for someone else's message and leftwards for your own.
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
      // Straight into the slice: the composer's reply bar reads it, and
      // nothing here needs a round trip. The action is dispatched too so
      // a customer who repointed reply_action_slug at something of their
      // own still gets it.
      setChatControls({
        reply_to_id: messageId,
        reply_to_name: isMine ? mineLabel : authorName,
        // The quote is one line of plain text; the bubble's own HTML
        // would only fight the ellipsis.
        reply_to_text: stripTags(bodyHtml),
      });
      dispatchAction(replyActionSlug);
      return;
    }

    if (wasDrag) return;

    // A tap on any message with something to offer. Writing the id into
    // the slice is what closes whichever other row was open.
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
          // The column is always present so every bubble in a run keeps
          // the same left edge; only the last one in the run fills it.
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
          // A bubble carrying an image takes the full width it is allowed:
          // sized to its text, the image would shrink to whatever the
          // caption happens to be.
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
              // Sanitised upstream — see the note on the system branch.
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

/** The quoted line is plain text; markup in it would only fight the ellipsis. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

import { useEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';
import { clearChatReply, setChatControls, useChatControls } from './chatControls';
import type { ActionInvocation, ActionDispatch } from './actionContext';

/**
 * The message composer: the pending-reply strip, the input pill with its
 * attach button, and the pending-attachment thumbnails.
 *
 * Bespoke rather than composed for two reasons. The field is CONTROLLED
 * against the chatControls slice, because other things write it — a send
 * clears it, cancelling a reply leaves it alone, and an uncontrolled
 * field cannot be written to from outside. And the reply strip is folded
 * in here rather than being a placement of its own: it is visually part
 * of the same white bar, and splitting it would mean a second AppZet
 * whose only content is three values that live in state, which no
 * field_mapping can reach.
 *
 * The send BUTTON is a sibling child, not part of this — the design puts
 * it outside the pill, and as a plain ion-button it keeps the ordinary
 * catalog action wiring (on_tap_send). Its enabled look comes from a
 * data attribute the PlacementRenderer stamps on the wrapper, the same
 * mechanism the add-document appbar's Upload button uses.
 *
 * Attach is this component's own action, because the tap target sits
 * inside the pill: the primitive is registered as self-dispatching so a
 * click anywhere in the field does not fire it.
 */

export type ChatComposerProps = {
  overrides?: Record<string, unknown>;
  /** The `on_tap_attach` wiring resolved from the AppZet. */
  action?: ActionInvocation;
  dispatch: ActionDispatch;
};

function str(o: Record<string, unknown> | undefined, k: string): string {
  const v = o?.[k];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function bool(o: Record<string, unknown> | undefined, k: string, fallback: boolean): boolean {
  const v = o?.[k];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
}

export function AppzaChatComposer({ overrides, action, dispatch }: ChatComposerProps) {
  const chat = useChatControls();
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  const placeholder = str(overrides, 'placeholder') || 'Type message';
  const attachIcon = resolveIcon(str(overrides, 'attach_icon') || 'image-outline');
  const replyIcon = resolveIcon(str(overrides, 'reply_icon') || 'arrow-undo-outline');
  const replyCancelIcon = resolveIcon(str(overrides, 'reply_cancel_icon') || 'close');
  const removeIcon = resolveIcon(str(overrides, 'attachment_remove_icon') || 'close');
  const showAttach = bool(overrides, 'show_attach', true);
  const maxRows = Number.parseInt(str(overrides, 'max_rows'), 10);

  // Grow with the text, up to a cap, then scroll. A textarea has no
  // intrinsic auto-size, so this is measured on every change.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cap = Number.isFinite(maxRows) && maxRows > 0 ? maxRows : 5;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 18;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * cap + 16)}px`;
  }, [chat.draft, maxRows]);

  // Publish the footer's height so the floating home button can sit
  // ABOVE the composer rather than at a fixed distance from the viewport
  // — the bar grows when a reply is pending or an image is attached, and
  // a constant offset puts the button behind it exactly when there is
  // most to read. The FAB is fixed-positioned and a sibling of this
  // subtree, so a CSS variable on the root is the only thing they share.
  const rootRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const footer = el.closest('.appza-renderer-footer') ?? el;
    const publish = () => {
      document.documentElement.style.setProperty(
        '--appza-chat-footer-h',
        `${Math.round(footer.getBoundingClientRect().height)}px`,
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(footer);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--appza-chat-footer-h');
    };
  }, []);

  const hasReply = chat.reply_to_id !== '';

  return (
    <span className="appza-chat-composer" ref={rootRef}>
      {hasReply && (
        <span className="appza-chat-reply-bar">
          <IonIcon className="appza-chat-reply-bar-icon" icon={replyIcon} aria-hidden="true" />
          <span className="appza-chat-reply-bar-body">
            <span className="appza-chat-reply-bar-name">{chat.reply_to_name}</span>
            <span className="appza-chat-reply-bar-text">{chat.reply_to_text}</span>
          </span>
          <button
            type="button"
            className="appza-chat-reply-bar-close"
            aria-label="Cancel reply"
            onClick={() => clearChatReply()}
          >
            <IonIcon icon={replyCancelIcon} />
          </button>
        </span>
      )}

      {chat.attachments.length > 0 && (
        <span className="appza-chat-attachments">
          {chat.attachments.map((url) => (
            <span key={url} className="appza-chat-attachment">
              <img src={url} alt="" />
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() =>
                  setChatControls({
                    attachments: chat.attachments.filter((u) => u !== url),
                  })
                }
              >
                <IonIcon icon={removeIcon} />
              </button>
            </span>
          ))}
        </span>
      )}

      <span className="appza-chat-composer-field">
        <textarea
          ref={fieldRef}
          className="appza-chat-composer-input"
          rows={1}
          placeholder={placeholder}
          value={chat.draft}
          onChange={(e) => setChatControls({ draft: e.target.value })}
        />
        {showAttach && (
          <button
            type="button"
            className="appza-chat-composer-attach"
            aria-label="Attach an image"
            disabled={chat.uploading}
            onClick={() => {
              if (!action) return;
              dispatch(action);
            }}
          >
            <IonIcon icon={attachIcon} />
          </button>
        )}
      </span>
    </span>
  );
}

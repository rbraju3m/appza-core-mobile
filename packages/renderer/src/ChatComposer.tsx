import { useEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';
import { clearChatReply, setChatControls, useChatControls } from './chatControls';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import type { ActionInvocation, ActionDispatch } from './actionContext';

// Controlled against chatControls because other actions write the draft.

export type ChatComposerProps = {
  overrides?: Record<string, unknown>;
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
  const discardActionSlug = str(overrides, 'discard_action_slug') || 'chat.discard_attachment';
  const maxRows = Number.parseInt(str(overrides, 'max_rows'), 10);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cap = Number.isFinite(maxRows) && maxRows > 0 ? maxRows : 5;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 18;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * cap + 16)}px`;
  }, [chat.draft, maxRows]);

  // The FAB is a fixed sibling, so a root CSS var is how it sits above the growing footer.
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
                // FC created the Media row on upload, so a local-only removal strands a file.
                onClick={() =>
                  dispatch({
                    action_slug: discardActionSlug,
                    args: readActionDefaultsFromCatalog(discardActionSlug) ?? undefined,
                    item: { url },
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

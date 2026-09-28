import { useEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import {
  clearCommentReply,
  setPostDetailControls,
  usePostDetailControls,
} from './postDetailControls';
import type { ActionInvocation, ActionDispatch } from './actionContext';

// Controlled against postDetailControls: send, edit prefill and cancel all write the field from outside.

export type CommentComposerProps = {
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

export function AppzaCommentComposer({ overrides, action, dispatch }: CommentComposerProps) {
  const controls = usePostDetailControls();
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  const placeholder = str(overrides, 'placeholder') || 'Write a comment';
  const attachIcon = resolveIcon(str(overrides, 'attach_icon') || 'image-outline');
  const sendIcon = resolveIcon(str(overrides, 'send_icon') || 'send');
  const cancelIcon = resolveIcon(str(overrides, 'cancel_icon') || 'close');
  const removeIcon = resolveIcon(str(overrides, 'attachment_remove_icon') || 'close');
  const showAttach = bool(overrides, 'show_attach', true);
  const replyPrefix = str(overrides, 'reply_prefix') || 'Replying to';
  const editPrefix = str(overrides, 'edit_prefix') || 'Editing your comment';
  const attachSlug = str(overrides, 'attach_action_slug') || 'comment.attach';
  const discardSlug = str(overrides, 'discard_action_slug') || 'comment.discard_attachment';
  const maxRows = Number.parseInt(str(overrides, 'max_rows'), 10);

  // A textarea doesn't auto-size, so measure on every change.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cap = Number.isFinite(maxRows) && maxRows > 0 ? maxRows : 4;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 18;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * cap + 16)}px`;
  }, [controls.draft, maxRows]);

  useEffect(() => {
    if (controls.reply_to_id === '' && controls.editing_id === '') return;
    fieldRef.current?.focus();
  }, [controls.reply_to_id, controls.editing_id]);

  // Publish the footer height so the FAB sits above the bar as it grows.
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

  const editing = controls.editing_id !== '';
  const replying = !editing && controls.reply_to_id !== '';
  const canSend =
    !controls.uploading && (controls.draft.trim() !== '' || controls.attachments.length > 0);

  const send = () => {
    if (!canSend || !action) return;
    dispatch(action);
  };

  return (
    <span className="appza-comment-composer" ref={rootRef}>
      {(replying || editing) && (
        <span className="appza-cc-target">
          <span className="appza-cc-target-text">
            {editing ? editPrefix : `${replyPrefix} ${controls.reply_to_name}`}
          </span>
          <button
            type="button"
            className="appza-cc-target-close"
            aria-label={editing ? 'Cancel edit' : 'Cancel reply'}
            onClick={() => {
              // Cancelling an edit clears the prefill, or the next send duplicates the comment.
              if (editing) setPostDetailControls({ draft: '' });
              clearCommentReply();
            }}
          >
            <IonIcon icon={cancelIcon} />
          </button>
        </span>
      )}

      {controls.attachments.length > 0 && (
        <span className="appza-cc-attachments">
          {controls.attachments.map((url) => (
            <span key={url} className="appza-cc-attachment">
              <img src={url} alt="" />
              <button
                type="button"
                aria-label="Remove attachment"
                // FC created the Media row on upload, so tell the server or the file is stranded.
                onClick={() =>
                  dispatch({
                    action_slug: discardSlug,
                    args: readActionDefaultsFromCatalog(discardSlug) ?? undefined,
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

      <span className="appza-cc-bar">
        {showAttach && (
          <button
            type="button"
            className="appza-cc-attach"
            aria-label="Attach an image"
            disabled={controls.uploading}
            onClick={() =>
              dispatch({
                action_slug: attachSlug,
                args: readActionDefaultsFromCatalog(attachSlug) ?? undefined,
              })
            }
          >
            <IonIcon icon={attachIcon} />
          </button>
        )}

        <span className="appza-cc-field">
          <textarea
            ref={fieldRef}
            className="appza-cc-input"
            rows={1}
            placeholder={placeholder}
            value={controls.draft}
            onChange={(e) => setPostDetailControls({ draft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </span>

        {canSend && (
          <button type="button" className="appza-cc-send" aria-label="Post comment" onClick={send}>
            <IonIcon icon={sendIcon} />
          </button>
        )}
      </span>
    </span>
  );
}

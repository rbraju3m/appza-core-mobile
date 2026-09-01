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

/**
 * The "Write a comment" footer on post detail — the bar every signed-in
 * design draws at the bottom of the screen.
 *
 * Its own component rather than the chat composer's, though they look
 * alike. This one has to say WHO is being answered and offer a way to
 * stop (Reply on a comment re-targets it), and it has to know the
 * difference between writing a comment and editing one — the 3-dot
 * menu's "Edit comment" puts the same bar into a mode where sending
 * replaces a comment instead of creating one. The chat composer has
 * neither concept, and folding both into it would make every read of it
 * harder to be sure about.
 *
 * The field is CONTROLLED against postDetailControls, because other
 * things write it: a send clears it, an edit prefills it, cancelling an
 * edit empties it again. An uncontrolled field cannot be written to from
 * outside — P139, and the reason it is worth the extra state.
 *
 * SEND is this component's own affordance rather than a sibling child,
 * unlike chat's. The designs draw no send button at all in the resting
 * state: the bar is an attach glyph and a field, and something to send
 * with only makes sense once there is something to send. A sibling
 * ion-button would have to exist and be hidden, which is a child whose
 * whole job is to not be there.
 */

export type CommentComposerProps = {
  overrides?: Record<string, unknown>;
  /** The `on_tap_send` wiring resolved from the AppZet. */
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

  // Grow with the text up to a cap, then scroll. A textarea has no
  // intrinsic auto-size, so it is measured on every change.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cap = Number.isFinite(maxRows) && maxRows > 0 ? maxRows : 4;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 18;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * cap + 16)}px`;
  }, [controls.draft, maxRows]);

  // Tapping Reply has to put the cursor in the field, or the reader is
  // shown who they are answering and left to tap again to answer them.
  useEffect(() => {
    if (controls.reply_to_id === '' && controls.editing_id === '') return;
    fieldRef.current?.focus();
  }, [controls.reply_to_id, controls.editing_id]);

  // Publish the footer's height so the floating home button sits ABOVE
  // the bar rather than at a fixed distance from the viewport — the bar
  // grows when a reply is pending or an image is attached, and a constant
  // offset would put the button behind it exactly when there is most to
  // read. Same variable the chat footer publishes, because the FAB is the
  // same component reading one place.
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
              // Cancelling an EDIT discards the prefilled body — it is
              // the comment's current text, and leaving it in the field
              // would turn "never mind" into a duplicate comment on the
              // next send. Cancelling a REPLY keeps what was typed,
              // because it is the reader's own words and still posts
              // fine as a top-level comment.
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
                // Not just a local removal: FluentCommunity created the
                // Media row when the file was uploaded, so dropping the
                // thumbnail without telling the server strands a file.
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
              // Enter sends, Shift+Enter breaks the line. A comment is
              // usually one line, which is why the plain key is the send
              // and not the other way round.
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

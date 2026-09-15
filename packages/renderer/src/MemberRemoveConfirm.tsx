import { useEffect, useState } from 'react';
import { useActionDispatch } from './actionContext';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';

// iOS-style center alert opened by member.remove_confirm. Shows the
// member's display name as the bold title + a short message. Two
// stacked-width buttons separated by dividers: Cancel (blue) and
// Remove from space (red bold). Confirming dispatches the wired
// remove action (default `member.remove`) through the shared
// dispatcher so the HTTP call sits alongside every other action
// handler in App.tsx.

const OPEN_EVENT = 'appza:open-member-remove-confirm';
const CLOSE_EVENT = 'appza:close-member-remove-confirm';

type OpenDetail = {
  subject: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  /**
   * In-flight caption. Defaults to the member-removal wording; the
   * invitation-delete flow reuses this same alert and passes its own.
   */
  busyLabel?: string;
  /**
   * 'row' puts Cancel and the destructive action side by side. Opt-in:
   * the member-removal wording ("Remove from space") is too long to sit
   * beside Cancel, so that flow keeps the stacked default.
   */
  actionsLayout?: 'row' | 'stacked' | 'material';
  /**
   * 'primary' draws the confirm button in the cancel button's blue rather
   * than red. The member-status dialogs (Pending / Blocked / Active) are
   * reversible from the next tab over, and every one of those designs
   * draws both buttons alike.
   */
  confirmTone?: 'destructive' | 'primary';
  item: unknown;
  removeActionSlug?: string;
  removeArgs?: Record<string, unknown>;
};

export function openMemberRemoveConfirm(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeMemberRemoveConfirm(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function MemberRemoveConfirm() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const dispatch = useActionDispatch();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setInFlight(false);
      setOpen(true);
    };
    const onClose = () => {
      setOpen(false);
      setInFlight(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  if (!open || !detail) return null;

  const cancel = () => {
    if (inFlight) return;
    setOpen(false);
  };
  const confirm = () => {
    if (inFlight) return;
    setInFlight(true);
    const actionSlug = detail.removeActionSlug ?? 'member.remove';
    const defaults = readActionDefaultsFromCatalog(actionSlug);
    dispatch({
      action_slug: actionSlug,
      args:
        defaults || detail.removeArgs
          ? { ...(defaults ?? {}), ...(detail.removeArgs ?? {}) }
          : undefined,
      item: detail.item,
    });
    // Handler in App.tsx closes the dialog via closeMemberRemoveConfirm
    // on both success + failure so the busy state is capped.
  };

  const message = detail.message ?? 'Remove this member from the space?';
  const cancelLabel = detail.cancelLabel ?? 'Cancel';
  const confirmLabel = detail.confirmLabel ?? 'Remove from space';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.subject}
      className="appza-member-confirm-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        className={
          'appza-member-confirm' + (detail.actionsLayout === 'material' ? ' is-material' : '')
        }
      >
        <div className="appza-member-confirm-body">
          <p className="appza-member-confirm-title">{detail.subject}</p>
          <p className="appza-member-confirm-message">{message}</p>
        </div>
        <div
          className={
            'appza-member-confirm-actions' +
            (detail.actionsLayout === 'row' || detail.actionsLayout === 'material' ? ' is-row' : '')
          }
        >
          <button
            type="button"
            className="appza-member-confirm-btn is-cancel"
            onClick={cancel}
            disabled={inFlight}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              detail.confirmTone === 'primary'
                ? 'appza-member-confirm-btn is-primary'
                : 'appza-member-confirm-btn is-destructive'
            }
            onClick={confirm}
            disabled={inFlight}
          >
            {inFlight ? (detail.busyLabel ?? 'Removing…') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

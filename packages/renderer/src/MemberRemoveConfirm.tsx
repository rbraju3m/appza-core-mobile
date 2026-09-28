import { useEffect, useState } from 'react';
import { useActionDispatch } from './actionContext';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { useBackDismiss } from './backStack';

const OPEN_EVENT = 'appza:open-member-remove-confirm';
const CLOSE_EVENT = 'appza:close-member-remove-confirm';

type OpenDetail = {
  subject: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  busyLabel?: string;
  // Opt-in: "Remove from space" is too long to sit beside Cancel.
  actionsLayout?: 'row' | 'stacked' | 'material';
  confirmTone?: 'destructive' | 'primary';
  // Draws above the moderation review modal (1400), which opens it over itself.
  raised?: boolean;
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

  useBackDismiss(!(!open || !detail), () => { setOpen(false); setInFlight(false); });

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
    // The App.tsx handler closes the dialog on success and failure, capping the busy state.
  };

  const message = detail.message ?? 'Remove this member from the space?';
  const cancelLabel = detail.cancelLabel ?? 'Cancel';
  const confirmLabel = detail.confirmLabel ?? 'Remove from space';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.subject}
      className={'appza-member-confirm-backdrop' + (detail.raised ? ' is-raised' : '')}
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

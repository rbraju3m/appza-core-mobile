import { useEffect, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { useBackDismiss } from './backStack';

// FC can't create an empty one-to-one thread: the first message IS the create, so SEND waits for text.
// A failed onSend keeps the text.

export const NEW_MESSAGE_MODAL_APPZET_SLUG = 'fc-new-message-modal';

// Must match the fc-new-message-modal superstructure's `children` array.
export const NEW_MESSAGE_MODAL_CHILD_COUNT = 6;

export type NewMessagePresentation = {
  title: string;
  placeholder: string;
  cancelLabel: string;
  sendLabel: string;
  closeIcon: string;
  hidden: boolean;
  showClose: boolean;
  showRecipient: boolean;
  modalBgColor?: string;
  modalRadius?: string;
  modalMinHeight?: string;
  backdropColor?: string;
  titleColor?: string;
  titleSize?: string;
  dividerColor?: string;
  recipientTrackColor?: string;
  recipientBgColor?: string;
  recipientColor?: string;
  fieldBgColor?: string;
  fieldBorderColor?: string;
  fieldTextColor?: string;
  fieldHeight?: string;
  accentColor?: string;
  sendTextColor?: string;
  buttonRadius?: string;
};

export type NewMessageRecipient = {
  name: string;
  avatar?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: NewMessagePresentation;
  childStyles?: Record<number, CSSProperties>;
  recipient: NewMessageRecipient;
  onSend: (text: string) => Promise<boolean>;
};

const OPEN_EVENT = 'appza:open-new-message-modal';
const CLOSE_EVENT = 'appza:close-new-message-modal';

export function openNewMessageModal(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeNewMessageModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function NewMessageModal() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setText('');
      setSending(false);
      setDetail(ce.detail);
    };
    const onClose = () => setDetail(null);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setDetail(null);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useBackDismiss(!(!detail || detail.presentation.hidden), () => setDetail(null));

  if (!detail || detail.presentation.hidden) return null;

  const p = detail.presentation;
  const slug = detail.appzetSlug ?? NEW_MESSAGE_MODAL_APPZET_SLUG;
  const cs = detail.childStyles ?? {};
  const ready = text.trim() !== '' && !sending;
  const close = closeNewMessageModal;
  const closeGlyph = resolveIcon(p.closeIcon);

  const send = async () => {
    if (!ready) return;
    setSending(true);
    const ok = await detail.onSend(text.trim());
    setSending(false);
    if (ok) close();
  };

  const vars: CSSProperties = {
    ['--appza-modal-bg-color' as string]: p.modalBgColor,
    ['--appza-modal-radius' as string]: p.modalRadius,
    ['--appza-modal-min-height' as string]: p.modalMinHeight,
    ['--appza-backdrop-color' as string]: p.backdropColor,
    ['--appza-title-color' as string]: p.titleColor,
    ['--appza-title-size' as string]: p.titleSize,
    ['--appza-divider-color' as string]: p.dividerColor,
    ['--appza-recipient-track-color' as string]: p.recipientTrackColor,
    ['--appza-recipient-bg-color' as string]: p.recipientBgColor,
    ['--appza-recipient-color' as string]: p.recipientColor,
    ['--appza-field-bg-color' as string]: p.fieldBgColor,
    ['--appza-field-border-color' as string]: p.fieldBorderColor,
    ['--appza-field-text-color' as string]: p.fieldTextColor,
    ['--appza-field-height' as string]: p.fieldHeight,
    ['--appza-accent-color' as string]: p.accentColor,
    ['--appza-send-text-color' as string]: p.sendTextColor,
    ['--appza-button-radius' as string]: p.buttonRadius,
  };

  const { name, avatar } = detail.recipient;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      className="appza-new-message-backdrop"
      style={vars}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="appza-new-message" {...appzetAttrs(slug)}>
        <div className="appza-new-message-head">
          <div className="appza-new-message-title" style={cs[0]} {...childAttrs(slug, 0, 'ion-text')}>
            {p.title}
          </div>
          {p.showClose && (
            <button
              type="button"
              className="appza-new-message-close"
              aria-label="Close"
              style={cs[1]}
              onClick={close}
              {...childAttrs(slug, 1, 'ion-icon')}
            >
              {closeGlyph ? <IonIcon icon={closeGlyph} /> : null}
            </button>
          )}
        </div>

        <div className="appza-new-message-body">
          {p.showRecipient && name && (
            <div className="appza-new-message-to">
              <span className="appza-new-message-chip" style={cs[2]} {...childAttrs(slug, 2, 'ion-chip')}>
                <span className="appza-new-message-avatar">
                  {avatar ? <img src={avatar} alt="" /> : initialsOf(name)}
                </span>
                <span className="appza-new-message-name">{name}</span>
              </span>
            </div>
          )}
          <textarea
            className="appza-new-message-field"
            style={cs[3]}
            placeholder={p.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            {...childAttrs(slug, 3, 'ion-textarea')}
          />
        </div>

        <div className="appza-new-message-foot">
          <button
            type="button"
            className="appza-new-message-cancel"
            style={cs[4]}
            onClick={close}
            {...childAttrs(slug, 4, 'ion-button')}
          >
            {p.cancelLabel}
          </button>
          <button
            type="button"
            className={ready ? 'appza-new-message-send is-ready' : 'appza-new-message-send'}
            style={cs[5]}
            disabled={!ready}
            onClick={() => void send()}
            {...childAttrs(slug, 5, 'ion-button')}
          >
            {p.sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';

type Props = {
  /** The button before it asks, e.g. "Back to original". */
  label: string;
  /** The question, in place of the button, e.g. "Go back to the original design? …". */
  question: string;
  /** The button that does it. */
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
};

/** A button that asks first, in the page (no browser dialog): question, then [confirm] [Cancel] (P3c). */
export function ConfirmButton({ label, question, confirmLabel, onConfirm, disabled, className = 'appza-btn', title }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} disabled={disabled} title={title}>
        {label}
      </button>
    );
  }
  return (
    <div className="appza-confirm" role="group" aria-label={label}>
      <span className="appza-confirm-question">{question}</span>
      <span className="appza-confirm-actions">
        <button
          type="button"
          className="appza-btn appza-btn-danger"
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="appza-btn" onClick={() => setAsking(false)}>
          Cancel
        </button>
      </span>
    </div>
  );
}

/** "Go back to the original design? Your changes to <name> will be dropped." */
export const revertQuestion = (name: string) => `Go back to the original design? Your changes to ${name} will be dropped.`;

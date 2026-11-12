import { useEffect, useRef, useState } from 'react';
import { useBackDismiss } from './backStack';

/**
 * The sheet behind the app's account flows (v1 parity P2): forgot password, create account, delete account.
 * Renderer-internal, like the sign-out dialog: a title, a message, a few fields and two buttons. Each step's
 * `submit` answers with the next step, a final message, field errors, or close. HTTP lives in accountActions.
 */

export type AccountField = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'checkbox';
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  /** A checkbox's "read them" page (the site's terms). */
  link?: string;
};

export type AccountStepResult =
  | { kind: 'done'; title?: string; message: string; doneLabel?: string }
  | { kind: 'next'; step: AccountStep }
  | { kind: 'error'; message?: string; fields?: Record<string, string> }
  | { kind: 'close' };

export type AccountStep = {
  title: string;
  message?: string;
  fields: AccountField[];
  cancelLabel: string;
  submitLabel: string;
  busyLabel?: string;
  tone?: 'primary' | 'destructive';
  /** Values and field errors the step opens with (back to the form after a late refusal). */
  initial?: Record<string, string | boolean>;
  initialErrors?: Record<string, string>;
  submit: (values: Record<string, string | boolean>) => Promise<AccountStepResult>;
};

const OPEN_EVENT = 'appza:open-account-sheet';
const CLOSE_EVENT = 'appza:close-account-sheet';

export function openAccountSheet(step: AccountStep): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AccountStep>(OPEN_EVENT, { detail: step }));
}

export function closeAccountSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

type Done = { title?: string; message: string; doneLabel?: string };

export function AccountSheet() {
  const [step, setStep] = useState<AccountStep | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldProblems, setFieldProblems] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const firstInput = useRef<HTMLInputElement | null>(null);

  const show = (next: AccountStep) => {
    setStep(next);
    setDone(null);
    setValues(next.initial ?? {});
    setProblem(null);
    setFieldProblems(next.initialErrors ?? {});
    setBusy(false);
  };
  const close = () => {
    setStep(null);
    setDone(null);
    setBusy(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<AccountStep>).detail;
      if (detail) show(detail);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, close);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, close);
    };
  }, []);

  // A new step puts the cursor in its first field.
  useEffect(() => {
    if (step && !done) firstInput.current?.focus();
  }, [step, done]);

  useBackDismiss(step !== null, () => {
    if (!busy) close();
  });

  if (!step) return null;

  const missing = step.fields.some((f) => f.required && (f.type === 'checkbox' ? values[f.name] !== true : !String(values[f.name] ?? '').trim()));

  const submit = async () => {
    if (busy || missing) return;
    setBusy(true);
    setProblem(null);
    setFieldProblems({});
    let result: AccountStepResult;
    try {
      result = await step.submit(values);
    } catch (err) {
      result = { kind: 'error', message: err instanceof Error ? err.message : String(err) };
    }
    setBusy(false);
    if (result.kind === 'next') show(result.step);
    else if (result.kind === 'done') setDone({ title: result.title, message: result.message, doneLabel: result.doneLabel });
    else if (result.kind === 'close') close();
    else {
      const fields = result.fields ?? {};
      // A message that only repeats a field's own error is shown once, under the field.
      setProblem(result.message && !Object.values(fields).includes(result.message) ? result.message : null);
      setFieldProblems(fields);
    }
  };

  const title = done ? (done.title ?? step.title) : step.title;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="appza-account-backdrop"
      data-account-sheet
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <form
        className="appza-account-sheet"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (done) close();
          else void submit();
        }}
      >
        <div className="appza-account-body">
          <p className="appza-account-title">{title}</p>
          {done ? (
            <p className="appza-account-message" role="status">
              {done.message}
            </p>
          ) : (
            <>
              {step.message && <p className="appza-account-message">{step.message}</p>}
              {step.fields.map((f, i) =>
                f.type === 'checkbox' ? (
                  <label key={f.name} className="appza-account-check">
                    <input
                      type="checkbox"
                      checked={values[f.name] === true}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))}
                      data-account-field={f.name}
                    />
                    <span>
                      {f.label}
                      {f.link && (
                        <>
                          {' '}
                          <a
                            href={f.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="appza-account-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Read
                          </a>
                        </>
                      )}
                    </span>
                    {fieldProblems[f.name] && <span className="appza-account-field-error">{fieldProblems[f.name]}</span>}
                  </label>
                ) : (
                  <label key={f.name} className="appza-account-field">
                    <span className="appza-account-label">{f.label}</span>
                    <input
                      ref={i === 0 ? firstInput : undefined}
                      type={f.type}
                      value={String(values[f.name] ?? '')}
                      placeholder={f.placeholder}
                      autoComplete={f.autoComplete}
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={fieldProblems[f.name] ? true : undefined}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      data-account-field={f.name}
                    />
                    {fieldProblems[f.name] && <span className="appza-account-field-error">{fieldProblems[f.name]}</span>}
                  </label>
                ),
              )}
              {problem && (
                <p className="appza-account-error" role="alert">
                  {problem}
                </p>
              )}
            </>
          )}
        </div>
        <div className="appza-account-actions">
          {done ? (
            <button type="submit" className="appza-account-btn is-primary">
              {done.doneLabel ?? 'OK'}
            </button>
          ) : (
            <>
              <button type="button" className="appza-account-btn" onClick={close} disabled={busy}>
                {step.cancelLabel}
              </button>
              <button
                type="submit"
                className={`appza-account-btn ${step.tone === 'destructive' ? 'is-destructive' : 'is-primary'}`}
                disabled={busy || missing}
              >
                {busy ? (step.busyLabel ?? 'Please wait…') : step.submitLabel}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

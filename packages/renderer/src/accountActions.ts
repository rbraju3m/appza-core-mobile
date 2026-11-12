import type { ActionInvocation } from './actionContext';
import { openAccountSheet, type AccountField, type AccountStep, type AccountStepResult } from './AccountSheet';
import { readActionDefaultsFromCatalog } from './catalogIndex';
import type { StoredAuthLike } from './postMenuHandlers';

/**
 * The app's account flows (v1 parity P2). Each opens the AccountSheet; the sheet's steps call our plug-in.
 * The shell supplies how a catalog endpoint becomes a URL (the mobile app's site, the simulator's own origin).
 */

export type AccountDeps = {
  absolutize: (endpoint: string) => string;
  /** Back into the shell: signing in after create account, opening the site's own signup page. */
  dispatch: (inv: ActionInvocation) => void;
  /** Delete account: who is signed in, and how the shell signs a request (application password). */
  auth?: StoredAuthLike | null;
  authHeader?: (auth: StoredAuthLike) => string;
  onInfo?: (msg: string) => void;
};

const HANDLED = new Set(['auth.forgot_password', 'auth.register', 'auth.delete_account']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** POSTs JSON; a refusal comes back as the server's own sentence and its per-field errors. */
export async function postAccount(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; result: AccountStepResult }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, result: { kind: 'error', message: "Couldn't reach the site. Check your connection and try again." } };
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && json && typeof json === 'object') return { ok: true, json };
  const data = json && typeof json.data === 'object' && json.data !== null ? (json.data as Record<string, unknown>) : null;
  const fields: Record<string, string> = {};
  const errs = data?.errors;
  if (errs && typeof errs === 'object') {
    for (const [k, v] of Object.entries(errs as Record<string, unknown>)) {
      const msg = typeof v === 'string' ? v : Array.isArray(v) ? str(v[0]) : undefined;
      if (msg) fields[k] = msg;
    }
  }
  return {
    ok: false,
    result: {
      kind: 'error',
      message: str(json?.message) ?? `Something went wrong (HTTP ${res.status}). Please try again.`,
      fields,
    },
  };
}

export function tryHandleAccountAction(inv: ActionInvocation, deps: AccountDeps): boolean {
  if (!HANDLED.has(inv.action_slug)) return false;
  const a = { ...(readActionDefaultsFromCatalog(inv.action_slug) ?? {}), ...((inv.args ?? {}) as Record<string, unknown>) };

  if (inv.action_slug === 'auth.forgot_password') {
    const endpoint = str(a.endpoint) ?? '/wp-json/appza/v1/account/forgot-password';
    openAccountSheet({
      title: str(a.title) ?? 'Reset your password',
      message: str(a.message) ?? "Enter the email or username you use here. We'll email you a link to choose a new password.",
      fields: [{ name: 'login', label: str(a.field_label) ?? 'Email or username', type: 'text', autoComplete: 'username', required: true }],
      cancelLabel: str(a.cancel_label) ?? 'CANCEL',
      submitLabel: str(a.submit_label) ?? 'SEND LINK',
      busyLabel: 'Sending…',
      tone: 'primary',
      submit: async (values) => {
        const r = await postAccount(deps.absolutize(endpoint), { login: String(values.login ?? '').trim() });
        if (!r.ok) return r.result;
        return { kind: 'done', title: 'Check your email', message: str(r.json.message) ?? "If an account matches, we've emailed a reset link." };
      },
    });
  }
  if (inv.action_slug === 'auth.register') void openSignup(a, deps);
  if (inv.action_slug === 'auth.delete_account') openDeleteAccount(a, deps);
  return true;
}

type SignupForm = {
  open: boolean;
  reason: string;
  url: string;
  title: string;
  description: string;
  submit_label: string;
  fields: AccountField[];
};

function readForm(json: Record<string, unknown>): SignupForm {
  const fields: AccountField[] = [];
  for (const raw of Array.isArray(json.fields) ? json.fields : []) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as Record<string, unknown>;
    const name = str(f.name);
    if (!name) continue;
    const type = f.type === 'email' || f.type === 'password' || f.type === 'checkbox' ? f.type : 'text';
    fields.push({
      name,
      label: str(f.label) ?? name,
      type,
      placeholder: str(f.placeholder),
      required: f.required === true,
      link: str(f.link),
      autoComplete:
        name === 'email' ? 'email' : name === 'username' ? 'username' : type === 'password' ? 'new-password' : name === 'full_name' ? 'name' : undefined,
    });
  }
  return {
    open: json.open === true,
    reason: str(json.reason) ?? '',
    url: str(json.url) ?? '',
    title: str(json.title) ?? 'Create your account',
    description: str(json.description) ?? '',
    submit_label: str(json.submit_label) ?? 'Sign up',
    fields,
  };
}

/**
 * Create account (P2b): the site's own fields → (its emailed code) → the account → signed in through the
 * catalog's auth.login with the same login, so sign-in stays one code path.
 */
async function openSignup(a: Record<string, unknown>, deps: AccountDeps): Promise<void> {
  const formEndpoint = str(a.form_endpoint) ?? '/wp-json/appza/v1/account/signup';
  const endpoint = str(a.endpoint) ?? '/wp-json/appza/v1/account/register';
  const cancelLabel = str(a.cancel_label) ?? 'CANCEL';
  const failed = (message: string) =>
    openAccountSheet({
      title: 'Create account',
      message,
      fields: [],
      cancelLabel: 'CLOSE',
      submitLabel: 'TRY AGAIN',
      submit: async () => {
        void openSignup(a, deps);
        return { kind: 'close' };
      },
    });

  let form: SignupForm;
  try {
    const res = await fetch(deps.absolutize(formEndpoint), { headers: { Accept: 'application/json' }, credentials: 'omit' });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !json) {
      failed(`Couldn't load the sign-up form (HTTP ${res.status}). Please try again.`);
      return;
    }
    form = readForm(json);
  } catch {
    failed("Couldn't reach the site. Check your connection and try again.");
    return;
  }

  if (!form.open) {
    if (form.reason === 'custom_page' && form.url) {
      deps.dispatch({ action_slug: 'link.open', args: { url: form.url } });
      return;
    }
    openAccountSheet({
      title: form.title,
      message: str(a.closed_message) ?? 'New sign-ups are closed on this site. Ask the site owner for an invitation.',
      fields: [],
      cancelLabel: 'CLOSE',
      submitLabel: 'OK',
      submit: async () => ({ kind: 'close' }),
    });
    return;
  }

  const signIn = (values: Record<string, string | boolean>, username: string): AccountStepResult => {
    deps.dispatch({
      action_slug: 'auth.login',
      args: {
        endpoint: str(a.login_endpoint) ?? '/wp-json/fcom-mobile/api/v1/fcom-login',
        method: 'POST',
        credentials: { username, password: String(values.password ?? '') },
        on_success_screen: str(a.on_success_screen) ?? 'home',
      },
    });
    return { kind: 'close' };
  };

  const codeStep = (values: Record<string, string | boolean>, challenge: string, email: string): AccountStep => ({
    title: str(a.code_title) ?? 'Check your email',
    message: `We sent a 6-digit code to ${email}. Enter it to finish. It works for 10 minutes.`,
    fields: [{ name: 'code', label: 'Code', type: 'text', autoComplete: 'one-time-code', required: true }],
    cancelLabel,
    submitLabel: str(a.code_submit_label) ?? 'CREATE ACCOUNT',
    busyLabel: 'Creating…',
    submit: async (c) => {
      const r = await postAccount(deps.absolutize(endpoint), { ...values, challenge, code: String(c.code ?? '').trim() });
      if (!r.ok) {
        // A problem with the form itself (say the username was taken meanwhile) goes back to the form.
        const fieldErrs = r.result.kind === 'error' ? r.result.fields ?? {} : {};
        const formErr = Object.keys(fieldErrs).find((k) => k !== 'code');
        if (formErr) return { kind: 'next', step: formStep(values, r.result) };
        return r.result;
      }
      return signIn(values, str(r.json.username) ?? String(values.username ?? ''));
    },
  });

  const formStep = (prefill: Record<string, string | boolean> = {}, problem?: AccountStepResult): AccountStep => ({
    title: form.title,
    message: form.description,
    fields: form.fields,
    cancelLabel,
    submitLabel: form.submit_label.toUpperCase(),
    busyLabel: 'Checking…',
    initial: prefill,
    initialErrors: problem && problem.kind === 'error' ? problem.fields : undefined,
    submit: async (values) => {
      const r = await postAccount(deps.absolutize(endpoint), values);
      if (!r.ok) return r.result;
      if (r.json.step === 'code') return { kind: 'next', step: codeStep(values, str(r.json.challenge) ?? '', str(r.json.email) ?? '') };
      return signIn(values, str(r.json.username) ?? String(values.username ?? ''));
    },
  });

  openAccountSheet(formStep());
}

/**
 * Delete account (P2c): the password again, then a real delete on the site, then signed out on the sign-in page.
 * The site refuses admins and wrong passwords with its own sentence.
 */
function openDeleteAccount(a: Record<string, unknown>, deps: AccountDeps): void {
  const auth = deps.auth;
  if (!auth || !deps.authHeader) {
    deps.dispatch({ action_slug: 'auth.require_signin' });
    return;
  }
  const authHeader = deps.authHeader;
  const endpoint = str(a.endpoint) ?? '/wp-json/appza/v1/account/delete';
  openAccountSheet({
    title: str(a.title) ?? 'Delete your account?',
    message:
      str(a.message) ??
      "This deletes your account with your posts, comments and messages. It can't be undone. Enter your password to confirm.",
    fields: [{ name: 'password', label: str(a.field_label) ?? 'Password', type: 'password', autoComplete: 'current-password', required: true }],
    cancelLabel: str(a.cancel_label) ?? 'CANCEL',
    submitLabel: str(a.confirm_label) ?? 'DELETE ACCOUNT',
    busyLabel: 'Deleting…',
    tone: 'destructive',
    submit: async (values) => {
      const r = await postAccount(deps.absolutize(endpoint), { password: String(values.password ?? '') }, { Authorization: authHeader(auth) });
      if (!r.ok) return r.result;
      // The account and its application password are gone: sign out here without calling the site.
      deps.dispatch({ action_slug: 'auth.logout' });
      deps.onInfo?.(str(r.json.message) ?? 'Your account has been deleted.');
      return { kind: 'close' };
    },
  });
}

/**
 * Site-level account facts from bootstrap's runtime_config (v1 parity P2b): whether the app may offer
 * "Create account". Gates read `state.site.signup_open` ('yes' / 'no', like the other catalog clauses).
 */

export type SignupState = { open: boolean; reason: '' | 'closed' | 'custom_page'; url: string };

let signup: SignupState = { open: false, reason: 'closed', url: '' };

export function setSignupState(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const r = raw as Record<string, unknown>;
  const reason = r.reason === 'custom_page' || r.reason === 'closed' ? r.reason : '';
  signup = { open: r.open === true, reason, url: typeof r.url === 'string' ? r.url : '' };
}

export function getSignupState(): SignupState {
  return signup;
}

/** A site with its own signup page still offers the link; it opens that page. */
export function signupStateEntries(): Record<string, unknown> {
  return { 'site.signup_open': signup.open || signup.reason === 'custom_page' ? 'yes' : 'no' };
}

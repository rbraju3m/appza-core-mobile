import { isAdvanced } from './advanced';

/**
 * One way to tell the site owner that something did not work: a plain sentence about what to do. The status code and
 * the server's own words are added only with Advanced on — they help a developer, not an owner.
 */

// A server message an owner can read: short, and no code names like "target_column" or "base_url_mode".
function readable(message: string): boolean {
  return message.length > 0 && message.length < 220 && !/\b[a-z]+_[a-z_]+\b|[{}<>]|\bHTTP\b/.test(message);
}

function serverMessage(body: string): string | null {
  try {
    const json = JSON.parse(body) as { message?: unknown; error?: unknown };
    const m = typeof json.message === 'string' ? json.message : typeof json.error === 'string' ? json.error : null;
    return m ? m.trim() : null;
  } catch {
    return null;
  }
}

function plain(status: number): string {
  if (status === 401 || status === 403) return 'Your WordPress sign-in has expired. Reload the page and sign in again.';
  if (status === 404) return 'Your site could not find this. Update the APPZA plug-in, then try again.';
  if (status === 409) return 'This was changed in another tab. Reload to see the latest.';
  if (status === 413) return 'That file is too big for your site.';
  if (status === 429) return 'Too many tries in a short time. Wait a minute, then try again.';
  if (status >= 400 && status < 500) return 'Some of the values were not accepted. Check them and try again.';
  return 'Your site had a problem. Try again in a moment; if it keeps happening, contact support.';
}

/** "<what failed>: <what to do>" for a response that was not ok. */
export function problemFor(status: number, body: string, doing?: string): string {
  const said = serverMessage(body);
  // Sign-in and server failures always get the plain sentence: WordPress words them for developers ("Cookie check failed").
  const ownWords = status !== 401 && status !== 403 && status < 500 && said && readable(said);
  const reason = ownWords ? said : plain(status);
  const lead = doing ? `${doing} didn't work. ` : '';
  const tech = isAdvanced() ? ` (HTTP ${status}${said ? `: ${said}` : body ? `: ${body.slice(0, 160)}` : ''})` : '';
  return `${lead}${reason}${tech}`;
}

/** Reads the body once and returns the sentence. */
export async function httpProblem(res: Response, doing?: string): Promise<string> {
  const body = await res.text().catch(() => '');
  return problemFor(res.status, body, doing);
}

/** For a caught error: a dropped connection reads as one; anything already plain passes through. */
export function caughtProblem(err: unknown, doing?: string): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return `${doing ? `${doing} didn't work. ` : ''}Couldn't reach your site. Check your internet connection and try again.`;
  }
  return message;
}

/** An Error whose message is already the owner's sentence. */
export class Problem extends Error {}

export async function throwIfNotOk(res: Response, doing?: string): Promise<void> {
  if (!res.ok) throw new Problem(await httpProblem(res, doing));
}

/** " (HTTP 500)" with Advanced on, nothing otherwise — for messages that already say what failed. */
export function httpTag(status: number): string {
  return isAdvanced() ? ` (HTTP ${status})` : '';
}

/** A feature the design names but cannot run (a missing address in the catalog): the owner can only update. */
export function setupGap(detail: string): string {
  return isAdvanced()
    ? detail
    : 'This part of your app is not set up yet. Press "Get latest designs"; if it keeps happening, contact support.';
}

// Friendly v2 P5: "Viewing as: Guest · Member · Me" and the phone / tablet frame.
//
// - Guest: no sign-in, as today.
// - Member: the plug-in's sample member. Only the preview proxy's reads switch to it (wp-admin nonce +
//   X-Appza-View-As), and taps that would change something are stopped here, so nothing is written as it.
// - Me: the wp-admin user. The plug-in mints an application password on their own account, the same credential
//   the simulator's sign-in form gets, so every tap works unchanged. It's revoked when the switch moves off Me.

export type ViewAs = 'guest' | 'member' | 'me';
export type DeviceSize = 'phone' | 'tablet';

export type ViewerSummary = { user_id: number; display_name: string; avatar: string };
export type Viewers = { me: ViewerSummary | null; member: ViewerSummary | null };

export type MeAuth = {
  username: string;
  token: string;
  uuid: string;
  user_id: number;
  display_name: string;
  avatar: string;
};

const VIEW_KEY = 'appza.builder.viewAs';
const DEVICE_KEY = 'appza.builder.device';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private window: the choice just isn't remembered */
  }
}

/** Only Member is remembered here; Me lives in the stored sign-in, and Guest is the default. */
export const readMemberView = (): boolean => read(VIEW_KEY) === 'member';
export const writeMemberView = (on: boolean): void => write(VIEW_KEY, on ? 'member' : 'guest');
export const readDevice = (): DeviceSize => (read(DEVICE_KEY) === 'tablet' ? 'tablet' : 'phone');
export const writeDevice = (d: DeviceSize): void => write(DEVICE_KEY, d);

function cfg() {
  return window.appzaCoreConfig;
}

export async function fetchViewers(): Promise<Viewers | null> {
  const url = cfg()?.endpoints?.previewViewer;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'X-WP-Nonce': cfg()?.restNonce ?? '' },
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Viewers;
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

export async function signInAsMe(): Promise<MeAuth> {
  const url = cfg()?.endpoints?.previewViewerMe;
  if (!url) throw new Error('This plug-in version can’t sign in as you yet.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'X-WP-Nonce': cfg()?.restNonce ?? '' },
    credentials: 'same-origin',
  });
  const j = (await res.json().catch(() => null)) as (Partial<MeAuth> & { message?: string }) | null;
  if (!res.ok || !j || typeof j.token !== 'string' || typeof j.username !== 'string') {
    throw new Error(j?.message || 'Couldn’t sign in as you. Reload the page and try again.');
  }
  return j as MeAuth;
}

/** Revokes a simulator sign-in's application password with core's own route. Best effort. */
export function revokeAppPassword(auth: { username: string; token: string; uuid?: string }): void {
  const base = cfg()?.endpoints?.appPasswords;
  if (!base || !auth.uuid) return;
  void fetch(`${base.replace(/\/$/, '')}/${encodeURIComponent(auth.uuid)}`, {
    method: 'DELETE',
    credentials: 'omit',
    headers: { Accept: 'application/json', Authorization: 'Basic ' + window.btoa(`${auth.username}:${auth.token}`) },
  }).catch(() => {});
}

/** Proxy headers for Member: the wp-admin session's nonce (the cookie rides along) and the switch. */
export function memberProxyHeaders(): Record<string, string> {
  return { 'X-WP-Nonce': cfg()?.restNonce ?? '', 'X-Appza-View-As': 'member' };
}

// Taps a sample member may make: moving around, opening things, menus, pickers, sorting, searching, copying a
// link, and signing in or out. Anything else could change the site, so it's stopped. An allow-list, so a new
// write action is stopped by default.
const MEMBER_ALLOWED =
  /^(nav\.|auth\.|banner\.|picker\.|search\.|link\.open$|media\.download$)|\.(set_[a-z_]+|open[a-z_]*|options|copy_link|toggle_section|goto|thread_menu|view_community|reply|reply_start|reply_cancel|discard_attachment|cancel_add|toggle_topic|compose_open|edit_inline|expand_levels|voters)$/;

export function memberMayRun(actionSlug: string): boolean {
  return MEMBER_ALLOWED.test(actionSlug);
}

export const MEMBER_BLOCKED_MESSAGE = 'Off while viewing as a member';

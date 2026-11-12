import { useCallback, useMemo, useState } from 'react';
import { Problem, httpProblem } from './errors';

/**
 * The app's identity (v1 parity P1c): its name, icon and splash. Stored by the plug-in (`/app-identity`), saved now
 * and used by the customer's own app builds (P7). In the builder it is one more unsaved change under the one Save
 * (D126); the set-up wizard saves it at once, like the look.
 */
export type AppIdentity = {
  name: string;
  icon_id: number;
  icon_url: string;
  splash_id: number;
  splash_url: string;
  /** #RRGGBB */
  splash_background: string;
};

export const NAME_MAX = 30;
export const ICON_SIZE = 1024;
export const SPLASH_MIN = 512;
export const SPLASH_MAX = 2732;
const MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_BACKGROUND = '#FFFFFF';

export function savedIdentity(): AppIdentity {
  const c = window.appzaCoreConfig?.appIdentity;
  return {
    name: typeof c?.name === 'string' ? c.name : '',
    icon_id: Number(c?.icon_id) || 0,
    icon_url: c?.icon_url ?? '',
    splash_id: Number(c?.splash_id) || 0,
    splash_url: c?.splash_url ?? '',
    splash_background: c?.splash_background || DEFAULT_BACKGROUND,
  };
}

/** Whether the site saved an identity yet. */
export function identitySaved(): boolean {
  const v = window.appzaCoreConfig?.appIdentity?.saved;
  return v === true || v === '1';
}

function remember(i: AppIdentity) {
  if (window.appzaCoreConfig) window.appzaCoreConfig.appIdentity = { ...i, saved: true };
}

const sameIdentity = (a: AppIdentity, b: AppIdentity) =>
  a.name === b.name &&
  a.icon_id === b.icon_id &&
  a.splash_id === b.splash_id &&
  a.splash_background.toUpperCase() === b.splash_background.toUpperCase();

/** What the plug-in will refuse, said before Save. Field → sentence. */
export function identityProblems(i: AppIdentity): Partial<Record<'name' | 'splash_background', string>> {
  const out: Partial<Record<'name' | 'splash_background', string>> = {};
  const n = [...i.name.trim()].length;
  if (n === 0 || n > NAME_MAX) out.name = `The app name needs 1 to ${NAME_MAX} characters.`;
  if (!/^#[0-9a-f]{6}$/i.test(i.splash_background)) out.splash_background = 'The splash background must be a colour like #1A73E8.';
  return out;
}

/** The body the plug-in takes (`/app-identity` and `builder/save`'s `identity`). */
export function identityBody(i: AppIdentity) {
  return { name: i.name.trim(), icon_id: i.icon_id, splash_id: i.splash_id, splash_background: i.splash_background.toUpperCase() };
}

/** The wizard's save. Throws a Problem naming each field the plug-in refused. */
export async function saveAppIdentity(i: AppIdentity): Promise<AppIdentity> {
  const endpoint = window.appzaCoreConfig?.endpoints?.appIdentity;
  const nonce = window.appzaCoreConfig?.restNonce;
  if (!endpoint || !nonce) throw new Problem('Open this page from your WordPress dashboard (APPZA in the menu) to continue.');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
    credentials: 'same-origin',
    body: JSON.stringify(identityBody(i)),
  });
  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as { data?: { errors?: Record<string, string> } };
    const errors = body?.data?.errors ? Object.values(body.data.errors) : [];
    throw new Problem(errors.length ? errors.join(' ') : 'Some of your app’s details were not accepted.');
  }
  if (!res.ok) throw new Problem(await httpProblem(res, 'Saving your app’s details'));
  const saved = (await res.json()) as AppIdentity;
  remember(saved);
  return saved;
}

/**
 * The builder's unsaved identity: one draft or none. `onEdit` is called just before a user's edit (Undo's step).
 * A draft equal to what is saved is no draft, so going back by hand clears the Unsaved mark.
 */
export function useAppIdentity(onEdit?: (thing: string) => void) {
  const [saved, setSavedState] = useState<AppIdentity>(savedIdentity);
  const [draft, setDraft] = useState<AppIdentity | null>(null);

  const change = useCallback(
    (patch: Partial<AppIdentity>, thing: string) => {
      onEdit?.(`identity:${thing}`);
      setDraft((d) => {
        const next = { ...(d ?? saved), ...patch };
        return sameIdentity(next, saved) ? null : next;
      });
    },
    [onEdit, saved],
  );

  /** The wizard saved one: the builder starts from it. */
  const setSaved = useCallback((i: AppIdentity) => {
    remember(i);
    setSavedState(i);
    setDraft((d) => (d && sameIdentity(d, i) ? null : d));
  }, []);

  /** After the one Save went through: the draft is now what is saved. */
  // The draft this closure saw is the one Save sent.
  const afterSave = useCallback(() => {
    if (!draft) return;
    remember(draft);
    setSavedState(draft);
    setDraft(null);
  }, [draft]);

  const discard = useCallback(() => setDraft(null), []);
  const restore = useCallback((all: Record<string, unknown>) => setDraft((all['identity'] as AppIdentity | undefined) ?? null), []);
  const edits = useMemo<Record<string, unknown>>(() => (draft ? { identity: draft } : {}), [draft]);

  /** `builder/save`'s `identity`, or undefined when unchanged. */
  const payload = useCallback(() => (draft ? identityBody(draft) : undefined), [draft]);

  return useMemo(
    () => ({
      value: draft ?? saved,
      saved,
      dirty: draft !== null,
      count: draft ? 1 : 0,
      change,
      setSaved,
      afterSave,
      discard,
      restore,
      edits,
      payload,
    }),
    [draft, saved, change, setSaved, afterSave, discard, restore, edits, payload],
  );
}

export type AppIdentityStore = ReturnType<typeof useAppIdentity>;

type WpAttachment = { id: number; url: string; mime?: string; width?: number; height?: number; filesizeInBytes?: number };
type WpMediaFrame = {
  on: (event: string, cb: () => void) => void;
  open: () => void;
  state: () => { get: (k: string) => { first: () => { toJSON: () => WpAttachment } | undefined } };
};
type WpMedia = (options: Record<string, unknown>) => WpMediaFrame;

// One frame per picker, opened again each time: a new frame per click would leave the old one in the page.
const frames = new Map<string, { frame: WpMediaFrame; resolve: ((a: WpAttachment | null) => void) | null }>();

/** Opens the WordPress media library on PNGs; resolves with the chosen image, or null when closed. */
export function pickPng(title: string, button: string): Promise<WpAttachment | null> {
  const media = (window as unknown as { wp?: { media?: WpMedia } }).wp?.media;
  if (!media) return Promise.reject(new Problem('The media library did not load. Reload the page and try again.'));
  let entry = frames.get(title);
  if (!entry) {
    const frame = media({ title, button: { text: button }, multiple: false, library: { type: 'image/png' } });
    const e: { frame: WpMediaFrame; resolve: ((a: WpAttachment | null) => void) | null } = { frame, resolve: null };
    const settle = (a: WpAttachment | null) => {
      const r = e.resolve;
      e.resolve = null;
      r?.(a);
    };
    frame.on('select', () => settle(frame.state().get('selection').first()?.toJSON() ?? null));
    // 'close' comes before 'select' in some versions: let a select in the same turn win.
    frame.on('close', () => window.setTimeout(() => settle(null), 0));
    entry = e;
    frames.set(title, entry);
  }
  const current = entry;
  return new Promise((resolve) => {
    current.resolve?.(null);
    current.resolve = resolve;
    current.frame.open();
  });
}

/** Whether any pixel is see-through (the stores refuse such an icon). The plug-in checks again on save. */
function seeThrough(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(false);
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let k = 3; k < d.length; k += 4) if (d[k]! < 255) return resolve(true);
        resolve(false);
      } catch {
        resolve(false); // A cross-origin image can't be read here; the plug-in still checks.
      }
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** The same rules the plug-in applies, so a wrong file is named at once, not at Save. '' when fine. */
export async function checkPicked(a: WpAttachment, kind: 'icon' | 'splash'): Promise<string> {
  const what = kind === 'icon' ? 'The icon' : 'The splash image';
  if (a.mime && a.mime !== 'image/png') return `${what} must be a PNG image.`;
  if (a.filesizeInBytes && a.filesizeInBytes > MAX_BYTES) return `${what} must be 2 MB or smaller.`;
  const w = a.width ?? 0;
  const h = a.height ?? 0;
  if (kind === 'icon') {
    if (w !== ICON_SIZE || h !== ICON_SIZE) return `The icon must be ${ICON_SIZE} × ${ICON_SIZE} pixels (this one is ${w} × ${h}).`;
    if (await seeThrough(a.url)) return 'The icon can’t have see-through parts: the app stores refuse it. Fill the background.';
    return '';
  }
  if (w !== h) return `The splash image must be square (this one is ${w} × ${h}).`;
  if (w < SPLASH_MIN || w > SPLASH_MAX) return `The splash image must be ${SPLASH_MIN} to ${SPLASH_MAX} pixels wide (this one is ${w}).`;
  return '';
}

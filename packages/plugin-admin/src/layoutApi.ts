import { isRecord, screenLayoutKey } from '@appza/renderer';

/** One entry of a builder layout as the client edits it (D110). The server turns `visibility` into `visible_when`. */
export type LayoutItem = {
  key: string;
  appzet_slug?: string;
  layout?: string;
  props_override?: Record<string, unknown>;
  visibility?: Visibility;
};

export type Visibility = 'always' | 'signed_in' | 'signed_out';

export type CoreItem = {
  key: string;
  appzet_slug: string;
  slot?: string;
  visible_when?: unknown;
};

export type ScreenDraft = {
  template: string;
  screen: string;
  core: CoreItem[];
  palette: string[];
  baseVersion: number | null;
  drift: boolean;
  saved: LayoutItem[] | null;
  items: LayoutItem[];
  dirty: boolean;
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  always: 'Always shown',
  signed_in: 'Signed-in only',
  signed_out: 'Signed-out only',
};

const VISIBILITY_CLAUSE: Record<Visibility, unknown> = {
  always: null,
  signed_in: { binding: 'state.viewer.is_logged_in', op: '==', value: true },
  signed_out: { binding: 'state.viewer.is_logged_in', op: '==', value: false },
};

function base(): string {
  const customizations = window.appzaCoreConfig?.endpoints?.customizations ?? '';
  return customizations.replace(/\/customizations\/?$/, '');
}

export type LayoutPart = 'body' | 'appbar' | 'nav' | 'drawer' | 'drawer-menu';

/** A null screen is the template's chrome. */
function url(template: string, screen: string | null, part: LayoutPart = 'body'): string {
  const t = encodeURIComponent(template);
  return screen === null
    ? `${base()}/chrome-layout/${t}/${part}`
    : `${base()}/screen-layout/${t}/${encodeURIComponent(screen)}/${part}`;
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/json', 'X-WP-Nonce': window.appzaCoreConfig?.restNonce ?? '' };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

// Not crypto.randomUUID: it needs a secure context, and wp-admin here is http.
export function newSiteKey(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `site-${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function fromStored(raw: unknown): LayoutItem | null {
  if (!isRecord(raw) || typeof raw.key !== 'string') return null;
  const item: LayoutItem = { key: raw.key };
  if (typeof raw.appzet_slug === 'string') item.appzet_slug = raw.appzet_slug;
  if (typeof raw.layout === 'string') item.layout = raw.layout;
  if (isRecord(raw.props_override)) item.props_override = raw.props_override;
  if ('visible_when' in raw) {
    const vw = raw.visible_when;
    if (vw === null) item.visibility = 'always';
    else if (isRecord(vw) && vw.binding === 'state.viewer.is_logged_in') item.visibility = vw.value === false ? 'signed_out' : 'signed_in';
  }
  return item;
}

export type PartPayload = {
  core: unknown[];
  site: unknown[] | null;
  palette: string[];
  version: number | null;
  drift: boolean;
};

export async function loadPart(template: string, screen: string | null, part: LayoutPart): Promise<PartPayload> {
  const res = await fetch(url(template, screen, part), { headers: headers(), credentials: 'same-origin' });
  const body = await res.json();
  if (!res.ok) throw new Error(isRecord(body) && typeof body.message === 'string' ? body.message : `HTTP ${res.status}`);
  return {
    core: Array.isArray(body.core) ? body.core : [],
    site: Array.isArray(body.site) ? body.site : null,
    palette: Array.isArray(body.palette) ? (body.palette as string[]) : [],
    version: typeof body.version === 'number' ? body.version : null,
    drift: body.drift === true,
  };
}

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; status: number; message: string; errors?: Record<string, string> };

export async function savePart(
  template: string,
  screen: string | null,
  part: LayoutPart,
  items: unknown[],
  baseVersion: number | null,
): Promise<SaveResult> {
  const res = await fetch(url(template, screen, part), {
    method: 'PUT',
    headers: headers(true),
    credentials: 'same-origin',
    body: JSON.stringify({ items, base_version: baseVersion }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && typeof body.version === 'number') return { ok: true, version: body.version };
  return {
    ok: false,
    status: res.status,
    message: isRecord(body) && typeof body.message === 'string' ? body.message : `HTTP ${res.status}`,
    errors: isRecord(body) && isRecord(body.data) && isRecord(body.data.errors) ? (body.data.errors as Record<string, string>) : undefined,
  };
}

export async function resetPart(template: string, screen: string | null, part: LayoutPart): Promise<boolean> {
  const res = await fetch(url(template, screen, part), { method: 'DELETE', headers: headers(), credentials: 'same-origin' });
  return res.ok;
}

export async function loadDraft(template: string, screen: string): Promise<ScreenDraft> {
  const body = await loadPart(template, screen, 'body');
  const core = body.core as CoreItem[];
  const saved = body.site ? body.site.map(fromStored).filter((i): i is LayoutItem => i !== null) : null;
  return {
    template,
    screen,
    core,
    palette: body.palette,
    baseVersion: body.version,
    drift: body.drift,
    saved,
    items: saved ?? core.map((c) => ({ key: c.key })),
    dirty: false,
  };
}

export function saveDraft(d: ScreenDraft, items: LayoutItem[] = d.items): Promise<SaveResult> {
  return savePart(d.template, d.screen, 'body', items, d.baseVersion);
}

export function resetDraft(d: ScreenDraft): Promise<boolean> {
  return resetPart(d.template, d.screen, 'body');
}

/** The draft as the renderer reads a saved row, so the preview shows unsaved work. */
export function draftAsCustomization(customizations: unknown, drafts: ScreenDraft[]): unknown {
  const shown = drafts.filter((d) => d.dirty);
  if (shown.length === 0) return customizations;
  const root = isRecord(customizations) ? { ...customizations } : {};
  const byTarget = isRecord(root.template_screen) ? { ...root.template_screen } : {};
  for (const d of shown) {
    const key = screenLayoutKey(d.template, d.screen);
    const prev = isRecord(byTarget[key]) ? byTarget[key] : {};
    byTarget[key] = {
      ...prev,
      placements: {
        items: d.items.map((i) => {
          const { visibility, ...rest } = i;
          const stored: Record<string, unknown> = { ...rest };
          if (i.key.startsWith('site-')) stored.slot = 'main';
          if (visibility) stored.visible_when = VISIBILITY_CLAUSE[visibility];
          return stored;
        }),
      },
    };
  }
  root.template_screen = byTarget;
  return root;
}

export type Row = {
  key: string;
  appzet_slug: string;
  slot: string;
  coreGate: boolean;
  visibility?: Visibility;
  isSite: boolean;
};

export function rowsOf(d: ScreenDraft): Row[] {
  const core = new Map(d.core.map((c) => [c.key, c]));
  const out: Row[] = [];
  for (const i of d.items) {
    const c = core.get(i.key);
    const slug = c?.appzet_slug ?? i.appzet_slug;
    if (!slug) continue;
    out.push({
      key: i.key,
      appzet_slug: slug,
      slot: c?.slot ?? 'main',
      coreGate: c ? c.visible_when !== undefined && c.visible_when !== null : false,
      visibility: i.visibility,
      isSite: !c,
    });
  }
  return out;
}

/** Main rows move; footer rows keep their place at the end of the array. */
export function mainKeys(d: ScreenDraft): string[] {
  return rowsOf(d).filter((r) => r.slot !== 'footer').map((r) => r.key);
}

export function withMainOrder(d: ScreenDraft, order: string[]): LayoutItem[] {
  const byKey = new Map(d.items.map((i) => [i.key, i]));
  const footer = rowsOf(d).filter((r) => r.slot === 'footer').map((r) => byKey.get(r.key)!);
  return [...order.map((k) => byKey.get(k)!).filter(Boolean), ...footer];
}

export function insertAt(d: ScreenDraft, index: number, item: LayoutItem): LayoutItem[] {
  const order = mainKeys(d);
  const at = Math.max(0, Math.min(index, order.length));
  const byKey = new Map(d.items.map((i) => [i.key, i]));
  byKey.set(item.key, item);
  const next = [...order.slice(0, at), item.key, ...order.slice(at)];
  const footer = rowsOf(d).filter((r) => r.slot === 'footer').map((r) => r.key);
  return [...next, ...footer].map((k) => byKey.get(k)!);
}

export function missingCore(d: ScreenDraft): LayoutItem[] {
  const have = new Set(d.items.map((i) => i.key));
  return d.core.filter((c) => !have.has(c.key)).map((c) => ({ key: c.key }));
}

import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { parseSiteAddress } from '@appza/schemas';

// Which WordPress site the app shows. A customer's app has it baked in; the demo build (VITE_APPZA_DEMO=1) is told at
// run time, by the builder's Connect Site link or a typed address, and remembers it.

export const IS_DEMO = (import.meta.env.VITE_APPZA_DEMO as string | undefined) === '1';
export const ALLOW_HTTP = import.meta.env.DEV || (import.meta.env.VITE_APPZA_ALLOW_HTTP as string | undefined) === '1';

const DEMO_KEY = 'appza:demo-site';
const BAKED_SITE =
  (import.meta.env.VITE_APPZA_SITE_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://tutor-lms-mobile.local' : '');
const BAKED_TEMPLATE = (import.meta.env.VITE_APPZA_TEMPLATE as string | undefined) ?? 'fluent-community-default';

type DemoSite = { site: string; template: string; name: string };

function storedDemoSite(): DemoSite | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? 'null');
    return v && typeof v.site === 'string' && typeof v.template === 'string' ? { name: '', ...v } : null;
  } catch {
    return null;
  }
}

const demo = IS_DEMO ? storedDemoSite() : null;

/** Read once at start: switching site reloads the app. */
export const SITE_URL = IS_DEMO ? demo?.site ?? '' : BAKED_SITE;
export const TEMPLATE = demo?.template ?? BAKED_TEMPLATE;
export const DEMO_SITE_NAME = demo?.name || (demo ? new URL(demo.site).host : '');

export type ConnectResult = { ok: true } | { ok: false; message: string };

/** Checks the address runs APPZA 2.0, then remembers it and restarts the app on it. */
export async function connectDemoSite(input: string): Promise<ConnectResult> {
  const site = parseSiteAddress(input, ALLOW_HTTP);
  if (!site) {
    return { ok: false, message: ALLOW_HTTP ? 'That doesn’t look like a website address.' : 'Enter your site’s address, starting with https://.' };
  }
  let template = '';
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(`${site}/wp-json/appza/v1/bootstrap`, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    window.clearTimeout(timer);
    if (res.status === 400) return { ok: false, message: 'That site’s APPZA plug-in is out of date. Update it, then try again.' };
    const body = res.ok ? await res.json() : null;
    template = typeof body?.catalog?.template?.slug === 'string' ? body.catalog.template.slug : '';
  } catch {
    return { ok: false, message: 'Couldn’t reach that site. Check the address and your connection.' };
  }
  if (!template) {
    return { ok: false, message: 'That site doesn’t have APPZA 2.0 yet. Install the APPZA plug-in on it first.' };
  }
  if (site === SITE_URL && template === TEMPLATE) return { ok: true };
  await switchTo({ site, template, name: new URL(site).host });
  return { ok: true };
}

export async function forgetDemoSite(): Promise<void> {
  await switchTo(null);
}

// Another site's sign-in and cached content must not carry over: storage is wiped before the reload.
async function switchTo(next: DemoSite | null): Promise<void> {
  await SecureStorage.removeItem('appza:auth').catch(() => {});
  window.localStorage.clear();
  if (next) window.localStorage.setItem(DEMO_KEY, JSON.stringify(next));
  window.location.reload();
}

import { Problem, httpProblem } from './errors';

// Friendly v2 P2: the template this site's app is built from, the builder tour (per WordPress user) and the wizard's
// connect step. All three live in the plug-in (`/site-template`, `/onboarding/tour-seen`, `/core-connection`).

export type TemplateCard = {
  slug: string;
  name: string;
  description?: string | null;
  preview_image_url?: string | null;
  source_integration_slug: string;
  source_integration_name: string;
};

export type CoreConnection = { url: string; locked: boolean; connected: boolean; message: string };

/** wp_localize_script turns booleans into "1" / "". */
export function configFlag(v: boolean | string | undefined): boolean {
  return v === true || v === '1' || v === 'true';
}

function wp(): { nonce?: string; endpoints: NonNullable<NonNullable<Window['appzaCoreConfig']>['endpoints']> } {
  const cfg = window.appzaCoreConfig;
  return { nonce: cfg?.restNonce, endpoints: cfg?.endpoints ?? {} };
}

async function call<T>(endpoint: string | undefined, doing: string, init: RequestInit = {}): Promise<T> {
  const { nonce } = wp();
  if (!endpoint || !nonce) throw new Problem('Open this page from your WordPress dashboard (APPZA in the menu) to continue.');
  const res = await fetch(endpoint, {
    ...init,
    headers: { Accept: 'application/json', 'X-WP-Nonce': nonce, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    credentials: 'same-origin',
  });
  // 502 = the plug-in could not reach APPZA (its own wording would blame the site).
  if (res.status === 502) throw new Problem(`${doing} didn't work: this site couldn't reach APPZA. Check the connection, then try again.`);
  if (!res.ok) throw new Problem(await httpProblem(res, doing));
  return (await res.json()) as T;
}

/** Saves the site's template; refused unless Core offers it for the site's platforms. */
export function saveSiteTemplate(slug: string): Promise<{ template: string; saved: boolean; synced: boolean }> {
  return call(wp().endpoints.siteTemplate, 'Saving your app\'s design', { method: 'POST', body: JSON.stringify({ template: slug }) });
}

export async function markTourSeen(): Promise<void> {
  await call(wp().endpoints.tourSeen, 'Saving the tour', { method: 'POST' });
}

export function readConnection(): Promise<CoreConnection> {
  return call(wp().endpoints.coreConnection, 'Checking the connection to APPZA');
}

export function saveConnection(url: string): Promise<CoreConnection> {
  return call(wp().endpoints.coreConnection, 'Saving the APPZA address', { method: 'POST', body: JSON.stringify({ url }) });
}

/** The templates Core offers for the platforms the site picked (the plug-in forwards its saved list). */
export async function loadTemplateCards(): Promise<TemplateCard[]> {
  const endpoint = wp().endpoints.templates;
  if (!endpoint) return [];
  const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Problem(await httpProblem(res, 'Loading the designs'));
  const body = await res.json();
  return Array.isArray(body?.templates) ? (body.templates as TemplateCard[]) : [];
}

/** Gets a template's designs from APPZA into this site (the same call as "Get latest designs"). */
export async function syncTemplate(slug: string): Promise<void> {
  const endpoint = wp().endpoints.syncFromCore;
  if (!endpoint) throw new Problem('Open this page from your WordPress dashboard to get the designs.');
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set('template', slug);
  await call(url.toString(), 'Getting your app\'s designs', { method: 'POST' });
}

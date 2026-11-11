// P1e: the builder's "Connect Site" QR opens the APPZA demo app with the site to show. Only the demo build answers it.

export const DEMO_CONNECT_SCHEME = 'appza-demo';

export function demoConnectLink(siteUrl: string): string {
  return `${DEMO_CONNECT_SCHEME}://connect?site=${encodeURIComponent(siteUrl)}`;
}

/** The site's origin + path from a connect link or a typed address, or null. http only when `allowHttp`. */
export function parseSiteAddress(input: string, allowHttp: boolean): string | null {
  let raw = input.trim();
  if (raw.startsWith(`${DEMO_CONNECT_SCHEME}://`)) {
    try {
      raw = new URL(raw.replace(`${DEMO_CONNECT_SCHEME}://`, 'https://')).searchParams.get('site') ?? '';
    } catch {
      return null;
    }
  }
  if (!/^[a-z]+:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) return null;
  if (url.username || url.password || !url.hostname.includes('.')) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

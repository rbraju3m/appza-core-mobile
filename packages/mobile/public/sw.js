// Service Worker for the APPZA Capacitor shell.
//
// Sole job: add `Bypass-Tunnel-Reminder: 1` to every outgoing request.
// The window.fetch patch in main.tsx only covers explicit fetch() calls;
// <img>/<video>/<audio> loads go through the browser's native loader,
// which never sends that header. When the backend is behind loca.lt (or
// any tunnel that gates browser-shaped requests with a "click continue"
// interstitial), those native loads come back as HTTP 511 + HTML and
// the images silently fail.
//
// Intercepting via SW lets us re-issue every request with the header
// attached, regardless of who initiated the load. Harmless against
// production endpoints — unknown header, ignored server-side.
//
// Scope: registered at the SW's own path (root), so it controls the
// entire origin (https://localhost on Capacitor Android).

self.addEventListener('install', (event) => {
  // Skip the "waiting" state so upgrades take effect on the next reload.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Claim any already-loaded pages so image loads from the current session
  // start being intercepted immediately (not just on the next navigation).
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only rewrite GET/HEAD. Bodies for POST/PUT are already correctly built
  // by the app-side fetch patch and we don't want to touch them.
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  // If the header is already set (e.g. by the window.fetch patch),
  // there's nothing to add. Re-issuing would still work but pointless.
  if (req.headers.has('Bypass-Tunnel-Reminder')) return;
  // Only add the header on loca.lt hosts. On other hosts (cloudflared,
  // gravatar, etc.) it would trigger a CORS preflight that fails against
  // static resources, breaking image loads.
  if (!/(^|\.)loca\.lt(:|\/|$)/i.test(req.url)) return;

  event.respondWith(
    (async () => {
      // Clone the request into a new Request with our extra header added.
      // We can't mutate req.headers directly — it's immutable on Request.
      const newHeaders = new Headers(req.headers);
      newHeaders.set('Bypass-Tunnel-Reminder', '1');
      // `mode: 'no-cors'` for opaque cross-origin resource loads (images
      // from a different host than the SPA); the browser's image loader
      // handles opaque responses fine.
      const newReq = new Request(req.url, {
        method: req.method,
        headers: newHeaders,
        // Keep the original request's mode so CORS-aware requests
        // (e.g. explicit fetch() calls) still validate CORS correctly.
        mode: req.mode,
        credentials: req.credentials,
        redirect: req.redirect,
        referrer: req.referrer,
        integrity: req.integrity,
      });
      return fetch(newReq);
    })(),
  );
});

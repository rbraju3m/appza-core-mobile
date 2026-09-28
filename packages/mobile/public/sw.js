// Native <img>/<video> loads bypass the window.fetch patch, so add the loca.lt `Bypass-Tunnel-Reminder` header here.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  if (req.headers.has('Bypass-Tunnel-Reminder')) return;
  // loca.lt only: elsewhere the header triggers a CORS preflight that breaks static resources.
  if (!/(^|\.)loca\.lt(:|\/|$)/i.test(req.url)) return;

  event.respondWith(
    (async () => {
      const newHeaders = new Headers(req.headers);
      newHeaders.set('Bypass-Tunnel-Reminder', '1');
      const newReq = new Request(req.url, {
        method: req.method,
        headers: newHeaders,
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

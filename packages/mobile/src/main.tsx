import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@appza/renderer/styles.css';
import './styles.css';

import { App, loadStoredAuth } from './App';

// Global fetch patch for the Capacitor shell:
//   1. Bake `Bypass-Tunnel-Reminder: 1` into every request so dev tunnels
//      (loca.lt) don't return their HTML "click to continue" interstitial
//      that WebView fetch() can't click through. Harmless against real
//      backends — WordPress ignores unknown headers.
//   2. Rewrite root-relative /wp-json/... URLs to the build-time SITE_URL.
//      Catalog action wirings ship with relative endpoints so the plugin-
//      admin sim (browser origin = WP site) can hit them directly. On
//      Android WebView the JS origin is https://localhost — a relative
//      /wp-json call would hit Capacitor's local static server and get
//      index.html (200 + HTML) back, breaking the JSON parse in every
//      write-action dispatcher.
const SITE_URL =
  (import.meta.env.VITE_APPZA_SITE_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://tutor-lms-mobile.local' : '');
{
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let target: RequestInfo | URL = input;
    let targetHref = '';
    // Only rewrite string URLs — a Request object already has its own
    // absolute-URL contract and re-wrapping it would drop the body.
    if (typeof input === 'string' && input.startsWith('/')) {
      target = SITE_URL.replace(/\/$/, '') + input;
      targetHref = target as string;
    } else if (input instanceof URL && input.pathname && input.href.startsWith('capacitor://')) {
      target = SITE_URL.replace(/\/$/, '') + input.pathname + input.search;
      targetHref = target as string;
    } else if (typeof input === 'string') {
      targetHref = input;
    } else if (input instanceof URL) {
      targetHref = input.href;
    } else if (input instanceof Request) {
      targetHref = input.url;
    }
    // Bypass-Tunnel-Reminder header is only meaningful for loca.lt; adding
    // it on other hosts triggers a CORS preflight that fails against static
    // uploads (no allow-headers echo), breaking image loads. Scope tightly.
    if (/(^|\.)loca\.lt(:|\/|$)/i.test(targetHref)) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      if (!headers.has('Bypass-Tunnel-Reminder')) headers.set('Bypass-Tunnel-Reminder', '1');
      return originalFetch(target, { ...(init ?? {}), headers });
    }
    return originalFetch(target, init);
  };
}

// Visible in-app debug panel — hovers at the bottom of the screen and
// shows the last N console log/warn/error lines. Tap the header to
// collapse/expand. A stopgap so on-device diagnostics don't require
// chrome://inspect.
//
// OFF unless the build asks for it. It shipped in every APK unmounted
// by nothing — a black box over the bottom third of the screen, which
// is fine for the team diagnosing something and wrong for anyone else
// holding the phone. Vite inlines this at build time, so a normal build
// drops the whole block rather than shipping a dead branch:
//
//   VITE_APPZA_DEBUG_PANEL=1 npm run build
if ((import.meta.env.VITE_APPZA_DEBUG_PANEL as string | undefined) === '1') {
  const MAX_LINES = 40;
  const lines: string[] = [];
  let panel: HTMLDivElement | null = null;
  let body: HTMLDivElement | null = null;
  let collapsed = false;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.setAttribute('data-appza-debug', 'true');
    panel.style.cssText =
      'position:fixed;left:6px;right:6px;bottom:6px;z-index:9999;background:rgba(15,23,42,0.95);color:#fff;font-family:ui-monospace,Menlo,monospace;font-size:10px;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.4);overflow:hidden;max-height:35vh;display:flex;flex-direction:column';
    const header = document.createElement('div');
    header.style.cssText =
      'padding:4px 8px;background:#1e293b;font-weight:600;display:flex;justify-content:space-between;align-items:center;cursor:pointer';
    header.textContent = 'appza·debug';
    const btn = document.createElement('span');
    btn.textContent = '▼';
    header.appendChild(btn);
    header.addEventListener('click', () => {
      collapsed = !collapsed;
      if (body) body.style.display = collapsed ? 'none' : 'block';
      btn.textContent = collapsed ? '▲' : '▼';
    });
    body = document.createElement('div');
    body.style.cssText = 'padding:4px 8px;overflow-y:auto;flex:1;white-space:pre-wrap;word-break:break-all';
    panel.appendChild(header);
    panel.appendChild(body);
    (document.body || document.documentElement).appendChild(panel);
    return panel;
  }

  function pushLine(color: string, msg: string) {
    lines.push(msg);
    while (lines.length > MAX_LINES) lines.shift();
    ensurePanel();
    if (!body) return;
    const el = document.createElement('div');
    el.style.color = color;
    el.textContent = msg;
    body.appendChild(el);
    while (body.childNodes.length > MAX_LINES) body.removeChild(body.firstChild!);
    if (!collapsed) body.scrollTop = body.scrollHeight;
  }

  function stringify(args: unknown[]): string {
    return args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.message;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
  }

  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a: unknown[]) => {
    orig.log(...a);
    pushLine('#a5b4fc', stringify(a));
  };
  console.warn = (...a: unknown[]) => {
    orig.warn(...a);
    pushLine('#fbbf24', stringify(a));
  };
  console.error = (...a: unknown[]) => {
    orig.error(...a);
    pushLine('#f87171', stringify(a));
  };
  window.addEventListener('error', (e) => {
    pushLine('#f87171', 'window.error: ' + (e.message ?? String(e)));
  });
  window.addEventListener('unhandledrejection', (e) => {
    pushLine('#f87171', 'unhandledrejection: ' + (e.reason?.message ?? String(e.reason)));
  });

  document.addEventListener('DOMContentLoaded', ensurePanel);
  // Trace initial state so user sees SOMETHING even before events fire.
  console.log('[appza-mobile] boot · location.origin=' + window.location.origin);
}

// Belt-and-braces: on Capacitor Android WebViews the ServiceWorker fetch
// event doesn't always intercept native <img> loads (varies by WebView
// vendor + version). Watch the DOM for new <img>s pointing at absolute
// http(s) URLs and swap their src for a blob URL fetched through the
// header-injecting window.fetch above. Redundant when SW works — harmless.
const IMG_BLOB_CACHE = new Map<string, string>();
function rewriteImgToBlob(img: HTMLImageElement) {
  const src = img.getAttribute('src') ?? '';
  if (!src) return;
  if (!/^https?:\/\//i.test(src)) return; // ignore blob:/data:/relative
  if (img.dataset.appzaBlobified === '1') return;
  img.dataset.appzaBlobified = '1';
  img.dataset.appzaOriginalSrc = src;
  const cached = IMG_BLOB_CACHE.get(src);
  if (cached) {
    img.src = cached;
    return;
  }
  void fetch(src)
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((blob) => {
      const objUrl = URL.createObjectURL(blob);
      IMG_BLOB_CACHE.set(src, objUrl);
      img.src = objUrl;
    })
    .catch((err) => {
      console.warn('[appza-mobile] img rewrite failed', src, err);
      img.dataset.appzaBlobified = '';
    });
}
// Sweep existing imgs at boot, then watch for new ones.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img').forEach(rewriteImgToBlob);
});
const imgObserver = new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'childList') {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLImageElement) rewriteImgToBlob(n);
        else if (n instanceof HTMLElement) {
          n.querySelectorAll('img').forEach(rewriteImgToBlob);
        }
      });
    } else if (r.type === 'attributes' && r.target instanceof HTMLImageElement) {
      // src changed on an existing <img>; re-blobify if it's a fresh http URL.
      const el = r.target;
      const src = el.getAttribute('src') ?? '';
      if (/^https?:\/\//i.test(src) && el.dataset.appzaOriginalSrc !== src) {
        el.dataset.appzaBlobified = '';
        rewriteImgToBlob(el);
      }
    }
  }
});
imgObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src'],
});

// SW only rewrites loca.lt requests (see public/sw.js). Skip registration
// when the backend isn't a loca.lt tunnel — on Capacitor's https://localhost
// origin the WebView often can't fetch /sw.js and the failure surfaces in
// the debug panel as "Failed to fetch" with no useful effect either way.
if ('serviceWorker' in navigator && /(^|\.)loca\.lt(:|\/|$)/i.test(SITE_URL)) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
    console.warn('[appza-mobile] SW registration failed:', err);
  });
}

setupIonicReact();

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');
void loadStoredAuth().finally(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

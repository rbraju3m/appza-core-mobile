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

// Catalog endpoints are root-relative; on Android the origin is https://localhost, so /wp-json would hit Capacitor's static server and get index.html.
const SITE_URL =
  (import.meta.env.VITE_APPZA_SITE_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://tutor-lms-mobile.local' : '');
// Tunnel workarounds (loca.lt header, img→blob, sw.js): dev, or a build with VITE_APPZA_TUNNEL_SHIMS=1.
const TUNNEL_SHIMS = import.meta.env.DEV || (import.meta.env.VITE_APPZA_TUNNEL_SHIMS as string | undefined) === '1';
{
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let target: RequestInfo | URL = input;
    let targetHref = '';
    // A Request object is left alone — re-wrapping it would drop the body.
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
    // loca.lt only: elsewhere the extra header triggers a CORS preflight that breaks static image loads.
    if (TUNNEL_SHIMS && /(^|\.)loca\.lt(:|\/|$)/i.test(targetHref)) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      if (!headers.has('Bypass-Tunnel-Reminder')) headers.set('Bypass-Tunnel-Reminder', '1');
      return originalFetch(target, { ...(init ?? {}), headers });
    }
    return originalFetch(target, init);
  };
}

// Opt-in (VITE_APPZA_DEBUG_PANEL=1); Vite drops the block from normal builds.
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
  console.log('[appza-mobile] boot · location.origin=' + window.location.origin);
}

// Some Android WebViews bypass the SW for native <img> loads, so re-fetch them through the patched fetch as blobs.
const IMG_BLOB_CACHE = new Map<string, string>();
function rewriteImgToBlob(img: HTMLImageElement) {
  const src = img.getAttribute('src') ?? '';
  if (!src) return;
  if (!/^https?:\/\//i.test(src)) return;
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
      const el = r.target;
      const src = el.getAttribute('src') ?? '';
      if (/^https?:\/\//i.test(src) && el.dataset.appzaOriginalSrc !== src) {
        el.dataset.appzaBlobified = '';
        rewriteImgToBlob(el);
      }
    }
  }
});
if (TUNNEL_SHIMS) {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(rewriteImgToBlob);
  });
  imgObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}

// The SW only matters for loca.lt; on https://localhost the WebView often can't fetch /sw.js.
if (TUNNEL_SHIMS && 'serviceWorker' in navigator && /(^|\.)loca\.lt(:|\/|$)/i.test(SITE_URL)) {
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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { IonApp, IonContent, setupIonicReact } from '@ionic/react';
import {
  ActionProvider,
  PlacementRenderer,
  ScreenRenderer,
  filterScreensBySurface,
  indexCatalog,
  setCatalogGlobal,
  setViewer,
  tokensToCssVars,
} from '@appza/renderer';
import type { Catalog } from '@appza/schemas';

import '@ionic/react/css/core.css';
import '@appza/renderer/styles.css';

// Core's admin routes need the session, but the renderer fetches with credentials omitted.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
  if (url.origin === window.location.origin && url.pathname.startsWith('/admin/preview/')) {
    return nativeFetch(input, { ...init, credentials: 'same-origin' });
  }
  return nativeFetch(input, init);
};

(window as unknown as { appzaCoreConfig: unknown }).appzaCoreConfig = {
  endpoints: { previewProxy: '/admin/preview/data' },
  previewMode: 'auto',
};

const q = new URLSearchParams(window.location.search);
const template = q.get('template') ?? '';
const screenSlug = q.get('screen');
const appzetSlug = q.get('appzet');
const layout = q.get('layout') ?? undefined;
setViewer({ is_logged_in: q.get('viewer') !== 'guest' });

setupIonicReact();
const root = createRoot(document.getElementById('root')!);

function Message({ text }: { text: string }) {
  return <p style={{ font: '14px system-ui, sans-serif', color: '#666', padding: 16 }}>{text}</p>;
}

const dispatch = (inv: { action_slug: string }) => console.info('[appza-preview] tap does nothing here:', inv.action_slug);

async function boot() {
  const snapshotUrl = new URL('/admin/preview/snapshot', window.location.origin);
  snapshotUrl.searchParams.set('template', template);
  if (appzetSlug) snapshotUrl.searchParams.set('appzet', appzetSlug);
  const res = await nativeFetch(snapshotUrl, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  // An expired session is followed to the login page, which answers 200 with HTML.
  if (res.redirected || !(res.headers.get('content-type') ?? '').includes('json')) {
    root.render(<Message text="Sign in to Core again, then reload the preview." />);
    return;
  }
  if (!res.ok) {
    root.render(<Message text={res.status === 404 ? `No template "${template}".` : `Could not load the template (HTTP ${res.status}).`} />);
    return;
  }
  draw(((await res.json()) as { snapshot: Catalog }).snapshot);

  // Core's edit page posts the snapshot with its unsaved form applied; draw that instead.
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const msg = e.data as { type?: string; snapshot?: Catalog } | null;
    if (msg?.type === 'appza:preview-snapshot' && msg.snapshot) draw(msg.snapshot);
  });
  window.parent.postMessage({ type: 'appza:preview-ready' }, window.location.origin);
}

function draw(catalog: Catalog) {
  setCatalogGlobal(catalog);

  if (appzetSlug) {
    root.render(
      <StrictMode>
        <ActionProvider dispatch={dispatch}>
          {/* The shell ScreenRenderer gives a screen: the template's theme, and the scroll area lists need. */}
          <IonApp className="appza-renderer-app" style={tokensToCssVars(catalog.template?.tokens)}>
            <IonContent>
              <PlacementRenderer appzetSlug={appzetSlug} layout={layout} catalogIndex={indexCatalog(catalog)} customizations={{}} />
            </IonContent>
          </IonApp>
        </ActionProvider>
      </StrictMode>,
    );
    return;
  }

  const screens = filterScreensBySurface(catalog.template_screens ?? [], 'mobile');
  const screen = screens.find((s) => s.app_map_screen_slug === screenSlug) ?? screens[0];
  if (!screen) {
    root.render(<Message text="This template has no screen for phones." />);
    return;
  }
  root.render(
    <StrictMode>
      <ActionProvider dispatch={dispatch}>
        <ScreenRenderer screen={screen} catalog={catalog} customizations={{}} />
      </ActionProvider>
    </StrictMode>,
  );
}

boot().catch((e) => root.render(<Message text={`Preview failed: ${String(e)}`} />));

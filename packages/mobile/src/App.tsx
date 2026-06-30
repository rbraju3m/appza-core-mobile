import { useEffect, useMemo, useState } from 'react';
import { ScreenRenderer } from '@appza/renderer';
import {
  BootstrapEnvelopeSchema,
  type BootstrapEnvelope,
  type TemplateScreen,
} from '@appza/schemas';

/**
 * @appza/mobile — Capacitor shell that mounts ScreenRenderer against
 * the SAME bootstrap envelope the WP-plugin simulator consumes.
 *
 * Boot sequence:
 *   1. Read site URL from APPZA_SITE_URL (built-in default for dev).
 *   2. GET /wp-json/appza/v1/bootstrap?template=<slug> — same endpoint
 *      and same envelope as the plugin-admin uses.
 *   3. Hand the envelope's catalog + the first screen to <ScreenRenderer>.
 *
 * The `useDataSource` hook the renderer carries hits the host site's
 * /wp-json/appza/v1/preview/data?ds=... proxy on Capacitor too — set
 * window.appzaCoreConfig.endpoints.previewProxy to an absolute URL on
 * the host site so requests don't try to resolve against capacitor:// .
 *
 * Auth: the JWT login screen lives behind an env flag for now (Phase 1B.6
 * landed the /wp-json/appza/auth/v1/* endpoints; this shell calls /me +
 * stores the token in localStorage when APPZA_REQUIRE_AUTH=true; otherwise
 * boots straight into the renderer for guest-mode browsing).
 */

const SITE_URL = (import.meta.env.VITE_APPZA_SITE_URL as string | undefined) ?? 'http://tutor-lms-mobile.local';
const TEMPLATE = (import.meta.env.VITE_APPZA_TEMPLATE as string | undefined) ?? 'fluent-community-default';

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; envelope: BootstrapEnvelope }
  | { kind: 'error'; message: string };

declare global {
  interface Window {
    appzaCoreConfig?: {
      endpoints?: {
        bootstrap?: string;
        customizations?: string;
        previewProxy?: string;
      };
      restNonce?: string;
      defaultTemplate?: string;
    };
  }
}

// Tell the renderer's useDataSource hook to hit the production proxy URL
// instead of a relative `/wp-json/...` (which won't resolve on capacitor://).
window.appzaCoreConfig = {
  endpoints: {
    previewProxy: `${SITE_URL}/wp-json/appza/v1/preview/data`,
  },
};

export function App() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);

  useEffect(() => {
    const url = `${SITE_URL}/wp-json/appza/v1/bootstrap?template=${encodeURIComponent(TEMPLATE)}`;
    fetch(url, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const parsed = BootstrapEnvelopeSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error(
            'Bootstrap schema validation failed: ' +
              parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          );
        }
        const first = parsed.data.catalog.template_screens?.[0];
        setSelectedScreenId(first ? first.id : null);
        setState({ kind: 'ok', envelope: parsed.data });
      })
      .catch((err) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, []);

  const envelope = state.kind === 'ok' ? state.envelope : null;
  const catalog = envelope?.catalog ?? null;

  const screen = useMemo<TemplateScreen | null>(() => {
    if (!catalog || selectedScreenId == null) return null;
    return catalog.template_screens?.find((s) => s.id === selectedScreenId) ?? null;
  }, [catalog, selectedScreenId]);

  if (state.kind === 'loading') {
    return <div className="appza-mobile-loading">Loading…</div>;
  }
  if (state.kind === 'error') {
    return <div className="appza-mobile-error">{state.message}</div>;
  }
  if (!screen || !catalog) {
    return <div className="appza-mobile-error">No screen to render.</div>;
  }

  return (
    <ScreenRenderer
      screen={screen}
      catalog={catalog}
      customizations={envelope?.customizations}
    />
  );
}

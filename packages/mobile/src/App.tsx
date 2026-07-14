import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionProvider,
  ScreenRenderer,
  type ActionDispatch,
  type ActionInvocation,
} from '@appza/renderer';
import {
  BootstrapEnvelopeSchema,
  type BootstrapEnvelope,
  type Catalog,
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

// `Window['appzaCoreConfig']` is augmented globally via the
// `@appza/schemas` import above — no per-file re-declaration needed.

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_screenStack, setScreenStack] = useState<number[]>([]);

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

  const dispatchAction = useCallback<ActionDispatch>(
    (inv: ActionInvocation) => {
      handleAction(inv, {
        catalog,
        setSelectedScreenId,
        setScreenStack,
        currentScreenId: selectedScreenId,
      });
    },
    [catalog, selectedScreenId],
  );

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
    <ActionProvider dispatch={dispatchAction}>
      <ScreenRenderer
        screen={screen}
        catalog={catalog}
        customizations={envelope?.customizations}
      />
    </ActionProvider>
  );
}

type ActionDeps = {
  catalog: Catalog | null;
  setSelectedScreenId: (id: number | null) => void;
  setScreenStack: (fn: (prev: number[]) => number[]) => void;
  currentScreenId: number | null;
};

/**
 * Minimum viable action dispatcher for the mobile shell.
 *
 * - nav.push: switches the selected screen by `args.target_screen_slug`.
 *   The current screen id is pushed onto a stack so nav.back can restore it.
 * - nav.back: pops the stack and restores the previous screen. No-op when
 *   the stack is empty (already at root).
 * - link.open: opens `args.url` (or `item.link`) via window.open. The
 *   `new_tab` field is informational — we always open externally on web.
 * - post.create + other HTTP actions: real submission needs form-state
 *   capture (title / message / space_slug etc.). Logged for visibility
 *   until the form-binding layer lands.
 */
function handleAction(inv: ActionInvocation, deps: ActionDeps) {
  const { catalog, setSelectedScreenId, setScreenStack, currentScreenId } = deps;
  const { action_slug, args, item } = inv;
  const argRec = (args ?? {}) as Record<string, unknown>;

  switch (action_slug) {
    case 'nav.push': {
      const targetSlug = typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : null;
      if (!targetSlug || !catalog) return;
      const target = catalog.template_screens?.find((s) => s.app_map_screen_slug === targetSlug);
      if (!target) {
        console.warn('[appza-mobile] nav.push target not found:', targetSlug);
        return;
      }
      if (currentScreenId != null) {
        setScreenStack((prev) => [...prev, currentScreenId]);
      }
      setSelectedScreenId(target.id);
      return;
    }
    case 'nav.back': {
      setScreenStack((prev) => {
        if (prev.length === 0) return prev;
        const rest = prev.slice(0, -1);
        setSelectedScreenId(prev[prev.length - 1] ?? null);
        return rest;
      });
      return;
    }
    case 'link.open': {
      const url = typeof argRec.url === 'string'
        ? argRec.url
        : (item && typeof (item as Record<string, unknown>).link === 'string'
            ? String((item as Record<string, unknown>).link)
            : null);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    default:
      console.info('[appza-mobile] action dispatched (no-op):', action_slug, argRec);
  }
}

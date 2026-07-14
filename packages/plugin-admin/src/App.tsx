import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BootstrapEnvelopeSchema,
  type BootstrapEnvelope,
  type Catalog,
  type LayoutStyle,
  type PreviewMode,
  type TemplateScreen,
} from '@appza/schemas';
import {
  ActionProvider,
  readDataPath,
  type ActionDispatch,
  type ActionInvocation,
} from '@appza/renderer';

// Re-exported so existing local consumers (e.g. TopBar) keep working
// without churning their import path.
export type { PreviewMode };

/**
 * Preview UI mode.
 * - 'edit' (default): design-time. Clicks select the primitive/AppZet so
 *   the Properties panel can edit it. Actions do nothing.
 * - 'app': runtime. Same behavior as the real Capacitor mobile app —
 *   clicks fire nav.push / nav.back / link.open. Mutating actions
 *   (post.create etc.) log a warning instead of hitting the server so
 *   admins don't accidentally create real feed posts from the sim.
 */
export type UiMode = 'edit' | 'app';

import { TopBar } from './TopBar';
import { Sidebar, type BottomTab, type SidebarTab } from './Sidebar';
import { DeviceFrame, type SelectedPrimitive } from './DeviceFrame';
import { OverridesPanel } from './OverridesPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { PrimitivePanel } from './PrimitivePanel';
import { OnboardingModal } from './OnboardingModal';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; envelope: BootstrapEnvelope }
  | { kind: 'error'; message: string };

const DEFAULT_TEMPLATE = 'fluent-community-default';

type TemplateOption = {
  slug: string;
  name: string;
  source_integration_slug: string;
  source_integration_name: string;
};

/**
 * Build the bootstrap URL with a template= parameter.
 *
 * In WP admin: `endpoints.bootstrap` is a fully-qualified URL localized by
 * the plug-in (pretty `/wp-json/...` or query-form `/?rest_route=/...`
 * depending on permalinks). We use the URL API to append `template=` so
 * either form works correctly.
 *
 * Standalone dev: fall back to /wp-json/.../bootstrap, which the Vite
 * proxy rewrites to the query form against the local WP install.
 */
function buildBootstrapUrl(slug: string): string {
  const base = window.appzaCoreConfig?.endpoints?.bootstrap;
  if (base) {
    const url = new URL(base, window.location.origin);
    url.searchParams.set('template', slug);
    return url.toString();
  }
  return `/wp-json/appza/v1/bootstrap?template=${encodeURIComponent(slug)}`;
}

export function App() {
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [templateSlug, setTemplateSlug] = useState(
    window.appzaCoreConfig?.defaultTemplate ?? DEFAULT_TEMPLATE,
  );
  // Onboarding "Select App" modal. Auto-opens once per session if the
  // site owner hasn't picked any Source Integrations yet.
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  // Template dropdown data — pulled from the plug-in's /templates proxy,
  // which asks the Core for Templates tied to the currently-activated
  // Source Integrations. Refetched after the onboarding modal saves.
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('global');
  const [bottomTab, setBottomTab] = useState<BottomTab>(null);
  const [selectedAppzetSlug, setSelectedAppzetSlug] = useState<string | null>(null);
  const [selectedPrimitive, setSelectedPrimitive] = useState<SelectedPrimitive | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    window.appzaCoreConfig?.previewMode ?? 'auto',
  );
  const [uiMode, setUiMode] = useState<UiMode>('edit');
  // Track a screen-nav stack so nav.back can pop in App mode. Populated
  // when nav.push runs; irrelevant in Edit mode (screens are picked from
  // the top-bar dropdown, no stack).
  const [screenStack, setScreenStack] = useState<number[]>([]);
  // Pending panel edits — mirrored into the customizations blob before
  // it's handed to DeviceFrame so the phone-frame preview reflects the
  // panel state instantly, before Save persists it.
  const [livePreview, setLivePreview] = useState<{
    slug: string;
    override: Record<string, unknown>;
  } | null>(null);
  // Same shape as livePreview but for the DC#20 primitive axis.
  // Overlays under customizations.appzet_primitive[<compositeKey>].layout.
  const [livePrimitivePreview, setLivePrimitivePreview] = useState<{
    compositeKey: string;
    layout: LayoutStyle;
  } | null>(null);

  useEffect(() => {
    pull(templateSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplates = useMemo(
    () => async () => {
      const endpoint = window.appzaCoreConfig?.endpoints?.templates;
      if (!endpoint) return;
      setTemplatesLoading(true);
      try {
        const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const body = await res.json();
        const list: TemplateOption[] = Array.isArray(body?.templates) ? body.templates : [];
        setTemplateOptions(list);
      } catch {
        /* dropdown falls back to whatever slug is already entered */
      } finally {
        setTemplatesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // First-mount check: open the "Select App" wizard if the site owner
  // hasn't activated any Source Integrations yet. Cheap GET; fails
  // silently on any error so the app stays usable.
  useEffect(() => {
    const endpoint = window.appzaCoreConfig?.endpoints?.activeSourceIntegrations;
    const nonce = window.appzaCoreConfig?.restNonce;
    if (!endpoint || !nonce) {
      setOnboardingChecked(true);
      return;
    }
    let cancelled = false;
    fetch(endpoint, {
      headers: { Accept: 'application/json', 'X-WP-Nonce': nonce },
      credentials: 'same-origin',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        const slugs = Array.isArray(body?.slugs) ? body.slugs : [];
        if (slugs.length === 0) setOnboardingOpen(true);
      })
      .catch(() => {
        /* ignore — wizard can still be opened manually */
      })
      .finally(() => {
        if (!cancelled) setOnboardingChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.appzaCoreConfig) window.appzaCoreConfig = {};
    window.appzaCoreConfig.previewMode = previewMode;
  }, [previewMode]);

  async function syncFromCore(slug: string) {
    const endpoint = window.appzaCoreConfig?.endpoints?.syncFromCore;
    const nonce = window.appzaCoreConfig?.restNonce;
    if (!endpoint || !nonce) {
      setSyncMessage('Sync unavailable — open this page inside /wp-admin/.');
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('template', slug);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-WP-Nonce': nonce },
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
      const body = await response.json();
      setSyncMessage(
        `Synced ${body.template_slug} → v${body.catalog_snapshot_version}`,
      );
      await pull(slug);
      // Auto-clear the success toast after 4s.
      window.setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  async function pull(slug: string) {
    setState({ kind: 'loading' });
    try {
      const url = buildBootstrapUrl(slug);
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        setState({ kind: 'error', message: `HTTP ${response.status} from ${url}` });
        return;
      }
      const json = await response.json();
      const parsed = BootstrapEnvelopeSchema.safeParse(json);
      if (!parsed.success) {
        setState({
          kind: 'error',
          message: `Schema validation failed: ${parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        });
        return;
      }
      setState({ kind: 'ok', envelope: parsed.data });
      // Auto-select first screen on successful load.
      const firstScreen = parsed.data.catalog.template_screens?.[0];
      setSelectedScreenId(firstScreen ? firstScreen.id : null);
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const envelope = state.kind === 'ok' ? state.envelope : null;
  const catalog = envelope?.catalog;
  const screens = catalog?.template_screens ?? [];
  const appzets = catalog?.appzets ?? [];
  const superstructures = catalog?.superstructures ?? [];

  const currentScreen = useMemo<TemplateScreen | null>(() => {
    if (!selectedScreenId) return null;
    return screens.find((s) => s.id === selectedScreenId) ?? null;
  }, [selectedScreenId, screens]);

  // Overlay pending panel edits onto the persisted customizations shape
  // ({ scope: { target_key: { column: value } } }). PlacementRenderer
  // reads through resolveOverridableColumn on this blob, so the preview
  // picks up the pending edit without a network round-trip. Two axes
  // overlay independently: appzet-level (Properties/Options) and DC#20
  // primitive-level (Layout editor).
  const effectiveCustomizations = useMemo(() => {
    const base = envelope?.customizations;
    if (!livePreview && !livePrimitivePreview) return base;
    const baseRecord =
      base && typeof base === 'object' && !Array.isArray(base)
        ? (base as Record<string, unknown>)
        : {};
    let out: Record<string, unknown> = { ...baseRecord };
    if (livePreview) {
      const scopeRecord =
        out['appzet'] && typeof out['appzet'] === 'object'
          ? { ...(out['appzet'] as Record<string, unknown>) }
          : {};
      const targetRecord =
        scopeRecord[livePreview.slug] && typeof scopeRecord[livePreview.slug] === 'object'
          ? { ...(scopeRecord[livePreview.slug] as Record<string, unknown>) }
          : {};
      targetRecord['default_props_override'] = livePreview.override;
      scopeRecord[livePreview.slug] = targetRecord;
      out = { ...out, appzet: scopeRecord };
    }
    if (livePrimitivePreview) {
      const scopeRecord =
        out['appzet_primitive'] && typeof out['appzet_primitive'] === 'object'
          ? { ...(out['appzet_primitive'] as Record<string, unknown>) }
          : {};
      const key = livePrimitivePreview.compositeKey;
      const targetRecord =
        scopeRecord[key] && typeof scopeRecord[key] === 'object'
          ? { ...(scopeRecord[key] as Record<string, unknown>) }
          : {};
      targetRecord['layout'] = livePrimitivePreview.layout;
      scopeRecord[key] = targetRecord;
      out = { ...out, appzet_primitive: scopeRecord };
    }
    return out;
  }, [envelope, livePreview, livePrimitivePreview]);

  const dispatchAction = useCallback<ActionDispatch>(
    (inv: ActionInvocation) => {
      handleAppModeAction(inv, {
        catalog: catalog ?? null,
        currentScreenId: selectedScreenId,
        setSelectedScreenId,
        setScreenStack,
      });
    },
    [catalog, selectedScreenId],
  );

  const bottomPanel = useMemo(() => {
    if (!bottomTab || !envelope) return null;
    if (bottomTab === 'settings') {
      return renderSettings(envelope);
    }
    if (bottomTab === 'themes') {
      return renderThemes(catalog?.template?.tokens, currentScreen?.screen_tokens);
    }
    // overrides
    const customizationsEndpoint = window.appzaCoreConfig?.endpoints?.customizations;
    const nonce = window.appzaCoreConfig?.restNonce;
    if (!customizationsEndpoint || !nonce) {
      return (
        <p className="appza-bottom-panel-title">
          Overrides UI requires the WP-admin host. Open this page inside /wp-admin/.
        </p>
      );
    }
    return (
      <OverridesPanel
        listEndpoint={customizationsEndpoint}
        mutateEndpoint={customizationsEndpoint}
        restNonce={nonce}
        onChanged={() => pull(templateSlug)}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomTab, envelope, catalog, currentScreen, templateSlug]);

  return (
    <div className="appza-shell">
      <TopBar
        screens={screens}
        appMap={catalog?.app_map ?? null}
        selectedScreenId={selectedScreenId}
        onSelectScreen={setSelectedScreenId}
        templateSlug={templateSlug}
        onTemplateSlugChange={(slug) => {
          setTemplateSlug(slug);
          // Re-pull so the screen dropdown + Sidebar appzets reflect the
          // new template's snapshot immediately.
          pull(slug);
        }}
        templateOptions={templateOptions}
        templatesLoading={templatesLoading}
        onReload={() => pull(templateSlug)}
        onSync={() => syncFromCore(templateSlug)}
        onRefreshData={() => {
          window.dispatchEvent(new Event('appza:refresh-data'));
        }}
        loading={state.kind === 'loading'}
        syncing={syncing}
        syncMessage={syncMessage}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        uiMode={uiMode}
        onUiModeChange={(m) => {
          setUiMode(m);
          // Clear any active selection when leaving Edit so residual
          // property/primitive panels don't shadow the App-mode preview.
          if (m === 'app') {
            setSelectedAppzetSlug(null);
            setSelectedPrimitive(null);
            setLivePreview(null);
            setLivePrimitivePreview(null);
          } else {
            // Leaving App mode — reset nav stack so re-entering doesn't
            // pop back into a screen the user has since navigated away from.
            setScreenStack([]);
          }
        }}
      />

      {state.kind === 'error' && <div className="appza-status">{state.message}</div>}

      <div className="appza-body">
        <Sidebar
          sidebarTab={sidebarTab}
          onSelectTab={setSidebarTab}
          appzets={appzets}
          superstructures={superstructures}
          currentScreen={currentScreen}
          bottomTab={bottomTab}
          onSelectBottomTab={setBottomTab}
          bottomPanel={bottomPanel}
        />

        <main
          className={`appza-center${uiMode === 'app' ? ' appza-center-app-mode' : ''}`}
          onClick={
            uiMode === 'edit'
              ? () => {
                  setSelectedAppzetSlug(null);
                  setSelectedPrimitive(null);
                }
              : undefined
          }
        >
          {state.kind === 'loading' ? (
            <div className="appza-loading">Loading…</div>
          ) : uiMode === 'app' ? (
            // App mode — same renderer, but click intercepts are OFF so
            // the AppZet's on_click_action wiring reaches the ActionProvider.
            <ActionProvider dispatch={dispatchAction}>
              <DeviceFrame
                key={`preview-${previewMode}-app`}
                screen={currentScreen}
                catalog={catalog ?? null}
                customizations={effectiveCustomizations}
                templateName={catalog?.template?.name}
              />
            </ActionProvider>
          ) : (
            <DeviceFrame
              key={`preview-${previewMode}-edit`}
              screen={currentScreen}
              catalog={catalog ?? null}
              customizations={effectiveCustomizations}
              templateName={catalog?.template?.name}
              selectedAppzetSlug={selectedAppzetSlug}
              onSelectAppzet={(slug) => {
                setSelectedAppzetSlug(slug);
                if (slug) setSelectedPrimitive(null);
              }}
              selectedPrimitive={selectedPrimitive}
              onSelectPrimitive={(sel) => {
                setSelectedPrimitive(sel);
                if (sel) setSelectedAppzetSlug(null);
              }}
            />
          )}
        </main>

        {selectedPrimitive && (() => {
          const compositeKey = `${selectedPrimitive.appzetSlug}#${selectedPrimitive.primitivePath}`;
          const initialLayout = readInitialLayout(envelope?.customizations, compositeKey);
          const customizationsEndpoint = window.appzaCoreConfig?.endpoints?.customizations;
          const nonce = window.appzaCoreConfig?.restNonce;
          if (!customizationsEndpoint || !nonce) return null;
          return (
            <PrimitivePanel
              selection={selectedPrimitive}
              initialLayout={initialLayout}
              customizationsEndpoint={customizationsEndpoint}
              restNonce={nonce}
              onClose={() => {
                setLivePrimitivePreview(null);
                setSelectedPrimitive(null);
              }}
              onLivePreview={(layout) => {
                setLivePrimitivePreview(
                  layout ? { compositeKey, layout } : null,
                );
              }}
              onChanged={() => {
                setLivePrimitivePreview(null);
                pull(templateSlug);
              }}
            />
          );
        })()}

        {!selectedPrimitive &&
          selectedAppzetSlug &&
          (() => {
            const selected = appzets.find((a) => a.slug === selectedAppzetSlug);
            const customizationsEndpoint = window.appzaCoreConfig?.endpoints?.customizations;
            const nonce = window.appzaCoreConfig?.restNonce;
            if (!selected || !customizationsEndpoint || !nonce) return null;
            const superstructure =
              selected.superstructure_id != null
                ? superstructures.find((s) => s.id === selected.superstructure_id) ?? null
                : null;
            return (
              <PropertiesPanel
                appzet={selected}
                superstructure={superstructure}
                customizations={envelope?.customizations}
                customizationsEndpoint={customizationsEndpoint}
                restNonce={nonce}
                onClose={() => {
                  setLivePreview(null);
                  setSelectedAppzetSlug(null);
                }}
                onChanged={() => {
                  setLivePreview(null);
                  pull(templateSlug);
                }}
                onLivePreview={(override) => {
                  setLivePreview(override ? { slug: selected.slug, override } : null);
                }}
              />
            );
          })()}
      </div>

      {/* Small pill in the corner to reopen the "Select App" wizard.
          Hidden until the first-mount check has run so it doesn't flash
          before we know whether to auto-open. */}
      {onboardingChecked && (
        <button
          type="button"
          className="appza-onboard-reopen"
          onClick={() => setOnboardingOpen(true)}
          title="Select App"
        >
          Apps
        </button>
      )}

      {onboardingOpen && (
        <OnboardingModal
          onClose={() => setOnboardingOpen(false)}
          onSaved={() => {
            // Activation set changed → refresh the Template dropdown and
            // re-pull the bootstrap so any Source-scoped catalog updates
            // are reflected.
            loadTemplates();
            pull(templateSlug);
          }}
        />
      )}
    </div>
  );
}

function renderSettings(envelope: BootstrapEnvelope) {
  const cfg = envelope.runtime_config as Record<string, unknown>;
  const rows: Array<[string, string]> = [
    ['schema_version', envelope.schema_version],
    ['catalog_snapshot_version', String(envelope.catalog_snapshot_version)],
    ['customizations_version', String(envelope.customizations_version)],
    ...Object.entries(cfg).map(([k, v]) => [k, formatValue(v)] as [string, string]),
  ];
  return (
    <>
      <p className="appza-bottom-panel-title">Settings</p>
      {rows.map(([k, v]) => (
        <div className="appza-bottom-panel-row" key={k}>
          <span className="appza-bottom-panel-key">{k}</span>
          <span className="appza-bottom-panel-value">{v}</span>
        </div>
      ))}
    </>
  );
}

function renderThemes(templateTokens: unknown, screenTokens: unknown) {
  const tpl = isRecord(templateTokens) ? templateTokens : {};
  const scr = isRecord(screenTokens) ? screenTokens : {};
  return (
    <>
      <p className="appza-bottom-panel-title">Themes</p>
      <div className="appza-bottom-panel-row">
        <span className="appza-bottom-panel-key">template.tokens</span>
        <span className="appza-bottom-panel-value">{summarize(tpl)}</span>
      </div>
      <div className="appza-bottom-panel-row">
        <span className="appza-bottom-panel-key">screen_tokens</span>
        <span className="appza-bottom-panel-value">{summarize(scr)}</span>
      </div>
    </>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readInitialLayout(customizations: unknown, compositeKey: string): LayoutStyle {
  if (!isRecord(customizations)) return {};
  const scope = customizations['appzet_primitive'];
  if (!isRecord(scope)) return {};
  const target = scope[compositeKey];
  if (!isRecord(target)) return {};
  const layout = target['layout'];
  return isRecord(layout) ? (layout as LayoutStyle) : {};
}

function summarize(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '(empty)';
  return keys.join(', ');
}

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

type AppModeActionDeps = {
  catalog: Catalog | null;
  currentScreenId: number | null;
  setSelectedScreenId: (id: number | null) => void;
  setScreenStack: (fn: (prev: number[]) => number[]) => void;
};

/**
 * App-mode action executor for the plug-in admin sim. Same nav semantics
 * as the Capacitor shell so what admins see matches what customers get:
 *   - nav.push : switch selected screen by args.target_screen_slug,
 *     stash current on a back stack.
 *   - nav.back : pop.
 *   - link.open : window.open new tab.
 *   - post.create + other mutating actions : LOG ONLY. Deliberate — an
 *     admin previewing the composer shouldn't create real feed posts.
 *     Real submission stays confined to the Capacitor build; when
 *     form-state capture ships, we'll add a `dry_run=1` proxy flag so
 *     App mode can safely round-trip through the server too.
 */
function handleAppModeAction(inv: ActionInvocation, deps: AppModeActionDeps) {
  const { catalog, currentScreenId, setSelectedScreenId, setScreenStack } = deps;
  const { action_slug, args, item, binding_root } = inv;
  const argRec = (args ?? {}) as Record<string, unknown>;
  // Per-invocation item root. `binding_root` on the AppZet action wiring
  // sub-selects a slice of the item — e.g. `data.ctaButtons[0]` picks the
  // first CTA object so link.open resolves url/newTab against THAT rather
  // than the whole banner payload.
  const effectiveItem = binding_root ? readDataPath(item, binding_root) ?? item : item;
  const itemRec = isRecord(effectiveItem) ? (effectiveItem as Record<string, unknown>) : null;

  switch (action_slug) {
    case 'nav.push': {
      const targetSlug =
        typeof argRec.target_screen_slug === 'string' ? argRec.target_screen_slug : null;
      if (!targetSlug || !catalog) return;
      const target = catalog.template_screens?.find(
        (s) => s.app_map_screen_slug === targetSlug,
      );
      if (!target) {
        console.warn('[appza-admin/app-mode] nav.push target not found:', targetSlug);
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
      // Accept the action's canonical `url`/`new_tab` names AND the
      // fcom-mobile API's `link`/`newTab` names so binding_root against a
      // raw ctaButtons entry Just Works without a rename in the proxy.
      const url =
        pickString(argRec, ['url', 'link']) ??
        pickString(itemRec, ['url', 'link']);
      if (!url) {
        console.warn('[appza-admin/app-mode] link.open: no url resolved from', {
          args: argRec,
          item: effectiveItem,
        });
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    default:
      // Mutating actions (post.create, cart.add, profile.save, etc.) are
      // intentionally not executed in the admin sim — see the docblock
      // above for why. Logged so the admin can confirm the wiring fired.
      console.info(
        '[appza-admin/app-mode] action fired (not executed in sim):',
        action_slug,
        argRec,
        { effectiveItem },
      );
  }
}

function pickString(
  rec: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!rec) return null;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

import { useEffect, useMemo, useState } from 'react';
import {
  BootstrapEnvelopeSchema,
  type BootstrapEnvelope,
  type TemplateScreen,
} from '@appza/schemas';

import { TopBar } from './TopBar';
import { Sidebar, type BottomTab, type SidebarTab } from './Sidebar';
import { DeviceFrame } from './DeviceFrame';
import { OverridesPanel } from './OverridesPanel';
import { PropertiesPanel } from './PropertiesPanel';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; envelope: BootstrapEnvelope }
  | { kind: 'error'; message: string };

const DEFAULT_TEMPLATE = 'fluent-community-default';

declare global {
  interface Window {
    appzaCoreConfig?: {
      endpoints?: {
        bootstrap?: string;
        customizations?: string;
        previewProxy?: string;
        syncFromCore?: string;
      };
      restNonce?: string;
      defaultTemplate?: string;
      assetsBase?: string;
    };
  }
}

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
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('global');
  const [bottomTab, setBottomTab] = useState<BottomTab>(null);
  const [selectedAppzetSlug, setSelectedAppzetSlug] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  // Pending panel edits — mirrored into the customizations blob before
  // it's handed to DeviceFrame so the phone-frame preview reflects the
  // panel state instantly, before Save persists it.
  const [livePreview, setLivePreview] = useState<{
    slug: string;
    override: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    pull(templateSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Overlay the pending panel edit onto the persisted customizations
  // shape ({ scope: { target_key: { column: value } } }). PlacementRenderer
  // reads through resolveOverridableColumn on this blob, so the preview
  // picks up the pending edit without a network round-trip.
  const effectiveCustomizations = useMemo(() => {
    const base = envelope?.customizations;
    if (!livePreview) return base;
    const baseRecord =
      base && typeof base === 'object' && !Array.isArray(base)
        ? (base as Record<string, unknown>)
        : {};
    const scopeRecord =
      baseRecord['appzet'] && typeof baseRecord['appzet'] === 'object'
        ? { ...(baseRecord['appzet'] as Record<string, unknown>) }
        : {};
    const targetRecord =
      scopeRecord[livePreview.slug] && typeof scopeRecord[livePreview.slug] === 'object'
        ? { ...(scopeRecord[livePreview.slug] as Record<string, unknown>) }
        : {};
    targetRecord['default_props_override'] = livePreview.override;
    scopeRecord[livePreview.slug] = targetRecord;
    return { ...baseRecord, appzet: scopeRecord };
  }, [envelope, livePreview]);

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
        onTemplateSlugChange={setTemplateSlug}
        onReload={() => pull(templateSlug)}
        onSync={() => syncFromCore(templateSlug)}
        loading={state.kind === 'loading'}
        syncing={syncing}
        syncMessage={syncMessage}
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

        <main className="appza-center" onClick={() => setSelectedAppzetSlug(null)}>
          {state.kind === 'loading' ? (
            <div className="appza-loading">Loading…</div>
          ) : (
            <DeviceFrame
              screen={currentScreen}
              catalog={catalog ?? null}
              customizations={effectiveCustomizations}
              templateName={catalog?.template?.name}
              selectedAppzetSlug={selectedAppzetSlug}
              onSelectAppzet={setSelectedAppzetSlug}
            />
          )}
        </main>

        {selectedAppzetSlug &&
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

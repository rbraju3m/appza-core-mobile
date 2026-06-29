import { useEffect, useState } from 'react';
import {
  BootstrapEnvelopeSchema,
  type BootstrapEnvelope,
} from '@appza/schemas';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; envelope: BootstrapEnvelope }
  | { kind: 'error'; message: string };

const DEFAULT_TEMPLATE = 'fluent-community-default';

export function App() {
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [templateSlug, setTemplateSlug] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    pull(templateSlug);
  }, []);

  async function pull(slug: string) {
    setState({ kind: 'loading' });
    try {
      const url = `/wp-json/appza/v1/bootstrap?template=${encodeURIComponent(slug)}`;
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
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '24px', maxWidth: 920 }}>
      <h1 style={{ margin: 0 }}>APPZA — Plug-in Admin (simulator)</h1>
      <p style={{ color: '#666', marginTop: 4 }}>
        Phase 1C.1 — end-to-end wiring. Fetches the bootstrap envelope from the
        WP plug-in, validates with <code>@appza/schemas</code>, displays
        parsed result.
      </p>

      <section style={{ marginTop: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label htmlFor="slug">Template slug:</label>
        <input
          id="slug"
          value={templateSlug}
          onChange={(e) => setTemplateSlug(e.target.value)}
          style={{ padding: '6px 10px', fontFamily: 'monospace' }}
        />
        <button onClick={() => pull(templateSlug)} style={{ padding: '6px 14px' }}>
          Pull
        </button>
      </section>

      <section style={{ marginTop: 24 }}>{renderState(state)}</section>
    </main>
  );
}

function renderState(state: FetchState) {
  if (state.kind === 'idle') return <p>Idle.</p>;
  if (state.kind === 'loading') return <p>Loading…</p>;
  if (state.kind === 'error') {
    return (
      <div style={{ background: '#fee', padding: 16, borderRadius: 4 }}>
        <strong>Error:</strong> {state.message}
      </div>
    );
  }
  const { envelope } = state;
  return (
    <div>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <Row label="schema_version" value={envelope.schema_version} />
          <Row label="catalog_snapshot_version" value={String(envelope.catalog_snapshot_version)} />
          <Row label="customizations_version" value={String(envelope.customizations_version)} />
          <Row label="catalog keys" value={Object.keys(envelope.catalog).join(', ') || '(empty)'} />
          <Row label="runtime_config keys" value={Object.keys(envelope.runtime_config).join(', ') || '(empty)'} />
        </tbody>
      </table>
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer' }}>Raw envelope</summary>
        <pre style={{ background: '#f4f4f4', padding: 12, overflow: 'auto', maxHeight: 480 }}>
          {JSON.stringify(envelope, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: '4px 12px 4px 0', color: '#666', verticalAlign: 'top' }}>{label}</td>
      <td style={{ padding: '4px 0', fontFamily: 'monospace' }}>{value}</td>
    </tr>
  );
}

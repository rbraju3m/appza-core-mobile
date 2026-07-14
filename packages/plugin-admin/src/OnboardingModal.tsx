import { useEffect, useState } from 'react';

/**
 * "Select App" onboarding step — the plug-in equivalent of the legacy
 * appza-builder wizard shown at wp-admin/admin.php?page=appza-builder.
 *
 * Auto-opens on first mount when the site owner hasn't picked any Source
 * Integrations yet. Reads the merged list from the plug-in's REST proxy
 * (`endpoints.sourceIntegrations`) — which itself pulls from the Core
 * catalog and stamps each row with `is_installed` based on whether the
 * matching APPZA add-on plug-in is active locally.
 *
 * "Save" writes the picked slugs to WP option
 * `appza_core_active_source_integrations` via the CREATABLE endpoint.
 * "Skip" closes without persisting — user can reopen from the sidebar.
 */

type SourceIntegration = {
  slug: string;
  name: string;
  addon_plugin_slug: string;
  addon_min_version: string;
  description: string;
  image_url: string | null;
  is_installed: boolean;
  is_disable: boolean;
};

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; rows: SourceIntegration[] };

type Props = {
  onClose: () => void;
  onSaved?: (slugs: string[]) => void;
};

export function OnboardingModal({ onClose, onSaved }: Props) {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sourceEndpoint = window.appzaCoreConfig?.endpoints?.sourceIntegrations;
  const activeEndpoint = window.appzaCoreConfig?.endpoints?.activeSourceIntegrations;
  const nonce = window.appzaCoreConfig?.restNonce;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sourceEndpoint || !activeEndpoint || !nonce) {
        setState({
          kind: 'error',
          message: 'Wizard requires the WP-admin host — open the APPZA Core admin page.',
        });
        return;
      }
      try {
        const [listRes, activeRes] = await Promise.all([
          fetch(sourceEndpoint, { headers: { Accept: 'application/json' } }),
          fetch(activeEndpoint, {
            headers: { Accept: 'application/json', 'X-WP-Nonce': nonce },
            credentials: 'same-origin',
          }),
        ]);
        if (!listRes.ok) throw new Error(`HTTP ${listRes.status} from source-integrations`);
        if (!activeRes.ok) throw new Error(`HTTP ${activeRes.status} from active-source-integrations`);
        const listBody = await listRes.json();
        const activeBody = await activeRes.json();
        if (cancelled) return;

        const rows: SourceIntegration[] = Array.isArray(listBody?.source_integrations)
          ? listBody.source_integrations
          : [];
        const activeSlugs: string[] = Array.isArray(activeBody?.slugs) ? activeBody.slugs : [];
        setSelected(new Set(activeSlugs));
        setState({ kind: 'ok', rows });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sourceEndpoint, activeEndpoint, nonce]);

  function toggle(slug: string, disabled: boolean) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function save() {
    if (!activeEndpoint || !nonce) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(activeEndpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        credentials: 'same-origin',
        body: JSON.stringify({ slugs: Array.from(selected) }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const body = await res.json();
      const persisted: string[] = Array.isArray(body?.slugs) ? body.slugs : [];
      onSaved?.(persisted);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="appza-onboard-overlay" role="dialog" aria-modal="true" aria-label="Select App">
      <div className="appza-onboard-card">
        <div className="appza-onboard-header">
          <h2 className="appza-onboard-title">Select App</h2>
          <p className="appza-onboard-subtitle">
            Choose the platforms you want to build apps for. You can change this any time.
          </p>
        </div>

        <div className="appza-onboard-body">
          {state.kind === 'loading' && <div className="appza-onboard-status">Loading integrations…</div>}
          {state.kind === 'error' && <div className="appza-onboard-status appza-onboard-error">{state.message}</div>}
          {state.kind === 'ok' && state.rows.length === 0 && (
            <div className="appza-onboard-status">No Source Integrations returned by the Core.</div>
          )}
          {state.kind === 'ok' && state.rows.length > 0 && (
            <ul className="appza-onboard-list">
              {state.rows.map((row) => {
                const isSelected = selected.has(row.slug);
                const disabled = row.is_disable;
                return (
                  <li
                    key={row.slug}
                    className={`appza-onboard-row${disabled ? ' is-disabled' : ''}${isSelected ? ' is-selected' : ''}`}
                    onClick={() => toggle(row.slug, disabled)}
                  >
                    <label className="appza-onboard-row-label">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => toggle(row.slug, disabled)}
                      />
                      {row.image_url ? (
                        <img
                          className="appza-onboard-row-icon"
                          src={row.image_url}
                          alt=""
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="appza-onboard-row-icon appza-onboard-row-icon-fallback">
                          {row.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="appza-onboard-row-text">
                        <span className="appza-onboard-row-name">{row.name}</span>
                        <span className="appza-onboard-row-slug">{row.addon_plugin_slug}</span>
                      </div>
                      {disabled && (
                        <span className="appza-onboard-row-hint">
                          Install {row.addon_plugin_slug} first
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {saveError && <div className="appza-onboard-status appza-onboard-error">{saveError}</div>}

        <div className="appza-onboard-footer">
          <button type="button" className="appza-onboard-btn appza-onboard-btn-ghost" onClick={onClose}>
            Skip
          </button>
          <button
            type="button"
            className="appza-onboard-btn appza-onboard-btn-primary"
            onClick={save}
            disabled={saving || state.kind !== 'ok'}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

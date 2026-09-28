import { useEffect, useMemo, useState } from 'react';

type SourceIntegration = {
  slug: string;
  name: string;
  addon_plugin_slug: string;
  image_url: string | null;
};

type TemplateOption = {
  slug: string;
  name: string;
  source_integration_slug: string;
  source_integration_name: string;
};

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; active: SourceIntegration[] };

type BaseUrlMode = 'current' | 'custom';

type BuildResult = {
  id: number | string;
  cli_command: string;
  resolved_base_url: string;
  requested_at: string;
};

export type BuildRequest = {
  sourceIntegrationSlug: string;
  templateSlug: string;
  baseUrl: string;
  baseUrlMode: BaseUrlMode;
};

type Props = {
  onClose: () => void;
  templateOptions: TemplateOption[];
  defaultTemplateSlug: string;
};

export function BuildAppModal({ onClose, templateOptions, defaultTemplateSlug }: Props) {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [baseUrlMode, setBaseUrlMode] = useState<BaseUrlMode>('current');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [copied, setCopied] = useState(false);

  const sourceEndpoint = window.appzaCoreConfig?.endpoints?.sourceIntegrations;
  const activeEndpoint = window.appzaCoreConfig?.endpoints?.activeSourceIntegrations;
  const buildEndpoint = window.appzaCoreConfig?.endpoints?.buildRequests;
  const nonce = window.appzaCoreConfig?.restNonce;
  const currentSiteUrl = window.appzaCoreConfig?.siteUrl ?? window.location.origin;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sourceEndpoint || !activeEndpoint || !nonce) {
        setState({
          kind: 'error',
          message: 'Build requires the WP-admin host — open the APPZA Core admin page.',
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
        const activeSet = new Set(activeSlugs);
        const active = rows.filter((r) => activeSet.has(r.slug));

        setState({ kind: 'ok', active });
        if (active.length === 1 && active[0]) setSelectedSlug(active[0].slug);
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

  const templatesForSi = useMemo(
    () => templateOptions.filter((t) => t.source_integration_slug === selectedSlug),
    [templateOptions, selectedSlug],
  );

  useEffect(() => {
    if (!selectedSlug) {
      setSelectedTemplate('');
      return;
    }
    const currentMatches = templatesForSi.some((t) => t.slug === defaultTemplateSlug);
    if (currentMatches) {
      setSelectedTemplate(defaultTemplateSlug);
    } else if (templatesForSi[0]) {
      setSelectedTemplate(templatesForSi[0].slug);
    } else {
      setSelectedTemplate('');
    }
  }, [selectedSlug, templatesForSi, defaultTemplateSlug]);

  const resolvedBaseUrl = baseUrlMode === 'current' ? currentSiteUrl : customUrl.trim();

  const canBuild = useMemo(() => {
    if (state.kind !== 'ok' || state.active.length === 0) return false;
    if (!selectedSlug) return false;
    if (!selectedTemplate) return false;
    if (!resolvedBaseUrl) return false;
    if (baseUrlMode === 'custom') {
      try {
        new URL(resolvedBaseUrl);
      } catch {
        return false;
      }
    }
    return true;
  }, [state, selectedSlug, selectedTemplate, resolvedBaseUrl, baseUrlMode]);

  async function submit() {
    if (!canBuild || submitting) return;
    if (!buildEndpoint || !nonce) {
      setSubmitError('Build endpoint not available — plug-in may need reactivation.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = {
        source_integration_slug: selectedSlug,
        template_slug: selectedTemplate,
        base_url_mode: baseUrlMode,
        custom_base_url: baseUrlMode === 'custom' ? customUrl.trim() : null,
      };
      const res = await fetch(buildEndpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      const persisted = (await res.json()) as BuildResult;
      setResult(persisted);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCommand() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.cli_command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop — clipboard perms not granted */
    }
  }

  if (result) {
    return (
      <div className="appza-onboard-overlay" role="dialog" aria-modal="true" aria-label="Build queued">
        <div className="appza-onboard-card">
          <div className="appza-onboard-header">
            <h2 className="appza-onboard-title">Build queued — request #{result.id}</h2>
            <p className="appza-onboard-subtitle">
              Your request is logged. To produce the actual bundle on this dev server, run the command
              below in a terminal as <code>rbs-02</code> (it needs the NVM node/pnpm on PATH — the WP
              process can't shell out to those directly).
            </p>
          </div>
          <div className="appza-onboard-body">
            <div className="appza-build-section">
              <div className="appza-build-section-label">Base URL baked into the bundle</div>
              <input className="appza-build-input" value={result.resolved_base_url} readOnly />
            </div>
            <div className="appza-build-section">
              <div className="appza-build-section-label">Build command</div>
              <textarea
                className="appza-build-cmd"
                value={result.cli_command}
                readOnly
                rows={3}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="appza-onboard-btn appza-onboard-btn-ghost appza-build-copy-btn"
                onClick={copyCommand}
              >
                {copied ? 'Copied ✓' : 'Copy command'}
              </button>
            </div>
          </div>
          <div className="appza-onboard-footer">
            <button type="button" className="appza-onboard-btn appza-onboard-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="appza-onboard-overlay" role="dialog" aria-modal="true" aria-label="Build App">
      <div className="appza-onboard-card">
        <div className="appza-onboard-header">
          <h2 className="appza-onboard-title">Build App</h2>
          <p className="appza-onboard-subtitle">
            Pick which activated app + template to build, and the base URL the built app should call for
            real data.
          </p>
        </div>

        <div className="appza-onboard-body">
          {state.kind === 'loading' && <div className="appza-onboard-status">Loading apps…</div>}
          {state.kind === 'error' && (
            <div className="appza-onboard-status appza-onboard-error">{state.message}</div>
          )}
          {state.kind === 'ok' && state.active.length === 0 && (
            <div className="appza-onboard-status">
              No apps activated yet. Open <strong>Select App</strong> from the Apps pill, activate at
              least one, then come back.
            </div>
          )}
          {state.kind === 'ok' && state.active.length > 0 && (
            <>
              <div className="appza-build-section">
                <div className="appza-build-section-label">
                  Which app to build
                  {state.active.length === 1 && (
                    <span className="appza-build-section-hint"> (only one activated — auto-selected)</span>
                  )}
                </div>
                <ul className="appza-onboard-list">
                  {state.active.map((row) => {
                    const isSelected = selectedSlug === row.slug;
                    return (
                      <li
                        key={row.slug}
                        className={`appza-onboard-row${isSelected ? ' is-selected' : ''}`}
                        onClick={() => setSelectedSlug(row.slug)}
                      >
                        <label className="appza-onboard-row-label">
                          <input
                            type="radio"
                            name="appza-build-slug"
                            checked={isSelected}
                            onChange={() => setSelectedSlug(row.slug)}
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
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selectedSlug && (
                <div className="appza-build-section">
                  <div className="appza-build-section-label">Template</div>
                  {templatesForSi.length === 0 ? (
                    <div className="appza-onboard-status">
                      No templates yet for this app. Sync from Core first.
                    </div>
                  ) : (
                    <select
                      className="appza-build-input"
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                    >
                      {templatesForSi.map((t) => (
                        <option key={t.slug} value={t.slug}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="appza-build-section">
                <div className="appza-build-section-label">Base URL for real data</div>
                <label className="appza-build-radio">
                  <input
                    type="radio"
                    name="appza-build-base-url-mode"
                    checked={baseUrlMode === 'current'}
                    onChange={() => setBaseUrlMode('current')}
                  />
                  <span>Current site URL</span>
                </label>
                <input
                  type="text"
                  className="appza-build-input"
                  value={currentSiteUrl}
                  readOnly
                  onFocus={() => setBaseUrlMode('current')}
                />
                <label className="appza-build-radio">
                  <input
                    type="radio"
                    name="appza-build-base-url-mode"
                    checked={baseUrlMode === 'custom'}
                    onChange={() => setBaseUrlMode('custom')}
                  />
                  <span>Custom URL</span>
                </label>
                <input
                  type="url"
                  className="appza-build-input"
                  placeholder="https://example.com"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  onFocus={() => setBaseUrlMode('custom')}
                />
              </div>
            </>
          )}
        </div>

        {submitError && (
          <div className="appza-onboard-status appza-onboard-error">{submitError}</div>
        )}

        <div className="appza-onboard-footer">
          <button type="button" className="appza-onboard-btn appza-onboard-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="appza-onboard-btn appza-onboard-btn-primary"
            onClick={submit}
            disabled={!canBuild || submitting}
          >
            {submitting ? 'Queuing…' : 'Build'}
          </button>
        </div>
      </div>
    </div>
  );
}

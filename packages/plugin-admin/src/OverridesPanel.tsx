import { useEffect, useState } from 'react';

const SCOPES = [
  'appzet',
  'template',
  'template_screen',
  'template_screen_placement',
  'data_source',
  'action',
  'global',
] as const;

type Scope = (typeof SCOPES)[number];

export type OverrideRow = {
  id: number;
  scope: Scope;
  target_slug: string | null;
  target_slug_composite: string | null;
  target_column: string;
  override_value: unknown;
  version: number;
  updated_at: string;
};

type Props = {
  listEndpoint: string;
  mutateEndpoint: string;
  restNonce: string;
  onChanged: () => void;
};

export function OverridesPanel({ listEndpoint, mutateEndpoint, restNonce, onChanged }: Props) {
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(listEndpoint, {
        headers: { Accept: 'application/json', 'X-WP-Nonce': restNonce },
        credentials: 'same-origin',
      });
      if (!response.ok) {
        setError(`HTTP ${response.status}`);
        return;
      }
      const json = (await response.json()) as OverrideRow[];
      setRows(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listEndpoint]);

  async function handleDelete(id: number) {
    setError(null);
    try {
      const response = await fetch(`${mutateEndpoint}/${id}`, {
        method: 'DELETE',
        headers: { 'X-WP-Nonce': restNonce },
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const txt = await response.text();
        setError(`Delete failed: ${response.status} ${txt.slice(0, 120)}`);
        return;
      }
      await refetch();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCreate(payload: CreatePayload) {
    setError(null);
    try {
      const response = await fetch(mutateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-WP-Nonce': restNonce,
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const txt = await response.text();
        setError(`Save failed: ${response.status} ${txt.slice(0, 200)}`);
        return false;
      }
      setFormOpen(false);
      await refetch();
      onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  return (
    <div className="appza-overrides">
      <div className="appza-overrides-header">
        <p className="appza-bottom-panel-title">Overrides ({rows.length})</p>
        <button
          className="appza-btn"
          onClick={() => setFormOpen((v) => !v)}
        >
          {formOpen ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {error && <div className="appza-overrides-error">{error}</div>}

      {formOpen && <CreateForm onSubmit={handleCreate} />}

      {loading && rows.length === 0 ? (
        <div className="appza-overrides-empty">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="appza-overrides-empty">No overrides yet.</div>
      ) : (
        <ul className="appza-overrides-list">
          {rows.map((row) => (
            <li key={row.id} className="appza-overrides-row">
              <div className="appza-overrides-row-meta">
                <span className="appza-overrides-row-scope">{row.scope}</span>
                {row.target_slug && (
                  <span className="appza-overrides-row-target">{row.target_slug}</span>
                )}
                <span className="appza-overrides-row-column">.{row.target_column}</span>
              </div>
              <code className="appza-overrides-row-value">
                {formatValue(row.override_value)}
              </code>
              <button
                className="appza-overrides-row-delete"
                onClick={() => handleDelete(row.id)}
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type CreatePayload = {
  scope: Scope;
  target_slug?: string;
  target_slug_composite?: string;
  target_column: string;
  override_value: unknown;
};

function CreateForm({ onSubmit }: { onSubmit: (p: CreatePayload) => Promise<boolean> }) {
  const [scope, setScope] = useState<Scope>('template');
  const [targetSlug, setTargetSlug] = useState('');
  const [targetSlugComposite, setTargetSlugComposite] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [valueRaw, setValueRaw] = useState('{}');
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setParseError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(valueRaw);
    } catch (err) {
      setParseError(
        `override_value isn't valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    setSubmitting(true);
    const payload: CreatePayload = {
      scope,
      target_column: targetColumn,
      override_value: parsed,
    };
    if (scope !== 'global' && targetSlug) payload.target_slug = targetSlug;
    if (targetSlugComposite) payload.target_slug_composite = targetSlugComposite;

    const ok = await onSubmit(payload);
    setSubmitting(false);
    if (ok) {
      setTargetSlug('');
      setTargetSlugComposite('');
      setTargetColumn('');
      setValueRaw('{}');
    }
  }

  return (
    <form className="appza-overrides-form" onSubmit={submit}>
      <label className="appza-overrides-field">
        <span>Scope</span>
        <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {scope !== 'global' && (
        <label className="appza-overrides-field">
          <span>Target slug</span>
          <input
            value={targetSlug}
            onChange={(e) => setTargetSlug(e.target.value)}
            placeholder={scope === 'template' ? 'fluent-community-default' : 'fc-chat-input'}
          />
        </label>
      )}

      {scope === 'template_screen_placement' && (
        <label className="appza-overrides-field">
          <span>Composite key</span>
          <input
            value={targetSlugComposite}
            onChange={(e) => setTargetSlugComposite(e.target.value)}
            placeholder="template:screen:slot"
          />
        </label>
      )}

      <label className="appza-overrides-field">
        <span>Column</span>
        <input
          value={targetColumn}
          onChange={(e) => setTargetColumn(e.target.value)}
          placeholder={columnHint(scope)}
          required
        />
      </label>

      <label className="appza-overrides-field appza-overrides-field-value">
        <span>Override value (JSON)</span>
        <textarea
          value={valueRaw}
          onChange={(e) => setValueRaw(e.target.value)}
          rows={4}
          spellCheck={false}
        />
      </label>

      {parseError && <div className="appza-overrides-error">{parseError}</div>}

      <button
        type="submit"
        className="appza-btn appza-btn-primary"
        disabled={submitting || !targetColumn}
      >
        {submitting ? 'Saving…' : 'Save override'}
      </button>
    </form>
  );
}

function columnHint(scope: Scope): string {
  switch (scope) {
    case 'appzet':
      return 'default_props_override | actions | field_mappings';
    case 'template':
      return 'tokens';
    case 'template_screen':
      return 'screen_tokens';
    case 'template_screen_placement':
      return 'tokens_override | props_override';
    case 'data_source':
      return 'query_params | cache_ttl';
    case 'action':
      return 'param_schema';
    case 'global':
      return 'feature_flags';
  }
}

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

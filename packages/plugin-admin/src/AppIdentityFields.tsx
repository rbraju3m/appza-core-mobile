import { useState } from 'react';
import { caughtProblem } from './errors';
import { ICON_SIZE, NAME_MAX, SPLASH_MAX, SPLASH_MIN, checkPicked, identityProblems, pickPng, type AppIdentity } from './appIdentity';

/**
 * The app's name, icon and splash (v1 parity P1c), with a small picture of each. The wizard's "Your app" step and
 * the builder's App section both use it; the caller decides when it is saved.
 */
type Props = {
  value: AppIdentity;
  onChange: (patch: Partial<AppIdentity>, thing: string) => void;
  /** The builder's narrow panel: pictures under the fields instead of beside them. */
  narrow?: boolean;
};

export function AppIdentityFields({ value, onChange, narrow }: Props) {
  const [fileProblem, setFileProblem] = useState<{ icon?: string; splash?: string }>({});
  const [busy, setBusy] = useState<'icon' | 'splash' | null>(null);
  const problems = identityProblems(value);
  const initial = [...value.name.trim()][0]?.toUpperCase() ?? 'A';

  async function choose(kind: 'icon' | 'splash') {
    setBusy(kind);
    setFileProblem((p) => ({ ...p, [kind]: undefined }));
    try {
      const a = await pickPng(kind === 'icon' ? 'Choose your app icon' : 'Choose a splash image', 'Use this image');
      if (!a) return;
      const problem = await checkPicked(a, kind);
      if (problem) {
        setFileProblem((p) => ({ ...p, [kind]: problem }));
        return;
      }
      onChange(kind === 'icon' ? { icon_id: a.id, icon_url: a.url } : { splash_id: a.id, splash_url: a.url }, kind);
    } catch (err) {
      setFileProblem((p) => ({ ...p, [kind]: caughtProblem(err, 'Opening the media library') }));
    } finally {
      setBusy(null);
    }
  }

  const hex = /^#[0-9a-f]{6}$/i.test(value.splash_background) ? value.splash_background : '#FFFFFF';

  return (
    <div className={`appza-identity${narrow ? ' is-narrow' : ''}`} data-app-identity>
      <div className="appza-identity-fields">
        <label className="appza-identity-field">
          <span className="appza-identity-label">App name</span>
          <input
            type="text"
            value={value.name}
            maxLength={NAME_MAX}
            placeholder="My Community"
            data-identity-field="name"
            onChange={(e) => onChange({ name: e.target.value }, 'name')}
          />
          <span className={`appza-identity-hint${problems.name && value.name !== '' ? ' is-error' : ''}`}>
            {problems.name && value.name !== '' ? problems.name : `Shown under the icon on the phone. ${[...value.name].length} / ${NAME_MAX}`}
          </span>
        </label>

        <div className="appza-identity-field">
          <span className="appza-identity-label">Icon</span>
          <div className="appza-identity-row">
            <button type="button" className="appza-btn" onClick={() => void choose('icon')} disabled={busy !== null} data-identity-pick="icon">
              {busy === 'icon' ? 'Checking…' : value.icon_id ? 'Change icon…' : 'Choose icon…'}
            </button>
            {value.icon_id > 0 && (
              <button type="button" className="appza-btn" onClick={() => onChange({ icon_id: 0, icon_url: '' }, 'icon')}>
                Remove
              </button>
            )}
          </div>
          <span className={`appza-identity-hint${fileProblem.icon ? ' is-error' : ''}`} role={fileProblem.icon ? 'alert' : undefined}>
            {fileProblem.icon ?? `PNG, ${ICON_SIZE} × ${ICON_SIZE} pixels, no see-through parts, up to 2 MB.`}
          </span>
        </div>

        <div className="appza-identity-field">
          <span className="appza-identity-label">Splash screen</span>
          <div className="appza-identity-row">
            <input
              type="color"
              value={hex.toLowerCase()}
              aria-label="Splash background colour"
              onChange={(e) => onChange({ splash_background: e.target.value.toUpperCase() }, 'splash_background')}
            />
            <input
              type="text"
              className="appza-identity-hex"
              value={value.splash_background}
              maxLength={7}
              aria-label="Splash background colour (hex)"
              data-identity-field="splash_background"
              onChange={(e) => onChange({ splash_background: e.target.value.trim() }, 'splash_background')}
            />
          </div>
          {problems.splash_background && <span className="appza-identity-hint is-error">{problems.splash_background}</span>}
          <div className="appza-identity-row">
            <button type="button" className="appza-btn" onClick={() => void choose('splash')} disabled={busy !== null} data-identity-pick="splash">
              {busy === 'splash' ? 'Checking…' : value.splash_id ? 'Change image…' : 'Add an image…'}
            </button>
            {value.splash_id > 0 && (
              <button type="button" className="appza-btn" onClick={() => onChange({ splash_id: 0, splash_url: '' }, 'splash')}>
                Remove
              </button>
            )}
          </div>
          <span className={`appza-identity-hint${fileProblem.splash ? ' is-error' : ''}`} role={fileProblem.splash ? 'alert' : undefined}>
            {fileProblem.splash ??
              `The colour fills the screen while your app starts; an optional image sits in the middle. Square PNG, ${SPLASH_MIN} to ${SPLASH_MAX} pixels, up to 2 MB.`}
          </span>
        </div>
      </div>

      <div className="appza-identity-pictures" aria-hidden="true">
        <div className="appza-identity-home">
          <span className="appza-identity-icon">{value.icon_url ? <img src={value.icon_url} alt="" /> : <span>{initial}</span>}</span>
          <span className="appza-identity-icon-name">{value.name.trim() || 'Your app'}</span>
        </div>
        <div className="appza-identity-splash" style={{ background: hex }} data-identity-splash>
          {value.splash_url && <img src={value.splash_url} alt="" />}
        </div>
      </div>
    </div>
  );
}

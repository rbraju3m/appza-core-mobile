import { useEffect, useState } from 'react';
import { Problem, caughtProblem, httpProblem } from './errors';
import { isAdvanced } from './advanced';
import {
  loadTemplateCards,
  readConnection,
  saveConnection,
  saveIntroHidden,
  saveSiteTemplate,
  syncTemplate,
  type CoreConnection,
  type TemplateCard,
} from './siteTemplate';
import { setCoreExtras } from './coreExtras';
import { HowToGetYourApp } from './HowToGetYourApp';
import { AppIdentityFields } from './AppIdentityFields';
import { identityProblems, saveAppIdentity, savedIdentity, type AppIdentity } from './appIdentity';

// P1e: opens on "How to get your app" (every visit unless this user hid it), then the set-up steps.
// Friendly v2 P2: the first run. Connect (only when APPZA can't be reached) → your platform → pick a look; the tour
// follows in the builder. P1c: "Your app" (name, icon, splash) after the look, saved at once, or "Do this later". The "Apps" pill reopens it; there, choosing another look asks first (owner, C).

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

type Step = 'intro' | 'loading' | 'connect' | 'platform' | 'look' | 'finishing' | 'identity';

type Props = {
  /** True when the site has never chosen a platform or a look. */
  firstRun: boolean;
  /** 'intro' opens on "How to get your app"; 'setup' goes straight to the set-up steps. */
  startAt?: 'intro' | 'setup';
  /** The template the builder shows now. */
  currentTemplate: string;
  onClose: () => void;
  /** Platforms and look saved, designs fetched: open the builder on this template. */
  onFinished: (template: string) => void;
  /** P1c: the "Your app" step saved the app's name, icon and splash. */
  onIdentitySaved?: (identity: AppIdentity) => void;
};

export function OnboardingModal({ firstRun, startAt = 'intro', currentTemplate, onClose, onFinished, onIdentitySaved }: Props) {
  const [step, setStep] = useState<Step>(startAt === 'intro' ? 'intro' : 'loading');
  // Where Next on the intro page goes, once the platforms have loaded.
  const [afterIntro, setAfterIntro] = useState<'platform' | 'connect' | null>(null);
  const [introHidden, setIntroHidden] = useState(() => {
    const v = window.appzaCoreConfig?.introHidden;
    return v === true || v === '1';
  });
  const [rows, setRows] = useState<SourceIntegration[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState<TemplateCard[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [connection, setConnection] = useState<CoreConnection | null>(null);
  const [address, setAddress] = useState('');
  const [identity, setIdentity] = useState<AppIdentity>(savedIdentity);
  // The look is saved and synced once the "Your app" step shows: closing from there still opens it.
  const [finishedLook, setFinishedLook] = useState<string | null>(null);

  const sourceEndpoint = window.appzaCoreConfig?.endpoints?.sourceIntegrations;
  const activeEndpoint = window.appzaCoreConfig?.endpoints?.activeSourceIntegrations;
  const nonce = window.appzaCoreConfig?.restNonce;

  async function loadPlatforms(): Promise<boolean> {
    if (!sourceEndpoint || !activeEndpoint || !nonce) {
      throw new Problem('Open this page from your WordPress dashboard (APPZA in the menu) to continue.');
    }
    const [listRes, activeRes] = await Promise.all([
      fetch(sourceEndpoint, { headers: { Accept: 'application/json' } }),
      fetch(activeEndpoint, { headers: { Accept: 'application/json', 'X-WP-Nonce': nonce }, credentials: 'same-origin' }),
    ]);
    // The platform list comes from APPZA: when it fails, the site can't reach APPZA.
    if (!listRes.ok) return false;
    if (!activeRes.ok) throw new Problem(await httpProblem(activeRes, 'Loading the apps you can build'));
    const listBody = await listRes.json();
    const activeBody = await activeRes.json();
    setRows(Array.isArray(listBody?.source_integrations) ? listBody.source_integrations : []);
    setCoreExtras(listBody);
    setSelected(new Set(Array.isArray(activeBody?.slugs) ? (activeBody.slugs as string[]) : []));
    return true;
  }

  async function openConnect() {
    setStep((s) => (s === 'intro' ? s : 'connect'));
    try {
      const c = await readConnection();
      setConnection(c);
      setAddress(c.url);
    } catch (err) {
      setProblem(caughtProblem(err, 'Checking the connection to APPZA'));
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await loadPlatforms();
        if (cancelled) return;
        setAfterIntro(ok ? 'platform' : 'connect');
        if (ok) setStep((s) => (s === 'intro' ? s : 'platform'));
        else await openConnect();
      } catch (err) {
        if (!cancelled) {
          setProblem(caughtProblem(err, 'Loading the apps you can build'));
          setAfterIntro('platform');
          setStep((s) => (s === 'intro' ? s : 'platform'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkConnection() {
    setBusy(true);
    setProblem(null);
    try {
      const c =
        connection && !connection.locked && address.trim() !== connection.url ? await saveConnection(address.trim()) : await readConnection();
      setConnection(c);
      if (c.connected && (await loadPlatforms())) setStep('platform');
    } catch (err) {
      setProblem(caughtProblem(err, 'Checking the connection to APPZA'));
    } finally {
      setBusy(false);
    }
  }

  function toggle(slug: string, disabled: boolean) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function savePlatforms() {
    if (!activeEndpoint || !nonce) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(activeEndpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
        credentials: 'same-origin',
        body: JSON.stringify({ slugs: Array.from(selected) }),
      });
      if (!res.ok) throw new Problem(await httpProblem(res, 'Saving your choice'));
      const list = await loadTemplateCards();
      setCards(list);
      setPicked(list.some((t) => t.slug === currentTemplate) ? currentTemplate : list[0]?.slug ?? null);
      setConfirming(false);
      setStep('look');
    } catch (err) {
      setProblem(caughtProblem(err, 'Saving your choice'));
    } finally {
      setBusy(false);
    }
  }

  async function useLook() {
    if (!picked) return;
    // Changing the look of an app that already has one asks first: it also changes what Build App uses.
    if (!firstRun && picked !== currentTemplate && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setProblem(null);
    setStep('finishing');
    try {
      await saveSiteTemplate(picked);
      await syncTemplate(picked);
      setFinishedLook(picked);
      setIdentity(savedIdentity());
      setStep('identity');
    } catch (err) {
      setProblem(caughtProblem(err, "Getting your app's designs"));
      setStep('look');
    } finally {
      setBusy(false);
    }
  }

  function toggleIntroHidden(hidden: boolean) {
    setIntroHidden(hidden);
    if (window.appzaCoreConfig) window.appzaCoreConfig.introHidden = hidden;
    saveIntroHidden(hidden).catch((err) => {
      setIntroHidden(!hidden);
      setProblem(caughtProblem(err, 'Saving your choice'));
    });
  }

  async function saveIdentity() {
    if (!finishedLook) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await saveAppIdentity(identity);
      onIdentitySaved?.(saved);
      onFinished(finishedLook);
    } catch (err) {
      setProblem(caughtProblem(err, 'Saving your app\u2019s details'));
    } finally {
      setBusy(false);
    }
  }

  const pickedName = cards.find((t) => t.slug === picked)?.name ?? picked ?? '';
  const onLook = step === 'look' || step === 'finishing';
  const onIdentity = step === 'identity';
  const identityOk = Object.keys(identityProblems(identity)).length === 0;

  return (
    <div className="appza-onboard-overlay" role="dialog" aria-modal="true" aria-label="Set up your app">
      <div className={`appza-onboard-card appza-onboard-card-wide${step === 'intro' ? ' appza-onboard-card-intro' : ''}`}>
        <div className="appza-onboard-header">
          {(step === 'intro' || step === 'platform' || onLook || onIdentity) && (
            <ol className="appza-onboard-steps" aria-label="Steps">
              <li data-state={step === 'intro' ? 'now' : 'done'}>How to get your app</li>
              <li data-state={onLook || onIdentity ? 'done' : step === 'intro' ? 'next' : 'now'}>Your platform</li>
              <li data-state={onIdentity ? 'done' : onLook ? 'now' : 'next'}>Pick a look</li>
              <li data-state={onIdentity ? 'now' : 'next'}>Your app</li>
              <li data-state="next">Quick tour</li>
            </ol>
          )}
          <h2 className="appza-onboard-title">
            {step === 'intro'
              ? 'How to get your app'
              : step === 'connect'
              ? 'Connect to APPZA'
              : onLook
              ? 'Pick a look for your app'
              : onIdentity
              ? 'Name your app'
              : firstRun
              ? "Let's build your app"
              : 'Your platform'}
          </h2>
          <p className="appza-onboard-subtitle">
            {onIdentity
              ? 'Its name, icon and splash screen. Test builds are always called Appza QA; yours go into your own app with Pro builds.'
              : step === 'intro'
              ? 'Try your app on your phone with the APPZA demo app, then set it up in a few steps.'
              : step === 'connect'
              ? "This site could not reach APPZA, where your app's designs come from. Check the address below."
              : onLook
              ? 'You can change any colour, text or setting afterwards.'
              : 'Which plug-in should your app show? You can change this any time.'}
          </p>
        </div>

        <div className="appza-onboard-body">
          {step === 'intro' && <HowToGetYourApp />}
          {step === 'loading' && <div className="appza-onboard-status">Loading…</div>}

          {step === 'connect' && (
            <div className="appza-onboard-connect">
              <label htmlFor="appza-core-address">APPZA address</label>
              <input
                id="appza-core-address"
                type="url"
                value={address}
                disabled={!!connection?.locked}
                placeholder="https://…"
                onChange={(e) => setAddress(e.target.value)}
              />
              {connection?.locked && <p className="appza-onboard-hint">This address is set in wp-config.php. Ask your developer to change it.</p>}
              {connection && !connection.connected && (
                <p className="appza-onboard-hint">Not connected yet.{isAdvanced() && connection.message ? ` (${connection.message})` : ''}</p>
              )}
            </div>
          )}

          {step === 'platform' && rows.length === 0 && !problem && (
            <div className="appza-onboard-status">No apps are available yet. Check this site's connection on the APPZA → Sync page.</div>
          )}
          {step === 'platform' && rows.length > 0 && (
            <ul className="appza-onboard-list">
              {rows.map((row) => {
                const isSelected = selected.has(row.slug);
                const disabled = row.is_disable;
                return (
                  // The label alone handles the click: a row onClick as well toggled twice when the box itself was clicked.
                  <li key={row.slug} className={`appza-onboard-row${disabled ? ' is-disabled' : ''}${isSelected ? ' is-selected' : ''}`}>
                    <label className="appza-onboard-row-label">
                      <input type="checkbox" checked={isSelected} disabled={disabled} onChange={() => toggle(row.slug, disabled)} />
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
                        <span className="appza-onboard-row-icon appza-onboard-row-icon-fallback">{row.name.charAt(0).toUpperCase()}</span>
                      )}
                      <div className="appza-onboard-row-text">
                        <span className="appza-onboard-row-name">{row.name}</span>
                        {isAdvanced() && <span className="appza-onboard-row-slug">{row.addon_plugin_slug}</span>}
                      </div>
                      {disabled && (
                        <span className="appza-onboard-row-hint">Needs the “{row.addon_plugin_slug}” plug-in: install and activate it first</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {onLook && cards.length === 0 && <div className="appza-onboard-status">There are no designs for this platform yet.</div>}
          {onLook && cards.length > 0 && (
            <ul className="appza-onboard-looks" role="radiogroup" aria-label="Designs">
              {cards.map((t) => (
                <li key={t.slug}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={picked === t.slug}
                    className="appza-onboard-look"
                    data-picked={picked === t.slug}
                    disabled={step === 'finishing'}
                    onClick={() => {
                      setPicked(t.slug);
                      setConfirming(false);
                    }}
                  >
                    <span className="appza-onboard-look-thumb">
                      {t.preview_image_url ? <img src={t.preview_image_url} alt="" /> : <span aria-hidden="true">{t.name.charAt(0)}</span>}
                    </span>
                    <span className="appza-onboard-look-name">{t.name}</span>
                    {t.description && <span className="appza-onboard-look-desc">{t.description}</span>}
                    {!firstRun && t.slug === currentTemplate && <span className="appza-onboard-look-now">Your app now</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {step === 'finishing' && <div className="appza-onboard-status">Getting your app's designs…</div>}
          {onIdentity && <AppIdentityFields value={identity} onChange={(patch) => setIdentity((i) => ({ ...i, ...patch }))} />}
          {confirming && step === 'look' && (
            <div className="appza-onboard-confirm" role="alert">
              Switch your app to <b>{pickedName}</b>? Your next app build will use it too.
            </div>
          )}
        </div>

        {problem && <div className="appza-onboard-status appza-onboard-error">{problem}</div>}

        <div className="appza-onboard-footer">
          {step === 'intro' && (
            <label className="appza-onboard-dontshow">
              <input type="checkbox" checked={introHidden} onChange={(e) => toggleIntroHidden(e.target.checked)} />
              Don’t show this again
            </label>
          )}
          {step === 'platform' && startAt === 'intro' && (
            <button type="button" className="appza-onboard-btn appza-onboard-btn-ghost" onClick={() => setStep('intro')} disabled={busy}>
              Back
            </button>
          )}
          {step === 'look' ? (
            <button type="button" className="appza-onboard-btn appza-onboard-btn-ghost" onClick={() => setStep('platform')} disabled={busy}>
              Back
            </button>
          ) : onIdentity ? (
            <button
              type="button"
              className="appza-onboard-btn appza-onboard-btn-ghost"
              onClick={() => finishedLook && onFinished(finishedLook)}
              disabled={busy}
            >
              Do this later
            </button>
          ) : (
            <button type="button" className="appza-onboard-btn appza-onboard-btn-ghost" onClick={onClose} disabled={busy}>
              {firstRun ? 'Later' : 'Close'}
            </button>
          )}
          {step === 'intro' && (
            <button
              type="button"
              className="appza-onboard-btn appza-onboard-btn-primary"
              onClick={() => afterIntro && setStep(afterIntro)}
              disabled={!afterIntro}
              autoFocus
            >
              {afterIntro ? 'Next' : 'Loading…'}
            </button>
          )}
          {step === 'connect' && (
            <button
              type="button"
              className="appza-onboard-btn appza-onboard-btn-primary"
              onClick={checkConnection}
              disabled={busy || !connection || (connection.locked && connection.connected)}
            >
              {busy ? 'Checking…' : 'Check connection'}
            </button>
          )}
          {step === 'platform' && (
            <button
              type="button"
              className="appza-onboard-btn appza-onboard-btn-primary"
              onClick={savePlatforms}
              disabled={busy || rows.length === 0 || selected.size === 0}
            >
              {busy ? 'Saving…' : 'Next'}
            </button>
          )}
          {onIdentity && (
            <button type="button" className="appza-onboard-btn appza-onboard-btn-primary" onClick={() => void saveIdentity()} disabled={busy || !identityOk}>
              {busy ? 'Saving…' : 'Save and continue'}
            </button>
          )}
          {onLook && (
            <button type="button" className="appza-onboard-btn appza-onboard-btn-primary" onClick={useLook} disabled={busy || !picked}>
              {step === 'finishing' ? 'Getting designs…' : confirming ? `Switch to ${pickedName}` : 'Use this look'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

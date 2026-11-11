import { useEffect, useState, type FormEvent } from 'react';
import { App as CapApp } from '@capacitor/app';
import { DEMO_CONNECT_SCHEME } from '@appza/schemas';
import { App } from './App';
import { DEMO_SITE_NAME, SITE_URL, connectDemoSite, forgetDemoSite } from './site';

// P1e: the demo build. No site yet → the connect screen; a Connect Site link (deep link) switches site at any time.

function ConnectForm({ initialError, onCancel }: { initialError?: string | null; onCancel?: () => void }) {
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await connectDemoSite(address);
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
    }
  };

  return (
    <form className="appza-demo-form" onSubmit={submit} noValidate>
      <label className="appza-demo-label" htmlFor="appza-demo-address">
        Your site’s address
      </label>
      <input
        id="appza-demo-address"
        className="appza-demo-input"
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="https://yoursite.com"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={busy}
      />
      {error && (
        <p className="appza-demo-error" role="alert">
          {error}
        </p>
      )}
      <button className="appza-demo-primary" type="submit" disabled={busy || !address.trim()}>
        {busy ? 'Connecting…' : 'Connect'}
      </button>
      {onCancel && (
        <button className="appza-demo-ghost" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      )}
    </form>
  );
}

function ConnectScreen({ error }: { error: string | null }) {
  return (
    <div className="appza-demo-screen">
      <h1 className="appza-demo-heading">Connect your site</h1>
      <p className="appza-demo-text">
        In WordPress, open <strong>APPZA Core</strong> and press <strong>How to get your app</strong> →{' '}
        <strong>Connect Site</strong>. Scan the code with your phone’s camera, or type your site’s address here.
      </p>
      <ConnectForm initialError={error} />
    </div>
  );
}

function DemoBadge({ error, onDismissError }: { error: string | null; onDismissError: () => void }) {
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const shown = open || Boolean(error);
  const close = () => {
    setOpen(false);
    setConnecting(false);
    onDismissError();
  };
  return (
    <>
      <button type="button" className="appza-demo-badge" onClick={() => setOpen(true)} aria-label="Demo app: change site">
        Demo
      </button>
      {shown && (
        <div className="appza-demo-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="appza-demo-sheet" role="dialog" aria-label="Demo app">
            <p className="appza-demo-text">
              This is the APPZA demo app, showing <strong>{DEMO_SITE_NAME}</strong>.
            </p>
            {connecting || error ? (
              <ConnectForm initialError={error} onCancel={close} />
            ) : (
              <>
                <button className="appza-demo-primary" type="button" onClick={() => setConnecting(true)}>
                  Connect another site
                </button>
                <button className="appza-demo-ghost" type="button" onClick={() => void forgetDemoSite()}>
                  Disconnect
                </button>
                <button className="appza-demo-ghost" type="button" onClick={close}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function DemoShell() {
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const open = async (url: string | undefined) => {
      if (!url || !url.startsWith(`${DEMO_CONNECT_SCHEME}://`)) return;
      setConnecting(true);
      const r = await connectDemoSite(url);
      setConnecting(false);
      setError(r.ok ? null : r.message);
    };
    void CapApp.getLaunchUrl().then((l) => open(l?.url)).catch(() => {});
    const sub = CapApp.addListener('appUrlOpen', (e) => void open(e.url));
    return () => {
      void sub.then((h) => h.remove());
    };
  }, []);

  if (connecting) return <div className="appza-demo-screen"><p className="appza-demo-text">Connecting…</p></div>;
  if (!SITE_URL) return <ConnectScreen error={error} />;
  return (
    <>
      <App />
      <DemoBadge error={error} onDismissError={() => setError(null)} />
    </>
  );
}

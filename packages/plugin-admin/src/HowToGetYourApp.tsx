import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { demoConnectLink } from '@appza/schemas';
import { useCoreExtras } from './coreExtras';
import { VideoFrame } from './VideoModal';

// P1e: v1's "How to get your app" — the demo app's store codes, this site's connect code, and the tutorial video.
// The first page of the builder's opening modal (OnboardingModal).

function QrImage({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [text]);
  return (
    <div className="appza-demo-qr">
      {src ? <img src={src} alt={label} /> : <div className="appza-demo-qr-blank" aria-hidden="true" />}
    </div>
  );
}

export function HowToGetYourApp() {
  const { videoUrl, playStoreUrl, appStoreUrl } = useCoreExtras();
  const [tab, setTab] = useState<'demo' | 'connect'>('demo');
  const siteUrl = window.appzaCoreConfig?.siteUrl ?? '';
  const hasStore = Boolean(playStoreUrl || appStoreUrl);

  return (
        <div className="appza-demo-body" data-video={videoUrl ? 'true' : 'false'}>
          <section className="appza-demo-panel">
            <div className="appza-segmented appza-demo-tabs" role="tablist">
              {(
                [
                  ['demo', 'Demo App'],
                  ['connect', 'Connect Site'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className="appza-segmented-btn"
                  data-active={tab === key ? 'true' : 'false'}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'demo' &&
              (hasStore ? (
                <>
                  <div className="appza-demo-qrs">
                    {playStoreUrl && (
                      <a className="appza-demo-store" href={playStoreUrl} target="_blank" rel="noopener noreferrer">
                        <strong>Android</strong>
                        <QrImage text={playStoreUrl} label="Get the APPZA demo app on Google Play" />
                      </a>
                    )}
                    {appStoreUrl && (
                      <a className="appza-demo-store" href={appStoreUrl} target="_blank" rel="noopener noreferrer">
                        <strong>iPhone</strong>
                        <QrImage text={appStoreUrl} label="Get the APPZA demo app on the App Store" />
                      </a>
                    )}
                  </div>
                  <p className="appza-demo-hint">
                    Scan with your phone's camera to install the <strong>APPZA demo app</strong>. Then open <em>Connect Site</em>.
                  </p>
                </>
              ) : (
                <p className="appza-demo-soon">
                  The APPZA demo app is coming soon to Google Play and the App Store. Until then, use <em>Build App</em> to
                  make a test app for your phone.
                </p>
              ))}

            {tab === 'connect' && (
              <>
                {siteUrl ? <QrImage text={demoConnectLink(siteUrl)} label="Connect this site to the APPZA demo app" /> : null}
                <p className="appza-demo-hint">
                  With the demo app installed, scan this with your phone's camera: the app opens on your site. Or type this
                  address in the app:
                </p>
                <code className="appza-demo-address">{siteUrl}</code>
              </>
            )}
          </section>

          {videoUrl && (
            <section className="appza-demo-panel">
              <h3 className="appza-demo-title">Watch how it works</h3>
              <VideoFrame url={videoUrl} title="How to get your app" />
            </section>
          )}
        </div>
  );
}

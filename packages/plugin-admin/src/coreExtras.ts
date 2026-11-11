import { useEffect, useState } from 'react';

// What an APPZA admin sets in Core's Settings (tutorial video, demo app store links). The localized value may be from
// an older visit, so it is refreshed from Core once per page load. Each address is re-checked: they end up in an
// iframe or a QR code.

export type CoreExtras = {
  videoUrl: string | null;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
};

const VIDEO = /^https:\/\/(www\.youtube\.com\/embed\/[A-Za-z0-9_-]{6,20}|player\.vimeo\.com\/video\/\d+(\?h=[0-9a-f]+)?)$/;
const PLAY = /^https:\/\/play\.google\.com\/store\/apps\/details\?id=[A-Za-z0-9._]+$/;
const APPLE = /^https:\/\/apps\.apple\.com\/[A-Za-z0-9/_-]*id\d+$/;

const pick = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : null);

type Raw = { tutorial_video_url?: unknown; demo_app?: { play_store_url?: unknown; app_store_url?: unknown } | null };

function read(raw: Raw): CoreExtras {
  return {
    videoUrl: pick(raw.tutorial_video_url, VIDEO),
    playStoreUrl: pick(raw.demo_app?.play_store_url, PLAY),
    appStoreUrl: pick(raw.demo_app?.app_store_url, APPLE),
  };
}

const cfg = window.appzaCoreConfig;
let current = read({
  tutorial_video_url: cfg?.tutorialVideoUrl,
  demo_app: { play_store_url: cfg?.demoApp?.playStoreUrl, app_store_url: cfg?.demoApp?.appStoreUrl },
});
let refreshed = false;
const listeners = new Set<(x: CoreExtras) => void>();

/** Called with Core's source-integrations response (the wizard fetches it anyway). */
export function setCoreExtras(raw: Raw | null | undefined) {
  refreshed = true;
  if (!raw) return;
  const next = read(raw);
  if (next.videoUrl === current.videoUrl && next.playStoreUrl === current.playStoreUrl && next.appStoreUrl === current.appStoreUrl) return;
  current = next;
  listeners.forEach((l) => l(next));
}

export function useCoreExtras(): CoreExtras {
  const [value, setValue] = useState(current);
  useEffect(() => {
    listeners.add(setValue);
    setValue(current);
    const endpoint = window.appzaCoreConfig?.endpoints?.sourceIntegrations;
    if (!refreshed && endpoint) {
      refreshed = true;
      fetch(endpoint, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => setCoreExtras(body))
        .catch(() => {});
    }
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

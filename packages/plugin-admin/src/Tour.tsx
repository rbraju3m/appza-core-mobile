import { useEffect, useLayoutEffect, useState } from 'react';

// Friendly v2 P2, step 3: four tips over the real builder. Seen once per WordPress user (owner, B); App saves that.

type Tip = { target: string; title: string; body: string };

const TIPS: Tip[] = [
  { target: 'pages', title: 'Your pages', body: 'Pick a page of your app here: home, a list, a profile…' },
  { target: 'phone', title: 'Click anything to change it', body: 'Click a part of the phone to change its colours, text and settings in the panel on the right.' },
  { target: 'designs', title: 'New designs from APPZA', body: 'When APPZA adds or improves designs, press this to get them. Your own changes stay.' },
  { target: 'build', title: 'Make your app', body: 'When you like it, build a test app for your phone. You can find it later under APPZA → Build History.' },
];

type Ring = { top: number; left: number; width: number; height: number } | null;

export function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [ring, setRing] = useState<Ring>(null);
  const tip = TIPS[i]!;
  const last = i === TIPS.length - 1;

  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${tip.target}"]`);
      if (!el) return setRing(null);
      const r = el.getBoundingClientRect();
      setRing({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [tip.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  // The card sits beside the ring, kept inside the window.
  const cardTop = ring ? Math.min(window.innerHeight - 200, Math.max(16, ring.top + ring.height + 12)) : window.innerHeight / 2 - 90;
  const cardLeft = ring ? Math.min(window.innerWidth - 336, Math.max(16, ring.left)) : window.innerWidth / 2 - 160;

  return (
    <div className="appza-tour" role="dialog" aria-modal="true" aria-label="Quick tour">
      {ring && <div className="appza-tour-ring" style={ring} aria-hidden="true" />}
      <div className="appza-tour-card" style={{ top: cardTop, left: cardLeft }}>
        <div className="appza-tour-count">
          {i + 1} of {TIPS.length}
        </div>
        <h3 className="appza-tour-title">{tip.title}</h3>
        <p className="appza-tour-body">{tip.body}</p>
        <div className="appza-tour-actions">
          <button type="button" className="appza-onboard-btn appza-onboard-btn-ghost" onClick={onDone}>
            Skip tour
          </button>
          <button type="button" className="appza-onboard-btn appza-onboard-btn-primary" onClick={() => (last ? onDone() : setI(i + 1))} autoFocus>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

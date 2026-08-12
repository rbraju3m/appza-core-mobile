import { useEffect, useState } from 'react';

// Overlays (modals, confirm alerts) position themselves with
// `position: fixed`, which is measured against the browser window. On a
// real Capacitor build the window IS the device screen, so that's
// correct. Inside the plug-in admin the app runs in a simulated phone
// frame occupying a slice of a desktop window, and a full-window
// overlay centres its card beside the frame instead of inside it.
//
// This hook returns the simulated screen's rect when one exists, so an
// overlay can pin itself to it. getBoundingClientRect is
// viewport-relative — the same frame of reference `position: fixed`
// uses — so no scroll-offset arithmetic is needed. Returns null on the
// mobile build, where the plain full-window overlay is already right.

export function useDeviceViewportRect(active: boolean): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active || typeof document === 'undefined') {
      setRect(null);
      return;
    }
    // Resolved when the overlay opens rather than at module load — the
    // device frame mounts after the renderer does.
    const el = document.querySelector<HTMLElement>('.appza-device-viewport');
    if (!el) {
      setRect(null);
      return;
    }
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    window.addEventListener('resize', measure);
    // Capture phase: the frame can sit inside its own scrolling pane.
    window.addEventListener('scroll', measure, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      ro?.disconnect();
    };
  }, [active]);

  return rect;
}

/** Inline style that pins a fixed overlay onto the simulated screen. */
export function deviceViewportOverlayStyle(
  rect: DOMRect | null,
): { inset: 'auto'; top: number; left: number; width: number; height: number } | undefined {
  if (!rect) return undefined;
  return {
    inset: 'auto',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

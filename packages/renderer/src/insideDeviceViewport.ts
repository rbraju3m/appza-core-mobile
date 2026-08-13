import { useEffect, useState } from 'react';

// Overlays (modals, confirm alerts) are `position: fixed`, measured
// against the browser window. On a real Capacitor build the window IS
// the device screen, so that's correct. Inside the plug-in admin the app
// runs in a simulated phone frame occupying a slice of a desktop window,
// and a full-window overlay centres its card beside the frame.
//
// This used to be solved by measuring the frame and pinning the overlay
// to its rect, with scroll/resize/ResizeObserver listeners keeping the
// numbers fresh. The overlays now mount *inside* `.appza-device-viewport`
// (which is also what makes them selectable in the builder), so the
// admin stylesheet flips them to `position: absolute` and the browser
// keeps them aligned for free — no measuring, nothing to resync.
//
// What still needs a JS answer is the case where being embedded changes
// layout rather than position: the invite modal caps its height against
// the simulated screen instead of growing to a desktop window's. Hence
// this boolean.

/**
 * True when the app is running inside the plug-in admin's simulated
 * phone frame rather than as a real (or full-window) app.
 *
 * Resolved when the overlay opens rather than at module load — the
 * device frame mounts after the renderer does.
 */
export function useInsideDeviceViewport(active: boolean): boolean {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    if (!active || typeof document === 'undefined') {
      setEmbedded(false);
      return;
    }
    setEmbedded(Boolean(document.querySelector('.appza-device-viewport')));
  }, [active]);

  return embedded;
}

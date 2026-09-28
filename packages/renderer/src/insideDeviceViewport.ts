import { useEffect, useState } from 'react';

// Resolved when the overlay opens: the device frame mounts after the renderer.
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

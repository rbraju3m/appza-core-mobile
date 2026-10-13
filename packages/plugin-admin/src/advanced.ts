import { useEffect, useState } from 'react';

// Simple / Advanced, remembered per browser. Advanced shows exact values, variable names and the developer controls.
const KEY = 'appza.simulator.advanced';
const EVENT = 'appza:simulator-advanced';

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function useAdvanced(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(read);
  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const set = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // A blocked storage still switches this page.
    }
    setOn(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}

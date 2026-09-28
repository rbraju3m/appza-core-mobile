import { useEffect, useState } from 'react';

// ONE PUBLISHER PER KEY: two AppZets writing one key hit React's update-depth limit and the gated placement vanishes.

export type ListVerdict = 'loading' | 'list' | 'empty';

const EVENT = 'appza:list-verdicts-change';

let current: Record<string, ListVerdict> = {};

export function getListVerdicts(): Record<string, ListVerdict> {
  return current;
}

export function getListVerdict(key: string): ListVerdict {
  return current[key] ?? 'loading';
}

export function setListVerdict(key: string, verdict: ListVerdict): void {
  if (!key) return;
  if (current[key] === verdict) return;
  current = { ...current, [key]: verdict };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

// Hidden profile tabs unmount, so dropping the key stops a stale 'empty' painting under another tab.
export function clearListVerdict(key: string): void {
  if (!key || !(key in current)) return;
  const next = { ...current };
  delete next[key];
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
  }
}

export function useListVerdicts(): Record<string, ListVerdict> {
  const [state, setState] = useState<Record<string, ListVerdict>>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}

import { useEffect, useRef } from 'react';

// Open sheets register a close handler; the hardware back button closes the topmost one first.
const stack: Array<() => void> = [];

export function useBackDismiss(open: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const handler = () => closeRef.current();
    stack.push(handler);
    return () => {
      const i = stack.lastIndexOf(handler);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}

/** Closes the topmost open sheet. Returns false when none is open. */
export function dismissTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

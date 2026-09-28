import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

// All screens share one IonContent, so offsets are saved/restored by stack depth; restore retries ~10s while infinite scroll loads and yields to any touch/wheel.

type Saved = { key: string | number; top: number };

type IonContentLike = HTMLElement & { getScrollElement?: () => Promise<HTMLElement> };

const RESTORE_WINDOW_MS = 10000;

export function useScreenScrollMemory(
  contentRef: RefObject<IonContentLike | null>,
  screenKey: string | number,
  navDepth: number | undefined,
): void {
  const lastTop = useRef(0);
  const saved = useRef<Saved[]>([]);
  const previous = useRef<{ key: string | number; depth: number } | null>(null);
  const scrollEl = useRef<HTMLElement | null>(null);
  const restoreToken = useRef(0);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof content.getScrollElement !== 'function') return;
    let el: HTMLElement | null = null;
    let cancelled = false;
    const onScroll = () => {
      if (el) lastTop.current = el.scrollTop;
    };
    content
      .getScrollElement()
      .then((found) => {
        if (cancelled) return;
        el = found;
        scrollEl.current = found;
        lastTop.current = found.scrollTop;
        found.addEventListener('scroll', onScroll, { passive: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      el?.removeEventListener('scroll', onScroll);
    };
  }, [contentRef]);

  useLayoutEffect(() => {
    if (navDepth === undefined) return;
    const before = previous.current;
    previous.current = { key: screenKey, depth: navDepth };
    if (!before || (before.key === screenKey && before.depth === navDepth)) return;

    let target = 0;
    if (navDepth > before.depth) {
      saved.current[before.depth] = { key: before.key, top: lastTop.current };
      saved.current.length = before.depth + 1;
    } else if (navDepth < before.depth) {
      const entry = saved.current[navDepth];
      if (entry && entry.key === screenKey) target = entry.top;
      saved.current.length = navDepth;
    } else {
      saved.current.length = navDepth;
    }

    const token = ++restoreToken.current;
    lastTop.current = target;
    const el = scrollEl.current;
    if (!el) return;
    el.scrollTop = target;
    if (target <= 0) return;

    let interrupted = false;
    const interrupt = () => {
      interrupted = true;
    };
    el.addEventListener('touchstart', interrupt, { passive: true, once: true });
    el.addEventListener('wheel', interrupt, { passive: true, once: true });
    const cleanup = () => {
      el.removeEventListener('touchstart', interrupt);
      el.removeEventListener('wheel', interrupt);
    };

    const started = performance.now();
    const tick = () => {
      if (token !== restoreToken.current || interrupted) return cleanup();
      if (Math.abs(el.scrollTop - target) <= 2) return cleanup();
      el.scrollTop = target;
      if (performance.now() - started < RESTORE_WINDOW_MS) requestAnimationFrame(tick);
      else cleanup();
    };
    requestAnimationFrame(tick);
  }, [screenKey, navDepth]);
}

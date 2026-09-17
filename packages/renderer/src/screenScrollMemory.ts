import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Where a screen is scrolled to, across navigation (2026-09-17).
 *
 * Every screen renders into ONE IonContent — ScreenRenderer is not keyed
 * by screen — so its scroll offset used to outlive the screen that set it.
 * Tapping an author from deep in the feed opened their profile already
 * scrolled past the header, and coming back landed wherever the profile
 * had been. The same was true of every push; the author tap made it
 * obvious.
 *
 * The shells already keep a stack of screen ids, so its LENGTH says which
 * way navigation went:
 *
 *   deeper   (a push)        save the leaving screen's offset, open at the top
 *   shallower (back)         restore the offset saved at that depth — but only
 *                            if it was saved for THIS screen; a tab switch
 *                            empties the stack onto a different root
 *   same depth (replace)     open at the top
 *
 * The offset is read in a LAYOUT effect, from a value the scroll listener
 * keeps current: once the new screen is committed the browser clamps the
 * old offset to the new content, and that clamp would otherwise be what
 * gets saved.
 *
 * A screen you come back to refetches, so its height arrives over the next
 * frames — and the feed reloads its FIRST page, so an offset six pages deep
 * is only reachable as infinite scroll loads the rest behind the restore.
 * Measured 2026-09-17: 8972px came back exactly in ~4.5s, walking down
 * through 755 → 3962 → 7249 → 8972. Hence a 10s window. It gives up the
 * moment the reader touches or wheels the page — it must never fight a
 * scroll — and on the next navigation.
 */

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
    // A shell that does not pass a depth keeps the old behaviour.
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

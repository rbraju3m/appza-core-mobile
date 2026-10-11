// Core's preview only: outlines on a layer above the app (hover, the clicked piece, a part Core asks for).
// Nothing is added inside the app, so the renderer and its styles are untouched.

export type PieceLabels = Record<string, { pieces?: Record<string, string>; whole?: string }>;
export type Highlight = { block: string; appzet?: string | null; pieces?: number[]; tag?: string; cls?: string; whole?: boolean } | null;

const MAX_BOXES = 80;
const HOVER = '#f08c00';
const PICKED = '#228be6';

let labels: PieceLabels = {};
let hovered: Element | null = null;
let picked: Element | null = null;
let highlight: Highlight = null;

const layer = document.createElement('div');
layer.setAttribute('data-appza-preview-layer', '');
Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483647' });

function box(el: Element, color: string, fill: boolean, text?: string): HTMLElement {
  const r = el.getBoundingClientRect();
  const b = document.createElement('div');
  Object.assign(b.style, {
    position: 'absolute', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    outline: `2px solid ${color}`, outlineOffset: '-1px', borderRadius: '3px',
    background: fill ? 'rgba(34, 139, 230, 0.08)' : 'transparent',
  });
  if (text) {
    const t = document.createElement('span');
    t.textContent = text;
    Object.assign(t.style, {
      position: 'absolute', left: '-1px', top: r.top < 18 ? '100%' : '-18px', padding: '1px 6px', whiteSpace: 'nowrap',
      font: '600 11px/16px system-ui, sans-serif', color: '#fff', background: color, borderRadius: '3px',
    });
    b.appendChild(t);
  }
  return b;
}

/** The top-level piece under an element, its block and index. */
export function pieceOf(target: Element | null): { el: Element; block: string | null; appzet: string | null; child: number } | null {
  const el = target?.closest?.('[data-appza-primitive-path]');
  if (!el) return null;
  return {
    el,
    block: el.closest('.appza-renderer-ss')?.getAttribute('data-slug') ?? null,
    appzet: el.getAttribute('data-appza-appzet-slug'),
    child: Number(el.getAttribute('data-child-index')),
  };
}

/** Ionic tags and appza classes from the clicked element up to its piece: "every button" and class parts match these. */
export function stylingOf(target: Element, piece: Element): { tags: string[]; classes: string[] } {
  const tags = new Set<string>();
  const classes = new Set<string>();
  for (let el: Element | null = target; el; el = el.parentElement) {
    const tag = el.tagName.toLowerCase();
    if (tag.startsWith('ion-')) tags.add(tag);
    el.classList.forEach((c) => c.startsWith('appza-') && !c.startsWith('appza-renderer-') && classes.add(c));
    if (el === piece) break;
  }
  return { tags: [...tags], classes: [...classes] };
}

function labelOf(p: NonNullable<ReturnType<typeof pieceOf>>): string {
  return (p.block && labels[p.block]?.pieces?.[String(p.child)]) || `Piece ${p.child + 1}`;
}

function highlighted(): Element[] {
  if (!highlight) return [];
  const blocks = [...document.querySelectorAll(`.appza-renderer-ss[data-slug="${CSS.escape(highlight.block)}"]`)].filter(
    (ss) => !highlight!.appzet || ss.querySelector(`:scope > [data-appza-appzet-slug="${CSS.escape(highlight!.appzet)}"]`),
  );
  const out: Element[] = [];
  for (const ss of blocks) {
    if (highlight.whole) out.push(ss);
    for (const i of highlight.pieces ?? []) {
      const el = ss.querySelector(`:scope > [data-child-index="${i}"]`);
      if (el) out.push(el);
    }
    if (highlight.tag) out.push(...ss.querySelectorAll(highlight.tag));
    if (highlight.cls) out.push(...ss.querySelectorAll(`.${CSS.escape(highlight.cls)}`));
    if (out.length >= MAX_BOXES) break;
  }
  return out.slice(0, MAX_BOXES).filter((el) => el.getClientRects().length > 0);
}

function paint() {
  if (hovered && !hovered.isConnected) hovered = null;
  if (picked && !picked.isConnected) picked = null;
  if (!hovered && !picked && !highlight) {
    if (layer.firstChild) layer.replaceChildren();
    requestAnimationFrame(paint);
    return;
  }
  layer.replaceChildren();
  for (const el of highlighted()) layer.appendChild(box(el, PICKED, true));
  if (picked) layer.appendChild(box(picked, PICKED, false));
  const h = pieceOf(hovered);
  if (h && h.el !== picked) layer.appendChild(box(h.el, HOVER, false, labelOf(h)));
  else if (h) layer.appendChild(box(h.el, PICKED, false, labelOf(h)));
  requestAnimationFrame(paint);
}

export function startPointer() {
  document.body.appendChild(layer);
  document.addEventListener('mouseover', (e) => { hovered = e.target as Element; }, true);
  document.addEventListener('mouseleave', () => { hovered = null; });
  requestAnimationFrame(paint);
}

export function setPicked(el: Element | null) {
  picked = el;
  highlight = null;
}

export function setLabels(next: PieceLabels) {
  labels = next;
}

export function setHighlight(next: Highlight) {
  highlight = next;
  if (next) picked = null;
}

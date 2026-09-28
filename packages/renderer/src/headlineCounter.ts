// Fields are DOM-owned (not a store), so the counter is written there; the limit is read off the input's maxlength, which FC lets a site filter.

const FORM_SLUG = 'fc-basic-profile-information';
const INPUT_PATH = 'children[11]';
const COUNTER_PATH = 'children[12]';
const DEFAULT_MAX = 60;

let started = false;

function paint(root: ParentNode): void {
  const inputHost = root.querySelector(`[data-appza-primitive-path="${INPUT_PATH}"]`);
  const counter = root.querySelector(`[data-appza-primitive-path="${COUNTER_PATH}"]`);
  if (!inputHost || !counter) return;

  const input = inputHost.querySelector('input') as HTMLInputElement | null;
  if (!input) return;

  const declared = Number(input.getAttribute('maxlength'));
  const max = Number.isFinite(declared) && declared > 0 ? declared : DEFAULT_MAX;
  const next = `${(input.value ?? '').length}/${max}`;

  // Only write on change: assigning textContent is a mutation the observer hears, so it would loop.
  if (counter.textContent !== next) counter.textContent = next;
}

export function startHeadlineCounter(): void {
  if (started || typeof document === 'undefined') return;
  started = true;

  const repaint = () => {
    const form = document.querySelector(`[data-slug="${FORM_SLUG}"]`);
    if (form) paint(form);
  };

  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest(`[data-appza-primitive-path="${INPUT_PATH}"]`)) return;
    repaint();
  });

  // childList only, never characterData: the repaint writes text, so listening for it would loop.
  const observer = new MutationObserver(() => repaint());
  observer.observe(document.body, { childList: true, subtree: true });
  repaint();
}

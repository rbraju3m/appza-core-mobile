/**
 * "59/60" under the edit form's Headline field — design 40.
 *
 * ---------------------------------------------------------------------
 * Why this is a DOM listener and not a binding
 * ---------------------------------------------------------------------
 *
 * The counter has to change on every keystroke, and nothing in the
 * catalog can express that: a field mapping binds a value once, and this
 * form deliberately does not hold its fields in a store — it seeds them
 * from the payload and then the DOM owns them, which is the same reason
 * `profile.save` reads them back out with `collect`.
 *
 * So the counter is written where the value lives. That is consistent
 * with how the rest of this form already works rather than a new kind of
 * coupling, and it is the only part of the arc that reaches into the DOM
 * to WRITE rather than to read.
 *
 * ---------------------------------------------------------------------
 * The indices mirror the catalog
 * ---------------------------------------------------------------------
 *
 * `children[11]` is the headline input and `children[12]` its counter, in
 * `fc-basic-profile-information`. Those are the same indices the save's
 * `param_map` uses, and a contract test pins both — this form's children
 * must never be renumbered, and if they are, the test says so before
 * anything ships.
 *
 * The limit comes from the input's own `maxlength`, which the catalog
 * binds from `headline_max`. FluentCommunity applies the same number
 * through a filter a site can change, so reading it off the element
 * rather than hardcoding 60 keeps the counter and the server agreeing.
 */

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

  // ONLY write when it actually changed. Assigning textContent replaces
  // the text node even when the string is identical, and that is a
  // mutation — which the observer below hears, which repaints, which
  // mutates again. The first version of this file did exactly that and
  // locked the page up hard enough that the harness lost its CDP
  // connection ("DOM.describeNode timed out").
  if (counter.textContent !== next) counter.textContent = next;
}

/**
 * Starts the watcher. Idempotent, and safe to call before the form
 * exists: it listens on the document and re-paints whenever the headline
 * field is typed into or the form is (re)rendered.
 */
export function startHeadlineCounter(): void {
  if (started || typeof document === 'undefined') return;
  started = true;

  const repaint = () => {
    const form = document.querySelector(`[data-slug="${FORM_SLUG}"]`);
    if (form) paint(form);
  };

  // Delegated, so it survives the form mounting and unmounting with the
  // screen — there is no component here to own a listener.
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest(`[data-appza-primitive-path="${INPUT_PATH}"]`)) return;
    repaint();
  });

  // The value is SEEDED from the payload, which lands after mount, so the
  // first paint has to wait for the element rather than for the event.
  //
  // `childList` only, and never `characterData`: the repaint itself
  // writes text, so listening for text changes is a loop by
  // construction. The equality guard above is the second half of that
  // defence, and either alone is not enough.
  const observer = new MutationObserver(() => repaint());
  observer.observe(document.body, { childList: true, subtree: true });
  repaint();
}

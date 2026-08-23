/**
 * Write a value into a rendered input primitive, addressed the way the
 * shells already address form fields: `data-appza-appzet-slug` plus
 * `data-appza-primitive-path`, both stamped by SuperstructureRenderer.
 *
 * WHY THIS HAS TO EXIST. `IonInput` is rendered UNCONTROLLED — it takes a
 * `placeholder` and an `onIonInput`, never a `value`. Ionic holds the text,
 * which is what keeps typing responsive and is why a debounced slice write
 * does not fight the caret. The cost is that writing the slice does NOT
 * push text back into the field, so any code path that sets a query
 * WITHOUT the user typing it leaves the box empty.
 *
 * That is not cosmetic. Tapping a recent search ran the search and showed
 * its results — or its "No matches" — over an empty field, so the reason
 * for what you were looking at was nowhere on screen. The same shape of
 * problem the screen reset exists to avoid.
 *
 * Deliberately does NOT dispatch an input event. The caller has already
 * written the slice; re-entering through `onIonInput` would push the same
 * value through the debounce again and re-record the term for no reason.
 * Making the field controlled instead would fix this case and risk every
 * other one — a controlled Ionic input re-rendered on every keystroke is
 * how caret-jumping starts.
 *
 * Lives in the renderer rather than in either shell because both need it,
 * and a fix that lands in one shell only is the blind spot P100 records.
 */
export function setPrimitiveInputValue(
  appzetSlug: string,
  primitivePath: string,
  value: string,
): boolean {
  if (typeof document === 'undefined') return false;
  const wrapper = document.querySelector(
    `[data-appza-appzet-slug="${CSS.escape(appzetSlug)}"][data-appza-primitive-path="${CSS.escape(primitivePath)}"]`,
  );
  if (!wrapper) return false;
  const el = wrapper.querySelector('ion-input, ion-textarea, input, textarea') as
    | (HTMLElement & { value?: string })
    | null;
  if (!el) return false;
  // Setting `value` on the ion-input HOST is what updates the rendered
  // text — Ionic mirrors it onto its inner input. Setting the inner
  // input directly would be overwritten on Ionic's next render.
  el.value = value;
  return true;
}

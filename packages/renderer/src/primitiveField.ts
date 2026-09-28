// IonInput is uncontrolled, so a slice write never reaches the box; this pushes it without firing an input event.
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
  // Set `value` on the ion-input host; Ionic overwrites its inner input on the next render.
  el.value = value;
  return true;
}

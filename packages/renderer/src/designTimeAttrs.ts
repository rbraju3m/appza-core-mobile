// Design-time selection markers for hand-written overlay components.
//
// AppZets composed by PlacementRenderer get these attributes for free —
// it stamps `data-child-slug` / `data-appza-primitive-path` /
// `data-appza-appzet-slug` onto every depth-0 superstructure child, and
// the plug-in admin's DeviceFrame captures clicks on them to drive the
// Properties + Wrapper panels.
//
// The modals and sheets are not composed that way: they're bespoke React
// so they can own local form state, network calls and focus management.
// That left them unreachable from the builder — clicking one selected
// nothing, so the right panel never opened on it. These helpers let a
// bespoke overlay opt back in by hand, declaring which DOM node stands
// in for which superstructure child.
//
// Index and slug MUST match the superstructure's `children` array in the
// catalog — that ordering is what `properties_schema.binds_to`
// (`children[3].placeholder`) and the saved customization key
// (`<appzet-slug>#children[3]`) both address. Reordering children in the
// catalog means renumbering here.
//
// The attributes are inert everywhere else. On the Capacitor build
// nothing reads them; they cost a few bytes of markup and buy the
// builder a selection surface.

export type DesignTimeAttrs = {
  'data-appza-appzet-slug': string;
  'data-appza-primitive-path': string;
  'data-child-slug': string;
};

/** Marks a DOM node as superstructure child `index` of `appzetSlug`. */
export function childAttrs(
  appzetSlug: string,
  index: number,
  childSlug: string,
): DesignTimeAttrs {
  return {
    'data-appza-appzet-slug': appzetSlug,
    'data-appza-primitive-path': `children[${index}]`,
    'data-child-slug': childSlug,
  };
}

/**
 * Marks an overlay's root card as the AppZet itself. Clicking padding or
 * any untagged area inside selects the whole AppZet, which is what opens
 * the Options tab — the same fallback PlacementRenderer gives a composed
 * AppZet when the click misses every child.
 *
 * `data-appza-overlay` additionally tells the builder that this subtree
 * is a live, stateful overlay rather than a static composition. Design-
 * time selection inside it must NOT swallow the click: a modal is only
 * half-visible at a time (tabs, a picked-user state, an open dropdown),
 * so the builder has to keep driving it to reach every child. The
 * builder selects and lets the click through, and skips its
 * clear-selection-on-background handler for anything inside this root.
 */
export function appzetAttrs(appzetSlug: string): {
  'data-appza-appzet-slug': string;
  'data-appza-overlay': string;
} {
  return { 'data-appza-appzet-slug': appzetSlug, 'data-appza-overlay': '' };
}

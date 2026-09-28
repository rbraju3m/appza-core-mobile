// Index and slug must match the superstructure's `children` order in the catalog; binds_to and customization keys address it.

export type DesignTimeAttrs = {
  'data-appza-appzet-slug': string;
  'data-appza-primitive-path': string;
  'data-child-slug': string;
};

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

/** `data-appza-overlay` tells the builder to let clicks through: a stateful overlay must stay drivable at design time. */
export function appzetAttrs(appzetSlug: string): {
  'data-appza-appzet-slug': string;
  'data-appza-overlay': string;
} {
  return { 'data-appza-appzet-slug': appzetSlug, 'data-appza-overlay': '' };
}

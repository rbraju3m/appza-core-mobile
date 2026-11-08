// An overlay opens outside PlacementRenderer and reads only its AppZet's saved values, so a block default never
// reached it: the opener's own fallbacks (FC's words) drew instead. A shared block's defaults now sit under the
// AppZet's values. FC's blocks are left as they were, since their openers' fallbacks are their defaults (R3e).

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

export function overlayBlockDefaults(catalog: unknown, appzetSlug: string): Row {
  const cat = isRow(catalog) ? catalog : {};
  const appzets = Array.isArray(cat.appzets) ? cat.appzets : [];
  const appzet = appzets.find((a): a is Row => isRow(a) && a.slug === appzetSlug);
  if (!appzet) return {};
  const blocks = Array.isArray(cat.superstructures) ? cat.superstructures : [];
  const block = blocks.find((s): s is Row => isRow(s) && s.id === appzet.superstructure_id);
  if (!block || typeof block.slug !== 'string' || block.slug.startsWith('fc-')) return {};
  const out: Row = {};
  for (const setting of Array.isArray(block.properties_schema) ? block.properties_schema : []) {
    if (isRow(setting) && typeof setting.name === 'string' && setting.default !== undefined) {
      out[setting.name] = setting.default;
    }
  }
  return out;
}

/** The props an overlay opens with: its block's defaults (shared blocks only), then the AppZet's own values. */
export function withOverlayBlockDefaults(catalog: unknown, appzetSlug: string, props: Row): Row {
  return { ...overlayBlockDefaults(catalog, appzetSlug), ...props };
}

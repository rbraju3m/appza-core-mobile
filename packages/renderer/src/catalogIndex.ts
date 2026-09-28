import type { AppZet, Catalog, Superstructure } from '@appza/schemas';

export type PrimitiveRow = {
  slug: string;
  name?: string;
  ionic_component?: string;
};

export type DataSourceRow = {
  id: number;
  slug: string;
  endpoint?: string;
  /** Reads an array from a `state.<slice>.<key>` slice instead of fetching; `endpoint` is '' on such rows. */
  client_state_binding?: string | null;
  http_method?: string;
  query_params?: Record<string, unknown> | null;
};

export type CatalogIndex = {
  appzetBySlug: Map<string, AppZet>;
  superstructureById: Map<number, Superstructure>;
  superstructureBySlug: Map<string, Superstructure>;
  primitiveBySlug: Map<string, PrimitiveRow>;
  dataSourceById: Map<number, DataSourceRow>;
  dataSourceBySlug: Map<string, DataSourceRow>;
};

export function indexCatalog(catalog: Catalog): CatalogIndex {
  const appzetBySlug = new Map<string, AppZet>();
  for (const a of catalog.appzets ?? []) appzetBySlug.set(a.slug, a);

  const superstructureById = new Map<number, Superstructure>();
  const superstructureBySlug = new Map<string, Superstructure>();
  for (const s of catalog.superstructures ?? []) {
    superstructureById.set(s.id, s);
    superstructureBySlug.set(s.slug, s);
  }

  const primitiveBySlug = new Map<string, PrimitiveRow>();
  for (const p of (catalog.primitives ?? []) as PrimitiveRow[]) {
    if (typeof p.slug === 'string') primitiveBySlug.set(p.slug, p);
  }

  const dataSourceById = new Map<number, DataSourceRow>();
  const dataSourceBySlug = new Map<string, DataSourceRow>();
  for (const d of (catalog.data_sources ?? []) as DataSourceRow[]) {
    if (typeof d.id === 'number') dataSourceById.set(d.id, d);
    if (typeof d.slug === 'string') dataSourceBySlug.set(d.slug, d);
  }

  return {
    appzetBySlug,
    superstructureById,
    superstructureBySlug,
    primitiveBySlug,
    dataSourceById,
    dataSourceBySlug,
  };
}

export function readActionDefaultsFromCatalog(
  actionSlug: string,
): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const cat = (window as unknown as { __appzaCatalog?: { actions?: unknown } })
    .__appzaCatalog;
  const actions = cat?.actions;
  if (!Array.isArray(actions)) return null;
  const row = actions.find(
    (a): a is Record<string, unknown> =>
      typeof a === 'object' &&
      a !== null &&
      (a as Record<string, unknown>).slug === actionSlug,
  );
  if (!row) return null;
  const ps = row.param_schema;
  if (typeof ps !== 'object' || ps === null) return null;
  const defaults: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ps as Record<string, unknown>)) {
    if (
      v &&
      typeof v === 'object' &&
      'default' in (v as Record<string, unknown>)
    ) {
      defaults[k] = (v as Record<string, unknown>).default;
    }
  }
  return defaults;
}

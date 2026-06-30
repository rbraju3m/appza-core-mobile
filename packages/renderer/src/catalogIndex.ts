import type { AppZet, Catalog, Superstructure } from '@appza/schemas';

/**
 * Pre-indexed catalog for O(1) row lookups during a render pass.
 *
 * Building the maps once via useMemo at the renderer boundary avoids
 * O(rows * primitives) Array.find walks during each render. Child slugs
 * in a Superstructure can be either a Primitive OR another Superstructure,
 * so we keep separate maps and let the caller try-Primitive-then-Superstructure.
 */

export type PrimitiveRow = {
  slug: string;
  name?: string;
  ionic_component?: string;
};

export type DataSourceRow = {
  id: number;
  slug: string;
  endpoint?: string;
  http_method?: string;
};

export type CatalogIndex = {
  appzetBySlug: Map<string, AppZet>;
  superstructureById: Map<number, Superstructure>;
  superstructureBySlug: Map<string, Superstructure>;
  primitiveBySlug: Map<string, PrimitiveRow>;
  dataSourceById: Map<number, DataSourceRow>;
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
  for (const d of (catalog.data_sources ?? []) as DataSourceRow[]) {
    if (typeof d.id === 'number') dataSourceById.set(d.id, d);
  }

  return { appzetBySlug, superstructureById, superstructureBySlug, primitiveBySlug, dataSourceById };
}
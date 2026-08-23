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
  /**
   * When set, this source reads a renderer state slice instead of
   * fetching — `endpoint` is '' on such rows and the binding is the
   * discriminator. Shape: `state.<slice>.<key>`, resolved through the
   * same getters `query_params` bindings use, and expected to hold an
   * array. Used by the Search screen's recent-search list, whose four
   * per-scope histories are device-local and have no endpoint anywhere.
   */
  client_state_binding?: string | null;
  http_method?: string;
  /**
   * Declarative query-param config. Two shapes:
   *   - legacy plain map:      `{ foo: 'bar' }` — sent verbatim
   *   - source-tagged entries: `{ topic_slug: { source: 'state',
   *     binding: 'state.space_detail_controls.topic_slug', default: '' } }`
   *   - route param entries:   `{ slug: { source: 'route_param',
   *     binding: 'route.slug' } }`
   * Resolved at render time by `resolveQueryParams` in dataFetch.
   */
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
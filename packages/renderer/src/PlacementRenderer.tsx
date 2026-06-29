import { Fragment } from 'react';
import type { Superstructure } from '@appza/schemas';
import type { CatalogIndex } from './catalogIndex';
import { PrimitiveRenderer } from './PrimitiveRenderer';

type PlacementRendererProps = {
  appzetSlug: string;
  catalogIndex: CatalogIndex;
};

/**
 * Walks one placement: AppZet -> Superstructure -> children. Children
 * resolve as either Primitives (rendered as Ionic React widgets) or
 * nested Superstructures (recursed). Depth cap = 4 to keep us safe
 * against catalog cycles; DC#10 Q6's 3-level cap is enforced upstream
 * at admin POST, this is defense-in-depth.
 */
export function PlacementRenderer({ appzetSlug, catalogIndex }: PlacementRendererProps) {
  const appzet = catalogIndex.appzetBySlug.get(appzetSlug);
  if (!appzet) {
    return <MissingNode label={`unknown appzet: ${appzetSlug}`} />;
  }

  const ss = appzet.superstructure_id
    ? catalogIndex.superstructureById.get(appzet.superstructure_id)
    : undefined;
  if (!ss) {
    return <MissingNode label={`appzet ${appzet.slug} has no superstructure`} />;
  }

  return (
    <div className="appza-renderer-appzet" data-slug={appzet.slug}>
      <SuperstructureRenderer ss={ss} catalogIndex={catalogIndex} depth={0} />
    </div>
  );
}

type SuperstructureRendererProps = {
  ss: Superstructure;
  catalogIndex: CatalogIndex;
  depth: number;
};

const MAX_DEPTH = 4;

function SuperstructureRenderer({ ss, catalogIndex, depth }: SuperstructureRendererProps) {
  if (depth > MAX_DEPTH) {
    return <MissingNode label={`depth>${MAX_DEPTH} at ${ss.slug}`} />;
  }

  const children = readChildren(ss);
  if (children.length === 0) {
    return <MissingNode label={`${ss.slug} has no children`} />;
  }

  return (
    <div className="appza-renderer-ss" data-slug={ss.slug}>
      {children.map((child, idx) => (
        <Fragment key={`${child.slug}:${idx}`}>
          {renderChild(child.slug, catalogIndex, depth + 1)}
        </Fragment>
      ))}
    </div>
  );
}

function renderChild(slug: string, catalogIndex: CatalogIndex, depth: number) {
  const primitive = catalogIndex.primitiveBySlug.get(slug);
  if (primitive) {
    return <PrimitiveRenderer primitive={primitive} />;
  }
  const ss = catalogIndex.superstructureBySlug.get(slug);
  if (ss) {
    return <SuperstructureRenderer ss={ss} catalogIndex={catalogIndex} depth={depth} />;
  }
  return <MissingNode label={`unresolved slug: ${slug}`} />;
}

function readChildren(ss: Superstructure): Array<{ slug: string }> {
  const raw = (ss as unknown as { children?: unknown }).children;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (c && typeof c === 'object' && 'slug' in c && typeof (c as { slug: unknown }).slug === 'string') {
        return { slug: (c as { slug: string }).slug };
      }
      return null;
    })
    .filter((c): c is { slug: string } => c !== null);
}

function MissingNode({ label }: { label: string }) {
  return <div className="appza-renderer-missing">{label}</div>;
}

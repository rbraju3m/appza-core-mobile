import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';
import { openExternal } from './externalLink';

// Drawn as bespoke rows, not children: card and row counts are site settings, and children are a fixed indexed list.

type DetailRow = {
  label: string;
  value: string;
  href: string;
  icon: string;
};

type DetailCard = {
  heading: string;
  rows: DetailRow[];
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readCards(o: Record<string, unknown> | undefined): DetailCard[] {
  const raw = o?.cards;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object' && !Array.isArray(c))
    .map((c) => ({
      heading: str(c.heading),
      rows: (Array.isArray(c.rows) ? c.rows : [])
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
        .map((r) => ({ label: str(r.label), value: str(r.value), href: str(r.href), icon: str(r.icon) }))
        .filter((r) => r.value !== ''),
    }))
    .filter((c) => c.rows.length > 0);
}

export function AppzaDetailCards({ overrides }: { overrides?: Record<string, unknown> }) {
  const cards = readCards(overrides);
  if (cards.length === 0) return null;

  // Only a single-card section takes the heading override; multi-card headings are field-group names.
  const headingOverride = typeof overrides?.heading === 'string' ? overrides.heading : '';

  return (
    <div className="appza-detail-cards">
      {cards.map((card, ci) => {
        const heading = cards.length === 1 && headingOverride ? headingOverride : card.heading;
        return (
          <div className="appza-detail-card" key={`${heading}-${ci}`}>
            {heading ? <div className="appza-detail-card-heading">{heading}</div> : null}
            {card.rows.map((row, ri) => {
              const glyph = row.icon ? resolveIcon(row.icon) : undefined;
              const value = row.href ? (
                <a
                  className="appza-detail-card-link"
                  href={row.href}
                  onClick={(e) => {
                    e.preventDefault();
                    openExternal(row.href);
                  }}
                >
                  {row.value}
                </a>
              ) : (
                <span className="appza-detail-card-value">{row.value}</span>
              );
              return (
                <div
                  className={'appza-detail-card-row' + (row.label ? ' has-label' : '') + (glyph ? ' has-icon' : '')}
                  key={`${row.label}-${ri}`}
                >
                  {glyph ? <IonIcon className="appza-detail-card-icon" icon={glyph} /> : null}
                  {row.label ? <span className="appza-detail-card-label">{row.label}</span> : null}
                  {value}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

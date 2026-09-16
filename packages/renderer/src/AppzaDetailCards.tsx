import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';

/**
 * Read-only cards of rows — the profile's Additional information and
 * Social Link sections, designs 1 and 41.
 *
 * ---------------------------------------------------------------------
 * One component for two sections
 * ---------------------------------------------------------------------
 *
 * Both are "a heading, then rows". A custom-field row is a grey label
 * over a value; a social row is a glyph beside a handle; either may be a
 * link. The difference is entirely in the DATA — which keys a row
 * carries — so one component draws both and each section is only an
 * AppZet binding a different list.
 *
 * Everything that varies per site is shaped server-side: how many cards,
 * which fields a viewer may see, how a date or a multiselect reads, and
 * which ionicon stands for which provider. This file only draws.
 *
 * ---------------------------------------------------------------------
 * Why not children
 * ---------------------------------------------------------------------
 *
 * The number of cards and of rows in each is a site setting, and a
 * Superstructure's children are a fixed list addressed by index — the
 * reason the edit form's two sections are bespoke too.
 */

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

/**
 * Opens a link the way the rest of the app does — in the system browser
 * rather than inside the webview, which on a device would replace the app
 * with the page and leave no way back.
 */
function openExternal(href: string): void {
  if (typeof window === 'undefined' || !href) return;
  window.open(href, '_blank', 'noopener,noreferrer');
}

export function AppzaDetailCards({ overrides }: { overrides?: Record<string, unknown> }) {
  const cards = readCards(overrides);
  // An empty list draws nothing — not a heading over no rows. That is the
  // doc's condition for both sections: they come only when the site has
  // the feature on AND the member has filled something in.
  if (cards.length === 0) return null;

  // One heading override for single-card sections. The Social Link card's
  // title is the app's word, not a field group's name, so the right panel
  // owns it; a multi-card section's headings are its group names and are
  // left alone.
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

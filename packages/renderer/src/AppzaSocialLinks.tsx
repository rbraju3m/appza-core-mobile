import { useEffect, useRef } from 'react';

/**
 * The edit form's Social Links card — design 40.
 *
 * ---------------------------------------------------------------------
 * Why this is one primitive and not a row of children
 * ---------------------------------------------------------------------
 *
 * The number of rows is a SITE SETTING: FluentCommunity ships eleven
 * providers and a site enables whichever it wants, so the card is four
 * rows here and one on the next install. A Superstructure's children are
 * a fixed list addressed by index — every field mapping, every visibility
 * property and the save's `param_map` name `children[N]` — so a variable
 * number of them has no expression there at all.
 *
 * The other half is the row's SHAPE. Each is a label, a grey prefix box
 * carrying the provider's domain, and the handle field; the existing
 * variadic template stamps ONE element per item, which is enough for a
 * tab strip and not for this.
 *
 * ---------------------------------------------------------------------
 * The inputs are real, and the save reads them from the DOM
 * ---------------------------------------------------------------------
 *
 * Deliberately NOT controlled against a store slice. Everything else on
 * this form seeds from the payload and then lets the DOM own the value,
 * which is how `profile.save` collects it — a slice here would mean the
 * one card on the screen that the collector cannot see, and both halves
 * of that cost a feature (P: controlled fields and the DOM).
 *
 * So each field carries `data-appza-social-provider`, and the save
 * gathers them by that attribute into the `social_links` object
 * FluentCommunity wants: provider key to bare handle, never a URL.
 */

export type SocialLinkField = {
  key: string;
  label: string;
  /** Drawn as the grey prefix. FluentCommunity never stores it. */
  domain: string;
  placeholder: string;
  value: string;
};

/** Marks a field the save collects. One place, so both halves agree. */
export const SOCIAL_PROVIDER_ATTR = 'data-appza-social-provider';

function readString(o: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = o?.[key];
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function readFields(o: Record<string, unknown> | undefined): SocialLinkField[] {
  const raw = o?.fields;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object' && !Array.isArray(f))
    .map((f) => ({
      key: typeof f.key === 'string' ? f.key : '',
      label: typeof f.label === 'string' ? f.label : '',
      domain: typeof f.domain === 'string' ? f.domain : '',
      placeholder: typeof f.placeholder === 'string' ? f.placeholder : '',
      value: typeof f.value === 'string' ? f.value : '',
    }))
    .filter((f) => f.key !== '');
}

export function AppzaSocialLinks({ overrides }: { overrides?: Record<string, unknown> }) {
  const fields = readFields(overrides);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seeded = useRef(false);

  // SEEDED once, then the DOM owns it — the same contract SeededIonInput
  // keeps for every other field on this form. Re-seeding on each render
  // would overwrite what the member is typing the moment anything else
  // on the screen re-renders.
  useEffect(() => {
    if (seeded.current || !rootRef.current || fields.length === 0) return;
    seeded.current = true;
    for (const field of fields) {
      const input = rootRef.current.querySelector(
        `[${SOCIAL_PROVIDER_ATTR}="${field.key}"]`,
      ) as HTMLInputElement | null;
      if (input) input.value = field.value;
    }
  }, [fields]);

  // A site with no providers enabled draws no card at all, rather than a
  // heading over nothing. The doc's condition for this whole section.
  if (fields.length === 0) return null;

  const heading = readString(overrides, 'heading') ?? 'Social Links';
  const description = readString(overrides, 'description') ?? 'Add your social media profile link.';

  return (
    <div className="appza-social-links" ref={rootRef}>
      <div className="appza-social-links-heading">{heading}</div>
      <div className="appza-social-links-description">{description}</div>
      {fields.map((field) => (
        <div className="appza-social-links-row" key={field.key}>
          <label className="appza-social-links-label" htmlFor={`appza-social-${field.key}`}>
            {field.label}
          </label>
          <div className="appza-social-links-control">
            {field.domain ? (
              <span className="appza-social-links-domain">{field.domain}</span>
            ) : null}
            <input
              id={`appza-social-${field.key}`}
              className="appza-social-links-input"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={field.placeholder}
              defaultValue={field.value}
              {...{ [SOCIAL_PROVIDER_ATTR]: field.key }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Every social handle currently on screen, as FluentCommunity's
 * `social_links` object.
 *
 * EVERY enabled provider is included, empty ones too. That is what makes
 * clearing a link work: `updateProfile` skips the whole block when the
 * object is falsy, then `array_filter`s what it gets — so sending only
 * the filled ones can never remove the last remaining link, and sending
 * all of them removes exactly the ones the member emptied.
 *
 * Read from the document rather than from one AppZet's subtree: the card
 * is its own placement, sibling to the form the save names, and there is
 * only ever one of it on a screen.
 */
export function collectSocialLinks(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const out: Record<string, string> = {};
  const inputs = document.querySelectorAll(`[${SOCIAL_PROVIDER_ATTR}]`);
  inputs.forEach((el) => {
    const key = el.getAttribute(SOCIAL_PROVIDER_ATTR);
    if (!key) return;
    out[key] = (el as HTMLInputElement).value ?? '';
  });
  return out;
}

import { useEffect, useRef } from 'react';

// Uncontrolled on purpose: profile.save collects these inputs from the DOM by SOCIAL_PROVIDER_ATTR.

export type SocialLinkField = {
  key: string;
  label: string;
  // Drawn as the prefix only; FluentCommunity stores the bare handle.
  domain: string;
  placeholder: string;
  value: string;
};

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

  // Seeded once, then the DOM owns it; re-seeding would overwrite typing on any re-render.
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

// Includes empty providers: updateProfile array_filters the object, so that is how a cleared link gets removed.
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

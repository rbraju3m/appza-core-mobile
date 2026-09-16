import { useEffect, useRef } from 'react';

/**
 * The edit form's Additional Information section — design 40, and the
 * last piece of doc state 40.
 *
 * ---------------------------------------------------------------------
 * Everything about it is a site setting
 * ---------------------------------------------------------------------
 *
 * How many CARDS, how many FIELDS in each, and what TYPE each field is
 * are all configured per site: FluentCommunity Pro offers eight types
 * across any number of author-defined groups. So neither the cards nor
 * the fields can be Superstructure children, which are a fixed list
 * addressed by index — the same reason the Social Links card is one
 * bespoke child, one step further.
 *
 * The section draws a card per group with its heading and its editing
 * description, then a labelled control per field.
 *
 * ---------------------------------------------------------------------
 * Uncontrolled, and read from the DOM
 * ---------------------------------------------------------------------
 *
 * Like every other field on this form: seeded once, then the DOM owns
 * the value and the save collects it. Each control carries
 * `data-appza-profile-field` (its slug) and `data-appza-field-type`,
 * because the save has to rebuild the typed shape FluentCommunity
 * validates against — a multiselect is an ARRAY, a number is a number,
 * and a date has to be exactly Y-m-d or Pro throws it away.
 *
 * Radio groups are the exception to "one element per field": they are
 * several inputs sharing a name, so the slug is stamped on each and the
 * collector reads whichever is checked.
 */

export type ProfileFieldOption = { value: string; label: string };

export type ProfileField = {
  slug: string;
  label: string;
  type: string;
  placeholder: string;
  options: ProfileFieldOption[];
  isRequired: boolean;
  value: unknown;
};

export type ProfileFieldGroup = {
  slug: string;
  label: string;
  description: string;
  fields: ProfileField[];
};

export const PROFILE_FIELD_ATTR = 'data-appza-profile-field';
export const PROFILE_FIELD_TYPE_ATTR = 'data-appza-field-type';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * FluentCommunity stores options two ways and the difference is the
 * type: select and radio carry a LIST of strings, where the string is
 * both the value and the label; multiselect carries a MAP of value to
 * label. Normalised here so the markup below has one shape to draw.
 */
function readOptions(raw: unknown, type: string): ProfileFieldOption[] {
  if (Array.isArray(raw)) {
    return raw.filter((o) => typeof o === 'string').map((o) => ({ value: o as string, label: o as string }));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([value, label]) => ({
      value,
      label: typeof label === 'string' ? label : value,
    }));
  }
  if (type === 'select' || type === 'radio' || type === 'multiselect') return [];
  return [];
}

function readGroups(o: Record<string, unknown> | undefined): ProfileFieldGroup[] {
  const raw = o?.groups;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object' && !Array.isArray(g))
    .map((g) => ({
      slug: str(g.slug),
      label: str(g.label),
      // FluentCommunity's own word for the line under a group heading on
      // the EDIT screen. The view screen uses a different one.
      description: str(g.edit_description),
      fields: (Array.isArray(g.fields) ? g.fields : [])
        .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object' && !Array.isArray(f))
        .map((f) => ({
          slug: str(f.slug),
          label: str(f.label),
          type: str(f.type) || 'text',
          placeholder: str(f.placeholder),
          options: readOptions(f.options, str(f.type)),
          isRequired: f.is_required === true,
          value: f.value,
        }))
        .filter((f) => f.slug !== ''),
    }))
    .filter((g) => g.fields.length > 0);
}

function Field({ field }: { field: ProfileField }) {
  const id = `appza-pf-${field.slug}`;
  const common = {
    id,
    className: 'appza-profile-fields-input',
    placeholder: field.placeholder,
    [PROFILE_FIELD_ATTR]: field.slug,
    [PROFILE_FIELD_TYPE_ATTR]: field.type,
  };

  if (field.type === 'textarea') {
    return <textarea {...common} rows={4} defaultValue={str(field.value)} />;
  }

  if (field.type === 'select') {
    return (
      <select {...common} defaultValue={str(field.value)}>
        {/* An empty first option is what lets a non-required field be
            left unanswered — a native select otherwise reports its first
            entry whether or not anybody chose it. */}
        <option value="">{field.placeholder || '—'}</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'multiselect') {
    const selected = Array.isArray(field.value) ? field.value.map(String) : [];
    return (
      <select {...common} multiple defaultValue={selected}>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'radio') {
    const current = str(field.value);
    return (
      <div className="appza-profile-fields-radios">
        {field.options.map((o) => (
          <label className="appza-profile-fields-radio" key={o.value}>
            <input
              type="radio"
              name={id}
              value={o.value}
              defaultChecked={current === o.value}
              {...{ [PROFILE_FIELD_ATTR]: field.slug, [PROFILE_FIELD_TYPE_ATTR]: field.type }}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  // text, number, date and url all map to a native input. `date` gets the
  // native picker, which yields exactly the Y-m-d FluentCommunity Pro
  // demands — anything else it silently discards.
  const nativeType =
    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text';

  return (
    <input
      {...common}
      type={nativeType}
      autoCapitalize={nativeType === 'text' ? undefined : 'none'}
      defaultValue={str(field.value) || (typeof field.value === 'number' ? String(field.value) : '')}
    />
  );
}

export function AppzaProfileFields({ overrides }: { overrides?: Record<string, unknown> }) {
  const groups = readGroups(overrides);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seeded = useRef(false);

  // Seeded once. A multiple <select> cannot express its selection through
  // defaultValue reliably across re-renders, so it is set imperatively —
  // and re-running this on every render would undo what the member is
  // choosing.
  useEffect(() => {
    if (seeded.current || !rootRef.current || groups.length === 0) return;
    seeded.current = true;
    for (const group of groups) {
      for (const field of group.fields) {
        if (field.type !== 'multiselect') continue;
        const el = rootRef.current.querySelector(
          `select[${PROFILE_FIELD_ATTR}="${field.slug}"]`,
        ) as HTMLSelectElement | null;
        if (!el) continue;
        const wanted = new Set((Array.isArray(field.value) ? field.value : []).map(String));
        for (const option of Array.from(el.options)) option.selected = wanted.has(option.value);
      }
    }
  }, [groups]);

  // A site with the feature off, or with no fields this viewer may see,
  // draws nothing at all — not a heading over an empty card.
  if (groups.length === 0) return null;

  return (
    <div className="appza-profile-fields" ref={rootRef}>
      {groups.map((group) => (
        <div className="appza-profile-fields-group" key={group.slug}>
          <div className="appza-profile-fields-heading">{group.label}</div>
          {group.description ? (
            <div className="appza-profile-fields-description">{group.description}</div>
          ) : null}
          {group.fields.map((field) => (
            <div className="appza-profile-fields-row" key={field.slug}>
              <label className="appza-profile-fields-label" htmlFor={`appza-pf-${field.slug}`}>
                {field.label}
                {field.isRequired ? <span className="appza-profile-fields-required"> *</span> : null}
              </label>
              <Field field={field} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Every custom field on screen, in the shape FluentCommunity Pro
 * validates against.
 *
 * The types matter and are not cosmetic: `sanitizeFieldValue` returns an
 * empty array for a multiselect that is not an ARRAY, an empty string for
 * a number that is not numeric, and an empty string for a date that is
 * not exactly Y-m-d. Sending the DOM's strings for all of them would
 * quietly blank half the section on every save.
 */
export function collectProfileFields(): Record<string, unknown> {
  if (typeof document === 'undefined') return {};
  const out: Record<string, unknown> = {};

  document.querySelectorAll(`[${PROFILE_FIELD_ATTR}]`).forEach((el) => {
    const slug = el.getAttribute(PROFILE_FIELD_ATTR);
    const type = el.getAttribute(PROFILE_FIELD_TYPE_ATTR) ?? 'text';
    if (!slug) return;

    if (type === 'radio') {
      const input = el as HTMLInputElement;
      // Several inputs share one slug; only the checked one answers, and
      // an untouched group answers with an empty string rather than not
      // at all — otherwise clearing a radio would be impossible.
      if (input.checked) out[slug] = input.value;
      else if (!(slug in out)) out[slug] = '';
      return;
    }

    if (type === 'multiselect') {
      const select = el as HTMLSelectElement;
      out[slug] = Array.from(select.selectedOptions).map((o) => o.value);
      return;
    }

    const value = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value ?? '';
    if (type === 'number') {
      // '' stays '' — Pro reads a non-numeric as empty, and sending 0 for
      // a field nobody filled in would invent an answer.
      out[slug] = value === '' ? '' : Number(value);
      return;
    }
    out[slug] = value;
  });

  return out;
}

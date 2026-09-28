import { useEffect, useRef } from 'react';

// Uncontrolled: the save reads values from the DOM and rebuilds FC Pro's typed shape from PROFILE_FIELD_TYPE_ATTR.

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

// FC stores select/radio options as a list of strings and multiselect options as a value-to-label map.
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
      // FC's own key for the line under a group heading on the edit screen.
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
        {/* An empty first option lets a non-required field stay unanswered. */}
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

  // A native date input yields exactly the Y-m-d FC Pro demands.
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

  // A multiple <select> can't hold its selection via defaultValue across re-renders, so it is seeded imperatively, once.
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

// Types matter: FC Pro's sanitizeFieldValue blanks a non-array multiselect, a non-numeric number and a non-Y-m-d date.
export function collectProfileFields(): Record<string, unknown> {
  if (typeof document === 'undefined') return {};
  const out: Record<string, unknown> = {};

  document.querySelectorAll(`[${PROFILE_FIELD_ATTR}]`).forEach((el) => {
    const slug = el.getAttribute(PROFILE_FIELD_ATTR);
    const type = el.getAttribute(PROFILE_FIELD_TYPE_ATTR) ?? 'text';
    if (!slug) return;

    if (type === 'radio') {
      const input = el as HTMLInputElement;
      // An unchecked group still sends '', otherwise a radio could never be cleared.
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
      // '' stays '': sending 0 would invent an answer.
      out[slug] = value === '' ? '' : Number(value);
      return;
    }
    out[slug] = value;
  });

  return out;
}

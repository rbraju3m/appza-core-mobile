/**
 * DC#13 Q2 override resolution — Layer 1 (catalog default) + Layer 2
 * (customer override). Layer 3 (runtime user-interaction for query_params /
 * action.params.runtime) belongs to the runtime data layer and is not in
 * scope here.
 *
 * Wire shape of `customizations` (per the WP plug-in's bootstrap envelope):
 *
 *   { scope: { target_key: { column: override_value } } }
 *
 * target_key is the target_slug for single-target scopes, the composite
 * for placement scope, or empty string for global. We accept any value
 * (the renderer never trusts shape here — defensive read).
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns the raw override_value if one is set for (scope, target_key, column),
 * otherwise undefined. The renderer interprets undefined as "no override —
 * use catalog default."
 */
export function readOverride(
  customizations: unknown,
  scope: string,
  targetKey: string,
  column: string,
): unknown {
  if (!isRecord(customizations)) return undefined;
  const byScope = customizations[scope];
  if (!isRecord(byScope)) return undefined;
  const byTarget = byScope[targetKey];
  if (!isRecord(byTarget)) return undefined;
  return byTarget[column];
}

/**
 * P26 Part 4 + DC#13 Q2 leaf-level REPLACE for object-shaped (leaf-bag)
 * columns. For each top-level key in the override:
 *  - If both sides are records, recurse (deep merge at the leaf).
 *  - Otherwise replace whole-value.
 * This preserves catalog leaves the customer didn't override.
 *
 * For non-object catalog values, the override replaces wholesale (no
 * partial merge possible).
 */
export function resolveOverridableColumn(
  customizations: unknown,
  scope: string,
  targetKey: string,
  column: string,
  catalogValue: unknown,
): unknown {
  const override = readOverride(customizations, scope, targetKey, column);
  if (override === undefined) return catalogValue;
  if (isRecord(catalogValue) && isRecord(override)) {
    return leafLevelMerge(catalogValue, override);
  }
  return override;
}

export function leafLevelMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = out[key];
    if (isRecord(value) && isRecord(baseValue)) {
      out[key] = leafLevelMerge(baseValue, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

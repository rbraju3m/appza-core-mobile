export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

/** Deep-merges record leaves so catalog leaves the customer didn't override survive. */
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

import type { CSSProperties } from 'react';
import { isRecord } from './resolveOverride';

export function tokensToCssVars(tokens: unknown): CSSProperties {
  if (!isRecord(tokens)) return {};
  const out: Record<string, string> = {};

  const color = isRecord(tokens.color) ? tokens.color : null;
  if (color) {
    for (const [name, value] of Object.entries(color)) {
      if (typeof value === 'string' && value.length > 0) {
        out[`--ion-color-${name}`] = value;
        out[`--ion-color-${name}-shade`] = value;
        out[`--ion-color-${name}-tint`] = value;
      }
    }
    if (typeof color.background === 'string') {
      out['--ion-background-color'] = color.background;
    }
    if (typeof color.text === 'string') {
      out['--ion-text-color'] = color.text;
    }
  }

  const typography = isRecord(tokens.typography) ? tokens.typography : null;
  if (typography) {
    if (typeof typography.fontFamily === 'string') {
      out['--ion-font-family'] = typography.fontFamily;
    }
  }

  return out as CSSProperties;
}

import type { CSSProperties } from 'react';
import { isRecord } from './resolveOverride';

/**
 * Map APPZA token bags to Ionic CSS custom properties. Tokens follow the
 * DC#09 4-category shape:
 *
 *   { color: { primary, secondary, tertiary, success, warning, danger, ... },
 *     typography: { fontFamily, fontSize, ... },
 *     spacing: { ... },
 *     border_radius: { ... } }
 *
 * v1 mapping covers the most visually obvious knobs (Ionic colors + font
 * family). Additional tokens land additively per P25 as the renderer
 * grows. Unknown keys are ignored — never throw.
 *
 * Returned object is shaped for React's `style={...}` prop. CSS variables
 * use kebab-case names and are valid CSS custom-prop strings; React 18
 * accepts `style={{ '--ion-color-primary': '#22c55e' }}` because the
 * extra-props pass-through is documented.
 */
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

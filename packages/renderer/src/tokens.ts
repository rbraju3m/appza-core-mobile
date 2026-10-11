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

  // Every block's look (D118): unset keys stamp nothing, so the stylesheet keeps its own values.
  const theme = isRecord(tokens.theme) ? tokens.theme : null;
  if (theme) {
    for (const key of THEME_COLORS) {
      const v = theme[key];
      if (typeof v === 'string' && v.length > 0) out[`--appza-theme-${key}`] = v;
    }
    for (const key of THEME_SCALES) {
      const v = theme[key];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[`--appza-theme-${key.replace(/_/g, '-')}`] = String(v);
    }
  }

  return out as CSSProperties;
}

const THEME_COLORS = ['surface', 'heading', 'body', 'muted', 'border', 'accent'] as const;
const THEME_SCALES = ['radius_scale', 'text_scale'] as const;

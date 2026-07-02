import type { CSSProperties } from 'react';
import type { LayoutStyle } from '@appza/schemas';

/**
 * Converts a LayoutStyle (author-declared, JSON-serialisable knobs) into
 * a React CSSProperties object suitable for inline `style={}` on the
 * primitive wrapper element.
 *
 * Numeric values are treated as pixels; strings pass through untouched
 * so callers can express `%`, `rem`, `auto`, etc. Undefined branches
 * produce no CSS at all — leaving the browser / Ionic default in place.
 */
export function layoutStyleToCss(ls: LayoutStyle | undefined): CSSProperties {
  if (!ls) return {};
  const s: CSSProperties = {};

  if (ls.padding) {
    if (ls.padding.top !== undefined) s.paddingTop = px(ls.padding.top);
    if (ls.padding.right !== undefined) s.paddingRight = px(ls.padding.right);
    if (ls.padding.bottom !== undefined) s.paddingBottom = px(ls.padding.bottom);
    if (ls.padding.left !== undefined) s.paddingLeft = px(ls.padding.left);
  }
  if (ls.margin) {
    if (ls.margin.top !== undefined) s.marginTop = px(ls.margin.top);
    if (ls.margin.right !== undefined) s.marginRight = px(ls.margin.right);
    if (ls.margin.bottom !== undefined) s.marginBottom = px(ls.margin.bottom);
    if (ls.margin.left !== undefined) s.marginLeft = px(ls.margin.left);
  }
  if (ls.border) {
    applyBorderSide(s, 'Top', ls.border.top);
    applyBorderSide(s, 'Right', ls.border.right);
    applyBorderSide(s, 'Bottom', ls.border.bottom);
    applyBorderSide(s, 'Left', ls.border.left);
  }
  if (ls.borderRadius) {
    if (ls.borderRadius.tl !== undefined) s.borderTopLeftRadius = px(ls.borderRadius.tl);
    if (ls.borderRadius.tr !== undefined) s.borderTopRightRadius = px(ls.borderRadius.tr);
    if (ls.borderRadius.br !== undefined) s.borderBottomRightRadius = px(ls.borderRadius.br);
    if (ls.borderRadius.bl !== undefined) s.borderBottomLeftRadius = px(ls.borderRadius.bl);
  }
  if (ls.width !== undefined) s.width = dim(ls.width);
  if (ls.height !== undefined) s.height = dim(ls.height);
  if (ls.minWidth !== undefined) s.minWidth = dim(ls.minWidth);
  if (ls.minHeight !== undefined) s.minHeight = dim(ls.minHeight);
  if (ls.maxWidth !== undefined) s.maxWidth = dim(ls.maxWidth);
  if (ls.maxHeight !== undefined) s.maxHeight = dim(ls.maxHeight);
  if (ls.backgroundColor !== undefined) s.backgroundColor = ls.backgroundColor;
  if (ls.color !== undefined) s.color = ls.color;

  if (ls.font) {
    if (ls.font.family !== undefined) s.fontFamily = ls.font.family;
    if (ls.font.size !== undefined) s.fontSize = px(ls.font.size);
    if (ls.font.weight !== undefined) s.fontWeight = ls.font.weight;
    if (ls.font.lineHeight !== undefined) s.lineHeight = ls.font.lineHeight;
    if (ls.font.letterSpacing !== undefined) s.letterSpacing = px(ls.font.letterSpacing);
  }
  if (ls.textAlign !== undefined) s.textAlign = ls.textAlign;

  if (ls.flex) {
    // Any flex knob implies flex display — spare callers from setting it
    // explicitly. If they set display via a future knob, we lose to them
    // by insertion order (React style objects don't collide predictably;
    // this is the common case).
    s.display = 'flex';
    if (ls.flex.direction !== undefined) s.flexDirection = ls.flex.direction;
    if (ls.flex.wrap !== undefined) s.flexWrap = ls.flex.wrap;
    if (ls.flex.grow !== undefined) s.flexGrow = ls.flex.grow;
    if (ls.flex.shrink !== undefined) s.flexShrink = ls.flex.shrink;
    if (ls.flex.basis !== undefined) s.flexBasis = dim(ls.flex.basis);
    if (ls.flex.gap !== undefined) s.gap = px(ls.flex.gap);
    if (ls.flex.justifyContent !== undefined) s.justifyContent = ls.flex.justifyContent;
    if (ls.flex.alignItems !== undefined) s.alignItems = ls.flex.alignItems;
  }
  if (ls.alignSelf !== undefined) s.alignSelf = ls.alignSelf;
  if (ls.opacity !== undefined) s.opacity = ls.opacity;
  if (ls.boxShadow !== undefined) s.boxShadow = ls.boxShadow;

  return s;
}

/** True when the object would produce at least one CSS property. */
export function hasLayoutStyle(ls: LayoutStyle | undefined): boolean {
  if (!ls) return false;
  return Object.keys(ls).length > 0;
}

function px(n: number): string {
  return `${n}px`;
}

function dim(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v;
}

function applyBorderSide(
  s: CSSProperties,
  side: 'Top' | 'Right' | 'Bottom' | 'Left',
  b: { width?: number; style?: 'solid' | 'dashed' | 'dotted' | 'double'; color?: string } | undefined,
) {
  if (!b) return;
  if (b.width !== undefined) {
    (s as Record<string, unknown>)[`border${side}Width`] = px(b.width);
    // A width without an explicit style renders as `none` by CSS default;
    // pick `solid` so a naked width knob still draws a line.
    if (b.style === undefined && b.width > 0) {
      (s as Record<string, unknown>)[`border${side}Style`] = 'solid';
    }
  }
  if (b.style !== undefined) (s as Record<string, unknown>)[`border${side}Style`] = b.style;
  if (b.color !== undefined) (s as Record<string, unknown>)[`border${side}Color`] = b.color;
}

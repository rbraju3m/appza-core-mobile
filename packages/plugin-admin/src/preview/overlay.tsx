import { useEffect } from 'react';
import {
  MediaViewer,
  OptionsSheet,
  OverlayDesignStyle,
  PostOptionsPopover,
  ScheduleSheet,
  mediaViewerPresentation,
  openMediaViewer,
  openOptionsSheet,
  openPostOptionsPopover,
  openScheduleSheet,
  optionsSheetPresentation,
  postMenuSheetPresentation,
  schedulePresentation,
  withOverlayBlockDefaults,
} from '@appza/renderer';
import type { Catalog } from '@appza/schemas';

// An AppZet riding a shared overlay block is opened by an action, never placed on a screen, so drawing it in place
// showed loose pieces. Core's preview opens the real overlay instead, with sample rows (R3e). FC's overlays keep
// their old preview.

export type OverlayShape = 'options-sheet' | 'action-menu' | 'date-time-sheet' | 'media-viewer';

const SHAPES: readonly OverlayShape[] = ['options-sheet', 'action-menu', 'date-time-sheet', 'media-viewer'];

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

function appzetOf(catalog: Catalog, slug: string): Row | undefined {
  return ((catalog.appzets ?? []) as unknown[]).find((a): a is Row => isRow(a) && a.slug === slug);
}

export function overlayShapeOf(catalog: Catalog, appzetSlug: string): OverlayShape | null {
  const appzet = appzetOf(catalog, appzetSlug);
  const block = ((catalog.superstructures ?? []) as unknown[]).find(
    (s): s is Row => isRow(s) && s.id === appzet?.superstructure_id,
  );
  const slug = typeof block?.slug === 'string' ? block.slug : '';
  return (SHAPES as readonly string[]).includes(slug) ? (slug as OverlayShape) : null;
}

const photo = (fill: string, label: string) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${fill}"/><text x="200" y="160" font-family="system-ui,sans-serif" font-size="28" fill="#fff" text-anchor="middle">${label}</text></svg>`,
  );

function open(shape: OverlayShape, slug: string, props: Row): void {
  switch (shape) {
    case 'options-sheet':
      openOptionsSheet({
        appzetSlug: slug,
        presentation: optionsSheetPresentation(props),
        options: [
          { value: 'newest', label: 'Newest first', icon: 'time-outline' },
          { value: 'oldest', label: 'Oldest first', icon: 'time-outline' },
          { value: 'title', label: 'By title', icon: 'list-outline' },
        ],
        stateKey: 'sort',
        currentValue: 'newest',
        onPick: () => undefined,
      });
      return;
    case 'action-menu':
      openPostOptionsPopover(
        [
          { action_slug: 'preview.none', label: 'Copy link', icon: 'link-outline' },
          { action_slug: 'preview.none', label: 'Edit', icon: 'create-outline' },
          { action_slug: 'preview.none', label: 'Delete', icon: 'trash-outline', destructive: true },
        ],
        {},
        null,
        { appzetSlug: slug, presentation: postMenuSheetPresentation(props) },
      );
      return;
    case 'date-time-sheet':
      openScheduleSheet({ appzetSlug: slug, presentation: schedulePresentation(props) });
      return;
    case 'media-viewer':
      openMediaViewer({
        appzetSlug: slug,
        items: [
          { url: photo('#64748b', 'Photo 1'), title: 'Photo 1' },
          { url: photo('#0f766e', 'Photo 2'), title: 'Photo 2' },
          { url: photo('#9333ea', 'Photo 3'), title: 'Photo 3' },
        ],
        index: 0,
        presentation: mediaViewerPresentation(props),
      });
  }
}

// Taps in the preview do nothing; here they would also close the overlay, leaving an empty page.
const swallow = (e: Event) => {
  e.stopPropagation();
  if (e.type === 'click') e.preventDefault();
};

export function OverlayPreview({ catalog, appzetSlug, shape }: { catalog: Catalog; appzetSlug: string; shape: OverlayShape }) {
  const own = appzetOf(catalog, appzetSlug)?.default_props_override;
  const props = withOverlayBlockDefaults(catalog, appzetSlug, isRow(own) ? own : {});
  const key = JSON.stringify(props);

  useEffect(() => {
    // After the overlays below have mounted and are listening.
    const t = setTimeout(() => open(shape, appzetSlug, JSON.parse(key) as Row), 0);
    return () => clearTimeout(t);
  }, [shape, appzetSlug, key]);

  useEffect(() => {
    const kinds = ['click', 'mousedown', 'touchstart', 'keydown'];
    kinds.forEach((k) => window.addEventListener(k, swallow, true));
    return () => kinds.forEach((k) => window.removeEventListener(k, swallow, true));
  }, []);

  return (
    <>
      <OverlayDesignStyle catalog={catalog} />
      <OptionsSheet />
      <PostOptionsPopover />
      <ScheduleSheet />
      <MediaViewer />
    </>
  );
}

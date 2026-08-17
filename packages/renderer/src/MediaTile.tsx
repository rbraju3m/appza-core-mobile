import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';

/**
 * One tile in the MEDIA sub-tab's photo / video grid.
 *
 * Why this is a bespoke primitive rather than an ion-img: a video has no
 * thumbnail to show. FluentCommunity generates no posters, and the
 * gallery payload's `settings.posterSrc` is empty for every row we have,
 * so the only route to a first frame is a real <video preload="metadata">
 * element — which is exactly what the FluentCommunity portal does on the
 * same screen.
 *
 * The element is chosen from `kind`, never from `media_type`: videos and
 * audio share media_type 'fluent_player' upstream and are split by
 * settings.viewType, which the API has already resolved into `kind` for
 * us.
 *
 * Tapping is handled by the wrapper the PlacementRenderer puts around
 * this (the AppZet's on_tap_tile action), so there is no click handler
 * here — a photo opens the viewer, a video goes to its post, and the
 * dispatcher branches on kind.
 */

export type MediaTileKind = 'image' | 'video' | 'audio';

function str(overrides: Record<string, unknown> | undefined, key: string): string {
  const v = overrides?.[key];
  return typeof v === 'string' ? v : '';
}

function bool(
  overrides: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const v = overrides?.[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function AppzaMediaTile({ overrides }: { overrides?: Record<string, unknown> }) {
  const url = str(overrides, 'url');
  const kind = str(overrides, 'kind') || 'image';
  const poster = str(overrides, 'poster');
  const alt = str(overrides, 'alt');
  const showPlayBadge = bool(overrides, 'show_play_badge', true);
  const playIcon = resolveIcon(str(overrides, 'play_icon') || 'play');

  // A tile with no URL would render an empty box with a broken-image
  // glyph. The list already hides itself when there are no rows, so this
  // only fires on a malformed row — draw the plain surface instead.
  if (url === '') {
    return <span className="appza-media-tile appza-media-tile-empty" aria-hidden="true" />;
  }

  const isVideo = kind === 'video';

  return (
    <span className="appza-media-tile" data-kind={kind}>
      {isVideo && poster === '' ? (
        <video
          className="appza-media-tile-media"
          src={url}
          // metadata only: enough for the browser to paint a first frame,
          // without pulling the whole file down for a thumbnail.
          preload="metadata"
          muted
          playsInline
          // Not a player — the tap navigates to the post. Controls would
          // invite a play that never happens.
          controls={false}
          aria-label={alt || undefined}
        />
      ) : (
        <img
          className="appza-media-tile-media"
          src={isVideo ? poster : url}
          alt={alt}
          loading="lazy"
        />
      )}
      {isVideo && showPlayBadge && playIcon && (
        <span className="appza-media-tile-play" aria-hidden="true">
          <IonIcon icon={playIcon} />
        </span>
      )}
    </span>
  );
}

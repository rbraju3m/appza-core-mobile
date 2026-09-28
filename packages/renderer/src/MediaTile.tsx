import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';

// FC generates no video posters; a <video preload="metadata"> is the only way to get a first frame.

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
          preload="metadata"
          muted
          playsInline
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

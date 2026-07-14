import { useEffect, useState } from 'react';
import {
  IonAvatar,
  IonButton,
  IonChip,
  IonCheckbox,
  IonIcon,
  IonImg,
  IonInput,
  IonLabel,
  IonList,
  IonRadio,
  IonRadioGroup,
  IonText,
  IonTextarea,
} from '@ionic/react';
import {
  add,
  addCircle,
  addCircleOutline,
  alertCircle,
  alertCircleOutline,
  apps,
  arrowBack,
  arrowForward,
  bag,
  bagOutline,
  book,
  bookmark,
  bookmarkOutline,
  calendar,
  calendarOutline,
  call,
  callOutline,
  camera,
  cameraOutline,
  card,
  cardOutline,
  cart,
  cartOutline,
  cash,
  cashOutline,
  chatbubble,
  chatbubbleOutline,
  chatbubbles,
  chatbubblesOutline,
  checkmark,
  checkmarkCircle,
  checkmarkCircleOutline,
  chevronBack,
  chevronDown,
  chevronForward,
  chevronUp,
  close,
  closeCircle,
  closeCircleOutline,
  create,
  createOutline,
  ellipsisHorizontal,
  ellipsisVertical,
  filter,
  filterOutline,
  heart,
  heartOutline,
  home,
  homeOutline,
  image,
  imageOutline,
  images,
  imagesOutline,
  informationCircle,
  informationCircleOutline,
  library,
  libraryOutline,
  location,
  locationOutline,
  mail,
  mailOutline,
  menu,
  menuOutline,
  mic,
  micOutline,
  notifications,
  notificationsOutline,
  pauseCircle,
  pauseCircleOutline,
  people,
  peopleOutline,
  person,
  personOutline,
  playCircle,
  playCircleOutline,
  pricetag,
  pricetagOutline,
  receipt,
  receiptOutline,
  refresh,
  refreshOutline,
  ribbon,
  ribbonOutline,
  school,
  schoolOutline,
  search,
  searchOutline,
  send,
  settings,
  settingsOutline,
  share,
  shareOutline,
  star,
  starOutline,
  statsChart,
  statsChartOutline,
  storefront,
  storefrontOutline,
  thumbsUp,
  thumbsUpOutline,
  time,
  timeOutline,
  trash,
  trashOutline,
  videocam,
  videocamOutline,
  wallet,
  walletOutline,
  warning,
  warningOutline,
} from 'ionicons/icons';
import type { PrimitiveRow } from './catalogIndex';

/**
 * Explicit icon registry. Using `import * as icons from 'ionicons/icons'`
 * + dynamic `icons[name]` access causes Vite/Rollup to tree-shake the
 * icon SVG strings to nothing (no static reference). Each icon used by
 * the catalog must appear here so the bundler keeps it.
 *
 * Grouped by lens (utility / status / social / comm / media / time-place
 * / e-commerce / LMS) for maintainability. Groups are cosmetic — the
 * `iconNames` export flattens + sorts, so downstream consumers (the
 * plug-in-admin icon picker) see one alphabetical list regardless.
 * Add new icons to the closest lens; open a new group when a Source
 * Integration onboards its own set.
 */
const ICON_REGISTRY: Record<string, string> = {
  // General / utility
  add,
  'add-circle': addCircle,
  'add-circle-outline': addCircleOutline,
  apps,
  'arrow-back': arrowBack,
  'arrow-forward': arrowForward,
  book,
  'chevron-back': chevronBack,
  'chevron-down': chevronDown,
  'chevron-forward': chevronForward,
  'chevron-up': chevronUp,
  create,
  'create-outline': createOutline,
  'ellipsis-horizontal': ellipsisHorizontal,
  'ellipsis-vertical': ellipsisVertical,
  filter,
  'filter-outline': filterOutline,
  menu,
  'menu-outline': menuOutline,
  refresh,
  'refresh-outline': refreshOutline,
  settings,
  'settings-outline': settingsOutline,
  trash,
  'trash-outline': trashOutline,

  // Status / alerts
  'alert-circle': alertCircle,
  'alert-circle-outline': alertCircleOutline,
  checkmark,
  'checkmark-circle': checkmarkCircle,
  'checkmark-circle-outline': checkmarkCircleOutline,
  close,
  'close-circle': closeCircle,
  'close-circle-outline': closeCircleOutline,
  'information-circle': informationCircle,
  'information-circle-outline': informationCircleOutline,
  warning,
  'warning-outline': warningOutline,

  // Social / community
  bookmark,
  'bookmark-outline': bookmarkOutline,
  chatbubble,
  'chatbubble-outline': chatbubbleOutline,
  chatbubbles,
  'chatbubbles-outline': chatbubblesOutline,
  heart,
  'heart-outline': heartOutline,
  home,
  'home-outline': homeOutline,
  notifications,
  'notifications-outline': notificationsOutline,
  people,
  'people-outline': peopleOutline,
  person,
  'person-outline': personOutline,
  search,
  'search-outline': searchOutline,
  send,
  share,
  'share-outline': shareOutline,
  star,
  'star-outline': starOutline,
  'stats-chart': statsChart,
  'stats-chart-outline': statsChartOutline,
  'thumbs-up': thumbsUp,
  'thumbs-up-outline': thumbsUpOutline,

  // Communication
  call,
  'call-outline': callOutline,
  mail,
  'mail-outline': mailOutline,

  // Media
  camera,
  'camera-outline': cameraOutline,
  image,
  'image-outline': imageOutline,
  images,
  'images-outline': imagesOutline,
  mic,
  'mic-outline': micOutline,
  'pause-circle': pauseCircle,
  'pause-circle-outline': pauseCircleOutline,
  'play-circle': playCircle,
  'play-circle-outline': playCircleOutline,
  videocam,
  'videocam-outline': videocamOutline,

  // Time / place
  calendar,
  'calendar-outline': calendarOutline,
  location,
  'location-outline': locationOutline,
  time,
  'time-outline': timeOutline,

  // E-commerce (WooCommerce lens)
  bag,
  'bag-outline': bagOutline,
  card,
  'card-outline': cardOutline,
  cart,
  'cart-outline': cartOutline,
  cash,
  'cash-outline': cashOutline,
  pricetag,
  'pricetag-outline': pricetagOutline,
  receipt,
  'receipt-outline': receiptOutline,
  storefront,
  'storefront-outline': storefrontOutline,
  wallet,
  'wallet-outline': walletOutline,

  // LMS (TutorLMS lens)
  library,
  'library-outline': libraryOutline,
  ribbon,
  'ribbon-outline': ribbonOutline,
  school,
  'school-outline': schoolOutline,
};

/** Public list of known icon names — consumed by the plug-in admin's
 *  Options tab autocomplete. Keep in lockstep with ICON_REGISTRY. */
export const iconNames: string[] = Object.keys(ICON_REGISTRY).sort();

type PrimitiveOverrides = Record<string, unknown>;

type Props = {
  primitive: PrimitiveRow;
  overrides?: PrimitiveOverrides;
};

/**
 * Maps a Primitive row's `ionic_component` value to the corresponding
 * Ionic React component. Renders with placeholder content (slug as label)
 * when no overrides are provided; when DC#16 prop binding routes overrides
 * here, the rendered widget picks up the bound props instead.
 *
 * Per-component allowed-prop list is intentionally narrow at v1: text-ish
 * content, color, fill, src. New props get added as catalog use cases
 * surface them — denying unknown overrides keeps the renderer from
 * forwarding arbitrary JSON to Ionic, which catches typos at the seam.
 *
 * Unknown Ionic components fall through to a labeled placeholder so
 * additions to appza_primitives don't crash the renderer.
 */
export function PrimitiveRenderer({ primitive, overrides }: Props) {
  const label = readString(overrides, 'text') ?? primitive.name ?? primitive.slug;

  switch (primitive.ionic_component) {
    case 'IonButton': {
      const iconName = readString(overrides, 'icon');
      const rawText = overrides ? overrides['text'] : undefined;
      const textExplicitlyEmpty = rawText === '';
      const iconOnly = !!iconName && (textExplicitlyEmpty || readString(overrides, 'text') === undefined);
      const buttonLabel = textExplicitlyEmpty ? '' : label;
      return (
        <IonButton
          size="small"
          fill={normalizeIonButtonFill(readString(overrides, 'fill'))}
          color={readString(overrides, 'color')}
        >
          {iconName && resolveIcon(iconName) && (
            <IonIcon
              icon={resolveIcon(iconName)}
              slot={iconOnly ? 'icon-only' : 'start'}
            />
          )}
          {!iconOnly && buttonLabel}
        </IonButton>
      );
    }

    case 'IonAvatar': {
      const src = readString(overrides, 'src');
      return (
        <IonAvatar style={{ width: 40, height: 40 }}>
          {src ? (
            <img src={src} alt="" className="appza-renderer-avatar-img" />
          ) : (
            <div className="appza-renderer-avatar-fallback">A</div>
          )}
        </IonAvatar>
      );
    }

    case 'IonImg': {
      const src = readString(overrides, 'src');
      if (src) return <IonImg src={src} alt={label} />;
      return (
        <div className="appza-renderer-img-placeholder">
          <span>{label}</span>
        </div>
      );
    }

    case 'AppzaVideoEmbed':
      return (
        <AppzaVideoEmbed
          src={readString(overrides, 'src')}
          poster={readString(overrides, 'poster')}
          label={label}
        />
      );

    case 'AppzaPollBlock':
      return (
        <AppzaPollBlock
          type={readString(overrides, 'type')}
          options={readOptions(overrides, 'options')}
        />
      );

    case 'AppzaRichText': {
      const html = readString(overrides, 'text') ?? '';
      return (
        <div
          className="appza-rich-text"
          // Server sanitized via wp_kses with a narrow inline safelist.
          // Safe innerHTML sink — see PreviewProxyController::sanitize_rich_text.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    case 'AppzaImageGallery':
      return <AppzaImageGallery images={readImages(overrides, 'images')} />;

    case 'IonInput':
      return (
        <IonInput
          placeholder={readString(overrides, 'placeholder') ?? label}
          fill="outline"
        />
      );

    case 'IonTextarea':
      return (
        <IonTextarea
          placeholder={readString(overrides, 'placeholder') ?? label}
          fill="outline"
          rows={2}
        />
      );

    case 'IonLabel':
      return <IonLabel>{label}</IonLabel>;

    case 'IonText':
      return (
        <IonText>
          <p style={{ margin: 0 }}>{label}</p>
        </IonText>
      );

    case 'IonCheckbox':
      return <IonCheckbox aria-label={label} />;

    case 'IonChip':
      return <IonChip color={readString(overrides, 'color')}>{label}</IonChip>;

    case 'IonList':
      // Renderer never actually nests Ionic list items at v1; this is a
      // visual no-op placeholder so list-row layouts don't render an
      // "unknown" chip when the SS happens to include ion-list.
      return <IonList lines="none" style={{ background: 'transparent', width: '100%' }} />;

    default:
      return (
        <div className="appza-renderer-unknown">
          <code>{primitive.slug}</code>
          {primitive.ionic_component && (
            <span className="appza-renderer-unknown-hint">({primitive.ionic_component})</span>
          )}
        </div>
      );
  }
}

const VIDEO_EMBED_ALLOWED_HOSTS = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
];

function isAllowedVideoHost(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase();
    return VIDEO_EMBED_ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Poster thumbnail with a play badge. If `src` host is on the allowlist
 * (YouTube / Vimeo), clicking swaps to an inline iframe in the same card
 * slot — no modal. If host is NOT allowed, the play badge acts as an
 * anchor opening `src` in a new tab (renderer refuses to embed arbitrary
 * third-party iframes).
 *
 * The play badge carries `data-appza-inline-click` so DeviceFrame's DC#20
 * click-capture skips it (otherwise the plug-in-admin's primitive-select
 * would intercept the play click). The surrounding poster area is still
 * a normal primitive click target, so users CAN select the video-embed
 * for editing by clicking outside the badge.
 */
// Cached across mounts so a parent re-render that unmounts the video-embed
// (e.g. list refetch, primitive-select state change) doesn't reset the
// user's "I hit play" decision. Keyed by src because a different video is
// a legitimate reason to reset.
const videoEmbedPlayingCache = new Map<string, boolean>();

function AppzaVideoEmbed({
  src,
  poster,
  label,
}: {
  src?: string;
  poster?: string;
  label: string;
}) {
  const cacheKey = src ?? '';
  const [playing, setPlayingState] = useState<boolean>(
    () => videoEmbedPlayingCache.get(cacheKey) ?? false,
  );
  const setPlaying = (v: boolean) => {
    videoEmbedPlayingCache.set(cacheKey, v);
    setPlayingState(v);
  };
  const canEmbed = src ? isAllowedVideoHost(src) : false;
  if (playing && src && canEmbed) {
    return (
      <div className="appza-video-embed-frame">
        <iframe
          className="appza-video-embed-iframe"
          src={src}
          title={label}
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        <button
          type="button"
          className="appza-video-embed-close"
          data-appza-inline-click="true"
          aria-label="Close video"
          onClick={(e) => {
            e.stopPropagation();
            setPlaying(false);
          }}
        >
          <span className="appza-video-embed-close-glyph" aria-hidden="true">×</span>
        </button>
      </div>
    );
  }
  return (
    <div className="appza-video-embed-poster">
      {poster ? (
        <img src={poster} alt={label} />
      ) : (
        <div className="appza-video-embed-poster-empty">{label}</div>
      )}
      <button
        type="button"
        className="appza-video-embed-play"
        data-appza-inline-click="true"
        aria-label={canEmbed ? 'Play video' : 'Open video in new tab'}
        title={canEmbed ? undefined : 'Opens in a new tab'}
        disabled={!src}
        onClick={(e) => {
          e.stopPropagation();
          if (!src) return;
          if (canEmbed) {
            setPlaying(true);
          } else {
            window.open(src, '_blank', 'noopener,noreferrer');
          }
        }}
      >
        <span className="appza-video-embed-play-glyph" aria-hidden="true" />
      </button>
    </div>
  );
}

function readString(overrides: PrimitiveOverrides | undefined, key: string): string | undefined {
  if (!overrides) return undefined;
  const v = overrides[key];
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

type PollOption = { label: string; slug: string };

type GalleryImage = { url: string; width?: number; height?: number };

function readImages(overrides: PrimitiveOverrides | undefined, key: string): GalleryImage[] {
  if (!overrides) return [];
  const raw = overrides[key];
  if (!Array.isArray(raw)) return [];
  const out: GalleryImage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.url !== 'string' || rec.url === '') continue;
    out.push({
      url: rec.url,
      width: typeof rec.width === 'number' ? rec.width : undefined,
      height: typeof rec.height === 'number' ? rec.height : undefined,
    });
  }
  return out;
}

/**
 * Instagram-style collage. Layout switches on image count via the
 * `data-count` attribute — CSS grid definitions per count in styles.css:
 *   1 → single tile        2 → two equal columns
 *   3 → 1 large + 2 stacked (matches user reference)
 *   4 → 2×2 grid          5+ → 2×2 grid, 4th tile shows "+N more" overlay
 * No scroll, no swipe. Grid, not flex. All visible up to the count-4 cap
 * plus the "+N" affordance.
 *
 * Tap on any tile → opens `AppzaImageLightbox` at that index (indexed into
 * the FULL images array, not the visible slice — so tapping the "+N" tile
 * opens the 4th image and lets the user navigate to the hidden ones).
 */
function AppzaImageGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (images.length === 0) return null;
  const count = images.length;
  const dataCount = count <= 3 ? String(count) : count === 4 ? '4' : 'many';
  const extra = count > 4 ? count - 4 : 0;
  const visible = images.slice(0, count > 4 ? 4 : count);
  return (
    <>
      <div className="appza-image-gallery" data-count={dataCount}>
        {visible.map((img, idx) => {
          const overlayExtra = idx === 3 && extra > 0 ? extra : undefined;
          return (
            <div
              key={idx}
              className="appza-image-gallery-slide"
              data-extra={overlayExtra !== undefined ? `+${overlayExtra}` : undefined}
              data-appza-inline-click="true"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(idx);
              }}
            >
              <img src={img.url} alt="" loading="lazy" />
            </div>
          );
        })}
      </div>
      {activeIndex !== null && (
        <AppzaImageLightbox
          images={images}
          activeIndex={activeIndex}
          onNavigate={setActiveIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </>
  );
}

/**
 * Fullscreen lightbox — dark backdrop + centered image (`object-fit: contain`)
 * + close button + prev/next arrows (hidden when only 1 image). Backdrop
 * click closes; keyboard (Esc / ← / →) navigates or closes on desktop.
 *
 * All interactive elements carry `data-appza-inline-click` so DC#20's
 * plug-in-admin click-capture doesn't intercept the taps.
 */
function AppzaImageLightbox({
  images,
  activeIndex,
  onNavigate,
  onClose,
}: {
  images: GalleryImage[];
  activeIndex: number;
  onNavigate: (idx: number) => void;
  onClose: () => void;
}) {
  const count = images.length;
  const canNavigate = count > 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (canNavigate && e.key === 'ArrowLeft') {
        onNavigate((activeIndex - 1 + count) % count);
      } else if (canNavigate && e.key === 'ArrowRight') {
        onNavigate((activeIndex + 1) % count);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, canNavigate, count, onNavigate, onClose]);

  const current = images[activeIndex];
  if (!current) return null;

  return (
    <div
      className="appza-image-lightbox"
      data-appza-inline-click="true"
      onClick={(e) => {
        e.stopPropagation();
        // Only close on backdrop taps, not on the image / buttons.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="appza-image-lightbox-close"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
      {canNavigate && (
        <button
          type="button"
          className="appza-image-lightbox-nav appza-image-lightbox-nav-prev"
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((activeIndex - 1 + count) % count);
          }}
        >
          ‹
        </button>
      )}
      <img
        className="appza-image-lightbox-img"
        src={current.url}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
      {canNavigate && (
        <button
          type="button"
          className="appza-image-lightbox-nav appza-image-lightbox-nav-next"
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((activeIndex + 1) % count);
          }}
        >
          ›
        </button>
      )}
      {canNavigate && (
        <div className="appza-image-lightbox-counter" aria-hidden="true">
          {activeIndex + 1} / {count}
        </div>
      )}
    </div>
  );
}

function readOptions(overrides: PrimitiveOverrides | undefined, key: string): PollOption[] {
  if (!overrides) return [];
  const raw = overrides[key];
  if (!Array.isArray(raw)) return [];
  const out: PollOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const label = typeof rec.label === 'string' ? rec.label : null;
    const slug = typeof rec.slug === 'string' ? rec.slug : null;
    if (!label) continue;
    out.push({ label, slug: slug ?? label });
  }
  return out;
}

/**
 * Interactive poll options — radio group for `single_choice`, list of
 * checkboxes for `multi_choice`. Local selection only; no submit, no
 * vote counts, no persistence (voting persistence lands in a future DC).
 *
 * Wrapped in `data-appza-inline-click` so DC#20 primitive-select ignores
 * clicks on the options (the tap belongs to the radio/checkbox toggle,
 * not to entering the LayoutEditor).
 */
function AppzaPollBlock({
  type,
  options,
}: {
  type: string | undefined;
  options: PollOption[];
}) {
  const isMulti = type === 'multi_choice';
  const [singleValue, setSingleValue] = useState<string | undefined>(undefined);
  const [multiValues, setMultiValues] = useState<Set<string>>(() => new Set());

  if (options.length === 0) {
    return <div className="appza-poll-block appza-poll-block-empty">No options.</div>;
  }

  if (isMulti) {
    return (
      <div className="appza-poll-block" data-appza-inline-click="true">
        {options.map((opt) => {
          const checked = multiValues.has(opt.slug);
          return (
            <label key={opt.slug} className="appza-poll-row">
              <IonCheckbox
                checked={checked}
                onIonChange={(e) => {
                  setMultiValues((prev) => {
                    const next = new Set(prev);
                    if (e.detail.checked) next.add(opt.slug);
                    else next.delete(opt.slug);
                    return next;
                  });
                }}
              />
              <span className="appza-poll-label">{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className="appza-poll-block" data-appza-inline-click="true">
      <IonRadioGroup
        value={singleValue ?? ''}
        onIonChange={(e) => setSingleValue(String(e.detail.value ?? ''))}
      >
        {options.map((opt) => (
          <label key={opt.slug} className="appza-poll-row">
            <IonRadio value={opt.slug} />
            <span className="appza-poll-label">{opt.label}</span>
          </label>
        ))}
      </IonRadioGroup>
    </div>
  );
}

type IonButtonFill = 'default' | 'solid' | 'clear' | 'outline';
const ION_BUTTON_FILLS: readonly IonButtonFill[] = ['default', 'solid', 'clear', 'outline'];

function normalizeIonButtonFill(raw: string | undefined): IonButtonFill {
  if (raw && (ION_BUTTON_FILLS as readonly string[]).includes(raw)) {
    return raw as IonButtonFill;
  }
  return 'clear';
}

/**
 * Resolves an ionicons icon name (kebab-case) to the imported SVG ref
 * via the static registry above. Tries the bare name first, then the
 * `-outline` variant for the same family.
 *
 * Exported so the plug-in-admin's icon picker can render live glyphs
 * next to each name. Renderer callers should keep using it locally.
 */
export function resolveIcon(name: string): string | undefined {
  if (ICON_REGISTRY[name]) return ICON_REGISTRY[name];
  if (ICON_REGISTRY[name + '-outline']) return ICON_REGISTRY[name + '-outline'];
  return undefined;
}

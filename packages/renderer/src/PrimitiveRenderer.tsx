import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
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
  happy,
  happyOutline,
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
  link,
  linkOutline,
  library,
  libraryOutline,
  location,
  locationOutline,
  barChart,
  barChartOutline,
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
  happy,
  'happy-outline': happyOutline,
  home,
  'home-outline': homeOutline,
  link,
  'link-outline': linkOutline,
  'bar-chart': barChart,
  'bar-chart-outline': barChartOutline,
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
      // Ionic's `color=` prop applies a class that sets `--background`,
      // `--color`, `--border-color`, etc. via `:host`, which can shadow
      // our inline overrides. `ThemedIonButton` uses a ref + setProperty
      // with 'important' so schema-driven `background` / `text_color` /
      // `border_color` always win regardless of the API's theme color.
      return (
        <ThemedIonButton
          size="small"
          fill={normalizeIonButtonFill(readString(overrides, 'fill'))}
          color={readString(overrides, 'color')}
          styleOverrides={buildIonButtonStyleOverrides(overrides)}
        >
          {iconName && resolveIcon(iconName) && (
            <IonIcon
              icon={resolveIcon(iconName)}
              slot={iconOnly ? 'icon-only' : 'start'}
            />
          )}
          {!iconOnly && buttonLabel}
        </ThemedIonButton>
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

    case 'IonInput': {
      const fillProp = readString(overrides, 'fill');
      // `type` covers text / password / email / tel / number / search / url.
      // Everything outside that set falls back to text so a typo can't
      // break the input entirely.
      const rawType = readString(overrides, 'type');
      const allowedTypes = new Set([
        'text', 'password', 'email', 'tel', 'number', 'search', 'url',
      ]);
      const inputType = (rawType && allowedTypes.has(rawType) ? rawType : 'text') as
        'text' | 'password' | 'email' | 'tel' | 'number' | 'search' | 'url';
      return (
        <IonInput
          type={inputType}
          placeholder={readString(overrides, 'placeholder') ?? label}
          fill={(fillProp as 'solid' | 'outline' | undefined) ?? 'outline'}
        />
      );
    }

    case 'IonTextarea': {
      const rowsStr = readString(overrides, 'rows');
      const rowsNum = rowsStr ? Number.parseInt(rowsStr, 10) : NaN;
      const fillProp = readString(overrides, 'fill');
      return (
        <IonTextarea
          placeholder={readString(overrides, 'placeholder') ?? label}
          fill={(fillProp as 'solid' | 'outline' | undefined) ?? 'outline'}
          rows={Number.isFinite(rowsNum) ? rowsNum : 2}
        />
      );
    }

    case 'IonLabel':
      return <IonLabel>{label}</IonLabel>;

    case 'IonText': {
      const color = readString(overrides, 'color');
      const size = readString(overrides, 'size');
      const weight = readString(overrides, 'weight');
      const align = readString(overrides, 'align');
      // Ionic's `color=` only accepts theme names (primary/secondary/
      // dark/etc.). A hex like `#ff0000` passed to `color=` is silently
      // dropped. Route arbitrary CSS colors through inline `style.color`
      // and reserve `color=` for real theme names, so the builder's
      // color picker actually changes the title.
      const themeColor = color && isIonicThemeColor(color) ? color : undefined;
      const inlineColor = color && !themeColor ? color : undefined;
      return (
        <IonText color={themeColor}>
          <p style={{
            margin: 0,
            fontSize: size,
            fontWeight: weight,
            textAlign: (align as CSSProperties['textAlign']) ?? undefined,
            color: inlineColor,
          }}>{label}</p>
        </IonText>
      );
    }

    case 'IonSelect': {
      // Options come from `overrides.options` as an array of `{value,label}`
      // pairs. The App-mode shell populates this for dynamic pickers (e.g.
      // the composer's space picker mirrors the spaces DS in here).
      //
      // Rendered as a native `<select>` (not IonSelect) because IonSelect's
      // popover interface + shadow-DOM option handoff misbehaves when the
      // options array is injected via customizations after mount — the
      // native select is DOM-inspectable, immediately reactive to prop
      // changes, and works with readFormFieldValue's `.value` query. Ionic's
      // form-element theming still cascades into the native select via the
      // surrounding CSS custom properties from tokensToCssVars.
      const placeholder = readString(overrides, 'placeholder') ?? label;
      const options = readSelectOptions(overrides, 'options');
      return (
        <select
          className="appza-native-select"
          defaultValue=""
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            border: '1px solid var(--ion-color-medium, #ccc)',
            borderRadius: 6,
            background: '#fff',
          }}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    case 'IonCheckbox': {
      // Render with an inline label when `text` is set — matches the
      // FC composer's "Send announcement email to space member" pattern
      // where the checkbox and its label sit on one line. Blank text
      // falls back to a bare checkbox (used for standalone toggle spots).
      const checkboxText = readString(overrides, 'text');
      if (!checkboxText) return <IonCheckbox aria-label={label} />;
      return (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <IonCheckbox aria-label={checkboxText} />
          <span>{checkboxText}</span>
        </label>
      );
    }

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

/**
 * Maps IonButton style overrides (from properties_schema `binds_to`) onto
 * the Ionic CSS custom properties IonButton reads at runtime. Names match
 * schema convention (border_width, border_color, border_style,
 * border_radius, background, text_color, padding_x, padding_y) so
 * catalog authors can wire them without knowing Ionic's `--*` names.
 * Returns an empty map if nothing is set so callers can skip the effect.
 */
function buildIonButtonStyleOverrides(
  overrides: PrimitiveOverrides | undefined,
): Record<string, string> {
  if (!overrides) return {};
  const map: Array<[string, string]> = [
    ['border_width', '--border-width'],
    ['border_color', '--border-color'],
    ['border_style', '--border-style'],
    ['border_radius', '--border-radius'],
    ['background', '--background'],
    ['text_color', '--color'],
    ['padding_x', '--padding-start'],
    ['padding_y', '--padding-top'],
  ];
  const out: Record<string, string> = {};
  for (const [key, cssVar] of map) {
    const v = readString(overrides, key);
    if (v !== undefined) out[cssVar] = v;
  }
  // padding_x → --padding-end mirror; padding_y → --padding-bottom mirror.
  const px = readString(overrides, 'padding_x');
  if (px !== undefined) out['--padding-end'] = px;
  const py = readString(overrides, 'padding_y');
  if (py !== undefined) out['--padding-bottom'] = py;
  return out;
}

/**
 * IonButton wrapper that beats Ionic's theme cascade by styling the
 * shadow part `::part(native)` directly. Ionic's `color=` prop applies
 * `:host` rules for `--background`, `--color`, `--border-color`, etc.,
 * and inline custom properties on the host don't always win — the
 * theme's `!important` variants in some cascades take over. Targeting
 * the shadow part from OUTSIDE the shadow root, with `!important`,
 * always wins because Ionic never gates its own shadow rules with
 * `!important` at that layer.
 *
 * Each button gets a unique class (`appza-cta-<id>`) and an inline
 * `<style>` sibling emits scoped rules keyed off that class. Cleared
 * props render as empty styleOverrides → empty rules → Ionic defaults
 * come back automatically.
 */
type ThemedIonButtonProps = ComponentProps<typeof IonButton> & {
  styleOverrides: Record<string, string>;
};

let themedButtonCounter = 0;

function ThemedIonButton({
  styleOverrides,
  children,
  className,
  ...rest
}: ThemedIonButtonProps) {
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) {
    themedButtonCounter += 1;
    idRef.current = `appza-cta-${themedButtonCounter}`;
  }
  const cssId = idRef.current;

  // Map schema-driven CSS custom properties back to native CSS
  // properties on `::part(native)` — that's where Ionic actually
  // paints the button surface / label / border. Padding stays on the
  // host as `--padding-*` (Ionic reads those internally on ion-button
  // even when `part(native)` is styled externally).
  const partRules: string[] = [];
  const hostRules: string[] = [];
  const partMap: Array<[string, string]> = [
    ['--background', 'background-color'],
    ['--color', 'color'],
    ['--border-color', 'border-color'],
    ['--border-style', 'border-style'],
    ['--border-width', 'border-width'],
    ['--border-radius', 'border-radius'],
  ];
  for (const [srcKey, cssProp] of partMap) {
    const v = styleOverrides[srcKey];
    if (v !== undefined) partRules.push(`${cssProp}: ${v} !important;`);
  }
  for (const hostKey of [
    '--padding-start',
    '--padding-end',
    '--padding-top',
    '--padding-bottom',
  ]) {
    const v = styleOverrides[hostKey];
    if (v !== undefined) hostRules.push(`${hostKey}: ${v} !important;`);
  }
  // Border-width has to be explicit on ::part(native) for outline to
  // paint, but Ionic's solid/clear fills also inherit border: 0. When
  // the author sets a color WITHOUT a width, assume they want the
  // color visible → default to 1px solid so the color has something to
  // paint on.
  if (styleOverrides['--border-color'] && !styleOverrides['--border-width']) {
    partRules.push('border-width: 1px !important;');
    if (!styleOverrides['--border-style']) {
      partRules.push('border-style: solid !important;');
    }
  }

  const css = [
    hostRules.length > 0 ? `.${cssId} { ${hostRules.join(' ')} }` : '',
    partRules.length > 0
      ? `.${cssId}::part(native) { ${partRules.join(' ')} }`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const mergedClass = className ? `${className} ${cssId}` : cssId;

  return (
    <>
      {css && <style>{css}</style>}
      <IonButton className={mergedClass} {...rest}>
        {children}
      </IonButton>
    </>
  );
}

const IONIC_THEME_COLORS = new Set([
  'primary',
  'secondary',
  'tertiary',
  'success',
  'warning',
  'danger',
  'light',
  'medium',
  'dark',
]);

/**
 * True when the string is an Ionic theme color name (safe to pass to
 * `color=`). Everything else (hex, rgb(), hsl(), CSS named colors) has
 * to flow through inline style since Ionic silently drops non-theme
 * values from the color prop.
 */
function isIonicThemeColor(v: string): boolean {
  return IONIC_THEME_COLORS.has(v);
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

type SelectOption = { value: string; label: string };

/**
 * Read a select options bag off an overrides record. Accepts `{value,label}`
 * pairs; coerces value + label to string. Silently drops entries missing
 * either field so the renderer never emits an empty `<ion-select-option>`.
 */
function readSelectOptions(
  overrides: PrimitiveOverrides | undefined,
  key: string,
): SelectOption[] {
  if (!overrides) return [];
  const raw = overrides[key];
  if (!Array.isArray(raw)) return [];
  const out: SelectOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const v = rec.value ?? rec.id ?? rec.slug;
    const l = rec.label ?? rec.title ?? rec.name;
    if (v === undefined || v === null) continue;
    if (l === undefined || l === null) continue;
    out.push({ value: String(v), label: String(l) });
  }
  return out;
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

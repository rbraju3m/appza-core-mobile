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

    case 'IonAvatar':
      return (
        <IonAvatar style={{ width: 40, height: 40 }}>
          <div className="appza-renderer-avatar-fallback">A</div>
        </IonAvatar>
      );

    case 'IonImg': {
      const src = readString(overrides, 'src');
      if (src) return <IonImg src={src} alt={label} />;
      return (
        <div className="appza-renderer-img-placeholder">
          <span>{label}</span>
        </div>
      );
    }

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

function readString(overrides: PrimitiveOverrides | undefined, key: string): string | undefined {
  if (!overrides) return undefined;
  const v = overrides[key];
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return undefined;
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

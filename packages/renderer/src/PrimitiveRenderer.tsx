import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import { useActionDispatch, type ActionInvocation } from './actionContext';
import { readActionDefaultsFromCatalog } from './catalogIndex';
import {
  IonAvatar,
  IonProgressBar,
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
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTextarea,
  IonToggle,
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
  arrowUndo,
  arrowUndoOutline,
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
  chatboxOutline,
  chatbubbles,
  chatbubblesOutline,
  checkmark,
  checkmarkCircle,
  checkmarkCircleOutline,
  caretDown,
  chevronBack,
  chevronDown,
  chevronForward,
  chevronUp,
  close,
  closeCircle,
  closeOutline,
  copy,
  copyOutline,
  closeCircleOutline,
  create,
  createOutline,
  ellipsisHorizontal,
  ellipsisVertical,
  eye,
  eyeOff,
  eyeOffOutline,
  eyeOutline,
  filter,
  filterOutline,
  grid,
  gridOutline,
  happy,
  happyOutline,
  heart,
  heartOutline,
  home,
  homeOutline,
  document,
  documentOutline,
  documentTextOutline,
  download,
  downloadOutline,
  image,
  imageOutline,
  images,
  imagesOutline,
  list,
  listOutline,
  reorderFour,
  reorderFourOutline,
  informationCircle,
  chatbubbleEllipsesOutline,
  flagOutline,
  filmOutline,
  globe,
  globeOutline,
  informationCircleOutline,
  lockClosed,
  lockClosedOutline,
  trophy,
  trophyOutline,
  waterOutline,
  link,
  linkOutline,
  pencilOutline,
  pinOutline,
  ellipseOutline,
  helpCircleOutline,
  layersOutline,
  library,
  libraryOutline,
  logOut,
  logOutOutline,
  // Names rather than FluentCommunity's raw SVG, which could only be drawn by injecting HTML.
  logoInstagram,
  logoTwitter,
  logoYoutube,
  logoLinkedin,
  logoFacebook,
  logoTiktok,
  logoPinterest,
  logoReddit,
  logoSnapchat,
  lockOpenOutline,
  notificationsOffOutline,
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
  musicalNotes,
  musicalNotesOutline,
  notifications,
  notificationsOutline,
  pause,
  pauseOutline,
  pauseCircle,
  pauseCircleOutline,
  play,
  playOutline,
  playBack,
  playBackOutline,
  playForward,
  playForwardOutline,
  volumeHigh,
  volumeHighOutline,
  volumeMute,
  volumeMuteOutline,
  people,
  peopleOutline,
  personAddOutline,
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
import { AppzaFilePicker } from './AppzaFilePicker';
import { AppzaFileList } from './AppzaFileList';
import { AppzaSocialLinks } from './AppzaSocialLinks';
import { AppzaProfileFields } from './AppzaProfileFields';
import { AppzaDetailCards } from './AppzaDetailCards';
import { CourseQuiz } from './CourseQuiz';
import { AppzaCommentList } from './CommentList';
import { AppzaCommentThread } from './CommentThread';
import { AppzaCommentComposer } from './CommentComposer';
import { AppzaAvatarStack } from './AvatarStack';
import { AppzaMediaTile } from './MediaTile';
import { AppzaAudioPlayer, AppzaAudioList } from './AudioPlayerRow';
import { AppzaChatBubble } from './ChatBubble';
import { AppzaChatComposer } from './ChatComposer';
import { AppzaPostComposer, AppzaPostAnnounce } from './PostComposer';
import { AppzaPostSchedule } from './PostSchedule';
import { AppzaPostPreview } from './PostPreview';
import { useBannerControls, setBannerControls } from './bannerControls';
import { attach, attachOutline, cloudUploadOutline } from 'ionicons/icons';
import { openExternal } from './externalLink';

const GOOGLE_LOGO_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'>" +
      "<path fill='#4285F4' d='M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z'/>" +
      "<path fill='#34A853' d='M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z'/>" +
      "<path fill='#FBBC05' d='M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z'/>" +
      "<path fill='#EA4335' d='M24 9.5c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 2.69 29.93 0 24 0 15.4 0 7.96 4.93 4.34 12.12l7.35 5.7C13.42 12.62 18.27 9.5 24 9.5z'/>" +
      '</svg>',
  );

const ICON_REGISTRY: Record<string, string> = {
  // Explicit on purpose: a dynamic `icons[name]` lookup gets tree-shaken to nothing, so every catalog icon must be listed.
  add,
  'add-circle': addCircle,
  'add-circle-outline': addCircleOutline,
  apps,
  'arrow-back': arrowBack,
  'arrow-forward': arrowForward,
  'arrow-undo': arrowUndo,
  'arrow-undo-outline': arrowUndoOutline,
  book,
  'chevron-back': chevronBack,
  'chevron-down': chevronDown,
  'caret-down': caretDown,
  'chevron-forward': chevronForward,
  'chevron-up': chevronUp,
  create,
  'create-outline': createOutline,
  'ellipsis-horizontal': ellipsisHorizontal,
  'ellipsis-vertical': ellipsisVertical,
  eye,
  'eye-outline': eyeOutline,
  'eye-off': eyeOff,
  'eye-off-outline': eyeOffOutline,
  filter,
  'filter-outline': filterOutline,
  grid,
  'grid-outline': gridOutline,
  list,
  'list-outline': listOutline,
  'reorder-four': reorderFour,
  'reorder-four-outline': reorderFourOutline,
  menu,
  'menu-outline': menuOutline,
  refresh,
  'refresh-outline': refreshOutline,
  settings,
  'settings-outline': settingsOutline,
  trash,
  'trash-outline': trashOutline,

  'alert-circle': alertCircle,
  'alert-circle-outline': alertCircleOutline,
  checkmark,
  'checkmark-circle': checkmarkCircle,
  'checkmark-circle-outline': checkmarkCircleOutline,
  close,
  'close-outline': closeOutline,
  'close-circle': closeCircle,
  copy,
  'copy-outline': copyOutline,
  'close-circle-outline': closeCircleOutline,
  'information-circle': informationCircle,
  'information-circle-outline': informationCircleOutline,
  warning,
  'warning-outline': warningOutline,

  bookmark,
  'bookmark-outline': bookmarkOutline,
  chatbubble,
  'chatbubble-outline': chatbubbleOutline,
  'chatbox-outline': chatboxOutline,
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
  'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
  'flag-outline': flagOutline,
  'film-outline': filmOutline,
  globe,
  'globe-outline': globeOutline,
  'lock-closed': lockClosed,
  'lock-closed-outline': lockClosedOutline,
  trophy,
  'trophy-outline': trophyOutline,
  'water-outline': waterOutline,
  'pencil-outline': pencilOutline,
  'pin-outline': pinOutline,
  'ellipse-outline': ellipseOutline,
  'help-circle-outline': helpCircleOutline,
  'layers-outline': layersOutline,
  'log-out': logOut,
  'log-out-outline': logOutOutline,
  'logo-instagram': logoInstagram,
  'logo-twitter': logoTwitter,
  'logo-youtube': logoYoutube,
  'logo-linkedin': logoLinkedin,
  'logo-facebook': logoFacebook,
  'logo-tiktok': logoTiktok,
  'logo-pinterest': logoPinterest,
  'logo-reddit': logoReddit,
  'logo-snapchat': logoSnapchat,
  'lock-open-outline': lockOpenOutline,
  'notifications-off-outline': notificationsOffOutline,
  'bar-chart': barChart,
  'bar-chart-outline': barChartOutline,
  notifications,
  'notifications-outline': notificationsOutline,
  people,
  'people-outline': peopleOutline,
  'person-add-outline': personAddOutline,
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

  call,
  'call-outline': callOutline,
  mail,
  'mail-outline': mailOutline,

  camera,
  'camera-outline': cameraOutline,
  attach,
  'attach-outline': attachOutline,
  'cloud-upload-outline': cloudUploadOutline,
  document,
  'document-outline': documentOutline,
  'document-text-outline': documentTextOutline,
  download,
  'download-outline': downloadOutline,
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
  play,
  'play-outline': playOutline,
  pause,
  'pause-outline': pauseOutline,
  'play-back': playBack,
  'play-back-outline': playBackOutline,
  'play-forward': playForward,
  'play-forward-outline': playForwardOutline,
  'musical-notes': musicalNotes,
  'musical-notes-outline': musicalNotesOutline,
  'volume-high': volumeHigh,
  'volume-high-outline': volumeHighOutline,
  'volume-mute': volumeMute,
  'volume-mute-outline': volumeMuteOutline,
  videocam,
  'videocam-outline': videocamOutline,

  calendar,
  'calendar-outline': calendarOutline,
  location,
  'location-outline': locationOutline,
  time,
  'time-outline': timeOutline,

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

  library,
  'library-outline': libraryOutline,
  ribbon,
  'ribbon-outline': ribbonOutline,
  school,
  'school-outline': schoolOutline,

  google: GOOGLE_LOGO_SVG,
};

export const iconNames: string[] = Object.keys(ICON_REGISTRY).sort();

type PrimitiveOverrides = Record<string, unknown>;

type Props = {
  primitive: PrimitiveRow;
  overrides?: PrimitiveOverrides;
  action?: ActionInvocation;
};

/** Seeded once: a `checked` prop re-applied on render snaps the switch back after every tap. */
function SeededIonToggle({
  initialChecked,
  disabled,
  onToggle,
}: {
  initialChecked: boolean;
  disabled: boolean;
  onToggle?: (e: CustomEvent) => void;
}) {
  const ref = useRef<HTMLIonToggleElement | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !ref.current) return;
    seeded.current = true;
    ref.current.checked = initialChecked;
  }, [initialChecked]);
  return <IonToggle ref={ref} disabled={disabled} onIonChange={onToggle} />;
}

/** Holds its own pick so a tap shows at once; a new `value` from state replaces it. */
function SeededIonSegment({
  value,
  options,
  disabled,
  onPick,
}: {
  value: string;
  options: SelectOption[];
  disabled: boolean;
  onPick?: (value: string) => void;
}) {
  const [picked, setPicked] = useState(value);
  useEffect(() => setPicked(value), [value]);
  return (
    <IonSegment
      value={picked}
      disabled={disabled}
      onIonChange={(e) => {
        const next = e.detail.value === undefined ? '' : String(e.detail.value);
        if (next === picked) return;
        setPicked(next);
        onPick?.(next);
      }}
    >
      {options.map((opt) => (
        <IonSegmentButton key={opt.value} value={opt.value}>
          <IonLabel>{opt.label}</IonLabel>
        </IonSegmentButton>
      ))}
    </IonSegment>
  );
}

/** Seeded once via ref, not a `value` prop: a re-applied value fights typing, and the save reads the field from the DOM. */
function SeededIonInput({
  initialValue,
  type,
  placeholder,
  fill,
  clearInput,
  readonly,
  maxlength,
  onInput,
}: {
  initialValue?: string;
  type: 'text' | 'password' | 'email' | 'tel' | 'number' | 'search' | 'url';
  placeholder?: string;
  fill?: 'solid' | 'outline';
  clearInput?: boolean;
  readonly?: boolean;
  /** FluentCommunity rejects a headline over 60 characters. */
  maxlength?: number;
  onInput?: (e: CustomEvent) => void;
}) {
  const ref = useRef<HTMLIonInputElement | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !ref.current || initialValue === undefined) return;
    seeded.current = true;
    ref.current.value = initialValue;
  }, [initialValue]);
  return (
    <IonInput
      ref={ref}
      type={type}
      placeholder={placeholder}
      fill={fill ?? 'outline'}
      clearInput={clearInput}
      readonly={readonly}
      maxlength={maxlength}
      onIonInput={onInput}
    />
  );
}

function SeededIonTextarea({
  initialValue,
  placeholder,
  fill,
  rows,
  autoGrow,
  readonly,
  onInput,
}: {
  initialValue?: string;
  placeholder?: string;
  fill?: 'solid' | 'outline';
  rows: number;
  autoGrow?: boolean;
  readonly?: boolean;
  onInput?: (e: CustomEvent) => void;
}) {
  const ref = useRef<HTMLIonTextareaElement | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !ref.current || initialValue === undefined) return;
    seeded.current = true;
    ref.current.value = initialValue;
  }, [initialValue]);
  return (
    <IonTextarea
      ref={ref}
      placeholder={placeholder}
      fill={fill ?? 'outline'}
      rows={rows}
      autoGrow={autoGrow}
      readonly={readonly}
      onIonInput={onInput}
    />
  );
}

export const SELF_ACTION_PRIMITIVES: ReadonlySet<string> = new Set([
  'ion-select',
  // A wrapper click would submit the quiz on every pick.
  'appza-course-quiz',
  'appza-poll-block',
  'appza-post-schedule',
  'ion-input',
  // A wrapper click carries no value and fires before the user has typed or flipped anything.
  'ion-textarea',
  'ion-toggle',
  'ion-segment',
  'appza-chat-composer',
  'appza-post-composer',
  'appza-comment-list',
  'appza-comment-thread',
  'appza-comment-composer',
]);

// Unknown overrides are denied so arbitrary JSON never reaches Ionic.
export function PrimitiveRenderer({ primitive, overrides, action }: Props) {
  const label = readString(overrides, 'text') ?? primitive.name ?? primitive.slug;
  const dispatch = useActionDispatch();

  switch (primitive.ionic_component) {
    case 'IonButton': {
      const iconName = readString(overrides, 'icon');
      const iconEndName = readString(overrides, 'icon_end');
      // An empty tag still holds the row's far end, which left-aligns a label Ionic would centre.
      const endText =
        overrides && typeof overrides['end_text'] === 'string' ? (overrides['end_text'] as string) : undefined;
      const rawText = overrides ? overrides['text'] : undefined;
      const textExplicitlyEmpty = rawText === '';
      const iconOnly = !!iconName && (textExplicitlyEmpty || readString(overrides, 'text') === undefined);
      const buttonLabel = textExplicitlyEmpty ? '' : label;
      const iconSlotOverride = readString(overrides, 'icon_slot');
      const iconSlot = iconOnly
        ? 'icon-only'
        : iconSlotOverride === 'end'
          ? 'end'
          : 'start';
      // Ionic's button has no top slot and its inner row is out of CSS reach, so the stack is ours.
      const iconTop = !iconOnly && iconSlotOverride === 'top' && !!iconName && !!resolveIcon(iconName);
      // Ionic's `color=` shadows inline overrides via :host; ThemedIonButton applies them with !important.
      return (
        <ThemedIonButton
          size="small"
          fill={normalizeIonButtonFill(readString(overrides, 'fill'))}
          color={readString(overrides, 'color')}
          styleOverrides={buildIonButtonStyleOverrides(overrides)}
        >
          {iconTop && (
            <span className="appza-btn-stack">
              <IonIcon icon={resolveIcon(iconName!)} />
              <span className="appza-btn-stack-label">{buttonLabel}</span>
            </span>
          )}
          {!iconTop && iconName && resolveIcon(iconName) && iconSlot !== 'end' && (
            <IonIcon icon={resolveIcon(iconName)} slot={iconSlot} />
          )}
          {!iconOnly && !iconTop && buttonLabel}
          {iconName && resolveIcon(iconName) && iconSlot === 'end' && (
            <IonIcon icon={resolveIcon(iconName)} slot="end" />
          )}
          {iconEndName && resolveIcon(iconEndName) && iconSlot !== 'end' && (
            <IonIcon icon={resolveIcon(iconEndName)} slot="end" className="appza-icon-end" />
          )}
          {endText !== undefined && (
            <span slot="end" className="appza-btn-end-text">
              {endText}
            </span>
          )}
        </ThemedIonButton>
      );
    }

    case 'IonProgressBar': {
      const raw = overrides ? overrides['value'] : undefined;
      const pct = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0;
      const safe = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
      return <IonProgressBar value={safe / 100} />;
    }

    case 'IonAvatar': {
      const src = readString(overrides, 'src');
      const initials = readString(overrides, 'initials');
      const alt = readString(overrides, 'alt') ?? '';
      // No photo and no initials: an empty circle rather than an invented letter.
      const fallbackText = initials ?? '';
      const size = readString(overrides, 'size');
      const bgColor = readString(overrides, 'bg_color');
      const textColor = readString(overrides, 'text_color');
      return (
        <IonAvatar style={{ width: size ?? 40, height: size ?? 40 }}>
          {src ? (
            <img src={src} alt={alt} className="appza-renderer-avatar-img" />
          ) : (
            <div
              className="appza-renderer-avatar-fallback"
              style={{ background: bgColor, color: textColor }}
            >
              {fallbackText}
            </div>
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
          action={action}
          dispatch={dispatch}
          totalLabel={readString(overrides, 'total_label') ?? 'Vote'}
          votersSlug={readString(overrides, 'voters_action_slug') ?? 'poll.voters'}
          postId={
            typeof overrides?.post_id === 'number' || typeof overrides?.post_id === 'string'
              ? (overrides.post_id as number | string)
              : undefined
          }
        />
      );

    case 'AppzaRichText': {
      const html = readString(overrides, 'text') ?? '';
      return (
        <AppzaRichText
          html={html}
          moreLabel={readString(overrides, 'more_label')}
          lessLabel={readString(overrides, 'less_label')}
          collapsedStateKey={readString(overrides, 'collapsed_state_key')}
        />
      );
    }

    case 'AppzaImageGallery':
      return <AppzaImageGallery images={readImages(overrides, 'images')} />;

    case 'IonInput': {
      const fillProp = readString(overrides, 'fill');
      const rawType = readString(overrides, 'type');
      const allowedTypes = new Set([
        'text', 'password', 'email', 'tel', 'number', 'search', 'url',
      ]);
      const inputType = (rawType && allowedTypes.has(rawType) ? rawType : 'text') as
        'text' | 'password' | 'email' | 'tel' | 'number' | 'search' | 'url';
      // onIonInput, not onIonChange: the latter fires only on blur.
      const handleInput = action
        ? (e: CustomEvent) => {
            const target = e.target as { value?: unknown } | null;
            const value = typeof target?.value === 'string' ? target.value : '';
            dispatch({
              ...action,
              item: {
                ...((action.item as Record<string, unknown> | null | undefined) ?? {}),
                value,
              },
            });
          }
        : undefined;
      return (
        <SeededIonInput
          initialValue={readString(overrides, 'value')}
          type={inputType}
          // An empty placeholder is an answer: readString() treats '' as absent and would show the label "Input".
          placeholder={
            overrides && 'placeholder' in overrides
              ? String(overrides.placeholder ?? '')
              : label
          }
          fill={(fillProp as 'solid' | 'outline' | undefined) ?? 'outline'}
          clearInput={readBoolean(overrides, 'clear_input')}
          // FluentCommunity only lets the email change for edit_users or when can_change_email is on.
          readonly={readBoolean(overrides, 'readonly')}
          maxlength={(() => {
            const raw = readString(overrides, 'maxlength');
            const n = raw === undefined ? NaN : Number(raw);
            return Number.isFinite(n) && n > 0 ? n : undefined;
          })()}
          onInput={handleInput}
        />
      );
    }

    case 'IonTextarea': {
      const rowsStr = readString(overrides, 'rows');
      const rowsNum = rowsStr ? Number.parseInt(rowsStr, 10) : NaN;
      const fillProp = readString(overrides, 'fill');
      const handleInput = action
        ? (e: CustomEvent) => {
            const target = e.target as { value?: unknown } | null;
            const value = typeof target?.value === 'string' ? target.value : '';
            dispatch({
              ...action,
              item: {
                ...((action.item as Record<string, unknown> | null | undefined) ?? {}),
                value,
              },
            });
          }
        : undefined;
      return (
        <SeededIonTextarea
          initialValue={readString(overrides, 'value')}
          // An empty placeholder is an answer: readString() treats '' as absent and would show the label "Input".
          placeholder={
            overrides && 'placeholder' in overrides
              ? String(overrides.placeholder ?? '')
              : label
          }
          fill={(fillProp as 'solid' | 'outline' | undefined) ?? 'outline'}
          rows={Number.isFinite(rowsNum) ? rowsNum : 2}
          autoGrow={readBoolean(overrides, 'auto_grow')}
          readonly={readBoolean(overrides, 'readonly')}
          onInput={handleInput}
        />
      );
    }

    case 'IonToggle': {
      const handleToggle = action
        ? (e: CustomEvent) => {
            const target = e.target as { checked?: unknown } | null;
            const value = target?.checked === true;
            dispatch({
              ...action,
              item: {
                ...((action.item as Record<string, unknown> | null | undefined) ?? {}),
                value,
              },
            });
          }
        : undefined;
      return (
        <SeededIonToggle
          initialChecked={readBoolean(overrides, 'checked')}
          disabled={readBoolean(overrides, 'disabled')}
          onToggle={handleToggle}
        />
      );
    }

    case 'IonSegment': {
      const handlePick = action
        ? (value: string) =>
            dispatch({
              ...action,
              item: { ...((action.item as Record<string, unknown> | null | undefined) ?? {}), value },
            })
        : undefined;
      return (
        <SeededIonSegment
          value={readString(overrides, 'value') ?? ''}
          options={readSelectOptions(overrides, 'options')}
          disabled={readBoolean(overrides, 'disabled')}
          onPick={handlePick}
        />
      );
    }

    case 'AppzaFilePicker':
      return <AppzaFilePicker overrides={overrides} />;

    case 'AppzaFileList':
      return <AppzaFileList overrides={overrides} />;
    case 'AppzaSocialLinks':
      return <AppzaSocialLinks overrides={overrides} />;
    case 'AppzaProfileFields':
      return <AppzaProfileFields overrides={overrides} />;
    case 'AppzaDetailCards':
      return <AppzaDetailCards overrides={overrides} />;
    case 'AppzaCourseQuiz':
      return <CourseQuiz overrides={overrides} action={action} dispatch={dispatch} />;

    case 'AppzaAvatarStack':
      return <AppzaAvatarStack overrides={overrides} />;

    case 'AppzaCommentList':
      return <AppzaCommentList overrides={overrides} action={action} dispatch={dispatch} />;

    case 'AppzaCommentThread':
      return <AppzaCommentThread overrides={overrides} action={action} dispatch={dispatch} />;

    case 'AppzaCommentComposer':
      return <AppzaCommentComposer overrides={overrides} action={action} dispatch={dispatch} />;

    case 'AppzaMediaTile':
      return <AppzaMediaTile overrides={overrides} />;

    case 'AppzaAudioPlayer':
      return <AppzaAudioPlayer overrides={overrides} />;

    case 'AppzaAudioList':
      return <AppzaAudioList overrides={overrides} />;

    case 'AppzaChatBubble':
      return <AppzaChatBubble overrides={overrides} />;

    case 'AppzaChatComposer':
      return <AppzaChatComposer overrides={overrides} action={action} dispatch={dispatch} />;

    case 'AppzaPostComposer':
      return <AppzaPostComposer overrides={overrides} action={action} dispatch={dispatch} />;

    case 'AppzaPostAnnounce':
      return <AppzaPostAnnounce overrides={overrides} />;

    case 'AppzaPostSchedule':
      return <AppzaPostSchedule overrides={overrides} />;

    case 'AppzaPostPreview':
      return <AppzaPostPreview overrides={overrides} />;

    case 'IonLabel':
      return <IonLabel>{label}</IonLabel>;

    case 'IonText': {
      const color = readString(overrides, 'color');
      const size = readString(overrides, 'size');
      const weight = readString(overrides, 'weight');
      const align = readString(overrides, 'align');
      // '' means the field is missing at runtime: hide rather than fall back to the primitive's name.
      const rawText = overrides ? overrides['text'] : undefined;
      if (rawText === '') return null;
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
      // Native <select>, not IonSelect: IonSelect misbehaves when options arrive after mount, and readFormFieldValue reads `.value`.
      const placeholder = readString(overrides, 'placeholder') ?? label;
      const options = readSelectOptions(overrides, 'options');
      const initialValue = readString(overrides, 'value') ?? '';
      const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!action) return;
        const value = e.target.value;
        dispatch({
          ...action,
          item: { ...(action.item as Record<string, unknown> | null | undefined ?? {}), value },
        });
      };
      // Controlled only when an action is wired; without an onChange source a controlled select snaps back to defaultValue.
      const leadingLabel = readString(overrides, 'label');
      const selectEl = action ? (
        <select
          className="appza-native-select"
          value={initialValue}
          onChange={handleChange}
          style={{
            padding: '4px 20px 4px 4px',
            fontSize: 14,
            border: 'none',
            background: 'transparent',
            color: 'var(--ion-color-dark, #1f2937)',
            fontWeight: 500,
            cursor: action ? 'pointer' : 'default',
            appearance: 'auto',
          }}
        >
          {initialValue === '' && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <select
          className="appza-native-select"
          defaultValue={initialValue}
          style={{
            padding: '4px 20px 4px 4px',
            fontSize: 14,
            border: '1px solid var(--ion-color-medium, #d1d5db)',
            borderRadius: 6,
            background: '#fff',
            color: 'var(--ion-color-dark, #1f2937)',
          }}
        >
          {initialValue === '' && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
      if (!leadingLabel) return selectEl;
      return (
        <span
          className="appza-select-with-label"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span
            style={{
              color: 'var(--ion-color-medium, #6b7280)',
              fontSize: 14,
              fontWeight: 400,
            }}
          >
            {leadingLabel}
          </span>
          {selectEl}
        </span>
      );
    }

    case 'IonCheckbox': {
      const checkboxText = readString(overrides, 'text');
      if (!checkboxText) return <IonCheckbox aria-label={label} />;
      return (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <IonCheckbox aria-label={checkboxText} />
          <span>{checkboxText}</span>
        </label>
      );
    }

    case 'IonChip': {
      // A hex passed to Ionic's `color` becomes a class that styles nothing, so colours go on the chip's own variables.
      const color = readString(overrides, 'color');
      const bgColor = readString(overrides, 'bg_color');
      const themeColor = color && isIonicThemeColor(color) ? color : undefined;
      const inlineColor = color && !themeColor ? color : undefined;
      const style: Record<string, string> = {};
      if (inlineColor) {
        style['--color'] = inlineColor;
        style.color = inlineColor;
      }
      if (bgColor) {
        style['--background'] = bgColor;
        style.background = bgColor;
      }
      return (
        <IonChip
          color={themeColor}
          style={Object.keys(style).length ? (style as CSSProperties) : undefined}
        >
          {label}
        </IonChip>
      );
    }

    case 'IonIcon': {
      const iconSlug = readString(overrides, 'icon');
      const resolved = iconSlug ? resolveIcon(iconSlug) : undefined;
      if (!resolved) return null;
      const iconColor = readString(overrides, 'color');
      return <IonIcon icon={resolved} color={iconColor} />;
    }

    case 'IonList':
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

const DIRECT_VIDEO_EXT = ['mp4', 'webm', 'ogv', 'mov', 'm4v'];
const DIRECT_AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'];

/** Decided on the path's extension: a FluentPlayer upload is a file, not an embeddable page. */
function directMediaKind(src: string): 'video' | 'audio' | null {
  let path = src;
  try {
    path = new URL(src, 'https://x.invalid').pathname;
  } catch {
    path = src.split('?')[0] ?? src;
  }
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  if (DIRECT_VIDEO_EXT.includes(ext)) return 'video';
  if (DIRECT_AUDIO_EXT.includes(ext)) return 'audio';
  return null;
}

// Kept across mounts so a list refetch doesn't reset the user's play decision.
const videoEmbedPlayingCache = new Map<string, boolean>();

/** HTML is the wp_kses-sanitized proxy payload, so dangerouslySetInnerHTML is safe. */
function AppzaRichText({
  html,
  moreLabel,
  lessLabel,
  collapsedStateKey,
}: {
  html: string;
  moreLabel?: string;
  lessLabel?: string;
  /** Only `feed_banner.expanded` is understood; anything else falls back to self-managed, so a typo can't freeze the text clamped. */
  collapsedStateKey?: string;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const external = collapsedStateKey === 'feed_banner.expanded';
  const banner = useBannerControls();
  const effectiveExpanded = external ? banner.expanded : expanded;
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Measure only while clamped: expanded, clientHeight meets scrollHeight and would hide the toggle.
    if (effectiveExpanded) return;
    const isOverflow = el.scrollHeight - el.clientHeight > 2;
    setOverflowing(isOverflow);
    if (external) {
      // The other half of the banner's `collapsible` verdict comes from PlacementRenderer, joined in bannerStateEntries.
      setBannerControls({ descriptionOverflows: isOverflow });
    }
    if (!isOverflow) setExpanded(false);
  }, [html, effectiveExpanded, external]);
  return (
    <div className="appza-rich-text-wrap">
      <div
        ref={bodyRef}
        className={`appza-rich-text${effectiveExpanded ? ' appza-rich-text-expanded' : ' appza-rich-text-clamped'}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflowing && !external && (
        <button
          type="button"
          className="appza-rich-text-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? (lessLabel || 'Show Less') : (moreLabel || 'Show More')}
        </button>
      )}
    </div>
  );
}

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
  const direct = src ? directMediaKind(src) : null;

  // A <video>/<audio> element only decodes bytes, so this doesn't relax the iframe allowlist.
  if (direct && src) {
    return direct === 'audio' ? (
      <audio className="appza-video-embed-native" src={src} controls preload="metadata" />
    ) : (
      <video
        className="appza-video-embed-native"
        src={src}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
      />
    );
  }

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
            openExternal(src);
          }
        }}
      >
        <span className="appza-video-embed-play-glyph" aria-hidden="true" />
      </button>
    </div>
  );
}

function readBoolean(overrides: PrimitiveOverrides | undefined, key: string): boolean {
  if (!overrides) return false;
  const v = overrides[key];
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === '1' || v === 1;
}

function readString(overrides: PrimitiveOverrides | undefined, key: string): string | undefined {
  if (!overrides) return undefined;
  const v = overrides[key];
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

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
  const px = readString(overrides, 'padding_x');
  if (px !== undefined) out['--padding-end'] = px;
  const py = readString(overrides, 'padding_y');
  if (py !== undefined) out['--padding-bottom'] = py;
  return out;
}

/** Styles `::part(native)` from outside with !important, the only thing that beats Ionic's `color=` theme cascade. */
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

  // Padding stays on the host as --padding-*: Ionic reads those internally.
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
  // A colour without a width needs an explicit border: Ionic's fills inherit border: 0.
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

/** Ionic silently drops non-theme values from `color=`. */
function isIonicThemeColor(v: string): boolean {
  return IONIC_THEME_COLORS.has(v);
}

type PollOption = {
  label: string;
  slug: string;
  vote_counts?: number;
  percentage?: number;
  voted?: boolean;
};

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

/** Tile indices address the FULL images array, so the "+N" tile opens the 4th image. */
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
              <BlobImage src={img.url} alt="" />
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

/** Cross-origin images go through fetch() so the Capacitor shell's header overrides apply; native image loaders never send them. */
const BLOB_IMG_CACHE = new Map<string, string>();
function BlobImage({ src, alt }: { src: string; alt: string }) {
  const isCrossOrigin =
    /^https?:\/\//i.test(src) &&
    typeof window !== 'undefined' &&
    (() => {
      try {
        return new URL(src).origin !== window.location.origin;
      } catch {
        return false;
      }
    })();
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(
    isCrossOrigin ? BLOB_IMG_CACHE.get(src) ?? null : src,
  );
  useEffect(() => {
    if (!isCrossOrigin) {
      setResolvedSrc(src);
      return;
    }
    const cached = BLOB_IMG_CACHE.get(src);
    if (cached) {
      setResolvedSrc(cached);
      return;
    }
    let cancelled = false;
    const short = src.length > 60 ? '…' + src.slice(-58) : src;
    console.log('[BlobImage] fetch start', short);
    void (async () => {
      try {
        const res = await fetch(src);
        console.log('[BlobImage] fetch', short, 'status=' + res.status + ' ct=' + (res.headers.get('content-type') ?? ''));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        console.log('[BlobImage] blob', short, 'size=' + blob.size + ' type=' + blob.type);
        const url = URL.createObjectURL(blob);
        BLOB_IMG_CACHE.set(src, url);
        if (!cancelled) setResolvedSrc(url);
      } catch (err) {
        console.warn('[BlobImage] FAIL', short, err instanceof Error ? err.message : String(err));
        if (!cancelled) setResolvedSrc(src);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, isCrossOrigin]);
  if (!resolvedSrc) {
    return <div style={{ width: '100%', height: '100%', background: '#0f172a' }} />;
  }
  return <img src={resolvedSrc} alt={alt} loading="lazy" />;
}

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
    const voteCountsRaw = rec.vote_counts;
    const percentageRaw = rec.percentage;
    const votedRaw = rec.voted;
    out.push({
      label,
      slug: slug ?? label,
      vote_counts:
        typeof voteCountsRaw === 'number'
          ? voteCountsRaw
          : typeof voteCountsRaw === 'string' && voteCountsRaw !== '' && !Number.isNaN(Number(voteCountsRaw))
            ? Number(voteCountsRaw)
            : undefined,
      percentage:
        typeof percentageRaw === 'number'
          ? percentageRaw
          : typeof percentageRaw === 'string' && percentageRaw !== '' && !Number.isNaN(Number(percentageRaw))
            ? Number(percentageRaw)
            : undefined,
      voted: votedRaw === true || votedRaw === 1 || votedRaw === '1' || votedRaw === 'yes',
    });
  }
  return out;
}

/** Each tap syncs the full voted set; the server treats it as an idempotent set-vote. */
function AppzaPollBlock({
  type,
  options,
  action,
  dispatch,
  totalLabel,
  votersSlug,
  postId,
}: {
  type: string | undefined;
  options: PollOption[];
  action?: ActionInvocation;
  dispatch: (inv: ActionInvocation) => void;
  totalLabel: string;
  votersSlug: string;
  postId?: number | string;
}) {
  const isMulti = type === 'multi_choice';
  const [optionState, setOptionState] = useState<PollOption[]>(options);
  // Deep-compared via JSON so a new reference doesn't reset a mid-flight click.
  const optionsKey = JSON.stringify(options);
  useEffect(() => {
    setOptionState(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  if (optionState.length === 0) {
    return <div className="appza-poll-block appza-poll-block-empty">No options.</div>;
  }

  const totalVotes = optionState.reduce((sum, o) => sum + (o.vote_counts ?? 0), 0);

  const syncVotes = (nextState: PollOption[]) => {
    if (!action) return;
    const votedSlugs = nextState.filter((o) => o.voted === true).map((o) => o.slug);
    dispatch({
      ...action,
      item: {
        ...((action.item as Record<string, unknown> | null | undefined) ?? {}),
        vote_indexes: votedSlugs,
      },
    });
  };

  const toggle = (slug: string) => {
    setOptionState((prev) => {
      // Optimistic: the dispatcher mutates survey_config in place, which may not re-render the parent.
      const next = prev.map((o) => {
        if (isMulti) {
          if (o.slug !== slug) return o;
          const nowVoted = !o.voted;
          const cur = o.vote_counts ?? 0;
          return { ...o, voted: nowVoted, vote_counts: Math.max(0, cur + (nowVoted ? 1 : -1)) };
        }
        if (o.slug === slug) {
          const nowVoted = !o.voted;
          const cur = o.vote_counts ?? 0;
          return { ...o, voted: nowVoted, vote_counts: Math.max(0, cur + (nowVoted ? 1 : -1)) };
        }
        if (o.voted) {
          const cur = o.vote_counts ?? 0;
          return { ...o, voted: false, vote_counts: Math.max(0, cur - 1) };
        }
        return o;
      });
      const newTotal = next.reduce((sum, o) => sum + (o.vote_counts ?? 0), 0);
      const withPct = next.map((o) => ({
        ...o,
        percentage: newTotal > 0 ? Math.round(((o.vote_counts ?? 0) / newTotal) * 1000) / 10 : 0,
      }));
      syncVotes(withPct);
      return withPct;
    });
  };

  // Multi-choice with no votes shows no tally (single-choice shows "0% · 0"); the control fills only for the viewer's own picks.
  const showTally = !isMulti || totalVotes > 0;

  const rows = optionState.map((opt) => {
    const pctRaw =
      typeof opt.percentage === 'number'
        ? opt.percentage
        : totalVotes > 0
          ? Math.round(((opt.vote_counts ?? 0) / totalVotes) * 100)
          : 0;
    const pct = Math.max(0, Math.min(100, pctRaw));
    const votes = opt.vote_counts ?? 0;
    const checked = !!opt.voted;
    return (
      <label
        key={opt.slug}
        className={`appza-poll-row${checked ? ' appza-poll-row-voted' : ''}`}
        onClick={(e) => {
          // The label owns the toggle; the inner control is visual-only so the sync never double-fires.
          e.preventDefault();
          toggle(opt.slug);
        }}
      >
        <div className="appza-poll-row-bar" style={{ width: `${pct}%` }} />
        <div className="appza-poll-row-content">
          {isMulti ? (
            <IonCheckbox checked={checked} />
          ) : (
            <IonRadio value={opt.slug} />
          )}
          <span className="appza-poll-label">{opt.label}</span>
          {showTally && (
            <span className="appza-poll-tally">
              <span className="appza-poll-pct">{pct}%</span>
              <span className="appza-poll-dot"> · </span>
              <span className="appza-poll-count">{votes}</span>
              {votes > 0 && votersSlug && (
                <button
                  type="button"
                  className="appza-poll-voters"
                  aria-label={`Who voted for ${opt.label ?? 'this option'}`}
                  onClick={(e) => {
                    // Opening the voter list is not a vote.
                    e.preventDefault();
                    e.stopPropagation();
                    dispatch({
                      action_slug: votersSlug,
                      args: readActionDefaultsFromCatalog(votersSlug) ?? undefined,
                      // Bound as a scalar: a field_mapping of bare `data` resolves to undefined.
                      item: { id: postId, option_slug: opt.slug, option_label: opt.label },
                    });
                  }}
                >
                  <IonIcon icon={resolveIcon('chevron-forward') ?? undefined} />
                </button>
              )}
            </span>
          )}
        </div>
      </label>
    );
  });

  // Counts votes, not voters: a multi-choice poll lets one person cast several.
  const tally = (
    <div className="appza-poll-total">
      {totalVotes} {totalLabel}
    </div>
  );

  if (isMulti) {
    return (
      <div className="appza-poll-block" data-appza-inline-click="true">
        {rows}
        {tally}
      </div>
    );
  }

  const pickedSlug = optionState.find((o) => o.voted)?.slug ?? '';
  return (
    <div className="appza-poll-block" data-appza-inline-click="true">
      <IonRadioGroup value={pickedSlug}>{rows}</IonRadioGroup>
      {tally}
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

// Warns once per name: this runs on every render of every icon.
const unknownIconNames = new Set<string>();

/** Undefined is indistinguishable from "no icon wanted" downstream, so an unknown name warns. */
export function resolveIcon(name: string): string | undefined {
  if (ICON_REGISTRY[name]) return ICON_REGISTRY[name];
  if (ICON_REGISTRY[name + '-outline']) return ICON_REGISTRY[name + '-outline'];

  if (name && !unknownIconNames.has(name)) {
    unknownIconNames.add(name);
    // eslint-disable-next-line no-console
    console.warn(
      `[appza-renderer] icon "${name}" is not in ICON_REGISTRY — it will render as nothing. ` +
        'Add it to the registry in PrimitiveRenderer.tsx (import the ionicons export, then map the ' +
        'catalog name to it). The registry is explicit because a dynamic lookup gets tree-shaken away.',
    );
  }
  return undefined;
}

/** Exposed so a check can assert no unknown icons after exercising a screen. */
export function unknownIcons(): string[] {
  return Array.from(unknownIconNames);
}

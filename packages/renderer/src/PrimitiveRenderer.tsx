import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import { useActionDispatch, type ActionInvocation } from './actionContext';
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
  globe,
  globeOutline,
  informationCircleOutline,
  lockClosed,
  lockClosedOutline,
  trophy,
  trophyOutline,
  link,
  linkOutline,
  pencilOutline,
  pinOutline,
  // Saved Posts: the sort sheet's New Activity and Alphabetical glyphs,
  // and Pin-to-sidebar's stacked layers — which on a screen full of
  // bookmark buttons is the glyph that reads where a bookmark misleads.
  ellipseOutline,
  helpCircleOutline,
  layersOutline,
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
import { AppzaCommentList } from './CommentList';
import { AppzaAvatarStack } from './AvatarStack';
import { AppzaMediaTile } from './MediaTile';
import { AppzaAudioPlayer, AppzaAudioList } from './AudioPlayerRow';
import { AppzaChatBubble } from './ChatBubble';
import { AppzaChatComposer } from './ChatComposer';
import { AppzaPostComposer, AppzaPostAnnounce } from './PostComposer';
import { AppzaPostSchedule } from './PostSchedule';
import { AppzaPostPreview } from './PostPreview';
import { attach, attachOutline, cloudUploadOutline } from 'ionicons/icons';

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
// Multi-color Google "G" — not shipped in Ionicons; used by
// fc-signin-info's Continue-with-Google button. Kept as a data URI so
// it flows through the same resolveIcon() path as everything else.
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
  // General / utility
  add,
  'add-circle': addCircle,
  'add-circle-outline': addCircleOutline,
  apps,
  'arrow-back': arrowBack,
  'arrow-forward': arrowForward,
  // The reply glyph. Missing until now, so the chat bubble's reply
  // arrow and the composer's reply strip both drew an empty box —
  // resolveIcon returns nothing for a name the registry lacks, and
  // nothing downstream complains. Same shape as the copy-outline gap.
  'arrow-undo': arrowUndo,
  'arrow-undo-outline': arrowUndoOutline,
  book,
  'chevron-back': chevronBack,
  'chevron-down': chevronDown,
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

  // Status / alerts
  'alert-circle': alertCircle,
  'alert-circle-outline': alertCircleOutline,
  checkmark,
  'checkmark-circle': checkmarkCircle,
  'checkmark-circle-outline': checkmarkCircleOutline,
  close,
  // The ⨯ on a Search screen recent row. Registered because the registry
  // is EXPLICIT — a dynamic ionicons lookup gets tree-shaken away, so an
  // unregistered name renders as nothing at all (P100). The renderer warns
  // when it happens; this one was caught by that warning.
  'close-outline': closeOutline,
  'close-circle': closeCircle,
  copy,
  'copy-outline': copyOutline,
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
  'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
  'flag-outline': flagOutline,
  globe,
  'globe-outline': globeOutline,
  'lock-closed': lockClosed,
  'lock-closed-outline': lockClosedOutline,
  // Leaderboard: the medal on the first three ranks, the glyph in the
  // viewer card's points cell, and the empty state's outline variant.
  trophy,
  'trophy-outline': trophyOutline,
  'pencil-outline': pencilOutline,
  'pin-outline': pinOutline,
  // Saved Posts sort sheet + 3-dot sheet (designs 4 and 5).
  'ellipse-outline': ellipseOutline,
  'help-circle-outline': helpCircleOutline,
  'layers-outline': layersOutline,
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
  // Files — the documents tab's row glyphs + download affordance,
  // and the add-document dropzone's paperclip.
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
  // Transport glyphs for the MEDIA sub-tab (2026-08-17): the grid's play
  // badge and the audio row's play / pause / ±10s / mute controls. The
  // registry is an allowlist, so an icon that isn't here resolves to
  // undefined and the control renders EMPTY rather than erroring — which
  // is exactly how the play badge went missing on first run.
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

  // Third-party / brand
  google: GOOGLE_LOGO_SVG,
};

/** Public list of known icon names — consumed by the plug-in admin's
 *  Options tab autocomplete. Keep in lockstep with ICON_REGISTRY. */
export const iconNames: string[] = Object.keys(ICON_REGISTRY).sort();

type PrimitiveOverrides = Record<string, unknown>;

type Props = {
  primitive: PrimitiveRow;
  overrides?: PrimitiveOverrides;
  /**
   * Wiring for primitives whose native event isn't `click` (currently just
   * ion-select's change event). When set, the primitive fires
   * dispatch(action) with the selected value grafted onto action.item. The
   * SSRenderer wrapper skips its usual click-dispatch for these primitives
   * (see SELF_ACTION_PRIMITIVES below).
   */
  action?: ActionInvocation;
};

/**
 * Primitives that handle their own action dispatch (via a native event
 * other than click). The SSRenderer wrapper skips its onClick handler for
 * these — otherwise the wrapper-click would fire dispatch when the user
 * just opens the select, before a value is chosen.
 */
/**
 * ion-toggle seeded ONCE, then left alone.
 *
 * Passing `checked` as a React prop makes the switch permanently
 * unflippable: Ionic sets the property on the custom element, the user's
 * tap flips it, the next render (which the tap itself causes, via the
 * store it writes) sets the same prop back, and the switch snaps to its
 * old position. It reads as "the toggle does nothing".
 *
 * So the catalog's value is written to the element once, on mount, and
 * after that the switch owns its own position and only reports changes.
 */
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

export const SELF_ACTION_PRIMITIVES: ReadonlySet<string> = new Set([
  'ion-select',
  'appza-poll-block',
  'appza-post-schedule',
  'ion-input',
  // Both dispatch from their own value-change event, same as ion-input:
  // a wrapper click carries no value and fires before the user has typed
  // or flipped anything.
  'ion-textarea',
  'ion-toggle',
  // The attach button sits INSIDE the input pill, so a wrapper click
  // would fire the picker whenever anyone tapped the field to type.
  'appza-chat-composer',
  // Same reason: the space chip sits inside a card the user types in, so
  // a wrapper click would open the space picker on every tap of the body.
  'appza-post-composer',
  // Every row carries Reply, a heart and a ⋮ of its own, so a wrapper
  // click would open the menu whenever anyone tapped a comment's text.
  'appza-comment-list',
]);

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
export function PrimitiveRenderer({ primitive, overrides, action }: Props) {
  const label = readString(overrides, 'text') ?? primitive.name ?? primitive.slug;
  const dispatch = useActionDispatch();

  switch (primitive.ionic_component) {
    case 'IonButton': {
      const iconName = readString(overrides, 'icon');
      const iconEndName = readString(overrides, 'icon_end');
      const rawText = overrides ? overrides['text'] : undefined;
      const textExplicitlyEmpty = rawText === '';
      const iconOnly = !!iconName && (textExplicitlyEmpty || readString(overrides, 'text') === undefined);
      const buttonLabel = textExplicitlyEmpty ? '' : label;
      // icon_slot override — accepts 'start' | 'end'. Default 'start' to
      // preserve prior behavior; catalog opts in via override (e.g. the
      // fc-feed-toolbar sort button uses 'end' so the chevron sits after
      // the label).
      const iconSlotOverride = readString(overrides, 'icon_slot');
      const iconSlot = iconOnly
        ? 'icon-only'
        : iconSlotOverride === 'end'
          ? 'end'
          : 'start';
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
          {iconName && resolveIcon(iconName) && iconSlot !== 'end' && (
            <IonIcon icon={resolveIcon(iconName)} slot={iconSlot} />
          )}
          {!iconOnly && buttonLabel}
          {iconName && resolveIcon(iconName) && iconSlot === 'end' && (
            <IonIcon icon={resolveIcon(iconName)} slot="end" />
          )}
          {/* icon_end — a SECOND glyph pinned after the label, independent of
              icon_slot. The document file row needs a leading file-type glyph
              AND a trailing download glyph on one tappable row; icon_slot can
              only place the single `icon`. */}
          {iconEndName && resolveIcon(iconEndName) && iconSlot !== 'end' && (
            <IonIcon icon={resolveIcon(iconEndName)} slot="end" className="appza-icon-end" />
          )}
        </ThemedIonButton>
      );
    }

    case 'IonAvatar': {
      const src = readString(overrides, 'src');
      const initials = readString(overrides, 'initials');
      const alt = readString(overrides, 'alt') ?? '';
      // No photo AND no initials means there is no person here — a
      // conversation that never resolved, a row still loading. Drawing a
      // hardcoded letter invents one: the chat appbar showed a confident
      // teal "A" for a thread that did not exist. An empty circle is the
      // honest shape, and it stays visible and selectable in the builder.
      const fallbackText = initials ?? '';
      // Size and the initials palette are overridable because the chat
      // appbar needs a smaller circle than a profile row, and its fill
      // comes off the thread (teal behind a space, grey behind a person)
      // rather than being one value for the whole template. Absent
      // overrides keep the previous fixed 40px + stylesheet colours, so
      // every existing avatar renders unchanged.
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
        />
      );

    case 'AppzaRichText': {
      const html = readString(overrides, 'text') ?? '';
      return (
        <AppzaRichText
          html={html}
          moreLabel={readString(overrides, 'more_label')}
          lessLabel={readString(overrides, 'less_label')}
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
      // When an action is wired to the input (e.g. fc-spaces-toolbar search
      // → spaces.set_search), dispatch on every keystroke with item.value
      // set to the current text. Mirrors ion-select's pattern of grafting
      // the picked value onto action.item so the shell's dispatcher can
      // read the current value uniformly. onIonInput fires for every
      // character (including clears); onIonChange only fires on blur, so
      // it would feel laggy for search-as-you-type.
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
        <IonInput
          type={inputType}
          placeholder={readString(overrides, 'placeholder') ?? label}
          fill={(fillProp as 'solid' | 'outline' | undefined) ?? 'outline'}
          // Ionic's own clear affordance — shows the ⨯ only while the field
          // has a value, which is exactly the documents-search design. It
          // fires onIonInput with '' when tapped, so the wired action clears
          // the state slice without a second child + action.
          clearInput={readBoolean(overrides, 'clear_input')}
          onIonInput={handleInput}
        />
      );
    }

    case 'IonTextarea': {
      const rowsStr = readString(overrides, 'rows');
      const rowsNum = rowsStr ? Number.parseInt(rowsStr, 10) : NaN;
      const fillProp = readString(overrides, 'fill');
      // Same contract as IonInput: dispatch on every keystroke with the
      // current text grafted onto action.item.value.
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
        <IonTextarea
          placeholder={readString(overrides, 'placeholder') ?? label}
          fill={(fillProp as 'solid' | 'outline' | undefined) ?? 'outline'}
          rows={Number.isFinite(rowsNum) ? rowsNum : 2}
          autoGrow={readBoolean(overrides, 'auto_grow')}
          onIonInput={handleInput}
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

    case 'AppzaFilePicker':
      return <AppzaFilePicker overrides={overrides} />;

    case 'AppzaFileList':
      return <AppzaFileList overrides={overrides} />;

    case 'AppzaAvatarStack':
      return <AppzaAvatarStack overrides={overrides} />;

    case 'AppzaCommentList':
      return <AppzaCommentList overrides={overrides} action={action} dispatch={dispatch} />;

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
      // Explicit empty string means "field is missing at runtime, hide me"
      // — used by field_mappings that resolve to '' when the upstream
      // value is null (e.g. fc-member-card sets username='' when
      // xprofile.username is null). Without this bail-out the primitive
      // falls back to its name ("Text") and paints a placeholder.
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
      const initialValue = readString(overrides, 'value') ?? '';
      // The wrapper's onClick is bypassed for ion-select (see SELF_ACTION_
      // PRIMITIVES); dispatch fires here with the chosen value grafted onto
      // action.item so App-side dispatchers can read
      // ({value}) via inv.item.value or effectiveItem.value.
      const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!action) return;
        const value = e.target.value;
        dispatch({
          ...action,
          item: { ...(action.item as Record<string, unknown> | null | undefined ?? {}), value },
        });
      };
      // Two modes:
      //   1. Action wired (e.g. fc-feed-toolbar sort) — controlled select.
      //      `value` follows the prop so updating overrides.value (via
      //      setFeedControls) reflects in the visible selection; onChange
      //      dispatches the pick.
      //   2. No action (e.g. fc-post-information space picker) — uncontrolled
      //      select via `defaultValue`. Value lives in the DOM; the form's
      //      dispatcher reads it via readFormFieldValue on submit. Marking
      //      it controlled without an onChange source would snap the pick
      //      back to defaultValue immediately.
      //
      // If overrides.label is set (e.g. fc-feed-toolbar's sort_label
      // = "Sort by:"), render it as a leading span since the native
      // <select> has no label slot. Wrapper is inline-flex so the label
      // + select sit on one line.
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

    case 'IonIcon': {
      // Standalone icon glyph. Reads `icon` (slug) + `color` from overrides.
      // Ionicons imports are lazy — resolveIcon returns undefined for unknown
      // slugs and we render nothing rather than a broken chip so a stale
      // catalog can't break the row visually.
      const iconSlug = readString(overrides, 'icon');
      const resolved = iconSlug ? resolveIcon(iconSlug) : undefined;
      if (!resolved) return null;
      const iconColor = readString(overrides, 'color');
      return <IonIcon icon={resolved} color={iconColor} />;
    }

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

/** Extensions a browser can decode natively in <video> / <audio>. */
const DIRECT_VIDEO_EXT = ['mp4', 'webm', 'ogv', 'mov', 'm4v'];
const DIRECT_AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'];

/**
 * Is `src` a media FILE rather than an embed page?
 *
 * FluentPlayer uploads arrive as a plain uploads URL ending in .mp4/.mp3,
 * which is not an embeddable page and is not on the iframe allowlist —
 * so before this it fell through to window.open and left the app.
 * Decided on the path's extension, ignoring the query string, because
 * that is what actually tells us a native element can decode it.
 */
function directMediaKind(src: string): 'video' | 'audio' | null {
  let path = src;
  try {
    path = new URL(src, 'https://x.invalid').pathname;
  } catch {
    // Relative or malformed — fall back to the raw string, minus any query.
    path = src.split('?')[0] ?? src;
  }
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  if (DIRECT_VIDEO_EXT.includes(ext)) return 'video';
  if (DIRECT_AUDIO_EXT.includes(ext)) return 'audio';
  return null;
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

/**
 * Rich-text body with a "Show More" / "Show Less" toggle.
 *
 * On mount + on html change, measures whether the content's natural
 * height exceeds the collapsed clamp (via scrollHeight vs clientHeight).
 * When it does, renders a small text button below the paragraph that
 * flips a class controlling `-webkit-line-clamp`. Short posts skip the
 * button entirely so we don't clutter one-line feeds. HTML sink is the
 * same wp_kses-sanitized payload from PreviewProxyController — safe to
 * dangerouslySetInnerHTML.
 */
function AppzaRichText({
  html,
  moreLabel,
  lessLabel,
}: {
  html: string;
  /** Builder-controlled; Noor's designs 14 and 15 say "Show More". */
  moreLabel?: string;
  lessLabel?: string;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Read the clamped height first. If content exceeds it, show the toggle.
    // Re-measure on html change so a proxy-refreshed post with a longer
    // body re-evaluates.
    const isOverflow = el.scrollHeight - el.clientHeight > 2;
    setOverflowing(isOverflow);
    // If html shrank, reset expanded so long → short transitions are clean.
    if (!isOverflow) setExpanded(false);
  }, [html]);
  return (
    <div className="appza-rich-text-wrap">
      <div
        ref={bodyRef}
        className={`appza-rich-text${expanded ? ' appza-rich-text-expanded' : ' appza-rich-text-clamped'}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflowing && (
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

  // A file we serve ourselves plays in a native element. This is NOT the
  // allowlist being relaxed: the allowlist governs IFRAMES, where the
  // third party gets script execution in our origin's frame tree. A
  // <video>/<audio> element decodes bytes and can do nothing else, so a
  // FluentPlayer upload is safe to play in place — and handing it to
  // window.open instead (the old fallback) threw the user out of the app
  // to a browser tab, which is what "video not play" looked like.
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
            window.open(src, '_blank', 'noopener,noreferrer');
          }
        }}
      >
        <span className="appza-video-embed-play-glyph" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Boolean prop read. Accepts a real boolean (schema type `boolean` round-trips
 * as one) or the string forms the right-panel text inputs produce.
 */
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

/**
 * <img> replacement that fetches cross-origin URLs via fetch() first, then
 * uses the resulting blob as the src. Same-origin URLs render as a plain
 * native <img> (no extra roundtrip; matches pre-existing behavior on the
 * plugin-admin sim). Cross-origin path exists so the Capacitor Android
 * shell can pick up window.fetch's header overrides (e.g. dev-tunnel
 * bypass headers) on <img> loads, which native image loaders never send.
 * Blob URLs are cached module-wide keyed by original src so repeated
 * renders + multiple cards on the same image don't refetch.
 */
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
    // Reserve the slot while the blob resolves so the collage layout
    // doesn't collapse. Same background as .appza-image-gallery-slide.
    return <div style={{ width: '100%', height: '100%', background: '#0f172a' }} />;
  }
  return <img src={resolvedSrc} alt={alt} loading="lazy" />;
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

/**
 * Interactive poll — mirrors the FluentCommunity web portal UX. Each row
 * is always tappable (radio for `single_choice`, checkbox for `multi_
 * choice`) with a progress bar overlay showing the current percentage.
 * There is no separate "Vote" button + no locked results view: every
 * tap flips the option's local `voted` state and immediately dispatches
 * `on_tap_poll_vote` with the current set of voted slugs (portal calls
 * this `syncVotes`). The server treats it as an idempotent set-vote
 * operation — add new, remove missing — so the user can change or clear
 * their pick at any time.
 *
 * Local `optionState` mirrors props.options so the tap→toggle is
 * responsive even before the server response lands. When the parent
 * pushes fresh options (dispatcher patches item.meta.survey_config after
 * the vote succeeds), the deep-equals sync in useEffect re-seeds.
 *
 * Registered in SELF_ACTION_PRIMITIVES so the SS wrapper skips onClick.
 * `data-appza-inline-click` also keeps DC#20 primitive-select from
 * capturing the tap in Edit mode.
 */
function AppzaPollBlock({
  type,
  options,
  action,
  dispatch,
}: {
  type: string | undefined;
  options: PollOption[];
  action?: ActionInvocation;
  dispatch: (inv: ActionInvocation) => void;
}) {
  const isMulti = type === 'multi_choice';
  const [optionState, setOptionState] = useState<PollOption[]>(options);
  // Re-seed local state whenever the incoming options[] shape changes
  // (server response replaces survey_config; on-network mount reload).
  // Deep-compare via JSON so we don't reset the user's mid-flight click
  // just because a shallow reference changed.
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
      // Optimistic vote_counts adjustment so percentages reflect the
      // change immediately. The dispatcher's server response mutates
      // item.meta.survey_config in place, but React state may not
      // re-render the parent — the local sync keeps the UI in step
      // between the tap and the next natural re-render, when the
      // useEffect on optionsKey re-seeds from authoritative props.
      const next = prev.map((o) => {
        if (isMulti) {
          if (o.slug !== slug) return o;
          const nowVoted = !o.voted;
          const cur = o.vote_counts ?? 0;
          return { ...o, voted: nowVoted, vote_counts: Math.max(0, cur + (nowVoted ? 1 : -1)) };
        }
        // single_choice: the tapped option flips; any previously voted
        // option loses its vote (counts drops by 1).
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
      // Recompute percentage locally against the new totals so the
      // progress bars widen/shrink alongside the vote change.
      const newTotal = next.reduce((sum, o) => sum + (o.vote_counts ?? 0), 0);
      const withPct = next.map((o) => ({
        ...o,
        percentage: newTotal > 0 ? Math.round(((o.vote_counts ?? 0) / newTotal) * 1000) / 10 : 0,
      }));
      syncVotes(withPct);
      return withPct;
    });
  };

  const rows = optionState.map((opt) => {
    const pctRaw =
      typeof opt.percentage === 'number'
        ? opt.percentage
        : totalVotes > 0
          ? Math.round(((opt.vote_counts ?? 0) / totalVotes) * 1000) / 10
          : 0;
    const pct = Math.max(0, Math.min(100, pctRaw));
    const checked = !!opt.voted;
    return (
      <label
        key={opt.slug}
        className={`appza-poll-row${checked ? ' appza-poll-row-voted' : ''}`}
        onClick={(e) => {
          // Own the toggle from the label — the IonCheckbox/IonRadio
          // inside gets a controlled `checked` prop and no onIonChange,
          // so it stays purely visual and never double-fires the sync.
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
          <span className="appza-poll-pct">{pct}%</span>
        </div>
      </label>
    );
  });

  if (isMulti) {
    return (
      <div className="appza-poll-block" data-appza-inline-click="true">
        {rows}
      </div>
    );
  }

  // single_choice — wrap in IonRadioGroup so the picked slug is the
  // group's `value`. Ionic uses that to render the checked ring on the
  // right IonRadio without us managing per-radio checked state.
  const pickedSlug = optionState.find((o) => o.voted)?.slug ?? '';
  return (
    <div className="appza-poll-block" data-appza-inline-click="true">
      <IonRadioGroup value={pickedSlug}>{rows}</IonRadioGroup>
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
/**
 * Names the registry has already been asked for and could not answer.
 * Keyed so the warning fires ONCE per name — this runs on every render
 * of every icon, and an unknown one in a long list would otherwise fill
 * the console with the same line.
 */
const unknownIconNames = new Set<string>();

/**
 * Catalog icon name → the Ionicons SVG string, or undefined.
 *
 * Returning undefined silently is what makes a missing registry entry so
 * expensive to find: the control still renders, laid out and styled and
 * clickable, with a hole where the glyph should be. `copy-outline` sat
 * blank on the profile card, and `arrow-undo-outline` on both the chat
 * bubble's reply arrow and the composer's reply strip — each authored
 * correctly in the catalog, each drawing nothing, none of them
 * complaining. Every consumer treats undefined as "no icon wanted",
 * which is indistinguishable from "icon wanted, name unknown".
 *
 * So say so. Once per name, naming the fix — the registry is explicit
 * on purpose (see the note above it: a dynamic lookup gets tree-shaken
 * to nothing), so a new icon always means a new line there.
 *
 * An empty name is not a mistake — most callers pass a prop that is
 * legitimately unset, meaning "draw no icon" — so it never warns.
 */
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

/**
 * Every icon name asked for that the registry could not answer, in the
 * order they were first seen. Exposed so a check can assert the set is
 * empty after exercising a screen, rather than relying on someone
 * noticing a console line.
 */
export function unknownIcons(): string[] {
  return Array.from(unknownIconNames);
}
